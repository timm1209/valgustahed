/* Valgustähed — core/keskjoon.js
   Tähe keskjoon (skelett), millele LED-id paigutatakse.
   Arvutusosa (DOM-i ei kasuta). Failid jagavad ühist skoopi; avalik liides on js/core.js-is (Core). */
/* ---------- skeleton (centerline) ---------- */
function resampleLoop(lp, step) {
  const n = lp.length; const cum = [0]; for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + dist(lp[i - 1], lp[i % n]));
  const per = cum[n]; const m = Math.max(12, Math.round(per / step)); const pts = [], s = []; let j = 0;
  for (let k = 0; k < m; k++) { const t = per * k / m; while (j < n - 1 && cum[j + 1] < t) j++; const a = lp[j], b = lp[(j + 1) % n]; const seg = cum[j + 1] - cum[j] || 1; const f = (t - cum[j]) / seg; pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); s.push(t); }
  return { pts, s, per };
}
function skeleton(L) {
  const per = L.loops.reduce((a, lp) => a + perim(lp), 0);
  const step = Math.min(4, Math.max(0.6, per / 1000));
  const ox = L.bb.x0, oy = L.bb.y0; const X = [], cid = [], S = [], PER = [];
  L.loops.forEach((lp, c) => { const r = resampleLoop(lp, step); PER[c] = r.per; r.pts.forEach((p, k) => { X.push(p[0] - ox, p[1] - oy); cid.push(c); S.push(r.s[k]); }); });
  const D = new Delaunator(Float64Array.from(X)); const T = D.triangles, HE = D.halfedges, nt = T.length / 3;
  const cc = new Float64Array(nt * 3), ok = new Uint8Array(nt);
  for (let t = 0; t < nt; t++) {
    const a = T[3 * t], b = T[3 * t + 1], c = T[3 * t + 2]; const ax = X[2 * a], ay = X[2 * a + 1], bx = X[2 * b], by = X[2 * b + 1], cx = X[2 * c], cy = X[2 * c + 1];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)); if (Math.abs(d) < 1e-12) continue;
    const A = ax * ax + ay * ay, B = bx * bx + by * by, C = cx * cx + cy * cy;
    const ux = (A * (by - cy) + B * (cy - ay) + C * (ay - by)) / d, uy = (A * (cx - bx) + B * (ax - cx) + C * (bx - ax)) / d; const r = Math.hypot(ux - ax, uy - ay);
    cc[3 * t] = ux + ox; cc[3 * t + 1] = uy + oy; cc[3 * t + 2] = r;
    if (isFinite(r) && r > step * 0.3 && inLetter(L, ux + ox, uy + oy)) ok[t] = 1;
  }
  const nodeId = new Int32Array(nt).fill(-1), nodes = [], adj = [];
  const nid = t => { if (nodeId[t] < 0) { nodeId[t] = nodes.length; nodes.push({ x: cc[3 * t], y: cc[3 * t + 1], r: cc[3 * t + 2] }); adj.push(new Set()); } return nodeId[t]; };
  for (let e = 0; e < T.length; e++) {
    const o = HE[e]; if (o < 0 || o < e) continue; const t1 = (e / 3) | 0, t2 = (o / 3) | 0; if (!ok[t1] || !ok[t2]) continue;
    const a = T[e], b = T[e % 3 === 2 ? e - 2 : e + 1]; let keep;
    if (cid[a] !== cid[b]) keep = true; else { const p = PER[cid[a]]; let ds = Math.abs(S[a] - S[b]); ds = Math.min(ds, p - ds); const ch = Math.hypot(X[2 * a] - X[2 * b], X[2 * a + 1] - X[2 * b + 1]); keep = ds > 2.0 * ch && ds > 4 * step; }
    if (!keep) continue; const u = nid(t1), v = nid(t2); if (u === v) continue;
    if (Math.hypot(nodes[u].x - nodes[v].x, nodes[u].y - nodes[v].y) < 1e-9) { /* merge coincident */ }
    adj[u].add(v); adj[v].add(u);
  }
  const G = { nodes, adj: adj.map(s => [...s]), step };
  const alive = pruneGraph(G, 1.1);
  let chs = extractChains(G, alive, step);
  const rmax = nodes.reduce((m, n, i) => alive[i] ? Math.max(m, n.r) : m, 0);
  chs = chs.filter(c => c.len >= Math.min(rmax * 0.6, 3 * step) || chs.length === 1);
  if (!chs.length) { let best = null; for (let t = 0; t < nt; t++) if (ok[t] && (!best || cc[3 * t + 2] > best.r)) best = { x: cc[3 * t], y: cc[3 * t + 1], r: cc[3 * t + 2] }; if (best) chs = [{ pts: [best], closed: false, len: 0, dot: true }]; }
  return chs;
}
function pruneGraph(G, factor) {
  const { nodes, adj } = G; const alive = new Uint8Array(nodes.length).fill(1);
  const deg = i => { let d = 0; for (const j of adj[i]) d += alive[j]; return d; };
  for (let it = 0; it < 80; it++) {
    const kill = [];
    for (let i = 0; i < nodes.length; i++) {
      if (!alive[i] || deg(i) !== 1) continue;
      const path = [i]; let prev = -1, cur = i, len = 0;
      while (true) { let nx = -1; for (const j of adj[cur]) if (alive[j] && j !== prev) { nx = j; break; } if (nx < 0) break; len += Math.hypot(nodes[nx].x - nodes[cur].x, nodes[nx].y - nodes[cur].y); prev = cur; cur = nx; path.push(cur); if (deg(cur) !== 2) break; }
      if (cur !== i && deg(cur) >= 3 && len < factor * nodes[cur].r) for (const k of path) if (k !== cur) kill.push(k);
    }
    if (!kill.length) break; for (const k of kill) alive[k] = 0;
  }
  return alive;
}
function extractChains(G, alive, step) {
  const { nodes } = G; const nb = G.adj.map((l, i) => alive[i] ? l.filter(j => alive[j]) : []);
  const vis = new Set(); const ek = (a, b) => a < b ? a + "_" + b : b + "_" + a; const out = [];
  const isKey = i => nb[i].length !== 2;
  for (let u = 0; u < nodes.length; u++) {
    if (!alive[u] || !isKey(u)) continue;
    for (const v of nb[u]) { if (vis.has(ek(u, v))) continue; vis.add(ek(u, v)); const path = [u]; let prev = u, cur = v; while (!isKey(cur)) { path.push(cur); const nx = nb[cur][0] === prev ? nb[cur][1] : nb[cur][0]; vis.add(ek(cur, nx)); prev = cur; cur = nx; if (cur === u) break; } path.push(cur); out.push(path); }
  }
  for (let u = 0; u < nodes.length; u++) {
    if (!alive[u] || nb[u].length !== 2 || vis.has(ek(u, nb[u][0]))) continue;
    const path = [u]; let prev = u, cur = nb[u][0]; vis.add(ek(u, cur));
    while (cur !== u) { path.push(cur); const nx = nb[cur][0] === prev ? nb[cur][1] : nb[cur][0]; vis.add(ek(cur, nx)); prev = cur; cur = nx; }
    path.closed = true; out.push(path);
  }
  return out.map(path => finishChain(path.map(i => nodes[i]), !!path.closed, step));
}
function finishChain(raw, closed, step) {
  let p = raw.map(n => [n.x, n.y, n.r]);
  if (closed && p.length > 1 && Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < 1e-9) p.pop();
  for (let pass = 0; pass < 3; pass++) { const q = p.map(a => a.slice()); const n = p.length; for (let i = 0; i < n; i++) { if (!closed && (i === 0 || i === n - 1)) continue; const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n]; q[i] = [(a[0] + 2 * b[0] + c[0]) / 4, (a[1] + 2 * b[1] + c[1]) / 4, (a[2] + 2 * b[2] + c[2]) / 4]; } p = q; }
  const ds = Math.max(step * 1.5, 1);
  const pts = resamplePath(p, closed, ds);
  return { pts, closed, len: pathLen(pts, closed) };
}
function pathLen(p, closed) { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (closed && p.length > 1) s += Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]); return s; }
function resamplePath(p, closed, ds) {
  if (p.length < 2) return p.map(a => a.slice());
  const q = closed ? [...p, p[0]] : p; const cum = [0]; for (let i = 1; i < q.length; i++) cum.push(cum[i - 1] + Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]));
  const L = cum[cum.length - 1]; if (L < 1e-9) return [p[0].slice()];
  const n = Math.max(closed ? 3 : 1, Math.round(L / ds)); const out = []; let j = 0;
  for (let k = 0; k <= n; k++) { if (closed && k === n) break; const t = L * k / n; while (j < q.length - 2 && cum[j + 1] < t) j++; const a = q[j], b = q[j + 1]; const sg = cum[j + 1] - cum[j] || 1; const f = Math.min(1, Math.max(0, (t - cum[j]) / sg)); out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]); }
  return out;
}

