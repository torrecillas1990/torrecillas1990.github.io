import { Vec3 } from '../math/Vec3';
import { AABB } from '../math/AABB';
import { RigidBody } from '../core/RigidBody';

export interface RaycastHit {
  body: RigidBody;
  point: Vec3;
  normal: Vec3;
  distance: number;
}

export function intersectRayAABB(origin: Vec3, dir: Vec3, aabb: AABB, maxDist: number): number | null {
  let tmin = 0;
  let tmax = maxDist;

  const axes: ('x' | 'y' | 'z')[] = ['x', 'y', 'z'];
  for (const axis of axes) {
    const o = origin[axis];
    const d = dir[axis];
    const min = aabb.min[axis];
    const max = aabb.max[axis];

    if (Math.abs(d) < 1e-8) {
      if (o < min || o > max) return null;
    } else {
      const invD = 1 / d;
      let t1 = (min - o) * invD;
      let t2 = (max - o) * invD;
      if (t1 > t2) {
        const tmp = t1; t1 = t2; t2 = tmp;
      }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

/**
 * Raycast preciso contra formas convexas arbitrarias mediante iteración de soporte (GJK Raycast)
 */
export function raycastBody(origin: Vec3, dir: Vec3, body: RigidBody, maxDist = 1000): RaycastHit | null {
  const aabbHit = intersectRayAABB(origin, dir, body.aabb, maxDist);
  if (aabbHit === null) return null;

  let lambda = 0;
  const x = origin.clone();
  const n = new Vec3();
  const v = new Vec3().copy(x).sub(body.position);

  const maxIter = 32;
  const eps = 1e-4;

  for (let i = 0; i < maxIter; i++) {
    if (v.lengthSq() < eps * eps) {
      // Impacto encontrado
      return {
        body,
        point: x,
        normal: n.lengthSq() > 0 ? n.normalize() : dir.clone().negate(),
        distance: lambda
      };
    }

    const p = new Vec3();
    body.getWorldSupport(v, p);
    const w = new Vec3().copy(x).sub(p);

    const vDotW = v.dot(w);
    if (vDotW > 0) {
      const vDotR = v.dot(dir);
      if (vDotR >= -1e-8) return null; // El rayo se aleja del plano separador
      lambda -= vDotW / vDotR;
      if (lambda > maxDist) return null;

      x.copy(origin).addScaled(dir, lambda);
      n.copy(v);
    }

    // Actualizar vector v al punto más cercano al origen sobre el segmento [p - x]
    const px = new Vec3().copy(p).sub(x);
    v.copy(px).negate();
  }

  return null;
}
