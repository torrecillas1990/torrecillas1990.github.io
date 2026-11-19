import { Vec3 } from '../math/Vec3';
import { RigidBody, BodyType } from './RigidBody';
import { SweepAndPrune } from '../collision/Broadphase';
import { detectCollisionGJKEPA } from '../collision/GJKEPA';
import { ContactManifold } from '../collision/ContactManifold';
import { SequentialImpulseSolver, ConstraintSolver } from '../solver/SequentialImpulseSolver';
import { raycastBody, RaycastHit } from '../collision/Raycast';

export class World {
  public bodies: RigidBody[] = [];
  public constraints: ConstraintSolver[] = [];
  public gravity = new Vec3(0, -9.81, 0);

  public fixedTimeStep = 1 / 60;
  public maxSubSteps = 5;
  public allowSleep = true;

  private accumulator = 0;
  private broadphase = new SweepAndPrune();
  private solver = new SequentialImpulseSolver();
  private manifolds = new Map<string, ContactManifold>();

  public addBody(body: RigidBody): RigidBody {
    this.bodies.push(body);
    return body;
  }

  public removeBody(body: RigidBody): void {
    const idx = this.bodies.indexOf(body);
    if (idx !== -1) this.bodies.splice(idx, 1);
  }

  public addConstraint(constraint: ConstraintSolver): void {
    this.constraints.push(constraint);
  }

  public step(dt: number): void {
    // Limitar dt máximo para evitar espiral de la muerte al cambiar de pestaña en el navegador
    const clampedDt = Math.min(dt, 0.25);
    this.accumulator += clampedDt;

    let subSteps = 0;
    while (this.accumulator >= this.fixedTimeStep && subSteps < this.maxSubSteps) {
      this.singleStep(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
      subSteps++;
    }
  }

  private singleStep(dt: number): void {
    // 1. Integrar fuerzas -> velocidades (Semi-Implicit Euler)
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (b.type !== BodyType.DYNAMIC || b.isSleeping) continue;

      // Aceleración lineal: v += (F * invMass + g) * dt
      b.linearVelocity.addScaled(b.force, b.invMass * dt);
      b.linearVelocity.addScaled(this.gravity, dt);

      // Aceleración angular: w += (I_world^-1 * torque) * dt
      const angAcc = Vec3._t0;
      b.invInertiaWorld.multiplyVec3(b.torque, angAcc);
      b.angularVelocity.addScaled(angAcc, dt);

      // Amortiguación (Damping)
      b.linearVelocity.scale(Math.max(0, 1 - b.linearDamping * dt));
      b.angularVelocity.scale(Math.max(0, 1 - b.angularDamping * dt));

      b.updateDerivedData();
    }

    // 2. Broad-Phase & Narrow-Phase
    const pairs = this.broadphase.computePairs(this.bodies);
    const activeKeys = new Set<string>();

    for (let i = 0; i < pairs.length; i++) {
      const { bodyA, bodyB } = pairs[i];
      const key = `${bodyA.id}_${bodyB.id}`;
      const result = detectCollisionGJKEPA(bodyA, bodyB);

      if (result && result.collided && result.penetration > 0) {
        activeKeys.add(key);

        // Despertar cuerpos si uno dinámico rápido golpea a uno dormido
        if (bodyA.isSleeping && bodyB.linearVelocity.lengthSq() > 0.05) bodyA.wakeUp();
        if (bodyB.isSleeping && bodyA.linearVelocity.lengthSq() > 0.05) bodyB.wakeUp();

        let manifold = this.manifolds.get(key);
        if (!manifold) {
          manifold = new ContactManifold(bodyA, bodyB);
          this.manifolds.set(key, manifold);
        } else {
          manifold.refresh();
        }

        manifold.normal.copy(result.normal);
        manifold.addPoint(result.pointA, result.pointB, result.penetration);
      }
    }

    // Eliminar manifolds que ya no están en contacto
    for (const [key, manifold] of this.manifolds.entries()) {
      if (!activeKeys.has(key) || manifold.points.length === 0) {
        this.manifolds.delete(key);
      }
    }

    // 3. Resolver restricciones e impulsos
    const activeManifolds = Array.from(this.manifolds.values());
    this.solver.solve(activeManifolds, this.constraints, dt);

    // 4. Integrar posiciones y actualizar estado de reposo (Sleeping)
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];

      if (b.type === BodyType.KINEMATIC) {
        b.position.addScaled(b.linearVelocity, dt);
        b.rotation.integrateAngularVelocity(b.angularVelocity, dt);
        b.updateDerivedData();
        continue;
      }

      if (b.type !== BodyType.DYNAMIC || b.isSleeping) continue;

      b.position.addScaled(b.linearVelocity, dt);
      b.rotation.integrateAngularVelocity(b.angularVelocity, dt);

      b.force.set(0, 0, 0);
      b.torque.set(0, 0, 0);
      b.updateDerivedData();

      if (this.allowSleep) {
        this.updateSleepState(b, dt);
      }
    }
  }

  private updateSleepState(b: RigidBody, dt: number): void {
    const linSq = b.linearVelocity.lengthSq();
    const angSq = b.angularVelocity.lengthSq();

    if (linSq < 0.0025 && angSq < 0.0025) {
      b.sleepTimer += dt;
      if (b.sleepTimer >= 0.5) {
        b.isSleeping = true;
        b.linearVelocity.set(0, 0, 0);
        b.angularVelocity.set(0, 0, 0);
      }
    } else {
      b.sleepTimer = 0;
    }
  }

  public raycast(origin: Vec3, direction: Vec3, maxDist = 1000): RaycastHit | null {
    const dir = direction.clone().normalize();
    let closest: RaycastHit | null = null;
    let bestDist = maxDist;

    for (let i = 0; i < this.bodies.length; i++) {
      const hit = raycastBody(origin, dir, this.bodies[i], bestDist);
      if (hit && hit.distance < bestDist) {
        bestDist = hit.distance;
        closest = hit;
      }
    }
    return closest;
  }

  /** Exporta las transformaciones a un buffer plano para transferencia rápida desde Web Worker */
  public writeTransformsToBuffer(buffer: Float32Array): void {
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      const offset = i * 7;
      buffer[offset] = b.position.x;
      buffer[offset + 1] = b.position.y;
      buffer[offset + 2] = b.position.z;
      buffer[offset + 3] = b.rotation.x;
      buffer[offset + 4] = b.rotation.y;
      buffer[offset + 5] = b.rotation.z;
      buffer[offset + 6] = b.rotation.w;
    }
  }
}
