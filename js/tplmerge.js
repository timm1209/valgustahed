/* ===================== DRAWING TEMPLATE (company DXF) =====================
   The template stays byte-for-byte as it is: the work is spliced into its model space at 0;0,
   the order data goes into the custom drawing properties (DWGPROPS) that the title-block fields read,
   and the layout viewports are pointed at the work at a standard scale. */
const Tpl = (() => {
  const SCALES = [1, 2, 2.5, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000];
  const uni = s => s.replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const fnum = v => { const r = Math.round(v * 1e6) / 1e6; return Number.isInteger(r) ? r.toFixed(1) : String(r); };
  const pad = c => String(c).padStart(3, " ");
  /* "code\nvalue" lines -> [[code, value], ...] */
  function pairs(text, eol) { const L = text.split(eol), out = []; for (let i = 0; i + 1 < L.length; i += 2) out.push([L[i].trim(), L[i + 1]]); return out; }
  const join = (P, eol) => P.map(([c, v]) => pad(c) + eol + v).join(eol);
  /* split a section body (pairs) into chunks starting at each code 0 */
  function chunks(P) { const out = []; let cur = null; for (const p of P) { if (p[0] === "0") { cur = [p]; out.push(cur); } else if (cur) cur.push(p); } return out; }
  const val = (ch, c) => { const p = ch.find(q => q[0] === c); return p ? p[1] : null; };
  /* owner handle: the 330 outside the {ACAD_REACTORS …} / {ACAD_XDICTIONARY …} groups */
  const ownerOf = ch => { let inG = false; for (const [c, v] of ch) { if (c === "102") inG = v.startsWith("{"); else if (c === "330" && !inG) return v; } return null; };
  /* locate "  0 SECTION / 2 NAME" ... "  0 ENDSEC" by character offsets */
  function section(s, eol, name) {
    const re = new RegExp("(^|" + eol + ") *0" + eol + "SECTION" + eol + " *2" + eol + name + eol);
    const m = re.exec(s); if (!m) return null;
    const bodyStart = m.index + m[0].length, endRe = new RegExp(eol + " *0" + eol + "ENDSEC(" + eol + "|$)", "g"); endRe.lastIndex = bodyStart - eol.length;
    const e = endRe.exec(s); if (!e) return null;
    return { start: m.index + (m[1] ? m[1].length : 0), bodyStart, bodyEnd: e.index, end: e.index + e[0].length };
  }
  function check(s) {
    const eol = s.includes("\r\n") ? "\r\n" : "\n";
    if (/^AutoCAD Binary DXF/.test(s)) throw new Error("Binaarne DXF ei sobi. Salvesta templat ASCII DXF-ina.");
    const hd = section(s, eol, "HEADER"), ver = (s.slice(0, hd ? hd.bodyEnd : 600).match(/\$ACADVER\r?\n *1\r?\n(AC\d{4})/) || [])[1]; /* $ACADVER is not always first (acad-ts writes it later) */
    if (!ver) throw new Error("See ei paista olevat DXF-fail.");
    if (ver < "AC1021") throw new Error(`Templat on vanas vormingus (${ver}). Salvesta see AutoCAD-is uuemana: Save As → AutoCAD 2018 DXF.`);
    for (const n of ["HEADER", "TABLES", "BLOCKS", "ENTITIES", "OBJECTS"]) if (!section(s, eol, n)) throw new Error("DXF-ist puudub " + n + "-osa.");
    return { eol, ver };
  }
  /* summary of a template: custom properties, layouts, layers */
  function info(s) {
    const { eol, ver } = check(s), h = section(s, eol, "HEADER"), P = pairs(s.slice(h.bodyStart, h.bodyEnd).replace(new RegExp("^" + eol), ""), eol);
    const props = []; for (let i = 0; i < P.length; i++) if (P[i][0] === "9" && P[i][1] === "$CUSTOMPROPERTYTAG" && P[i + 1]) props.push(P[i + 1][1]);
    const objs = section(s, eol, "OBJECTS"), O = s.slice(objs.bodyStart, objs.bodyEnd);
    const layouts = []; const re = new RegExp(eol + " *0" + eol + "LAYOUT" + eol, "g"); let m;
    while ((m = re.exec(O))) { const end = O.indexOf(eol + "  0" + eol, m.index + 4), ch = pairs(O.slice(m.index + eol.length, end), eol), n = ch.filter(q => q[0] === "1"); const nm = n.length ? n[n.length - 1][1] : ""; if (nm && nm !== "Model") layouts.push(nm); }
    const t = section(s, eol, "TABLES"), T = chunks(pairs(s.slice(t.bodyStart, t.bodyEnd).replace(new RegExp("^" + eol), ""), eol));
    const layers = T.filter(c => c[0][1] === "LAYER").map(c => val(c, "2"));
    return { ver, props, layouts: layouts.sort((a, b) => a.localeCompare(b, "et")), layers };
  }
  /* order date "dd.mm.yyyy" -> Julian date (AutoCAD $TDCREATE), noon local time */
  function julian(dateStr) {
    const m = String(dateStr || "").match(/^\s*(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\s*$/);
    const d = m ? new Date(+m[3], +m[2] - 1, +m[1], 12, 0, 0) : new Date();
    return (d.getTime() - d.getTimezoneOffset() * 60000) / 86400000 + 2440587.5;
  }
  /* app DXF (our own writer, AC1015) -> pieces: block records, blocks, entities, dimstyles, layers */
  function readApp(app) {
    const eol = app.includes("\r\n") ? "\r\n" : "\n", get = n => { const sc = section(app, eol, n); return sc ? chunks(pairs(app.slice(sc.bodyStart, sc.bodyEnd).replace(new RegExp("^" + eol), ""), eol)) : []; };
    const T = get("TABLES"), B = get("BLOCKS"), E = get("ENTITIES");
    const brec = T.filter(c => c[0][1] === "BLOCK_RECORD" && /^\*D\d+$/.test(val(c, "2") || ""));
    const names = new Set(brec.map(c => val(c, "2")));
    const blocks = []; let cur = null;
    for (const c of B) { if (c[0][1] === "BLOCK") cur = names.has(val(c, "2")) ? [] : null; if (cur) cur.push(c); if (c[0][1] === "ENDBLK") { if (cur) blocks.push(cur); cur = null; } }
    const dimstyles = T.filter(c => c[0][1] === "DIMSTYLE"), layers = T.filter(c => c[0][1] === "LAYER"), styles = T.filter(c => c[0][1] === "STYLE");
    const ms = T.find(c => c[0][1] === "BLOCK_RECORD" && val(c, "2") === "*Model_Space");
    return { brec, blocks, ent: E, dimstyles, layers, styles, msh: ms ? val(ms, "5") : null };
  }
  /* main entry: returns the merged DXF text (same EOL and encoding as the template) */
  function merge(s, app, o) {
    o = o || {};
    const { eol } = check(s), A = readApp(app);
    const H = section(s, eol, "HEADER"), Tb = section(s, eol, "TABLES"), Bk = section(s, eol, "BLOCKS"), En = section(s, eol, "ENTITIES");
    /* ---- header: handle seed, custom properties, creation date ---- */
    const HP = pairs(s.slice(H.bodyStart, H.bodyEnd).replace(new RegExp("^" + eol), ""), eol);
    const hv = n => { const i = HP.findIndex(p => p[0] === "9" && p[1] === n); return i >= 0 ? i + 1 : -1; };
    let seed = parseInt(HP[hv("$HANDSEED")][1], 16); const nh = () => (seed++).toString(16).toUpperCase();
    const set = [];
    for (let i = 0; i < HP.length; i++) if (HP[i][0] === "9" && HP[i][1] === "$CUSTOMPROPERTYTAG") {
      const tag = HP[i + 1][1]; if (o.props && Object.prototype.hasOwnProperty.call(o.props, tag)) {
        const j = i + 3; if (HP[j - 1] && HP[j - 1][1] === "$CUSTOMPROPERTY" && HP[j]) { const v = String(o.props[tag] == null ? "" : o.props[tag]).replace(/[\r\n]+/g, " ").trim(); HP[j][1] = v || " "; set.push(tag); }
      }
    }
    if (o.date !== undefined) { const jd = julian(o.date); for (const n of ["$TDCREATE", "$TDUCREATE"]) { const k = hv(n); if (k > 0) HP[k][1] = jd.toFixed(9); } }
    /* ---- tables ---- */
    const TP = chunks(pairs(s.slice(Tb.bodyStart, Tb.bodyEnd).replace(new RegExp("^" + eol), ""), eol));
    const tableHandle = name => { const c = TP.find(c => c[0][1] === "TABLE" && val(c, "2") === name); return c ? val(c, "5") : null; };
    const recs = type => TP.filter(c => c[0][1] === type);
    const BRH = tableHandle("BLOCK_RECORD"), LAH = tableHandle("LAYER"), DSH = tableHandle("DIMSTYLE");
    const msRec = recs("BLOCK_RECORD").find(c => (val(c, "2") || "").toUpperCase() === "*MODEL_SPACE"); if (!msRec) throw new Error("Templatist puudub mudelruum.");
    const MSH = val(msRec, "5");
    const stdStyle = recs("STYLE").find(c => (val(c, "2") || "").toLowerCase() === "standard") || recs("STYLE")[0];
    const usedD = recs("BLOCK_RECORD").map(c => ((val(c, "2") || "").match(/^\*D(\d+)$/i) || [])[1]).filter(Boolean).map(Number);
    let dNo = (usedD.length ? Math.max(...usedD) : 0) + 1;
    const rename = new Map(); for (const c of A.brec) rename.set(val(c, "2"), "*D" + (dNo++));
    /* handle map: app handle -> new template handle; owners of model space / tables go to the template's */
    const map = new Map(); const appMSH = A.msh;
    const mapH = h => { if (h == null) return h; if (h === appMSH) return MSH; if (!map.has(h)) map.set(h, nh()); return map.get(h); };
    for (const c of A.brec) mapH(val(c, "5"));
    /* coordinates: shift so the work's lower-left is at 0;0 (dx, dy given by the caller) */
    const dx = (o.shift && o.shift[0]) || 0, dy = (o.shift && o.shift[1]) || 0;
    const bb = [Infinity, Infinity, -Infinity, -Infinity];
    const fixEnt = (c, owner, isModel) => {
      const out = []; let inHatch = false, hatchElev = false;
      for (let k = 0; k < c.length; k++) {
        let [code, v] = c[k]; const n = +code;
        if (k === 0) { out.push([code, v]); inHatch = v === "HATCH"; continue; }
        if (code === "5") v = mapH(v);
        else if (code === "330") v = owner;
        else if (code === "2" && rename.has(v)) v = rename.get(v);
        else if ((n >= 10 && n <= 18) || (n >= 20 && n <= 28)) {
          if (inHatch && c[k - 1] && c[k - 1][0] === "100" && c[k - 1][1] === "AcDbHatch") hatchElev = true;
          if (hatchElev && (code === "10" || code === "20")) { if (code === "20") hatchElev = false; }
          else { const x = parseFloat(v) + (n < 20 ? dx : dy); v = fnum(x); if (isModel) { if (n < 20) { bb[0] = Math.min(bb[0], x); bb[2] = Math.max(bb[2], x); } else { bb[1] = Math.min(bb[1], x); bb[3] = Math.max(bb[3], x); } } }
        } else if (typeof v === "string" && v.includes("\\U+")) v = uni(v);
        if (code === "8") v = uni(v);
        out.push([code, v]);
      }
      return out;
    };
    const newEnt = A.ent.map(c => fixEnt(c, MSH, true));
    const newBlocks = A.blocks.map(bl => { const own = mapH(val(bl[0], "330")); return bl.map((c, i) => {
      if (i === 0 || c[0][1] === "ENDBLK") return c.map(([code, v]) => [code, code === "5" ? mapH(v) : code === "330" ? own : code === "2" || code === "3" ? (rename.get(v) || v) : code === "8" ? uni(v) : v]);
      return fixEnt(c, own, false); }); });
    const newBrec = A.brec.map(c => c.map(([code, v]) => [code, code === "5" ? mapH(v) : code === "330" ? BRH : code === "2" ? rename.get(v) : code === "340" ? "0" : v]));
    /* layers used by the new entities that the template does not have: copy the app's definition */
    const tplLayers = new Set(recs("LAYER").map(c => (val(c, "2") || "").toUpperCase()));
    const l0 = recs("LAYER").find(c => val(c, "2") === "0"), ps = l0 ? val(l0, "390") : null;
    const usedLayers = new Set(); for (const c of [...newEnt, ...newBlocks.flat()]) { const l = val(c, "8"); if (l) usedLayers.add(l); }
    const addLayers = [];
    for (const l of usedLayers) if (!tplLayers.has(l.toUpperCase())) {
      const src = A.layers.find(c => uni(val(c, "2") || "") === l);
      const rec = [["0", "LAYER"], ["5", nh()], ["330", LAH], ["100", "AcDbSymbolTableRecord"], ["100", "AcDbLayerTableRecord"], ["2", l], ["70", "0"], ["62", src ? (val(src, "62") || "7") : "7"], ["6", "Continuous"], ["370", "-3"]];
      if (ps) rec.push(["390", ps]); addLayers.push(rec); tplLayers.add(l.toUpperCase());
    }
    /* dimension style the dimensions refer to (AVAD): copied from the app if the template lacks it */
    const tplDims = new Set(recs("DIMSTYLE").map(c => (val(c, "2") || "").toUpperCase()));
    const usedDims = new Set(newEnt.filter(c => c[0][1] === "DIMENSION").map(c => val(c, "3")).filter(Boolean));
    const addDims = [];
    for (const d of usedDims) if (!tplDims.has(d.toUpperCase())) {
      const src = A.dimstyles.find(c => val(c, "2") === d); if (!src) continue;
      addDims.push(src.filter(([c]) => !/^34[1-7]$/.test(c)).map(([c, v]) => [c, c === "105" || c === "5" ? nh() : c === "330" ? DSH : c === "340" ? (stdStyle ? val(stdStyle, "5") : "0") : v]));
    }
    /* rebuild TABLES: append records before each ENDTAB of their table */
    const add = { BLOCK_RECORD: newBrec, LAYER: addLayers, DIMSTYLE: addDims };
    const tOut = []; let curTable = null;
    for (const c of TP) {
      if (c[0][1] === "TABLE") { curTable = val(c, "2"); const n = (add[curTable] || []).length; if (n) { const k = c.findIndex(p => p[0] === "70"); if (k > 0) c[k] = ["70", String(+c[k][1] + n)]; } }
      if (c[0][1] === "ENDTAB" && add[curTable]) for (const r of add[curTable]) tOut.push(...r);
      tOut.push(...c);
    }
    /* ---- viewports: in every layout point one model viewport at the work, at a standard scale ---- */
    const W = bb[2] - bb[0], Hh = bb[3] - bb[1], cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, haveBB = isFinite(W) && W > 0;
    const vps = []; const vpRe = new RegExp(eol + " *0" + eol + "VIEWPORT" + eol, "g");
    for (const [a, b] of [[Bk.bodyStart, Bk.bodyEnd], [En.bodyStart, En.bodyEnd]]) {
      vpRe.lastIndex = a - eol.length; let m;
      while ((m = vpRe.exec(s)) && m.index < b) { const st = m.index + eol.length, en = s.indexOf(eol + "  0" + eol, st + 3); const P = pairs(s.slice(st, en), eol); vps.push({ st, en, P, owner: ownerOf(P), w: +val(P, "40"), h: +val(P, "41"), vx: +val(P, "12"), vy: +val(P, "22") }); }
    }
    const fitted = [];
    if (o.fit !== false && haveBB) {
      const byOwner = new Map(); for (const v of vps) { if (!byOwner.has(v.owner)) byOwner.set(v.owner, []); byOwner.get(v.owner).push(v); }
      const model = [...byOwner.values()].flatMap(a => a.slice(1)); /* the first viewport of a layout is the sheet itself */
      const med = a => { const q = [...a].sort((x, y) => x - y); return q.length ? q[q.length >> 1] : 0; }, mx = med(model.map(v => v.vx)), my = med(model.map(v => v.vy));
      for (const list of byOwner.values()) {
        const cand = list.slice(1).filter(v => v.w > 1 && v.h > 1); if (!cand.length) continue;
        const v = cand.reduce((a, q) => Math.hypot(q.vx - mx, q.vy - my) < Math.hypot(a.vx - mx, a.vy - my) ? q : a);
        const k = SCALES.find(k => W / k <= v.w * 0.88 && Hh / k <= v.h * 0.88) || Math.ceil(Math.max(W / (v.w * 0.88), Hh / (v.h * 0.88)));
        const tx = +(val(v.P, "17") || 0), ty = +(val(v.P, "27") || 0);
        v.P = v.P.map(([c, x]) => [c, c === "12" ? fnum(cx - tx) : c === "22" ? fnum(cy - ty) : c === "45" ? fnum(v.h * k) : x]);
        v.changed = true; fitted.push(k);
      }
    }
    /* ---- assemble ---- */
    const parts = []; let pos = 0;
    const put = (at, text) => { parts.push(s.slice(pos, at), text); pos = at; };
    const skip = to => { pos = to; };
    put(H.bodyStart, (s.slice(H.bodyStart, H.bodyStart + eol.length) === eol ? eol : "") + join(HP, eol)); skip(H.bodyEnd);
    put(Tb.bodyStart, (s.slice(Tb.bodyStart, Tb.bodyStart + eol.length) === eol ? eol : "") + join(tOut, eol)); skip(Tb.bodyEnd);
    const blkText = newBlocks.length ? eol + join(newBlocks.flat(2), eol) : "", entText = newEnt.length ? eol + join(newEnt.flat(), eol) : "";
    const vpIn = (a, b) => vps.filter(v => v.changed && v.st >= a && v.st < b).sort((p, q) => p.st - q.st);
    for (const v of vpIn(Bk.bodyStart, Bk.bodyEnd)) { put(v.st, join(v.P, eol)); skip(v.en); }
    put(Bk.bodyEnd, blkText);
    for (const v of vpIn(En.bodyStart, En.bodyEnd)) { put(v.st, join(v.P, eol)); skip(v.en); }
    put(En.bodyEnd, entText);
    /* new handle seed last: every handle has been handed out by now */
    let out = parts.join("") + s.slice(pos);
    const hsRe = new RegExp("(\\$HANDSEED" + eol + " *5" + eol + ")([0-9A-Fa-f]+)"); out = out.replace(hsRe, (_, a) => a + seed.toString(16).toUpperCase());
    return { text: out, set, fitted, bbox: haveBB ? bb.slice() : null, layersAdded: addLayers.map(r => val(r, "2")), dimsAdded: addDims.map(r => val(r, "2")) };
  }
  return { check, info, merge, julian };
})();
