/**
 * "Guiding star" scene, built from the Dishari logo (gold orbit + four-point star).
 * Particles = questions.
 *   p1: 0 → 1  scattered noise settles into four tilted orbits (K1..K4)
 *   p2: 0 → 1  the orbits gather into one four-point guiding star
 * Progress values are read from a mutable ref every frame, so scroll never re-renders React.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

export type SceneProgress = { p1: number; p2: number };

const LEVEL_COLORS = ["#F4D58A", "#E9A84F", "#E2566C", "#C22B45"]; // K1 gold → K4 deep crimson
const TILTS: [number, number][] = [[1.15, 0.18], [1.0, -0.42], [1.3, 0.62], [0.88, -0.9]]; // (x, z) tilt like the logo's orbit
const RADII = [1.35, 1.95, 2.55, 3.15];

const vert = /* glsl */ `
uniform float uTime, uP1, uP2, uPixel, uSize;
attribute vec3 aChaos; attribute vec4 aOrbit; attribute vec3 aStar; attribute float aSeed; attribute vec3 aColor;
varying vec3 vColor; varying float vAlpha;
mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
mat3 rotZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
float ease(float t){t=clamp(t,0.,1.);return t*t*(3.-2.*t);}
void main(){
  float lvl=aOrbit.x; float theta=aOrbit.y; float r=aOrbit.z; float spd=aOrbit.w;
  // scattered: slow drifting cloud
  vec3 chaos=aChaos+0.22*vec3(sin(uTime*.35+aSeed*31.),cos(uTime*.29+aSeed*17.),sin(uTime*.23+aSeed*7.));
  // orbit: ellipse, tilted per level
  float a=theta+uTime*spd;
  vec3 orb=vec3(cos(a)*r, sin(a)*r, (aSeed-.5)*.12);
  vec2 tilt = lvl<.5?vec2(${TILTS[0][0]},${TILTS[0][1]}):lvl<1.5?vec2(${TILTS[1][0]},${TILTS[1][1]}):lvl<2.5?vec2(${TILTS[2][0]},${TILTS[2][1]}):vec2(${TILTS[3][0]},${TILTS[3][1]});
  orb=rotZ(tilt.y)*rotX(tilt.x)*orb;
  // star: slowly rotating four-point star
  float ra=uTime*.12; vec3 star=vec3(aStar.x*cos(ra)-aStar.y*sin(ra), aStar.x*sin(ra)+aStar.y*cos(ra), aStar.z);
  // staggered progress so questions "sort" one by one
  float p1=ease(uP1*1.7-aSeed*.7); float p2=ease(uP2*1.6-(1.-aSeed)*.6);
  vec3 pos=mix(mix(chaos,orb,p1),star,p2);
  vec4 mv=modelViewMatrix*vec4(pos,1.);
  gl_Position=projectionMatrix*mv;
  float tw=.75+.25*sin(uTime*2.+aSeed*40.);
  gl_PointSize=uSize*(.45+aSeed*.9)*tw*uPixel/(-mv.z);
  vColor=mix(vec3(1.,.93,.82),aColor,max(p1,p2*.7));
  vAlpha=mix(.55,.95,p1);
}`;

const frag = /* glsl */ `
varying vec3 vColor; varying float vAlpha;
void main(){
  float d=length(gl_PointCoord-.5);
  float a=smoothstep(.5,.0,d); a=pow(a,1.6);
  gl_FragColor=vec4(vColor*(.6+a*.9),a*vAlpha);
}`;

const starVert = /* glsl */ `varying vec2 vUv; void main(){ vUv=uv*2.-1.; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const starFrag = /* glsl */ `
uniform float uTime, uGlow; varying vec2 vUv;
void main(){
  vec2 p=vUv; float r=length(p);
  float rays=exp(-abs(p.x)*26.)*exp(-abs(p.y)*2.2)+exp(-abs(p.y)*26.)*exp(-abs(p.x)*2.2);
  float core=exp(-r*7.)+.35*exp(-r*2.6);
  float pulse=.85+.15*sin(uTime*1.6);
  vec3 col=mix(vec3(1.,.78,.36),vec3(1.,.97,.88),core);
  float a=(rays*.9+core)*uGlow*pulse;
  gl_FragColor=vec4(col*a,a);
}`;

function buildGeometry(count: number) {
  const chaos = new Float32Array(count * 3), orbit = new Float32Array(count * 4), star = new Float32Array(count * 3);
  const seed = new Float32Array(count), color = new Float32Array(count * 3), pos = new Float32Array(count * 3);
  const cols = LEVEL_COLORS.map((c) => new THREE.Color(c));
  for (let i = 0; i < count; i++) {
    // chaos: wide flattened cloud
    const u = Math.random(), v = Math.random(), w = Math.cbrt(Math.random());
    const th = 2 * Math.PI * u, ph = Math.acos(2 * v - 1);
    chaos.set([Math.sin(ph) * Math.cos(th) * 5.2 * w, Math.sin(ph) * Math.sin(th) * 3.2 * w, Math.cos(ph) * 2.5 * w], i * 3);
    // orbit: level weighted like a typical bank (more K1/K2)
    const rnd = Math.random();
    const lvl = rnd < 0.33 ? 0 : rnd < 0.63 ? 1 : rnd < 0.84 ? 2 : 3;
    const jitter = (Math.random() - 0.5) * 0.18 + (Math.random() - 0.5) * 0.08;
    orbit.set([lvl, Math.random() * Math.PI * 2, RADII[lvl] + jitter, (0.16 - lvl * 0.025) * (Math.random() < 0.5 ? 1 : 1)], i * 4);
    // star: four-point star, denser on the outline
    const phi = Math.random() * Math.PI * 2;
    const R = 2.7 * (0.12 + 0.88 * Math.pow(Math.abs(Math.cos(2 * phi)), 5));
    const rr = R * (0.55 + 0.45 * Math.sqrt(Math.random()));
    star.set([Math.cos(phi) * rr, Math.sin(phi) * rr, (Math.random() - 0.5) * 0.25], i * 3);
    seed[i] = Math.random();
    const c = cols[lvl];
    color.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aChaos", new THREE.BufferAttribute(chaos, 3));
  g.setAttribute("aOrbit", new THREE.BufferAttribute(orbit, 4));
  g.setAttribute("aStar", new THREE.BufferAttribute(star, 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  g.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 10);
  return g;
}

function ringGeometry(r: number) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 160; i++) { const a = (i / 160) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

function Scene({ progress, count, still, visible }: { progress: MutableRefObject<SceneProgress>; count: number; still: boolean; visible: MutableRefObject<boolean> }) {
  const { gl, camera } = useThree();
  const geo = useMemo(() => buildGeometry(count), [count]);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uP1: { value: 0 }, uP2: { value: 0 }, uPixel: { value: gl.getPixelRatio() }, uSize: { value: 26 } },
  }), [gl]);
  const starMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: starVert, fragmentShader: starFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uGlow: { value: 0.6 } },
  }), []);
  const rings = useMemo(() => RADII.map((r) => ringGeometry(r)), []);
  const ringMats = useMemo(() => LEVEL_COLORS.map((c) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })), []);
  const lines = useMemo(() => rings.map((g, i) => new THREE.Line(g, ringMats[i])), [rings, ringMats]);
  const group = useRef<THREE.Group>(null);
  const starRef = useRef<THREE.Mesh>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const smooth = useRef({ p1: 0, p2: 0, t: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => { mouse.current.x = e.clientX / window.innerWidth - 0.5; mouse.current.y = e.clientY / window.innerHeight - 0.5; };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); starMat.dispose(); rings.forEach((r) => r.dispose()); ringMats.forEach((m) => m.dispose()); }, [geo, mat, starMat, rings, ringMats]);

  useFrame((_, dt) => {
    if (!visible.current) return;
    const s = smooth.current;
    const k = still ? 1 : 1 - Math.pow(0.0025, dt); // frame-rate independent easing
    s.p1 += (progress.current.p1 - s.p1) * k;
    s.p2 += (progress.current.p2 - s.p2) * k;
    if (!still) s.t += dt;
    mat.uniforms.uTime.value = s.t; mat.uniforms.uP1.value = s.p1; mat.uniforms.uP2.value = s.p2;
    starMat.uniforms.uTime.value = s.t;
    starMat.uniforms.uGlow.value = 0.35 + s.p1 * 0.35 + s.p2 * 0.9;
    ringMats.forEach((m) => { m.opacity = 0.16 * s.p1 * (1 - s.p2); });
    if (starRef.current) { const sc = 1.6 + s.p2 * 2.4; starRef.current.scale.set(sc, sc, 1); starRef.current.quaternion.copy(camera.quaternion); }
    if (group.current) {
      group.current.rotation.y += ((mouse.current.x * 0.5) - group.current.rotation.y) * 0.04;
      group.current.rotation.x += ((mouse.current.y * 0.3) - group.current.rotation.x) * 0.04;
    }
    camera.position.x += (mouse.current.x * 0.6 - camera.position.x) * 0.03;
    camera.position.y += (-mouse.current.y * 0.4 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={group}>
      <points geometry={geo} material={mat} frustumCulled={false} />
      {lines.map((_, i) => (
        <group key={i} rotation={[0, 0, TILTS[i][1]]}><group rotation={[TILTS[i][0], 0, 0]}>
          <primitive object={lines[i]} />
        </group></group>
      ))}
      <mesh ref={starRef} material={starMat}><planeGeometry args={[1, 1]} /></mesh>
    </group>
  );
}

function webglOK() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

export default function OrbitScene({ progress, className, density = 1 }: { progress: MutableRefObject<SceneProgress>; className?: string; density?: number }) {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const small = typeof window !== "undefined" && window.innerWidth < 768;
  const count = Math.round((small ? 2600 : 6500) * density);
  const wrap = useRef<HTMLDivElement>(null);
  const visible = useRef(true);
  const ok = useMemo(webglOK, []);

  useEffect(() => {
    if (!wrap.current) return;
    const io = new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; });
    io.observe(wrap.current);
    return () => io.disconnect();
  }, []);

  if (!ok) return <div className={className}><img src="/logo-mark.webp" alt="" className="mx-auto mt-[20%] w-1/3 opacity-80" /></div>;
  return (
    <div ref={wrap} className={className} aria-hidden>
      <Canvas camera={{ position: [0, 0, 7.2], fov: 52 }} dpr={[1, 1.75]} gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        frameloop={reduced ? "demand" : "always"}>
        <Scene progress={progress} count={count} still={!!reduced} visible={visible} />
      </Canvas>
    </div>
  );
}
