import { Vec3 } from '../math/Vec3';
import { Quat } from '../math/Quat';
import { Mat3 } from '../math/Mat3';
import { AABB } from '../math/AABB';
import { Shape } from '../shapes/Shape';

export enum BodyType {
  DYNAMIC,
  STATIC,
  KINEMATIC
}

export interface RigidBodyOptions {
  type?: BodyType;
  mass?: number;
  position?: Vec3;
  rotation?: Quat;
  shape: Shape;
  restitution?: number;
  friction?: number;
  linearDamping?: number;
  angularDamping?: number;
}

export class RigidBody {
  private static nextId = 1;
  public readonly id: number;
  public type: BodyType;
  public shape: Shape;

  // Estado lineal
  public position = new Vec3();
  public linearVelocity = new Vec3();
  public force = new Vec3();
  public mass = 1;
  public invMass = 1;

  // Estado angular
  public rotation = new Quat();
  public angularVelocity = new Vec3();
  public torque = new Vec3();
  public invInertiaLocal = new Mat3();
  public invInertiaWorld = new Mat3();

  // Material y amortiguación
  public restitution = 0.2;
  public friction = 0.5;
  public linearDamping = 0.01;
  public angularDamping = 0.02;

  // Colisión y Reposo (Sleeping)
  public aabb = new AABB();
  public isSleeping = false;
  public sleepTimer = 0;

  constructor(opts: RigidBodyOptions) {
    this.id = RigidBody.nextId++;
    this.type = opts.type ?? BodyType.DYNAMIC;
    this.shape = opts.shape;
    if (opts.position) this.position.copy(opts.position);
    if (opts.rotation) this.rotation.copy(opts.rotation).normalize();
    if (opts.restitution !== undefined) this.restitution = opts.restitution;
    if (opts.friction !== undefined) this.friction = opts.friction;
    if (opts.linearDamping !== undefined) this.linearDamping = opts.linearDamping;
    if (opts.angularDamping !== undefined) this.angularDamping = opts.angularDamping;

    this.setMass(opts.mass ?? (this.type === BodyType.DYNAMIC ? 1 : 0));
    this.updateDerivedData();
  }

  public setMass(mass: number): void {
    if (this.type !== BodyType.DYNAMIC || mass <= 0) {
      this.mass = 0;
      this.invMass = 0;
      this.invInertiaLocal.setZero();
      this.invInertiaWorld.setZero();
    } else {
      this.mass = mass;
      this.invMass = 1 / mass;
      this.shape.computeInertiaTensor(mass, this.invInertiaLocal).invert();
    }
  }

  public applyForce(force: Vec3, worldPoint?: Vec3): void {
    if (this.type !== BodyType.DYNAMIC) return;
    this.wakeUp();
    this.force.add(force);
    if (worldPoint) {
      const r = Vec3._t0.copy(worldPoint).sub(this.position);
      const t = Vec3._t1.copy(r).cross(force);
      this.torque.add(t);
    }
  }

  public applyImpulse(impulse: Vec3, relPos?: Vec3): void {
    if (this.type !== BodyType.DYNAMIC) return;
    this.wakeUp();
    this.linearVelocity.addScaled(impulse, this.invMass);
    if (relPos) {
      const angImp = Vec3._t0.copy(relPos).cross(impulse);
      this.invInertiaWorld.multiplyVec3(angImp, Vec3._t1);
      this.angularVelocity.add(Vec3._t1);
    }
  }

  public wakeUp(): void {
    this.isSleeping = false;
    this.sleepTimer = 0;
  }

  public updateDerivedData(): void {
    // Recalcular Tensor de Inercia Global: I_world^-1 = R * I_local^-1 * R^T
    if (this.type === BodyType.DYNAMIC) {
      const R = Mat3._t0;
      const RT = Mat3._t1;
      this.rotation.toMat3(R);
      R.transpose(RT);
      this.invInertiaWorld.multiplyMatrices(R, this.invInertiaLocal).multiplyMatrices(this.invInertiaWorld, RT);
    }
    this.shape.computeWorldAABB(this.position, this.rotation, this.aabb);
  }

  public getWorldSupport(dir: Vec3, out: Vec3): Vec3 {
    const localDir = Vec3._t2.copy(dir);
    this.rotation.rotateVec3Inverse(localDir);
    this.shape.getLocalSupport(localDir, out);
    this.rotation.rotateVec3(out);
    return out.add(this.position);
  }
}
