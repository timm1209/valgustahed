/* Valgustähed — core/geom.js
   Põhigeomeetria: pindala, ümbermõõt, piirkast, punkt kujus, kaugus lõigust.
   Arvutusosa (DOM-i ei kasuta). Failid jagavad ühist skoopi; avalik liides on js/core.js-is (Core). */
const TAU = Math.PI * 2;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function area(p) { let s = 0; for (let i = 0, n = p.length; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
function perim(p, closed = true) { let s = 0; for (let i = 1; i < p.length; i++) s += dist(p[i - 1], p[i]); if (closed && p.length > 1) s += dist(p[p.length - 1], p[0]); return s; }
function bboxOf(pts) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return { x0, y0, x1, y1 }; }
function pip(x, y, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function inLetter(L, x, y) { const b = L.bb; if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) return false; let c = false; for (const lp of L.loops) if (pip(x, y, lp)) c = !c; return c; }
function segD2(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; const l = dx * dx + dy * dy; let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; const qx = ax + t * dx - px, qy = ay + t * dy - py; return qx * qx + qy * qy; }

