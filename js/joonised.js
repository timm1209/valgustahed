/* Valgustähed — joonised.js
   Raami joonis, tootmisjoonis (Üldjoonis) ja joonised PDF-ina.
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */
async function exportFrame() {
  if (!(S.bars || []).length) { toast("Raami pole."); return; }
  const useTpl = tplActive() && await tplEnsure();
  const { txt, origin } = frameDXF();
  if (useTpl) { await saveTpl(tplFileName(" raam"), txt, origin); return; }
  await saveCad(baseName() + "_RAAM", txt);
}
/* the frame workshop drawing as DXF text (+ its lower-left corner for the template) */
function frameDXF() {
  const DS = 15, parts = frameParts(), groups = [], outBars = [], outPosts = [];
  const gx = Math.min(...S.bars.map(b => b.x0)), ytop = Math.max(...S.bars.map(b => b.y + b.h / 2)), ybot = Math.min(...S.bars.map(b => b.y - b.h / 2)), H = ytop - ybot;
  const pitch = H + 2 * 10 * DS + 2 * 12 * DS; /* frame height + dimension rows above and below + text */
  const seenLen = new Set();
  parts.forEach((pt, k) => {
    const px = Math.min(...pt.bars.map(b => b.x0)), dx = gx - px, dy = -k * pitch;
    const bars = pt.bars.map(b => ({ x0: b.x0 + dx, x1: b.x1 + dx, y: b.y + dy, h: b.h })).sort((a, b) => b.y - a.y);
    const segs = pt.segs.map(s => ({ x: s.x + dx, w: s.w, lo: s.lo + dy, hi: s.hi + dy }));
    outBars.push(...bars); for (const s of segs) outPosts.push({ x: s.x, w: s.w, dot: -1, seg: [s.lo, s.hi] });
    const top = bars[0], bot = bars[bars.length - 1];
    const on = (b, s) => s.x > b.x0 + 0.5 && s.x < b.x1 - 0.5 && (Math.abs(s.lo - (b.y + b.h / 2)) < 0.5 || Math.abs(s.hi - (b.y - b.h / 2)) < 0.5);
    const lefts = b => [...new Set(segs.filter(s => on(b, s)).map(s => Math.round((s.x - s.w / 2) * 1000) / 1000))].filter(x => x > b.x0 + 0.5).sort((p, q) => p - q);
    /* one row per bar, every value from the bar's start, the bar's end last; the top row sits above posts that stick up over the bar,
       and their extension lines start at the post's end */
    const uniq = a => [...new Set(a.map(x => Math.round(x * 1000) / 1000))].sort((p, q) => p - q);
    const tEdge = top.y + top.h / 2, upAt = x => { const s = segs.find(q => Math.abs(q.x - q.w / 2 - x) < 0.6 && q.lo >= tEdge - 0.5 && q.hi > tEdge + 0.5); return s ? s.hi : tEdge; };
    const tPts = uniq([top.x0, ...lefts(top), top.x1]), tUp = Math.max(tEdge, ...tPts.map(upAt));
    groups.push({ side: 1, edge: tEdge, e2: tEdge, e2s: tPts.map(upAt), pts: tPts, off: (tUp - tEdge) + 5 * DS });
    if (bot !== top) {
      const bEdge = bot.y - bot.h / 2, bPts = uniq([bot.x0, ...lefts(bot).slice(0, 1), bot.x1]);
      groups.push({ side: -1, edge: bEdge, e2: bEdge, pts: bPts, off: 5 * DS });
      groups.push({ vert: true, side: -1, edge: gx, e1: bot.x0, e2: top.x0, pts: [bot.y - bot.h / 2, top.y + top.h / 2], off: 4 * DS });
    }
    for (const s of segs) { const L = Math.round(s.hi - s.lo); if (seenLen.has(L)) continue; seenLen.add(L); const atStart = s.x - s.w / 2 - gx < 8 * DS, e = atStart ? s.x + s.w / 2 : s.x - s.w / 2; /* a post at the frame start gets its length on the right, clear of the height column */
      groups.push({ vert: true, side: atStart ? 1 : -1, edge: e, e2: e, pts: [s.lo, s.hi], off: 3 * DS }); }
  });
  const list = frameCutList(), xmax = Math.max(...outBars.map(b => b.x1));
  const info = [frameMaterialLine(), ...list.map(([len, n]) => `L-${len}mm, ${n}tk`)];
  const txt = Core.writeDXF({ only: new Set(["RAAM", "MOODUD", "INFO"]), letters: [], chains: [], leds: [], holes: [], mounts: [], bars: outBars, posts: outPosts, prof: null, types: cfg.types, dimGroups: groups, dimInt: true,
    info, infoX: xmax + 25 * DS, infoY: ytop - 3 * DS, infoH: 3 * DS });
  const ylo = Math.min(...outBars.map(b => b.y - b.h / 2)), infoW = Math.max(...info.map(s => String(s).length)) * 3 * DS * 0.62;
  return { txt, origin: [Math.min(...outBars.map(b => b.x0)), ylo], box: [Math.min(...outBars.map(b => b.x0)) - 6 * DS, ylo - 12 * DS, xmax + 25 * DS + infoW, ytop + 12 * DS] };
}
$("btnExportFrame").addEventListener("click", exportFrame);
/* ===================== PRODUCTION DRAWING (Üldjoonis) =====================
   A3 sheet drawn in model space around the real-size sign at a standard scale 1:k: border, sign with frame,
   mounting holes and their dimensions, overall width, a small preview and the title block with the order and part data. */
const SHEET_W = 420, SHEET_H = 297, TB_W = 92;
function pickScale(w, h, aw, ah) { for (const k of [1, 2, 2.5, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100]) if (w / k <= aw && h / k <= ah) return k; return 200; }
/* rows of the title block: [section, label, lines[]] ; group values give one line per part ("Logo- …") */
function titleRows() {
  const o = S.order, G = usedGroups(), multi = G.length > 1;
  const gl = k => { const v = G.map(g => (g[k] || "").trim()); if (!v.some(Boolean)) return [""]; if (!multi || v.every(x => x === v[0])) return [v[0]]; return G.map((g, i) => `${g.name}- ${v[i] || ""}`); };
  const tt = t => ({ p3: "P3", liist: "P6", klaas: "P6" })[t || "liist"] || "";
  const types = G.map(g => tt(g.profType || cfg.profType)), typeTxt = multi && types.some(t => t !== types[0]) ? G.map((g, i) => `${g.name}- ${types[i]}`) : [types[0] || tt(cfg.profType)];
  const title = (o.title || "").trim() || (S.name || "").replace(/\.(dxf|dwg)$/i, "");
  return [
    ["", "Töö nimi", [title]], ["", "Tellimus", [o.orderNo || ""]], ["", "Kuupäev", [o.date || ""]], ["", "Tähtaeg", [o.due || ""]],
    ["", "Kogus", [o.qty || ""]], ["", "Profiil", typeTxt], ["", "Asukoht", [o.location || ""]], ["", "Joonestas", [o.drafter || ""]],
    ["Esipind", "Materjal", gl("faceMat")], ["Esipind", "Kleebis / värv", (() => { const v = G.map(g => (g.faceFilm || "").trim() || (g.faceColor || "").trim()); if (!v.some(Boolean)) return [""]; return !multi || v.every(x => x === v[0]) ? [v[0]] : G.map((g, i) => `${g.name}- ${v[i]}`); })()],
    ["Külg", "Tähe sügavus", usedGroups().length > 1 && new Set(usedGroups().map(g => sideSpec(g).text)).size > 1 ? usedGroups().map(g => `${g.name}- ${sideSpec(g).text}`) : [sideSpec(usedGroups()[0]).text]], ["Külg", "Värv", gl("sideColor")], ["Külg", "Kruvid", gl("screws")], ["Külg", "Kruvide kogus", (() => { const v = G.map(g => screwQty(g)); if (!v.some(Boolean)) return [""]; return !multi || v.every(x => x === v[0]) ? [v[0]] : G.map((g, i) => `${g.name}- ${v[i]}`); })()],
    ["Tagapind", "Materjal", (() => { const v = G.map(g => backMat(g)); if (!v.some(Boolean)) return [""]; return !multi || v.every(x => x === v[0]) ? [v[0]] : G.map((g, i) => `${g.name}- ${v[i]}`); })()], ["Tagapind", "Värv", gl("backColor")], ["Tagapind", "Nähtav", gl("backVisible")],
    ["Raam", "Materjal", [[frameProfileName(), o.frameMat].filter(Boolean).join(" ")]], ["Raam", "Värv", [o.frameColor || ""]], ["Raam", "Konksud", [o.hooks || ""]],
    ["Valgustus", "Moodulid", gl("modules")], ["Valgustus", "Valgus temp", gl("lightTemp")], ["Valgustus", "Dimmerdatav", gl("dimmable")],
    ["Valgustus", "Toiteplokk", gl("psu")], ["Valgustus", "Trafo karp", gl("trafo")], ["Valgustus", "Võimsus", [o.power || ""]], ["Valgustus", "Lum~", [o.lumen || ""]]
  ];
}
/* draws the A3 frame + title block for a sheet; P(x,y) maps paper mm to model coordinates */
/* text width on paper (mm) for a text of cap height h: the PDF export measures with its own font */
let sheetTW = (str, h) => String(str).length * h * 0.75;
function drawSheetFrame(api, P, k, sheetName, rows, kLabel = k) {
  const { poly, line, text } = api, L = "INFO", r = (x0, y0, x1, y1) => poly([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], true, L);
  r(0, 0, SHEET_W, SHEET_H); r(20, 10, SHEET_W - 10, SHEET_H - 10);
  const x0 = SHEET_W - 10 - TB_W, xS = x0 + 7, xL = xS + 25, x1 = SHEET_W - 10, th = 2.5 * k, lh = 3.6;
  r(x0, 10, x1, SHEET_H - 10);
  /* rows from the top */
  let y = SHEET_H - 10 - 6; line(P(x0, y), P(x1, y), L);
  const fitTxt = (s, w) => { const max = Math.floor(w / (2.5 * 0.62)); return s.length > max ? s.slice(0, max - 1) + "…" : s; };
  let secStart = null, secName = "";
  const closeSec = yEnd => { if (secName && secStart != null) { text(...P(xS - 2.2, (secStart + yEnd) / 2 - secName.length * 0.85), 2.6 * k, secName, L, 90); line(P(xS, secStart), P(xS, yEnd), L); } };
  const wrap = (v, w) => { const max = Math.max(8, Math.floor(w / (2.5 * 0.8))), out = []; let cur = ""; for (const word of String(v).split(/\s+/)) { if (cur && (cur + " " + word).length > max) { out.push(cur); cur = word; } else cur = cur ? cur + " " + word : word; } out.push(cur); return out.flatMap(l => l.length > max ? l.match(new RegExp(`.{1,${max}}`, "g")) : [l]); };
  for (const [sec, lab, vals0] of rows) {
    const isCol = /värv/i.test(lab), vals = vals0.flatMap(v => wrap(v, x1 - xL - 2.5 - (isCol ? 5 : 0))), n = Math.max(1, vals.length), hRow = n * lh + 2.4, yb = y - hRow;
    if (sec !== secName) { closeSec(y); line(P(x0, y), P(x1, y), L); secName = sec; secStart = y; }
    line(P(sec ? xS : x0, yb), P(x1, yb), L); line(P(xL, y), P(xL, yb), L);
    text(...P((sec ? xS : x0) + 1.2, yb + hRow / 2 - 1.1), th, lab, L);
    vals.forEach((v, i) => {
      const by = y - 1.6 - lh * (i + 1) + 1.1; text(...P(xL + 1.2, by), th, v, L);
      /* colour sample in a small box right after a colour code (RAL / #hex / colour word) */
      const c = isCol && v ? colorOf(v.includes("- ") ? v.slice(v.lastIndexOf("- ") + 2) : v) : null;
      if (c != null && api.hatch) { const sx = Math.min(xL + 1.2 + sheetTW(v, 2.5) + 1.5, x1 - 3.4), q = [P(sx, by - 0.3), P(sx + 2.8, by - 0.3), P(sx + 2.8, by + 2.5), P(sx, by + 2.5)]; api.hatch([q], L, c); poly(q, true, L); }
    });
    y = yb;
  }
  closeSec(y); line(P(x0, y), P(x1, y), L);
  /* sheet name and company */
  text(...P(x0 + 4, 22), 4 * k, sheetName, L); text(...P(x0 + 4, 14), 2.6 * k, "DAG Reklaam OÜ", L);
  line(P(x0, 30), P(x1, 30), L);
  text(...P(16, 20), 2.2 * k, (S.name || "").replace(/\.(dxf|dwg)$/i, ""), L, 90);
  text(...P(SHEET_W - 10 - 62, SHEET_H - 7.6), 2.2 * k, `Valgustähed ${$("appVer").textContent.split(" ")[0]} · M 1:${kLabel}`, L);
}
async function exportSheet() {
  if (!S.letters.length) { toast("Pole midagi eksportida."); return; }
  const useTpl = tplActive() && await tplEnsure();
  const sh = sheetDXF({ useTpl });
  if (useTpl) { await saveTpl(tplFileName(""), sh.txt, sh.origin); return; }
  const no = (S.order.orderNo || "").trim();
  await saveCad(baseName() + (no ? "_PO" + no : "") + "_TOOTMINE", sh.txt);
}
/* the Üldjoonis sheet as DXF text + its paper mapping (P: paper mm -> model, scale 1:k) */
function sheetDXF(opt = {}) {
  const useTpl = !!opt.useTpl;
  const lx0 = Math.min(...S.letters.map(L => L.bb.x0)), lx1 = Math.max(...S.letters.map(L => L.bb.x1)), ly0 = Math.min(...S.letters.map(L => L.bb.y0)), ly1 = Math.max(...S.letters.map(L => L.bb.y1));
  const fx = (S.bars || []).flatMap(b => [b.x0, b.x1]), X0 = Math.min(lx0, ...fx), X1 = Math.max(lx1, ...fx);
  const W = X1 - X0, H = ly1 - ly0, DIM = 280; /* hole dimensions take ~280 mm above and below */
  const areaW = SHEET_W - 10 - TB_W - 40, areaH = 150, k = pickScale(W + 60, H + 2 * DIM + 160, areaW, areaH);
  const cx = (X0 + X1) / 2, cy = (ly0 + ly1) / 2, px = 20 + (areaW + 20) / 2, py = SHEET_H - 10 - 8 - areaH / 2;
  const P = (x, y) => [cx + (x - px) * k, cy + (y - py) * k];
  const rows = titleRows();
  /* overall width under everything */
  const extraDims = [{ side: -1, edge: ly0, e2: ly0, pts: [lx0, lx1], off: DIM + 120 }];
  const extra = api => {
    if (!useTpl) drawSheetFrame(api, P, k, "Üldjoonis", rows);
    /* small 3D preview with the part colours, bottom left: oblique view (frame behind, returns, then faces) */
    const bw = 150, bh = 62, bx = 26, by = 18, D = Math.max(10, ...S.letters.map((L, i) => depthOf(i))), ang = 0.6, kz = 0.55, sdx = Math.cos(ang) * kz, sdy = Math.sin(ang) * kz;
    const fullW = W + D * sdx * 2, fullH = H + D * sdy * 2;
    /* with the company template there is no sheet in model space: the preview goes under the work at 35 % size */
    const sc = useTpl ? 0.35 : Math.min((bw - 12) / fullW, (bh - 12) / fullH) * k;
    if (!useTpl) api.poly([P(bx, by), P(bx + bw, by), P(bx + bw, by + bh), P(bx, by + bh)], true, "INFO");
    const [ox, oy] = useTpl ? [cx, ly0 - DIM - 120 - 60 - fullH * sc / 2] : P(bx + bw / 2, by + bh / 2), T = (q, z) => [ox + (q[0] - cx + z * sdx - D * sdx / 2) * sc, oy + (q[1] - cy + z * sdy - D * sdy / 2) * sc];
    const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const frameCol = colorOf(S.order.frameColor) || 0xc4cad0, pd = cfg.profile || 30, simp = lp => Core.simplifyClosed ? Core.simplifyClosed(lp, 0.6) : lp;
    const fr = [...(S.bars || []).map(b => rect(b.x0, b.y - b.h / 2, b.x1, b.y + b.h / 2)), ...(S.posts || []).flatMap(q => Core.postSegs(S.bars, q).map(([lo, hi]) => rect(q.x - q.w / 2, lo, q.x + q.w / 2, hi)))];
    if (fr.length) { const sw = Core.sweepLoops(fr, pd * sdx, pd * sdy).map(lp => lp.map(q => T(q, -pd))); api.hatch(sw.map(lp => lp.map(q => [q[0], q[1]])), "INFO", frameCol); }
    const shade = (c, f) => (Math.round(((c >> 16) & 255) * f) << 16) | (Math.round(((c >> 8) & 255) * f) << 8) | Math.round((c & 255) * f);
    const faces = [];
    S.letters.forEach((L, i) => {
      const G = grpOf(i), fc = colorOf(G.faceColor) || 0xffffff, scol = colorOf(G.sideColor) || 0x30373e;
      const Dl = depthOf(i), lp0 = ((S.prof && S.prof[i] && S.prof[i].cont) || L.loops).map(simp), sw = Core.sweepLoops(lp0, Dl * sdx, Dl * sdy).map(lp => lp.map(q => T(q, D - Dl)));
      api.hatch(sw, "INFO", shade(scol, 0.8)); for (const lp of sw) api.poly(lp, true, "INFO");
      faces.push([lp0.map(lp => lp.map(q => T(q, D))), fc, Dl]);
    });
    for (const [lps, fc] of faces) { api.hatch(lps, "INFO", fc); for (const lp of lps) api.poly(lp, true, "INFO"); }
  };
  /* the same layers as the layer menu (ticked = exported), like the main DXF export */
  const txt = Core.writeDXF({ layerNames: exportLayerNames(), only: exportLayers(), drainMode: cfg.drainMode, curveMode: cfg.curveMode || "lines", chordTol: cfg.chordTol || 0.01,
    letters: S.letters, chains: S.chains, leds: S.leds, holes: S.holes, wire: S.wire ? S.wire.order : null, bars: S.bars, posts: S.posts, mounts: S.mounts, mountD: cfg.mountD, types: cfg.types, holeD: cfg.holeD, prof: S.prof,
    cables: S.cables && S.cables.length ? S.cables : null, cableD: cfg.cableD || 8, extraDims, extra, dimInt: true });
  return { txt, k, cx, cy, px, py, origin: [X0, ly0] };
}
$("btnExportSheet").addEventListener("click", exportSheet);
/* ===================== DRAWINGS AS PDF =====================
   The same DXF the CAD export writes is drawn onto A3 pages: page 1 Üldjoonis, page 2 Raamijoonis, both with the full title block. */
function parseDxfEnts(txt) {
  const a = txt.split(/\r?\n/), P = []; for (let i = 0; i + 1 < a.length; i += 2) P.push([+a[i].trim(), a[i + 1]]);
  const uni = v => v.replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const blocks = {}, ents = []; let sec = "", cur = null, blk = null;
  for (let i = 0; i < P.length; i++) {
    const [c, v] = P[i];
    if (c === 0) {
      if (v === "SECTION") { sec = P[i + 1][1]; continue; }
      if (v === "ENDSEC") { sec = ""; cur = null; continue; }
      if (sec === "BLOCKS" && v === "BLOCK") { blk = { name: "", ents: [] }; cur = null; let j = i + 1; while (P[j][0] !== 0) { if (P[j][0] === 2) blk.name = P[j][1]; j++; } blocks[blk.name] = blk.ents; i = j - 1; continue; }
      if (v === "ENDBLK") { blk = null; cur = null; continue; }
      if (sec === "ENTITIES" || (sec === "BLOCKS" && blk)) { cur = { t: v, c: [] }; (blk ? blk.ents : ents).push(cur); continue; }
      cur = null; continue;
    }
    if (cur) cur.c.push([c, c === 1 || c === 8 ? uni(v) : v]);
  }
  return { ents, blocks };
}
const PDF_LAYER = { "2_CUT": [[20, 22, 25], 0.35], "3_AL": [[70, 76, 82], 0.3], "5_RAAM_AL": [[35, 90, 160], 0.3], "9_KINNITUSAVAD": [[205, 30, 40], 0.25], "8_MÕÕDUD": [[60, 64, 68], 0.13], "INFO": [[20, 22, 25], 0.2] };
/* a pen draws model coordinates through map(x,y) -> paper mm (y up) on an A3 landscape jsPDF page */
function pdfPen(doc, map, PH = 297) {
  const M = (x, y) => { const q = map(x, y); return [q[0], PH - q[1]]; };
  const style = layer => { const [c, w] = PDF_LAYER[layer] || [[20, 22, 25], 0.2]; doc.setDrawColor(...c); doc.setLineWidth(w); return c; };
  const ptPerMM = 72 / 25.4;
  return {
    line(a, b, layer) { style(layer); const p = M(a[0], a[1]), q = M(b[0], b[1]); doc.line(p[0], p[1], q[0], q[1]); },
    poly(pts, closed, layer, bulges) {
      if (pts.length < 2) return; style(layer); const out = [];
      for (let k = 0; k < pts.length; k++) {
        const a = pts[k], b = pts[(k + 1) % pts.length]; out.push(a); if (k === pts.length - 1 && !closed) break;
        const bu = bulges && bulges[k]; if (bu) { /* arc segment: sample it */
          const th = 4 * Math.atan(bu), dx = b[0] - a[0], dy = b[1] - a[1], ch = Math.hypot(dx, dy), d = ch * (1 - bu * bu) / (4 * bu), R = ch * (1 + bu * bu) / (4 * Math.abs(bu));
          const cx = (a[0] + b[0]) / 2 - dy / ch * d, cy = (a[1] + b[1]) / 2 + dx / ch * d, a0 = Math.atan2(a[1] - cy, a[0] - cx), n = Math.max(4, Math.ceil(Math.abs(th) * 12));
          for (let j = 1; j < n; j++) { const t = a0 + th * j / n; out.push([cx + R * Math.cos(t), cy + R * Math.sin(t)]); }
        }
      }
      const ops = out.map((q, k) => ({ op: k ? "l" : "m", c: M(q[0], q[1]) })); if (closed) ops.push({ op: "h", c: [] });
      doc.path(ops); doc.stroke();
    },
    circle(x, y, r, layer, scale) { style(layer); const p = M(x, y); doc.circle(p[0], p[1], r * scale, "S"); },
    text(x, y, h, s, layer, rot) { const c = style(layer); doc.setTextColor(...c); doc.setFont("helvetica", "normal"); doc.setFontSize(h / 0.718 * ptPerMM); const p = M(x, y); doc.text(String(s), p[0], p[1], rot ? { angle: rot } : undefined); },
    textPaper(h) { return h / 0.718 * ptPerMM; },
    hatch(loops, layer, rgb) {
      const ops = []; for (const lp of loops) { lp.forEach((q, k) => ops.push({ op: k ? "l" : "m", c: M(q[0], q[1]) })); ops.push({ op: "h", c: [] }); }
      doc.setFillColor((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255); doc.path(ops); doc.fillEvenOdd();
    },
    solid(a, b, c, layer) { const col = style(layer); doc.setFillColor(...col); const p = M(...a), q = M(...b), r = M(...c); doc.triangle(p[0], p[1], q[0], q[1], r[0], r[1], "F"); }
  };
}
/* draws the parsed DXF entities with a pen; s = model→paper scale (for circle radii and text heights) */
function drawDxf(pen, D, s) {
  const g = (e, c) => { const r = e.c.find(x => x[0] === c); return r ? r[1] : undefined; }, n = (e, c) => +(g(e, c) || 0);
  const one = (e, layer) => {
    const L = layer || g(e, 8);
    switch (e.t) {
      case "LINE": pen.line([n(e, 10), n(e, 20)], [n(e, 11), n(e, 21)], L); break;
      case "LWPOLYLINE": { const pts = [], bu = []; for (const [c, v] of e.c) { if (c === 10) { pts.push([+v, 0]); bu.push(0); } else if (c === 20) pts[pts.length - 1][1] = +v; else if (c === 42) bu[bu.length - 1] = +v; } pen.poly(pts, (n(e, 70) & 1) === 1, L, bu); break; }
      case "CIRCLE": pen.circle(n(e, 10), n(e, 20), n(e, 40), L, s); break;
      case "TEXT": pen.text(n(e, 10), n(e, 20), n(e, 40) * s, g(e, 1) || "", L, n(e, 50)); break;
      case "SOLID": pen.solid([n(e, 10), n(e, 20)], [n(e, 11), n(e, 21)], [n(e, 12), n(e, 22)], L); if (g(e, 13) != null && (n(e, 13) !== n(e, 12) || n(e, 23) !== n(e, 22))) pen.solid([n(e, 11), n(e, 21)], [n(e, 13), n(e, 23)], [n(e, 12), n(e, 22)], L); break;
      case "HATCH": { const loops = []; let lp = null, inLoops = false; for (const [c, v] of e.c) { if (c === 91) inLoops = true; else if (!inLoops) continue; else if (c === 93) { lp = []; loops.push(lp); } else if (c === 10 && lp) lp.push([+v, 0]); else if (c === 20 && lp && lp.length) lp[lp.length - 1][1] = +v; else if (c === 97) lp = null; }
        pen.hatch(loops.filter(l => l.length > 2), L, n(e, 420)); break; }
      case "DIMENSION": case "INSERT": { const b = D.blocks[g(e, 2)]; if (b) for (const x of b) one(x, x.c.find(q => q[0] === 8) && x.c.find(q => q[0] === 8)[1] === "0" ? L : null); break; }
    }
  };
  for (const e of D.ents) one(e);
}
function dxfBounds(D) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const e of D.ents) for (const [c, v] of e.c) { if (c === 10 || c === 11) { x0 = Math.min(x0, +v); x1 = Math.max(x1, +v); } else if (c === 20 || c === 21) { y0 = Math.min(y0, +v); y1 = Math.max(y1, +v); } }
  return { x0, y0, x1, y1 };
}
async function exportDrawingsPdf() {
  if (!S.letters.length) { toast("Pole midagi eksportida."); return; }
  const btn = $("btnExportPdf"); btn.disabled = true; const lbl = btn.textContent; btn.textContent = "Koostan PDF-i…";
  const oldTW = sheetTW;
  try {
    await ensurePdf();
    const { jsPDF } = window.jspdf, doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
    sheetTW = (str, h) => { doc.setFont("helvetica", "normal"); doc.setFontSize(h / 0.718 * 72 / 25.4); return doc.getTextWidth(String(str)); };
    const title = (S.order.title || "").trim() || (S.name || "").replace(/\.(dxf|dwg)$/i, "");
    doc.setProperties({ title: title + " – joonised", author: S.order.drafter || "", creator: "Valgustähed " + $("appVer").textContent.split(" ")[0] });
    /* page 1: Üldjoonis (same colour preview as in the CAD sheet) */
    const sh = sheetDXF();
    drawDxf(pdfPen(doc, (x, y) => [sh.px + (x - sh.cx) / sh.k, sh.py + (y - sh.cy) / sh.k]), parseDxfEnts(sh.txt), 1 / sh.k);
    /* page 2: Raamijoonis, fitted to the drawing area at a standard scale */
    if ((S.bars || []).length) {
      doc.addPage("a3", "landscape");
      const D = parseDxfEnts(frameDXF().txt), b = dxfBounds(D), ax0 = 26, ax1 = SHEET_W - 10 - TB_W - 6, ay0 = 36, ay1 = SHEET_H - 16;
      const k = pickScale(b.x1 - b.x0, b.y1 - b.y0, ax1 - ax0, ay1 - ay0), mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2, qx = (ax0 + ax1) / 2, qy = (ay0 + ay1) / 2;
      drawDxf(pdfPen(doc, (x, y) => [qx + (x - mx) / k, qy + (y - my) / k]), D, 1 / k);
      const pen = pdfPen(doc, (x, y) => [x, y]);
      drawSheetFrame({ poly: (pts, cl, L) => pen.poly(pts, cl, L), line: pen.line, text: (x, y, h, s, L, rot) => pen.text(x, y, h, s, L, rot), hatch: pen.hatch }, (x, y) => [x, y], 1, "Raamijoonis", titleRows(), k);
    }
    const no = (S.order.orderNo || "").trim();
    await saveFile(baseName() + (no ? "_PO" + no : "") + "_joonised.pdf", new Uint8Array(doc.output("arraybuffer")));
  } catch (e) { console.error(e); toast("PDF-i koostamine ebaõnnestus: " + (e.message || e)); }
  finally { sheetTW = oldTW; btn.disabled = false; btn.textContent = lbl; }
}
$("btnExportPdf").addEventListener("click", exportDrawingsPdf);
