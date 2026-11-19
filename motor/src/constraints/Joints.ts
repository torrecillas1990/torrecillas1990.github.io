import { Vec3 } from '../math/Vec3';
import { Mat3 } from '../math/Mat3';
import { RigidBody, BodyType } from '../core/RigidBody';
import { ConstraintSolver } from '../solver/SequentialImpulseSolver';

function applyJointImpulse(a: RigidBody, b: RigidBody, rA: Vec3, rB: Vec3, impulse: Vec3): void {
  if (a.type === BodyType.DYNAMIC) {
    a.wakeUp();
    a.linearVelocity.addScaled(impulse, -a.invMass);
    const angA = new Vec3().copy(rA).cross(impulse).negate();
    a.invInertiaWorld.multiplyVec3(angA, angA);
    a.angularVelocity.add(angA);
  }
  if (b.type === BodyType.DYNAMIC) {
    b.wakeUp();
    b.linearVelocity.addScaled(impulse, b.invMass);
    const angB = new Vec3().copy(rB).cross(impulse);
    b.invInertiaWorld.multiplyVec3(angB, angB);
    b.angularVelocity.add(angB);
  }
}

function computeScalarEffMass(a: RigidBody, b: RigidBody, rA: Vec3, rB: Vec3, dir: Vec3): number {
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

/**
 * 1. DISTANCE JOINT (Mantiene distancia fija o actúa como resorte/amortiguador)
 */
export class DistanceJoint implements ConstraintSolver {
  public bodyA: RigidBody;
  public bodyB: RigidBody;
  public localAnchorA: Vec3;
  public localAnchorB: Vec3;
  public distance: number;
  public stiffness: number; // 1.0 = rígido, < 1.0 = elástico

  private rA = new Vec3();
  private rB = new Vec3();
  private normal = new Vec3();
  private effMass = 0;
  private bias = 0;
  private accumulatedImpulse = 0;

  constructor(bodyA: RigidBody, bodyB: RigidBody, worldAnchorA: Vec3, worldAnchorB: Vec3, stiffness = 1.0) {
    this.bodyA = bodyA;
    this.bodyB = bodyB;
    this.stiffness = Math.max(0.01, Math.min(1.0, stiffness));

    this.localAnchorA = worldAnchorA.clone().sub(bodyA.position);
    bodyA.rotation.rotateVec3Inverse(this.localAnchorA);

    this.localAnchorB = worldAnchorB.clone().sub(bodyB.position);
    bodyB.rotation.rotateVec3Inverse(this.localAnchorB);

    this.distance = worldAnchorB.clone().sub(worldAnchorA).length();
  }

  public preStep(dt: number): void {
    this.rA.copy(this.localAnchorA);
    this.bodyA.rotation.rotateVec3(this.rA);

    this.rB.copy(this.localAnchorB);
    this.bodyB.rotation.rotateVec3(this.rB);

    const wA = Vec3._t0.copy(this.bodyA.position).add(this.rA);
    const wB = Vec3._t1.copy(this.bodyB.position).add(this.rB);

    this.normal.copy(wB).sub(wA);
    const currentLen = this.normal.length();
    if (currentLen > 1e-6) {
      this.normal.scale(1 / currentLen);
    } else {
      this.normal.set(0, 1, 0);
    }

    this.effMass = computeScalarEffMass(this.bodyA, this.bodyB, this.rA, this.rB, this.normal);
    const error = currentLen - this.distance;
    this.bias = (0.2 * this.stiffness / dt) * error;
  }

  public warmStart(): void {
    const imp = Vec3._t0.copy(this.normal).scale(this.accumulatedImpulse);
    applyJointImpulse(this.bodyA, this.bodyB, this.rA, this.rB, imp);
  }

  public solveVelocity(): void {
    if (this.effMass <= 0) return;
    const vA = new Vec3().copy(this.bodyA.angularVelocity).cross(this.rA).add(this.bodyA.linearVelocity);
    const vB = new Vec3().copy(this.bodyB.angularVelocity).cross(this.rB).add(this.bodyB.linearVelocity);
    const relVel = vB.sub(vA).dot(this.normal);

    const j = -(relVel + this.bias) * this.effMass;
    this.accumulatedImpulse += j;

    const imp = Vec3._t0.copy(this.normal).scale(j);
    applyJointImpulse(this.bodyA, this.bodyB, this.rA, this.rB, imp);
  }

  public solvePosition(): void {
    const rA = new Vec3().copy(this.localAnchorA);
    this.bodyA.rotation.rotateVec3(rA);
    const rB = new Vec3().copy(this.localAnchorB);
    this.bodyB.rotation.rotateVec3(rB);

    const diff = new Vec3().copy(this.bodyB.position).add(rB).sub(this.bodyA.position).sub(rA);
    const len = diff.length();
    if (len < 1e-6) return;

    const error = len - this.distance;
    if (Math.abs(error) < 0.002) return;

    const n = diff.scale(1 / len);
    const effMass = computeScalarEffMass(this.bodyA, this.bodyB, rA, rB, n);
    const corr = 0.2 * this.stiffness * error * effMass;
    const push = n.scale(corr);

    if (this.bodyA.type === BodyType.DYNAMIC) {
      this.bodyA.position.addScaled(push, -this.bodyA.invMass);
      const angA = new Vec3().copy(rA).cross(push).negate();
      this.bodyA.invInertiaWorld.multiplyVec3(angA, angA);
      this.bodyA.rotation.integrateAngularVelocity(angA, 1.0);
    }
    if (this.bodyB.type === BodyType.DYNAMIC) {
      this.bodyB.position.addScaled(push, this.bodyB.invMass);
      const angB = new Vec3().copy(rB).cross(push);
      this.bodyB.invInertiaWorld.multiplyVec3(angB, angB);
      this.bodyB.rotation.integrateAngularVelocity(angB, 1.0);
    }
  }
}

/**
 * 2. BALL-SOCKET JOINT (Rótula esférica en 3 ejes)
 */
export class BallSocketJoint implements ConstraintSolver {
  public bodyA: RigidBody;
  public bodyB: RigidBody;
  public localAnchorA: Vec3;
  public localAnchorB: Vec3;

  private rA = new Vec3();
  private rB = new Vec3();
  private bias = new Vec3();
  private accumulatedImpulse = new Vec3();
  private effMass = new Mat3();

  constructor(bodyA: RigidBody, bodyB: RigidBody, worldAnchor: Vec3) {
    this.bodyA = bodyA;
    this.bodyB = bodyB;

    this.localAnchorA = worldAnchor.clone().sub(bodyA.position);
    bodyA.rotation.rotateVec3Inverse(this.localAnchorA);

    this.localAnchorB = worldAnchor.clone().sub(bodyB.position);
    bodyB.rotation.rotateVec3Inverse(this.localAnchorB);
  }

  public preStep(dt: number): void {
    this.rA.copy(this.localAnchorA);
    this.bodyA.rotation.rotateVec3(this.rA);

    this.rB.copy(this.localAnchorB);
    this.bodyB.rotation.rotateVec3(this.rB);

    // Matriz de masa efectiva 3x3
    const invM = this.bodyA.invMass + this.bodyB.invMass;
    const k = this.effMass;
    k.setDiagonal(invM, invM, invM);

    this.addSkewInertia(k, this.rA, this.bodyA);
    this.addSkewInertia(k, this.rB, this.bodyB);
    k.invert();

    const wA = Vec3._t0.copy(this.bodyA.position).add(this.rA);
    const wB = Vec3._t1.copy(this.bodyB.position).add(this.rB);
    this.bias.copy(wB).sub(wA).scale(0.2 / dt);
  }

  private addSkewInertia(k: Mat3, r: Vec3, b: RigidBody): void {
    if (b.type !== BodyType.DYNAMIC) return;
    const I = b.invInertiaWorld.elements;
    const rx = r.x, ry = r.y, rz = r.z;

    // Aporte diagonal y cruzado de -[r]_x * I^-1 * [r]_x
    const e = k.elements;
    e += I * rz * rz - 2 * I * ry * rz + I * ry * ry;
    e += I * rz * rz - 2 * I * rx * rz + I * rx * rx;
    e += I * ry * ry - 2 * I * rx * ry + I * rx * rx;

    const k01 = -I * rz * rz + I * rx * rz + I * ry * rz - I * rx * ry;
    const k02 = I * ry * rz - I * rx * ry - I * ry * ry + I * rx * rz;
    const k12 = -I * rx * rz + I * rx * rx + I * ry * rz - I * rx * ry;

    e += k01; e += k01;
    e += k02; e += k02;
    e += k12; e += k12;
  }

  public warmStart(): void {
    applyJointImpulse(this.bodyA, this.bodyB, this.rA, this.rB, this.accumulatedImpulse);
  }

  public solveVelocity(): void {
    const vA = new Vec3().copy(this.bodyA.angularVelocity).cross(this.rA).add(this.bodyA.linearVelocity);
    const vB = new Vec3().copy(this.bodyB.angularVelocity).cross(this.rB).add(this.bodyB.linearVelocity);
    const relVel = new Vec3().copy(vB).sub(vA).add(this.bias).negate();

    const j = new Vec3();
    this.effMass.multiplyVec3(relVel, j);
    this.accumulatedImpulse.add(j);

    applyJointImpulse(this.bodyA, this.bodyB, this.rA, this.rB, j);
  }

  public solvePosition(): void {
    const rA = new Vec3().copy(this.localAnchorA);
    this.bodyA.rotation.rotateVec3(rA);
    const rB = new Vec3().copy(this.localAnchorB);
    this.bodyB.rotation.rotateVec3(rB);

    const err = new Vec3().copy(this.bodyB.position).add(rB).sub(this.bodyA.position).sub(rA);
    if (err.lengthSq() < 1e-6) return;

    const push = new Vec3();
    this.effMass.multiplyVec3(err.scale(0.2), push);

    if (this.bodyA.type === BodyType.DYNAMIC) {
      this.bodyA.position.addScaled(push, -this.bodyA.invMass);
      const angA = new Vec3().copy(rA).cross(push).negate();
      this.bodyA.invInertiaWorld.multiplyVec3(angA, angA);
      this.bodyA.rotation.integrateAngularVelocity(angA, 1.0);
    }
    if (this.bodyB.type === BodyType.DYNAMIC) {
      this.bodyB.position.addScaled(push, this.bodyB.invMass);
      const angB = new Vec3().copy(rB).cross(push);
      this.bodyB.invInertiaWorld.multiplyVec3(angB, angB);
      this.bodyB.rotation.integrateAngularVelocity(angB, 1.0);
    }
  }
}

/**
 * 3. HINGE JOINT (Bisagra: BallSocket + restricción angular en 2 ejes ortogonales al eje de giro)
 */
export class HingeJoint implements ConstraintSolver {
  private ballSocket: BallSocketJoint;
  public bodyA: RigidBody;
  public bodyB: RigidBody;
  public localAxisA: Vec3;
  public localAxisB: Vec3;

  private t1 = new Vec3();
  private t2 = new Vec3();
  private effMass1 = 0;
  private effMass2 = 0;
  private bias1 = 0;
  private bias2 = 0;

  constructor(bodyA: RigidBody, bodyB: RigidBody, worldAnchor: Vec3, worldAxis: Vec3) {
    this.bodyA = bodyA;
    this.bodyB = bodyB;
    this.ballSocket = new BallSocketJoint(bodyA, bodyB, worldAnchor);

    const axis = worldAxis.clone().normalize();
    this.localAxisA = axis.clone();
    bodyA.rotation.rotateVec3Inverse(this.localAxisA);

    this.localAxisB = axis.clone();
    bodyB.rotation.rotateVec3Inverse(this.localAxisB);
  }

  public preStep(dt: number): void {
    this.ballSocket.preStep(dt);

    const a1 = new Vec3().copy(this.localAxisA);
	this.bodyA.rotation.rotateVec3(a1);
	const a2 = new Vec3().copy(this.localAxisB);
	this.bodyB.rotation.rotateVec3(a2);
	// Base ortogonal al eje de bisagra de A
	if (Math.abs(a1.x) >= 0.57735) {
	this.t1.set(a1.y, -a1.x, 0).normalize();
	} else {
	this.t1.set(0, a1.z, -a1.y).normalize();
	}
	this.t2.copy(a1).cross(this.t1);
	this.effMass1 = this.computeAngularEffMass(this.t1);
	this.effMass2 = this.computeAngularEffMass(this.t2);
	// Error angular de alineación de ejes
	const errAxis = new Vec3().copy(a1).cross(a2);
	this.bias1 = (0.2 / dt) * errAxis.dot(this.t1);
	this.bias2 = (0.2 / dt) * errAxis.dot(this.t2);
	}
	
	private computeAngularEffMass(axis: Vec3): number {
	let k = 0;
	if (this.bodyA.type === BodyType.DYNAMIC) {
	const ia = new Vec3();
	this.bodyA.invInertiaWorld.multiplyVec3(axis, ia);
	k += ia.dot(axis);
	}
	if (this.bodyB.type === BodyType.DYNAMIC) {
	const ib = new Vec3();
	this.bodyB.invInertiaWorld.multiplyVec3(axis, ib);
	k += ib.dot(axis);
	}
	return k > 1e-8 ? 1 / k : 0;
	}
	
	public warmStart(): void {
	this.ballSocket.warmStart();
	}
	
	public solveVelocity(): void {
	this.ballSocket.solveVelocity();
	const relOmega = new Vec3().copy(this.bodyB.angularVelocity).sub(this.bodyA.angularVelocity);
	if (this.effMass1 > 0) {
	const j1 = -(relOmega.dot(this.t1) + this.bias1) * this.effMass1;
	this.applyAngularImpulse(this.t1, j1);
	}
	if (this.effMass2 > 0) {
	const j2 = -(relOmega.dot(this.t2) + this.bias2) * this.effMass2;
	this.applyAngularImpulse(this.t2, j2);
	}
	}
	
	private applyAngularImpulse(axis: Vec3, mag: number): void {
	const imp = Vec3._t0.copy(axis).scale(mag);
	if (this.bodyA.type === BodyType.DYNAMIC) {
	const dA = new Vec3();
	this.bodyA.invInertiaWorld.multiplyVec3(imp, dA);
	this.bodyA.angularVelocity.sub(dA);
	}
	if (this.bodyB.type === BodyType.DYNAMIC) {
	const dB = new Vec3();
	this.bodyB.invInertiaWorld.multiplyVec3(imp, dB);
	this.bodyB.angularVelocity.add(dB);
	}
	}
	
	public solvePosition(): void {
	this.ballSocket.solvePosition();
	}
	
	}
