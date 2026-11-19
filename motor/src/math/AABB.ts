import { Vec3 } from './Vec3';

export class AABB {
  public min = new Vec3();
  public max = new Vec3();

  public overlaps(other: AABB): boolean {
    return (
      this.min.x <= other.max.x && this.max.x >= other.min.x &&
      this.min.y <= other.max.y && this.max.y >= other.min.y &&
      this.min.z <= other.max.z && this.max.z >= other.min.z
    );
  }

  public expand(margin: number): this {
    this.min.x -= margin; this.min.y -= margin; this.min.z -= margin;
    this.max.x += margin; this.max.y += margin; this.max.z += margin;
    return this;
  }
}
