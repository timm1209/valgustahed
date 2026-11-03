/* Valgustähed — profiil.js
   Profiil: põhja, külje ja soone nihked, nurgaraadiused ja eelseadistused.
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */
/* P3 (halo / backlit letter): the imported contour is the aluminium face (3_AL), the base is the back panel (2_CUT), no groove */
const isP3 = () => cfg.profType === "p3";
const exportLayerNames = () => Core.EXPORT_LAYER_NAMES; /* P3 letters swap their layers in the writer */
const anyP3 = () => S.letters.some((L, i) => letterType(i) === "p3");
function syncProfType() { const p3 = isP3(); $("rowGroove").hidden = p3; $("rowCable").hidden = !(p3 || (S.groups || []).some(g => g.profType === "p3")); }
/* profile of one letter: its part's type (Esipind → Profiil) and side thickness ("0,7x60") pick the preset; otherwise the Profiil section values */
function letterType(i) { const g = grpOf(i); return (g && g.profType) || cfg.profType || "liist"; }
function presetsOfType(t) { const u = userPresets().filter(p => ptype(p) === t), bi = PRESETS_BUILTIN.filter(b => ptype(b) === t); return [...bi.filter(b => !u.some(x => x.name === b.name)), ...u]; }
function letterProf(i) {
  const g = grpOf(i), type = letterType(i), m = String((g && g.sideMat) || "").match(/(\d+(?:[.,]\d+)?)\s*[x×*]/), th = m ? m[1].replace(".", ",") + "mm" : null;
  const own = { type, offBase: cfg.offBase, offSide: cfg.offSide, offGroove: cfg.offGroove, rIn: cfg.rIn, rOut: cfg.rOut };
  const sameType = type === (cfg.profType || "liist");
  if (sameType && (!th || th === $("s_preset").value)) return own; /* the values in the Profiil section (also when edited by hand) */
  const list = presetsOfType(type), q = (th && list.find(x => x.name === th)) || (sameType ? null : list[0]);
  if (!q) return own;
  return { type, offBase: +q.offBase, offSide: +q.offSide, offGroove: q.offGroove != null ? +q.offGroove : cfg.offGroove, rIn: q.rIn != null ? +q.rIn : cfg.rIn, rOut: q.rOut != null ? +q.rOut : cfg.rOut };
}
function computeProfile() {
  S.prof = S.letters.map((L, i) => { const q = letterProf(i); const p = Core.profileSet(L.loops, { rIn: q.rIn, rOut: q.rOut, rGroove: q.type === "klaas" ? Math.max(2, q.rOut) : q.rOut, rBase: q.type === "p3" ? Math.max(2, q.rOut) : q.rOut, side: q.offSide, base: q.offBase, groove: q.offGroove });
    if (p) { p.type = q.type; p.offs = q; if (q.type === "p3") p.groove = []; /* P3: no groove */ p.baseRaw = p.base; } return p; });
  applyNotches(); /* profile offsets changed: cut the drain notches into the new base again */
  renderProf(); renderSummary(); schedule3D();
}
function renderProf() {
  const p = S.prof || []; if (p.some(x => !x)) { $("profList").innerHTML = `<div class="msg bad">Kontuuri nihutamise teek ei laadinud.</div>`; return; }
  const per = k => p.reduce((s, x) => s + x[k].reduce((a, lp) => a + Core.perimOf(lp), 0), 0);
  const ar = k => p.reduce((s, x) => s + x[k].reduce((a, lp) => a + Core.area(lp), 0), 0);
  const lost = S.letters.map((L, i) => p[i] && (p[i].cont.length < L.loops.length || p[i].base.length < L.loops.length || p[i].side.length < L.loops.length || (p[i].type !== "p3" && p[i].groove.length < L.loops.length)) ? i + 1 : null).filter(Boolean);
  $("profList").innerHTML = `<div><span>Põhja pind</span><span>${(Math.abs(ar("base")) / 1e6).toFixed(3)} m²</span></div><div><span>Külje pikkus</span><span>${(per("side") / 1000).toFixed(2)} m</span></div>${isP3() ? "" : `<div><span>Soone pikkus</span><span>${(per("groove") / 1000).toFixed(2)} m</span></div>`}` + (lost.length ? `<div class="msg warn">Nihe muutis kontuuride arvu kujudel: ${lost.join(", ")}. Kitsas koht kaob või läheb lahku.</div>` : "");
}

/* ---------- profile presets: offsets + corner radii ---------- */
const PRESET_KEYS_ALL = ["offBase", "offSide", "offGroove", "rIn", "rOut"];
const pKeys = () => isP3() ? PRESET_KEYS_ALL.filter(k => k !== "offGroove") : PRESET_KEYS_ALL; /* P3 has no groove */
/* presets belong to a profile type (Tüüp): the dropdown lists only the current type's presets */
const PRESETS_BUILTIN = [
  { type: "liist", name: "1,2mm", offBase: -2.1, offSide: -1.4, offGroove: -4.7, rIn: 2, rOut: 1 },
  { type: "liist", name: "0,7mm", offBase: -1.6, offSide: -1.2, offGroove: -4.2, rIn: 2, rOut: 1 },
  { type: "klaas", name: "1,2mm", offBase: -1.9, offSide: -1.2, offGroove: -2.3, rIn: 2, rOut: 1 },
  { type: "klaas", name: "0,7mm", offBase: -1.5, offSide: -1, offGroove: -1.8, rIn: 2, rOut: 1 },
  { type: "p3", name: "1,2mm", offBase: -1.8, offSide: -0.8, rIn: 2, rOut: 1 },
  { type: "p3", name: "0,7mm", offBase: -1.1, offSide: -0.55, rIn: 2, rOut: 1 }
];
const ptype = p => p.type || "liist", curType = () => cfg.profType || "liist", ofType = p => ptype(p) === curType();
let activePreset = null; /* the preset the current values came from (kept while they are being edited) */
function userPresets() { try { const a = JSON.parse(localStorage.getItem("valg_presets") || "[]"); return Array.isArray(a) ? a.filter(p => p && p.name) : []; } catch (e) { return []; } }
function saveUserPresets(a) { try { localStorage.setItem("valg_presets", JSON.stringify(a)); return true; } catch (e) { toast("Brauser ei luba eelseadistusi salvestada."); return false; } }
const isBuiltin = n => PRESETS_BUILTIN.some(b => ofType(b) && b.name === n);
const myUser = () => userPresets().filter(ofType), otherUser = () => userPresets().filter(p => !ofType(p));
const withType = p => Object.assign(p, { type: curType() });
/* a user preset with a built-in's name overrides it; deleting the override brings the original back */
function allPresets() { const u = myUser(); return [...PRESETS_BUILTIN.filter(b => ofType(b) && !u.some(x => x.name === b.name)), ...u.filter(x => isBuiltin(x.name)), ...u.filter(x => !isBuiltin(x.name))]; }
const findPreset = n => allPresets().find(p => p.name === n);
const sameAs = p => p && pKeys().every(k => Math.abs((+p[k]) - (+cfg[k])) < 1e-9);
const fmtV = v => String(v).replace(".", ",");
const presetLabel = p => p.name;
function fillPresets() {
  const sel = $("s_preset"); sel.innerHTML = `<option value="">— kohandatud —</option>` + allPresets().map(p => `<option value="${esc(p.name)}">${esc(presetLabel(p))}</option>`).join(""); syncPreset();
}
function syncPreset() {
  const exact = allPresets().find(sameAs);
  if (exact && (!activePreset || !sameAs(findPreset(activePreset)))) activePreset = exact.name;
  if (activePreset && !findPreset(activePreset)) activePreset = null;
  const act = activePreset ? findPreset(activePreset) : null, dirty = !!act && !sameAs(act);
  $("s_preset").value = act ? act.name : "";
  $("btnPresetUpd").disabled = !dirty;
  const userOwned = act && myUser().some(p => p.name === act.name);
  $("btnPresetDel").disabled = !userOwned; $("btnPresetDel").textContent = act && isBuiltin(act.name) ? "Taasta algne" : "Kustuta";
  $("btnPresetRen").disabled = !act || isBuiltin(act.name);
  const note = $("presetNote"); note.hidden = !dirty; if (typeof renderSummary === "function" && S) renderSummary();
  if (dirty) note.textContent = `Väärtused erinevad eelseadistusest „${act.name}“ (${pKeys().filter(k => Math.abs(+act[k] - +cfg[k]) > 1e-9).map(k => ({ offBase: "põhi", offSide: "külg", offGroove: "soon", rIn: "sisenurga raadius", rOut: "välisnurga raadius" })[k]).join(", ")}). „Uuenda valitut“ salvestab muudatused sinna.`;
}
function onProfType() {
  /* same thickness in the other type: 1,2mm liist -> 1,2mm klaas */
  const was = activePreset; activePreset = null; const p = (was ? findPreset(was) : null) || allPresets()[0] || null; /* same thickness if it exists, else the type's first preset */
  if (p) { activePreset = p.name; applyPreset(p); toast(`${$("s_profType").selectedOptions[0].text}: ${p.name}`); } else { saveCfg(); computeProfile(); draw(); }
  fillPresets();
}
function applyPreset(p) { for (const k of pKeys()) cfg[k] = +p[k]; saveCfg(); bindValues(); computeProfile(); draw(); }
$("btnProfSet").addEventListener("click", () => { const box = $("profSet"), open = box.hidden; box.hidden = !open; $("btnProfSet").classList.toggle("on", open); $("btnProfSet").setAttribute("aria-expanded", String(open)); });
$("s_preset").addEventListener("change", e => {
  const p = findPreset(e.target.value); if (!p) { activePreset = null; syncPreset(); return; }
  activePreset = p.name; applyPreset(p); syncPreset(); toast("Eelseadistus: " + p.name);
});
$("btnPresetUpd").addEventListener("click", () => {
  if (!activePreset) return; const u = myUser(); const p = withType({ name: activePreset }); for (const k of pKeys()) p[k] = cfg[k];
  const i = u.findIndex(x => x.name === activePreset); if (i >= 0) u[i] = p; else u.push(p);
  if (saveUserPresets([...otherUser(), ...u])) { fillPresets(); toast("Uuendatud: " + activePreset); }
});
$("btnPresetSave").addEventListener("click", () => {
  const name = $("s_presetName").value.trim(); if (!name) { toast("Kirjuta enne salvestamist eelseadistuse nimi."); $("s_presetName").focus(); return; }
  if (findPreset(name) && !confirmOverwrite(name)) return;
  const u = myUser().filter(p => p.name !== name); const p = withType({ name }); for (const k of pKeys()) p[k] = cfg[k]; u.push(p);
  if (saveUserPresets([...otherUser(), ...u])) { activePreset = name; $("s_presetName").value = ""; fillPresets(); toast("Salvestatud: " + name); }
});
let overwriteArmed = null;
function confirmOverwrite(name) { if (overwriteArmed === name) { overwriteArmed = null; return true; } overwriteArmed = name; toast(`„${name}“ on juba olemas. Vajuta uuesti, et see üle kirjutada.`); setTimeout(() => { if (overwriteArmed === name) overwriteArmed = null; }, 4000); return false; }
$("btnPresetRen").addEventListener("click", () => {
  const name = $("s_presetName").value.trim(); if (!activePreset || isBuiltin(activePreset)) return;
  if (!name) { toast("Kirjuta uus nimi nimeväljale."); $("s_presetName").focus(); return; }
  if (name === activePreset) return; if (findPreset(name)) { toast(`Nimi „${name}“ on juba kasutusel.`); return; }
  const u = myUser(); const p = u.find(x => x.name === activePreset); if (!p) return; const old = p.name; p.name = name; withType(p);
  if (saveUserPresets([...otherUser(), ...u])) { activePreset = name; $("s_presetName").value = ""; fillPresets(); toast(`„${old}“ → „${name}“`); }
});
$("btnPresetDel").addEventListener("click", () => {
  const name = activePreset; const u = myUser(); if (!name || !u.some(p => p.name === name)) return;
  if (!saveUserPresets([...otherUser(), ...u.filter(p => p.name !== name)])) return;
  if (isBuiltin(name)) { applyPreset(findPreset(name)); fillPresets(); toast(`„${name}“ taastatud algsete väärtustega`); }
  else { activePreset = null; fillPresets(); toast("Kustutatud: " + name); }
});
