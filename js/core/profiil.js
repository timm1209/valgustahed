/* Valgustähed — core/profiil.js
   Kontuuri nihked: põhi, külg, soon, nurgaraadiused, veeava sälgud.
   Arvutusosa (DOM-i ei kasuta). Failid jagavad ühist skoopi; avalik liides on js/core.js-is (Core). */
/* ---------- contour offset (põhi / külg) ---------- */
const OFFK = 100000; /* 0.00001 mm grid: coarser grids tilt short edges and offsets magnify that into bumps */
function clip() { return (typeof ClipperLib !== "undefined") ? ClipperLib : null; }
function toC(loops) { return loops.map(lp => lp.map(p => ({ X: Math.round(p[0] * OFFK), Y: Math.round(p[1] * OFFK) }))); }
function fromC(paths) { return paths.map(p => p.map(q => [q.X / OFFK, q.Y / OFFK])).filter(p => p.length >= 3); }
function offC(paths, d, round) { const CL = clip(); const co = new CL.ClipperOffset(4, 0.01 * OFFK); co.AddPaths(paths, round ? CL.JoinType.jtRound : CL.JoinType.jtMiter, CL.EndType.etClosedPolygon); const sol = new CL.Paths(); co.Execute(sol, d * OFFK); return sol; }
/* plain offset, sharp corners kept (miter) */
function offsetLoops(loops, d) { if (!clip()) return null; if (!d) return loops.map(l => l.slice()); return fromC(offC(toC(loops), d, false)); }
/* inner (concave) corners rounded with radius r: closing = grow r, shrink r */
function roundInner(loops, r) { if (!clip()) return null; if (!(r > 0)) return loops.map(l => l.slice()); return fromC(offC(offC(toC(loops), r, true), -r, true)); }
/* outer (convex) corners rounded with radius r: opening = shrink r, grow r */
function roundOuter(loops, r) { if (!clip()) return null; if (!(r > 0)) return loops.map(l => l.slice()); return fromC(offC(offC(toC(loops), -r, true), r, true)); }
/* profile set: contour gets inner R, offsets come from it, then outer R on contour, base and groove */
/* y of the contour edge straight below (x, y): the highest crossing of the vertical line x that lies under y */
function edgeBelow(loops, x, y) {
  let best = null;
  for (const lp of loops) for (let i = 0; i < lp.length; i++) {
    const a = lp[i], b = lp[(i + 1) % lp.length]; if ((a[0] > x) === (b[0] > x)) continue;
    const yi = a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0]); if (yi < y && (best === null || yi > best)) best = yi;
  }
  return best;
}
/* cuts U-shaped drain notches into the bottom edge: straight sides, semicircular end, width w, depth from the edge */
/* polygon difference a − b (both lists of closed loops) */
/* union of loop sets; evenOdd for raw letter loops (any orientation), nonZero for already oriented pieces */
function unionLoops(loops, evenOdd) {
  const CL = clip(); if (!CL) return loops; const c = new CL.Clipper(); c.AddPaths(toC(loops), CL.PolyType.ptSubject, true);
  const sol = new CL.Paths(), ft = evenOdd ? CL.PolyFillType.pftEvenOdd : CL.PolyFillType.pftNonZero; c.Execute(CL.ClipType.ctUnion, sol, ft, ft); return fromC(sol);
}
/* oblique 3D look of an extruded shape: the region swept by the outline moving by (dx,dy) */
function sweepLoops(loops, dx, dy) {
  const base = unionLoops(loops, true), parts = [...base, ...base.map(lp => lp.map(p => [p[0] + dx, p[1] + dy]))];
  for (const lp of base) for (let i = 0; i < lp.length; i++) { const a = lp[i], b = lp[(i + 1) % lp.length]; let q = [a, b, [b[0] + dx, b[1] + dy], [a[0] + dx, a[1] + dy]]; if (area(q) < 0) q = q.reverse(); if (Math.abs(area(q)) > 1e-6) parts.push(q); }
  return unionLoops(parts, false);
}
function diffLoops(a, b) {
  const CL = clip(); if (!CL) return a; const c = new CL.Clipper(); c.AddPaths(toC(a), CL.PolyType.ptSubject, true); c.AddPaths(toC(b), CL.PolyType.ptClip, true);
  const sol = new CL.Paths(); c.Execute(CL.ClipType.ctDifference, sol, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero); return fromC(sol);
}
function notchLoops(loops, notches) {
  const CL = clip(); if (!CL || !notches.length) return loops;
  const shapes = notches.map(n => {
    const r = n.w / 2, yc = n.y0 + Math.max(n.depth, r) - r, pts = [[n.x - r, n.y0 - Math.max(5, n.w)], [n.x + r, n.y0 - Math.max(5, n.w)]];
    const seg = Math.max(16, Math.ceil(Math.PI / (2 * Math.acos(1 - Math.min(0.002, r) / r))));
    for (let k = 0; k <= seg; k++) { const a = Math.PI * k / seg; pts.push([n.x + r * Math.cos(a), yc + r * Math.sin(a)]); }
    return pts;
  });
  const c = new CL.Clipper(); c.AddPaths(toC(loops), CL.PolyType.ptSubject, true); c.AddPaths(toC(shapes), CL.PolyType.ptClip, true);
  const sol = new CL.Paths(); c.Execute(CL.ClipType.ctDifference, sol, CL.PolyFillType.pftNonZero, CL.PolyFillType.pftNonZero);
  return fromC(sol);
}
/* removes micro spikes / back-tracks (where two source curves overlap or leave a gap) */
function clean(loops) {
  return loops.map(lp => {
    let P = lp.slice(), changed = true;
    while (changed && P.length > 3) {
      changed = false; const out = [];
      for (let i = 0; i < P.length; i++) {
        const a = out.length ? out[out.length - 1] : P[P.length - 1], b = P[i], c = P[(i + 1) % P.length];
        const l1 = dist(a, b), l2 = dist(b, c); if (l1 < 1e-6) { changed = true; continue; }
        const cosT = ((b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])) / (l1 * l2 || 1);
        if (cosT < -0.5 && Math.min(l1, l2) < 0.3) { changed = true; continue; } /* > 120 deg turn on a sub-0.3 mm leg */
        out.push(b);
      }
      P = out;
    }
    return P;
  });
}
function profileSet(loops, o) {
  if (!clip()) return null;
  /* source cleaned of micro spikes where two curves overlap; inner corners rounded (closing); side, base and groove are
     offset from that contour; then outer corners of contour, base and groove are rounded (opening) */
  const k = roundInner(clean(loops), o.rIn), cont = roundOuter(k, o.rOut), src = k;
  const side = offsetLoops(src, o.side), base = offsetLoops(src, o.base), groove = offsetLoops(src, o.groove);
  return { cont, side, base: roundOuter(base, o.rBase != null ? o.rBase : o.rOut), groove: roundOuter(groove, o.rGroove != null ? o.rGroove : o.rOut) };
}

