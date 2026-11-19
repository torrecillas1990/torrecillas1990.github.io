import { Vec3 } from '../math/Vec3';
import { BodyType } from '../core/RigidBody';
import { ContactManifold, ContactPoint } from '../collision/ContactManifold';

export interface ConstraintSolver {
  preStep(dt: number): void;
  warmStart(): void;
  solveVelocity(): void;
  solvePosition(): void;
}

export class SequentialImpulseSolver {
  public velocityIterations = 10;
  public positionIterations = 3;
  public baumgarte = 0.2;
  public slop = 0.005; // Tolerancia de penetración (5 mm) antes de corregir posición

  public solve(manifolds: ContactManifold[], constraints: ConstraintSolver[], dt: number): void {
    const invDt = dt > 0 ? 1 / dt : 0;

    // 1. Pre-paso de restricciones (Joints) y Warm Starting de contactos
    for (let i = 0; i < constraints.length; i++) {
      constraints[i].preStep(dt);
      constraints[i].warmStart();
    }

    for (let i = 0; i < manifolds.length; i++) {
      this.warmStartManifold(manifolds[i]);
    }

    // 2. Iteraciones de velocidad (Projected Gauss-Seidel)
    for (let iter = 0; iter < this.velocityIterations; iter++) {
      for (let i = 0; i < constraints.length; i++) {
        constraints[i].solveVelocity();
      }
      for (let i = 0; i < manifolds.length; i++) {
        this.solveManifoldVelocity(manifolds[i], invDt);
      }
    }

    // 3. Iteraciones de posición (evita hundimiento progresivo)
    for (let iter = 0; iter < this.positionIterations; iter++) {
      for (let i = 0; i < constraints.length; i++) {
        constraints[i].solvePosition();
      }
      for (let i = 0; i < manifolds.length; i++) {
        this.solveManifoldPosition(manifolds[i]);
      }
    }
  }

  private computeTangentBasis(normal: Vec3, t1: Vec3, t2: Vec3): void {
    if (Math.abs(normal.x) >= 0.57735) {
      t1.set(normal.y, -normal.x, 0).normalize();
    } else {
      t1.set(0, normal.z, -normal.y).normalize();
    }
    t2.copy(normal).cross(t1);
  }

  private warmStartManifold(m: ContactManifold): void {
    const a = m.bodyA;
    const b = m.bodyB;
    const n = m.normal;
    const t1 = Vec3._t0;
    const t2 = Vec3._t1;
    this.computeTangentBasis(n, t1, t2);

    for (let i = 0; i < m.points.length; i++) {
      const cp = m.points[i];
      const rA = Vec3._t2.copy(cp.worldA).sub(a.position);
      const rB = Vec3._t3.copy(cp.worldB).sub(b.position);

      const impulse = new Vec3()
        .addScaled(n, cp.normalImpulse)
        .addScaled(t1, cp.tangentImpulse1)
        .addScaled(t2, cp.tangentImpulse2);

      if (a.type === BodyType.DYNAMIC) {
        a.linearVelocity.addScaled(impulse, -a.invMass);
        const angA = new Vec3().copy(rA).cross(impulse).negate();
        a.invInertiaWorld.multiplyVec3(angA, angA);
        a.angularVelocity.add(angA);
      }

      if (b.type === BodyType.DYNAMIC) {
        b.linearVelocity.addScaled(impulse, b.invMass);
        const angB = new Vec3().copy(rB).cross(impulse);
        b.invInertiaWorld.multiplyVec3(angB, angB);
        b.angularVelocity.add(angB);
      }
    }
  }

  private solveManifoldVelocity(m: ContactManifold, invDt: number): void {
    const a = m.bodyA;
    const b = m.bodyB;
    const n = m.normal;
    const t1 = new Vec3();
    const t2 = new Vec3();
    this.computeTangentBasis(n, t1, t2);

    for (let i = 0; i < m.points.length; i++) {
      const cp = m.points[i];
      const rA = new Vec3().copy(cp.worldA).sub(a.position);
      const rB = new Vec3().copy(cp.worldB).sub(b.position);

      // --- 1. IMPULSO NORMAL ---
      const vA = new Vec3().copy(a.angularVelocity).cross(rA).add(a.linearVelocity);
      const vB = new Vec3().copy(b.angularVelocity).cross(rB).add(b.linearVelocity);
      const relVel = new Vec3().copy(vB).sub(vA);

      const vn = relVel.dot(n);
      const effMassN = this.computeEffectiveMass(a, b, rA, rB, n);
      if (effMassN <= 0) continue;

      // Restitución solo si la velocidad de impacto supera el umbral de reposo (1 m/s)
      const restitutionBias = vn < -1.0 ? -m.restitution * vn : 0;
      let jn = -(vn - restitutionBias) * effMassN;

      const oldNormalImpulse = cp.normalImpulse;
      cp.normalImpulse = Math.max(oldNormalImpulse + jn, 0);
      jn = cp.normalImpulse - oldNormalImpulse;

      const impulseN = Vec3._t0.copy(n).scale(jn);
      this.applyPairImpulse(a, b, rA, rB, impulseN);

      // --- 2. IMPULSO DE FRICCIÓN (Ejes T1 y T2) ---
      vA.copy(a.angularVelocity).cross(rA).add(a.linearVelocity);
      vB.copy(b.angularVelocity).cross(rB).add(b.linearVelocity);
      relVel.copy(vB).sub(vA);

      const maxFriction = m.friction * cp.normalImpulse;

      // Tangente 1
      const vt1 = relVel.dot(t1);
      const effMassT1 = this.computeEffectiveMass(a, b, rA, rB, t1);
      let jt1 = -vt1 * effMassT1;
      const oldT1 = cp.tangentImpulse1;
      cp.tangentImpulse1 = Math.max(-maxFriction, Math.min(oldT1 + jt1, maxFriction));
      jt1 = cp.tangentImpulse1 - oldT1;
      this.applyPairImpulse(a, b, rA, rB, Vec3._t0.copy(t1).scale(jt1));

      // Tangente 2
      vA.copy(a.angularVelocity).cross(rA).add(a.linearVelocity);
      vB.copy(b.angularVelocity).cross(rB).add(b.linearVelocity);
      relVel.copy(vB).sub(vA);

      const vt2 = relVel.dot(t2);
      const effMassT2 = this.computeEffectiveMass(a, b, rA, rB, t2);
      let jt2 = -vt2 * effMassT2;
      const oldT2 = cp.tangentImpulse2;
      cp.tangentImpulse2 = Math.max(-maxFriction, Math.min(oldT2 + jt2, maxFriction));
      jt2 = cp.tangentImpulse2 - oldT2;
      this.applyPairImpulse(a, b, rA, rB, Vec3._t0.copy(t2).scale(jt2));
    }
  }

  private solveManifoldPosition(m: ContactManifold): void {
    const a = m.bodyA;
    const b = m.bodyB;
    const n = m.normal;

    for (let i = 0; i < m.points.length; i++) {
      const cp = m.points[i];
      // Recalcular posición actual de los puntos locales
      const wA = new Vec3().copy(cp.localA);
      a.rotation.rotateVec3(wA).add(a.position);
      const wB = new Vec3().copy(cp.localB);
      b.rotation.rotateVec3(wB).add(b.position);

      const pen = Vec3._t0.copy(wA).sub(wB).dot(n);
      if (pen <= this.slop) continue;

      const rA = new Vec3().copy(wA).sub(a.position);
      const rB = new Vec3().copy(wB).sub(b.position);

      const effMass = this.computeEffectiveMass(a, b, rA, rB, n);
      if (effMass <= 0) continue;

      const correction = Math.min(this.baumgarte * (pen - this.slop), 0.2) * effMass;
      const push = Vec3._t1.copy(n).scale(correction);

      if (a.type === BodyType.DYNAMIC) {
        a.position.addScaled(push, -a.invMass);
        const angA = new Vec3().copy(rA).cross(push).negate();
        a.invInertiaWorld.multiplyVec3(angA, angA);
        a.rotation.integrateAngularVelocity(angA, 1.0);
      }

      if (b.type === BodyType.DYNAMIC) {
        b.position.addScaled(push, b.invMass);
        const angB = new Vec3().copy(rB).cross(push);
        b.invInertiaWorld.multiplyVec3(angB, angB);
        b.rotation.integrateAngularVelocity(angB, 1.0);
      }
    }
  }

  private computeEffectiveMass(a: any, b: any, rA: Vec3, rB: Vec3, dir: Vec3): number {
    let k = a.invMass + b.invMass;

    if (a.type === BodyType.DYNAMIC) {
      const rnA = new Vec3().copy(rA).cross(dir);
      const irnA = new Vec3();
      a.invInertiaWorld.multiplyVec3(rnA, irnA);
      k += irnA.cross(rA).dot(dir);
    }

    if (b.type === BodyType.DYNAMIC) {
      const rnB = new Vec3().copy(rB).cross(dir);
      const irnB = new Vec3();
      b.invInertiaWorld.multiplyVec3(rnB, irnB);
      k += irnB.cross(rB).dot(dir);
    }

    return k > 1e-8 ? 1 / k : 0;
  }

  private applyPairImpulse(a: any, b: any, rA: Vec3, rB: Vec3, impulse: Vec3): void {
    if (a.type === BodyType.DYNAMIC) {
      a.linearVelocity.addScaled(impulse, -a.invMass);
      const angA = new Vec3().copy(rA).cross(impulse).negate();
      a.invInertiaWorld.multiplyVec3(angA, angA);
      a.angularVelocity.add(angA);
    }
    if (b.type === BodyType.DYNAMIC) {
      b.linearVelocity.addScaled(impulse, b.invMass);
      const angB = new Vec3().copy(rB).cross(impulse);
      b.invInertiaWorld.multiplyVec3(angB, angB);
      b.angularVelocity.add(angB);
    }
  }
}
