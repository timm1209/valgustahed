/* Valgustähed — core/dxf-lugemine.js
   DXF-faili lugemine: LINE, ARC, CIRCLE, LWPOLYLINE, SPLINE, INSERT jne → murdjooned.
   Arvutusosa (DOM-i ei kasuta). Failid jagavad ühist skoopi; avalik liides on js/core.js-is (Core). */
/* ---------- DXF parsing ---------- */
const UNIT = { 0: 1, 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000, 14: 100 };
const UNIT_NAME = { mm: 1, cm: 10, m: 1000, in: 25.4 };
let CT = 0.01; /* chordal tolerance in mm: max distance between a chord and the true curve */
function parseDXF(text, unitOverride, chordTol) {
  CT = chordTol > 0 ? chordTol : 0.01;
  if (/^AutoCAD Binary DXF/.test(text.slice(0, 22))) throw new Error("Binaarne DXF ei ole toetatud. Salvesta fail CAD-is ASCII DXF-ina.");
  const raw = text.split(/\r\n|\r|\n/);
  const P = [];
  for (let i = 0; i + 1 < raw.length; i += 2) { const s = raw[i].trim(); if (s === "" && i + 1 >= raw.length - 1) break; const c = parseInt(s, 10); if (isNaN(c)) { i--; continue; } P.push([c, raw[i + 1].trim()]); }
  let i = 0; const header = {}, blocks = {}; let ents = [];
  function readEntities(stop) { const list = []; let cur = null; while (i < P.length) { const [c, v] = P[i]; if (c === 0) { if (stop.includes(v)) break; cur = { type: v, p: [] }; list.push(cur); i++; continue; } if (cur) cur.p.push([c, v]); i++; } return list; }
  while (i < P.length) {
    const [c, v] = P[i];
    if (c === 0 && v === "SECTION") {
      const name = P[i + 1] && P[i + 1][1]; i += 2;
      if (name === "HEADER") { let vn = null; while (i < P.length && !(P[i][0] === 0 && P[i][1] === "ENDSEC")) { if (P[i][0] === 9) vn = P[i][1]; else if (vn) (header[vn] = header[vn] || []).push(P[i]); i++; } }
      else if (name === "BLOCKS") {
        while (i < P.length && !(P[i][0] === 0 && P[i][1] === "ENDSEC")) {
          if (P[i][0] === 0 && P[i][1] === "BLOCK") { i++; const bp = []; while (i < P.length && P[i][0] !== 0) { bp.push(P[i]); i++; } const g = k => { const f = bp.find(q => q[0] === k); return f ? f[1] : null; }; const list = readEntities(["ENDBLK"]); blocks[g(2) || ""] = { base: [+g(10) || 0, +g(20) || 0], ents: list }; }
          else i++;
        }
      }
      else if (name === "ENTITIES") ents = readEntities(["ENDSEC"]);
      else while (i < P.length && !(P[i][0] === 0 && P[i][1] === "ENDSEC")) i++;
    } else i++;
  }
  const iu = header.$INSUNITS ? parseInt(header.$INSUNITS[0][1], 10) : 0;
  const fileScale = UNIT[iu] != null ? UNIT[iu] : 1;
  const fileUnit = { 1: "toll", 2: "jalg", 4: "mm", 5: "cm", 6: "m" }[iu] || "määramata (mm)";
  const sc = unitOverride && unitOverride !== "auto" ? UNIT_NAME[unitOverride] : fileScale;
  const out = [], info = { ignored: {}, text: 0, entities: ents.length, fileUnit, scale: sc };
  convert(ents, blocks, [sc, 0, 0, sc, 0, 0], out, info, 0);
  return { paths: out, info };
}
const gv = (e, code, def) => { const f = e.p.find(q => q[0] === code); return f ? parseFloat(f[1]) : def; };
const gs = (e, code) => { const f = e.p.find(q => q[0] === code); return f ? f[1] : null; };
const mScale = M => Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2]));
const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
function emit(pts, closed, ext, M, out) { out.push({ pts: pts.map(([x, y]) => { if (ext) x = -x; return [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]]; }), closed }); }
function arcPts(cx, cy, r, a0, sweep, scale) { const rr = Math.abs(r * scale) || 1; let step = 2 * Math.acos(Math.max(-1, 1 - Math.min(CT, rr) / rr)); step = Math.min(step || 0.05, Math.PI / 36); const n = Math.max(2, Math.ceil(Math.abs(sweep) / step)); const p = []; for (let k = 0; k <= n; k++) { const a = a0 + sweep * k / n; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; }
function bulgePts(p0, p1, b, scale) { if (Math.abs(b) < 1e-9) return [p1]; const dx = p1[0] - p0[0], dy = p1[1] - p0[1]; const c = Math.hypot(dx, dy); if (c < 1e-12) return [p1]; const f = (1 - b * b) / (4 * b); const cx = (p0[0] + p1[0]) / 2 - dy * f, cy = (p0[1] + p1[1]) / 2 + dx * f; const r = c * (1 + b * b) / (4 * Math.abs(b)); const a0 = Math.atan2(p0[1] - cy, p0[0] - cx); const pts = arcPts(cx, cy, r, a0, 4 * Math.atan(b), scale); pts.shift(); pts[pts.length - 1] = [p1[0], p1[1]]; return pts; }
function polyFrom(vs, closed, ext, M, out) { if (vs.length < 2) return; const s = mScale(M); const pts = [[vs[0].x, vs[0].y]]; const n = vs.length; const last = closed ? n : n - 1; for (let k = 0; k < last; k++) { const a = vs[k], b = vs[(k + 1) % n]; pts.push(...bulgePts([a.x, a.y], [b.x, b.y], a.b, s)); } if (closed) pts.pop(); emit(pts, closed, ext, M, out); }
/* NURBS flattened with chordal tolerance: each knot span is split recursively until every chord
   stays within `tol` of the curve (checked at 1/4, 1/2 and 3/4 of the chord) */
function nurbs(deg, K, C, W, tol) {
  const n = C.length; if (n < 2) return C.slice(); deg = Math.max(1, Math.min(deg, n - 1));
  if (!K || K.length !== n + deg + 1) { K = []; for (let i = 0; i <= deg; i++) K.push(0); for (let i = 1; i < n - deg; i++) K.push(i); for (let i = 0; i <= deg; i++) K.push(n - deg); }
  const w = W && W.length === n ? W : null; const u0 = K[deg], u1 = K[n];
  const ev = u => {
    if (u >= u1) u = u1 - 1e-12 * (Math.abs(u1 - u0) || 1);
    let k = deg; while (k < n - 1 && K[k + 1] <= u) k++;
    const d = []; for (let j = 0; j <= deg; j++) { const c = C[k - deg + j], ww = w ? w[k - deg + j] : 1; d.push([c[0] * ww, c[1] * ww, ww]); }
    for (let r = 1; r <= deg; r++) for (let j = deg; j >= r; j--) { const ii = k - deg + j; const den = K[ii + deg + 1 - r] - K[ii]; const a = den === 0 ? 0 : (u - K[ii]) / den; d[j] = [(1 - a) * d[j - 1][0] + a * d[j][0], (1 - a) * d[j - 1][1] + a * d[j][1], (1 - a) * d[j - 1][2] + a * d[j][2]]; }
    const q = d[deg]; return [q[0] / q[2], q[1] / q[2]];
  };
  tol = tol > 0 ? tol : 0.01;
  const ks = [u0]; for (let i = deg + 1; i < n; i++) if (K[i] > ks[ks.length - 1] + 1e-12 && K[i] < u1) ks.push(K[i]); ks.push(u1);
  const out = [ev(u0)];
  const dev = (p, a, b) => Math.sqrt(segD2(p[0], p[1], a[0], a[1], b[0], b[1]));
  const sub = (ua, pa, ub, pb, depth) => {
    const um = (ua + ub) / 2, pm = ev(um); let err = 0;
    for (let k = 1; k < 10; k++) { const e = dev(k === 5 ? pm : ev(ua + (ub - ua) * k / 10), pa, pb); if (e > err) err = e; } /* 9 checks per chord */
    if (err > tol && depth < 28) { sub(ua, pa, um, pm, depth + 1); sub(um, pm, ub, pb, depth + 1); }
    else out.push(pb);
  };
  for (let i = 0; i + 1 < ks.length; i++) { const a = ks[i], b = ks[i + 1]; let pa = ev(a); for (let k = 1; k <= 4; k++) { const ub = a + (b - a) * k / 4, pb = ev(ub); sub(a + (b - a) * (k - 1) / 4, pa, ub, pb, 0); pa = pb; } }
  return out;
}
/* spline given only by fit points: centripetal Catmull-Rom through the points, flattened with the same chordal tolerance */
function fitCurve(F, closed, tol) {
  const P = F.slice(); if (P.length < 3) return P; if (closed && dist(P[0], P[P.length - 1]) < 1e-9) P.pop();
  const n = P.length, get = i => closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))];
  const out = [P[0]]; tol = tol > 0 ? tol : 0.01;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const t01 = Math.sqrt(dist(p0, p1)) || 1e-9, t12 = Math.sqrt(dist(p1, p2)) || 1e-9, t23 = Math.sqrt(dist(p2, p3)) || 1e-9;
    const m1 = [0, 1].map(k => (p2[k] - p1[k]) + t12 * ((p1[k] - p0[k]) / t01 - (p2[k] - p0[k]) / (t01 + t12)));
    const m2 = [0, 1].map(k => (p2[k] - p1[k]) + t12 * ((p3[k] - p2[k]) / t23 - (p3[k] - p1[k]) / (t12 + t23)));
    const c1 = [p1[0] + m1[0] / 3, p1[1] + m1[1] / 3], c2 = [p2[0] - m2[0] / 3, p2[1] - m2[1] / 3];
    const bz = t => { const u = 1 - t; return [u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0], u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1]]; };
    const dev = (q, a, b) => Math.sqrt(segD2(q[0], q[1], a[0], a[1], b[0], b[1]));
    const sub = (ta, pa, tb, pb, d) => { const tm = (ta + tb) / 2, pm = bz(tm), q1 = bz((ta + tm) / 2), q3 = bz((tm + tb) / 2); if (Math.max(dev(pm, pa, pb), dev(q1, pa, pb), dev(q3, pa, pb)) > tol && d < 24) { sub(ta, pa, tm, pm, d + 1); sub(tm, pm, tb, pb, d + 1); } else out.push(pb); };
    sub(0, p1, 0.5, bz(0.5), 0); sub(0.5, bz(0.5), 1, p2, 0);
  }
  if (closed) out.pop();
  return out;
}
function convert(list, blocks, M, out, info, depth) {
  const s = mScale(M);
  for (let idx = 0; idx < list.length; idx++) {
    const e = list[idx]; const ext = gv(e, 230, 1) < 0;
    switch (e.type) {
      case "LINE": emit([[gv(e, 10, 0), gv(e, 20, 0)], [gv(e, 11, 0), gv(e, 21, 0)]], false, ext, M, out); break;
      case "LWPOLYLINE": { const vs = []; for (const [c, v] of e.p) { if (c === 10) vs.push({ x: +v, y: 0, b: 0 }); else if (c === 20 && vs.length) vs[vs.length - 1].y = +v; else if (c === 42 && vs.length) vs[vs.length - 1].b = +v; } polyFrom(vs, (gv(e, 70, 0) & 1) === 1, ext, M, out); break; }
      case "POLYLINE": { const fl = gv(e, 70, 0); const vs = []; let j = idx + 1; while (j < list.length && list[j].type === "VERTEX") { const v = list[j]; if (!(gv(v, 70, 0) & 16)) vs.push({ x: gv(v, 10, 0), y: gv(v, 20, 0), b: gv(v, 42, 0) }); j++; } if (j < list.length && list[j].type === "SEQEND") j++; idx = j - 1; if (!(fl & (16 | 64))) polyFrom(vs, (fl & 1) === 1, ext, M, out); break; }
      case "CIRCLE": { const p = arcPts(gv(e, 10, 0), gv(e, 20, 0), gv(e, 40, 0), 0, TAU, s); p.pop(); emit(p, true, ext, M, out); break; }
      case "ARC": { const a0 = gv(e, 50, 0) * Math.PI / 180, a1 = gv(e, 51, 0) * Math.PI / 180; let sw = a1 - a0; while (sw <= 0) sw += TAU; emit(arcPts(gv(e, 10, 0), gv(e, 20, 0), gv(e, 40, 0), a0, sw, s), false, ext, M, out); break; }
      case "ELLIPSE": { const cx = gv(e, 10, 0), cy = gv(e, 20, 0), mx = gv(e, 11, 1), my = gv(e, 21, 0), ra = gv(e, 40, 1), t0 = gv(e, 41, 0); let sw = gv(e, 42, TAU) - t0; while (sw <= 0) sw += TAU; const full = Math.abs(sw - TAU) < 1e-6; const R = Math.hypot(mx, my) * s, rc = Math.max(1e-6, Math.min(R, R * ra * ra, R / (ra * ra || 1))); const n = Math.max(16, Math.ceil(sw / Math.min(Math.PI / 36, 2 * Math.acos(Math.max(-1, 1 - Math.min(CT, rc) / rc))))); const p = []; for (let k = 0; k <= n; k++) { const t = t0 + sw * k / n, c = Math.cos(t), si = Math.sin(t); p.push([cx + mx * c - ra * my * si, cy + my * c + ra * mx * si]); } if (full) p.pop(); emit(p, full, ext, M, out); break; }
      case "SPLINE": { const deg = gv(e, 71, 3), fl = gv(e, 70, 0); const K = [], W = [], C = [], F = []; let lc = null, lf = null; for (const [c, v] of e.p) { if (c === 40) K.push(+v); else if (c === 41) W.push(+v); else if (c === 10) { lc = [+v, 0]; C.push(lc); } else if (c === 20 && lc) lc[1] = +v; else if (c === 11) { lf = [+v, 0]; F.push(lf); } else if (c === 21 && lf) lf[1] = +v; } let p = C.length >= 2 ? nurbs(deg, K, C, W, CT / (s || 1)) : fitCurve(F, (fl & 1) === 1, CT / (s || 1)); if (p.length < 2) break; let closed = (fl & 1) === 1; if (dist(p[0], p[p.length - 1]) < 1e-9) { p = p.slice(0, -1); closed = true; } emit(p, closed, ext, M, out); break; }
      case "INSERT": { const b = blocks[gs(e, 2)]; if (!b || depth > 8) break; const px = gv(e, 10, 0), py = gv(e, 20, 0), sx = gv(e, 41, 1), sy = gv(e, 42, 1), rot = gv(e, 50, 0) * Math.PI / 180; const co = Math.cos(rot), si = Math.sin(rot); let L = [sx * co, sx * si, -sy * si, sy * co, 0, 0]; L[4] = px - (L[0] * b.base[0] + L[2] * b.base[1]); L[5] = py - (L[1] * b.base[0] + L[3] * b.base[1]); if (ext) L = [-L[0], L[1], -L[2], L[3], -L[4], L[5]]; convert(b.ents, blocks, mul(M, L), out, info, depth + 1); break; }
      case "TEXT": case "MTEXT": info.text++; break;
      case "VERTEX": case "SEQEND": break;
      default: info.ignored[e.type] = (info.ignored[e.type] || 0) + 1;
    }
  }
}

