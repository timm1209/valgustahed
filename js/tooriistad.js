/* Valgustähed — tooriistad.js
   Tööriistad ja hiir: valimine, lohistamine, LED/ava/raami lisamine, kiirklahvid.
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */

/* ---------- interaction ---------- */
function letterAt(x, y) { for (let i = S.letters.length - 1; i >= 0; i--) if (Core.inLetter(S.letters[i], x, y)) return i; return -1; }
function hit(px, py) {
  if (on("ly_led")) for (let i = S.leds.length - 1; i >= 0; i--) { const l = S.leds[i]; if (Math.hypot(tx(l.x) - px, ty(l.y) - py) < 9) return { k: "led", i }; }
  if (on("ly_hole")) for (let i = S.holes.length - 1; i >= 0; i--) { const h = S.holes[i]; if (Math.hypot(tx(h.x) - px, ty(h.y) - py) < Math.max(8, cfg.holeD / 2 * view.s + 3)) return { k: "hole", i }; }
  return null;
}

let drag = null; const pointers = new Map();
cv.addEventListener("pointerdown", e => {
  cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; drag = { k: "pinch", d: Math.hypot(a.x - b.x, a.y - b.y), s: view.s }; return; }
  const px = e.offsetX, py = e.offsetY, x = wx(px), y = wy(py);
  if (e.button === 1 || e.button === 2) { drag = { k: "pan", px, py, cx: view.cx, cy: view.cy }; return; }
  if (S.tool === "measure") { const p = measPoint(px, py, e.shiftKey); if (!S.meas || S.meas.done) S.meas = { a: p, b: p, done: false }; else { S.meas.b = p; S.meas.done = true; } draw(); return; }
  if (S.tool === "led") { const li = letterAt(x, y); if (li < 0) { toast("LED-i saab lisada ainult kuju sisse."); return; } snapshot(); const t = typeOf(S.letters[li]); S.leds.push({ x, y, a: 0, t, L: li }); S.manual = true; S.sel = { k: "led", i: S.leds.length - 1 }; recompute(); return; }
  if (S.tool === "bar") {
    const h = cfg.profile; if ((S.bars || []).some(b => Math.abs(b.y - y) < h * 1.2)) { toast("Siin on profiil juba olemas."); return; }
    const b = { x0: 0, x1: 0, y, h }; const ext = Core.barExtent(S.letters, y, h);
    if (!ext) { toast("Sellel kõrgusel ei ole tähti, millele profiil kinnituks."); return; }
    Object.assign(b, Core.barEnds(ext, cfg));
    if (b.x1 - b.x0 <= h) { toast("Profiil jääks sellel kõrgusel liiga lühikeseks."); return; }
    snapshot(); Core.snapBars([b], S.posts || []); S.bars.push(b); S.manual = true; S.sel = { k: "bar", i: S.bars.length - 1 }; recompute(); toast(`Profiil lisatud (${Math.round(b.x1 - b.x0)} mm)`); return;
  }
  if (S.tool === "post") {
    if (!S.bars.length) { toast("Pulga jaoks on vaja vähemalt üht horisontaalset profiili."); return; }
    const gap = gapAt(x, y); if (!gap) { addFreePost(x, y); return; }
    const w = cfg.profile, gy = (gap.lo + gap.hi) / 2; let px = Core.snapPost(S.letters, S.bars, x, w, Math.max(3 * w, 60), gap.lo, gap.hi); if (px == null) return;
    const inGap = q => Core.postSegs(S.bars, q).some(g => gy >= g[0] && gy <= g[1]);
    if ((S.posts || []).some(q => inGap(q) && Math.abs(q.x - px) < w)) { toast("Siin on pulk juba olemas."); return; }
    /* line it up with a post in another row when that one is close by */
    const near = (S.posts || []).filter(q => !inGap(q) && Math.abs(q.x - px) < w * 1.5).sort((a, b) => Math.abs(a.x - px) - Math.abs(b.x - px))[0]; let aligned = false;
    if (near) { px = near.x; aligned = true; }
    snapshot(); const nq = { x: px, w, y: gy }; S.posts = (S.posts || []).concat([nq]); Core.snapBars(S.bars, [nq]); S.manual = true;
    S.sel = { k: "post", i: S.posts.indexOf(nq) }; S.multi = [nq]; recompute(); toast(aligned ? "Pulk lisatud ja joondatud teise rea pulgaga" : "Pulk lisatud"); return;
  }
  if (S.tool === "hole") { const li = letterAt(x, y); if (li < 0) { toast("Veeauk peab olema kuju sees."); return; } snapshot(); S.holes.push({ x, y, L: li }); S.manual = true; recompute(); return; }
  if (S.tool === "screw") { const p = frameSnap(x, y); if (!p) { toast("Kinnitusava peab olema raamil (profiili või pulga peal)."); return; } snapshot(); S.mountAdd = (S.mountAdd || []).concat([p]); S.manual = true; recompute(); toast("Kinnitusava lisatud"); return; }
  const be = S.tool === "select" ? barEndAt(px, py) : null;
  if (be) { S.sel = { k: "bar", i: S.bars.indexOf(be.b) }; snapshot(); drag = { k: "barEnd", b: be.b, end: be.end, moved: false }; draw(); return; }
  const h = hit(px, py);
  if (S.tool === "delete") { const mi = mountAt(px, py); if (mi >= 0) { snapshot(); const m = S.mounts[mi]; if (m.man) S.mountAdd = (S.mountAdd || []).filter(a => Math.hypot(a.x - m.x, a.y - m.y) > 1.5); else S.mountDel = (S.mountDel || []).concat([{ x: m.x, y: m.y }]); S.manual = true; recompute(); toast("Kinnitusava kustutatud"); return; }
    if (h) { snapshot(); (h.k === "led" ? S.leds : S.holes).splice(h.i, 1); S.manual = true; S.sel = null; recompute(); return; } const pi = postAt(x, y); if (pi >= 0) { snapshot(); removePostAt(S.posts[pi], y); S.multi = []; S.manual = true; recompute(); return; } const bi = barAt(x, y); if (bi >= 0) { snapshot(); S.bars.splice(bi, 1); S.manual = true; recompute(); return; } drag = { k: "pan", px, py, cx: view.cx, cy: view.cy }; return; }
  if (h) { S.sel = h; const o = (h.k === "led" ? S.leds : S.holes)[h.i]; snapshot(); drag = { k: "move", o, dx: o.x - x, dy: o.y - y, moved: false }; draw(); return; }
  const frameOk = e.shiftKey || letterAt(x, y) < 0;
  const pi = postAt(x, y);
  if (pi >= 0 && (e.ctrlKey || e.metaKey)) { const q = S.posts[pi]; S.multi = S.multi || []; const k = S.multi.indexOf(q); if (k >= 0) S.multi.splice(k, 1); else S.multi.push(q); S.sel = { k: "post", i: pi, y }; renderAlign(); draw(); return; }
  if (pi >= 0 && frameOk) { S.sel = { k: "post", i: pi, y }; S.multi = [S.posts[pi]]; renderAlign(); snapshot(); drag = { k: "post", q: S.posts[pi], dx: S.posts[pi].x - x, moved: false }; draw(); return; }
  const bi = barAt(x, y); if (bi >= 0 && frameOk) { S.sel = { k: "bar", i: bi }; snapshot(); drag = { k: "bar", b: S.bars[bi], dy: S.bars[bi].y - y, moved: false }; draw(); return; }
  drag = { k: "pan", px, py, cx: view.cx, cy: view.cy, click: true, x, y };
});
cv.addEventListener("pointermove", e => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
  const x = wx(e.offsetX), y = wy(e.offsetY); $("stCursor").textContent = `X ${x.toFixed(1)} · Y ${y.toFixed(1)} mm`;
  if (S.tool === "select" && !drag) cv.style.cursor = barEndAt(e.offsetX, e.offsetY) ? "ew-resize" : "default";
  if (S.tool === "measure" && !drag) { const p = measPoint(e.offsetX, e.offsetY, e.shiftKey); S.measHover = p; if (S.meas && !S.meas.done) S.meas.b = p; draw(); return; }
  if (!drag) return;
  if (drag.k === "pinch" && pointers.size === 2) { const [a, b] = [...pointers.values()]; view.s = drag.s * Math.hypot(a.x - b.x, a.y - b.y) / (drag.d || 1); draw(); return; }
  if (drag.k === "pan") { const dx = e.offsetX - drag.px, dy = e.offsetY - drag.py; if (Math.abs(dx) + Math.abs(dy) > 3) drag.click = false; view.cx = drag.cx - dx / view.s; view.cy = drag.cy + dy / view.s; draw(); }
  else if (drag.k === "move") { drag.o.x = x + drag.dx; drag.o.y = y + drag.dy; drag.moved = true; draw(); }
  else if (drag.k === "barEnd") { const b = drag.b, xr = Math.round(x); if (drag.end === 0) b.x0 = Math.min(xr, b.x1 - b.h * 2); else b.x1 = Math.max(xr, b.x0 + b.h * 2); b.fixEnds = true; updateJoints(); refreshMounts(); drag.moved = true; $("hint").textContent = `Profiili pikkus ${Math.round(b.x1 - b.x0)} mm`; draw(); }
  else if (drag.k === "bar") { drag.b.y = y + drag.dy; refitBar(drag.b); updateJoints(); refreshMounts(); drag.moved = true; draw(); }
  else if (drag.k === "post") {
    let nx = x + drag.dx; S.guide = null;
    /* magnetic alignment with other posts (8 px on screen) */
    let best = null; for (const o of S.posts) { if (o === drag.q) continue; const d = Math.abs(o.x - nx) * view.s; if (d < 8 && (!best || d < best.d)) best = { d, x: o.x }; }
    if (best) { nx = best.x; S.guide = best.x; } drag.q.x = nx; if (drag.q.dot != null) refreshMounts(); drag.moved = true; draw();
  }
});
const endDrag = e => {
  pointers.delete(e.pointerId);
  if (!drag) return; const d = drag; drag = null;
  if (d.k === "move") { if (d.moved) { const li = letterAt(d.o.x, d.o.y); if (li >= 0) d.o.L = li; S.manual = true; recompute(); } else { undo.pop(); draw(); } }
  else if (d.k === "post") { S.guide = null; if (d.moved) { Core.snapBars(S.bars, [d.q]); S.manual = true; recompute(); } else undo.pop(); }
  else if (d.k === "bar") { if (d.moved) { S.manual = true; recompute(); } else undo.pop(); }
  else if (d.k === "barEnd") { if (d.moved) { S.manual = true; recompute(); toast(`Profiil ${Math.round(d.b.x1 - d.b.x0)} mm`); } else undo.pop(); }
  else if (d.k === "pan" && d.click && S.gPick) { const li = letterAt(d.x, d.y); if (li >= 0) { S.letters[li].group = S.gCur; fillGroups(); computeProfile(); recompute(); } }
  else if (d.k === "pan" && d.click) { const li = letterAt(d.x, d.y); S.sel = null; S.selLetter = li >= 0 ? li : null; showLetter(); if (li >= 0) $("secLetter").classList.remove("closed"); draw(); }
};
cv.addEventListener("pointerup", endDrag); cv.addEventListener("pointercancel", endDrag);
cv.addEventListener("contextmenu", e => e.preventDefault());
cv.addEventListener("wheel", e => { e.preventDefault(); const x = wx(e.offsetX), y = wy(e.offsetY); const f = Math.exp(-e.deltaY * 0.0015); view.s *= f; view.cx = x - (e.offsetX - W / 2) / view.s; view.cy = y - (H / 2 - e.offsetY) / view.s; draw(); }, { passive: false });
function setTool(t) { if (t !== "measure" && S.meas) { S.meas = null; draw(); } S.tool = t; document.querySelectorAll("#tools button").forEach(b => b.classList.toggle("on", b.dataset.tool === t)); cv.style.cursor = t === "select" ? "default" : "crosshair"; const hints = { select: "Kliki tähel, et muuta selle LED-tüüpi · lohista LED-e ja auke · Shift+lohista raami · tühjal alal lohista vaadet · ratas suumib", led: "Kliki kuju sees, et lisada LED", hole: "Kliki kuju sees, et lisada veeauk", post: "Kliki kahe profiili vahele (pulk tuleb sellesse vahesse) või tähe sisse profiili kohale/alla (pulk ulatub profiilist tähe servani) · joondub tähe joone keskele või teise rea pulgaga", bar: "Kliki kõrgusele, kuhu horisontaalset profiili vaja · pikkus tuleb tähtede järgi", delete: "Kliki LED-il, augul või raamil, et see kustutada", screw: "Kliki raamile, et lisada kinnitusava (tõmbub profiili või pulga keskjoonele) · kustutamiseks kasuta kustutamise tööriista", measure: "Kliki kahte punkti, et mõõta · tõmbub kontuuri punktidele, avadele ja raamile · Shift = ainult horisontaalne/vertikaalne · Esc tühistab" }; $("hint").textContent = hints[t]; }
document.querySelectorAll("#tools button").forEach(b => b.addEventListener("click", () => setTool(b.dataset.tool)));
window.addEventListener("keydown", e => {
  if (document.body.classList.contains("vt-off")) return; /* tellimuste vaade on ees */
  if (e.target.matches("input,select,textarea")) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); restore(); return; }
  if ((e.key === "Delete" || e.key === "Backspace") && S.sel) { snapshot(); if (S.sel.k === "bar") S.bars.splice(S.sel.i, 1); else if (S.sel.k === "post") { const q = S.posts[S.sel.i]; if (q) removePostAt(q, S.sel.y != null ? S.sel.y : (q.y != null ? q.y : 0)); S.multi = []; } else (S.sel.k === "led" ? S.leds : S.holes).splice(S.sel.i, 1); S.sel = null; S.manual = true; recompute(); }
  if (e.key === "j" || e.key === "J") { alignPosts(); return; }
  if (e.key === "Escape" && S.meas) { S.meas = null; draw(); return; }
  const m = { "1": "select", "2": "led", "3": "hole", "4": "delete", "5": "post", "6": "bar", "7": "measure", "8": "screw" }; if (m[e.key]) setTool(m[e.key]);
  if (e.key === "f") fit();
});

