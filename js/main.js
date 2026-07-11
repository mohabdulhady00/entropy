/* ============================================================
   ENTROPY · main orchestrator
   Lenis smooth scroll → GSAP reveals + a single scroll-driven
   "disorder" state that melts / shatters / vaporises the WebGL.
   ============================================================ */
import * as THREE from 'three';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Scene } from './scene.js';
import { Physics } from './physics.js';

gsap.registerPlugin(ScrollTrigger);

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smoothstep = (a,b,x)=>{ const t=clamp((x-a)/(b-a)); return t*t*(3-2*t); };
const lerp = (a,b,t)=>a+(b-a)*t;

/* ---------------- boot ---------------- */
const canvas = document.getElementById('gl');
const physics = new Physics(42);
const three = new Scene(canvas, physics);

/* ---------------- text splitting ---------------- */
function splitLines(root){
  root.querySelectorAll('[data-split] .line').forEach(line=>{
    const span = document.createElement('span');
    span.className = 'line-inner';
    while(line.firstChild) span.appendChild(line.firstChild);
    line.appendChild(span);
  });
}
function splitSmoke(root){
  root.querySelectorAll('[data-smoke] .line').forEach(line=>{
    const frag = document.createDocumentFragment();
    line.childNodes.forEach(node=>{
      if(node.nodeType === 3){ // text
        node.textContent.split(/(\s+)/).forEach(tok=>{
          if(tok.trim()===''){ frag.appendChild(document.createTextNode(tok)); return; }
          const w=document.createElement('span'); w.className='word'; w.textContent=tok;
          frag.appendChild(w);
        });
      } else {
        const w=document.createElement('span'); w.className='word';
        w.appendChild(node.cloneNode(true)); frag.appendChild(w);
      }
    });
    line.innerHTML=''; line.appendChild(frag);
  });
}
splitLines(document);
splitSmoke(document);

/* ---------------- DOM reveals ---------------- */
function setupReveals(){
  gsap.set('.line-inner', { yPercent:110 });
  gsap.set('[data-fade]', { opacity:0, y:24 });

  document.querySelectorAll('.phase').forEach(phase=>{
    const lines = phase.querySelectorAll('.line-inner');
    const fades = phase.querySelectorAll('[data-fade]');
    ScrollTrigger.create({
      trigger: phase, start:'top 78%',
      onEnter:()=>{
        gsap.to(lines,{ yPercent:0, duration:1.1, ease:'expo.out', stagger:0.08 });
        gsap.to(fades,{ opacity:1, y:0, duration:1, ease:'power3.out', delay:0.2, stagger:0.1 });
      },
      once:true
    });
  });

  // THE TURN: DOM tilts + drifts sideways in sync with the camera roll
  if(!REDUCED){
    gsap.to('.turn-stage',{
      rotate:-7, xPercent:-8, ease:'none',
      scrollTrigger:{ trigger:'#turn', start:'top 55%', end:'bottom bottom', scrub:true }
    });
  }

  // smoke: words drift up + blur as vapor scrolls past
  const smokeWords = document.querySelectorAll('[data-smoke] .word');
  if(smokeWords.length && !REDUCED){
    gsap.to(smokeWords,{
      yPercent:-160, opacity:0, filter:'blur(14px)',
      stagger:{ each:0.04, from:'random' }, ease:'none',
      scrollTrigger:{ trigger:'#vapor', start:'top 30%', end:'bottom top', scrub:true }
    });
  }
}

/* ---------------- intro ---------------- */
function playIntro(){
  const hero = document.querySelectorAll('#crystal .line-inner');
  const lede = document.querySelector('#crystal [data-fade]');
  gsap.to(hero,{ yPercent:0, duration:1.3, ease:'expo.out', stagger:0.1, delay:0.15 });
  gsap.to(lede,{ opacity:1, y:0, duration:1, ease:'power3.out', delay:0.6 });
}

/* ---------------- Lenis ---------------- */
const lenis = new Lenis({
  lerp: REDUCED ? 1 : 0.09,
  smoothWheel: !REDUCED,
  wheelMultiplier: 0.9,
  touchMultiplier: 1.4
});
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t)=> lenis.raf(t*1000));
gsap.ticker.lagSmoothing(0);

/* nav + CTA jump */
document.querySelectorAll('[data-goto]').forEach(a=>{
  a.addEventListener('click', e=>{
    e.preventDefault();
    const idx = +a.dataset.goto;
    const target = document.querySelectorAll('.phase')[idx];
    if(target) lenis.scrollTo(target,{ offset: -10, duration: 1.6 });
  });
});

/* active nav state */
const navLinks = [...document.querySelectorAll('.chrome-nav a')];
const phaseEls = [...document.querySelectorAll('.phase')];
phaseEls.forEach((ph,i)=>{
  ScrollTrigger.create({
    trigger:ph, start:'top 50%', end:'bottom 50%',
    onToggle:self=>{ if(self.isActive){ navLinks.forEach(l=>l.classList.remove('active')); navLinks[i]?.classList.add('active'); } }
  });
});

/* ---------------- video → section anchoring ---------------- */
// which clip belongs to which phase index (1 = fracture stays procedural)
const CLIP_FOR_PHASE = { 0:'crystal', 2:'melt', 3:'vapor', 4:'turn', 5:'singularity' };
let phaseVid = [];
function computePhaseVid(){
  const limit = lenis.limit || (document.documentElement.scrollHeight - window.innerHeight) || 1;
  const vh = window.innerHeight;
  phaseVid = phaseEls.map((el,i)=>{
    const name = CLIP_FOR_PHASE[i];
    if(!name) return null;
    const top = el.offsetTop, h = el.offsetHeight;
    const centerScroll = clamp(top + h/2 - vh/2, 0, limit);
    return { name, center: centerScroll/limit, band: Math.max(0.05, (h*0.5)/limit) };
  });
}

/* ---------------- pointer ---------------- */
const pointer = { x:0, y:0, tx:0, ty:0 };
window.addEventListener('pointermove', e=>{
  pointer.tx = (e.clientX/window.innerWidth)*2-1;
  pointer.ty = -((e.clientY/window.innerHeight)*2-1);
});

/* ---------------- meter / labels ---------------- */
const meterFill = document.getElementById('meter-fill');
const meterPct  = document.getElementById('meter-pct');
const meterState= document.getElementById('meter-state');
const scrollHint= document.getElementById('scrollHint');
const STATES = [
  [0.00,'SOLID'],[0.13,'FRACTURING'],[0.33,'LIQUID'],
  [0.55,'VAPOR'],[0.72,'INVERTED'],[0.90,'SINGULAR']
];
function stateLabel(p){ let s='SOLID'; for(const [t,l] of STATES){ if(p>=t) s=l; } return s; }

let hintHidden=false;
lenis.on('scroll',({scroll})=>{ if(!hintHidden && scroll>40){ hintHidden=true; scrollHint.classList.add('hide'); } });

/* ---------------- state → uniforms loop ---------------- */
let velSmooth=0, lastAccentHue=-999, lastT=performance.now();

function frame(){
  const now = performance.now();
  let dt = (now-lastT)/1000; lastT=now;
  dt = Math.min(dt, 1/30);
  const time = now*0.001;

  const p = clamp(lenis.progress || 0);
  const velRaw = clamp(Math.abs(lenis.velocity||0)/40, 0, 1.2);
  velSmooth = lerp(velSmooth, velRaw, 0.12);

  // ---- derived disorder curves ----
  const melt      = smoothstep(0.30,0.52,p) * (1 - smoothstep(0.90,0.97,p));
  const objAlpha  = Math.max(1 - smoothstep(0.55,0.70,p), smoothstep(0.90,0.965,p));
  const shrink    = 1 - smoothstep(0.84,0.915,p);
  const reform    = smoothstep(0.915,0.98,p);
  const objScale  = clamp(Math.max(shrink, reform), 0.02, 1);
  const disperse  = smoothstep(0.55,0.72,p);
  const collapse  = smoothstep(0.90,0.99,p);

  let fragAlpha = smoothstep(0.12,0.20,p);
  const dip = clamp(smoothstep(0.36,0.50,p) - smoothstep(0.70,0.78,p));
  fragAlpha *= (1 - 0.82*dip);
  fragAlpha *= (1 - smoothstep(0.90,0.975,p));

  const turnAngle = -Math.PI/2 * smoothstep(0.70,0.86,p) * (1 - smoothstep(0.90,0.965,p));
  const camZ = 7 - 0.4*smoothstep(0.20,0.70,p) + 0.7*smoothstep(0.90,1.0,p);

  // ---- generated-video layer: each clip anchored to its own DOM section ----
  // opacity peaks at the section centre and hits 0 before the neighbour → no bleed
  const VID_CAP = 0.85;
  let vidName=null, vidOpacity=0;
  for(let i=0;i<phaseVid.length;i++){
    const r = phaseVid[i]; if(!r) continue;         // fracture has no clip
    const op = 1 - smoothstep(0, r.band, Math.abs(p - r.center));
    if(op > vidOpacity){ vidOpacity = op; vidName = r.name; }
  }
  vidOpacity *= VID_CAP;

  // ---- physics control ----
  if(p < 0.10){ physics.reassemble(); }
  else if(p < 0.62 && !physics._shattered && (p > 0.18 || velRaw > 0.22)){
    physics.shatter(1 + velRaw*2.5);
  }
  physics.setGravityAngle(turnAngle);
  physics.step(dt);

  // ---- accent hue drifts with disorder ----
  const hue = (75 + p*250) % 360;
  if(Math.abs(hue-lastAccentHue) > 1.5){
    lastAccentHue = hue;
    const c = new THREE.Color().setHSL(hue/360, 0.85, 0.62);
    three.setAccent(c);
    document.documentElement.style.setProperty('--accent', `#${c.getHexString()}`);
  }

  // ---- pointer easing ----
  pointer.x = lerp(pointer.x, pointer.tx, 0.06);
  pointer.y = lerp(pointer.y, pointer.ty, 0.06);

  // ---- push to scene ----
  three.update({
    time, entropy:p, vel:velSmooth,
    melt, objAlpha, objScale, disperse, collapse,
    fragAlpha, fragScale:1, turnAngle, camZ,
    vidName, vidOpacity,
    pointer
  });

  // ---- HUD ----
  const pct = Math.round(p*100);
  meterFill.style.width = pct+'%';
  meterPct.textContent = pct;
  const lbl = stateLabel(p);
  if(meterState.textContent!==lbl) meterState.textContent=lbl;
}
gsap.ticker.add(frame);

/* ---------------- resize ---------------- */
let rt;
window.addEventListener('resize',()=>{
  three.resize();
  clearTimeout(rt); rt=setTimeout(()=>{ ScrollTrigger.refresh(); computePhaseVid(); },160);
});

/* ---------------- preloader ---------------- */
const pre = document.getElementById('preloader');
const preFill = document.getElementById('pre-fill');
const prePct  = document.getElementById('pre-pct');
let booted=false;
function boot(){
  if(booted) return; booted=true;
  setupReveals();
  let v=0;
  const tick=()=>{
    v = Math.min(100, v + (v<80?6:2) + Math.random()*4);
    preFill.style.right = (100-v)+'%';
    prePct.textContent = Math.round(v);
    if(v<100){ requestAnimationFrame(tick); }
    else {
      pre.classList.add('done');
      lenis.scrollTo(0,{immediate:true});
      playIntro();
      ScrollTrigger.refresh();
      computePhaseVid();
    }
  };
  requestAnimationFrame(tick);
}
window.addEventListener('load', ()=> setTimeout(boot, 60));
// safety: if load already fired
if(document.readyState==='complete') setTimeout(boot,60);

/* expose for debugging */
window.__ENTROPY = { lenis, three, physics, gsap, ScrollTrigger };
