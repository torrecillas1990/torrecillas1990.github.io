import { Vec3 } from '../math/Vec3';
import { RigidBody } from '../core/RigidBody';

export interface GJKSupportVertex {
  p: Vec3;   // Punto en diferencia de Minkowski (supA - supB)
  supA: Vec3; // Punto soporte en mundo sobre A
  supB: Vec3; // Punto soporte en mundo sobre B
}

export interface CollisionResult {
  collided: boolean;
  normal: Vec3;
  penetration: number;
  pointA: Vec3;
  pointB: Vec3;
}

const MAX_GJK_ITER = 32;
const MAX_EPA_ITER = 32;
const EPA_TOLERANCE = 1e-4;

function supportMinkowski(bodyA: RigidBody, bodyB: RigidBody, dir: Vec3): GJKSupportVertex {
  const supA = new Vec3();
  const supB = new Vec3();
  const negDir = Vec3._t3.copy(dir).negate();

  bodyA.getWorldSupport(dir, supA);
  bodyB.getWorldSupport(negDir, supB);

  return {
    p: supA.clone().sub(supB),
    supA,
    supB
  };
}

export function detectCollisionGJKEPA(bodyA: RigidBody, bodyB: RigidBody): CollisionResult | null {
  const simplex: GJKSupportVertex[] = [];
  const dir = new Vec3().copy(bodyB.position).sub(bodyA.position);
  if (dir.lengthSq() < 1e-8) dir.set(1, 0, 0);

  simplex.push(supportMinkowski(bodyA, bodyB, dir));
  dir.copy(simplex[0].p).negate();

  for (let iter = 0; iter < MAX_GJK_ITER; iter++) {
    if (dir.lengthSq() < 1e-10) {
      // El origen cae exactamente sobre un vértice o arista del símplex
      return runEPA(bodyA, bodyB, simplex);
    }

    const a = supportMinkowski(bodyA, bodyB, dir);
    if (a.p.dot(dir) < 0) {
      return null; // No hay intersección
    }

    simplex.push(a);

    if (handleSimplex(simplex, dir)) {
      return runEPA(bodyA, bodyB, simplex);
    }
  }

  return null;
}

function handleSimplex(simplex: GJKSupportVertex[], dir: Vec3): boolean {
  if (simplex.length === 2) {
    return lineCase(simplex, dir);
  } else if (simplex.length === 3) {
    return triangleCase(simplex, dir);
  } else if (simplex.length === 4) {
    return tetrahedronCase(simplex, dir);
  }
  return false;
}

function lineCase(simplex: GJKSupportVertex[], dir: Vec3): boolean {
  const b = simplex[0];
  const a = simplex[1];
  const ab = Vec3._t0.copy(b.p).sub(a.p);
  const ao = Vec3._t1.copy(a.p).negate();

  if (ab.dot(ao) > 0) {
    dir.copy(ab).cross(ao).cross(ab);
    if (dir.lengthSq() < 1e-10) {
      // Origen colineal al segmento AB: buscar perpendicular arbitraria
      dir.set(ab.y, -ab.x, 0);
      if (dir.lengthSq() < 1e-10) dir.set(0, ab.z, -ab.y);
    }
  } else {
    simplex.length = 0;
    simplex.push(a);
    dir.copy(ao);
  }
  return false;
}

function triangleCase(simplex: GJKSupportVertex[], dir: Vec3): boolean {
  const c = simplex[0];
  const b = simplex[1];
  const a = simplex[2];

  const ab = Vec3._t0.copy(b.p).sub(a.p);
  const ac = Vec3._t1.copy(c.p).sub(a.p);
  const ao = Vec3._t2.copy(a.p).negate();
  const abc = new Vec3().copy(ab).cross(ac);

  const abcCrossAc = Vec3._t3.copy(abc).cross(ac);
  if (abcCrossAc.dot(ao) > 0) {
    if (ac.dot(ao) > 0) {
      simplex.length = 0;
      simplex.push(c, a);
      dir.copy(ac).cross(ao).cross(ac);
    } else {
      simplex.length = 0;
      simplex.push(b, a);
      return lineCase(simplex, dir);
    }
  } else {
    const abCrossAbc = Vec3._t3.copy(ab).cross(abc);
    if (abCrossAbc.dot(ao) > 0) {
      simplex.length = 0;
      simplex.push(b, a);
      return lineCase(simplex, dir);
    } else {
      if (abc.dot(ao) > 0) {
        dir.copy(abc);
      } else {
        simplex[0] = b;
        simplex[1] = c;
        simplex[2] = a;
        dir.copy(abc).negate();
      }
    }
  }
  return false;
}

function tetrahedronCase(simplex: GJKSupportVertex[], dir: Vec3): boolean {
  const d = simplex[0];
  const c = simplex[1];
  const b = simplex[2];
  const a = simplex[3];

  const ab = new Vec3().copy(b.p).sub(a.p);
  const ac = new Vec3().copy(c.p).sub(a.p);
  const ad = new Vec3().copy(d.p).sub(a.p);
  const ao = new Vec3().copy(a.p).negate();

  const abc = new Vec3().copy(ab).cross(ac);
  const acd = new Vec3().copy(ac).cross(ad);
  const adb = new Vec3().copy(ad).cross(ab);

  if (abc.dot(ao) > 0) {
    simplex.length = 0;
    simplex.push(c, b, a);
    return triangleCase(simplex, dir);
  }
  if (acd.dot(ao) > 0) {
    simplex.length = 0;
    simplex.push(d, c, a);
    return triangleCase(simplex, dir);
  }
  if (adb.dot(ao) > 0) {
    simplex.length = 0;
    simplex.push(b, d, a);
    return triangleCase(simplex, dir);
  }

  return true; // El origen está dentro del tetraedro
}

// --- ALGORITMO EPA (Expanding Polytope Algorithm) ---

interface EPAFace {
  a: number;
  b: number;
  c: number;
  normal: Vec3;
  distance: number;
}

function makeEPAFace(verts: GJKSupportVertex[], a: number, b: number, c: number): EPAFace {
  const ab = Vec3._t0.copy(verts[b].p).sub(verts[a].p);
  const ac = Vec3._t1.copy(verts[c].p).sub(verts[a].p);
  const normal = new Vec3().copy(ab).cross(ac).normalize();
  let distance = normal.dot(verts[a].p);

  if (distance < 0) {
    normal.negate();
    distance = -distance;
    return { a, b: c, c: b, normal, distance };
  }
  return { a, b, c, normal, distance };
}

function runEPA(bodyA: RigidBody, bodyB: RigidBody, simplex: GJKSupportVertex[]): CollisionResult | null {
  const verts = [...simplex];

  // Asegurar que tenemos un tetraedro válido si GJK terminó antes de 4 vértices
  const dirs = [
    new Vec3(1, 0, 0), new Vec3(-1, 0, 0),
    new Vec3(0, 1, 0), new Vec3(0, -1, 0),
    new Vec3(0, 0, 1), new Vec3(0, 0, -1)
  ];
  let dirIdx = 0;
  while (verts.length < 4 && dirIdx < dirs.length) {
    const v = supportMinkowski(bodyA, bodyB, dirs[dirIdx++]);
    let duplicate = false;
    for (const existing of verts) {
      if (Vec3._t0.copy(existing.p).sub(v.p).lengthSq() < 1e-6) {
        duplicate = true;
        break;
      }
    }
    if (!duplicate) verts.push(v);
  }
  if (verts.length < 4) return null;

  let faces: EPAFace[] = [
    makeEPAFace(verts, 0, 1, 2),
    makeEPAFace(verts, 0, 2, 3),
    makeEPAFace(verts, 0, 3, 1),
    makeEPAFace(verts, 1, 3, 2)
  ];

  let closestFace = faces[0];

  for (let iter = 0; iter < MAX_EPA_ITER; iter++) {
    closestFace = faces[0];
    for (let i = 1; i < faces.length; i++) {
      if (faces[i].distance < closestFace.distance) {
        closestFace = faces[i];
      }
    }

    const sup = supportMinkowski(bodyA, bodyB, closestFace.normal);
    const sDist = closestFace.normal.dot(sup.p);

    if (sDist - closestFace.distance < EPA_TOLERANCE) {
      return computeContactPointsFromFace(verts, closestFace);
    }

    // Expandir politopo eliminando caras visibles desde el nuevo vértice
    const newVertIdx = verts.length;
    verts.push(sup);

    const looseEdges: [number, number][] = [];
    const remainingFaces: EPAFace[] = [];

    for (const face of faces) {
      const toSup = Vec3._t0.copy(sup.p).sub(verts[face.a].p);
      if (face.normal.dot(toSup) > 0) {
        addUniqueEdge(looseEdges, face.a, face.b);
        addUniqueEdge(looseEdges, face.b, face.c);
        addUniqueEdge(looseEdges, face.c, face.a);
      } else {
        remainingFaces.push(face);
      }
    }

    for (const [e0, e1] of looseEdges) {
      remainingFaces.push(makeEPAFace(verts, e0, e1, newVertIdx));
    }

    faces = remainingFaces;
    if (faces.length === 0) break;
  }

  return computeContactPointsFromFace(verts, closestFace);
}

function addUniqueEdge(edges: [number, number][], a: number, b: number): void {
  // Si existe la arista opuesta (b, a), es una arista interna entre dos caras eliminadas y se descarta
  for (let i = 0; i < edges.length; i++) {
    if (edges[i][0] === b && edges[i][1] === a) {
      edges.splice(i, 1);
      return;
    }
  }
  edges.push([a, b]);
}

function computeContactPointsFromFace(verts: GJKSupportVertex[], face: EPAFace): CollisionResult {
  // Proyectar el origen sobre el triángulo más cercano y calcular coordenadas baricéntricas
  const a = verts[face.a];
  const b = verts[face.b];
  const c = verts[face.c];

  const p = Vec3._t0.copy(face.normal).scale(face.distance);

  const v0 = new Vec3().copy(b.p).sub(a.p);
  const v1 = new Vec3().copy(c.p).sub(a.p);
  const v2 = new Vec3().copy(p).sub(a.p);

  const d00 = v0.dot(v0);
  const d01 = v0.dot(v1);
  const d11 = v1.dot(v1);
  const d20 = v2.dot(v0);
  const d21 = v2.dot(v1);

  const denom = d00 * d11 - d01 * d01;
  let v = 0, w = 0, u = 1;
  if (Math.abs(denom) > 1e-8) {
    v = (d11 * d20 - d01 * d21) / denom;
    w = (d00 * d21 - d01 * d20) / denom;
    u = 1 - v - w;
  }

  const pointA = new Vec3()
    .addScaled(a.supA, u)
    .addScaled(b.supA, v)
    .addScaled(c.supA, w);

  const pointB = new Vec3()
    .addScaled(a.supB, u)
    .addScaled(b.supB, v)
    .addScaled(c.supB, w);

  return {
    collided: true,
    normal: face.normal.clone(),
    penetration: face.distance,
    pointA,
    pointB
  };
}
