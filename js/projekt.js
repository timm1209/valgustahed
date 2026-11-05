/* Valgustähed — projekt.js
   Projektifail: salvestamine ja avamine (.ledprojekt.json).
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */
/* ---------- project file: source DXF + settings + all placed items ---------- */
function projectData() {
  return { app: "Valgustähed", version: 1, appVersion: "2.16", saved: new Date().toISOString(), name: S.name, sample: S.srcText ? null : (S.sample || "poc"), dxf: S.srcText || null, srcFmt: S.srcText ? (S.srcFmt || "dxf") : null,
    order: S.order, cfg, mountAdd: S.mountAdd || [], mountDel: S.mountDel || [], leds: S.leds, holes: S.holes, bars: S.bars, posts: S.posts || [], rails: S.rails || [], groups: S.groups, letters: S.letters.map(L => [L.type, L.mode, L.group || 0]), manual: S.manual };
}
$("btnSaveProj").addEventListener("click", async () => {
  if (!S.letters.length) { toast("Pole midagi salvestada."); return; }
  const name = baseName() + ".ledprojekt.json"; const bytes = new TextEncoder().encode(JSON.stringify(projectData()));
  let dl = null; try { dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null; } catch (e) { dl = null; }
  if (dl) { try { await dl.save({ filename: name, data: bytes }); toast("Projekt salvestatud: " + name); } catch (e) { if (e && e.code === "declined") return; toast("Salvestamine ei õnnestunud: " + (e && e.message || "tundmatu viga")); } return; }
  try { const blob = new Blob([bytes], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast("Projekt salvestatud: " + name); } catch (e) { toast("Allalaadimine pole siin lubatud."); }
});
$("btnOpenProj").addEventListener("click", () => $("projIn").click());
$("projIn").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; const r = new FileReader(); r.onload = () => openProject(String(r.result), f.name); r.onerror = () => toast("Faili ei õnnestunud lugeda."); r.readAsText(f); });

function openProject(text, fname) {
  let d; try { d = JSON.parse(text); } catch (e) { toast("See ei ole projektifail."); return; }
  if (!d || (d.app !== "Valgustähed" && d.app !== "LED-paigutaja") || !d.cfg) { toast("See ei ole Valgustähtede projektifail."); return; }
  const def = JSON.parse(JSON.stringify(DEF)); cfg = Object.assign(def, d.cfg); if (!cfg.types || cfg.types.length !== 4) cfg.types = def.types; saveCfg();
  fillTypeSelects(); bindValues(); activePreset = null; fillPresets();
  if (d.dxf) { loadDXFText(d.dxf, d.name || fname); S.srcFmt = d.srcFmt || "dxf"; updateFileInfo(); } else loadSample(d.sample === "wide" ? "wide" : "poc");
  if (!S.letters.length) return;
  if (d.name) { S.name = d.name; updateFileInfo(); }
  (d.letters || []).forEach((v, i) => { if (S.letters[i]) { S.letters[i].type = v[0]; S.letters[i].mode = v[1] || "auto"; S.letters[i].group = v[2] || 0; } });
  S.order = Object.assign(emptyOrder(), d.order || {});
  /* older projects kept one set of face/side values in the order: they become the first part */
  S.groups = Array.isArray(d.groups) && d.groups.length ? d.groups.map(g => Object.assign(emptyGroup(), g)) : [Object.assign(emptyGroup("Tekst"), Object.fromEntries(GROUP_KEYS.filter(k => d.order && d.order[k]).map(k => [k, d.order[k]])))]; S.gCur = 0;
  fillOrder();
  S.leds = d.leds || []; S.holes = d.holes || []; S.bars = d.bars || []; S.posts = d.posts || []; S.rails = d.rails || []; S.mountAdd = d.mountAdd || []; S.mountDel = d.mountDel || []; S.manual = !!d.manual; undo.length = 0; S.sel = null;
  computeProfile(); recompute(); fit();
  toast("Projekt avatud: " + (d.name || fname));
}
/* export file name = the source file's own name without its extension; only characters Windows forbids in file names are dropped */
function baseName() { return String(S.name || "").replace(/\.ledprojekt\.json$/i, "").replace(/\.(dxf|dwg|dwt|json)$/i, "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim() || "paigutus"; }
