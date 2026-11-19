import { Shape, ShapeType } from './Shape';
import { Vec3 } from '../math/Vec3';
import { Mat3 } from '../math/Mat3';

export class SphereShape extends Shape {
  public readonly type = ShapeType.SPHERE;
  public radius: number;

  constructor(radius = 0.5) {
    super();
    this.radius = radius;
  }

  public getLocalSupport(dir: Vec3, out: Vec3): Vec3 {
    const len = dir.length();
    if (len > 1e-8) {
      return out.copy(dir).scale(this.radius / len);
    }
    return out.set(0, 0, 0);
  }

  public computeInertiaTensor(mass: number, out: Mat3): Mat3 {
    const i = 0.4 * mass * this.radius * this.radius;
    return out.setDiagonal(i, i, i);
  }
}

export class BoxShape extends Shape {
  public readonly type = ShapeType.BOX;
  public halfExtents: Vec3;

  constructor(halfExtents = new Vec3(0.5, 0.5, 0.5)) {
    super();
    this.halfExtents = halfExtents;
  }

  public getLocalSupport(dir: Vec3, out: Vec3): Vec3 {
    return out.set(
      dir.x >= 0 ? this.halfExtents.x : -this.halfExtents.x,
      dir.y >= 0 ? this.halfExtents.y : -this.halfExtents.y,
      dir.z >= 0 ? this.halfExtents.z : -this.halfExtents.z
    );
  }

  public computeInertiaTensor(mass: number, out: Mat3): Mat3 {
    const lx = this.halfExtents.x * 2;
    const ly = this.halfExtents.y * 2;
    const lz = this.halfExtents.z * 2;
    const c = mass / 12;
    return out.setDiagonal(
      c * (ly * ly + lz * lz),
      c * (lx * lx + lz * lz),
      c * (lx * lx + ly * ly)
    );
  }
}

export class CapsuleShape extends Shape {
  public readonly type = ShapeType.CAPSULE;
  public radius: number;
  public halfHeight: number; // Mitad de la altura del cilindro central (eje Y)

  constructor(radius = 0.5, halfHeight = 0.5) {
    super();
    this.radius = radius;
    this.halfHeight = halfHeight;
  }

  public getLocalSupport(dir: Vec3, out: Vec3): Vec3 {
    const len = dir.length();
    if (len > 1e-8) {
      out.copy(dir).scale(this.radius / len);
    } else {
      out.set(0, 0, 0);
    }
    out.y += dir.y >= 0 ? this.halfHeight : -this.halfHeight;
    return out;
  }

  public computeInertiaTensor(mass: number, out: Mat3): Mat3 {
    const r = this.radius;
    const h = this.halfHeight * 2;
    const r2 = r * r;
    const h2 = h * h;
    // Aproximación estándar cilindro + hemisferios
    const cMass = mass * (h / (h + (4 / 3) * r));
    const sMass = mass - cMass;

    const iy = 0.5 * cMass * r2 + 0.4 * sMass * r2;
    const ixz = cMass * (0.25 * r2 + (1 / 12) * h2) + sMass * (0.4 * r2 + 0.25 * h2 + 0.375 * h * r);
    return out.setDiagonal(ixz, iy, ixz);
  }
}

export class ConvexHullShape extends Shape {
  public readonly type = ShapeType.CONVEX_HULL;
  public vertices: Vec3[];

  constructor(vertices: Vec3[]) {
    super();
    this.vertices = vertices;
  }

  public getLocalSupport(dir: Vec3, out: Vec3): Vec3 {
    let maxDot = -Infinity;
    let bestIdx = 0;
    for (let i = 0; i < this.vertices.length; i++) {
      const d = this.vertices[i].dot(dir);
      if (d > maxDot) {
        maxDot = d;
        bestIdx = i;
      }
    }
    return out.copy(this.vertices[bestIdx]);
  }

  public computeInertiaTensor(mass: number, out: Mat3): Mat3 {
    // Tensor aproximado basado en AABB local de los vértices
    const min = new Vec3(Infinity, Infinity, Infinity);
    const max = new Vec3(-Infinity, -Infinity, -Infinity);
    for (const v of this.vertices) {
      if (v.x < min.x) min.x = v.x;
      if (v.y < min.y) min.y = v.y;
      if (v.z < min.z) min.z = v.z;
      if (v.x > max.x) max.x = v.x;
      if (v.y > max.y) max.y = v.y;
      if (v.z > max.z) max.z = v.z;
    }
    const lx = max.x - min.x;
    const ly = max.y - min.y;
    const lz = max.z - min.z;
    const c = mass / 12;
    return out.setDiagonal(c * (ly * ly + lz * lz), c * (lx * lx + lz * lz), c * (lx * lx + ly * ly));
  }
}
