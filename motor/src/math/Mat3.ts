import { Vec3 } from './Vec3';

export class Mat3 {
  public elements: Float32Array;

  constructor() {
    this.elements = new Float32Array([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ]);
  }

  public setIdentity(): this {
    const e = this.elements;
    e[0] = 1; e[1] = 0; e[2] = 0;
    e[3] = 0; e[4] = 1; e[5] = 0;
    e[6] = 0; e[7] = 0; e[8] = 1;
    return this;
  }

  public setZero(): this {
    this.elements.fill(0);
    return this;
  }

  public setDiagonal(x: number, y: number, z: number): this {
    this.setZero();
    this.elements[0] = x;
    this.elements[4] = y;
    this.elements[8] = z;
    return this;
  }

  public copy(m: Mat3): this {
    this.elements.set(m.elements);
    return this;
  }

  public multiplyVec3(v: Vec3, out: Vec3): Vec3 {
    const e = this.elements;
    const x = v.x, y = v.y, z = v.z;
    out.x = e[0] * x + e[1] * y + e[2] * z;
    out.y = e[3] * x + e[4] * y + e[5] * z;
    out.z = e[6] * x + e[7] * y + e[8] * z;
    return out;
  }

  public multiplyMatrices(a: Mat3, b: Mat3): this {
    const ae = a.elements, be = b.elements, te = this.elements;
    const a11 = ae[0], a12 = ae[1], a13 = ae[2];
    const a21 = ae[3], a22 = ae[4], a23 = ae[5];
    const a31 = ae[6], a32 = ae[7], a33 = ae[8];

    const b11 = be[0], b12 = be[1], b13 = be[2];
    const b21 = be[3], b22 = be[4], b23 = be[5];
    const b31 = be[6], b32 = be[7], b33 = be[8];

    te[0] = a11 * b11 + a12 * b21 + a13 * b31;
    te[1] = a11 * b12 + a12 * b22 + a13 * b32;
    te[2] = a11 * b13 + a12 * b23 + a13 * b33;

    te[3] = a21 * b11 + a22 * b21 + a23 * b31;
    te[4] = a21 * b12 + a22 * b22 + a23 * b32;
    te[5] = a21 * b13 + a22 * b23 + a23 * b33;

    te[6] = a31 * b11 + a32 * b21 + a33 * b31;
    te[7] = a31 * b12 + a32 * b22 + a33 * b32;
    te[8] = a31 * b13 + a32 * b23 + a33 * b33;
    return this;
  }

  public transpose(out: Mat3): Mat3 {
    const e = this.elements, oe = out.elements;
    oe[0] = e[0]; oe[1] = e[3]; oe[2] = e[6];
    oe[3] = e[1]; oe[4] = e[4]; oe[5] = e[7];
    oe[6] = e[2]; oe[7] = e[5]; oe[8] = e[8];
    return out;
  }

  public invert(): this {
    const e = this.elements;
    const n11 = e[0], n21 = e[3], n31 = e[6];
    const n12 = e[1], n22 = e[4], n32 = e[7];
    const n13 = e[2], n23 = e[5], n33 = e[8];

    const t11 = n33 * n22 - n32 * n23;
    const t12 = n32 * n13 - n33 * n12;
    const t13 = n23 * n12 - n22 * n13;

    const det = n11 * t11 + n21 * t12 + n31 * t13;
    if (Math.abs(det) < 1e-10) return this.setZero();

    const detInv = 1 / det;
    e[0] = t11 * detInv;
    e[1] = t12 * detInv;
    e[2] = t13 * detInv;
    e[3] = (n31 * n23 - n33 * n21) * detInv;
    e[4] = (n33 * n11 - n31 * n13) * detInv;
    e[5] = (n21 * n13 - n23 * n11) * detInv;
    e[6] = (n32 * n21 - n31 * n22) * detInv;
    e[7] = (n31 * n12 - n32 * n11) * detInv;
    e[8] = (n22 * n11 - n21 * n12) * detInv;
    return this;
  }

  public static readonly _t0 = new Mat3();
  public static readonly _t1 = new Mat3();
}
