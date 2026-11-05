/* Valgustähed — eksport.js
   LED-joonise eksport: DXF, DWG, külje splainid, faili salvestamine.
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */
$("btnExport").addEventListener("click", exportDXF);

const LAYER_MAP = [["ly_cont", "KONTUUR"], ["ly_skel", "KESKJOON"], ["ly_soor", "SOOR"], ["ly_led", "LED"], ["ly_hole", "VEEAUK"], ["ly_mount", "KINNITUS"], ["ly_frame", "RAAM"], ["ly_base", "POHI"], ["ly_groove", "SOON"], ["ly_mdim", "MOODUD"], ["ly_wire", "JUHE"]];
function exportLayers() { const l = new Set(["INFO"]); for (const [id, n] of LAYER_MAP) if ($(id).checked && !(n === "MOODUD" && !$("ly_mount").checked) ) l.add(n); return l; }
function updateExpNote() { if (!$("expNote")) return; const l = [...exportLayers()].filter(n => n !== "INFO").map(n => Core.EXPORT_LAYER_NAMES[n] || n); $("expNote").textContent = "Ekspordin kihid: " + l.join(", ") + ". Kihtide menüüs väljalülitatud kihte faili ei lähe. Algset (töötlemata) kontuuri ei ekspordita. Avade mõõdud on AutoCAD-i mõõdud (DIMENSION, stiil AVAD = Raam3 seaded). " + ($("s_fileFmt").value === "dwg" ? "Fail on DWG (AutoCAD 2018)." : "Fail on DXF R2000.") + (typeof nfActive === "function" && nfActive() ? " Joonis lisatakse malli " + NF.name + " mudelruumi (tähtede alumine vasak nurk punkti 0;0)" + ($("s_nfFrame") && $("s_nfFrame").checked ? ", raamijoonis sellest paremale (vahe = reklaami pikkus)" : "") + ($("s_nfCut") && $("s_nfCut").checked ? ", joone alla esipinna lõikejoon ja soon peegelpildis ning kõrvale põhi, kummagi peal materjal" : "") + "; mall jääb muutmata, tellimuse info läheb DWGPROPS-i väljadesse ja lehtede vaateaknad sätitakse joonisele. Fail tuleb " + (nfIsDxf(NF.name) ? "DXF-ina." : "DWG-na (malli versioon).") : "") + " Külg läheb eraldi faili splainidena (kiht KYLG). Ühik mm."; }
async function exportDXF() {
  if (!S.letters.length) { toast("Pole midagi eksportida."); return; }
  const x0 = Math.min(...S.letters.map(L => L.bb.x0)), y0 = Math.min(...S.letters.map(L => L.bb.y0)); const hT = Math.max(...S.letters.map(L => L.bb.y1)) - y0;
  const byT = cfg.types.map((t, i) => `${t.name}: ${S.leds.filter(l => l.t === i).length} tk`).filter(s => !/: 0 tk/.test(s));
  let info; const infoH = Math.max(8, hT * 0.035), infoTop = -Math.max(30, hT * 0.12);
  const txt = Core.writeDXF({ cables: S.cables && S.cables.length ? S.cables : null, cableD: cfg.cableD || 8, layerNames: exportLayerNames(), drainMode: cfg.drainMode, only: exportLayers(), curveMode: cfg.curveMode || "lines", chordTol: cfg.chordTol || 0.01, letters: S.letters, chains: S.chains, leds: S.leds, holes: S.holes, bars: S.bars, posts: S.posts, rails: (S.rails || []).map(r => railGeom(r).poly), mounts: S.mounts, mountD: cfg.mountD, types: cfg.types, holeD: cfg.holeD, prof: S.prof, wire: S.wire ? S.wire.order : null,
    info: (info = [`LED kokku ${S.leds.length} (${byT.join(", ")})`, ...(S.holes.length ? [`Veeauke ${S.holes.length} x D${cfg.holeD}`] : cfg.drainMode === "none" ? ["Veeavad: ei ole"] : []), `Kinnitusavasid ${(S.mounts || []).length} x D${cfg.mountD}`, ...(S.cables && S.cables.length ? [`Kaabliavasid ${S.cables.length} x D${cfg.cableD || 8}`] : []), `Raamiprofiil ${barPieces()} tk, ${(S.bars.reduce((s, b) => s + b.x1 - b.x0, 0) / 1000).toFixed(2)} m`, `Vertikaalpulgad ${(S.posts || []).length} tk, ${(postLen() / 1000).toFixed(2)} m`, `Kate ${pct(S.rep.coverage)}`, ...orderLines()]), infoX: x0, infoY: y0 - Math.max(30, hT * 0.12), infoH: Math.max(8, hT * 0.035) });
  const base = baseName();
  if (nfActive()) {
    const x1 = Math.max(...S.letters.map(L => L.bb.x1), ...(S.bars || []).map(b => b.x1)), wT = x1 - x0, m = Math.max(40, 0.08 * Math.max(wT, hT));
    const parts = [{ txt, shift: [-x0, -y0] }], boxes = { main: [-m, -m - Math.max(30, hT * 0.12), wT + m, hT + m], frame: null };
    const fr = nfFramePart(x0, y0, wT); if (fr) { parts.push(fr.part); boxes.frame = fr.box; }
    const low = Math.min(infoTop - (info.length - 1) * infoH * 1.6 - infoH, -m, fr ? fr.box[1] : 0), right = fr ? fr.box[2] : 2 * wT + wT;
    const cut = nfCutPart(x0, y0, wT, hT, low, right); if (cut) parts.push(cut.part);
    const ok = await saveNf(base, parts, boxes);
    /* exporting onto the template also saves the work to the database (updates it when it was opened from there) */
    if (ok && typeof dbReady === "function" && dbReady()) setTimeout(() => dbSave(false), 600);
    return;
  }
  await saveCad(base, txt);
}
/* AutoCAD erases dimensions with text line spacing factor 0 and expects DIMMZF/DIMALTMZF 100 (acad-ts defaults are 0) */
function fixDwgDims(doc) {
  for (const s of doc.dimensionStyles) if (!s.dwgRawRecord) { if (!(s.mzf > 0)) s.mzf = 100; if (!(s.altMzf > 0)) s.altMzf = 100; }
  for (const e of doc.modelSpace.entities) if (e.objectName === "DIMENSION") { if (!(e.lineSpacingFactor > 0)) e.lineSpacingFactor = 1; if (!e.lineSpacingStyle) e.lineSpacingStyle = 1; }
}
/* DXF text -> AutoCAD 2018 DWG (AC1032) through acad-ts */
function dxfToDwg(dxfText, ver) {
  if (!window.AcadTs) throw new Error("DWG-teek puudub.");
  const { DxfReader, DwgWriter, ACadVersion } = window.AcadTs;
  const doc = DxfReader.readFromStream(new TextEncoder().encode(dxfText), () => {});
  doc.header.version = ACadVersion[ver || "AC1032"];
  const has = (t, n) => { try { t.get(n); return true; } catch (e) { return false; } };
  if (!has(doc.dimensionStyles, doc.header.currentDimensionStyleName)) doc.header.currentDimensionStyleName = "Standard";
  if (!has(doc.textStyles, doc.header.currentTextStyleName)) doc.header.currentTextStyleName = "Standard";
  if (!has(doc.layers, doc.header.currentLayerName)) doc.header.currentLayerName = "0";
  if (!has(doc.lineTypes, doc.header.currentLineTypeName)) doc.header.currentLineTypeName = "ByLayer";
  /* DWG 2018 stores Unicode: turn the DXF \U+XXXX escapes back into real letters */
  for (const e of doc.modelSpace.entities) if (typeof e.value === "string" && e.value.includes("\\U+")) e.value = e.value.replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const uni = v => v.replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  for (const l of doc.layers) if (l.name && l.name.includes("\\U+")) l.name = uni(l.name);
  fixDwgDims(doc);
  return DwgWriter.writeToBuffer(doc);
}
async function saveCad(base, dxfText, ver) {
  if ($("s_fileFmt").value === "dwg") {
    let bytes; try { bytes = dxfToDwg(dxfText, ver); } catch (e) { console.error(e); toast("DWG koostamine ebaõnnestus: " + (e.message || e) + ". Proovi DXF-vormingut."); return; }
    await saveFile(base + ".dwg", bytes);
  } else {
    /* R2000 DXF is ANSI_1252: write Latin letters (Õ, Ä, …) as real bytes, keep other \U+ escapes */
    const t = dxfText.replace(/\\U\+00([A-Fa-f][0-9A-Fa-f])/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    const bytes = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); bytes[i] = c < 256 ? c : 63; }
    await saveFile(base + ".dxf", bytes);
  }
}
async function saveFile(name, bytes) {
  /* saved under its own name; only inside claude.ai, where DXF/DWG cannot be saved directly, it goes into a ZIP */
  const direct = () => { const blob = new Blob([bytes], { type: "application/octet-stream" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
  let dl = null; try { dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null; } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({ filename: name, data: bytes }); return; }
    catch (e) { if (e && e.code === "declined") return;
      /* claude.ai only saves some file types (DXF/DWG are not among them): fall back to a ZIP with the file inside */
      if (e && (e.code === "rejected_extension" || e.code === "extension_not_enabled")) {
        const zipName = name.replace(/\.[^.]+$/, "") + ".zip";
        try { await dl.save({ filename: zipName, data: Core.zipStore(name, bytes) }); toast("Salvestatud ZIP-failina (sees " + name + ")."); } catch (e2) { if (!(e2 && e2.code === "declined")) toast("Salvestamine ei õnnestunud: " + (e2 && e2.message || "tundmatu viga")); }
        return; }
      toast("Salvestamine ei õnnestunud: " + (e && e.message || "tundmatu viga")); return; }
  }
  try { direct(); toast("Eksporditud: " + name); } catch (e) { toast("Allalaadimine pole siin lubatud."); }
}

$("btnExportSide").addEventListener("click", async () => {
  if (!S.prof || !S.prof.length || !S.prof[0]) { toast("Külje kontuur puudub."); return; }
  const loops = S.prof.flatMap(p => p.side || []); if (!loops.length) { toast("Külje kontuur puudub."); return; }
  /* one file per letter depth ("0,7x60"): parts with the same depth share a file; name = original file name + thickness x depth */
  const raw = baseName();
  const by = new Map(); S.prof.forEach((p, i) => { if (!p || !p.side) return; const t = sideSpec(grpOf(i)).text; if (!by.has(t)) by.set(t, []); by.get(t).push(...p.side); });
  for (const [t, lps] of by) await saveCad(`${raw} ${t}mm`, Core.writeSplineDXF(lps, "KYLG"), "AC1015"); /* the bending machine reads AutoCAD 2000 */
  if (by.size > 1) toast(`Külg eksporditi ${by.size} failina (iga tähe sügavus eraldi).`);
});
