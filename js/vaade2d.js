/* Valgustähed — vaade2d.js
   2D-joonis: värvid, suum ja nihe, kihtide joonistamine, mõõdulint, mõõdud.
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */

/* ---------- drawing ---------- */
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let C = {}; function readColors() { for (const k of ["mount", "base", "side", "groove", "canvas", "grid", "ink", "muted", "fill", "led", "soor", "hole", "skel", "frame", "wire", "bad", "line"]) C[k] = css("--" + k); }
function resize() { const r = cv.getBoundingClientRect(); DPR = window.devicePixelRatio || 1; W = r.width; H = r.height; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); draw(); }
const tx = x => (x - view.cx) * view.s + W / 2, ty = y => H / 2 - (y - view.cy) * view.s;
const wx = x => (x - W / 2) / view.s + view.cx, wy = y => (H / 2 - y) / view.s + view.cy;
function fit() { if (!S.letters.length) return; const x0 = Math.min(...S.letters.map(L => L.bb.x0)), x1 = Math.max(...S.letters.map(L => L.bb.x1)), y0 = Math.min(...S.letters.map(L => L.bb.y0)), y1 = Math.max(...S.letters.map(L => L.bb.y1)); view.cx = (x0 + x1) / 2; view.cy = (y0 + y1) / 2; const padR = W > 700 ? 170 : 20; const m = Math.max(...cfg.types.map(t => t.soor)) / 2; view.s = Math.min((W - 60 - padR) / ((x1 - x0 + 2 * m) || 1), (H - 150) / ((y1 - y0 + 2 * m) || 1)); view.cx += padR / 2 / view.s; draw(); }
function letterPath(L) { ctx.beginPath(); for (const lp of L.loops) { lp.forEach((p, i) => i ? ctx.lineTo(tx(p[0]), ty(p[1])) : ctx.moveTo(tx(p[0]), ty(p[1]))); ctx.closePath(); } }
const on = id => $(id).checked;
function draw() {
  if (!W) return; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = C.canvas; ctx.fillRect(0, 0, W, H);
  if (!S.letters.length) { ctx.fillStyle = C.grid; ctx.fillStyle = css("--muted") || "#888"; ctx.font = "15px " + (css("--f-ui") || "sans-serif"); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Lohista DXF- või DWG-fail siia või vajuta „Laadi DXF/DWG-fail…“", W / 2, H / 2); return; }
  // grid
  let g = 10; while (g * view.s < 24) g *= 10; ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = Math.floor(wx(0) / g) * g; x < wx(W); x += g) { const X = Math.round(tx(x)) + .5; ctx.moveTo(X, 0); ctx.lineTo(X, H); }
  for (let y = Math.floor(wy(H) / g) * g; y < wy(0); y += g) { const Y = Math.round(ty(y)) + .5; ctx.moveTo(0, Y); ctx.lineTo(W, Y); }
  ctx.stroke();
  const light = on("ly_light");
  for (const L of S.letters) { letterPath(L); ctx.fillStyle = light ? "#141414" : C.fill; ctx.fill("evenodd"); }
  if (light) {
    ctx.save(); ctx.beginPath(); for (const L of S.letters) for (const lp of L.loops) { lp.forEach((p, i) => i ? ctx.lineTo(tx(p[0]), ty(p[1])) : ctx.moveTo(tx(p[0]), ty(p[1]))); ctx.closePath(); } ctx.clip("evenodd"); ctx.globalCompositeOperation = "lighter";
    for (const l of S.leds) { const r = cfg.types[l.t].soor * 0.62 * view.s; const gr = ctx.createRadialGradient(tx(l.x), ty(l.y), 0, tx(l.x), ty(l.y), r); gr.addColorStop(0, "rgba(255,236,200,0.85)"); gr.addColorStop(0.55, "rgba(255,214,150,0.35)"); gr.addColorStop(1, "rgba(255,200,120,0)"); ctx.fillStyle = gr; ctx.fillRect(tx(l.x) - r, ty(l.y) - r, 2 * r, 2 * r); }
    ctx.restore();
  }
  if (on("ly_frame")) (S.posts || []).forEach((q, i) => { for (const [lo, hi] of Core.postSegs(S.bars, q)) { const x = tx(q.x - q.w / 2), y = ty(hi), w = q.w * view.s, h = (hi - lo) * view.s; ctx.fillStyle = C.frame + "33"; ctx.strokeStyle = C.frame; const hl = (S.multi || []).includes(q) || (S.sel && S.sel.k === "post" && S.sel.i === i); ctx.lineWidth = hl ? 2.2 : 1; ctx.strokeStyle = hl ? C.skel : C.frame; ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
    if (S.tool === "select") { ctx.fillStyle = C.frame; for (const Y of [y, y + h]) ctx.fillRect(x + w / 2 - 6, Y - 3, 12, 6); } } }); /* end handles: drag to lengthen */
  if (S.guide != null) { ctx.save(); ctx.strokeStyle = C.skel; ctx.setLineDash([6, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tx(S.guide), 0); ctx.lineTo(tx(S.guide), H); ctx.stroke(); ctx.restore(); }
  if (on("ly_frame")) for (const b of S.bars) { const x = tx(b.x0), y = ty(b.y + b.h / 2), w = (b.x1 - b.x0) * view.s, h = b.h * view.s; ctx.fillStyle = C.frame + "33"; ctx.strokeStyle = C.frame; ctx.lineWidth = S.sel && S.sel.k === "bar" && S.bars[S.sel.i] === b ? 2 : 1;
    if (b.ea || b.eb) { ctx.beginPath(); barPoly(b).forEach((p, k) => k ? ctx.lineTo(tx(p[0]), ty(p[1])) : ctx.moveTo(tx(p[0]), ty(p[1]))); ctx.closePath(); ctx.fill(); ctx.stroke(); } else { ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h); }
    if (S.tool === "select") { ctx.fillStyle = C.frame; for (const X of [x, x + w]) ctx.fillRect(X - 3, y + h / 2 - 6, 6, 12); } /* end handles: drag to stretch */
    if (b.j) for (const jx of b.j.xs) { ctx.save(); ctx.strokeStyle = "#d61f26"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx(jx), y - 4); ctx.lineTo(tx(jx), y + h + 4); ctx.stroke(); ctx.restore(); } }
  if (typeof drawRails === "function") drawRails();
  if (on("ly_soor") && !light) { ctx.lineWidth = 1; for (const l of S.leds) { const r = cfg.types[l.t].soor / 2 * view.s; ctx.beginPath(); ctx.arc(tx(l.x), ty(l.y), r, 0, Math.PI * 2); ctx.fillStyle = C.soor + "26"; ctx.fill(); ctx.strokeStyle = C.soor + "99"; ctx.stroke(); } }
  if (S.groups.length > 1 || S.gPick) S.letters.forEach((L, i) => { const g = L.group || 0; letterPath(L); ctx.fillStyle = GROUP_TINT[g % GROUP_TINT.length] + (S.gPick && g === S.gCur ? "55" : "26"); ctx.fill("evenodd"); });
  S.letters.forEach((L, i) => { if (!on("ly_cont") && i !== S.selLetter) return; const pc = S.prof && S.prof[i] && S.prof[i].cont; if (pc) { ctx.beginPath(); for (const lp of pc) { lp.forEach((q, k) => k ? ctx.lineTo(tx(q[0]), ty(q[1])) : ctx.moveTo(tx(q[0]), ty(q[1]))); ctx.closePath(); } } else letterPath(L); ctx.strokeStyle = i === S.selLetter ? C.skel : (light ? "#666" : C.ink); ctx.lineWidth = i === S.selLetter ? 2.2 : 1.2; ctx.stroke(); });
  if (S.prof) for (const [k, ly, col, dash] of [["groove", "ly_groove", C.groove, [2, 3]], ["side", "ly_side", C.side, []], ["base", "ly_base", C.base, [5, 3]]]) { if (!on(ly)) continue; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash(dash); for (const p of S.prof) for (const lp of p[k] || []) { ctx.beginPath(); lp.forEach((q, i) => i ? ctx.lineTo(tx(q[0]), ty(q[1])) : ctx.moveTo(tx(q[0]), ty(q[1]))); ctx.closePath(); ctx.stroke(); } ctx.setLineDash([]); }
  if (on("ly_skel")) { ctx.strokeStyle = C.skel; ctx.lineWidth = 1; for (const chs of S.chains) for (const ch of chs) { if (ch.dot) continue; ctx.beginPath(); ch.pts.forEach((p, i) => i ? ctx.lineTo(tx(p[0]), ty(p[1])) : ctx.moveTo(tx(p[0]), ty(p[1]))); if (ch.closed) ctx.closePath(); ctx.stroke(); } }
  if (on("ly_wire") && S.wire && S.wire.order.length > 1) { ctx.strokeStyle = C.wire; ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]); ctx.beginPath(); S.wire.order.forEach((l, i) => i ? ctx.lineTo(tx(l.x), ty(l.y)) : ctx.moveTo(tx(l.x), ty(l.y))); ctx.stroke(); ctx.setLineDash([]); }
  if (on("ly_led")) { ctx.lineCap = "round"; for (let i = 0; i < S.leds.length; i++) { const l = S.leds[i]; const t = cfg.types[l.t]; const hl = Math.max(4, t.dash * view.s) / 2; const c = Math.cos(l.a), s = Math.sin(l.a); ctx.strokeStyle = light ? "#ffffff" : C.led; ctx.lineWidth = Math.max(2.4, 3 * view.s); ctx.beginPath(); ctx.moveTo(tx(l.x) - c * hl, ty(l.y) + s * hl); ctx.lineTo(tx(l.x) + c * hl, ty(l.y) - s * hl); ctx.stroke(); if (S.sel && S.sel.k === "led" && S.sel.i === i) { ctx.strokeStyle = C.skel; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tx(l.x), ty(l.y), hl + 6, 0, Math.PI * 2); ctx.stroke(); } } ctx.lineCap = "butt"; }
  if (on("ly_mount") && S.cables && S.cables.length) { ctx.save(); ctx.strokeStyle = "#d61f26"; ctx.lineWidth = 1.6; for (const c of S.cables) { ctx.beginPath(); ctx.arc(tx(c.x), ty(c.y), Math.max(3.5, (cfg.cableD || 8) / 2 * view.s), 0, Math.PI * 2); ctx.stroke(); } ctx.restore(); }
  if (on("ly_mount") && S.mounts) { ctx.strokeStyle = C.mount; ctx.lineWidth = 1.4; for (const m of S.mounts) { const r = Math.max(3, cfg.mountD / 2 * view.s), X = tx(m.x), Y = ty(m.y); ctx.beginPath(); ctx.arc(X, Y, r, 0, Math.PI * 2); ctx.fillStyle = C.canvas; ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(X - r - 3, Y); ctx.lineTo(X + r + 3, Y); ctx.moveTo(X, Y - r - 3); ctx.lineTo(X, Y + r + 3); ctx.stroke(); } }
  if (on("ly_hole")) for (let i = 0; i < S.holes.length; i++) { const h = S.holes[i]; const r = Math.max(3, cfg.holeD / 2 * view.s); ctx.beginPath(); ctx.arc(tx(h.x), ty(h.y), r, 0, Math.PI * 2); ctx.fillStyle = C.canvas; ctx.fill(); ctx.strokeStyle = C.hole; ctx.lineWidth = S.sel && S.sel.k === "hole" && S.sel.i === i ? 3 : 1.6; ctx.stroke(); }
  if (on("ly_check")) { ctx.strokeStyle = C.bad; ctx.lineWidth = 2; for (const p of S.spots) { const X = tx(p.x), Y = ty(p.y); ctx.beginPath(); ctx.moveTo(X - 7, Y - 7); ctx.lineTo(X + 7, Y + 7); ctx.moveTo(X + 7, Y - 7); ctx.lineTo(X - 7, Y + 7); ctx.stroke(); }
    ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5; S.letters.forEach(L => { if (S.bars.length && !Core.letterOnFrame(L, S.bars)) { letterPath(L); ctx.stroke(); } }); ctx.setLineDash([]); }
  if (on("ly_dim") && S.letters.length) drawDims();
  if (on("ly_mdim") && on("ly_mount") && S.mounts && S.mounts.length) drawHoleDims();
  if (S.tool === "measure") drawMeasure();
}
/* ---------- tape measure ---------- */
/* snap: points (contour vertices, holes, LEDs, frame corners) within 10 px, else nearest point on a contour or frame edge within 6 px */
function measPoint(px, py, ortho) {
  let x = wx(px), y = wy(py); const r = 10 / view.s, re = 6 / view.s;
  if (ortho && S.meas && !S.meas.done) { const a = S.meas.a; if (Math.abs(x - a.x) > Math.abs(y - a.y)) y = a.y; else x = a.x; return { x, y, snap: null }; }
  let best = null; const pt = (qx, qy, k) => { const d = Math.hypot(qx - x, qy - y); if (d <= r && (!best || d < best.d)) best = { d, x: qx, y: qy, snap: k }; };
  for (const L of S.letters) { if (x < L.bb.x0 - r || x > L.bb.x1 + r || y < L.bb.y0 - r || y > L.bb.y1 + r) continue; for (const lp of L.loops) for (const q of lp) pt(q[0], q[1], "punkt"); }
  for (const m of S.mounts || []) pt(m.x, m.y, "kinnitusava"); for (const h of S.holes) pt(h.x, h.y, "veeava"); for (const l of S.leds) pt(l.x, l.y, "LED");
  const rects = []; for (const b of S.bars || []) rects.push([b.x0, b.y - b.h / 2, b.x1, b.y + b.h / 2]); for (const q of S.posts || []) for (const [lo, hi] of Core.postSegs(S.bars, q)) rects.push([q.x - q.w / 2, lo, q.x + q.w / 2, hi]);
  for (const [x0, y0, x1, y1] of rects) { pt(x0, y0, "raami nurk"); pt(x1, y0, "raami nurk"); pt(x0, y1, "raami nurk"); pt(x1, y1, "raami nurk"); }
  if (best) return best;
  const seg = (a, b, k) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; if (!L2) return; let t = ((x - a[0]) * dx + (y - a[1]) * dy) / L2; t = Math.max(0, Math.min(1, t)); const qx = a[0] + dx * t, qy = a[1] + dy * t, d = Math.hypot(qx - x, qy - y); if (d <= re && (!best || d < best.d)) best = { d, x: qx, y: qy, snap: k }; };
  for (const L of S.letters) { if (x < L.bb.x0 - re || x > L.bb.x1 + re || y < L.bb.y0 - re || y > L.bb.y1 + re) continue; for (const lp of L.loops) for (let i = 0; i < lp.length; i++) seg(lp[i], lp[(i + 1) % lp.length], "kontuur"); }
  for (const [x0, y0, x1, y1] of rects) { seg([x0, y0], [x1, y0], "raam"); seg([x1, y0], [x1, y1], "raam"); seg([x1, y1], [x0, y1], "raam"); seg([x0, y1], [x0, y0], "raam"); }
  return best || { x, y, snap: null };
}
function drawMeasure() {
  ctx.save(); const col = "#d61f26"; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.5;
  const mark = p => { if (!p) return; const X = tx(p.x), Y = ty(p.y); ctx.beginPath(); if (p.snap) ctx.rect(X - 5, Y - 5, 10, 10); else { ctx.moveTo(X - 6, Y); ctx.lineTo(X + 6, Y); ctx.moveTo(X, Y - 6); ctx.lineTo(X, Y + 6); } ctx.stroke(); };
  const m = S.meas;
  if (m) {
    const A = [tx(m.a.x), ty(m.a.y)], B = [tx(m.b.x), ty(m.b.y)]; ctx.setLineDash(m.done ? [] : [6, 4]); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); ctx.setLineDash([]); mark(m.a); mark(m.b);
    const dx = m.b.x - m.a.x, dy = m.b.y - m.a.y, L = Math.hypot(dx, dy);
    if (L > 0) {
      const t = `${Core.fmtMM(L)} mm`, sub = `ΔX ${Core.fmtMM(Math.abs(dx))} · ΔY ${Core.fmtMM(Math.abs(dy))}`;
      ctx.font = "600 13px " + css("--f-mono"); const w = Math.max(ctx.measureText(t).width, (ctx.font = "11px " + css("--f-mono"), ctx.measureText(sub).width)) + 14;
      const cx = (A[0] + B[0]) / 2 + 10, cy = (A[1] + B[1]) / 2 - 22;
      ctx.fillStyle = C.canvas; ctx.globalAlpha = 0.92; ctx.fillRect(cx, cy - 16, w, 36); ctx.globalAlpha = 1; ctx.strokeRect(cx, cy - 16, w, 36);
      ctx.fillStyle = col; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.font = "600 13px " + css("--f-mono"); ctx.fillText(t, cx + 7, cy - 6); ctx.font = "11px " + css("--f-mono"); ctx.fillText(sub, cx + 7, cy + 10);
      if (m.done) $("hint").textContent = `Mõõt: ${t} (${sub}) · kliki uue mõõtmise alustamiseks · Esc tühistab`;
    }
  }
  if (S.measHover && (!m || m.done)) mark(S.measHover);
  ctx.restore();
}
function drawHoleDims() {
  ctx.save(); ctx.strokeStyle = C.mount; ctx.fillStyle = C.mount; ctx.lineWidth = 1; ctx.font = "11px " + css("--f-mono");
  for (const g of Core.dotDims(S.posts || [], S.mounts)) {
    const E = tx(g.edge), xl = E + 22, xe = E + 30;
    g.pts.forEach((y, i) => { const Y = ty(y); ctx.beginPath(); ctx.moveTo(i === 0 ? E + 7 : E - 4, Y); ctx.lineTo(xe, Y); ctx.stroke(); });
    g.segs.forEach(([a, b], k) => {
      const A = ty(a), B = ty(b), s = B < A ? -1 : 1; ctx.beginPath(); ctx.moveTo(xl, A); ctx.lineTo(xl, B); ctx.stroke();
      const arrows = k === 0 ? [[A, s], [B, -s]] : [[B, -s]];
      for (const [p, d] of arrows) { ctx.beginPath(); ctx.moveTo(xl, p); ctx.lineTo(xl - 2, p + d * 10); ctx.lineTo(xl + 2, p + d * 10); ctx.closePath(); ctx.fill(); }
      const under = k < g.segs.length - 1; ctx.textAlign = "left"; ctx.textBaseline = under === (s < 0) ? "top" : "bottom"; ctx.fillText(Core.fmtMM(Math.abs(b - g.pts[0])), xl + 4, B + (under === (s < 0) ? 2 : -2));
    });
  }
  for (const g of Core.holeDims(S.bars, S.mounts)) {
    const E = ty(g.edge), dir = -g.side; /* screen y grows downwards */
    const yl = E + dir * 22, ye = E + dir * 30;
    g.pts.forEach((x, i) => { const X = tx(x); ctx.beginPath(); ctx.moveTo(X, i === 0 ? E + dir * 7 : E - dir * 4); ctx.lineTo(X, ye); ctx.stroke(); });
    g.segs.forEach(([a, b], k) => {
      const A = tx(a), B = tx(b); ctx.beginPath(); ctx.moveTo(A, yl); ctx.lineTo(B, yl); ctx.stroke();
      const arrows = k === 0 ? [[A, 1], [B, -1]] : [[B, -1]];
      for (const [p, s] of arrows) { ctx.beginPath(); ctx.moveTo(p, yl); ctx.lineTo(p + s * 10, yl - 2); ctx.lineTo(p + s * 10, yl + 2); ctx.closePath(); ctx.fill(); }
      const t = Core.fmtMM(b - g.pts[0]); ctx.save(); ctx.translate(B - 3, yl + (dir < 0 ? -4 : 4)); ctx.rotate(-Math.PI / 2); ctx.textAlign = dir < 0 ? "left" : "right"; ctx.textBaseline = "bottom"; ctx.fillText(t, 0, 0); ctx.restore();
    });
  }
  ctx.restore();
}
function drawDims() {
  const x0 = Math.min(...S.letters.map(L => L.bb.x0)), x1 = Math.max(...S.letters.map(L => L.bb.x1)), y0 = Math.min(...S.letters.map(L => L.bb.y0)), y1 = Math.max(...S.letters.map(L => L.bb.y1));
  ctx.strokeStyle = C.muted; ctx.fillStyle = C.muted; ctx.lineWidth = 1; ctx.font = "12px " + css("--f-mono");
  const yb = ty(y0) + 28; ctx.beginPath(); ctx.moveTo(tx(x0), yb); ctx.lineTo(tx(x1), yb); ctx.moveTo(tx(x0), yb - 5); ctx.lineTo(tx(x0), yb + 5); ctx.moveTo(tx(x1), yb - 5); ctx.lineTo(tx(x1), yb + 5); ctx.stroke();
  ctx.textAlign = "center"; ctx.fillText(`${(x1 - x0).toFixed(0)} mm`, (tx(x0) + tx(x1)) / 2, yb + 16);
  const xb = tx(x0) - 28; ctx.beginPath(); ctx.moveTo(xb, ty(y0)); ctx.lineTo(xb, ty(y1)); ctx.moveTo(xb - 5, ty(y0)); ctx.lineTo(xb + 5, ty(y0)); ctx.moveTo(xb - 5, ty(y1)); ctx.lineTo(xb + 5, ty(y1)); ctx.stroke();
  ctx.save(); ctx.translate(xb - 8, (ty(y0) + ty(y1)) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(`${(y1 - y0).toFixed(0)} mm`, 0, 0); ctx.restore();
  S.letters.forEach(L => { const h = L.bb.y1 - L.bb.y0; ctx.textAlign = "center"; ctx.fillText(`${h.toFixed(0)}`, tx((L.bb.x0 + L.bb.x1) / 2), ty(L.bb.y1) - 8); });
  for (const b of S.bars) { ctx.textAlign = "left"; ctx.fillText(`${(b.x1 - b.x0).toFixed(0)}`, tx(b.x1) + 6, ty(b.y) + 4); }
}

$("btnFit").addEventListener("click", () => { if (T3.on) fit3D(); else fit(); });
