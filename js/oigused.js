/* Valgustähed — oigused.js
   Gruppide õigused: mida iga grupp (Kasutaja, Müük) rakenduses näeb ja teha tohib; admin näeb ja tohib alati kõike.
   Õigused on andmebaasi tabelis "rollid" (supabase.sql); tööde vaatamist, salvestamist ja kustutamist kontrollib ka andmebaas ise.
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */
const OIG_GRUPID = [{ roll: "kasutaja", nimi: "Kasutaja" }, { roll: "muuk", nimi: "Müük" }];
const OIGUSED = [
  { g: "Paneeli jaotised", k: "p_sisend", nimi: "Sisend", el: ["secIn"] },
  { g: "Paneeli jaotised", k: "p_tellimus", nimi: "Tellimuse info", el: ["secOrder"] },
  { g: "Paneeli jaotised", k: "p_osad", nimi: "Osad", el: ["secParts"] },
  { g: "Paneeli jaotised", k: "p_esipind", nimi: "Esipind", el: ["secFace"] },
  { g: "Paneeli jaotised", k: "p_kulg", nimi: "Külg", el: ["secSide"] },
  { g: "Paneeli jaotised", k: "p_tagapind", nimi: "Tagapind", el: ["secBack"] },
  { g: "Paneeli jaotised", k: "p_valgustus", nimi: "Valgustus", el: ["secLight"] },
  { g: "Paneeli jaotised", k: "p_raam", nimi: "Raam", el: ["secFrame"] },
  { g: "Paneeli jaotised", k: "p_avad", nimi: "Avad", el: ["secHoles"] },
  { g: "Paneeli jaotised", k: "p_led", nimi: "LED paigutus", el: ["secPlace"] },
  { g: "Paneeli jaotised", k: "p_profiil", nimi: "Profiil ja täpsemad seaded", el: ["secProf"] },
  { g: "Paneeli jaotised", k: "p_raport", nimi: "Raport", el: ["secRep"] },
  { g: "Paneeli jaotised", k: "p_eksport", nimi: "Eksport", el: ["secOut"] },
  { g: "Toimingud", k: "t_dxf", nimi: "DXF/DWG-faili laadimine", el: ["btnLoad"] },
  { g: "Toimingud", k: "t_projekt", nimi: "Projektifaili salvestamine ja avamine", el: ["btnSaveProj", "btnOpenProj"] },
  { g: "Toimingud", k: "t_tood_vaata", nimi: "Tööde nimekiri ja avamine andmebaasist", el: ["btnDb", "btnDbOpen"] },
  { g: "Toimingud", k: "t_tood_salvesta", nimi: "Tööde salvestamine andmebaasi", el: ["btnDbSave", "btnDbSaveNew"] },
  { g: "Toimingud", k: "t_tood_kustuta", nimi: "Tööde kustutamine andmebaasist", el: [] },
  { g: "Toimingud", k: "t_tooriistad", nimi: "Joonise muutmise tööriistad (LED, avad, raam, kustutamine)", el: [] },
  { g: "Toimingud", k: "t_3d", nimi: "3D-vaade", el: ["m3d"] },
  { g: "Toimingud", k: "t_kliendi_pdf", nimi: "PDF kliendile", el: ["btnPdf"] },
  { g: "Toimingud", k: "t_mall", nimi: "Mall ja eksport malli peale", el: ["nfBox"] }
];
const OIG_TOOLS = ["led", "hole", "bar", "post", "screw", "delete"];
const OIG = { perms: null, grupid: {}, dirty: false };

/* ---------- kas tohib ---------- */
function oigus(k) {
  const me = typeof DB !== "undefined" ? DB.me : null;
  if (!me) return true;                     /* enne sisselogimist on rakendus nagunii peidus */
  if (me.roll === "admin") return true;
  return !!(OIG.perms && OIG.perms[k]);
}
async function oigLoad() {
  OIG.perms = null; OIG.grupid = {};
  const c = typeof dbClient === "function" ? dbClient() : null; if (!c || !DB.me) { oigApply(); return; }
  try {
    const { data, error } = await c.from("rollid").select("roll,nimi,oigused"); if (error) throw error;
    for (const r of data || []) OIG.grupid[r.roll] = r;
    OIG.perms = (OIG.grupid[DB.me.roll] || {}).oigused || {};
  } catch (e) { console.warn("Õigusi ei saanud laadida", e); OIG.perms = {}; }
  oigApply();
}

/* ---------- peida, mida ei tohi ---------- */
function oigApply() {
  for (const o of OIGUSED) { const ok = oigus(o.k); for (const id of o.el) { const e = $(id); if (!e) continue; if (!ok) { e.dataset.oigPeidus = "1"; e.hidden = true; } else if (e.dataset.oigPeidus) { delete e.dataset.oigPeidus; e.hidden = false; } } }
  /* Tööd button and the template box are also shown by their own modules: keep them hidden when not allowed */
  if (!oigus("t_tood_vaata") && $("btnDb")) $("btnDb").hidden = true;
  const edit = oigus("t_tooriistad");
  document.querySelectorAll("#tools button").forEach(b => { if (OIG_TOOLS.includes(b.dataset.tool)) b.hidden = !edit; });
  if (!edit && OIG_TOOLS.includes(S.tool)) setTool("select");
  if (!oigus("t_3d") && typeof T3 !== "undefined" && T3.on && typeof set3D === "function") set3D(false);
  if (typeof dbUI === "function") dbUI();
  if (typeof updateExpNote === "function") updateExpNote();
  if (window.__fmtLabels) window.__fmtLabels();
}

/* ---------- toimingute valvurid ---------- */
(function guard() {
  const st = setTool; setTool = function (t) { if (OIG_TOOLS.includes(t) && !oigus("t_tooriistad")) { toast("Sinu grupil pole joonise muutmise õigust."); t = "select"; } return st(t); };
  const rf = readFile; readFile = function (f) { if (!oigus("t_dxf")) { toast("Sinu grupil pole faili laadimise õigust."); return; } return rf(f); };
  const ds = dbSave; dbSave = function (asNew) { if (!oigus("t_tood_salvesta")) { toast("Sinu grupil pole andmebaasi salvestamise õigust."); return; } return ds(asNew); };
  const dd = dbDelete; dbDelete = function (id) { if (!oigus("t_tood_kustuta")) { toast("Sinu grupil pole tööde kustutamise õigust."); return; } return dd(id); };
  const na = nfActive; nfActive = function () { return oigus("t_mall") && na(); };
  if (typeof set3D === "function") { const s3 = set3D; set3D = function (on) { if (on && !oigus("t_3d")) return; return s3(on); }; }
})();

/* ---------- admini vaheleht „Õigused“ ---------- */
function oigRender() {
  const groups = [...new Set(OIGUSED.map(o => o.g))];
  const head = `<tr><th>Mida näeb või teha tohib</th>${OIG_GRUPID.map(g => `<th class="c">${esc(g.nimi)}</th>`).join("")}<th class="c">Admin</th></tr>`;
  const rows = groups.map(gr => `<tr class="grp"><td colspan="${OIG_GRUPID.length + 2}">${esc(gr)}</td></tr>` + OIGUSED.filter(o => o.g === gr).map(o => `<tr><td>${esc(o.nimi)}</td>${OIG_GRUPID.map(g => { const on = !!(((OIG.grupid[g.roll] || {}).oigused || {})[o.k]); return `<td class="c"><input type="checkbox" data-roll="${g.roll}" data-k="${o.k}"${on ? " checked" : ""} aria-label="${esc(g.nimi)}: ${esc(o.nimi)}"></td>`; }).join("")}<td class="c"><input type="checkbox" checked disabled title="Admin näeb ja tohib alati kõike"></td></tr>`).join("")).join("");
  $("oigTable").innerHTML = `<thead>${head}</thead><tbody>${rows}</tbody>`;
  $("btnOigSave").disabled = !OIG.dirty;
}
async function oigOpen() { $("admUsers").hidden = true; $("admRights").hidden = false; $("admTabUsers").classList.remove("on"); $("admTabRights").classList.add("on"); admMsg(""); OIG.dirty = false; await oigLoad(); oigRender(); }
function oigUsersTab() { $("admUsers").hidden = false; $("admRights").hidden = true; $("admTabUsers").classList.add("on"); $("admTabRights").classList.remove("on"); admMsg(""); }
async function oigSave() {
  const c = dbClient(); admMsg("Salvestan õigusi…");
  try {
    for (const g of OIG_GRUPID) {
      const o = Object.assign({}, (OIG.grupid[g.roll] || {}).oigused || {});
      $("oigTable").querySelectorAll(`input[data-roll="${g.roll}"]`).forEach(i => { o[i.dataset.k] = i.checked; });
      const { error } = await c.from("rollid").update({ oigused: o }).eq("roll", g.roll); if (error) throw error;
    }
    OIG.dirty = false; await oigLoad(); oigRender(); admMsg("Õigused salvestatud. Muudatus kehtib kasutajatele nende järgmisel sisselogimisel või lehe laadimisel.");
  } catch (e) { console.error(e); admMsg(dbErr(e), true); }
}
$("admTabUsers").addEventListener("click", oigUsersTab);
$("admTabRights").addEventListener("click", oigOpen);
$("oigTable").addEventListener("change", e => { if (e.target.matches("input[data-k]")) { OIG.dirty = true; $("btnOigSave").disabled = false; } });
$("btnOigSave").addEventListener("click", oigSave);
