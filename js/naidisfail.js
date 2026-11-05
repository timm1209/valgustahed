/* Valgustähed — naidisfail.js
   Mall (DWT, DWG või DXF): LED-joonise eksport lisab kõik märgitud kihid selle faili mudelruumi,
   töö alumine vasak nurk koordinaatidele 0;0. Fail jääb brauserisse alles (IndexedDB), kuni see eemaldatakse.
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */
const NF = { name: null, bytes: null, info: "" };
const NF_DB = "valg_naidisfail", NF_KEY = "fail";

/* ---------- brauseri mälu ---------- */
function nfStore(mode, fn) {
  return new Promise((res, rej) => {
    let rq; try { rq = indexedDB.open(NF_DB, 1); } catch (e) { rej(e); return; }
    rq.onupgradeneeded = () => rq.result.createObjectStore("f");
    rq.onerror = () => rej(rq.error);
    rq.onsuccess = () => {
      const db = rq.result; let r = null;
      try { const tx = db.transaction("f", mode); r = fn(tx.objectStore("f")); tx.oncomplete = () => { db.close(); res(r && r.result); }; tx.onerror = () => { db.close(); rej(tx.error); }; }
      catch (e) { db.close(); rej(e); }
    };
  });
}

/* ---------- lugemine ----------
   DWT/DWG: loetakse parandatud acad-ts-iga (lib/acadts.js, "DAG patch"); kõik objektid, mida eksport ei muuda,
   kirjutatakse tagasi algse kirjena baidi täpsusega, uuesti kirjutatakse ainult mudelruum, tabelid ja sätitud vaateaknad.
   DXF: jääb baidi täpsusega alles ja joonis lisatakse tekstina (Tpl.merge). */
const nfKind = name => /\.dxf$/i.test(name || "") ? "dxf" : /\.(dwt|dwg)$/i.test(name || "") ? "dwg" : null;
const nfIsDxf = name => nfKind(name) === "dxf";
const nfUni = v => v.replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
/* baidid -> tekst: AutoCAD 2007+ DXF on UTF-8, vanemad ANSI (1252) */
function nfText(bytes) {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 200000));
  if (/^AutoCAD Binary DXF/.test(head)) throw new Error("Binaarne DXF ei sobi. Salvesta mall AutoCAD-is ASCII DXF-ina.");
  const v = (head.match(/\$ACADVER\r?\n *1\r?\n(AC\d{4})/) || [])[1];
  if (!v) throw new Error("See ei paista olevat DXF-fail.");
  return { text: new TextDecoder(v >= "AC1021" ? "utf-8" : "windows-1252").decode(bytes), utf8: v >= "AC1021" };
}
function nfEncode(text, utf8) {
  if (utf8) return new TextEncoder().encode(text);
  const b = new Uint8Array(text.length); for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); b[i] = c < 256 ? c : 63; } return b;
}
const NF_VER = { AC1012: "R13", AC1014: "R14", AC1015: "2000", AC1018: "2004", AC1021: "2007", AC1024: "2010", AC1027: "2013", AC1032: "2018" };
function nfReadDwg(bytes) {
  const A = window.AcadTs; if (!A || !A.DwgReader) throw new Error("DWG-teek puudub.");
  if (new TextDecoder("latin1").decode(bytes.subarray(0, 4)) !== "AC10") throw new Error("See ei paista olevat DWG/DWT-fail.");
  const doc = A.DwgReader.readFromStream(bytes.slice().buffer, () => {});
  if (doc.header.version < A.ACadVersion.AC1018) throw new Error("Mall on liiga vanas vormingus. Salvesta see AutoCAD-is AutoCAD 2018 DWT/DWG-na.");
  return doc;
}
function nfDescribe(name, bytes) {
  if (nfKind(name) === "dwg") {
    const A = window.AcadTs, doc = nfReadDwg(bytes);
    const lay = [...doc.layouts].filter(l => l.name !== "Model").length, props = doc.summaryInfo && doc.summaryInfo.properties ? doc.summaryInfo.properties.size : 0;
    const vk = Object.keys(A.ACadVersion).find(k => A.ACadVersion[k] === doc.header.version) || "";
    return (lay ? lay + " lehte" : "lehti pole") + (props ? ", " + props + " DWGPROPS välja" : "") + (NF_VER[vk] ? " · AutoCAD " + NF_VER[vk] : "") + " → eksport DWG";
  }
  const i = Tpl.info(nfText(bytes).text);
  return (i.layouts.length ? i.layouts.length + " lehte" : "lehti pole") + (i.props.length ? ", " + i.props.length + " DWGPROPS välja" : "") + (NF_VER[i.ver] ? " · AutoCAD " + NF_VER[i.ver] + " DXF" : "") + " → eksport DXF";
}

/* ---------- laadimine ja eemaldamine ---------- */
function nfLoad(file) {
  if (!nfKind(file.name)) { toast("Mall peab olema DWT-, DWG- või DXF-fail."); return; }
  toast("Loen malli…");
  const r = new FileReader();
  r.onload = () => setTimeout(() => {
    const bytes = new Uint8Array(r.result);
    let info; try { info = nfDescribe(file.name, bytes); } catch (e) { console.error(e); toast("Malli ei õnnestunud lugeda: " + (e.message || e)); return; }
    NF.name = file.name; NF.bytes = bytes; NF.info = info;
    $("s_useNf").checked = true; nfSaveUse();
    nfStore("readwrite", st => st.put({ name: file.name, bytes }, NF_KEY)).catch(e => { console.warn(e); toast("Mall on kasutusel, aga brauser ei jäta seda meelde (privaatne aken?)."); });
    nfUI(); toast("Mall laaditud: " + file.name);
  }, 30);
  r.onerror = () => toast("Faili ei õnnestunud lugeda.");
  r.readAsArrayBuffer(file);
}
function nfRemove() {
  NF.name = null; NF.bytes = null; NF.info = "";
  nfStore("readwrite", st => st.delete(NF_KEY)).catch(() => {});
  nfUI();
}
function nfSaveUse() { try { localStorage.setItem("valg_nfuse", $("s_useNf").checked ? "1" : "0"); } catch (e) {} }
function nfActive() { return !!(NF.bytes && $("s_useNf").checked); }

function nfUI() {
  const has = !!NF.bytes;
  $("nfStat").textContent = has ? NF.name + " — " + NF.info : "Malli pole. Laadi ettevõtte joonise mall (.dwt, .dwg või .dxf); LED-joonis lisatakse selle mudelruumi punkti 0;0.";
  $("nfStat").classList.toggle("on", has); $("nfStat").classList.remove("warn");
  $("btnNfIn").textContent = has ? "Vaheta mall…" : "Laadi mall…";
  $("btnNfDel").hidden = !has;
  $("nfUseRow").hidden = !has; $("nfFrameRow").hidden = !has; $("nfCutRow").hidden = !has;
  if (window.__fmtLabels) window.__fmtLabels();
  updateExpNote();
}

/* ---------- ühendamine ----------
   Mall jääb muutmata; LED-joonise kihid, plokid, mõõdustiilid ja objektid lisatakse selle mudelruumi,
   tellimuse info läheb DWGPROPS-i väljadesse (samad nimed mis ettevõtte templatil), loomise kuupäev = tellimuse kuupäev
   ja iga lehe mudelivaateaken sätitakse joonisele standardmõõtkavas. */
const NF_SCALES = [1, 2, 2.5, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000];
function nfOrderDate() { const m = String(S.order.date || "").match(/^\s*(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\s*$/); return m ? new Date(+m[3], +m[2] - 1, +m[1], 12, 0, 0) : new Date(); }
/* parts: [{ txt, shift }] — the LED drawing and, when asked, the frame drawing beside it; boxes: { main, frame } in template coordinates */
function nfDwgMerge(parts, boxes) {
  const A = window.AcadTs;
  const tpl = nfReadDwg(NF.bytes);
  /* what the export changes is written anew, everything else stays the template's own record */
  tpl.modelSpace.dwgDirty = true;
  for (const t of [tpl.layers, tpl.lineTypes, tpl.textStyles, tpl.dimensionStyles, tpl.blockRecords, tpl.appIds]) if (t) t.dwgDirty = true;
  /* the app names its dimension blocks *D1, *D2 … in every DXF it writes; a template may already have the same names (2.dwt has *D9, *D85…),
     and a clone would then be tied to that block: give every app block a name nothing else uses */
  const used = new Set([...tpl.blockRecords].map(b => String(b.name).toUpperCase()));
  let dn = Math.max(0, ...[...used].map(nm => +((nm.match(/^\*D(\d+)$/) || [])[1] || 0))) + 1;
  let n = 0;
  for (const part of parts) {
    const ours = A.DxfReader.readFromStream(new TextEncoder().encode(part.txt), () => {});
    for (const l of ours.layers) if (l.name && l.name.includes("\\U+")) l.name = nfUni(l.name);
    for (const e of ours.modelSpace.entities) if (e.block && /^\*D/i.test(e.block.name || "")) { while (used.has("*D" + dn)) dn++; e.block.name = "*D" + dn; used.add("*D" + dn); dn++; }
    const d = new A.XYZ(part.shift[0], part.shift[1], 0);
    for (const e of [...ours.modelSpace.entities]) {
      const c = e.clone();
      if (typeof c.value === "string" && c.value.includes("\\U+")) c.value = nfUni(c.value);
      c.applyTranslation(d);
      /* a dimension's block is inserted at its insertion point, which applyTranslation already moved: the block content stays as it is */
      if (c.block) { /* the block's owned-handle list still names the app DXF's handles: let the writer use its real entities */
        if (Array.isArray(c.block.ownedObjectHandles)) c.block.ownedObjectHandles.length = 0;
        if (Array.isArray(c.block.insertHandles)) c.block.insertHandles.length = 0;
      }
      tpl.modelSpace.entities.add(c); n++;
    }
  }
  fixDwgDims(tpl);
  /* order data -> DWGPROPS (only the names the template already has) */
  const props = tplProps(), P = tpl.summaryInfo && tpl.summaryInfo.properties; let set = 0;
  if (P) for (const k of [...P.keys()]) if (Object.prototype.hasOwnProperty.call(props, k)) { const v = String(props[k] == null ? "" : props[k]).replace(/[\r\n]+/g, " ").trim(); P.set(k, v || " "); set++; }
  const dt = nfOrderDate(); tpl.header.createDateTime = dt; tpl.header.universalCreateDateTime = dt; if (tpl.summaryInfo) tpl.summaryInfo.createdDate = dt;
  /* layouts: point the model viewport of every sheet at the work; a sheet named like "Raamijoonis" at the frame drawing */
  const fitted = [], ok = b => b && b[2] > b[0] && b[3] > b[1];
  if (ok(boxes.main)) {
    const per = [];
    for (const lay of tpl.layouts) {
      if (lay.name === "Model" || !lay.associatedBlock) continue;
      const vps = [...lay.associatedBlock.entities].filter(e => e instanceof A.Viewport && !e.representsPaper && e.width > 1 && e.height > 1);
      if (vps.length) per.push({ name: lay.name, vps });
    }
    const all = per.flatMap(p => p.vps), med = a => { const q = [...a].sort((x, y) => x - y); return q.length ? q[q.length >> 1] : 0; };
    const mx = med(all.map(v => v.viewCenter.x + v.viewTarget.x)), my = med(all.map(v => v.viewCenter.y + v.viewTarget.y));
    for (const { name, vps } of per) {
      const box = ok(boxes.frame) && /raam/i.test(name) ? boxes.frame : boxes.main;
      const W = box[2] - box[0], H = box[3] - box[1], cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
      const v = vps.reduce((a, q) => Math.hypot(q.viewCenter.x + q.viewTarget.x - mx, q.viewCenter.y + q.viewTarget.y - my) < Math.hypot(a.viewCenter.x + a.viewTarget.x - mx, a.viewCenter.y + a.viewTarget.y - my) ? q : a);
      const k = NF_SCALES.find(k => W / k <= v.width * 0.88 && H / k <= v.height * 0.88) || Math.ceil(Math.max(W / (v.width * 0.88), H / (v.height * 0.88)));
      v.viewCenter = new A.XY(cx - v.viewTarget.x, cy - v.viewTarget.y); v.viewHeight = v.height * k; v.dwgDirty = true; fitted.push(name + " 1:" + k);
    }
  }
  return { doc: tpl, n, set, fitted };
}
async function saveNf(base, parts, boxes) {
  if (nfKind(NF.name) === "dwg") {
    let bytes, r;
    try {
      r = nfDwgMerge(parts, boxes);
      const cf = new AcadTs.DwgWriterConfiguration(); cf.writeDynamicBlockData = true;
      bytes = AcadTs.DwgWriter.writeToBuffer(r.doc, cf);
    } catch (e) { console.error(e); toast("Malliga ühendamine ebaõnnestus: " + (e.message || e)); return false; }
    await saveFile(base + ".dwg", bytes);
    return true;
  }
  let out;
  try {
    const { text, utf8 } = nfText(NF.bytes);
    let t = text;
    parts.forEach((p, i) => { t = Tpl.merge(t, p.txt, { props: tplProps(), date: S.order.date, shift: p.shift, fit: i === 0 }).text; });
    out = nfEncode(t, utf8);
  } catch (e) { console.error(e); toast("Malliga ühendamine ebaõnnestus: " + (e.message || e)); return false; }
  await saveFile(base + ".dxf", out);
  if ($("s_fileFmt").value === "dwg") setTimeout(() => toast("DXF-malliga joonis on DXF. DWG saamiseks kasuta DWT/DWG-malli."), 3400);
  return true;
}

/* frame drawing beside the sign: its left edge one sign length to the right of the sign's right edge, same height as the frame in the sign */
function nfFramePart(x0, y0, signW) {
  if (!$("s_nfFrame").checked || !(S.bars || []).length) return null;
  const fr = frameDXF(); const fx = 2 * signW;
  const sx = fx - fr.origin[0], sy = -y0;
  const b = fr.box; return { part: { txt: fr.txt, shift: [sx, sy] }, box: [b[0] + sx, b[1] + sy, b[2] + sx, b[3] + sy] };
}
/* production contours under a line below the drawing: face cut line + groove mirrored (cut from the back) under the sign,
   the base next to them under the frame drawing; each material block gets its material name above it.
   lowY = lowest point of what is already on the sheet (template coordinates, letters' bottom-left = 0;0) */
function nfCutPart(x0, y0, signW, hT, lowY, rightX) {
  if (!$("s_nfCut").checked || !S.letters.length || !(S.prof || []).length || S.prof.some(p => !p)) return null;
  const x1L = Math.max(...S.letters.map(L => L.bb.x1)), wL = x1L - x0;
  const gap = Math.max(40, hT * 0.25), th = Math.max(10, Math.min(60, hT * 0.1));
  const lineY = lowY - gap, m = Math.max(40, 0.08 * Math.max(signW, hT)), bx2 = 2 * signW;
  const T = (pts, mir, ox, oy) => pts.map(p => [(mir ? x0 + x1L - p[0] : p[0]) - x0 + ox, p[1] - y0 + oy]);
  const letters = [], prof = [], labels = [];
  /* letters grouped by material: one row per material, rows stacked downwards */
  const rows = (matOf, mir, ox, keys) => {
    const by = new Map(); S.letters.forEach((L, i) => { const k = matOf(i); if (!by.has(k)) by.set(k, []); by.get(k).push(i); });
    let top = lineY - gap * 0.6;
    for (const [mat, idx] of by) {
      labels.push([ox, top - th, mat]);
      const oy = top - th - gap * 0.5 - hT;
      for (const i of idx) {
        const p = S.prof[i], q = { type: p.type, cont: [], base: [], groove: [] };
        for (const k of keys) q[k] = (p[k] || []).map(lp => T(lp, mir, ox, oy));
        letters.push({ loops: [] }); prof.push(q);
      }
      top = oy - gap;
    }
    return top;
  };
  const faceMat = i => String(grpOf(i).faceMat || "").trim() || "Esipind";
  const b1 = rows(faceMat, true, 0, ["cont", "groove"]);
  const b2 = rows(i => backMat(grpOf(i)) || "Põhi", false, bx2, ["base"]);
  const x2 = Math.max(rightX, bx2 + wL) + m;
  const txt = Core.writeDXF({ layerNames: exportLayerNames(), only: new Set(["KONTUUR", "SOON", "POHI", "INFO"]), curveMode: cfg.curveMode || "lines", chordTol: cfg.chordTol || 0.01,
    letters, chains: [], leds: [], holes: [], bars: [], posts: [], mounts: null, types: cfg.types, holeD: cfg.holeD, prof, drainMode: cfg.drainMode,
    extra: g => { g.line([-m, lineY], [x2, lineY], "INFO"); for (const [x, y, s] of labels) g.text(x, y, th, s, "INFO"); } });
  return { part: { txt, shift: [0, 0] }, box: [-m, Math.min(b1, b2), x2, lineY] };
}
function nfSaveFrameOpt() { try { localStorage.setItem("valg_nfframe", $("s_nfFrame").checked ? "1" : "0"); } catch (e) {} }

/* ---------- käivitus ---------- */
$("btnNfIn").addEventListener("click", () => $("nfIn").click());
$("nfIn").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) nfLoad(f); });
$("btnNfDel").addEventListener("click", nfRemove);
$("s_useNf").addEventListener("change", () => { nfSaveUse(); if (window.__fmtLabels) window.__fmtLabels(); updateExpNote(); });
try { $("s_useNf").checked = localStorage.getItem("valg_nfuse") !== "0"; } catch (e) { $("s_useNf").checked = true; }
try { $("s_nfFrame").checked = localStorage.getItem("valg_nfframe") !== "0"; } catch (e) { $("s_nfFrame").checked = true; }
$("s_nfFrame").addEventListener("change", () => { nfSaveFrameOpt(); updateExpNote(); });
try { $("s_nfCut").checked = localStorage.getItem("valg_nfcut") !== "0"; } catch (e) { $("s_nfCut").checked = true; }
$("s_nfCut").addEventListener("change", () => { try { localStorage.setItem("valg_nfcut", $("s_nfCut").checked ? "1" : "0"); } catch (e) {} updateExpNote(); });
nfUI();
nfStore("readonly", st => st.get(NF_KEY)).then(v => {
  if (!v || !v.bytes) return;
  const bytes = new Uint8Array(v.bytes);
  if (!nfKind(v.name)) { nfStore("readwrite", st => st.delete(NF_KEY)).catch(() => {}); return; }
  const go = () => { try { NF.info = nfDescribe(v.name, bytes); NF.name = v.name; NF.bytes = bytes; nfUI(); } catch (e) { console.warn("Salvestatud malli ei saa lugeda", e); } };
  if (window.AcadTs) setTimeout(go, 50); else window.addEventListener("load", go);
}).catch(() => {});
