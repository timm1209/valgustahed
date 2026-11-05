/* Valgustähed — andmebaas.js
   Supabase'i ühendus ja tehtud tööd (tabel "tood"): salvestamine, nimekiri, avamine, kustutamine.
   Sisselogimine, kasutajad ja rollid on failis kasutajad.js. Töö sisu on sama mis projektifailil (projectData / openProject).
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */
const DB = { client: null, user: null, me: null, list: [], busy: false, armDel: null, cfgSrc: "" };
const DB_TABLE = "tood";
const DB_LIST_COLS = "id,nimi,tellimus,kuju_arv,loodud,muudetud,loonud,muutnud,loonud_nimi,muutnud_nimi";

/* ---------- ühendus ---------- */
/* "https://xxxx.supabase.co/rest/v1/" (as the Data API page shows it) -> "https://xxxx.supabase.co" */
function dbUrl(u) { const s = String(u || "").trim(); try { const x = new URL(s); return x.protocol === "https:" ? x.origin : ""; } catch (e) { return ""; } }
function dbCfg() {
  if (DB_CONFIG.url && DB_CONFIG.anonKey) { DB.cfgSrc = "file"; return { url: dbUrl(DB_CONFIG.url), anonKey: DB_CONFIG.anonKey.trim() }; }
  try { const c = JSON.parse(localStorage.getItem("valg_db_cfg") || "null"); if (c && c.url && c.anonKey) { DB.cfgSrc = "local"; return { url: dbUrl(c.url), anonKey: String(c.anonKey).trim() }; } } catch (e) {}
  DB.cfgSrc = ""; return null;
}
function dbClient() {
  if (DB.client) return DB.client;
  const c = dbCfg(); if (!c) return null;
  if (!window.supabase || !window.supabase.createClient) { console.warn("Supabase'i teek puudub"); return null; }
  try { DB.client = window.supabase.createClient(c.url, c.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "valg_db_auth" } }); }
  catch (e) { console.error(e); DB.client = null; }
  return DB.client;
}
const dbErr = e => {
  const m = (e && (e.message || e.error_description || e.msg || e.error)) || String(e || "");
  if (/Failed to fetch|NetworkError|Load failed|FetchError/i.test(m)) return "Andmebaasiga ei saa ühendust (internet, aadress või see leht ei luba välisühendust).";
  if (/Invalid login credentials/i.test(m)) return "Vale e-post või parool.";
  if (/banned|User is banned/i.test(m)) return "See konto on blokeeritud. Pöördu admini poole.";
  if (/Email not confirmed/i.test(m)) return "E-post on kinnitamata. Pöördu admini poole.";
  if (/JWT|not authorized|permission denied|row-level security/i.test(m)) return "Ligipääs puudub: logi uuesti sisse.";
  if (/relation .* does not exist|Could not find the table/i.test(m)) return "Andmebaas on seadistamata (käivita supabase.sql).";
  if (/rate limit|too many/i.test(m)) return "Liiga palju katseid. Proovi mõne minuti pärast uuesti.";
  return m;
};
const dbFmtTime = t => { if (!t) return ""; const d = new Date(t); return d.toLocaleDateString("et-EE", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString("et-EE", { hour: "2-digit", minute: "2-digit" }); };
const dbReady = () => !!(dbClient() && DB.user && DB.me && DB.me.aktiivne);

/* ---------- olek paneelis ---------- */
function dbName() { return (S.order && (S.order.title || "").trim()) || (S.name || "").replace(/\.(dxf|dwg|json)$/i, "") || "Nimetu töö"; }
function dbUI() {
  if (!$("btnDbSave")) return;
  $("btnDbSave").disabled = !S.letters.length || DB.busy || !dbReady();
  if (typeof oigus === "function") { $("btnDbSave").hidden = !oigus("t_tood_salvesta"); $("btnDbOpen").hidden = !oigus("t_tood_vaata"); }
  $("btnDbOpen").disabled = !dbReady();
  $("dbStat").textContent = S.dbId ? `Andmebaasis: ${S.dbName || dbName()}${S.dbSaved ? " · salvestatud " + dbFmtTime(S.dbSaved) : ""}` : (S.letters.length && dbReady() ? "See töö pole veel andmebaasis." : "");
}

/* ---------- salvestamine ---------- */
async function dbSave(asNew) {
  if (!S.letters.length) { toast("Pole midagi salvestada."); return; }
  const c = dbClient(); if (!dbReady()) { toast("Logi enne salvestamist sisse."); return; }
  const row = { nimi: dbName(), tellimus: (S.order.orderNo || "").trim(), kuju_arv: S.letters.length, data: projectData() };
  DB.busy = true; dbUI(); toast(asNew || !S.dbId ? "Salvestan andmebaasi…" : "Uuendan andmebaasis…");
  try {
    let res;
    if (S.dbId && !asNew) res = await c.from(DB_TABLE).update(row).eq("id", S.dbId).select(DB_LIST_COLS).single();
    else res = await c.from(DB_TABLE).insert(row).select(DB_LIST_COLS).single();
    if (res.error) {
      /* the work may have been deleted meanwhile: save it as a new one */
      if (S.dbId && !asNew && /PGRST116|0 rows|no rows/i.test(res.error.message + " " + (res.error.code || ""))) { S.dbId = null; DB.busy = false; return dbSave(true); }
      throw res.error;
    }
    S.dbId = res.data.id; S.dbName = res.data.nimi; S.dbSaved = res.data.muudetud;
    toast("Salvestatud andmebaasi: " + res.data.nimi);
    const i = DB.list.findIndex(r => r.id === res.data.id); if (i >= 0) DB.list[i] = res.data; else DB.list.unshift(res.data);
  } catch (e) { console.error(e); toast("Salvestamine ebaõnnestus: " + dbErr(e)); }
  finally { DB.busy = false; dbUI(); if (!$("dbModal").hidden) dbRender(); }
}

/* ---------- nimekiri ---------- */
async function dbLoad() {
  const c = dbClient(); if (!dbReady()) return;
  dbMsg("Laadin töid…");
  try { const { data, error } = await c.from(DB_TABLE).select(DB_LIST_COLS).order("muudetud", { ascending: false }).limit(2000); if (error) throw error; DB.list = data || []; dbMsg(""); }
  catch (e) { console.error(e); dbMsg(dbErr(e), true); }
  dbRender();
}
async function dbOpenWork(id) {
  const c = dbClient(); if (!c) return;
  dbMsg("Avan tööd…");
  try {
    const { data, error } = await c.from(DB_TABLE).select("id,nimi,muudetud,data").eq("id", id).single(); if (error) throw error;
    dbClose();
    openProject(JSON.stringify(data.data), data.nimi);
    S.dbId = data.id; S.dbName = data.nimi; S.dbSaved = data.muudetud; dbUI();
  } catch (e) { console.error(e); dbMsg(dbErr(e), true); }
}
async function dbDelete(id) {
  const c = dbClient(); if (!c) return;
  try { const { error } = await c.from(DB_TABLE).delete().eq("id", id); if (error) throw error; DB.list = DB.list.filter(r => r.id !== id); if (S.dbId === id) { S.dbId = null; S.dbSaved = null; } toast("Töö kustutatud andmebaasist."); }
  catch (e) { console.error(e); dbMsg(dbErr(e), true); }
  DB.armDel = null; dbUI(); dbRender();
}

/* ---------- tööde leht (päise nupp „Tööd“; „Valgustähed“ viib programmi tagasi) ---------- */
function dbMsg(t, bad) { const m = $("dbMsg"); if (!m) return; m.textContent = t || ""; m.classList.toggle("bad", !!bad); m.hidden = !t; }
function dbOpen() { if (!dbReady()) return; $("dbModal").hidden = false; DB.armDel = null; dbRender(); dbLoad(); setTimeout(() => $("dbSearch").focus(), 30); }
function dbClose() { $("dbModal").hidden = true; dbMsg(""); }
/* which page is shown: highlight its header button */
function navSync() { const works = !$("dbModal").hidden; $("navApp").classList.toggle("on", !works); $("btnDb").classList.toggle("on", works); if (works) { $("btnDb").setAttribute("aria-current", "page"); $("navApp").removeAttribute("aria-current"); } else { $("navApp").setAttribute("aria-current", "page"); $("btnDb").removeAttribute("aria-current"); } }
const dbWho = (nm, em) => esc(nm || (em || "").split("@")[0] || "");
function dbRender() {
  $("btnDbSaveNew").disabled = !S.letters.length || !dbReady();
  const q = ($("dbSearch").value || "").trim().toLowerCase();
  const rows = DB.list.filter(r => !q || [r.nimi, r.tellimus, r.loonud_nimi, r.muutnud_nimi, r.loonud, r.muutnud].some(v => String(v || "").toLowerCase().includes(q)));
  const tw = n => n === 1 ? "1 töö" : n + " tööd";
  $("dbCount").textContent = DB.list.length ? (q ? `${rows.length} / ${tw(DB.list.length)}` : tw(DB.list.length)) : "";
  const tb = $("dbRows");
  if (!rows.length) { tb.innerHTML = `<tr><td colspan="6" class="empty">${DB.list.length ? "Otsingule vastavaid töid pole." : "Andmebaasis pole veel ühtegi tööd. Salvesta praegune töö nupuga „Salvesta andmebaasi“."}</td></tr>`; return; }
  tb.innerHTML = rows.map(r => `<tr data-id="${esc(r.id)}" class="${r.id === S.dbId ? "cur" : ""}">
    <td class="nm"><b>${esc(r.nimi || "Nimetu töö")}</b>${r.kuju_arv ? `<small>${r.kuju_arv} kuju</small>` : ""}</td>
    <td>${esc(r.tellimus || "")}</td>
    <td class="tm">${dbWho(r.loonud_nimi, r.loonud)}<small>${esc(dbFmtTime(r.loodud))}</small></td>
    <td class="tm">${esc(dbFmtTime(r.muudetud))}<small>${dbWho(r.muutnud_nimi, r.muutnud)}</small></td>
    <td class="act"><button class="btn sm" data-open="${esc(r.id)}">Ava</button></td>
    <td class="act">${typeof oigus === "function" && !oigus("t_tood_kustuta") ? "" : `<button class="btn ghost sm del${DB.armDel === r.id ? " arm" : ""}" data-del="${esc(r.id)}" title="Kustuta andmebaasist">${DB.armDel === r.id ? "Kinnita" : "Kustuta"}</button>`}</td></tr>`).join("");
}

/* ---------- käivitus ---------- */
$("btnDb").addEventListener("click", dbOpen);
$("btnDbOpen").addEventListener("click", dbOpen);
$("btnDbSave").addEventListener("click", () => dbSave(false));
$("btnDbSaveNew").addEventListener("click", () => dbSave(true));
$("navApp").addEventListener("click", dbClose);
document.querySelector(".brand").addEventListener("click", e => { if (e.target.classList.contains("logo")) dbClose(); });
new MutationObserver(navSync).observe($("dbModal"), { attributes: true, attributeFilter: ["hidden"] });
$("dbSearch").addEventListener("input", () => { DB.armDel = null; dbRender(); });
$("dbRows").addEventListener("click", e => {
  const o = e.target.closest("[data-open]"), d = e.target.closest("[data-del]");
  if (o) dbOpenWork(o.dataset.open);
  else if (d) { if (DB.armDel === d.dataset.del) dbDelete(d.dataset.del); else { DB.armDel = d.dataset.del; dbRender(); } }
});
$("dbRows").addEventListener("dblclick", e => { const tr = e.target.closest("tr[data-id]"); if (tr && !e.target.closest("button")) dbOpenWork(tr.dataset.id); });
