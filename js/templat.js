/* Valgustähed — templat.js
   Ettevõtte joonise templat (praegu peidetud).
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */
/* ===================== COMPANY DRAWING TEMPLATE =====================
   One template for everybody: the DXF is kept gzip+base64 in the artifact's asset store,
   its id and summary in the shared db document config/template. */
const TPL = { meta: null, text: null, db: null, assets: null, loading: null, ready: false, delArm: false };
const TPL_DOC = "config/template";
const TPL_ENABLED = false; /* template export switched off for now */
function tplActive() { return TPL_ENABLED && !!(TPL.meta && TPL.meta.assetId && cfg.useTpl !== false); }
const b64ToBytes = b64 => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const bytesToB64 = u => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
async function gzip(bytes, pack) { const st = new Blob([bytes]).stream().pipeThrough(pack ? new CompressionStream("gzip") : new DecompressionStream("gzip")); return new Uint8Array(await new Response(st).arrayBuffer()); }
async function tplFetch() {
  const res = await fetch("/_blob/" + TPL.meta.assetId); if (!res.ok) throw new Error("HTTP " + res.status);
  return new TextDecoder("utf-8").decode(await gzip(b64ToBytes((await res.text()).trim()), false));
}
/* make sure the template text is here; false (and the app's own A3 sheet) if it cannot be loaded */
async function tplEnsure(quiet) {
  if (TPL.text) return true; if (!TPL.meta) return false;
  if (!quiet) toast("Laadin templatit…");
  try { TPL.loading = TPL.loading || tplFetch(); TPL.text = await TPL.loading; return true; }
  catch (e) { TPL.loading = null; console.error(e); if (!quiet) toast("Templati laadimine ebaõnnestus (" + (e.message || e) + "). Kasutan rakenduse oma A3 raami."); return false; }
}
function tplFileName(suffix) { const t = ((S.order.title || "").trim() || baseName()).replace(/[\\/:*?"<>|]+/g, "_").trim(); return (t || "joonis") + suffix; }
/* order and part data -> template custom properties (names as in the template) */
function tplProps() {
  const o = S.order, G = usedGroups(), multi = G.length > 1, tt = t => ({ p3: "P3", liist: "P6", klaas: "P6" })[t || "liist"] || "";
  const gp = g => tt(g.profType || cfg.profType);
  const slots = [G.slice(0, 1), G.slice(1)]; /* the title block has two lines per row; parts 3+ share the second */
  const P = { "Joonestaja": o.drafter, "Tellimuse nr": o.orderNo, "Tähtaeg": o.due, "Kogus": o.qty, "Profiil": [...new Set(G.map(gp))].join(", "), "Paigalduskoht": o.location };
  slots.forEach((gs, i) => {
    const n = i + 1, v = f => gs.map(f).map(x => String(x || "").trim()).filter(Boolean).join(" / "), sfx = i ? " 2" : "";
    P["Nimetus" + sfx] = multi ? gs.map(g => g.name).join(" / ") : "";
    P["Esipind materjal" + sfx] = v(g => g.faceMat); P["Kile" + sfx] = v(g => g.faceFilm); P["Värv" + sfx] = v(g => g.faceColor);
    P[`Külg ${n}`] = v(g => sideSpec(g).text); P[`Külg profiil ${n}`] = v(gp); P[`Külg värv ${n}`] = v(g => g.sideColor); P[`Külg kruvid ${n}`] = v(g => g.screws);
    P[`Põhi ${n}`] = v(g => g.backMat); P[`Põhi värv ${n}`] = v(g => g.backColor); P[`Põhi nähtav ${n}`] = v(g => g.backVisible);
    P[`LED moodulid ${n}`] = v(g => g.modules); P[`LED valgus temp ${n}`] = v(g => g.lightTemp); P[`LED dimmerdatav ${n}`] = v(g => g.dimmable); P[`LED toiteplokk ${n}`] = v(g => g.psu); P[`LED trafo karp ${n}`] = v(g => g.trafo);
  });
  P["Raam materjal 1"] = [frameProfileName(), o.frameMat].filter(Boolean).join(" "); P["Raam värv 1"] = o.frameColor; P["Raam konksud 1"] = o.hooks;
  return P;
}
async function saveTpl(name, appTxt, origin) {
  let r; try { r = Tpl.merge(TPL.text, appTxt, { props: tplProps(), date: S.order.date, shift: [-origin[0], -origin[1]] }); }
  catch (e) { console.error(e); toast("Templatiga ühendamine ebaõnnestus: " + (e.message || e)); return; }
  await saveFile(name + ".dxf", new TextEncoder().encode(r.text));
  if ($("s_fileFmt").value === "dwg") setTimeout(() => toast("Templatiga joonis on DXF (AutoCAD 2018). AutoCAD-is salvesta DWG-na."), 3400);
}
function tplUI() {
  const m = TPL.meta, st = $("tplStat");
  const fmtD = iso => { const d = new Date(iso); return isNaN(d) ? "" : `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`; };
  if (!TPL.ready) st.textContent = "Laadin…";
  else if (!TPL.db) st.textContent = "Templati salvestus pole selles vaates saadaval. Tootmis- ja raamijoonisel on rakenduse oma A3 raam.";
  else if (!m) st.textContent = "Templat pole üles laaditud. Tootmis- ja raamijoonisel on rakenduse oma A3 raam." + (TPL.assets ? "" : " Templati saab üles laadida artifakti omanik või toimetaja.");
  else st.innerHTML = `<b>${esc(m.name || "templat")}</b> · ${((m.size || 0) / 1048576).toFixed(1).replace(".", ",")} MB · üles laaditud ${fmtD(m.uploaded)}<br>${(m.props || []).length} DWGPROPS-välja · lehed: ${esc((m.layouts || []).join(", "))}`;
  $("s_useTpl").checked = cfg.useTpl !== false; $("s_useTpl").disabled = !m;
  $("btnTplUp").hidden = !TPL.assets || !TPL.db; $("btnTplUp").textContent = m ? "Asenda templat (DXF)" : "Laadi templat üles (DXF)";
  $("btnTplDel").hidden = !TPL.assets || !m; TPL.delArm = false; $("btnTplDel").textContent = "Eemalda templat";
  $("tplMap").hidden = !m; $("tplNote").hidden = !m; if (m && $("tplMap").open) tplMapFill();
  if (window.__fmtLabels) window.__fmtLabels();
}
function tplMapFill() {
  const P = tplProps(), names = (TPL.meta && TPL.meta.props) || [];
  const fixed = { "Kuupäev (CreateDate)": S.order.date || "", "Töö nimi (failinimi)": tplFileName("") };
  $("tplMapT").innerHTML = Object.entries(fixed).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("") + names.map(n => {
    const has = Object.prototype.hasOwnProperty.call(P, n), v = has ? String(P[n] || "") : "";
    return `<tr><td>${esc(n)}</td><td class="${has ? "" : "none"}">${has ? esc(v || "–") : "rakenduses pole"}</td></tr>`; }).join("");
}
$("tplMap").addEventListener("toggle", () => { if ($("tplMap").open) tplMapFill(); });
$("s_useTpl").addEventListener("change", e => { cfg.useTpl = e.target.checked; saveCfg(); if (window.__fmtLabels) window.__fmtLabels(); });
$("btnTplUp").addEventListener("click", () => $("tplIn").click());
$("tplIn").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  if (!TPL.assets || !TPL.db) { toast("Templati ei saa siin üles laadida."); return; }
  if (!/\.dxf$/i.test(f.name)) { toast(/\.dwg$/i.test(f.name) ? "DWG-d ei saa lugeda. Salvesta templat AutoCAD-is: Save As → AutoCAD 2018 DXF." : "Vali DXF-fail."); return; }
  const buf = new Uint8Array(await f.arrayBuffer()); let text, inf;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch (err) { toast("Templat peab olema AutoCAD 2018 DXF (UTF-8)."); return; }
  try { inf = Tpl.info(text); } catch (err) { toast(err.message || String(err)); return; }
  $("tplStat").textContent = "Laadin üles…"; $("btnTplUp").disabled = true;
  try {
    const up = await TPL.assets.upload(new Blob([bytesToB64(await gzip(buf, true))], { type: "text/plain" }), { type: "text/plain" });
    const old = TPL.meta && TPL.meta.assetId;
    const meta = { assetId: up.id, name: f.name, size: buf.length, uploaded: new Date().toISOString(), ver: inf.ver, props: inf.props, layouts: inf.layouts };
    await TPL.db.doc(TPL_DOC).set(meta);
    TPL.meta = meta; TPL.text = text; TPL.loading = null;
    if (old && old !== up.id) { try { await TPL.assets.delete(old); } catch (err) { console.warn(err); } }
    toast(`Templat salvestatud: ${f.name} (${inf.props.length} välja)`);
  } catch (err) { console.error(err); toast("Üleslaadimine ebaõnnestus: " + (err && (err.code || err.message) || err)); }
  $("btnTplUp").disabled = false; tplUI();
});
$("btnTplDel").addEventListener("click", async () => {
  if (!TPL.delArm) { TPL.delArm = true; $("btnTplDel").textContent = "Kinnita eemaldamine"; setTimeout(() => { if (TPL.delArm) { TPL.delArm = false; $("btnTplDel").textContent = "Eemalda templat"; } }, 4000); return; }
  const old = TPL.meta && TPL.meta.assetId;
  try { await TPL.db.doc(TPL_DOC).delete(); TPL.meta = null; TPL.text = null; TPL.loading = null; if (old) { try { await TPL.assets.delete(old); } catch (err) { console.warn(err); } } toast("Templat eemaldatud."); }
  catch (err) { toast("Eemaldamine ebaõnnestus: " + (err && (err.code || err.message) || err)); }
  tplUI();
});

(async () => {
  const use = n => { try { return window.claude && window.claude.use ? window.claude.use(n) : Promise.resolve(null); } catch (e) { return Promise.resolve(null); } };
  const [db, assets] = await Promise.all([use("db").catch(() => null), use("assets").catch(() => null)]);
  TPL.db = db; TPL.assets = assets;
  if (db) { try { const snap = await db.doc(TPL_DOC).get(); TPL.meta = snap.exists ? snap.data() : null; } catch (e) { console.warn(e); } }
  TPL.ready = true; tplUI();
  if (TPL.meta) setTimeout(() => tplEnsure(true), 1500); /* fetch in the background so the first export is quick */
})();
