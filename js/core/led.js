/* Valgustähed — core/led.js
   LED-ide paigutus (keskjoon, mitu rida, pinnatäide), tühjade kohtade täitmine, raport, juhtme järjekord.
   Arvutusosa (DOM-i ei kasuta). Failid jagavad ühist skoopi; avalik liides on js/core.js-is (Core). */
/* ---------- LED placement ---------- */
function countFor(x, density) { const n = density === "dense" ? Math.ceil(x - 0.05) : density === "sparse" ? Math.floor(x + 0.05) : Math.round(x); return Math.max(1, n); }
function cumOf(p, closed) { const q = closed ? [...p, p[0]] : p; const c = [0]; for (let i = 1; i < q.length; i++) c.push(c[i - 1] + Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1])); return { q, c }; }
function atS(qc, s) { const { q, c } = qc; const L = c[c.length - 1]; if (q.length === 1) return { x: q[0][0], y: q[0][1], a: 0 }; s = Math.max(0, Math.min(L, s)); let lo = 0, hi = c.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= s) lo = m; else hi = m; } const a = q[lo], b = q[hi]; const f = (s - c[lo]) / ((c[hi] - c[lo]) || 1); return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, a: Math.atan2(b[1] - a[1], b[0] - a[0]) }; }
function medianR(p) { const r = p.map(a => a[2]).sort((a, b) => a - b); return r.length ? r[r.length >> 1] : 0; }
function corners(pts, closed, thrDeg) {
  const n = pts.length; if (n < 5) return []; const ds = pathLen(pts, closed) / (closed ? n : n - 1) || 1; const thr = thrDeg * Math.PI / 180; const ang = new Float64Array(n);
  for (let i = 0; i < n; i++) { const m = Math.max(2, Math.round(Math.max(pts[i][2] * 1.0, 8) / ds)); let ia = i - m, ib = i + m; if (!closed && (ia < 0 || ib >= n)) continue; ia = (ia + n) % n; ib = ib % n; const a = pts[ia], b = pts[i], c = pts[ib]; const v1 = Math.atan2(b[1] - a[1], b[0] - a[0]), v2 = Math.atan2(c[1] - b[1], c[0] - b[0]); let d = Math.abs(v2 - v1); if (d > Math.PI) d = TAU - d; ang[i] = d; }
  const out = [];
  for (let i = 0; i < n; i++) { if (ang[i] < thr) continue; const m = Math.max(2, Math.round(Math.max(pts[i][2], 8) / ds)); let isMax = true; for (let k = -m; k <= m && isMax; k++) { if (!k) continue; let j = i + k; if (closed) j = (j + n) % n; else if (j < 0 || j >= n) continue; if (ang[j] > ang[i] || (ang[j] === ang[i] && j < i)) isMax = false; } if (isMax) out.push(i); }
  return out;
}
function placeLetter(L, chs, cfg, type) {
  const pitch = type.pitch; const leds = [];
  const allR = chs.flatMap(c => c.pts.map(p => p[2])).sort((a, b) => a - b); const wL = 2 * (allR[allR.length >> 1] || 0);
  let mode = L.mode;
  if (mode === "auto") mode = wL >= cfg.panel * pitch ? "fill" : "skel";
  L.usedMode = mode === "skel" ? (wL >= cfg.multi * pitch ? "rows" : "line") : mode;
  if (mode === "fill") { placeFill(L, pitch, cfg, leds); return leds; }
  for (const ch of chs) {
    if (ch.dot) { const p = ch.pts[0]; leds.push({ x: p[0], y: p[1], a: 0, pri: 2 }); continue; }
    const pts = ch.pts; const w = 2 * medianR(pts);
    let rows = 1; if (mode === "rows" || (mode === "skel" && w >= cfg.multi * pitch)) rows = Math.max(2, Math.round(w / (cfg.rowGap * pitch)));
    if (mode === "line") rows = 1;
    if (rows === 1) placeAlong(pts, ch.closed, pitch, cfg, leds, true);
    else {
      for (let r = 0; r < rows; r++) {
        const f = 2 * (r + 0.5) / rows - 1; const n = pts.length;
        const row = pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; const pa = ch.closed ? pts[(i - 1 + n) % n] : a, pb = ch.closed ? pts[(i + 1) % n] : b; const tx = pb[0] - pa[0], ty = pb[1] - pa[1], tl = Math.hypot(tx, ty) || 1; return [p[0] - ty / tl * f * p[2], p[1] + tx / tl * f * p[2], p[2]]; });
        placeAlong(row, ch.closed, pitch, cfg, leds, false, cfg.hex && r % 2 === 1);
      }
    }
  }
  return mergeLeds(leds, pitch * 0.5);
}
function placeAlong(pts, closed, pitch, cfg, leds, useCorners, shift) {
  const qc = cumOf(pts, closed); const Ltot = qc.c[qc.c.length - 1];
  if (pts.length < 2 || Ltot < 1e-6) { leds.push({ x: pts[0][0], y: pts[0][1], a: 0, pri: 2 }); return; }
  const cor = useCorners ? corners(pts, closed, cfg.corner).map(i => qc.c[i]) : [];
  let keys;
  if (closed) {
    if (!cor.length) { let top = 0; for (let i = 1; i < pts.length; i++) if (pts[i][1] > pts[top][1]) top = i; const s0 = qc.c[top]; const n = Math.max(3, countFor(Ltot / pitch, cfg.density)); for (let k = 0; k < n; k++) { const s = (s0 + (k + (shift ? 0.5 : 0)) * Ltot / n) % Ltot; const p = atS(qc, s); leds.push({ x: p.x, y: p.y, a: p.a, pri: 0 }); } return; }
    keys = [...cor, cor[0] + Ltot];
  } else keys = [0, ...cor.filter(s => s > pitch * 0.3 && s < Ltot - pitch * 0.3), Ltot];
  for (let k = 0; k + 1 < keys.length; k++) {
    const a = keys[k], b = keys[k + 1], Ls = b - a; const n = countFor(Ls / pitch, cfg.density);
    for (let j = 0; j <= n; j++) {
      if (shift && (j === n)) continue;
      const s = (a + (j + (shift ? 0.5 : 0)) * Ls / n) % (closed ? Ltot : Infinity); const p = atS(qc, s);
      const endNode = !closed && ((k === 0 && j === 0) || (k === keys.length - 2 && j === n));
      leds.push({ x: p.x, y: p.y, a: p.a, pri: shift ? 0 : endNode ? 2 : (j === 0 || j === n) ? 1 : 0 });
    }
  }
}
function placeFill(L, pitch, cfg, leds) {
  const s = pitch, dy = cfg.hex ? s * Math.sqrt(3) / 2 : s, b = L.bb;
  const nx = Math.floor((b.x1 - b.x0) / s), ny = Math.floor((b.y1 - b.y0) / dy);
  const ox = b.x0 + ((b.x1 - b.x0) - nx * s) / 2, oy = b.y0 + ((b.y1 - b.y0) - ny * dy) / 2; const minE = Math.min(cfg.edge, s * 0.45);
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const x = ox + i * s + (cfg.hex && j % 2 ? s / 2 : 0), y = oy + j * dy; if (inLetter(L, x, y) && bdist(L.idx, x, y) >= minE) leds.push({ x, y, a: 0, pri: 0 }); }
}
function mergeLeds(leds, minSep) {
  const order = leds.map((l, i) => i).sort((a, b) => leds[b].pri - leds[a].pri || a - b); const acc = []; const H = new Map(); const cs = minSep; const key = (x, y) => Math.floor(x / cs) + "_" + Math.floor(y / cs);
  for (const i of order) { const l = leds[i]; const cx = Math.floor(l.x / cs), cy = Math.floor(l.y / cs); let clash = false; for (let dx = -1; dx <= 1 && !clash; dx++) for (let dy = -1; dy <= 1 && !clash; dy++) { const arr = H.get((cx + dx) + "_" + (cy + dy)); if (arr) for (const m of arr) if (Math.hypot(m.x - l.x, m.y - l.y) < minSep) { clash = true; break; } } if (clash) continue; acc.push(l); const k = key(l.x, l.y); if (!H.has(k)) H.set(k, []); H.get(k).push(l); }
  return acc;
}
/* sample grid inside letter with boundary distance */
function samples(L, g) {
  const xs = [], ys = [], bd = []; const b = L.bb;
  for (let y = b.y0 + g / 2; y < b.y1; y += g) for (let x = b.x0 + g / 2; x < b.x1; x += g) if (inLetter(L, x, y)) { xs.push(x); ys.push(y); bd.push(bdist(L.idx, x, y)); }
  return { x: Float64Array.from(xs), y: Float64Array.from(ys), bd: Float64Array.from(bd), g };
}
function gapFill(leds, S, pitch, thr, minEdge) {
  const n = S.x.length; if (!n) return []; let maxBd = 0; for (let i = 0; i < n; i++) if (S.bd[i] > maxBd) maxBd = S.bd[i];
  const candMin = Math.min(minEdge, maxBd * 0.9); const dmin = new Float64Array(n).fill(Infinity);
  const upd = l => { for (let i = 0; i < n; i++) { const d = Math.hypot(S.x[i] - l.x, S.y[i] - l.y); if (d < dmin[i]) dmin[i] = d; } };
  leds.forEach(upd); const added = [];
  for (let it = 0; it < 2000; it++) { let bi = -1, bv = thr; for (let i = 0; i < n; i++) if (S.bd[i] >= candMin && dmin[i] > bv) { bv = dmin[i]; bi = i; } if (bi < 0) break; const l = { x: S.x[bi], y: S.y[bi], a: 0, pri: 0, gap: true }; added.push(l); upd(l); }
  return added;
}



/* ---------- report ---------- */
function report(letters, leds, types, cfg, S, chainsBy) {
  let tot = 0, cov = 0, dbl = 0; const spots = []; let axisN = 0, axisOn = 0; const devs = []; let nearEdge = 0;
  letters.forEach((L, li) => {
    const smp = S[li]; if (!smp) return; const mine = leds.filter(l => l.L === li); const n = smp.x.length; tot += n;
    const cs = Math.max(...types.map(t => t.soor), 10); const H = new Map(); for (const l of mine) { const k = Math.floor(l.x / cs) + "_" + Math.floor(l.y / cs); if (!H.has(k)) H.set(k, []); H.get(k).push(l); }
    const gapThr = cfg.gap * (types[L.type ?? cfg.type] || types[0]).pitch; const flagged = [];
    let maxBdL = 0; for (let i = 0; i < n; i++) if (smp.bd[i] > maxBdL) maxBdL = smp.bd[i]; const candMin = Math.min(cfg.edge, maxBdL * 0.9);
    for (let i = 0; i < n; i++) {
      const x = smp.x[i], y = smp.y[i]; const cx = Math.floor(x / cs), cy = Math.floor(y / cs); let c = 0, dm = Infinity;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const arr = H.get((cx + dx) + "_" + (cy + dy)); if (!arr) continue; for (const l of arr) { const d = Math.hypot(l.x - x, l.y - y); if (d < dm) dm = d; if (d <= types[l.t].soor / 2) c++; } }
      if (c >= 1) cov++; if (c >= 2) dbl++;
      if (dm === Infinity) dm = mine.reduce((m, l) => Math.min(m, Math.hypot(l.x - x, l.y - y)), Infinity);
      if (dm > gapThr && smp.bd[i] >= candMin) flagged.push([x, y]);
    }
    const g = smp.g * 1.5; const cl = []; for (const f of flagged) { let hit = null; for (const c of cl) if (Math.hypot(c.x - f[0], c.y - f[1]) < Math.max(g * 4, gapThr * 0.6)) { hit = c; break; } if (hit) { hit.sx += f[0]; hit.sy += f[1]; hit.n++; hit.x = hit.sx / hit.n; hit.y = hit.sy / hit.n; } else cl.push({ x: f[0], y: f[1], sx: f[0], sy: f[1], n: 1 }); }
    for (const c of cl) if (c.n * smp.g * smp.g > (gapThr * 0.25) ** 2) spots.push({ x: c.x, y: c.y, L: li });
    if (L.usedMode === "line") { const segs = chainsBy[li] || []; for (const l of mine) { axisN++; let dm = Infinity; for (const ch of segs) { const p = ch.pts; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; if (!ch.closed && i === p.length - 1) { dm = Math.min(dm, Math.hypot(a[0] - l.x, a[1] - l.y)); break; } dm = Math.min(dm, Math.sqrt(segD2(l.x, l.y, a[0], a[1], b[0], b[1]))); } } if (dm < 0.08 * types[l.t].pitch + 2) axisOn++; } }
    for (const l of mine) { let nn = Infinity; for (const m of mine) if (m !== l) nn = Math.min(nn, Math.hypot(m.x - l.x, m.y - l.y)); if (isFinite(nn)) devs.push(Math.abs(nn / types[l.t].pitch - 1)); let maxBd = 0; for (let i = 0; i < n; i++) if (smp.bd[i] > maxBd) maxBd = smp.bd[i]; if (maxBd >= cfg.edge && bdist(L.idx, l.x, l.y) < cfg.edge * 0.75) nearEdge++; }
  });
  devs.sort((a, b) => a - b);
  return { coverage: tot ? cov / tot : 0, over: tot ? dbl / tot : 0, axis: axisN ? axisOn / axisN : null, density: devs.length ? devs.reduce((s, v) => s + v, 0) / devs.length : 0, spots, nearEdge };
}
function wireOrder(letters, leds) {
  const order = []; let last = null;
  letters.forEach((L, li) => { const rest = leds.filter(l => l.L === li); if (!rest.length) return; let cur; if (last) { rest.sort((a, b) => Math.hypot(a.x - last.x, a.y - last.y) - Math.hypot(b.x - last.x, b.y - last.y)); cur = rest.shift(); } else { rest.sort((a, b) => (a.x + a.y * 0.5) - (b.x + b.y * 0.5)); cur = rest.shift(); } order.push(cur); while (rest.length) { let bi = 0, bd = Infinity; for (let i = 0; i < rest.length; i++) { const d = Math.hypot(rest[i].x - cur.x, rest[i].y - cur.y); if (d < bd) { bd = d; bi = i; } } cur = rest.splice(bi, 1)[0]; order.push(cur); } last = cur; });
  let len = 0; for (let i = 1; i < order.length; i++) len += Math.hypot(order[i].x - order[i - 1].x, order[i].y - order[i - 1].y);
  return { order, len };
}

