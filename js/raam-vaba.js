/* Valgustähed — raam-vaba.js
   Vaba kujuga raam: profiilid suvalise nurga all (S.rails = [{ a:[x,y], b:[x,y], w }]).
   Joonistatakse ahelana nurk-nurga haaval; kokku saavad profiilid lõigatakse nurgalõikega (gärung),
   horisontaalse profiili või pulga vastu tulev ots lõigatakse selle servaga paralleelselt.
   Kinnitusavad tulevad automaatselt profiili keskjoonele tähtede sisse.
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */
const RV = {
  sub: (p, q) => [p[0] - q[0], p[1] - q[1]], add: (p, q) => [p[0] + q[0], p[1] + q[1]], mul: (p, k) => [p[0] * k, p[1] * k],
  len: p => Math.hypot(p[0], p[1]), dot: (p, q) => p[0] * q[0] + p[1] * q[1], cross: (p, q) => p[0] * q[1] - p[1] * q[0],
  norm: p => { const l = Math.hypot(p[0], p[1]) || 1; return [p[0] / l, p[1] / l]; }
};
const RAIL_EPS = 0.5;
const hasFrame = () => (S.bars || []).length > 0 || (S.rails || []).length > 0;
const near = (p, q, e = RAIL_EPS) => Math.abs(p[0] - q[0]) <= e && Math.abs(p[1] - q[1]) <= e;

/* centre point of a bar end (end 0 = left x0, 1 = right x1) */
const barEndPt = (b, end) => [end ? b.x1 : b.x0, b.y];
/* cut line direction at one end of a rail (end 0 = a, 1 = b) */
function railCut(r, end) {
  const P = end ? r.b : r.a, Q = end ? r.a : r.b, u = RV.norm(RV.sub(Q, P)), sq = [-u[1], u[0]];
  if (r.link === false) return { dir: sq, kind: "free" }; /* not connected: square end */
  /* corner with a horizontal profile: the rail end sits on the bar end centre -> both mitred */
  for (const b of S.bars || []) for (const e of [0, 1]) if (b.link !== false && near(P, barEndPt(b, e), 1)) { const v = [e ? -1 : 1, 0]; if (Math.abs(RV.cross(u, v)) < 1e-6) return { dir: sq, kind: "straight" }; return { dir: RV.norm(RV.add(u, v)), kind: "miter" }; }
  for (const o of S.rails || []) {
    if (o === r || o.link === false) continue; const other = near(o.a, P) ? o.b : near(o.b, P) ? o.a : null; if (!other) continue;
    const v = RV.norm(RV.sub(other, P));
    if (Math.abs(RV.cross(u, v)) < 1e-6) return { dir: sq, kind: "straight" }; /* straight continuation: square cut */
    return { dir: RV.norm(RV.add(u, v)), kind: "miter" };
  }
  for (const b of S.bars || []) if (b.link !== false && P[0] >= b.x0 - RAIL_EPS && P[0] <= b.x1 + RAIL_EPS && (Math.abs(P[1] - (b.y + b.h / 2)) < RAIL_EPS || Math.abs(P[1] - (b.y - b.h / 2)) < RAIL_EPS)) return { dir: [1, 0], kind: "bar" };
  for (const q of S.posts || []) if (q.link !== false) for (const [lo, hi] of Core.postSegs(S.bars, q)) if (P[1] >= lo - RAIL_EPS && P[1] <= hi + RAIL_EPS && (Math.abs(P[0] - (q.x - q.w / 2)) < RAIL_EPS || Math.abs(P[0] - (q.x + q.w / 2)) < RAIL_EPS)) return { dir: [0, 1], kind: "post" };
  return { dir: sq, kind: "free" };
}
/* outline (4 corners), lengths and cut angles of a rail */
function railGeom(r) {
  const u = RV.norm(RV.sub(r.b, r.a)), n = [-u[1], u[0]], h = (r.w || cfg.profile) / 2, L = RV.len(RV.sub(r.b, r.a));
  const ends = [railCut(r, 0), railCut(r, 1)];
  const hitT = (p0, P, c) => { const den = RV.cross(u, c.dir); if (Math.abs(den) < 1e-6) return RV.dot(RV.sub(P, p0), u); return RV.cross(RV.sub(P, p0), c.dir) / den; };
  const side = s => { const p0 = RV.add(r.a, RV.mul(n, s * h)); const t0 = hitT(p0, r.a, ends[0]), t1 = hitT(p0, r.b, ends[1]); return [RV.add(p0, RV.mul(u, t0)), RV.add(p0, RV.mul(u, t1)), t1 - t0]; };
  const [a1, b1, l1] = side(1), [a2, b2, l2] = side(-1);
  const ang = c => { const v = Math.abs(RV.dot(c.dir, n)); return Math.round(Math.acos(Math.min(1, v)) * 180 / Math.PI * 2) / 2; }; /* saw angle, 0,5° steps */
  return { poly: [a1, b1, b2, a2], len: L, long: Math.max(l1, l2), short: Math.min(l1, l2), angA: ang(ends[0]), angB: ang(ends[1]), ends, u, n, h };
}
const railDeg = v => (Math.round(v * 10) / 10).toString().replace(".", ",") + "°";
/* point inside the rail outline */
function inPoly(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function railAt(x, y) { if (!on("ly_frame")) return -1; const rs = S.rails || []; for (let i = rs.length - 1; i >= 0; i--) if (inPoly([x, y], railGeom(rs[i]).poly)) return i; return -1; }
/* rail end handle under the pointer (screen px) */
function railEndAt(px, py) {
  if (!on("ly_frame")) return null;
  for (const r of S.rails || []) for (const k of ["a", "b"]) if (Math.hypot(tx(r[k][0]) - px, ty(r[k][1]) - py) <= 8) return { r, k, p: r[k].slice() };
  return null;
}

/* ---------- horizontal profile ends against free-angle profiles ----------
   corner: a rail end on the bar end centre -> mitre (cut on the bisector);
   T: a rail crosses the bar near its end -> the bar end is cut along the rail's near edge and the bar is made to reach it.
   b.ea / b.eb = { p, d } cut line of the left / right end (null = square). */
function barRailCuts() {
  for (const b of S.bars || []) {
    b.ea = null; b.eb = null; if (!(S.rails || []).length || b.link === false) continue;
    for (const end of [0, 1]) {
      const P = barEndPt(b, end), v = [end ? -1 : 1, 0]; let cut = null;
      for (const r of S.rails) for (const k of ["a", "b"]) if (!cut && r.link !== false && near(r[k], P, 1)) { const Q = k === "a" ? r.b : r.a, u = RV.norm(RV.sub(Q, P)); if (Math.abs(RV.cross(u, v)) > 1e-6) cut = { p: P.slice(), d: RV.norm(RV.add(u, v)) }; }
      if (!cut) for (const r of S.rails) {
        if (r.link === false) continue; const g = railGeom(r), tol = Math.max(b.h, r.w || cfg.profile) * 1.5; if (Math.abs(g.u[1]) < 0.05) continue; /* almost horizontal: no T */
        const t = (b.y - r.a[1]) / g.u[1], xi = r.a[0] + g.u[0] * t; if (t < -1 || t > g.len + 1 || Math.abs(xi - P[0]) > tol) continue;
        /* the rail must cover the full bar height at the crossing */
        const tLo = (b.y - b.h / 2 - r.a[1]) / g.u[1], tHi = (b.y + b.h / 2 - r.a[1]) / g.u[1]; if (Math.min(tLo, tHi) < -g.h || Math.max(tLo, tHi) > g.len + g.h) continue;
        const inner = [P[0] + v[0] * (tol + 1), b.y], s = Math.sign(RV.dot(RV.sub(inner, r.a), g.n)) || 1;
        cut = { p: RV.add(r.a, RV.mul(g.n, s * g.h)), d: g.u.slice() }; break;
      }
      if (!cut) continue;
      /* the bar centre line ends on the cut */
      const xc = Core.cutX(cut, b.y, P[0]); if (end) b.x1 = xc; else b.x0 = xc;
      if (end) b.eb = cut; else b.ea = cut;
    }
  }
}
/* rails attached to a bar: ends on its top/bottom edge, or on a bar end centre (corner) */
function barRailLinks(b) {
  const out = []; if (b.link === false) return out;
  for (const r of S.rails || []) if (r.link !== false) for (const k of ["a", "b"]) {
    const P = r[k], o = { r, k, P0: P.slice(), Q0: (k === "a" ? r.b : r.a).slice() };
    const ce = [0, 1].find(e => near(P, barEndPt(b, e), 1)); if (ce != null) { out.push(Object.assign(o, { corner: ce })); continue; }
    if (P[0] < b.x0 - 1 || P[0] > b.x1 + 1) continue;
    for (const s of [1, -1]) if (Math.abs(P[1] - (b.y + s * b.h / 2)) < 1) { out.push(Object.assign(o, { side: s })); break; }
  }
  /* drawn vertical posts with an end on this bar's edge */
  for (const q of S.posts || []) { if (!q.fixed || !q.seg || q.link === false || q.x < b.x0 - 1 || q.x > b.x1 + 1) continue;
    for (const end of [0, 1]) for (const s of [1, -1]) if (Math.abs(q.seg[end] - (b.y + s * b.h / 2)) < 1) out.push({ post: q, end, side: s }); }
  return out;
}
/* moved / stretched bar: attached rail ends follow; an edge end slides along its rail (the rail keeps its angle, the length changes), a corner end goes to the new bar end */
function barRailFollow(b, links) {
  for (const l of links || []) {
    if (l.post) { const q = l.post, v = b.y + l.side * b.h / 2, min = q.w * 2; q.seg[l.end] = l.end ? Math.max(v, q.seg[0] + min) : Math.min(v, q.seg[1] - min); continue; }
    if (l.corner != null) { l.r[l.k] = barEndPt(b, l.corner); continue; }
    const Q = l.k === "a" ? l.r.b : l.r.a, dir = RV.sub(l.P0, l.Q0); if (Math.abs(dir[1]) < 1e-6) continue;
    const ye = b.y + l.side * b.h / 2, t = (ye - Q[1]) / dir[1]; if (t <= 0.05) continue; /* the bar passed the other end */
    l.r[l.k] = [Q[0] + dir[0] * t, ye];
  }
}
/* outline of a whole bar (angled ends included) */
function barPoly(b) { const lo = b.y - b.h / 2, hi = b.y + b.h / 2; return [[Core.cutX(b.ea, lo, b.x0), lo], [Core.cutX(b.eb, lo, b.x1), lo], [Core.cutX(b.eb, hi, b.x1), hi], [Core.cutX(b.ea, hi, b.x0), hi]]; }
/* pieces of a bar (split by joints): longer edge and the two saw angles */
function barPieces2(b) {
  const xs = [b.x0, ...((b.j && b.j.xs) || []), b.x1], lo = b.y - b.h / 2, hi = b.y + b.h / 2, n = xs.length - 1, out = [];
  const ang = e => e ? Math.round(Math.acos(Math.min(1, Math.abs(e.d[1]))) * 180 / Math.PI * 2) / 2 : 0;
  for (let i = 1; i <= n; i++) { const L = i === 1 ? b.ea : null, R = i === n ? b.eb : null;
    const top = Core.cutX(R, hi, xs[i]) - Core.cutX(L, hi, xs[i - 1]), bot = Core.cutX(R, lo, xs[i]) - Core.cutX(L, lo, xs[i - 1]);
    out.push({ long: Math.max(top, bot), angA: ang(L), angB: ang(R) }); }
  return out;
}

/* ---------- automatic mounting holes on the rail centre line, inside the letters ---------- */
function railHoles() {
  const out = [], d = cfg.mountD || 6, lim = cfg.mountTwo || 160;
  const onBar = (x, y) => (S.bars || []).some(b => x >= b.x0 - 0.5 && x <= b.x1 + 0.5 && Math.abs(Math.abs(y - b.y) - b.h / 2) < 0.6);
  /* posts: drawn ones with a free end, and any post whose holes were switched on by hand (not dot posts: they have their own) */
  const free = (S.posts || []).filter(q => q.dot == null && q.holes !== false && (q.holes === true || q.fixed)).flatMap(q => Core.postSegs(S.bars, q).filter(g => q.holes === true || !(onBar(q.x, g[0]) && onBar(q.x, g[1]))).map(g => ({ a: [q.x, g[0]], b: [q.x, g[1]], w: q.w })));
  for (const r of [...(S.rails || []).filter(r => r.holes !== false), ...free]) {
    const g = railGeom(r), st = 1, e = Math.max(cfg.mountEnd > 0 ? cfg.mountEnd : g.h, d / 2 + 2), iv = [];
    let cur = null;
    for (let t = 0; t <= g.len + 1e-6; t += st) {
      const p = RV.add(r.a, RV.mul(g.u, t)), pts = [p, RV.add(p, RV.mul(g.n, g.h - 0.5)), RV.add(p, RV.mul(g.n, -(g.h - 0.5)))];
      const li = S.letters.findIndex(L => pts.every(q => Core.inLetter(L, q[0], q[1])));
      if (li >= 0 && cur && cur.li === li) cur.t1 = t; else { if (cur) iv.push(cur); cur = li >= 0 ? { li, t0: t, t1: t } : null; }
    }
    if (cur) iv.push(cur);
    for (const v of iv) {
      const a = Math.max(v.t0, e), c = Math.min(v.t1, g.len - e), wd = v.t1 - v.t0; if (c - a < d + 4) continue;
      const ts = wd > lim ? [v.t0 + wd / 4, v.t0 + wd * 3 / 4] : [(v.t0 + v.t1) / 2];
      for (let t of ts) { t = Math.min(Math.max(t, a + d / 2 + 2), c - d / 2 - 2); const p = RV.add(r.a, RV.mul(g.u, t));
        if (!out.some(o => Math.hypot(o.x - p[0], o.y - p[1]) < d * 1.5)) out.push({ x: p[0], y: p[1], L: v.li, w: wd, rail: true }); }
    }
  }
  return out;
}

/* ---------- cut list ---------- */
function railCutList() {
  const cnt = new Map();
  const add = (long, a, b) => { const A = [a, b].sort((p, q) => q - p), k = `${Math.round(long)}|${A[0]}|${A[1]}`; cnt.set(k, (cnt.get(k) || 0) + 1); };
  for (const r of S.rails || []) { const g = railGeom(r); add(g.long, g.angA, g.angB); }
  for (const b of S.bars || []) if (b.ea || b.eb) for (const pc of barPieces2(b)) if (pc.angA || pc.angB) add(pc.long, pc.angA, pc.angB);
  return [...cnt.entries()].map(([k, n]) => { const [len, a, b] = k.split("|").map(Number); return { len, a, b, n }; }).sort((p, q) => q.len - p.len);
}
const railLine = c => `L-${c.len}mm` + (c.a || c.b ? ` ${railDeg(c.a)}/${railDeg(c.b)}` : "") + `, ${c.n}tk`;
const railLenTotal = () => (S.rails || []).reduce((s, r) => s + railGeom(r).long, 0);

/* ---------- drawing (2D) ---------- */
function drawRails() {
  if (!on("ly_frame")) return;
  const rs = S.rails || [];
  rs.forEach((r, i) => {
    const g = railGeom(r), sel = S.sel && S.sel.k === "rail" && S.sel.i === i;
    ctx.beginPath(); g.poly.forEach((p, k) => k ? ctx.lineTo(tx(p[0]), ty(p[1])) : ctx.moveTo(tx(p[0]), ty(p[1]))); ctx.closePath();
    ctx.fillStyle = C.frame + "33"; ctx.fill(); ctx.lineWidth = sel ? 2.2 : 1; ctx.strokeStyle = sel ? C.skel : C.frame; ctx.stroke();
    /* length along the rail */
    const m = RV.mul(RV.add(r.a, r.b), 0.5); let ang = Math.atan2(-(r.b[1] - r.a[1]), r.b[0] - r.a[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
    if (g.len * view.s > 40) { ctx.save(); ctx.translate(tx(m[0]), ty(m[1])); ctx.rotate(ang); ctx.fillStyle = C.muted; ctx.font = "11px " + css("--f-mono"); ctx.textAlign = "center"; ctx.fillText(String(Math.round(g.long)), 0, -g.h * view.s - 4); ctx.restore(); }
    if (S.tool === "select" || S.tool === "rail") { ctx.fillStyle = C.frame; for (const p of [r.a, r.b]) ctx.fillRect(tx(p[0]) - 3.5, ty(p[1]) - 3.5, 7, 7); }
  });
  /* chain being drawn */
  const d = S.railDraft;
  if (d && d.pts.length && d.cur) {
    const a = d.pts[d.pts.length - 1], b = d.cur, w = cfg.profile, u = RV.norm(RV.sub(b, a)), n = RV.mul([-u[1], u[0]], w / 2);
    ctx.save(); ctx.setLineDash([6, 4]); ctx.strokeStyle = C.skel; ctx.lineWidth = 1.4; ctx.beginPath();
    for (const p of [RV.add(a, n), RV.add(b, n), RV.sub(b, n), RV.sub(a, n)]) ctx.lineTo(tx(p[0]), ty(p[1])); ctx.closePath(); ctx.stroke(); ctx.restore();
    const L = RV.len(RV.sub(b, a)), deg = Math.round(Math.atan2(b[1] - a[1], b[0] - a[0]) * 1800 / Math.PI) / 10;
    ctx.fillStyle = C.skel; ctx.font = "12px " + css("--f-mono"); ctx.textAlign = "left"; ctx.fillText(`${Math.round(L)} mm · ${String(deg).replace(".", ",")}°`, tx(b[0]) + 10, ty(b[1]) - 10);
    if (d.snap) { ctx.strokeStyle = C.skel; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(tx(d.snap[0]), ty(d.snap[1]), 7, 0, Math.PI * 2); ctx.stroke(); }
  }
}

/* ---------- snapping ---------- */
/* exact point: other rail ends, bar / post corners and edges near the pointer; Shift = 15° steps from `from` */
function railSnap(x, y, from, shift, skip) {
  const tol = 9 / view.s; let best = null; const take = (p, kind) => { const dd = Math.hypot(p[0] - x, p[1] - y); if (dd < tol && (!best || dd < best.d)) best = { p, d: dd, kind }; };
  for (const r of S.rails || []) for (const k of ["a", "b"]) if (!(skip && skip.some(s => s.r === r && s.k === k))) take(r[k], "end");
  if (S.railDraft && S.railDraft.pts.length > 1) take(S.railDraft.pts[0], "start");
  for (const b of S.bars || []) for (const e of [0, 1]) take(barEndPt(b, e), "barEnd");
  if (best) return { p: best.p.slice(), kind: best.kind };
  let p = [x, y];
  if (shift && from) { const v = RV.sub(p, from), L = RV.len(v), a = Math.round(Math.atan2(v[1], v[0]) / (Math.PI / 12)) * (Math.PI / 12); p = [from[0] + L * Math.cos(a), from[1] + L * Math.sin(a)]; }
  else {
    p = [Math.round(p[0]), Math.round(p[1])];
    /* almost horizontal / vertical (within 3°) -> exactly; Alt keeps the drawn angle */
    if (from && !(window.event && window.event.altKey)) { const v = RV.sub(p, from), a = Math.abs(Math.atan2(v[1], v[0]) * 180 / Math.PI);
      if (a < 3 || a > 177) p[1] = from[1]; else if (Math.abs(a - 90) < 3) p[0] = from[0]; }
    /* onto a bar edge or centre line (height) and a post edge or centre (x) close by */
    let by = null; for (const b of S.bars || []) for (const yy of [b.y - b.h / 2, b.y, b.y + b.h / 2]) { const dd = Math.abs(yy - p[1]); if (dd < tol && (!by || dd < by.d) && (!from || Math.abs(from[1] - p[1]) > 1e-6 || Math.abs(yy - from[1]) < 1e-6)) by = { v: yy, d: dd }; }
    let bx = null; for (const q of S.posts || []) for (const xx of [q.x - q.w / 2, q.x, q.x + q.w / 2]) { const dd = Math.abs(xx - p[0]); if (dd < tol && (!bx || dd < bx.d) && (!from || Math.abs(from[0] - p[0]) > 1e-6 || Math.abs(xx - from[0]) < 1e-6)) bx = { v: xx, d: dd }; }
    if (by && !(from && Math.abs(from[1] - p[1]) < 1e-6 && Math.abs(by.v - from[1]) > 1e-6)) p[1] = by.v;
    if (bx && !(from && Math.abs(from[0] - p[0]) < 1e-6 && Math.abs(bx.v - from[0]) > 1e-6)) p[0] = bx.v;
  }
  return { p, kind: null };
}
/* an end inside a bar or post is moved onto the edge that faces the other end, along the rail line */
function railFit(r) {
  if (r.link === false) return;
  for (const k of ["a", "b"]) {
    const P = r[k], Q = k === "a" ? r.b : r.a;
    if ((S.bars || []).some(b => near(P, barEndPt(b, 0), 1) || near(P, barEndPt(b, 1), 1))) continue; /* corner with a bar end */
    for (const b of S.bars || []) {
      if (P[0] < b.x0 - 1 || P[0] > b.x1 + 1 || Math.abs(P[1] - b.y) > b.h / 2 + 0.01) continue;
      const ye = b.y + Math.sign(Q[1] - b.y || 1) * b.h / 2; if (Math.abs(Q[1] - P[1]) < 1e-6) continue;
      const t = (ye - P[1]) / (Q[1] - P[1]); r[k] = [P[0] + (Q[0] - P[0]) * t, ye]; break;
    }
    for (const q of S.posts || []) for (const [lo, hi] of Core.postSegs(S.bars, q)) {
      const P2 = r[k]; if (P2[1] < lo - 1 || P2[1] > hi + 1 || Math.abs(P2[0] - q.x) > q.w / 2 + 0.01) continue;
      const xe = q.x + Math.sign(Q[0] - q.x || 1) * q.w / 2; if (Math.abs(Q[0] - P2[0]) < 1e-6) continue;
      const t = (xe - P2[0]) / (Q[0] - P2[0]); r[k] = [xe, P2[1] + (Q[1] - P2[1]) * t];
    }
  }
}

/* ---------- drawing tool: click corner by corner; double click, right click, Esc or the first corner ends the chain ---------- */
function railClick(x, y, e) {
  const d = S.railDraft || (S.railDraft = { pts: [], cur: null, snap: null });
  const from = d.pts[d.pts.length - 1], s = railSnap(x, y, from, e.shiftKey);
  if (!from) { d.pts.push(s.p); d.cur = s.p; draw(); $("hint").textContent = "Kliki järgmisele nurgale · Shift = 15° sammud · topeltklikk, parem klikk või Esc lõpetab · klikk esimesel nurgal sulgeb ahela"; return; }
  if (RV.len(RV.sub(s.p, from)) < cfg.profile) { /* second click of a double click */
    const lone = d.pts.length === 1; railEnd();
    if (lone) { if (S.bars.length && gapAt(x, y)) addPostAt(x, y); else addBarAt(y); } /* double click on one spot: automatic profile / post like before */
    return;
  }
  snapshot(); const a = from.slice(), b = s.p.slice(), w = cfg.profile; let msg;
  if (Math.abs(a[1] - b[1]) < 1e-6) { /* horizontal: a real horizontal profile with the drawn length */
    const nb = { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y: a[1], h: w, fixEnds: true }; Core.snapBars([nb], S.posts || []); S.bars.push(nb); msg = `Horisontaalne profiil ${Math.round(nb.x1 - nb.x0)} mm`;
  } else if (Math.abs(a[0] - b[0]) < 1e-6) { /* vertical: a post with the drawn span, ends inside a bar go to its edge */
    let lo = Math.min(a[1], b[1]), hi = Math.max(a[1], b[1]); const x = a[0];
    for (const bb of S.bars || []) { if (x < bb.x0 - 0.5 || x > bb.x1 + 0.5) continue; const e0 = bb.y - bb.h / 2, e1 = bb.y + bb.h / 2; if (lo >= e0 - 0.5 && lo <= e1 + 0.5) lo = e1; if (hi >= e0 - 0.5 && hi <= e1 + 0.5) hi = e0; }
    if (hi - lo < 1) { undo.pop(); toast("Pulk jääks liiga lühikeseks."); d.pts.push(b); return; }
    const q = { x, w, seg: [lo, hi], fixed: true }; S.posts = (S.posts || []).concat([q]); msg = `Vertikaalne pulk ${Math.round(hi - lo)} mm`;
  } else { const r = { a, b, w }; railFit(r); S.rails = (S.rails || []).concat([r]); msg = `Profiil nurga all ${Math.round(railGeom(r).long)} mm`; }
  S.manual = true; const closed = d.pts.length > 1 && near(s.p, d.pts[0]); d.pts.push(b); recompute(); toast(msg);
  if (closed) railEnd();
}
function railMove(x, y, e) { const d = S.railDraft; if (!d || !d.pts.length) return; const s = railSnap(x, y, d.pts[d.pts.length - 1], e.shiftKey); d.cur = s.p; d.snap = s.kind ? s.p : null; draw(); }
function railEnd() { if (!S.railDraft) return; S.railDraft = null; draw(); if (S.tool === "rail") setTool("rail"); }

/* ---------- editing: drag a corner (all rails meeting there move together) ---------- */
function railDragStart(h) { const refs = []; for (const r of S.rails || []) for (const k of ["a", "b"]) if (near(r[k], h.p)) refs.push({ r, k }); return { k: "railEnd", refs, moved: false }; }
function railDragMove(dg, x, y, e) {
  const first = dg.refs[0], other = first.k === "a" ? first.r.b : first.r.a, s = railSnap(x, y, other, e.shiftKey, dg.refs);
  for (const f of dg.refs) f.r[f.k] = s.p.slice(); dg.moved = true; refreshMounts();
  $("hint").textContent = dg.refs.map(f => `${Math.round(railGeom(f.r).long)} mm`).join(" · "); draw();
}
function railDragEnd(dg) { if (!dg.moved) { undo.pop(); return; } for (const f of dg.refs) railFit(f.r); S.manual = true; recompute(); }
function railDelete(i) { S.rails.splice(i, 1); }

/* ---------- 3D ---------- */
function railMeshes(g3, mat, pd) {
  for (const r of S.rails || []) { const g = railGeom(r); const shape = new THREE.Shape(g.poly.map(p => new THREE.Vector2(p[0], p[1])));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: pd, bevelEnabled: false }); const m = new THREE.Mesh(geo, mat); m.position.z = -pd; g3.add(m); }
}
