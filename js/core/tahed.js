/* Valgustähed — core/tahed.js
   Kontuuridest tähed: suletud kontuurid, augud, servakauguse indeks.
   Arvutusosa (DOM-i ei kasuta). Failid jagavad ühist skoopi; avalik liides on js/core.js-is (Core). */
/* ---------- contours -> letters ---------- */
function dedupePts(p) { const o = []; for (const q of p) { if (!o.length || dist(o[o.length - 1], q) > 1e-6) o.push(q); } return o; }
function buildLoops(paths, tol) {
  const loops = [], open = [];
  for (const pth of paths) { let p = dedupePts(pth.pts); if (p.length < 2) continue; const cl = dist(p[0], p[p.length - 1]); if (pth.closed) { if (cl < 1e-6) p.pop(); if (p.length >= 3) loops.push(p); } else if (p.length > 3 && cl <= Math.max(tol, 1e-6)) { p.pop(); loops.push(p); } else open.push(p); }
  const T = Math.max(tol, 1e-4), cell = T * 2, H = new Map(), key = (x, y) => Math.floor(x / cell) + "_" + Math.floor(y / cell);
  open.forEach((p, i) => { for (const end of [0, 1]) { const q = end ? p[p.length - 1] : p[0]; const k = key(q[0], q[1]); if (!H.has(k)) H.set(k, []); H.get(k).push([i, end]); } });
  const used = new Uint8Array(open.length);
  const find = p => { const cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell); let best = null, bd = T; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const l = H.get((cx + dx) + "_" + (cy + dy)); if (!l) continue; for (const [i, end] of l) { if (used[i]) continue; const q = end ? open[i][open[i].length - 1] : open[i][0]; const d = dist(p, q); if (d <= bd) { bd = d; best = [i, end]; } } } return best; };
  const openOut = [];
  for (let i = 0; i < open.length; i++) {
    if (used[i]) continue; used[i] = 1; let ch = open[i].slice();
    const isClosed = () => ch.length > 2 && dist(ch[0], ch[ch.length - 1]) <= T;
    for (let pass = 0; pass < 2 && !isClosed(); pass++) { while (!isClosed()) { const f = find(ch[ch.length - 1]); if (!f) break; used[f[0]] = 1; const seg = f[1] === 0 ? open[f[0]] : open[f[0]].slice().reverse(); for (let k = 1; k < seg.length; k++) ch.push(seg[k]); } if (!isClosed()) ch.reverse(); }
    if (isClosed()) { ch.pop(); ch = dedupePts(ch); if (ch.length >= 3) loops.push(ch); } else openOut.push(ch);
  }
  const seen = new Set(), uniq = [];
  for (const p of loops) { const a = Math.abs(area(p)); if (a < 0.5) continue; const b = bboxOf(p); const k = [a.toFixed(0), b.x0.toFixed(1), b.y0.toFixed(1), b.x1.toFixed(1), b.y1.toFixed(1)].join("|"); if (seen.has(k)) continue; seen.add(k); uniq.push(p); }
  return { loops: uniq, open: openOut, dupes: loops.length - uniq.length };
}
function makeLetters(loops) {
  const L = loops.map(p => ({ p, a: Math.abs(area(p)), bb: bboxOf(p), depth: 0, parent: -1 }));
  L.sort((a, b) => b.a - a.a);
  for (let i = 0; i < L.length; i++) { const t = L[i]; const q = t.p[0]; for (let j = 0; j < i; j++) { const o = L[j]; if (o.a <= t.a) continue; if (q[0] < o.bb.x0 || q[0] > o.bb.x1 || q[1] < o.bb.y0 || q[1] > o.bb.y1) continue; if (pip(q[0], q[1], o.p)) { t.depth++; t.parent = j; } } }
  const letters = [];
  L.forEach((t, i) => { if (t.depth % 2) return; const outer = area(t.p) < 0 ? t.p.slice().reverse() : t.p; const holes = L.filter(h => h.depth % 2 === 1 && h.parent === i).map(h => area(h.p) > 0 ? h.p.slice().reverse() : h.p); letters.push(prepLetter(outer, holes)); });
  letters.sort((a, b) => (a.bb.x0 - b.bb.x0) || (b.bb.y1 - a.bb.y1));
  letters.forEach((l, i) => l.id = i);
  return letters;
}
function prepLetter(outer, holes) {
  const loops = [outer, ...holes]; const bb = bboxOf(outer);
  const ar = Math.abs(area(outer)) - holes.reduce((s, h) => s + Math.abs(area(h)), 0);
  return { loops, outer, holes, bb, area: ar, idx: segIndex(loops, bb), type: null, mode: "auto" };
}
function segIndex(loops, bb) {
  const segs = []; for (const lp of loops) for (let i = 0; i < lp.length; i++) { const a = lp[i], b = lp[(i + 1) % lp.length]; segs.push(a[0], a[1], b[0], b[1]); }
  const w = bb.x1 - bb.x0, h = bb.y1 - bb.y0; const cs = Math.max(Math.max(w, h) / 48, 2); const nx = Math.ceil(w / cs) + 1, ny = Math.ceil(h / cs) + 1; const cells = Array.from({ length: nx * ny }, () => []);
  for (let s = 0; s < segs.length; s += 4) { const ix0 = Math.floor((Math.min(segs[s], segs[s + 2]) - bb.x0) / cs), ix1 = Math.floor((Math.max(segs[s], segs[s + 2]) - bb.x0) / cs), iy0 = Math.floor((Math.min(segs[s + 1], segs[s + 3]) - bb.y0) / cs), iy1 = Math.floor((Math.max(segs[s + 1], segs[s + 3]) - bb.y0) / cs); for (let ix = Math.max(0, ix0); ix <= Math.min(nx - 1, ix1); ix++) for (let iy = Math.max(0, iy0); iy <= Math.min(ny - 1, iy1); iy++) cells[iy * nx + ix].push(s); }
  return { segs: Float64Array.from(segs), cells, cs, nx, ny, x0: bb.x0, y0: bb.y0 };
}
function bdist(I, x, y) {
  const ix = Math.floor((x - I.x0) / I.cs), iy = Math.floor((y - I.y0) / I.cs); let best = Infinity; const S = I.segs;
  const maxR = Math.max(Math.abs(ix) + I.nx, Math.abs(iy) + I.ny);
  for (let r = 0; r <= maxR; r++) {
    if (best <= ((r - 1) * I.cs) ** 2 && r > 0) break;
    for (let cy = iy - r; cy <= iy + r; cy++) { if (cy < 0 || cy >= I.ny) continue; const edge = cy === iy - r || cy === iy + r; for (let cx = ix - r; cx <= ix + r; cx += (edge ? 1 : 2 * r || 1)) { if (cx < 0 || cx >= I.nx) continue; for (const s of I.cells[cy * I.nx + cx]) { const d = segD2(x, y, S[s], S[s + 1], S[s + 2], S[s + 3]); if (d < best) best = d; } } }
  }
  return Math.sqrt(best);
}

