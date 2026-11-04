/* Valgustähed — kasutajad.js
   Sisselogimine (rakendusse pääseb ainult sisseloginud ja aktiivne kasutaja), kasutajamenüü, parooli muutmine ja taastamine,
   admini paneel kasutajate loomiseks ja õiguste muutmiseks (serverifunktsioon "kasutajad").
   Andmete tegelik kaitse on andmebaasi reeglites (supabase.sql); see leht ainult ei näita rakendust ilma sisselogimiseta.
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */
const AU = { recovery: false, users: [], editId: null, armDel: null };
const ROLLI_NIMI = { admin: "Admin", kasutaja: "Kasutaja" };

/* ---------- värav ---------- */
function gateShow(view, msg, bad) {
  const g = $("authGate"); g.hidden = false; document.body.classList.add("locked");
  for (const v of ["gSetup", "gLogin", "gForgot", "gNewPass", "gWait"]) $(v).hidden = v !== view;
  gateMsg(msg, bad);
  setTimeout(() => { const f = $(view) && $(view).querySelector("input"); if (f) f.focus(); }, 30);
}
function gateHide() { $("authGate").hidden = true; document.body.classList.remove("locked"); gateMsg(""); }
function gateMsg(t, bad) { const m = $("gMsg"); m.textContent = t || ""; m.hidden = !t; m.classList.toggle("bad", !!bad); }

/* kasutaja rida tabelist "kasutajad"; mitteaktiivne või puuduv kasutaja logitakse välja */
async function auLoadMe() {
  const c = dbClient(); if (!c || !DB.user) { DB.me = null; return false; }
  const { data, error } = await c.from("kasutajad").select("id,email,nimi,roll,aktiivne").eq("id", DB.user.id).maybeSingle();
  if (error) throw error;
  DB.me = data || null;
  return !!(DB.me && DB.me.aktiivne);
}
async function auRefresh() {
  const c = dbClient();
  if (!c) { DB.user = null; DB.me = null; auUI(); gateShow("gSetup"); return; }
  if (AU.recovery) { auUI(); gateShow("gNewPass", "Sisesta uus parool."); return; }
  if (!DB.user) { DB.me = null; auUI(); gateShow("gLogin"); return; }
  gateShow("gWait");
  try {
    const ok = await auLoadMe();
    if (!ok) { const m = DB.me ? "See konto on blokeeritud. Pöördu admini poole." : "Sellel kontol pole Valgustähtedes kasutajat. Pöördu admini poole."; await c.auth.signOut(); DB.user = null; DB.me = null; auUI(); gateShow("gLogin", m, true); return; }
    auUI(); gateHide();
  } catch (e) { console.error(e); auUI(); gateShow("gLogin", dbErr(e), true); }
}
async function auInit() {
  const c = dbClient();
  if (!c) { auRefresh(); return; }
  c.auth.onAuthStateChange((ev, session) => {
    if (ev === "PASSWORD_RECOVERY") AU.recovery = true;
    const was = DB.user && DB.user.id; DB.user = session ? session.user : null;
    if (ev === "PASSWORD_RECOVERY" || ev === "SIGNED_OUT" || (ev === "SIGNED_IN" && (DB.user && DB.user.id) !== was)) setTimeout(auRefresh, 0);
  });
  try { const { data } = await c.auth.getSession(); DB.user = data && data.session ? data.session.user : null; } catch (e) { DB.user = null; }
  if (/type=recovery/.test(location.hash)) AU.recovery = true;
  auRefresh();
}

/* ---------- päis ja menüü ---------- */
function auUI() {
  const me = DB.me;
  $("btnUser").hidden = !me; $("userName").textContent = me ? (me.nimi || me.email) : "";
  $("userRole").textContent = me ? ROLLI_NIMI[me.roll] || "" : "";
  $("miAdmin").hidden = !(me && me.roll === "admin");
  $("btnDb").hidden = !me;
  if (typeof dbUI === "function") dbUI();
}
function menuToggle(on) { const m = $("userMenu"); m.hidden = on === undefined ? !m.hidden : !on; $("btnUser").setAttribute("aria-expanded", String(!m.hidden)); }

/* ---------- sisselogimine, taastamine ---------- */
async function auLogin(email, pass) {
  const c = dbClient(); if (!c) return;
  gateMsg("Logib sisse…");
  try { const { data, error } = await c.auth.signInWithPassword({ email, password: pass }); if (error) throw error; DB.user = data.user; $("gPass").value = ""; await auRefresh(); }
  catch (e) { gateShow("gLogin", dbErr(e), true); }
}
async function auLogout() { menuToggle(false); const c = dbClient(); try { if (c) await c.auth.signOut(); } catch (e) {} DB.user = null; DB.me = null; DB.list = []; $("dbModal").hidden = true; $("pwModal").hidden = true; $("admModal").hidden = true; auUI(); gateShow("gLogin", "Oled välja logitud."); }
async function auForgot(email) {
  const c = dbClient(); if (!c) return;
  try { const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); if (error) throw error; gateShow("gLogin", "Kui see e-post on Valgustähtedes olemas, saadeti sinna link uue parooli seadmiseks."); }
  catch (e) { gateMsg(dbErr(e), true); }
}
const pwCheck = (a, b) => a.length < 8 ? "Parool peab olema vähemalt 8 märki." : a !== b ? "Paroolid ei ühti." : "";
async function auSetPassword(p1, p2, where) {
  const bad = pwCheck(p1, p2); const say = where === "gate" ? gateMsg : pwMsg;
  if (bad) { say(bad, true); return false; }
  const c = dbClient();
  try { const { error } = await c.auth.updateUser({ password: p1 }); if (error) throw error; return true; }
  catch (e) { say(dbErr(e), true); return false; }
}

/* ---------- parooli muutmine ---------- */
function pwMsg(t, bad) { const m = $("pwMsg"); m.textContent = t || ""; m.hidden = !t; m.classList.toggle("bad", !!bad); }
function pwOpen() { menuToggle(false); $("pwModal").hidden = false; $("pwNew").value = ""; $("pwNew2").value = ""; pwMsg(""); setTimeout(() => $("pwNew").focus(), 30); }

/* ---------- admini paneel ---------- */
function admMsg(t, bad) { const m = $("admMsg"); m.textContent = t || ""; m.hidden = !t; m.classList.toggle("bad", !!bad); }
async function admCall(body) {
  const c = dbClient();
  const { data, error } = await c.functions.invoke("kasutajad", { body });
  if (error) {
    let m = error.message || String(error);
    try { const j = error.context && typeof error.context.json === "function" ? await error.context.json() : null; if (j && (j.error || j.message)) m = j.error || j.message; } catch (e) {}
    if (/Invalid JWT/i.test(m)) m = "Invalid JWT: lülita Supabase'is funktsiooni \"kasutajad\" seadetes Verify JWT välja (juhend, samm 4).";
    if (/Failed to send|not found|404/i.test(m)) m = "Serverifunktsioon \"kasutajad\" puudub või ei vasta (vt LOEMIND.md, samm 4).";
    throw new Error(m);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}
async function admLoad() {
  const c = dbClient();
  const { data, error } = await c.from("kasutajad").select("id,email,nimi,roll,aktiivne,loodud").order("nimi");
  if (error) { admMsg(dbErr(error), true); return; }
  AU.users = data || []; admRender();
}
function admOpen() { if (!(DB.me && DB.me.roll === "admin")) return; menuToggle(false); $("admModal").hidden = false; AU.editId = null; AU.armDel = null; admMsg(""); $("admNewForm").reset(); admLoad(); }
function admRender() {
  const meId = DB.me && DB.me.id;
  $("admCount").textContent = AU.users.length === 1 ? "1 kasutaja" : AU.users.length + " kasutajat";
  $("admRows").innerHTML = AU.users.map(u => {
    const self = u.id === meId, ed = AU.editId === u.id;
    return `<tr data-id="${esc(u.id)}" class="${u.aktiivne ? "" : "off"}">
      <td class="nm">${ed ? `<input type="text" class="admNm" value="${esc(u.nimi)}" aria-label="Nimi">` : `<b>${esc(u.nimi || "—")}</b>`}<small>${esc(u.email)}${self ? " · sina" : ""}</small></td>
      <td><select class="admRoll" ${self ? "disabled title=\"Enda rolli ei saa muuta\"" : ""} aria-label="Roll"><option value="kasutaja"${u.roll === "kasutaja" ? " selected" : ""}>Kasutaja</option><option value="admin"${u.roll === "admin" ? " selected" : ""}>Admin</option></select></td>
      <td>${u.aktiivne ? `<span class="pill ok">Aktiivne</span>` : `<span class="pill bad">Blokeeritud</span>`}</td>
      <td class="act">${ed ? `<button class="btn sm" data-a="savename">Salvesta</button>` : `<button class="btn ghost sm" data-a="name">Muuda nime</button>`}</td>
      <td class="act"><button class="btn ghost sm" data-a="pw">Uus parool</button></td>
      <td class="act">${self ? "" : `<button class="btn ghost sm" data-a="toggle">${u.aktiivne ? "Blokeeri" : "Aktiveeri"}</button>`}</td>
      <td class="act">${self ? "" : `<button class="btn ghost sm del${AU.armDel === u.id ? " arm" : ""}" data-a="del">${AU.armDel === u.id ? "Kinnita" : "Kustuta"}</button>`}</td></tr>`;
  }).join("");
}
async function admDo(id, action, extra) {
  admMsg("Salvestan…");
  try { await admCall(Object.assign({ action, id }, extra || {})); admMsg(""); await admLoad(); if (id === (DB.me && DB.me.id)) { await auLoadMe(); auUI(); } return true; }
  catch (e) { admMsg(e.message || String(e), true); await admLoad(); return false; }
}
function genPass() { const a = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"; const r = crypto.getRandomValues(new Uint32Array(10)); return Array.from(r, x => a[x % a.length]).join(""); }

/* ---------- käivitus ---------- */
$("gSetupForm").addEventListener("submit", e => {
  e.preventDefault(); const url = $("gUrl").value.trim().replace(/\/+$/, ""), anonKey = $("gKey").value.trim();
  if (!/^https:\/\/[^\s/]+$/.test(url) || anonKey.length < 20) { gateMsg("Kontrolli aadressi (https://…supabase.co) ja võtit.", true); return; }
  try { localStorage.setItem("valg_db_cfg", JSON.stringify({ url, anonKey })); } catch (er) { gateMsg("Brauser ei luba seadeid salvestada.", true); return; }
  DB.client = null; auInit();
});
$("gLoginForm").addEventListener("submit", e => { e.preventDefault(); auLogin($("gEmail").value.trim(), $("gPass").value); });
$("gForgotLink").addEventListener("click", e => { e.preventDefault(); $("gFEmail").value = $("gEmail").value.trim(); gateShow("gForgot"); });
$("gForgotForm").addEventListener("submit", e => { e.preventDefault(); auForgot($("gFEmail").value.trim()); });
$("gBack").addEventListener("click", e => { e.preventDefault(); gateShow("gLogin"); });
$("gNewPassForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (await auSetPassword($("gNP1").value, $("gNP2").value, "gate")) { AU.recovery = false; history.replaceState(null, "", location.pathname + location.search); $("gNP1").value = $("gNP2").value = ""; toast("Uus parool on seatud."); auRefresh(); }
});
$("gCfgLink").addEventListener("click", e => { e.preventDefault(); const c = dbCfg() || {}; $("gUrl").value = c.url || ""; $("gKey").value = c.anonKey || ""; gateShow("gSetup"); });
$("btnUser").addEventListener("click", e => { e.stopPropagation(); menuToggle(); });
document.addEventListener("click", e => { if (!$("userMenu").hidden && !e.target.closest("#userMenu")) menuToggle(false); });
$("miPass").addEventListener("click", pwOpen);
$("miAdmin").addEventListener("click", admOpen);
$("miOut").addEventListener("click", auLogout);
$("pwForm").addEventListener("submit", async e => { e.preventDefault(); if (await auSetPassword($("pwNew").value, $("pwNew2").value, "modal")) { $("pwModal").hidden = true; toast("Parool on muudetud."); } });
$("btnPwClose").addEventListener("click", () => { $("pwModal").hidden = true; });
$("btnAdmClose").addEventListener("click", () => { $("admModal").hidden = true; });
for (const id of ["pwModal", "admModal"]) $(id).addEventListener("mousedown", e => { if (e.target === $(id)) $(id).hidden = true; });
document.addEventListener("keydown", e => { if (e.key !== "Escape") return; for (const id of ["dbModal", "pwModal", "admModal"]) if (!$(id).hidden) { $(id).hidden = true; return; } menuToggle(false); });
$("admGen").addEventListener("click", () => { $("admPass").value = genPass(); $("admPass").type = "text"; });
$("admNewForm").addEventListener("submit", async e => {
  e.preventDefault();
  const body = { action: "loo", nimi: $("admName").value.trim(), email: $("admEmail").value.trim(), parool: $("admPass").value, roll: $("admRole").value };
  if (!body.nimi) { admMsg("Sisesta nimi.", true); return; }
  if (body.parool.length < 8) { admMsg("Parool peab olema vähemalt 8 märki.", true); return; }
  admMsg("Loon kasutajat…");
  try { await admCall(body); admMsg(`Kasutaja loodud: ${body.nimi} (${body.email}). Anna talle parool; ta saab selle ise ära muuta.`); $("admNewForm").reset(); $("admPass").type = "password"; await admLoad(); }
  catch (er) { admMsg(er.message || String(er), true); }
});
$("admRows").addEventListener("change", e => { const s = e.target.closest(".admRoll"); if (!s) return; const id = s.closest("tr").dataset.id; admDo(id, "muuda", { roll: s.value }); });
$("admRows").addEventListener("click", async e => {
  const b = e.target.closest("[data-a]"); if (!b) return; const id = b.closest("tr").dataset.id, u = AU.users.find(x => x.id === id); if (!u) return;
  const a = b.dataset.a;
  if (a !== "del") AU.armDel = null;
  if (a === "name") { AU.editId = id; admRender(); const i = $("admRows").querySelector(".admNm"); if (i) { i.focus(); i.select(); } }
  else if (a === "savename") { const v = ($("admRows").querySelector(".admNm") || {}).value || ""; AU.editId = null; if (v.trim() && v.trim() !== u.nimi) await admDo(id, "muuda", { nimi: v.trim() }); else admRender(); }
  else if (a === "pw") { const p = genPass(); if (await admDo(id, "parool", { parool: p })) admMsg(`Uus parool kasutajale ${u.nimi}: ${p}  — anna see talle; ta saab selle ise ära muuta.`); }
  else if (a === "toggle") admDo(id, "muuda", { aktiivne: !u.aktiivne });
  else if (a === "del") { if (AU.armDel === id) { AU.armDel = null; admDo(id, "kustuta"); } else { AU.armDel = id; admRender(); } }
});
$("admRows").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.classList.contains("admNm")) { e.preventDefault(); const b = $("admRows").querySelector('[data-a="savename"]'); if (b) b.click(); } });
auInit();
