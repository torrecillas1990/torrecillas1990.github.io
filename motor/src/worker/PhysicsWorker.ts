import { World } from '../core/World';
import { RigidBody, BodyType } from '../core/RigidBody';
import { Vec3 } from '../math/Vec3';
import { SphereShape, BoxShape, CapsuleShape } from '../shapes/Primitives';
import { HingeJoint, DistanceJoint } from '../constraints/Joints';

const world = new World();
let transformBuffer = new Float32Array(0);

self.onmessage = (e: MessageEvent) => {
  const msg = e.data;

  switch (msg.type) {
    case 'INIT_SCENE': {
      // Construir escena inicial dentro del Worker
      // 1. Suelo estático
      const ground = new RigidBody({
        type: BodyType.STATIC,
        position: new Vec3(0, -0.5, 0),
        shape: new BoxShape(new Vec3(15, 0.5, 15)),
        friction: 0.7
      });
      world.addBody(ground);

      // 2. Torre de cajas apiladas (3x4x3)
      for (let y = 0; y < 4; y++) {
        for (let x = -1; x <= 1; x++) {
          const box = new RigidBody({
            type: BodyType.DYNAMIC,
            mass: 1.5,
            position: new Vec3(x * 1.1, 0.55 + y * 1.05, 0),
            shape: new BoxShape(new Vec3(0.5, 0.5, 0.5)),
            restitution: 0.1,
            friction: 0.6
          });
          world.addBody(box);
        }
      }

      // 3. Péndulo articulado con HingeJoint
      const pivot = new RigidBody({
        type: BodyType.STATIC,
        position: new Vec3(0, 7, 3),
        shape: new SphereShape(0.2)
      });
      const pendulumBob = new RigidBody({
        type: BodyType.DYNAMIC,
        mass: 5.0,
        position: new Vec3(3.5, 7, 3),
        shape: new SphereShape(0.6),
        restitution: 0.8
      });
      world.addBody(pivot);
      world.addBody(pendulumBob);
      world.addConstraint(new HingeJoint(pivot, pendulumBob, new Vec3(0, 7, 3), new Vec3(0, 0, 1)));

      transformBuffer = new Float32Array(world.bodies.length * 7);
      world.writeTransformsToBuffer(transformBuffer);

      self.postMessage({
        type: 'SCENE_READY',
        bodies: world.bodies.map(b => ({ id: b.id, shapeType: b.shape.type })),
        transforms: transformBuffer
      }, [transformBuffer.buffer] as any);
      break;
    }

    case 'STEP': {
      // Recuperar buffer devuelto por el hilo principal
      if (msg.transforms) {
        transformBuffer = new Float32Array(msg.transforms);
      }
      if (transformBuffer.length < world.bodies.length * 7) {
        transformBuffer = new Float32Array(world.bodies.length * 7);
      }

      world.step(msg.dt);
      world.writeTransformsToBuffer(transformBuffer);

      self.postMessage({
        type: 'STEP_DONE',
        transforms: transformBuffer
      }, [transformBuffer.buffer] as any);
      break;
    }

    case 'SPAWN_BALL': {
      const ball = new RigidBody({
        type: BodyType.DYNAMIC,
        mass: 4.0,
        position: new Vec3(msg.pos.x, msg.pos.y, msg.pos.z),
        shape: new SphereShape(0.5),
        restitution: 0.5
      });
      ball.linearVelocity.set(msg.vel.x, msg.vel.y, msg.vel.z);
      world.addBody(ball);

      self.postMessage({
        type: 'BODY_ADDED',
        id: ball.id,
        shapeType: ball.shape.type
      });
      break;
    }
  }
};