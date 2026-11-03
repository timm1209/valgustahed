/* Valgustähed — sisend.js
   DXF-faili laadimine: failivalik, lohistamine, kontuuridest tähed, näidised.
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */
/* ---------- loading ---------- */
function loadLoops(loops, name, extra) {
  const letters = Core.makeLetters(loops);
  S.letters = letters; S.name = name; S.openCount = extra ? extra.open : 0; S.dupes = extra ? extra.dupes : 0; S.sel = null; S.selLetter = null; undo.length = 0;
  S.chains = letters.map(L => { try { return Core.skeleton(L); } catch (e) { console.error(e); return []; } });
  computeSamples(); computeProfile();
  autoPlace(); fit(); updateFileInfo();
}
function computeSamples() {
  const tot = S.letters.reduce((s, L) => s + L.area, 0) || 1; const minPitch = Math.min(...cfg.types.map(t => t.pitch));
  const g = Math.max(1.5, Math.min(minPitch / 8, Math.sqrt(tot / 60000)));
  S.samp = S.letters.map(L => Core.samples(L, g));
}

function loadDXFText(text, name) {
  try {
    const r = Core.parseDXF(text, cfg.units, cfg.chordTol); const b = Core.buildLoops(r.paths, cfg.tol);
    if (!b.loops.length) { toast("Failist ei leitud ühtegi suletud kontuuri."); S.parseInfo = r.info; S.openCount = b.open.length; renderVal(); return; }
    S.srcText = text; S.srcFmt = "dxf"; S.sample = null; S.parseInfo = r.info;
    loadLoops(b.loops, name, { open: b.open.length, dupes: b.dupes });
    toast(`Laaditud: ${S.letters.length} kuju`);
  } catch (e) { console.error(e); toast(e.message || "Faili lugemine ebaõnnestus."); }
}
function loadSample(which) { S.srcText = null; S.srcFmt = null; S.sample = which; S.parseInfo = null; loadLoops(which === "poc" ? Core.samplePOC() : Core.sampleWide(), which === "poc" ? "Näidis „POC“" : "Näidis: laiad kujud"); }
function reloadSource() { if (S.srcText) loadDXFText(S.srcText, S.name); else if (S.sample) loadSample(S.sample); }

/* ---------- file IO ---------- */
$("btnLoad").addEventListener("click", () => $("fileIn").click());
$("fileIn").addEventListener("change", e => { const f = e.target.files[0]; if (f) readFile(f); e.target.value = ""; });
function readFile(f) {
  if (/\.dwg$/i.test(f.name)) { readDWG(f); return; }
  const r = new FileReader(); r.onload = () => loadDXFText(String(r.result), f.name); r.onerror = () => toast("Faili ei õnnestunud lugeda."); r.readAsText(f);
}
/* DWG -> DXF text (AutoCAD 2018) through acad-ts; the text is kept as the source, so export can go onto the same drawing */
function dwgToDxfText(buf) {
  if (!window.AcadTs || !AcadTs.DwgReader) throw new Error("DWG-teek puudub.");
  const doc = AcadTs.DwgReader.readFromStream(buf, () => {});
  doc.header.version = AcadTs.ACadVersion.AC1032;
  let s = ""; AcadTs.DxfWriter.writeToStream({ write: v => { s += v; } }, doc);
  return s;
}
function readDWG(f) {
  toast("Loen DWG-faili…");
  const r = new FileReader();
  r.onload = () => setTimeout(() => {
    let text; try { text = dwgToDxfText(r.result); }
    catch (e) { console.error(e); toast("DWG lugemine ebaõnnestus: " + (e.message || e) + ". Proovi salvestada fail AutoCAD-is DXF-ina."); return; }
    loadDXFText(text, f.name); if (S.srcText === text) { S.srcFmt = "dwg"; updateFileInfo(); }
  }, 30);
  r.onerror = () => toast("Faili ei õnnestunud lugeda."); r.readAsArrayBuffer(f);
}
/* drag and drop anywhere in the window: .dxf loads a drawing, .json opens a saved project */
const hasFiles = e => !document.body.classList.contains("vt-off") && !!e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files");
let dropTimer = null; const showDrop = on => { $("drop").hidden = !on; };
window.addEventListener("dragenter", e => { if (!hasFiles(e)) return; e.preventDefault(); showDrop(true); });
window.addEventListener("dragover", e => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; showDrop(true); clearTimeout(dropTimer); dropTimer = setTimeout(() => showDrop(false), 400); });
window.addEventListener("dragleave", e => { if (!e.relatedTarget || e.clientX <= 0 || e.clientY <= 0 || e.clientX >= innerWidth || e.clientY >= innerHeight) showDrop(false); });
window.addEventListener("drop", e => {
  if (!hasFiles(e)) return; e.preventDefault(); clearTimeout(dropTimer); showDrop(false);
  const files = [...e.dataTransfer.files]; const f = files.find(x => /\.(dxf|dwg)$/i.test(x.name)) || files.find(x => /\.json$/i.test(x.name)) || files[0]; if (!f) return;
  if (/\.json$/i.test(f.name)) { const r = new FileReader(); r.onload = () => openProject(String(r.result), f.name); r.onerror = () => toast("Faili ei õnnestunud lugeda."); r.readAsText(f); return; }
  if (!/\.(dxf|dwg)$/i.test(f.name)) { toast("Lohista DXF- või DWG-fail või projektifail (.json)."); return; }
  readFile(f);
});
