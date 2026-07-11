/* ============================================================
   ENTROPY · Physics
   Cannon-es rigid-body fragments that assemble into a shell,
   shatter on scroll velocity, and fall under steerable gravity.
   ============================================================ */
import * as CANNON from 'cannon-es';

export class Physics {
  constructor(count = 40){
    this.count = count;
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.5, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.defaultContactMaterial.restitution = 0.32;
    this.world.defaultContactMaterial.friction = 0.42;

    // static bounds: floor + one side wall (used when gravity turns)
    this._addPlane(new CANNON.Vec3(0, 1, 0),  new CANNON.Vec3(0, -3.2, 0)); // floor
    this._addPlane(new CANNON.Vec3(1, 0, 0),  new CANNON.Vec3(-4.2, 0, 0)); // left wall
    this._addPlane(new CANNON.Vec3(0, 0, 1),  new CANNON.Vec3(0, 0, -3.0)); // back

    this.bodies = [];
    this.homes  = [];
    this.sizes  = [];
    this.mode = 'held';            // 'held' (kinematic near home) | 'free'
    this._built = false;
    this._shattered = false;

    this._buildFragments();
  }

  _addPlane(normal, pos){
    const b = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    b.quaternion.setFromVectors(new CANNON.Vec3(0,0,1), normal);
    b.position.copy(pos);
    this.world.addBody(b);
  }

  _buildFragments(){
    const R = 1.35;
    for(let i=0;i<this.count;i++){
      // fibonacci sphere -> shell home positions around the form
      const k = i + 0.5;
      const phi = Math.acos(1 - 2*k/this.count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * k;
      const home = new CANNON.Vec3(
        Math.cos(theta)*Math.sin(phi)*R,
        Math.cos(phi)*R,
        Math.sin(theta)*Math.sin(phi)*R
      );
      const s = 0.16 + Math.random()*0.24;
      const body = new CANNON.Body({
        mass: 1,
        shape: new CANNON.Box(new CANNON.Vec3(s,s,s)),
        position: home.clone(),
        angularDamping: 0.28,
        linearDamping: 0.02,
        type: CANNON.Body.KINEMATIC
      });
      this.world.addBody(body);
      this.bodies.push(body);
      this.homes.push(home);
      this.sizes.push(s*2);
    }
    this._built = true;
  }

  setGravityAngle(angle){
    // angle: camera roll (radians). Gravity stays world-down; we only
    // spin gravity slightly with the turn so debris drifts sideways.
    const g = 9.5;
    this.world.gravity.set(Math.sin(angle)*g, -Math.cos(angle)*g, 0);
  }

  reassemble(){
    if(this.mode === 'held') return;
    this.mode = 'held';
    this._shattered = false;
    for(let i=0;i<this.bodies.length;i++){
      const b = this.bodies[i];
      b.type = CANNON.Body.KINEMATIC;
      b.velocity.setZero();
      b.angularVelocity.setZero();
      b.wakeUp();
    }
  }

  free(){
    if(this.mode === 'free') return;
    this.mode = 'free';
    for(const b of this.bodies){
      b.type = CANNON.Body.DYNAMIC;
      b.updateMassProperties();
      b.wakeUp();
    }
  }

  shatter(power = 1){
    if(this._shattered) return;
    this._shattered = true;
    this.free();
    for(let i=0;i<this.bodies.length;i++){
      const b = this.bodies[i];
      const dir = this.homes[i].clone();
      dir.normalize();
      const imp = new CANNON.Vec3(
        dir.x*(2.5+Math.random()*2)*power,
        dir.y*(2.5+Math.random()*2)*power + 1.5,
        dir.z*(2.5+Math.random()*2)*power
      );
      b.applyImpulse(imp);
      b.angularVelocity.set(
        (Math.random()-0.5)*8,(Math.random()-0.5)*8,(Math.random()-0.5)*8);
      b.wakeUp();
    }
  }

  // while held, lerp kinematically back to shell (reversible order)
  _holdToHome(dt){
    for(let i=0;i<this.bodies.length;i++){
      const b = this.bodies[i];
      const h = this.homes[i];
      b.position.x += (h.x - b.position.x)*Math.min(1, dt*6);
      b.position.y += (h.y - b.position.y)*Math.min(1, dt*6);
      b.position.z += (h.z - b.position.z)*Math.min(1, dt*6);
      b.velocity.setZero();
      b.angularVelocity.setZero();
    }
  }

  step(dt){
    if(this.mode === 'held') this._holdToHome(dt);
    this.world.step(1/60, dt, 3);
  }
}
