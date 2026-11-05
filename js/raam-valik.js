/* Valgustähed — raam-valik.js
   Raami osa valikud: klõps profiilil, pulgal või nurga all profiilil (valiku tööriist) avab väikese akna:
   kinnitusavad sellel osal (jah/ei), magnetiline ühendus ristuvate raamidega (jah/ei), osa kustutamine.
   Kinnitusava saab valida klõpsuga ja kustutada Delete-klahviga või aknast.
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */
const FP = { piece: null };
/* frame piece at a model point: angled profile, post or horizontal profile */
function pieceAt(x, y) {
  const ri = railAt(x, y); if (ri >= 0) return { k: "rail", o: S.rails[ri] };
  const pi = postAt(x, y); if (pi >= 0) return { k: "post", o: S.posts[pi], y };
  const bi = barAt(x, y); if (bi >= 0) return { k: "bar", o: S.bars[bi] };
  return null;
}
/* does the piece get automatic holes now (explicit choice, else the usual rule) */
function pieceHolesOn(p) {
  const o = p.o; if (o.holes != null) return o.holes;
  if (p.k === "post") return o.dot != null || !!o.fixed; /* posts between two bars: no holes by default */
  return true;
}
/* holes lying on the piece (centre line within half the profile width) */
function holesOnPiece(p) {
  const o = p.o, ms = S.mounts || [];
  if (p.k === "bar") return ms.filter(m => Math.abs(m.y - o.y) < o.h / 2 + 0.5 && m.x >= o.x0 - 0.5 && m.x <= o.x1 + 0.5);
  if (p.k === "post") return ms.filter(m => Math.abs(m.x - o.x) < o.w / 2 + 0.5 && Core.postSegs(S.bars, o).some(g => m.y >= g[0] - 0.5 && m.y <= g[1] + 0.5));
  const g = railGeom(o); return ms.filter(m => inPoly([m.x, m.y], g.poly));
}
function pieceName(p) {
  const o = p.o;
  if (p.k === "bar") return `Horisontaalne profiil · ${Math.round(o.x1 - o.x0)} mm`;
  if (p.k === "post") return `Vertikaalne pulk · ${Core.postSegs(S.bars, o).map(g => Math.round(g[1] - g[0])).join(" + ")} mm`;
  const g = railGeom(o); return `Profiil nurga all · ${Math.round(g.long)} mm` + (g.angA || g.angB ? ` · ${railDeg(g.angA)}/${railDeg(g.angB)}` : "");
}
function fpOpen(p, px, py) {
  FP.piece = p; const el = $("framePop"), st = $("stage").getBoundingClientRect(), n = holesOnPiece(p).length;
  $("fpTitle").textContent = pieceName(p);
  $("fpHoles").checked = pieceHolesOn(p); $("fpLink").checked = p.o.link !== false;
  $("fpHoleInfo").textContent = n ? `${n} kinnitusava` : "kinnitusavasid pole";
  $("fpDelHoles").disabled = !n; $("fpRestore").hidden = !(S.mountDel || []).length;
  el.hidden = false; const w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = Math.max(8, Math.min(px + 14, st.width - w - 8)) + "px"; el.style.top = Math.max(8, Math.min(py + 14, st.height - h - 8)) + "px";
}
function fpClose() { $("framePop").hidden = true; FP.piece = null; }
function fpRefresh() { if (!FP.piece) return; const p = FP.piece, n = holesOnPiece(p).length; $("fpTitle").textContent = pieceName(p); $("fpHoleInfo").textContent = n ? `${n} kinnitusava` : "kinnitusavasid pole"; $("fpDelHoles").disabled = !n; $("fpRestore").hidden = !(S.mountDel || []).length; }
/* holes on/off for the piece; switching off also removes the holes added by hand on it */
function fpSetHoles(on) {
  const p = FP.piece; if (!p) return; snapshot();
  if (!on) { const hs = holesOnPiece(p).filter(m => m.man); S.mountAdd = (S.mountAdd || []).filter(a => !hs.some(m => Math.hypot(a.x - m.x, a.y - m.y) < 1.5)); }
  p.o.holes = on; S.manual = true; recompute(); fpRefresh(); toast(on ? "Kinnitusavad sellel osal sees" : "Kinnitusavad sellelt osalt eemaldatud");
}
/* magnetic connection with crossing frame pieces: ends snap / cut / follow; off = the piece stays exactly as it is */
function fpSetLink(on) {
  const p = FP.piece; if (!p) return; snapshot();
  if (!on && p.k === "post" && !p.o.fixed && p.o.dot == null) { /* a post between bars keeps its present span */
    const parts = splitPost(p.o), q = partAt(parts, p.y != null ? p.y : 0), g = Core.postSegs(S.bars, q)[0];
    if (g) { const i = S.posts.indexOf(q), nq = { x: q.x, w: q.w, seg: g.slice(), fixed: true, holes: q.holes }; S.posts.splice(i, 1, nq); p.o = nq; } }
  if (!on && p.k === "post" && p.o.dot != null) { const q = p.o, nq = { x: q.x, w: q.w, seg: q.seg ? q.seg.slice() : null, fixed: true, holes: q.holes != null ? q.holes : true }; if (nq.seg) { S.posts.splice(S.posts.indexOf(q), 1, nq); p.o = nq; } }
  p.o.link = on; S.manual = true; recompute(); fpRefresh(); toast(on ? "Osa on ühendatud ristuvate raamidega" : "Osa ei ole enam ristuvate raamidega ühendatud");
}
function fpDeleteHoles() {
  const p = FP.piece; if (!p) return; const hs = holesOnPiece(p); if (!hs.length) return; snapshot();
  for (const m of hs) { if (m.man) S.mountAdd = (S.mountAdd || []).filter(a => Math.hypot(a.x - m.x, a.y - m.y) > 1.5); else S.mountDel = (S.mountDel || []).concat([{ x: m.x, y: m.y }]); }
  S.manual = true; recompute(); fpRefresh(); toast(`${hs.length} kinnitusava kustutatud`);
}
function fpDelete() {
  const p = FP.piece; if (!p) return; snapshot();
  if (p.k === "bar") S.bars.splice(S.bars.indexOf(p.o), 1); else if (p.k === "rail") S.rails.splice(S.rails.indexOf(p.o), 1); else removePostAt(p.o, p.y != null ? p.y : 0);
  S.sel = null; S.multi = []; S.manual = true; fpClose(); recompute(); toast("Raami osa kustutatud");
}
/* one hole deleted (Delete key on a selected hole) */
function deleteMount(i) {
  const m = S.mounts[i]; if (!m) return; snapshot();
  if (m.man) S.mountAdd = (S.mountAdd || []).filter(a => Math.hypot(a.x - m.x, a.y - m.y) > 1.5); else S.mountDel = (S.mountDel || []).concat([{ x: m.x, y: m.y }]);
  S.sel = null; S.manual = true; recompute(); toast("Kinnitusava kustutatud");
}
/* auto holes deleted earlier come back */
function restoreMounts() { if (!(S.mountDel || []).length) return; snapshot(); const n = S.mountDel.length; S.mountDel = []; S.manual = true; recompute(); fpRefresh(); toast(`${n} kustutatud kinnitusava taastatud`); }

$("fpHoles").addEventListener("change", e => fpSetHoles(e.target.checked));
$("fpLink").addEventListener("change", e => fpSetLink(e.target.checked));
$("fpDelHoles").addEventListener("click", fpDeleteHoles);
$("fpDel").addEventListener("click", fpDelete);
$("fpClose").addEventListener("click", fpClose);
$("fpRestore").addEventListener("click", restoreMounts);
window.addEventListener("keydown", e => { if (e.key === "Escape" && !$("framePop").hidden) fpClose(); });
