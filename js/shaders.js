/* ============================================================
   ENTROPY · GLSL shaders
   All noise = Ashima simplex (public domain).
   ============================================================ */

export const SIMPLEX = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
    i.z+vec4(0.0,i1.z,i2.z,1.0))
    +i.y+vec4(0.0,i1.y,i2.y,1.0))
    +i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){
  float f=0.0,a=0.5;
  for(int i=0;i<3;i++){f+=a*snoise(p);p*=2.02;a*=0.5;}
  return f;
}
`;

/* -------- BACKGROUND (fullscreen fluid field) -------- */
export const BG_VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }
`;

export const BG_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform float uTime, uEntropy, uVel, uAspect;
uniform vec2  uPointer;
uniform vec3  uAccent, uDeep;
${SIMPLEX}

void main(){
  vec2 uv = vUv;
  vec2 p = (uv-0.5); p.x*=uAspect;

  // pointer + velocity driven turbulence
  float turb = 0.35 + uEntropy*1.4 + uVel*1.2;
  float t = uTime*0.06;

  vec2 q = p*1.2;
  q += 0.25*vec2(fbm(vec3(q*2.0, t)), fbm(vec3(q*2.0+5.2, t)));
  // pointer distortion
  vec2 pc = p - uPointer*vec2(uAspect,1.0);
  q += 0.12*normalize(pc+1e-4)*exp(-dot(pc,pc)*2.2);

  float n = fbm(vec3(q*turb, t*1.6));
  n = n*0.5+0.5;

  // vertical gradient void
  float grad = smoothstep(1.05,-0.15, uv.y+0.1);

  // colour: deep void -> accent flares that grow with entropy
  vec3 col = mix(uDeep, uDeep*1.7, grad);
  float flare = smoothstep(0.6,0.96,n) * (0.1+uEntropy*0.5);
  col += uAccent * flare;
  // subtle cool undertone
  col += vec3(0.02,0.03,0.06)*(1.0-uEntropy);

  // chromatic edge from velocity
  col.r += uVel*0.12*smoothstep(0.4,1.0,n);

  // vignette
  float vig = smoothstep(1.25,0.25,length(p));
  col *= 0.35+0.65*vig;

  gl_FragColor = vec4(col,1.0);
}
`;

/* -------- CENTRAL FORM (crystal -> liquid) -------- */
export const OBJ_VERT = /* glsl */`
uniform float uTime, uMelt, uVel, uEntropy;
varying vec3 vN;
varying vec3 vWorld;
varying float vD;
${SIMPLEX}

vec3 displace(vec3 pos, vec3 nor){
  float t = uTime*0.25;
  float freq = mix(2.4, 0.85, uMelt);
  float amp  = uMelt*0.6 + uVel*0.28;
  float d = fbm(pos*freq + vec3(0.0, -t*(0.6+uMelt*1.4), 0.0));
  vec3 disp = nor * d * amp;
  // gravity drip: lower half sags with melt
  float sag = smoothstep(0.4,-1.0,pos.y);
  disp.y -= uMelt * sag * (0.55 + 0.4*d);
  vD = d;
  return pos + disp;
}
void main(){
  vec3 n = normalize(normal);
  vec3 tang = normalize(cross(n, vec3(0.0,1.0,0.001)));
  vec3 bit  = normalize(cross(n, tang));
  float e = 0.06;
  vec3 p0 = displace(position, n);
  vec3 p1 = displace(position + tang*e, n);
  vec3 p2 = displace(position + bit*e,  n);
  vec3 nN = normalize(cross(p1-p0, p2-p0));

  vec4 wp = modelMatrix * vec4(p0,1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(modelMatrix) * nN);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const OBJ_FRAG = /* glsl */`
precision highp float;
uniform vec3  uAccent, uBase;
uniform float uMelt, uEntropy, uAlpha, uTime;
varying vec3 vN;
varying vec3 vWorld;
varying float vD;
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(N,V),0.0), 2.6);

  vec3 col = mix(uBase, uAccent, fres);
  col += uAccent * fres * (0.35 + uMelt*0.9);

  // crystalline facet sparkle (fades as it melts)
  float spark = smoothstep(0.65,1.0,fres) * (1.0-uMelt);
  col += spark*0.6;

  // wet inner sheen when liquid
  float sheen = smoothstep(0.2,0.9,vD*0.5+0.5)*uMelt;
  col += uAccent*sheen*0.25;

  float a = uAlpha * (0.55 + fres*0.6);
  gl_FragColor = vec4(col, clamp(a,0.0,1.0));
}
`;

/* -------- PARTICLE DISPERSAL (vapor) -------- */
export const PT_VERT = /* glsl */`
attribute float aSeed;
uniform float uTime, uDisperse, uEntropy, uVel, uSize, uPix, uCollapse;
varying float vA;
void main(){
  vec3 p = position;
  vec3 dir = normalize(position + 1e-4);
  float t = uTime*0.3;
  float s = uDisperse;

  vec3 turb = vec3(
    sin(t + aSeed*6.28 + p.y*3.0),
    cos(t*1.3 + aSeed*3.14 + p.x*2.0),
    sin(t*0.7 + aSeed*1.57 + p.z*4.0));

  p += dir * s * 2.4;
  p += turb * s * (0.9 + uVel);
  p.y += s*s * 3.2;                 // rise like smoke

  // singularity: suck everything back to a point
  p *= (1.0 - uCollapse*0.97);

  vec4 mv = modelViewMatrix * vec4(p,1.0);
  gl_Position = projectionMatrix * mv;

  float size = uSize * (0.5 + aSeed);
  gl_PointSize = size * uPix / max(-mv.z, 0.1);

  vA = smoothstep(0.0,0.18,uDisperse) * (1.0 - smoothstep(0.5,1.0,uDisperse));
  vA *= 0.3;                        // keep smoke delicate, not blown out
  vA = max(vA, uCollapse*0.7);      // flare during collapse
}
`;

export const PT_FRAG = /* glsl */`
precision highp float;
uniform vec3 uAccent;
varying float vA;
void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float a = smoothstep(0.5,0.0,d) * vA;
  if(a < 0.01) discard;
  gl_FragColor = vec4(uAccent, a);
}
`;
