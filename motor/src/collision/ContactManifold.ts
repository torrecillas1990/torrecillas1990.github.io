import { Vec3 } from '../math/Vec3';
import { RigidBody } from '../core/RigidBody';

export class ContactPoint {
  public worldA = new Vec3();      // Punto de contacto en espacio global sobre A
  public worldB = new Vec3();      // Punto de contacto en espacio global sobre B
  public localA = new Vec3();      // Punto en espacio local de A (para persistencia)
  public localB = new Vec3();      // Punto en espacio local de B (para persistencia)
  public penetration = 0;          // Profundidad de penetración (> 0)

  // Caché de impulsos para Warm Starting (usado por el Solver en Entrega 3)
  public normalImpulse = 0;
  public tangentImpulse1 = 0;
  public tangentImpulse2 = 0;
}

export class ContactManifold {
  public bodyA: RigidBody;
  public bodyB: RigidBody;
  public normal = new Vec3();      // Normal apunta siempre de A hacia B
  public points: ContactPoint[] = [];
  public friction = 0;
  public restitution = 0;

  constructor(bodyA: RigidBody, bodyB: RigidBody) {
    this.bodyA = bodyA;
    this.bodyB = bodyB;
    this.friction = Math.sqrt(bodyA.friction * bodyB.friction);
    this.restitution = Math.max(bodyA.restitution, bodyB.restitution);
  }

  public addPoint(worldA: Vec3, worldB: Vec3, penetration: number): void {
    const localA = worldA.clone().sub(this.bodyA.position);
    this.bodyA.rotation.rotateVec3Inverse(localA);

    const localB = worldB.clone().sub(this.bodyB.position);
    this.bodyB.rotation.rotateVec3Inverse(localB);

    // Verificar si ya existe un punto muy cercano (umbral 2 cm) para conservar Warm Starting
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      const distSqA = Vec3._t0.copy(p.localA).sub(localA).lengthSq();
      const distSqB = Vec3._t1.copy(p.localB).sub(localB).lengthSq();
      if (distSqA < 0.0004 || distSqB < 0.0004) {
        p.worldA.copy(worldA);
        p.worldB.copy(worldB);
        p.localA.copy(localA);
        p.localB.copy(localB);
        p.penetration = penetration;
        return;
      }
    }

    const cp = new ContactPoint();
    cp.worldA.copy(worldA);
    cp.worldB.copy(worldB);
    cp.localA.copy(localA);
    cp.localB.copy(localB);
    cp.penetration = penetration;

    if (this.points.length < 4) {
      this.points.push(cp);
    } else {
      // Si ya hay 4 puntos, reemplazar el que maximice el área del cuadrilátero de soporte
      this.replaceBestPoint(cp);
    }
  }

  private replaceBestPoint(newPt: ContactPoint): void {
    let maxPenIdx = 0;
    let maxPen = this.points[0].penetration;
    for (let i = 1; i < 4; i++) {
      if (this.points[i].penetration > maxPen) {
        maxPen = this.points[i].penetration;
        maxPenIdx = i;
      }
    }

    // Reemplazar el punto con menor penetración que no sea el más profundo
    let replaceIdx = maxPenIdx === 0 ? 1 : 0;
    let minPen = this.points[replaceIdx].penetration;
    for (let i = 0; i < 4; i++) {
      if (i !== maxPenIdx && this.points[i].penetration < minPen) {
        minPen = this.points[i].penetration;
        replaceIdx = i;
      }
    }
    this.points[replaceIdx] = newPt;
  }

  public refresh(): void {
    // Actualizar posiciones globales y descartar contactos que se hayan separado
    for (let i = this.points.length - 1; i >= 0; i--) {
      const p = this.points[i];
      p.worldA.copy(p.localA);
      this.bodyA.rotation.rotateVec3(p.worldA).add(this.bodyA.position);

      p.worldB.copy(p.localB);
      this.bodyB.rotation.rotateVec3(p.worldB).add(this.bodyB.position);

      const diff = Vec3._t0.copy(p.worldA).sub(p.worldB);
      const pen = diff.dot(this.normal);

      // Si se separaron más de 2 cm o derivaron lateralmente más de 2 cm, eliminar punto
      const ortho = Vec3._t1.copy(diff).addScaled(this.normal, -pen);
      if (pen < -0.02 || ortho.lengthSq() > 0.0004) {
        this.points.splice(i, 1);
      } else {
        p.penetration = pen;
      }
    }
  }
}
