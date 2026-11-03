/* Valgustähed — core/raam.js
   Raam: horisontaalprofiilid, raami jätk, pulgad, täppide pulgad, kinnitusavad ja nende mõõdud.
   Arvutusosa (DOM-i ei kasuta). Failid jagavad ühist skoopi; avalik liides on js/core.js-is (Core). */
/* ---------- frame (horizontal profiles) ---------- */
function crossings(L, y) { const xs = []; for (const lp of L.loops) for (let i = 0; i < lp.length; i++) { const a = lp[i], b = lp[(i + 1) % lp.length]; if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); } xs.sort((a, b) => a - b); const iv = []; for (let i = 0; i + 1 < xs.length; i += 2) iv.push([xs[i], xs[i + 1]]); return iv; }
function frameBars(letters, cfg) {
  if (!letters.length) return [];
  const y0 = Math.min(...letters.map(l => l.bb.y0)), y1 = Math.max(...letters.map(l => l.bb.y1)), h = y1 - y0, prof = cfg.profile;
  const gap = Math.max(prof * 1.5, cfg.barGap || 800);
  let targets;
  if (h < 2 * prof + 80) targets = [y0 + h / 2];
  else { const a = y0 + h * 0.17, b = y0 + h * 0.83; const n = Math.max(2, Math.ceil((b - a) / gap - 1e-9) + 1); targets = Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1)); }
  const win = targets.length > 1 ? Math.min(h * 0.14, (targets[1] - targets[0]) * 0.3) : h * 0.14;
  const bars = [];
  for (const t of targets) {
    let best = null; const lo = Math.max(y0 + prof / 2 + 1, t - win), hi = Math.min(y1 - prof / 2 - 1, t + win); const st = Math.max(0.5, h / 400);
    for (let y = lo; y <= hi; y += st) {
      let hits = 0, len = 0;
      for (const L of letters) { if (y < L.bb.y0 || y > L.bb.y1) continue; const ivs = crossings(L, y); const ivs2 = crossings(L, y - prof * 0.35), ivs3 = crossings(L, y + prof * 0.35); const l1 = ivs.reduce((s, v) => s + v[1] - v[0], 0); if (l1 > prof * 0.6 && ivs2.length && ivs3.length) hits++; len += l1; }
      const sc = hits * 1e6 + len - Math.abs(y - t) * 3;
      if (!best || sc > best.sc) best = { sc, y };
    }
    if (!best || bars.some(b => Math.abs(b.y - best.y) < prof * 1.5)) continue;
    const ext = barExtent(letters, best.y, prof); if (!ext) continue;
    const e = barEnds(ext, cfg);
    if (e.x1 - e.x0 > prof) bars.push({ x0: e.x0, x1: e.x1, y: best.y, h: prof });
  }
  return bars;
}
/* bar ends from the letter extent, inset by barEnd */
function barEnds(ext, cfg) { const end = cfg.barEnd || 0; return { x0: ext[0] + end, x1: ext[1] - end }; }
/* Raami jätk: split points of a bar, placed in free gaps between letters so no piece is longer than maxLen.
   Returns { xs, fail } - fail is true when some piece could not be kept within maxLen. */
/* free gaps along one bar: { a, c, j } where j is the x-rank of the letter right after the gap (null = gap inside one letter) */
function barGaps(letters, b, rank) {
  const lines = [b.y - b.h / 2 + 0.01, b.y, b.y + b.h / 2 - 0.01], cov = [];
  letters.forEach((L, li) => { for (const yy of lines) if (yy >= L.bb.y0 && yy <= L.bb.y1) for (const v of crossings(L, yy)) cov.push([v[0], v[1], li]); });
  cov.sort((p, q) => p[0] - q[0]);
  const runs = []; for (const c of cov) { const r = runs[runs.length - 1]; if (r && c[0] <= r[1]) { if (c[1] > r[1]) { r[1] = c[1]; r.lr = c[2]; } } else { const n = [c[0], c[1]]; n.ll = c[2]; n.lr = c[2]; runs.push(n); } }
  const out = []; for (let i = 1; i < runs.length; i++) { const a = runs[i - 1][1], c = runs[i][0]; if (c - a > 1 && c > b.x0 && a < b.x1) out.push({ a: Math.max(a, b.x0), c: Math.min(c, b.x1), j: runs[i - 1].lr !== runs[i].ll ? rank[runs[i].ll] : null }); }
  return out;
}
/* Raami jätk for all bars together: every cut goes into the gap before the same letter on all bars that need one,
   on one vertical line when the gaps overlap, otherwise offset inside that same gap. Falls back to per-bar cuts only if no shared gap works. */
function frameJoints(letters, bars, maxLen) {
  for (const b of bars) b.j = { xs: [], fail: false };
  if (!(maxLen > 0) || !bars.length) return;
  const order = letters.map((L, i) => i).sort((p, q) => (letters[p].bb.x0 + letters[p].bb.x1) - (letters[q].bb.x0 + letters[q].bb.x1)), rank = []; order.forEach((li, r) => rank[li] = r);
  const m = 5, minPiece = Math.min(100, maxLen / 2), G = bars.map(b => barGaps(letters, b, rank)), st = bars.map(b => b.x0);
  if (equalJoints(bars, G, maxLen, m, minPiece)) return;
  const span = g => g.c - g.a > 2 * m ? [g.a + m, g.c - m] : [(g.a + g.c) / 2, (g.a + g.c) / 2];
  for (let guard = 0; guard < 200; guard++) {
    const need = bars.map((b, i) => i).filter(i => bars[i].x1 - st[i] > maxLen + 1e-6 && !bars[i].j.fail); if (!need.length) break;
    const slots = [...new Set(need.flatMap(i => G[i].filter(g => g.j != null).map(g => g.j)))].sort((p, q) => q - p);
    let pick = null;
    for (const j of slots) {
      const R = []; let ok = true;
      for (const i of need) { const g = G[i].find(g => g.j === j); if (!g) { ok = false; break; } const [lo, hi] = span(g), r0 = Math.max(lo, st[i] + minPiece), r1 = Math.min(hi, st[i] + maxLen); if (r1 < r0) { ok = false; break; } R.push({ i, g, r0, r1 }); }
      if (ok) { pick = R; break; }
    }
    if (pick) {
      const c0 = Math.max(...pick.map(r => r.r0)), c1 = Math.min(...pick.map(r => r.r1)), mid = pick.reduce((a, r) => a + (r.g.a + r.g.c) / 2, 0) / pick.length;
      for (const r of pick) { const x = c1 >= c0 ? Math.min(Math.max(mid, c0), c1) : Math.min(Math.max((r.g.a + r.g.c) / 2, r.r0), r.r1); bars[r.i].j.xs.push(x); st[r.i] = x; }
      continue;
    }
    /* no gap shared by all: each bar on its own (farthest gap between letters, else any gap) */
    for (const i of need) {
      let best = null;
      for (const g of G[i]) { const [lo, hi] = span(g), r0 = Math.max(lo, st[i] + minPiece), r1 = Math.min(hi, st[i] + maxLen); if (r1 < r0) continue; const x = Math.min(Math.max((g.a + g.c) / 2, r0), r1), sc = (g.j != null ? 1e7 : 0) + x; if (!best || sc > best.sc) best = { sc, x }; }
      if (best) { bars[i].j.xs.push(best.x); st[i] = best.x; bars[i].j.split = true; } else bars[i].j.fail = true;
    }
  }
}
/* pieces as equal as possible: n = fewest pieces that fit; cuts go into letter gaps shared by every bar that needs cutting,
   each cut slid inside its gap toward the equal-length position (one line when the gaps overlap). DP over gap slots. */
function equalJoints(bars, G, maxLen, m, minPiece) {
  const need = bars.map((b, i) => i).filter(i => bars[i].x1 - bars[i].x0 > maxLen + 1e-6); if (!need.length) return true;
  const slots = [...new Set(G[need[0]].filter(g => g.j != null).map(g => g.j))].filter(j => need.every(i => G[i].some(g => g.j === j))).sort((p, q) => p - q);
  const span = g => g.c - g.a > 2 * m ? [g.a + m, g.c - m] : [(g.a + g.c) / 2, (g.a + g.c) / 2];
  const sp = slots.map(j => need.map(i => span(G[i].find(g => g.j === j))));
  const nMin = Math.max(...need.map(i => Math.ceil((bars[i].x1 - bars[i].x0) / maxLen - 1e-9)));
  for (let n = nMin; n <= nMin + 4 && n - 1 <= slots.length; n++) {
    /* position of cut k at slot s for each need bar */
    const pos = (k, s) => { const t = need.map(i => bars[i].x0 + (bars[i].x1 - bars[i].x0) * k / n), R = sp[s], c0 = Math.max(...R.map(r => r[0])), c1 = Math.min(...R.map(r => r[1]));
      if (c1 >= c0) { const avg = t.reduce((a, v) => a + v, 0) / t.length, x = Math.min(Math.max(avg, c0), c1); return need.map(() => x); }
      return R.map((r, q) => Math.min(Math.max(t[q], r[0]), r[1])); };
    const ok = (a, b) => a.every((v, q) => b[q] - v <= maxLen + 1e-6 && b[q] - v >= minPiece - 1e-6);
    const cost = (a, b) => a.reduce((s, v, q) => { const L = bars[need[q]].x1 - bars[need[q]].x0, d = (b[q] - v) - L / n; return s + d * d; }, 0);
    const start = need.map(i => bars[i].x0), end = need.map(i => bars[i].x1);
    /* dp[k][s] = best cost with cut k at slot s */
    let prev = slots.map((_, s) => { const p = pos(1, s); return ok(start, p) ? { c: cost(start, p), p, from: null } : null; });
    const hist = [prev];
    for (let k = 2; k < n; k++) {
      const cur = slots.map((_, s) => { const p = pos(k, s); let best = null; for (let r = 0; r < s; r++) { const q = prev[r]; if (!q || !ok(q.p, p)) continue; const c = q.c + cost(q.p, p); if (!best || c < best.c) best = { c, p, from: r }; } return best; });
      hist.push(cur); prev = cur;
    }
    let bestEnd = null; if (n === 1) continue;
    prev.forEach((q, s) => { if (!q || !ok(q.p, end)) return; const c = q.c + cost(q.p, end); if (!bestEnd || c < bestEnd.c) bestEnd = { c, s }; });
    if (!bestEnd) continue;
    const cuts = []; let s = bestEnd.s; for (let k = hist.length - 1; k >= 0; k--) { const q = hist[k][s]; cuts.unshift(q.p); s = q.from; }
    need.forEach((i, q) => { bars[i].j.xs = cuts.map(p => p[q]); });
    return true;
  }
  return false;
}
function barJoints(letters, b, maxLen) {
  const out = { xs: [], fail: false }; if (!(maxLen > 0) || b.x1 - b.x0 <= maxLen) return out;
  const lines = [b.y - b.h / 2 + 0.01, b.y, b.y + b.h / 2 - 0.01], cov = [];
  letters.forEach((L, li) => { for (const yy of lines) if (yy >= L.bb.y0 && yy <= L.bb.y1) for (const v of crossings(L, yy)) cov.push([v[0], v[1], li]); });
  cov.sort((p, q) => p[0] - q[0]);
  const runs = []; for (const c of cov) { const r = runs[runs.length - 1]; if (r && c[0] <= r[1]) { if (c[1] > r[1]) { r[1] = c[1]; r.lr = c[2]; } } else { const n = [c[0], c[1]]; n.ll = c[2]; n.lr = c[2]; runs.push(n); } }
  const gaps = []; for (let i = 1; i < runs.length; i++) { const a = runs[i - 1][1], c = runs[i][0]; if (c - a > 1 && c > b.x0 && a < b.x1) gaps.push({ a: Math.max(a, b.x0), c: Math.min(c, b.x1), between: runs[i - 1].lr !== runs[i].ll }); }
  const m = 5; let s = b.x0;
  while (b.x1 - s > maxLen + 1e-6) {
    const lim = s + maxLen; let best = null;
    for (const g of gaps) {
      const wide = g.c - g.a > 2 * m, lo = wide ? g.a + m : (g.a + g.c) / 2, hi = wide ? g.c - m : lo;
      if (lo > lim || hi <= s + 1) continue;
      const x = Math.max(lo, Math.min((g.a + g.c) / 2, lim, hi));
      if (x <= s + 1) continue;
      const sc = (g.between ? 1e7 : 0) + x;
      if (!best || sc > best.sc) best = { sc, x };
    }
    if (!best) { out.fail = true; break; }
    out.xs.push(best.x); s = best.x;
  }
  return out;
}
/* leftmost/rightmost x where the full bar width (y +- prof/2) is inside a letter at the start and end */
function barExtent(letters, y, prof) {
  const lines = [y - prof / 2 + 0.01, y, y + prof / 2 - 0.01];
  const ivs = lines.map(yy => letters.flatMap(L => (yy >= L.bb.y0 && yy <= L.bb.y1) ? crossings(L, yy) : []));
  if (ivs.some(v => !v.length)) { const c = ivs[1]; if (!c.length) return null; return [Math.min(...c.map(v => v[0])), Math.max(...c.map(v => v[1]))]; }
  return [Math.max(...ivs.map(v => Math.min(...v.map(q => q[0])))), Math.min(...ivs.map(v => Math.max(...v.map(q => q[1]))))];
}
/* ---------- mounting holes on bar centre lines ---------- */
function mountHoles(letters, bars, cfg) {
  const out = [], d = cfg.mountD || 6, lim = cfg.mountTwo || 160;
  for (const b of bars) letters.forEach((L, li) => {
    if (b.y < L.bb.y0 || b.y > L.bb.y1) return;
    for (const v of crossings(L, b.y)) {
      const a = Math.max(v[0], b.x0), c = Math.min(v[1], b.x1), wd = v[1] - v[0];
      if (c - a < d + 4) continue;
      const xs = wd > lim ? [v[0] + wd / 4, v[0] + wd * 3 / 4] : [(v[0] + v[1]) / 2];
      for (let x of xs) { x = Math.min(Math.max(x, a + d / 2 + 2), c - d / 2 - 2); if (!out.some(o => Math.abs(o.x - x) < d * 1.5 && Math.abs(o.y - b.y) < 1)) out.push({ x, y: b.y, L: li, w: wd }); }
    }
  });
  /* first and last hole of every profile (and of every piece when the frame is jointed): half the profile width from the end,
     a hole of the same letter stroke close to it is dropped */
  for (const b of bars) {
    const e = cfg.mountEnd > 0 ? cfg.mountEnd : b.h / 2, cuts = [b.x0, ...((b.j && b.j.xs) || []), b.x1];
    /* letter strokes under the bar centre line, to keep an end hole inside a letter when the bar is stretched past it */
    const iv = []; letters.forEach((L, li) => { if (b.y >= L.bb.y0 && b.y <= L.bb.y1) for (const v of crossings(L, b.y)) iv.push([v[0], v[1], li]); }); iv.sort((p, q) => p[0] - q[0]);
    const inside = (x0, dir, lo, hi) => { /* first stroke from x0 inwards (dir +1 right, -1 left) within [lo,hi] */
      const cand = dir > 0 ? iv.filter(v => v[1] > x0 && v[0] < hi) : iv.filter(v => v[0] < x0 && v[1] > lo).reverse(); const v = cand[0]; if (!v) return null;
      const a = Math.max(v[0], lo), c = Math.min(v[1], hi); if (c - a < d + 4) return null;
      const m = Math.max(e, d / 2 + 2); return dir > 0 ? Math.min(a + m, (a + c) / 2) : Math.max(c - m, (a + c) / 2); };
    for (let k = 1; k < cuts.length; k++) for (const [x0, dir] of [[cuts[k - 1] + e, 1], [cuts[k] - e, -1]]) {
      if (cuts[k] - cuts[k - 1] < 2 * e + d) continue;
      let x = x0; if (!letters.some(L => inLetter(L, x, b.y))) continue; /* bar end outside the letters (stretched): the letters keep their usual holes */
      /* too close to the letter edge (e.g. a joint right at the edge): move to the middle of that stroke within this piece */
      const v = iv.find(q => x >= q[0] && x <= q[1]);
      const atJoint = dir > 0 ? k - 1 > 0 : k < cuts.length - 1; /* real bar ends keep half the width */
      const onBar = o => Math.abs(o.y - b.y) < 1 && !o.end, inStroke = o => v && o.x >= v[0] - 0.01 && o.x <= v[1] + 0.01 && o.x >= cuts[k - 1] && o.x <= cuts[k];
      if (atJoint && v && Math.min(x - v[0], v[1] - x) < 2 * e) {
        /* joint close to the letter edge: this stroke (within the piece) gets the usual holes, centred / at quarters */
        const lo = Math.max(v[0], cuts[k - 1]), hi = Math.min(v[1], cuts[k]); if (hi - lo < d + 4) continue;
        for (let i = out.length - 1; i >= 0; i--) if (onBar(out[i]) && inStroke(out[i])) out.splice(i, 1);
        const xs = hi - lo > lim ? [lo + (hi - lo) / 4, lo + (hi - lo) * 3 / 4] : [(lo + hi) / 2];
        for (const xx of xs) if (!out.some(o => Math.abs(o.x - xx) < d * 1.5 && Math.abs(o.y - b.y) < 1)) out.push({ x: xx, y: b.y, L: v[2], w: hi - lo, end: true });
        continue;
      }
      const li = letters.findIndex(L => inLetter(L, x, b.y));
      /* the end hole replaces the nearest hole of the same stroke, and anything too close to it */
      let near = -1; out.forEach((o, i) => { if (onBar(o) && inStroke(o) && (near < 0 || Math.abs(o.x - x) < Math.abs(out[near].x - x))) near = i; });
      for (let i = out.length - 1; i >= 0; i--) { const o = out[i]; if (onBar(o) && (i === near || Math.abs(o.x - x) < Math.max(3 * d, 2 * e))) out.splice(i, 1); }
      if (!out.some(o => o.end && Math.abs(o.x - x) < d * 1.5 && Math.abs(o.y - b.y) < 1)) out.push({ x, y: b.y, L: li, w: 0, end: true });
    }
  }
  return out;
}

/* baseline dimensions for mounting holes: every value measured from the bar start (0). Top bar dimensioned above, others below. */
function holeDims(bars, mounts) {
  if (!bars.length) return [];
  const top = bars.reduce((a, b) => b.y > a.y ? b : a, bars[0]);
  /* with Raami jätk every piece of a bar gets its own chain, measured from the piece start */
  return bars.flatMap(b => {
    const cuts = [b.x0, ...((b.j && b.j.xs) || []), b.x1];
    return cuts.slice(1).map((x1, k) => {
      const x0 = cuts[k], last = k === cuts.length - 2;
      const xs = mounts.filter(m => Math.abs(m.y - b.y) < 0.01 && m.x >= x0 - 0.01 && (last ? m.x <= x1 + 0.01 : m.x < x1)).map(m => m.x).sort((p, q) => p - q);
      if (!xs.length) return null;
      const pts = [x0, ...xs]; const segs = []; for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1], pts[i]]);
      return { bar: b, side: b === top ? 1 : -1, pts, segs, edge: b.y + (b === top ? 1 : -1) * b.h / 2 };
    });
  }).filter(Boolean);
}
/* dot posts: vertical chain from the frame edge the post starts at (top edge of the bar below the dot), dimensioned right of the post */
function dotDims(posts, mounts) {
  const out = [];
  for (const q of posts) {
    if (q.dot == null || !q.seg) continue;
    const ys = mounts.filter(m => m.dot && Math.abs(m.x - q.x) < 0.01 && m.y >= q.seg[0] - 0.01 && m.y <= q.seg[1] + 0.01).map(m => m.y); if (!ys.length) continue;
    const up = q.up !== false, y0 = up ? q.seg[0] : q.seg[1];
    ys.sort((a, b) => up ? a - b : b - a);
    const pts = [y0, ...ys]; const segs = []; for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1], pts[i]]);
    out.push({ vert: true, side: 1, pts, segs, edge: q.x + q.w / 2 });
  }
  return out;
}
const fmtMM = v => { const r = Math.round(v * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1).replace(".", ","); };

/* ---------- vertical posts behind the letters ---------- */
/* posts sit between the bars: from the lowest bar's top edge to the highest bar's bottom edge */
function postSpan(bars) { if (bars.length < 2) return null; const lo = Math.min(...bars.map(b => b.y + b.h / 2)), hi = Math.max(...bars.map(b => b.y - b.h / 2)); return hi > lo ? [lo, hi] : null; }
/* the pieces of one post between consecutive bars that it touches */
function postSegs(bars, q) {
  if (q.dot != null) return q.seg ? [q.seg] : []; /* post for a dot / accent: its own span between bar and dot */
  const bs = bars.filter(b => q.x + q.w / 2 > b.x0 + 0.5 && q.x - q.w / 2 < b.x1 - 0.5).sort((a, b) => a.y - b.y); const out = [];
  for (let i = 1; i < bs.length; i++) { const lo = bs[i - 1].y + bs[i - 1].h / 2, hi = bs[i].y - bs[i].h / 2; if (hi > lo) out.push([lo, hi]); }
  if (q.y == null || !out.length) return out; /* a post with y sits only in the gap that contains y (nearest gap if bars moved) */
  const inGap = out.find(g => q.y >= g[0] - 1e-6 && q.y <= g[1] + 1e-6); if (inGap) return [inGap];
  return [out.reduce((a, g) => Math.abs((g[0] + g[1]) / 2 - q.y) < Math.abs((a[0] + a[1]) / 2 - q.y) ? g : a)];
}
/* a bar end close to a post is moved flush with the post's outer edge */
function snapBars(bars, posts) {
  for (const b of bars) for (const q of posts) {
    if (q.dot != null) continue;
    const l = q.x - q.w / 2, r = q.x + q.w / 2;
    if (Math.abs(l - b.x0) < q.w * 1.5 && q.x < (b.x0 + b.x1) / 2) b.x0 = l;
    if (Math.abs(r - b.x1) < q.w * 1.5 && q.x > (b.x0 + b.x1) / 2) b.x1 = r;
  }
  return bars;
}
function postCover(letters, x, w, lo, hi, n) { return rowsCover(postRows(letters, lo, hi, n || 120), x, w); }
function postCoverOld(letters, x, w, lo, hi, n) {
  n = n || 120; const st = (hi - lo) / n; let ok = 0; const xs = [x - w / 2 + 0.5, x, x + w / 2 - 0.5];
  for (let k = 0; k < n; k++) { const y = lo + st * (k + 0.5); if (xs.every(xx => letters.some(L => inLetter(L, xx, y)))) ok++; }
  return ok / n;
}
function postRows(letters, lo, hi, n) {
  const rows = []; for (let k = 0; k < n; k++) { const y = lo + (hi - lo) * (k + 0.5) / n; const iv = []; for (const L of letters) if (y >= L.bb.y0 && y <= L.bb.y1) iv.push(...crossings(L, y)); rows.push(iv); }
  return rows;
}
/* manual post: centre it in the letter stroke nearest to the click (searched within +-r); stays at the click when nothing hides it */
function snapPost(letters, bars, x, w, r, gLo, gHi) {
  const sp = gLo != null ? [gLo, gHi] : postSpan(bars); if (!sp) return null;
  const x0 = Math.min(...bars.map(b => b.x0)) - w / 2 + 5, x1 = Math.max(...bars.map(b => b.x1)) + w / 2 - 5;
  x = Math.min(Math.max(x, x0), x1); const rows = postRows(letters, sp[0], sp[1], 120);
  const lo = Math.max(x0, x - r), hi = Math.min(x1, x + r), xs = [], cs = [];
  for (let t = lo; t <= hi + 1e-9; t += 0.5) { xs.push(t); cs.push(rowsCover(rows, t, w)); }
  if (!xs.length) return x; const best = Math.max(...cs); if (best <= 0) return x;
  /* plateaus at the best coverage; take the one closest to the click and use its middle */
  let pick = null;
  for (let i = 0; i < xs.length;) { if (cs[i] < best - 1e-9) { i++; continue; } let j = i; while (j + 1 < xs.length && cs[j + 1] >= best - 1e-9) j++; const mid = (xs[i] + xs[j]) / 2, d = (x >= xs[i] && x <= xs[j]) ? 0 : Math.min(Math.abs(x - xs[i]), Math.abs(x - xs[j])); if (!pick || d < pick.d) pick = { mid, d }; i = j + 1; }
  return pick ? pick.mid : x;
}
function rowsCover(rows, x, w) {
  const xs = [x - w / 2 + 0.5, x, x + w / 2 - 0.5]; let ok = 0;
  for (const iv of rows) if (xs.every(xx => iv.some(v => xx >= v[0] && xx <= v[1]))) ok++;
  return ok / rows.length;
}
/* vertical posts: at least 2, each centred in a letter stroke so it stays hidden behind the letter */
function framePosts(letters, bars, cfg) {
  const sp = postSpan(bars); if (!sp) return [];
  const x0 = Math.min(...bars.map(b => b.x0)), x1 = Math.max(...bars.map(b => b.x1)), len = x1 - x0, w = cfg.profile;
  const n = Math.max(2, Math.ceil(len / Math.max(w * 3, cfg.postGap || 1200) - 1e-9)); const seg = len / n;
  const rows = postRows(letters, sp[0], sp[1], 120);
  const st = 1, xs = [], cs = [];
  for (let x = x0 - w / 2 + 5; x <= x1 + w / 2 - 5 + 1e-6; x += st) { xs.push(x); cs.push(rowsCover(rows, x, w)); }
  /* plateaus of locally-best coverage -> candidate at the plateau centre (= middle of the stroke) */
  const cand = [];
  for (let i = 0; i < xs.length;) {
    let j = i; while (j + 1 < xs.length && Math.abs(cs[j + 1] - cs[i]) < 1e-9) j++;
    const left = i > 0 ? cs[i - 1] : -1, right = j + 1 < xs.length ? cs[j + 1] : -1;
    if (cs[i] > 0 && cs[i] >= left && cs[i] >= right) cand.push({ x: (xs[i] + xs[j]) / 2, c: cs[i], run: xs[j] - xs[i] });
    i = j + 1;
  }
  const posts = [];
  for (let i = 0; i < n; i++) {
    const t = x0 + seg * (i + 0.5), a = x0 + seg * i, b = x0 + seg * (i + 1); const prev = posts.length ? posts[posts.length - 1].x : -Infinity;
    let best = null;
    for (const q of cand) {
      if (q.x < a - seg * 0.15 || q.x > b + seg * 0.15 || q.x - prev < Math.max(w * 4, seg * 0.35)) continue;
      const hidden = q.c >= 0.995 ? 1 : 0;
      const sc = hidden * 1e6 + q.c * 1e4 - Math.abs(q.x - t) / seg * 200 + Math.min(q.run, 20);
      if (!best || sc > best.sc) best = { sc, x: q.x };
    }
    if (!best) { /* fallback: best coverage anywhere in the segment */ let bi = -1; for (let k = 0; k < xs.length; k++) if (xs[k] >= a && xs[k] <= b && xs[k] - prev >= w * 2 && (bi < 0 || cs[k] > cs[bi])) bi = k; if (bi >= 0) best = { x: xs[bi] }; }
    if (best) posts.push({ x: best.x, w });
  }
  return posts;
}
/* dots and accents (shapes no bar crosses): one vertical post from the nearest bar into the middle of the shape */
function dotPostX(L, w) { const y = (L.bb.y0 + L.bb.y1) / 2, iv = crossings(L, y); if (!iv.length) return (L.bb.x0 + L.bb.x1) / 2; const v = iv.reduce((a, c) => c[1] - c[0] > a[1] - a[0] ? c : a); return (v[0] + v[1]) / 2; }
/* y-intervals where the vertical line x is inside the shape */
function vcrossings(L, x) { const ys = []; for (const lp of L.loops) for (let i = 0; i < lp.length; i++) { const a = lp[i], b = lp[(i + 1) % lp.length]; if ((a[0] > x) !== (b[0] > x)) ys.push(a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0])); } ys.sort((p, q) => p - q); const out = []; for (let i = 0; i + 1 < ys.length; i += 2) out.push([ys[i], ys[i + 1]]); return out; }
/* post into a dot: from the nearest bar to 5 mm short of the dot's far edge (over the whole post width), so it stays hidden;
   q.hy = the part of the post inside the dot (for the two mounting holes) */
const DOT_EDGE = 5;
function dotSeg(L, bars, q) {
  const cy = (L.bb.y0 + L.bb.y1) / 2, xs = [q.x - q.w / 2 + 0.01, q.x, q.x + q.w / 2 - 0.01];
  const iv = xs.map(x => vcrossings(L, x));
  const top = iv.every(v => v.length) ? Math.min(...iv.map(v => Math.max(...v.map(r => r[1])))) : L.bb.y1, bot = iv.every(v => v.length) ? Math.max(...iv.map(v => Math.min(...v.map(r => r[0])))) : L.bb.y0;
  let best = null;
  for (const b of bars) {
    if (q.x < b.x0 + 1 || q.x > b.x1 - 1) continue;
    const up = cy > b.y, end = up ? Math.max(top - DOT_EDGE, cy) : Math.min(bot + DOT_EDGE, cy);
    const seg = up ? [b.y + b.h / 2, end] : [end, b.y - b.h / 2]; if (seg[1] - seg[0] <= 0) continue;
    if (!best || seg[1] - seg[0] < best.seg[1] - best.seg[0]) best = { seg, up, hy: up ? [Math.max(bot, seg[0]), seg[1]] : [seg[0], Math.min(top, seg[1])] };
  }
  q.hy = best ? best.hy : null; q.up = best ? best.up : true;
  return best ? best.seg : null;
}
/* two mounting holes on the post centre line, inside the dot */
function dotHoles(posts, cfg) {
  const d = cfg.mountD || 6, out = [];
  for (const q of posts) { if (q.dot == null || !q.seg || !q.hy) continue; const [a, c] = q.hy, m = d / 2 + 2; if (c - a < 2 * m) continue;
    const ys = c - a >= 4 * m ? [a + (c - a) / 4, a + (c - a) * 3 / 4].map(y => Math.min(Math.max(y, a + m), c - m)) : [(a + c) / 2];
    for (const y of ys) out.push({ x: q.x, y, L: q.dot, w: 0, dot: true }); }
  return out;
}
function dotPosts(letters, bars, cfg) {
  const out = []; letters.forEach((L, li) => { if (letterOnFrame(L, bars)) return; const q = { x: dotPostX(L, cfg.profile), w: cfg.profile, dot: li }; q.seg = dotSeg(L, bars, q); if (q.seg) out.push(q); });
  return out;
}
function letterOnFrame(L, bars) { return bars.some(b => b.y >= L.bb.y0 && b.y <= L.bb.y1 && crossings(L, b.y).some(v => Math.min(v[1], b.x1) - Math.max(v[0], b.x0) > 1)); }
