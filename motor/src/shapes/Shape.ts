import { Vec3 } from '../math/Vec3';
import { Mat3 } from '../math/Mat3';
import { Quat } from '../math/Quat';
import { AABB } from '../math/AABB';

export enum ShapeType {
  SPHERE,
  BOX,
  CAPSULE,
  CONVEX_HULL
}

export abstract class Shape {
  public abstract readonly type: ShapeType;
  public margin = 0.01; // Margen de colisión para estabilidad GJK/EPA

  /** Punto más lejano de la forma en espacio LOCAL en la dirección dada */
  public abstract getLocalSupport(dir: Vec3, out: Vec3): Vec3;

  /** Tensor de inercia local */
  public abstract computeInertiaTensor(mass: number, out: Mat3): Mat3;

  /** Calcula el AABB en espacio global */
  public computeWorldAABB(pos: Vec3, rot: Quat, out: AABB): AABB {
    const dir = Vec3._t0;
    const sup = Vec3._t1;

    // Eje X
    dir.set(1, 0, 0); rot.rotateVec3Inverse(dir);
    this.getLocalSupport(dir, sup); rot.rotateVec3(sup);
    out.max.x = pos.x + sup.x;

    dir.set(-1, 0, 0); rot.rotateVec3Inverse(dir);
    this.getLocalSupport(dir, sup); rot.rotateVec3(sup);
    out.min.x = pos.x + sup.x;

    // Eje Y
    dir.set(0, 1, 0); rot.rotateVec3Inverse(dir);
    this.getLocalSupport(dir, sup); rot.rotateVec3(sup);
    out.max.y = pos.y + sup.y;

    dir.set(0, -1, 0); rot.rotateVec3Inverse(dir);
    this.getLocalSupport(dir, sup); rot.rotateVec3(sup);
    out.min.y = pos.y + sup.y;

    // Eje Z
    dir.set(0, 0, 1); rot.rotateVec3Inverse(dir);
    this.getLocalSupport(dir, sup); rot.rotateVec3(sup);
    out.max.z = pos.z + sup.z;

    dir.set(0, 0, -1); rot.rotateVec3Inverse(dir);
    this.getLocalSupport(dir, sup); rot.rotateVec3(sup);
    out.min.z = pos.z + sup.z;

    return out.expand(this.margin);
  }
}
