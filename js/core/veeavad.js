/* Valgustähed — core/veeavad.js
   Veeavade asukohad (tähe madalaimad kohad).
   Arvutusosa (DOM-i ei kasuta). Failid jagavad ühist skoopi; avalik liides on js/core.js-is (Core). */
/* ---------- drain holes ---------- */
function drainHoles(L, holeD) {
  const R = holeD / 2, inset = R + 3, W = Math.max(20, holeD * 3), res = [];
  for (const lp of L.loops) {
    const r = resampleLoop(lp, 1); const p = r.pts, n = p.length; const win = Math.max(2, Math.round(W / (r.per / n)));
    const cand = new Uint8Array(n);
    for (let i = 0; i < n; i++) { let isMin = true; for (let k = -win; k <= win && isMin; k++) if (k && p[(i + k + n) % n][1] < p[i][1] - 1e-6) isMin = false; if (!isMin) continue; if (inLetter(L, p[i][0], p[i][1] + 0.6) && !inLetter(L, p[i][0], p[i][1] - 0.6)) cand[i] = 1; }
    if (!cand.some(v => v)) continue;
    let start = 0; while (start < n && cand[start]) start++; if (start === n) continue;
    for (let k = 1; k <= n; k++) {
      const i = (start + k) % n; if (!cand[i] || cand[(i - 1 + n) % n]) continue;
      const span = []; let j = i; while (cand[j]) { span.push(j); j = (j + 1) % n; if (j === i) break; }
      const ymin = Math.min(...span.map(q => p[q][1]));
      const look = (from, dir) => { let q = from; for (let s = 0; s < win * 3; s++) { if (Math.abs(p[q][1] - ymin) > 0.05) return p[q]; q = (q + dir + n) % n; } return p[q]; };
      const before = look((i - 1 + n) % n, -1), after = look(j, 1);
      if (!(before[1] > ymin + 0.05 && after[1] > ymin + 0.05)) continue;
      const xsS = span.map(q => p[q][0]); const xa = Math.min(...xsS), xb = Math.max(...xsS);
      const xs = [(xa + xb) / 2];
      for (const x of xs) { const h = fitHole(L, x, ymin + inset, R); if (h) res.push(h); }
    }
  }
  const out = []; for (const h of res) if (!out.some(o => Math.hypot(o.x - h.x, o.y - h.y) < 3 * inset)) out.push(h);
  return out;
}
function fitHole(L, x, y, R) { for (let dy = 0; dy <= 12 * R + 20; dy += 1) for (const dx of [0, -2, 2, -4, 4, -8, 8]) { const px = x + dx, py = y + dy; if (inLetter(L, px, py) && bdist(L.idx, px, py) >= R + 1) return { x: px, y: py }; } return null; }

