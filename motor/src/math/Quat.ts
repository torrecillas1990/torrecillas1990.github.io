import { Vec3 } from './Vec3';
import { Mat3 } from './Mat3';

export class Quat {
  public x: number;
  public y: number;
  public z: number;
  public w: number;

  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  public set(x: number, y: number, z: number, w: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  public copy(q: Quat): this {
    this.x = q.x;
    this.y = q.y;
    this.z = q.z;
    this.w = q.w;
    return this;
  }

  public normalize(): this {
    const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
    if (len > 1e-8) {
      const inv = 1 / len;
      this.x *= inv;
      this.y *= inv;
      this.z *= inv;
      this.w *= inv;
    } else {
      this.set(0, 0, 0, 1);
    }
    return this;
  }

  public conjugate(): this {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }

  public multiply(q: Quat): this {
    const ax = this.x, ay = this.y, az = this.z, aw = this.w;
    const bx = q.x, by = q.y, bz = q.z, bw = q.w;
    this.x = aw * bx + ax * bw + ay * bz - az * by;
    this.y = aw * by - ax * bz + ay * bw + az * bx;
    this.z = aw * bz + ax * by - ay * bx + az * bw;
    this.w = aw * bw - ax * bx - ay * by - az * bz;
    return this;
  }

  public rotateVec3(v: Vec3): Vec3 {
    const qx = this.x, qy = this.y, qz = this.z, qw = this.w;
    const vx = v.x, vy = v.y, vz = v.z;

    const ix = qw * vx + qy * vz - qz * vy;
    const iy = qw * vy + qz * vx - qx * vz;
    const iz = qw * vz + qx * vy - qy * vx;
    const iw = -qx * vx - qy * vy - qz * vz;

    v.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    v.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    v.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return v;
  }

  public rotateVec3Inverse(v: Vec3): Vec3 {
    const qx = -this.x, qy = -this.y, qz = -this.z, qw = this.w;
    const vx = v.x, vy = v.y, vz = v.z;

    const ix = qw * vx + qy * vz - qz * vy;
    const iy = qw * vy + qz * vx - qx * vz;
    const iz = qw * vz + qx * vy - qy * vx;
    const iw = -qx * vx - qy * vy - qz * vz;

    v.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    v.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    v.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return v;
  }

  public toMat3(out: Mat3): Mat3 {
    const x2 = this.x + this.x, y2 = this.y + this.y, z2 = this.z + this.z;
    const xx = this.x * x2, xy = this.x * y2, xz = this.x * z2;
    const yy = this.y * y2, yz = this.y * z2, zz = this.z * z2;
    const wx = this.w * x2, wy = this.w * y2, wz = this.w * z2;

    const e = out.elements;
    e[0] = 1 - (yy + zz); e[1] = xy - wz;       e[2] = xz + wy;
    e[3] = xy + wz;       e[4] = 1 - (xx + zz); e[5] = yz - wx;
    e[6] = xz - wy;       e[7] = yz + wx;       e[8] = 1 - (xx + yy);
    return out;
  }

  public integrateAngularVelocity(omega: Vec3, dt: number): this {
    const halfDt = 0.5 * dt;
    const wx = omega.x * halfDt;
    const wy = omega.y * halfDt;
    const wz = omega.z * halfDt;

    const qx = this.x, qy = this.y, qz = this.z, qw = this.w;
    this.x += wx * qw + wy * qz - wz * qy;
    this.y += wy * qw + wz * qx - wx * qz;
    this.z += wz * qw + wx * qy - wy * qx;
    this.w += -wx * qx - wy * qy - wz * qz;
    return this.normalize();
  }

  public static readonly _t0 = new Quat();
}
