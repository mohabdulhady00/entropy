/* ============================================================
   ENTROPY · Three.js scene
   Background fluid pass + morphing central form + particle
   dispersal + instanced physics fragments, one render loop.
   ============================================================ */
import * as THREE from 'three';
import {
  BG_VERT, BG_FRAG, OBJ_VERT, OBJ_FRAG, PT_VERT, PT_FRAG, VID_VERT, VID_FRAG
} from './shaders.js';

export class Scene {
  constructor(canvas, physics){
    this.canvas = canvas;
    this.physics = physics;
    this.accent = new THREE.Color('#c8ff4d');

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias:true, alpha:false, powerPreference:'high-performance'
    });
    this.renderer.setClearColor(0x05060a, 1);
    this.renderer.autoClear = false;
    const isMobile = window.innerWidth < 760;
    this._dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
    this.renderer.setPixelRatio(this._dpr);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x05060a, 0.055);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 0, 7);

    this._tmpQuat = new THREE.Quaternion();
    this._tmpMat  = new THREE.Matrix4();
    this._tmpScale = new THREE.Vector3();
    this._tmpPos  = new THREE.Vector3();

    this._buildBackground();
    this._buildVideoLayer();
    this._buildLights();
    this._buildForm();
    this._buildParticles();
    this._buildFragments();

    this.resize();
  }

  /* ---------- background fullscreen fluid ---------- */
  _buildBackground(){
    this.bgScene = new THREE.Scene();
    this.bgCam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.bgUniforms = {
      uTime:{value:0}, uEntropy:{value:0}, uVel:{value:0}, uAspect:{value:1},
      uPointer:{value:new THREE.Vector2(0,0)},
      uAccent:{value:this.accent.clone()},
      uDeep:{value:new THREE.Color('#070912')}
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader:BG_VERT, fragmentShader:BG_FRAG,
      uniforms:this.bgUniforms, depthWrite:false, depthTest:false
    });
    this.bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), mat));
  }

  /* ---------- optional generated-video layer (additive) ---------- */
  _buildVideoLayer(){
    this.videos = {};        // name -> {el, tex}
    this._activeVid = null;
    const sources = {
      crystal:'assets/crystal.mp4',
      melt:   'assets/melt.mp4',
      vapor:  'assets/vapor.mp4'
    };
    for(const [name,src] of Object.entries(sources)){
      const el = document.createElement('video');
      el.src = src; el.loop = true; el.muted = true; el.playsInline = true;
      el.preload = 'auto'; el.crossOrigin = 'anonymous';
      el.setAttribute('playsinline',''); el.setAttribute('muted','');
      const tex = new THREE.VideoTexture(el);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
      this.videos[name] = { el, tex, ready:false };
      el.addEventListener('loadeddata', ()=>{ this.videos[name].ready = true; }, {once:true});
      el.addEventListener('error', ()=>{ this.videos[name].error = true; }, {once:true});
    }
    this.vidUniforms = {
      uTex:{value:null}, uOpacity:{value:0}, uCanvasAspect:{value:1}, uVidAspect:{value:16/9}
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader:VID_VERT, fragmentShader:VID_FRAG, uniforms:this.vidUniforms,
      transparent:true, depthTest:false, depthWrite:false, blending:THREE.AdditiveBlending
    });
    this.videoQuad = new THREE.Mesh(new THREE.PlaneGeometry(2,2), mat);
    this.videoQuad.renderOrder = 1;   // over the shader bg, under the 3D scene
    this.videoQuad.visible = false;
    this.bgScene.add(this.videoQuad);
  }

  // called each frame: pick which clip is active + its opacity
  setVideoPhase(name, opacity){
    if(opacity < 0.01 || !name){
      this.videoQuad.visible = false;
      if(this._activeVid && this.videos[this._activeVid]) this.videos[this._activeVid].el.pause();
      this._activeVid = null;
      return;
    }
    const v = this.videos[name];
    if(!v || v.error){ this.videoQuad.visible = false; return; }
    if(this._activeVid !== name){
      if(this._activeVid && this.videos[this._activeVid]) this.videos[this._activeVid].el.pause();
      this._activeVid = name;
      this.vidUniforms.uTex.value = v.tex;
      const p = v.el.play(); if(p && p.catch) p.catch(()=>{});
    }
    this.videoQuad.visible = true;
    this.vidUniforms.uOpacity.value = opacity;
  }

  _buildLights(){
    this.scene.add(new THREE.AmbientLight(0x40465c, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3,5,4); this.scene.add(key);
    this.accentLight = new THREE.PointLight(this.accent.getHex(), 9, 24, 1.4);
    this.accentLight.position.set(-2,1,3); this.scene.add(this.accentLight);
    const cool = new THREE.PointLight(0x4066ff, 4, 22, 1.6);
    cool.position.set(2,-2,-2); this.scene.add(cool);
  }

  /* ---------- central morphing form ---------- */
  _buildForm(){
    const geo = new THREE.IcosahedronGeometry(1.3, 20);
    this.objUniforms = {
      uTime:{value:0}, uMelt:{value:0}, uVel:{value:0}, uEntropy:{value:0},
      uAlpha:{value:1}, uAccent:{value:this.accent.clone()},
      uBase:{value:new THREE.Color('#0b0e18')}
    };
    this.formMat = new THREE.ShaderMaterial({
      vertexShader:OBJ_VERT, fragmentShader:OBJ_FRAG,
      uniforms:this.objUniforms, transparent:true, depthWrite:true
    });
    this.form = new THREE.Mesh(geo, this.formMat);
    this.scene.add(this.form);
  }

  /* ---------- particle dispersal ---------- */
  _buildParticles(){
    const N = window.innerWidth < 760 ? 9000 : 18000;
    const pos = new Float32Array(N*3);
    const seed = new Float32Array(N);
    for(let i=0;i<N;i++){
      // random point on/near a sphere shell ~ the form silhouette
      const u = Math.random(), v = Math.random();
      const th = 2*Math.PI*u, ph = Math.acos(2*v-1);
      const r = 1.28 + (Math.random()-0.5)*0.12;
      pos[i*3]   = Math.sin(ph)*Math.cos(th)*r;
      pos[i*3+1] = Math.cos(ph)*r;
      pos[i*3+2] = Math.sin(ph)*Math.sin(th)*r;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos,3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed,1));
    this.ptUniforms = {
      uTime:{value:0}, uDisperse:{value:0}, uEntropy:{value:0}, uVel:{value:0},
      uCollapse:{value:0}, uSize:{value:1.7}, uPix:{value:this._dpr*window.innerHeight/2},
      uAccent:{value:this.accent.clone()}
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader:PT_VERT, fragmentShader:PT_FRAG, uniforms:this.ptUniforms,
      transparent:true, depthWrite:false, blending:THREE.AdditiveBlending
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  /* ---------- instanced physics fragments ---------- */
  _buildFragments(){
    const n = this.physics.count;
    const geo = new THREE.BoxGeometry(1,1,1);
    this.fragMat = new THREE.MeshStandardMaterial({
      color:0x1a2033, metalness:0.35, roughness:0.4,
      emissive:new THREE.Color('#0e1524'), emissiveIntensity:1,
      flatShading:true, transparent:true, opacity:0
    });
    this.frags = new THREE.InstancedMesh(geo, this.fragMat, n);
    this.frags.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.frags.frustumCulled = false;
    this.scene.add(this.frags);
    this._fragScaleGlobal = 1;
  }

  _syncFragments(alpha, scale){
    this.fragMat.opacity = alpha;
    this.frags.visible = alpha > 0.01;
    if(!this.frags.visible) return;
    const bodies = this.physics.bodies;
    for(let i=0;i<bodies.length;i++){
      const b = bodies[i];
      this._tmpPos.set(b.position.x, b.position.y, b.position.z);
      this._tmpQuat.set(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w);
      const s = this.physics.sizes[i]*scale;
      this._tmpScale.set(s,s,s);
      this._tmpMat.compose(this._tmpPos, this._tmpQuat, this._tmpScale);
      this.frags.setMatrixAt(i, this._tmpMat);
    }
    this.frags.instanceMatrix.needsUpdate = true;
  }

  setAccent(color){
    this.accent.copy(color);
    this.bgUniforms.uAccent.value.copy(color);
    this.objUniforms.uAccent.value.copy(color);
    this.ptUniforms.uAccent.value.copy(color);
    this.accentLight.color.copy(color);
    this.fragMat.emissive.copy(color).multiplyScalar(0.18);
  }

  /* ---------- per-frame update ---------- */
  update(s){
    // background
    this.bgUniforms.uTime.value = s.time;
    this.bgUniforms.uEntropy.value = s.entropy;
    this.bgUniforms.uVel.value = s.vel;
    this.bgUniforms.uPointer.value.set(s.pointer.x, s.pointer.y);

    // form
    this.objUniforms.uTime.value = s.time;
    this.objUniforms.uMelt.value = s.melt;
    this.objUniforms.uVel.value = s.vel;
    this.objUniforms.uEntropy.value = s.entropy;
    this.objUniforms.uAlpha.value = s.objAlpha;
    this.form.visible = s.objAlpha > 0.01;
    this.form.scale.setScalar(s.objScale);
    this.form.rotation.y = s.time*0.08;
    this.form.rotation.x = Math.sin(s.time*0.13)*0.15;

    // particles
    this.ptUniforms.uTime.value = s.time;
    this.ptUniforms.uDisperse.value = s.disperse;
    this.ptUniforms.uVel.value = s.vel;
    this.ptUniforms.uCollapse.value = s.collapse;
    this.points.rotation.y = s.time*0.05;

    // fragments (physics-driven)
    this._syncFragments(s.fragAlpha, s.fragScale);

    // optional generated-video layer
    this.setVideoPhase(s.vidName, s.vidOpacity);

    // camera: parallax + roll (THE TURN) + dolly
    this.camera.position.x += (s.pointer.x*0.7 - this.camera.position.x)*0.05;
    this.camera.position.y += (s.pointer.y*0.5 - this.camera.position.y)*0.05;
    this.camera.position.z += (s.camZ - this.camera.position.z)*0.05;
    this.camera.lookAt(0,0,0);
    if(s.turnAngle) this.camera.rotateZ(s.turnAngle);

    // render: bg (clear) then main scene (keep, clear depth)
    const r = this.renderer;
    r.clear();
    r.render(this.bgScene, this.bgCam);
    r.clearDepth();
    r.render(this.scene, this.camera);
  }

  resize(){
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w/h;
    this.camera.updateProjectionMatrix();
    this.bgUniforms.uAspect.value = w/h;
    this.vidUniforms.uCanvasAspect.value = w/h;
    this.ptUniforms.uPix.value = this._dpr * h/2;
  }
}
