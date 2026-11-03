/* Valgustähed — core/naidised.js
   Sisseehitatud näidiskujud (POC, laiad kujud).
   Arvutusosa (DOM-i ei kasuta). Failid jagavad ühist skoopi; avalik liides on js/core.js-is (Core). */
/* ---------- samples ---------- */
function arcD(cx, cy, r, a0, a1, step = 3) { const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step)); const p = []; for (let k = 0; k <= n; k++) { const a = (a0 + (a1 - a0) * k / n) * Math.PI / 180; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; }
function samplePOC() {
  const P = [[0, 0], [42, 0], [42, 95], ...arcD(60, 155, 60, -90, 90), [0, 215]];
  const Ph = [[42, 137], ...arcD(60, 155, 18, -90, 90), [42, 173]];
  const O1 = arcD(257, 107.5, 107, 0, 360).slice(0, -1), O2 = arcD(257, 107.5, 65, 0, 360).slice(0, -1);
  const C = [...arcD(501, 107.5, 107, 40, 320), ...arcD(501, 107.5, 65, 320, 40)];
  return [P, Ph, O1, O2, C];
}
function sampleWide() {
  const Lsh = [[0, 0], [520, 0], [520, 230], [230, 230], [230, 760], [0, 760]];
  const star = []; for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + k * Math.PI / 5; const r = k % 2 ? 330 : 640; star.push([1300 + r * Math.cos(a), 380 + r * Math.sin(a)]); }
  const ring = arcD(1300, 330, 90, 0, 360).slice(0, -1);
  return [Lsh, star, ring];
}

