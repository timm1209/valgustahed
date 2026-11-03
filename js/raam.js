/* Valgustähed — raam.js
   Raam: profiilid, pulgad, kinnitus- ja kaabliavad, raami osade loetelu.
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */
/* a moved bar takes the length the letters allow at its new height, then snaps to nearby posts */
function refitBar(b) { if (b.fixEnds) return; /* stretched by hand: keep its ends */ const ext = Core.barExtent(S.letters, b.y, b.h); if (!ext) return; const e = Core.barEnds(ext, cfg); if (e.x1 - e.x0 <= b.h) return; Object.assign(b, e); Core.snapBars([b], S.posts || []); }
function syncBarExt() { $("rowBarExt").hidden = !cfg.barExt; }
function refreshMounts() {
  updateDotPosts(); const del = S.mountDel || [];
  const auto = Core.mountHoles(S.letters, S.bars, cfg).concat(Core.dotHoles(S.posts || [], cfg)).filter(m => !del.some(d => Math.abs(d.x - m.x) < 1.5 && Math.abs(d.y - m.y) < 1.5));
  const man = (S.mountAdd || []).map(m => ({ x: m.x, y: m.y, L: letterAt(m.x, m.y), w: 0, man: true }));
  S.mounts = auto.concat(man); snapMounts(); placeCables();
}
/* manual screw hole: snapped to the centre line of the bar or post under the pointer */
function frameSnap(x, y) {
  const tol = 8 / view.s;
  for (const b of S.bars || []) if (x >= b.x0 && x <= b.x1 && Math.abs(y - b.y) <= b.h / 2 + tol) return { x: Math.round(x), y: b.y };
  for (const q of S.posts || []) for (const [lo, hi] of Core.postSegs(S.bars, q)) if (Math.abs(x - q.x) <= q.w / 2 + tol && y >= lo && y <= hi) return { x: q.x, y: Math.round(y) };
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
function updateJoints() { if (cfg.barExt) Core.frameJoints(S.letters, S.bars || [], cfg.barSegMax); else for (const b of S.bars || []) b.j = null; }
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
  const parts = segs.map(g => ({ x: q.x, w: q.w, y: (g[0] + g[1]) / 2 }));
  const i = S.posts.indexOf(q); S.posts.splice(i, 1, ...parts); return parts;
}
function partAt(parts, y) { return parts.find(p => { const g = Core.postSegs(S.bars, p)[0]; return g && y >= g[0] - 1 && y <= g[1] + 1; }) || parts[0]; }
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
  for (const b of S.bars || []) { const xs = [b.x0, ...((b.j && b.j.xs) || []), b.x1]; for (let i = 1; i < xs.length; i++) L.push(Math.round(xs[i] - xs[i - 1])); }
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
    if (xs.length === rc.length) { const c = [b.x0, ...xs, b.x1]; for (let k = 0; k < n; k++) if (c[k + 1] - c[k] > 1) parts[k].bars.push({ x0: c[k], x1: c[k + 1], y: b.y, h: b.h }); }
    else parts[partOf((b.x0 + b.x1) / 2)].bars.push({ x0: b.x0, x1: b.x1, y: b.y, h: b.h });
  }
  for (const q of S.posts || []) for (const sg of Core.postSegs(bars, q)) parts[partOf(q.x)].segs.push({ x: q.x, w: q.w, lo: sg[0], hi: sg[1] });
  return parts.filter(p => p.bars.length);
}

function frameProfileName() { const p = cfg.profile; return [30, 25, 20].includes(+p) ? `U${p}x${p}` : `profiil ${p}×${p} mm`; }
