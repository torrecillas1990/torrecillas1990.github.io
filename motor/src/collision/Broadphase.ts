import { RigidBody, BodyType } from '../core/RigidBody';

export interface CollisionPair {
  bodyA: RigidBody;
  bodyB: RigidBody;
}

export class SweepAndPrune {
  private pairs: CollisionPair[] = [];

  public computePairs(bodies: RigidBody[]): CollisionPair[] {
    this.pairs.length = 0;
    const count = bodies.length;
    if (count < 2) return this.pairs;

    // Insertion Sort (casi O(n) cuando los objetos tienen coherencia temporal entre frames)
    for (let i = 1; i < count; i++) {
      const current = bodies[i];
      const currentMinX = current.aabb.min.x;
      let j = i - 1;
      while (j >= 0 && bodies[j].aabb.min.x > currentMinX) {
        bodies[j + 1] = bodies[j];
        j--;
      }
      bodies[j + 1] = current;
    }

    // Barrido de solapamientos
    for (let i = 0; i < count; i++) {
      const a = bodies[i];
      const maxX = a.aabb.max.x;

      for (let j = i + 1; j < count; j++) {
        const b = bodies[j];
        if (b.aabb.min.x > maxX) break; // Ningún cuerpo posterior puede solaparse en X

        // Ignorar pares donde ambos sean estáticos/cinemáticos o ambos estén dormidos
        const aInactive = a.type !== BodyType.DYNAMIC || a.isSleeping;
        const bInactive = b.type !== BodyType.DYNAMIC || b.isSleeping;
        if (aInactive && bInactive) continue;

        if (a.aabb.overlaps(b.aabb)) {
          // Mantener orden determinista por ID para la caché del ContactManifold
          if (a.id < b.id) {
            this.pairs.push({ bodyA: a, bodyB: b });
          } else {
            this.pairs.push({ bodyA: b, bodyB: a });
          }
        }
      }
    }

    return this.pairs;
  }
}
