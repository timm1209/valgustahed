/* Valgustähed — vaade3d.js
   3D-vaade (three.js).
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */

/* ===================== 3D VIEW ===================== */
var T3 = { on: false, ready: null, r: null, scene: null, cam: null, ctl: null, group: null, timer: null, fitted: false };
const loadScript = src => new Promise((res, rej) => { const el = document.createElement("script"); el.src = src; el.onload = res; el.onerror = () => rej(new Error(src)); document.head.appendChild(el); });
function ensureThree() {
  if (!T3.ready) T3.ready = (window.THREE ? Promise.resolve() : loadScript("lib/three.min.js"))
    .then(() => window.THREE.OrbitControls ? null : loadScript("lib/OrbitControls.js"));
  return T3.ready;
}
async function set3D(on) {
  T3.on = on; $("m2d").classList.toggle("on", !on); $("m3d").classList.toggle("on", on);
  $("v3d").hidden = !on; $("v3dPanel").hidden = !on; $("cv").hidden = on; $("tools").hidden = on; $("hint").hidden = on;
  if (!on) { draw(); return; }
  try { await ensureThree(); } catch (e) { $("v3dMsg").textContent = "3D-teek ei laadinud. Kontrolli internetiühendust."; return; }
  if (!T3.on) return; init3D(); build3D(); if (!T3.fitted) fit3D(); render3D();
}
function init3D() {
  if (T3.r) return; const host = $("v3d"); $("v3dMsg").hidden = true;
  const r = new THREE.WebGLRenderer({ antialias: true }); r.setPixelRatio(window.devicePixelRatio || 1); host.appendChild(r.domElement); T3.r = r;
  T3.scene = new THREE.Scene(); T3.cam = new THREE.PerspectiveCamera(30, 1, 1, 1e7);
  const hl = new THREE.HemisphereLight(0xffffff, 0x8090a0, 0.75); T3.scene.add(hl);
  const d1 = new THREE.DirectionalLight(0xffffff, 0.75); d1.position.set(0.6, -0.8, 1.4); T3.scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xffffff, 0.35); d2.position.set(-1, 0.6, -0.8); T3.scene.add(d2);
  T3.lights = [[hl, 0.75], [d1, 0.75], [d2, 0.35]];
  T3.ctl = new THREE.OrbitControls(T3.cam, r.domElement); T3.ctl.enableDamping = false; T3.ctl.addEventListener("change", render3D);
  resize3D();
}
function resize3D() { if (!T3.r) return; const w = stage.clientWidth, h = stage.clientHeight; T3.r.setSize(w, h, false); T3.cam.aspect = w / Math.max(1, h); T3.cam.updateProjectionMatrix(); render3D(); }
function render3D() { if (T3.r && T3.on) { const bg = new THREE.Color(cfg.glow3d ? 0x3a424b : 0xbfc6cc); /* fixed on every computer and theme: mid grey by day, dark night view when the LEDs are lit */ T3.scene.background = bg; for (const [l, k] of T3.lights || []) l.intensity = cfg.glow3d ? k * 0.45 : k; /* night: dim daylight so the lit face stands out */ T3.r.render(T3.scene, T3.cam); } }
function schedule3D() { if (!T3 || !T3.on || !T3.r) return; clearTimeout(T3.timer); T3.timer = setTimeout(() => { build3D(); render3D(); }, 120); }
function pipXY(x, y, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
/* closed loops -> THREE.Shapes: even nesting depth = outline, odd = hole of the loop around it */
function shapesOf(loops) {
  const L = loops.filter(l => l && l.length >= 3).map(l => { const p = Core.exportLoop(l, "lines", 0.05).pts; return { p, a: Math.abs(Core.area(p)) }; }).filter(o => o.p.length >= 3 && o.a > 0.01).sort((a, b) => b.a - a.a);
  L.forEach((o, i) => { o.depth = 0; o.parent = -1; for (let j = 0; j < i; j++) if (L[j].a > o.a && pipXY(o.p[0][0], o.p[0][1], L[j].p)) { o.depth++; o.parent = j; } });
  const shapes = new Map();
  L.forEach((o, i) => { if (o.depth % 2 === 0) shapes.set(i, new THREE.Shape(o.p.map(q => new THREE.Vector2(q[0], q[1])))); });
  L.forEach(o => { if (o.depth % 2 === 1 && shapes.has(o.parent)) shapes.get(o.parent).holes.push(new THREE.Path(o.p.map(q => new THREE.Vector2(q[0], q[1])))); });
  return [...shapes.values()];
}
const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.15, side: THREE.DoubleSide }, extra || {}));
function addExtrude(g, shapes, depth, z, m) { if (!shapes.length) return; const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: 1 }); const mesh = new THREE.Mesh(geo, m); mesh.position.z = z; g.add(mesh); }
function build3D() {
  if (!T3.r) return;
  if (T3.group) { T3.scene.remove(T3.group); T3.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
  const g = new THREE.Group(); T3.group = g; T3.scene.add(g);
  const D = Math.max(10, +cfg.depth3d || 100), tb = 2, pd = cfg.profile || 30;
  const mFrame = mat(colorOf(S.order.frameColor) || 0xc4cad0, { metalness: 0.4 }), mCache = new Map();
  (S.prof || []).forEach((p, pi) => {
    if (!p) return;
    /* colours of the part (osa) this letter belongs to; the base is painted together with the returns */
    const D = Math.max(10, depthOf(pi)), G = grpOf(pi), sideCol = colorOf(G.sideColor) || 0x30373e, faceCol = colorOf(G.faceColor) || 0xffffff;
    if (!mCache.has(sideCol)) mCache.set(sideCol, mat(sideCol, { roughness: 0.45 })); const mBase = mCache.get(sideCol), mWall = mBase;
    if (on("ly_base") && p.base) addExtrude(g, shapesOf(p.base), tb, 0, mBase);
    if (on("ly_side") && p.cont && p.side) addExtrude(g, shapesOf(Core.diffLoops(p.cont, p.side)), D, 0, mWall);
    if (p.type === "p3" && on("ly_cont") && p.cont) {
      /* P3: aluminium face, light goes backwards through the back panel and lights the wall around the letter */
      addExtrude(g, shapesOf(p.cont), 3, D, mat(faceCol, { roughness: 0.4, metalness: 0.35 }));
      if (cfg.glow3d) for (const d of [3, 7, 12, 18, 25, 33, 42, 52, 63]) { const ring = Core.offsetLoops(p.cont, d); if (!ring || !ring.length) continue;
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shapesOf(ring)), new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        mesh.position.z = -2; mesh.renderOrder = 2; g.add(mesh); }
    } else if (cfg.face3d && on("ly_cont") && p.cont) {
      if (cfg.glow3d) {
        /* lit: the face is self-lit at full brightness, plus a soft additive halo around it (bloom of the light) */
        addExtrude(g, shapesOf(p.cont), 3, D, new THREE.MeshBasicMaterial({ color: new THREE.Color(faceCol).lerp(new THREE.Color(0xffffff), 0.25), side: THREE.DoubleSide }));
        for (const d of [1, 2.5, 4, 6, 8.5, 11, 14, 18, 23, 29, 36]) { const op = 0.045; /* many faint layers add up to a smooth falloff */
          const ring = Core.offsetLoops(p.cont, d); if (!ring || !ring.length) continue;
          const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shapesOf(ring)), new THREE.MeshBasicMaterial({ color: faceCol, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
          mesh.position.z = D + 3.2; mesh.renderOrder = 2; g.add(mesh);
        }
      } else addExtrude(g, shapesOf(p.cont), 3, D, new THREE.MeshStandardMaterial({ color: new THREE.Color(faceCol).multiplyScalar(0.82), transparent: true, opacity: 0.94, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }) /* opal: matte, almost opaque */);
    }
  });
  if (on("ly_frame")) {
    for (const b of S.bars || []) { if (b.ea || b.eb) { const sh = new THREE.Shape(barPoly(b).map(p => new THREE.Vector2(p[0], p[1]))), m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: pd, bevelEnabled: false }), mFrame); m.position.z = -pd; g.add(m); continue; }
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0, b.h, pd), mFrame); m.position.set((b.x0 + b.x1) / 2, b.y, -pd / 2); g.add(m); }
    for (const q of S.posts || []) for (const [lo, hi] of Core.postSegs(S.bars, q)) { const m = new THREE.Mesh(new THREE.BoxGeometry(q.w, hi - lo, pd), mFrame); m.position.set(q.x, (lo + hi) / 2, -pd / 2); g.add(m); }
    if (typeof railMeshes === "function") railMeshes(g, mFrame, pd);
  }
  if (on("ly_led") && S.leds && S.leds.length) {
    const geo = new THREE.BoxGeometry(1, 1, 1), m = new THREE.MeshStandardMaterial({ color: cfg.glow3d ? 0xffffff : 0xd8d8d8, emissive: cfg.glow3d ? 0xffe2b0 : 0x000000, emissiveIntensity: cfg.glow3d ? 1 : 0 });
    const inst = new THREE.InstancedMesh(geo, m, S.leds.length), o = new THREE.Object3D();
    S.leds.forEach((l, i) => { const t = cfg.types[l.t] || cfg.types[0]; o.position.set(l.x, l.y, tb + 2); o.rotation.set(0, 0, l.a || 0); o.scale.set(Math.max(4, t.dash), 7, 4); o.updateMatrix(); inst.setMatrixAt(i, o.matrix); });
    g.add(inst);
  }
}
function fit3D() {
  if (!T3.group) return; const box = new THREE.Box3().setFromObject(T3.group); if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  const vf = T3.cam.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * T3.cam.aspect);
  const dist = Math.max((sz.x / 2) / Math.tan(hf / 2), (sz.y / 2) / Math.tan(vf / 2)) * 1.25 + sz.z;
  T3.cam.near = Math.max(1, dist / 500); T3.cam.far = dist * 50; T3.cam.updateProjectionMatrix();
  const dir = new THREE.Vector3(0.28, -0.32, 1).normalize(); /* slightly from the lower right, so the returns show */
  T3.cam.position.copy(c).addScaledVector(dir, dist); T3.ctl.target.copy(c); T3.ctl.update(); T3.fitted = true; render3D();
}
$("m2d").addEventListener("click", () => set3D(false));
$("m3d").addEventListener("click", () => set3D(true));
$("s_depth").value = cfg.depth3d; $("s_face").checked = cfg.face3d; $("s_glow").checked = cfg.glow3d;
$("s_depth").addEventListener("change", e => { const v = parseFloat(String(e.target.value).replace(",", ".")); if (!(v > 0)) { e.target.value = cfg.depth3d; return; } cfg.depth3d = v; saveCfg(); schedule3D(); });
$("s_face").addEventListener("change", e => { cfg.face3d = e.target.checked; saveCfg(); schedule3D(); });
$("s_glow").addEventListener("change", e => { cfg.glow3d = e.target.checked; saveCfg(); schedule3D(); });
new ResizeObserver(() => { resize(); resize3D(); }).observe(stage);
try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { readColors(); draw(); }); new MutationObserver(() => { readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); } catch (e) {}
