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
  $("nfUseRow").hidden = !has;
  if (window.__fmtLabels) window.__fmtLabels();
  updateExpNote();
}

/* ---------- ühendamine ----------
   Mall jääb muutmata; LED-joonise kihid, plokid, mõõdustiilid ja objektid lisatakse selle mudelruumi,
   tellimuse info läheb DWGPROPS-i väljadesse (samad nimed mis ettevõtte templatil), loomise kuupäev = tellimuse kuupäev
   ja iga lehe mudelivaateaken sätitakse joonisele standardmõõtkavas. */
const NF_SCALES = [1, 2, 2.5, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000];
function nfOrderDate() { const m = String(S.order.date || "").match(/^\s*(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\s*$/); return m ? new Date(+m[3], +m[2] - 1, +m[1], 12, 0, 0) : new Date(); }
function nfDwgMerge(dxfText, shift, box) {
  const A = window.AcadTs;
  const tpl = nfReadDwg(NF.bytes);
  const ours = A.DxfReader.readFromStream(new TextEncoder().encode(dxfText), () => {});
  for (const l of ours.layers) if (l.name && l.name.includes("\\U+")) l.name = nfUni(l.name);
  /* what the export changes is written anew, everything else stays the template's own record */
  tpl.modelSpace.dwgDirty = true;
  for (const t of [tpl.layers, tpl.lineTypes, tpl.textStyles, tpl.dimensionStyles, tpl.blockRecords, tpl.appIds]) if (t) t.dwgDirty = true;
  const d = new A.XYZ(shift[0], shift[1], 0); let n = 0;
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
  fixDwgDims(tpl);
  /* order data -> DWGPROPS (only the names the template already has) */
  const props = tplProps(), P = tpl.summaryInfo && tpl.summaryInfo.properties; let set = 0;
  if (P) for (const k of [...P.keys()]) if (Object.prototype.hasOwnProperty.call(props, k)) { const v = String(props[k] == null ? "" : props[k]).replace(/[\r\n]+/g, " ").trim(); P.set(k, v || " "); set++; }
  const dt = nfOrderDate(); tpl.header.createDateTime = dt; tpl.header.universalCreateDateTime = dt; if (tpl.summaryInfo) tpl.summaryInfo.createdDate = dt;
  /* layouts: point the model viewport of every sheet at the work */
  const fitted = [];
  if (box && box[2] > box[0]) {
    const W = box[2] - box[0], H = box[3] - box[1], cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
    const per = [];
    for (const lay of tpl.layouts) {
      if (lay.name === "Model" || !lay.associatedBlock) continue;
      const vps = [...lay.associatedBlock.entities].filter(e => e instanceof A.Viewport && !e.representsPaper && e.width > 1 && e.height > 1);
      if (vps.length) per.push(vps);
    }
    const all = per.flat(), med = a => { const q = [...a].sort((x, y) => x - y); return q.length ? q[q.length >> 1] : 0; };
    const mx = med(all.map(v => v.viewCenter.x + v.viewTarget.x)), my = med(all.map(v => v.viewCenter.y + v.viewTarget.y));
    for (const vps of per) {
      const v = vps.reduce((a, q) => Math.hypot(q.viewCenter.x + q.viewTarget.x - mx, q.viewCenter.y + q.viewTarget.y - my) < Math.hypot(a.viewCenter.x + a.viewTarget.x - mx, a.viewCenter.y + a.viewTarget.y - my) ? q : a);
      const k = NF_SCALES.find(k => W / k <= v.width * 0.88 && H / k <= v.height * 0.88) || Math.ceil(Math.max(W / (v.width * 0.88), H / (v.height * 0.88)));
      v.viewCenter = new A.XY(cx - v.viewTarget.x, cy - v.viewTarget.y); v.viewHeight = v.height * k; v.dwgDirty = true; fitted.push(k);
    }
  }
  return { doc: tpl, n, set, fitted };
}
async function saveNf(base, dxfText, shift, box) {
  if (nfKind(NF.name) === "dwg") {
    let bytes, r;
    try {
      r = nfDwgMerge(dxfText, shift, box);
      const cf = new AcadTs.DwgWriterConfiguration(); cf.writeDynamicBlockData = true;
      bytes = AcadTs.DwgWriter.writeToBuffer(r.doc, cf);
    } catch (e) { console.error(e); toast("Malliga ühendamine ebaõnnestus: " + (e.message || e)); return; }
    await saveFile(base + ".dwg", bytes);
    return;
  }
  let out;
  try {
    const { text, utf8 } = nfText(NF.bytes);
    const r = Tpl.merge(text, dxfText, { props: tplProps(), date: S.order.date, shift });
    out = nfEncode(r.text, utf8);
  } catch (e) { console.error(e); toast("Malliga ühendamine ebaõnnestus: " + (e.message || e)); return; }
  await saveFile(base + ".dxf", out);
  if ($("s_fileFmt").value === "dwg") setTimeout(() => toast("DXF-malliga joonis on DXF. DWG saamiseks kasuta DWT/DWG-malli."), 3400);
}

/* ---------- käivitus ---------- */
$("btnNfIn").addEventListener("click", () => $("nfIn").click());
$("nfIn").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) nfLoad(f); });
$("btnNfDel").addEventListener("click", nfRemove);
$("s_useNf").addEventListener("change", () => { nfSaveUse(); if (window.__fmtLabels) window.__fmtLabels(); updateExpNote(); });
try { $("s_useNf").checked = localStorage.getItem("valg_nfuse") !== "0"; } catch (e) { $("s_useNf").checked = true; }
nfUI();
nfStore("readonly", st => st.get(NF_KEY)).then(v => {
  if (!v || !v.bytes) return;
  const bytes = new Uint8Array(v.bytes);
  if (!nfKind(v.name)) { nfStore("readwrite", st => st.delete(NF_KEY)).catch(() => {}); return; }
  const go = () => { try { NF.info = nfDescribe(v.name, bytes); NF.name = v.name; NF.bytes = bytes; nfUI(); } catch (e) { console.warn("Salvestatud malli ei saa lugeda", e); } };
  if (window.AcadTs) setTimeout(go, 50); else window.addEventListener("load", go);
}).catch(() => {});
