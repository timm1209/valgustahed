/* Valgustähed — raam.js
   Raam: profiilid, pulgad, kinnitus- ja kaabliavad, raami osade loetelu.
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */
/* a moved bar takes the length the letters allow at its new height, then snaps to nearby posts */
function refitBar(b) { if (b.fixEnds) return; /* stretched by hand: keep its ends */ const ext = Core.barExtent(S.letters, b.y, b.h); if (!ext) return; const e = Core.barEnds(ext, cfg); if (e.x1 - e.x0 <= b.h) return; Object.assign(b, e); Core.snapBars([b], S.posts || []); }
function syncBarExt() { $("rowBarExt").hidden = !cfg.barExt; $("jointNote").hidden = !cfg.barExt; $("btnJointAuto").hidden = !(S.bars || []).some(b => b.jm); }
function refreshMounts() {
  updateDotPosts(); const del = S.mountDel || [];
  const auto = Core.mountHoles(S.letters, S.bars, cfg).concat(Core.dotHoles(S.posts || [], cfg), typeof railHoles === "function" ? railHoles() : []).filter(m => !del.some(d => Math.abs(d.x - m.x) < 1.5 && Math.abs(d.y - m.y) < 1.5));
  const man = (S.mountAdd || []).map(m => ({ x: m.x, y: m.y, L: letterAt(m.x, m.y), w: 0, man: true }));
  S.mounts = auto.concat(man); snapMounts(); placeCables();
}
/* manual screw hole: snapped to the centre line of the bar or post under the pointer */
function frameSnap(x, y) {
  const tol = 8 / view.s;
  for (const b of S.bars || []) if (x >= b.x0 && x <= b.x1 && Math.abs(y - b.y) <= b.h / 2 + tol) return { x: Math.round(x), y: b.y };
  for (const q of S.posts || []) for (const [lo, hi] of Core.postSegs(S.bars, q)) if (Math.abs(x - q.x) <= q.w / 2 + tol && y >= lo && y <= hi) return { x: q.x, y: Math.round(y) };
  /* free-angle profile: onto its centre line */
  for (const r of S.rails || []) { const g = railGeom(r), t = RV.dot(RV.sub([x, y], r.a), g.u), dn = Math.abs(RV.dot(RV.sub([x, y], r.a), g.n)); if (t >= 0 && t <= g.len && dn <= g.h + tol) { const p = RV.add(r.a, RV.mul(g.u, Math.round(t))); return { x: p[0], y: p[1] }; } }
  return null;
}
function mountAt(px, py) { if (!on("ly_mount")) return -1; const r = Math.max(8, cfg.mountD / 2 * view.s + 3); return (S.mounts || []).findIndex(m => Math.hypot(tx(m.x) - px, ty(m.y) - py) < r); }
/* bar end under the pointer (select tool): drag to stretch or shorten the profile */
function barEndAt(px, py) {
  if (!on("ly_frame")) return null;
  for (const b of S.bars || []) { const Y0 = ty(b.y + b.h / 2) - 4, Y1 = ty(b.y - b.h / 2) + 4; if (py < Y0 || py > Y1) continue;
    if (Math.abs(px - tx(b.x0)) <= 9) return { b, end: 0 }; if (Math.abs(px - tx(b.x1)) <= 9) return { b, end: 1 }; }
  return null;
}
/* P3: one cable hole per letter, 7 mm from the centre of the first mounting hole on the lowest bar (left side if it fits in the letter, else right) */
const CABLE_GAP = 7;
function placeCables() {
  S.cables = []; if (!anyP3()) return;
  S.letters.forEach((L, li) => { if (letterType(li) !== "p3") return;
    const ms = (S.mounts || []).filter(m => m.L === li && !m.dot); if (!ms.length) return;
    const yLow = Math.min(...ms.map(m => m.y)), m = ms.filter(q => Math.abs(q.y - yLow) < 0.01).sort((a, b) => a.x - b.x)[0];
    const r = (cfg.cableD || 8) / 2, fits = x => [[x - r, m.y], [x + r, m.y], [x, m.y - r], [x, m.y + r]].every(([px, py]) => Core.inLetter(L, px, py));
    const x = fits(m.x - CABLE_GAP) ? m.x - CABLE_GAP : fits(m.x + CABLE_GAP) ? m.x + CABLE_GAP : m.x - CABLE_GAP;
    S.cables.push({ x, y: m.y, L: li });
  });
}
/* hole positions moved (max 0,5 mm) so every dimension from its zero point is a whole number */
function snapMounts() {
  for (const b of S.bars || []) { const cuts = [b.x0, ...((b.j && b.j.xs) || []), b.x1];
    for (const m of S.mounts) { if (m.dot || Math.abs(m.y - b.y) > 0.01 || m.x < b.x0 - 0.01 || m.x > b.x1 + 0.01) continue;
      let k = 0; while (k < cuts.length - 2 && m.x >= cuts[k + 1]) k++; const x0 = cuts[k]; m.x = x0 + Math.round(m.x - x0); } }
  for (const q of S.posts || []) { if (q.dot == null || !q.seg) continue; const y0 = q.up !== false ? q.seg[0] : q.seg[1];
    for (const m of S.mounts) if (m.dot && Math.abs(m.x - q.x) < 0.01) m.y = y0 + Math.round(m.y - y0); }
}
function updateDotPosts() { for (const q of S.posts || []) if (q.dot != null && S.letters[q.dot]) q.seg = Core.dotSeg(S.letters[q.dot], S.bars, q); }
/* b.jm = joint places set by hand (dragged, added or removed): they replace the automatic ones of that bar */
const JOINT_MIN = 50;
function updateJoints() {
  if (typeof barRailCuts === "function") barRailCuts();
  if (!cfg.barExt) { for (const b of S.bars || []) b.j = null; return; }
  Core.frameJoints(S.letters, S.bars || [], cfg.barSegMax);
  for (const b of S.bars || []) if (b.jm) { const xs = b.jm.filter(x => x > b.x0 + JOINT_MIN - 1e-6 && x < b.x1 - JOINT_MIN + 1e-6).sort((p, q) => p - q); b.j = { xs, fail: false, man: true }; }
  if ($("btnJointAuto")) $("btnJointAuto").hidden = !(S.bars || []).some(b => b.jm);
}
/* joint line under the pointer (6 px on screen) */
function jointAt(px, py) {
  if (!on("ly_frame") || !cfg.barExt) return null;
  for (const b of S.bars || []) { if (!b.j) continue; const Y0 = ty(b.y + b.h / 2) - 6, Y1 = ty(b.y - b.h / 2) + 6; if (py < Y0 || py > Y1) continue;
    const k = b.j.xs.findIndex(x => Math.abs(px - tx(x)) <= 6); if (k >= 0) return { b, k }; }
  return null;
}
const jointParts = b => { const xs = [b.x0, ...b.j.xs, b.x1]; return xs.slice(1).map((x, i) => Math.round(x - xs[i])).join(" + "); };
function moveJoint(b, k, x, exact) {
  const xs = b.j.xs.slice(), lo = (k ? xs[k - 1] : b.x0) + JOINT_MIN, hi = (k < xs.length - 1 ? xs[k + 1] : b.x1) - JOINT_MIN;
  xs[k] = Math.min(Math.max(exact ? x : Math.round(x), lo), hi); b.jm = xs; b.j = { xs, fail: false, man: true };
}
function addJoint(b, x) {
  const xs = (b.j ? b.j.xs : []).slice(), cuts = [b.x0, ...xs, b.x1]; x = Math.round(x);
  if (cuts.some(c => Math.abs(c - x) < JOINT_MIN)) { toast(`Jätk peab olema vähemalt ${JOINT_MIN} mm kaugusel profiili otsast ja teisest jätkust.`); return false; }
  xs.push(x); xs.sort((p, q) => p - q); b.jm = xs; return true;
}
function removeJoint(b, k) { const xs = b.j.xs.slice(); xs.splice(k, 1); b.jm = xs; }
$("btnJointAuto").addEventListener("click", () => { snapshot(); for (const b of S.bars || []) delete b.jm; recompute(); toast("Jätkukohad paigutatud automaatselt."); });
const barPieces = () => (S.bars || []).reduce((n, b) => n + 1 + ((b.j && b.j.xs.length) || 0), 0);
/* gap between two neighbouring bars that both reach x and contain y */
function gapAt(x, y) {
  const bs = S.bars.filter(b => x >= b.x0 - cfg.profile && x <= b.x1 + cfg.profile).sort((a, b) => a.y - b.y);
  for (let i = 1; i < bs.length; i++) { const lo = bs[i - 1].y + bs[i - 1].h / 2, hi = bs[i].y - bs[i].h / 2; if (y >= lo && y <= hi) return { lo, hi }; }
  return null;
}
/* a post running through several gaps becomes one post per gap, so single pieces can be moved or removed */
function splitPost(q) {
  const segs = Core.postSegs(S.bars, q); if (q.y != null || segs.length < 2) return [q];
  const parts = segs.map(g => q.fixed ? { x: q.x, w: q.w, seg: g.slice(), fixed: true } : { x: q.x, w: q.w, y: (g[0] + g[1]) / 2 });
  const i = S.posts.indexOf(q); S.posts.splice(i, 1, ...parts); return parts;
}
function partAt(parts, y) { return parts.find(p => { const g = Core.postSegs(S.bars, p)[0]; return g && y >= g[0] - 1 && y <= g[1] + 1; }) || parts[0]; }
/* post above the top bar or below the bottom bar (or any bar, outside a gap): starts at the nearest bar and goes into the letter that was clicked */
function addFreePost(x, y) {
  const li = S.letters.findIndex(L => Core.inLetter(L, x, y)); if (li < 0) { toast("Kliki tähe sisse profiili kohale või alla, või kahe profiili vahele."); return; }
  const w = cfg.profile; const px = Core.snapPost(S.letters, S.bars, x, w, Math.max(3 * w, 60), y - w, y + w); if (px == null) return;
  const nq = { x: px, w, dot: li, ty: y, free: true }; nq.seg = Core.dotSeg(S.letters[li], S.bars, nq);
  if (!nq.seg) { toast("Siia ei saa pulka panna: selle koha all või kohal pole profiili."); return; }
  if ((S.posts || []).some(q => q !== nq && Math.abs(q.x - px) < w && Core.postSegs(S.bars, q).some(g => g[0] < nq.seg[1] && g[1] > nq.seg[0]))) { toast("Siin on pulk juba olemas."); return; }
  snapshot(); S.posts = (S.posts || []).concat([nq]); S.manual = true;
  S.sel = { k: "post", i: S.posts.indexOf(nq) }; S.multi = [nq]; recompute(); toast(`Pulk lisatud profiilist ${nq.up ? "üles" : "alla"} (${Math.round(nq.seg[1] - nq.seg[0])} mm)`);
}
function removePostAt(q, y) { const parts = splitPost(q); const p = partAt(parts, y); S.posts.splice(S.posts.indexOf(p), 1); }
/* frame profile size: existing bars and posts keep their places, only the section changes */
function syncFrameProf() { const sel = $("s_frameProf"); if (!sel) return; const v = String(cfg.profile); sel.value = [...sel.options].some(o => o.value === v) ? v : ""; }
function setFrameSize(v) {
  cfg.profile = v; saveCfg(); $("s_profile").value = v; syncFrameProf();
  if (S.bars && S.bars.length) { snapshot(); for (const b of S.bars) { b.h = v; refitBar(b); } for (const q of S.posts || []) q.w = v; Core.snapBars(S.bars, S.posts || []); }
  recompute(); toast(`Raamiprofiil ${v} × ${v} mm`);
}
function renderAlign() { const n = (S.multi || []).filter(q => S.posts.includes(q)).length; const b = $("btnAlign"); if (!b) return; b.disabled = n < 2; b.textContent = n >= 2 ? `Joonda valitud pulgad ühele joonele (${n})` : "Joonda valitud pulgad ühele joonele"; }
function alignPosts() {
  const list = (S.multi || []).filter(q => S.posts.includes(q)); if (list.length < 2) { toast("Vali Ctrl-klõpsuga vähemalt kaks pulka."); return; }
  snapshot(); const x = list[0].x; for (const q of list) q.x = x; Core.snapBars(S.bars, list); S.manual = true; recompute(); toast(`${list.length} pulka joondatud ühele joonele`);
}
function postAt(x, y) { if (!on("ly_frame")) return -1; return (S.posts || []).findIndex(q => Math.abs(x - q.x) <= q.w / 2 && Core.postSegs(S.bars, q).some(g => y >= g[0] && y <= g[1])); }
function barAt(x, y) { if (!on("ly_frame")) return -1; return S.bars.findIndex(b => x >= b.x0 && x <= b.x1 && Math.abs(y - b.y) <= b.h / 2); }

$("btnAlign").addEventListener("click", alignPosts);
$("s_frameProf").addEventListener("change", e => { if (!e.target.value) { $("s_profile").focus(); return; } setFrameSize(+e.target.value); });

/* frame workshop drawing: profiles and posts only, with lengths, post positions, height and the cutting list */
const MAT_ABBR = { alumiinium: "AL", "tsingitud teras": "Zn", "roostevaba teras": "RST", "teras, pulbervärvitud": "teras" };
function frameMaterialLine() { const m = (S.order && S.order.frameMat || "").trim(), a = MAT_ABBR[m.toLowerCase()] || m; const p = cfg.profile; const n = [30, 25, 20].includes(+p) ? `U${p}x${p}mm` : `Profiil ${p}x${p}mm`; return a ? `${n} ${a}` : n; }
function frameCutList() {
  const L = [];
  for (const b of S.bars || []) { if (b.ea || b.eb) { for (const pc of barPieces2(b)) if (!pc.angA && !pc.angB) L.push(Math.round(pc.long)); continue; } const xs = [b.x0, ...((b.j && b.j.xs) || []), b.x1]; for (let i = 1; i < xs.length; i++) L.push(Math.round(xs[i] - xs[i - 1])); }
  for (const q of S.posts || []) for (const [lo, hi] of Core.postSegs(S.bars, q)) L.push(Math.round(hi - lo));
  const cnt = new Map(); for (const v of L) if (v > 0) cnt.set(v, (cnt.get(v) || 0) + 1);
  return [...cnt.entries()].sort((a, b) => b[0] - a[0]);
}
/* Raami jätk splits the frame into separate ladders (one per piece); they are drawn under each other,
   left-aligned, with all height dimensions in one column and every chain on one line */
function frameParts() {
  const bars = S.bars || [], ref = bars.reduce((a, b) => ((b.j && b.j.xs.length) || 0) > ((a && a.j && a.j.xs.length) || 0) ? b : a, bars[0]);
  const rc = (ref && ref.j && ref.j.xs) || [], n = rc.length + 1, parts = Array.from({ length: n }, () => ({ bars: [], segs: [] }));
  const partOf = x => { let k = 0; while (k < rc.length && x > rc[k]) k++; return k; };
  for (const b of bars) {
    const xs = (b.j && b.j.xs) || [];
    if (xs.length === rc.length) { const c = [b.x0, ...xs, b.x1]; for (let k = 0; k < n; k++) if (c[k + 1] - c[k] > 1) parts[k].bars.push({ x0: c[k], x1: c[k + 1], y: b.y, h: b.h, ea: k === 0 ? b.ea : null, eb: k === n - 1 ? b.eb : null }); }
    else parts[partOf((b.x0 + b.x1) / 2)].bars.push({ x0: b.x0, x1: b.x1, y: b.y, h: b.h, ea: b.ea, eb: b.eb });
  }
  for (const q of S.posts || []) for (const sg of Core.postSegs(bars, q)) parts[partOf(q.x)].segs.push({ x: q.x, w: q.w, lo: sg[0], hi: sg[1] });
  return parts.filter(p => p.bars.length);
}

function frameProfileName() { const p = cfg.profile; return [30, 25, 20].includes(+p) ? `U${p}x${p}` : `profiil ${p}×${p} mm`; }
