/* Valgustähed — tellimus.js
   Tellimuse info ja osad (esipind, külg, tagapind, valgustus), RAL-värvid.
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */
/* ===================== ORDER INFO ===================== */
const RAL = { 1000: ["Green beige", "#BEBD7F"], 1001: ["Beige", "#C2B078"], 1002: ["Sand yellow", "#C6A664"], 1003: ["Signal yellow", "#E5BE01"], 1004: ["Golden yellow", "#CDA434"], 1005: ["Honey yellow", "#A98307"], 1006: ["Maize yellow", "#E4A010"], 1007: ["Daffodil yellow", "#DC9D00"], 1011: ["Brown beige", "#8A6642"], 1012: ["Lemon yellow", "#C7B446"], 1013: ["Oyster white", "#EAE6CA"], 1014: ["Ivory", "#E1CC4F"], 1015: ["Light ivory", "#E6D690"], 1016: ["Sulfur yellow", "#EDFF21"], 1017: ["Saffron yellow", "#F5D033"], 1018: ["Zinc yellow", "#F8F32B"], 1019: ["Grey beige", "#9E9764"], 1020: ["Olive yellow", "#999950"], 1021: ["Rape yellow", "#F3DA0B"], 1023: ["Traffic yellow", "#FAD201"], 1024: ["Ochre yellow", "#AEA04B"], 1026: ["Luminous yellow", "#FFFF00"], 1027: ["Curry", "#9D9101"], 1028: ["Melon yellow", "#F4A900"], 1032: ["Broom yellow", "#D6AE01"], 1033: ["Dahlia yellow", "#F3A505"], 1034: ["Pastel yellow", "#EFA94A"], 1035: ["Pearl beige", "#6A5D4D"], 1036: ["Pearl gold", "#705335"], 1037: ["Sun yellow", "#F39F18"], 2000: ["Yellow orange", "#ED760E"], 2001: ["Red orange", "#C93C20"], 2002: ["Vermilion", "#CB2821"], 2003: ["Pastel orange", "#FF7514"], 2004: ["Pure orange", "#F44611"], 2005: ["Luminous orange", "#FF2301"], 2007: ["Luminous bright orange", "#FFA420"], 2008: ["Bright red orange", "#F75E25"], 2009: ["Traffic orange", "#F54021"], 2010: ["Signal orange", "#D84B20"], 2011: ["Deep orange", "#EC7C26"], 2012: ["Salmon orange", "#E55137"], 2013: ["Pearl orange", "#C35831"], 3000: ["Flame red", "#AF2B1E"], 3001: ["Signal red", "#A52019"], 3002: ["Carmine red", "#A2231D"], 3003: ["Ruby red", "#9B111E"], 3004: ["Purple red", "#75151E"], 3005: ["Wine red", "#5E2129"], 3007: ["Black red", "#412227"], 3009: ["Oxide red", "#642424"], 3011: ["Brown red", "#781F19"], 3012: ["Beige red", "#C1876B"], 3013: ["Tomato red", "#A12312"], 3014: ["Antique pink", "#D36E70"], 3015: ["Light pink", "#EA899A"], 3016: ["Coral red", "#B32821"], 3017: ["Rose", "#E63244"], 3018: ["Strawberry red", "#D53032"], 3020: ["Traffic red", "#CC0605"], 3022: ["Salmon pink", "#D95030"], 3024: ["Luminous red", "#F80000"], 3026: ["Luminous bright red", "#FE0000"], 3027: ["Raspberry red", "#C51D34"], 3028: ["Pure red", "#CB3234"], 3031: ["Orient red", "#B32428"], 3032: ["Pearl ruby red", "#721422"], 3033: ["Pearl pink", "#B44C43"], 4001: ["Red lilac", "#6D3F5B"], 4002: ["Red violet", "#922B3E"], 4003: ["Heather violet", "#DE4C8A"], 4004: ["Claret violet", "#641C34"], 4005: ["Blue lilac", "#6C4675"], 4006: ["Traffic purple", "#A03472"], 4007: ["Purple violet", "#4A192C"], 4008: ["Signal violet", "#924E7D"], 4009: ["Pastel violet", "#A18594"], 4010: ["Telemagenta", "#CF3476"], 4011: ["Pearl violet", "#8673A1"], 4012: ["Pearl blackberry", "#6C6874"], 5000: ["Violet blue", "#354D73"], 5001: ["Green blue", "#1F3438"], 5002: ["Ultramarine blue", "#20214F"], 5003: ["Sapphire blue", "#1D1E33"], 5004: ["Black blue", "#18171C"], 5005: ["Signal blue", "#1E2460"], 5007: ["Brilliant blue", "#3E5F8A"], 5008: ["Grey blue", "#26252D"], 5009: ["Azure blue", "#025669"], 5010: ["Gentian blue", "#0E294B"], 5011: ["Steel blue", "#231A24"], 5012: ["Light blue", "#3B83BD"], 5013: ["Cobalt blue", "#1E213D"], 5014: ["Pigeon blue", "#606E8C"], 5015: ["Sky blue", "#2271B3"], 5017: ["Traffic blue", "#063971"], 5018: ["Turquoise blue", "#3F888F"], 5019: ["Capri blue", "#1B5583"], 5020: ["Ocean blue", "#1D334A"], 5021: ["Water blue", "#256D7B"], 5022: ["Night blue", "#252850"], 5023: ["Distant blue", "#49678D"], 5024: ["Pastel blue", "#5D9B9B"], 5025: ["Pearl gentian blue", "#2A6478"], 5026: ["Pearl night blue", "#102C54"], 6000: ["Patina green", "#316650"], 6001: ["Emerald green", "#287233"], 6002: ["Leaf green", "#2D572C"], 6003: ["Olive green", "#424632"], 6004: ["Blue green", "#1F3A3D"], 6005: ["Moss green", "#2F4538"], 6006: ["Grey olive", "#3E3B32"], 6007: ["Bottle green", "#343B29"], 6008: ["Brown green", "#39352A"], 6009: ["Fir green", "#31372B"], 6010: ["Grass green", "#35682D"], 6011: ["Reseda green", "#587246"], 6012: ["Black green", "#343E40"], 6013: ["Reed green", "#6C7156"], 6014: ["Yellow olive", "#47402E"], 6015: ["Black olive", "#3B3C36"], 6016: ["Turquoise green", "#1E5945"], 6017: ["May green", "#4C9141"], 6018: ["Yellow green", "#57A639"], 6019: ["Pastel green", "#BDECB6"], 6020: ["Chrome green", "#2E3A23"], 6021: ["Pale green", "#89AC76"], 6022: ["Olive drab", "#25221B"], 6024: ["Traffic green", "#308446"], 6025: ["Fern green", "#3D642D"], 6026: ["Opal green", "#015D52"], 6027: ["Light green", "#84C3BE"], 6028: ["Pine green", "#2C5545"], 6029: ["Mint green", "#20603D"], 6032: ["Signal green", "#317F43"], 6033: ["Mint turquoise", "#497E76"], 6034: ["Pastel turquoise", "#7FB5B5"], 6035: ["Pearl green", "#1C542D"], 6036: ["Pearl opal green", "#193737"], 6037: ["Pure green", "#008F39"], 6038: ["Luminous green", "#00BB2D"], 7000: ["Squirrel grey", "#78858B"], 7001: ["Silver grey", "#8A9597"], 7002: ["Olive grey", "#7E7B52"], 7003: ["Moss grey", "#6C7059"], 7004: ["Signal grey", "#969992"], 7005: ["Mouse grey", "#646B63"], 7006: ["Beige grey", "#6D6552"], 7008: ["Khaki grey", "#6A5F31"], 7009: ["Green grey", "#4D5645"], 7010: ["Tarpaulin grey", "#4C514A"], 7011: ["Iron grey", "#434B4D"], 7012: ["Basalt grey", "#4E5754"], 7013: ["Brown grey", "#464531"], 7015: ["Slate grey", "#434750"], 7016: ["Anthracite grey", "#293133"], 7021: ["Black grey", "#23282B"], 7022: ["Umbra grey", "#332F2C"], 7023: ["Concrete grey", "#686C5E"], 7024: ["Graphite grey", "#474A51"], 7026: ["Granite grey", "#2F353B"], 7030: ["Stone grey", "#8B8C7A"], 7031: ["Blue grey", "#474B4E"], 7032: ["Pebble grey", "#B8B799"], 7033: ["Cement grey", "#7D8471"], 7034: ["Yellow grey", "#8F8B66"], 7035: ["Light grey", "#D7D7D7"], 7036: ["Platinum grey", "#7F7679"], 7037: ["Dusty grey", "#7D7F7D"], 7038: ["Agate grey", "#B5B8B1"], 7039: ["Quartz grey", "#6C6960"], 7040: ["Window grey", "#9DA1AA"], 7042: ["Traffic grey A", "#8D948D"], 7043: ["Traffic grey B", "#4E5452"], 7044: ["Silk grey", "#CAC4B0"], 7045: ["Telegrey 1", "#909090"], 7046: ["Telegrey 2", "#82898F"], 7047: ["Telegrey 4", "#D0D0D0"], 7048: ["Pearl mouse grey", "#898176"], 8000: ["Green brown", "#826C34"], 8001: ["Ochre brown", "#955F20"], 8002: ["Signal brown", "#6C3B2A"], 8003: ["Clay brown", "#734222"], 8004: ["Copper brown", "#8E402A"], 8007: ["Fawn brown", "#59351F"], 8008: ["Olive brown", "#6F4F28"], 8011: ["Nut brown", "#5B3A29"], 8012: ["Red brown", "#592321"], 8014: ["Sepia brown", "#382C1E"], 8015: ["Chestnut brown", "#633A34"], 8016: ["Mahogany brown", "#4C2F27"], 8017: ["Chocolate brown", "#45322E"], 8019: ["Grey brown", "#403A3A"], 8022: ["Black brown", "#212121"], 8023: ["Orange brown", "#A65E2E"], 8024: ["Beige brown", "#79553D"], 8025: ["Pale brown", "#755C48"], 8028: ["Terra brown", "#4E3B31"], 8029: ["Pearl copper", "#763C28"], 9001: ["Cream", "#FDF4E3"], 9002: ["Grey white", "#E7EBDA"], 9003: ["Signal white", "#F4F4F4"], 9004: ["Signal black", "#282828"], 9005: ["Jet black", "#0A0A0A"], 9006: ["White aluminium", "#A5A5A5"], 9007: ["Grey aluminium", "#8F8F8F"], 9010: ["Pure white", "#FFFFFF"], 9011: ["Graphite black", "#1C1C1C"], 9016: ["Traffic white", "#F6F6F6"], 9017: ["Traffic black", "#1E1E1E"], 9018: ["Papyrus white", "#D7D7D7"], 9022: ["Pearl light grey", "#9C9C9C"], 9023: ["Pearl dark grey", "#828282"] };
const WORDS = { must: 9005, black: 9005, valge: 9016, white: 9016, "hõbe": 9006, silver: 9006, alumiinium: 9006, "tumehall": 7016, antratsiit: 7016, hall: 7035, grey: 7035, gray: 7035, punane: 3020, red: 3020, sinine: 5010, blue: 5010, kollane: 1023, yellow: 1023, roheline: 6018, green: 6018, oranž: 2004, orange: 2004, pruun: 8017, brown: 8017, lilla: 4005 };
const today = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`; };
const emptyOrder = () => ({ title: "", orderNo: "", date: today(), due: "", qty: "", location: "", drafter: "", power: "", lumen: "", frameMat: "", frameColor: "", hooks: "" });
const GROUP_KEYS = ["profType", "faceMat", "faceFilm", "faceColor", "sideMat", "sideColor", "screws", "backMat", "backColor", "backVisible", "modules", "lightTemp", "dimmable", "psu", "trafo"];
const emptyGroup = name => Object.assign({ name: name || "Tekst" }, Object.fromEntries(GROUP_KEYS.map(k => [k, ""])));

const grpOf = i => { const L = S.letters[i]; const g = L && L.group != null ? L.group : 0; return S.groups[g] || S.groups[0]; };
/* groups actually used by letters, in order */
const usedGroups = () => { const u = new Set(S.letters.map(L => L.group || 0)); return S.groups.filter((g, i) => u.has(i) || !S.letters.length); };

/* "RAL 9005", "9005", "#1a2b3c" or a plain colour word -> 0xRRGGBB, otherwise null */
function colorOf(str) {
  const t = String(str || "").trim().toLowerCase(); if (!t) return null;
  const hex = t.match(/#([0-9a-f]{6})\b/); if (hex) return parseInt(hex[1], 16);
  const ral = t.match(/(?:ral\s*)?(\d{4})\b/); if (ral && RAL[ral[1]]) return parseInt(RAL[ral[1]][1].slice(1), 16);
  for (const [w, code] of Object.entries(WORDS)) if (t.includes(w)) return parseInt(RAL[code][1].slice(1), 16);
  return null;
}
const ORDER_FIELDS = [["o_title", "title"], ["o_orderNo", "orderNo"], ["o_date", "date"], ["o_due", "due"], ["o_qty", "qty"], ["o_location", "location"], ["o_drafter", "drafter"], ["o_power", "power"], ["o_lumen", "lumen"], ["o_frameMat", "frameMat"], ["o_frameColor", "frameColor"], ["o_hooks", "hooks"]];
function ralName(str) { const m = String(str || "").match(/(\d{4})/); return m && RAL[m[1]] ? `RAL ${m[1]} ${RAL[m[1]][0]}` : ""; }
function paintChips() {
  for (const k of ["faceColor", "sideColor", "frameColor"]) {
    const v = k === "frameColor" ? S.order[k] : (S.groups[S.gCur] || {})[k], c = colorOf(v), el = $("c_" + k), unknown = !!String(v || "").trim() && c == null;
    el.style.background = c == null ? "transparent" : "#" + c.toString(16).padStart(6, "0");
    el.textContent = unknown ? "?" : ""; el.style.color = "var(--warn)"; el.style.fontSize = "11px"; el.style.lineHeight = "14px"; el.style.textAlign = "center"; el.style.fontStyle = "normal";
    el.title = unknown ? "Värvi ei tuntud ära, 3D-vaates on vaikevärv. Kirjuta RAL-kood (nt RAL 9005) või #RRGGBB." : (ralName(v) || "");
  }
}
/* drafter: an empty field takes the signed-in user's name; the name is stored in the work, so a work opened later keeps who drew it */
function autoDrafter() { const nm = typeof DB !== "undefined" && DB.me && DB.me.aktiivne ? String(DB.me.nimi || "").trim() : ""; if (!nm || String(S.order.drafter || "").trim()) return; S.order.drafter = nm; if ($("o_drafter") && document.activeElement !== $("o_drafter")) $("o_drafter").value = nm; }
function fillOrder() { autoDrafter(); for (const [id, k] of ORDER_FIELDS) $(id).value = S.order[k] || ""; fillGroups(); }
function fillGroups() {
  if (S.gCur >= S.groups.length) S.gCur = 0;
  $("g_sel").innerHTML = S.groups.map((g, i) => `<option value="${i}">${esc(g.name || "Osa " + (i + 1))}</option>`).join(""); $("g_sel").value = S.gCur;
  const g = S.groups[S.gCur]; $("g_name").value = g.name || ""; for (const k of GROUP_KEYS) $("g_" + k).value = g[k] || "";
  $("g_del").disabled = S.groups.length < 2;
  document.querySelectorAll(".pname").forEach(e => { e.textContent = S.groups.length > 1 ? "· " + (S.groups[S.gCur].name || "") : ""; });
  const idx = S.letters.map((L, i) => (L.group || 0) === S.gCur ? i + 1 : null).filter(Boolean);
  $("g_info").textContent = S.letters.length ? (idx.length ? `Selles osas ${idx.length} kuju: ${idx.length > 20 ? idx.slice(0, 20).join(", ") + " …" : idx.join(", ")}` : "Selles osas pole veel ühtegi kuju.") : "";
  paintChips(); fillScrewQty(); fillBackMat();
}
/* letter depth of a part: "0,7x60" -> thickness 0,7 and depth 60; missing parts fall back to the profile preset / 3D depth */
function sideSpec(g) {
  const m = String((g && g.sideMat) || "").match(/(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)/i), one = String((g && g.sideMat) || "").match(/^\s*(\d+(?:[.,]\d+)?)\s*(mm)?\s*$/);
  const preTh = (($("s_preset").value || "").match(/^(\d+[,.]\d+)\s*mm$/) || [])[1];
  const th = m ? m[1].replace(".", ",") : (preTh ? preTh.replace(".", ",") : "");
  const depth = m ? parseFloat(m[2].replace(",", ".")) : one ? parseFloat(one[1].replace(",", ".")) : (+cfg.depth3d || 100);
  return { th, depth, text: (th ? th + "x" : "") + Core.fmtMM(depth) };
}
const depthOf = i => sideSpec(grpOf(i)).depth;
/* side screws: 4 per metre of contour (outer and inner loops of every letter in the part), rounded up; a typed value overrides */
const SCREWS_PER_M = 4;
function contourLen(gi) { let s = 0; S.letters.forEach(L => { if ((L.group || 0) === gi) for (const lp of L.loops) s += Core.perimOf(lp); }); return s; }
function screwAuto(gi) { const m = contourLen(gi) / 1000; return m > 0 ? Math.ceil(m * SCREWS_PER_M) : 0; }
function screwQty(g) { const gi = S.groups.indexOf(g); const own = String(g.screwQty || "").trim(); if (own) return own; const n = screwAuto(gi < 0 ? 0 : gi); return n ? n + " tk" : ""; }
/* back material from the profile and the side sheet: P3 -> 8mm XT WN770; P6 with 0,7 side -> 1mm AL, with 1,2 side -> 1,5mm AL */
function backAuto(g) {
  const t = (g && g.profType) || cfg.profType || "liist";
  if (t === "p3") return "8mm XT WN770";
  const th = parseFloat(String(sideSpec(g).th || "").replace(",", "."));
  if (Math.abs(th - 0.7) < 0.01) return "1mm AL";
  if (Math.abs(th - 1.2) < 0.01) return "1,5mm AL";
  return "";
}
function backMat(g) { return String((g && g.backMat) || "").trim() || backAuto(g); }
function fillBackMat() {
  const g = S.groups[S.gCur]; if (!g || !$("g_backMat")) return; const own = String(g.backMat || "").trim(), a = backAuto(g);
  if (document.activeElement !== $("g_backMat")) $("g_backMat").value = own || a;
  $("g_backAuto").hidden = !!own || !a;
}
function fillScrewQty() {
  const g = S.groups[S.gCur]; if (!g || !$("g_screwQty")) return; const own = String(g.screwQty || "").trim();
  if (document.activeElement !== $("g_screwQty")) $("g_screwQty").value = own || (screwAuto(S.gCur) ? screwAuto(S.gCur) + " tk" : "");
  $("g_screwAuto").hidden = !!own; $("g_screwAuto").textContent = "auto · " + (contourLen(S.gCur) / 1000).toFixed(2).replace(".", ",") + " m";
}
/* value of one group field over the groups in use: "X" or "Logo: X; Tekst: Y" */
function gval(k) { const G = usedGroups(); const vals = G.map(g => (g[k] || "").trim()); if (!vals.some(Boolean)) return ""; if (G.length < 2 || vals.every(v => v === vals[0])) return vals[0]; return G.map((g, i) => `${g.name}: ${vals[i] || "–"}`).join("; "); }
function orderLines() {
  const o = S.order, j = a => a.filter(Boolean).join(", "), L = [];
  const gen = j([o.orderNo && "Tellimus " + o.orderNo, o.qty && "Kogus " + o.qty, o.location]); if (gen) L.push(gen);
  for (const g of usedGroups()) {
    const pre = S.groups.length > 1 ? g.name + " – " : "";
    const face = j([g.faceMat, g.faceColor, g.faceFilm && "kile " + g.faceFilm]); if (face) L.push(pre + "Esipind: " + face);
    L.push(pre + `Külg: ${j(["sügavus " + sideSpec(g).text + " mm", g.sideColor, (g.screws || screwQty(g)) && ["kruvid", g.screws, screwQty(g)].filter(Boolean).join(" ")])}`);
    const back = j([backMat(g), g.backColor]); if (back) L.push(pre + "Tagapind: " + back);
  }
  { const fr = j([frameProfileName(), o.frameMat, o.frameColor]); if (fr) L.push("Raam: " + fr); }
  return L;
}
$("dl_ral").innerHTML = Object.entries(RAL).map(([k, v]) => `<option value="RAL ${k}">${v[0]}</option>`).join("");
$("o_drafter").addEventListener("blur", () => autoDrafter());
for (const [id, k] of ORDER_FIELDS) $(id).addEventListener("input", e => { S.order[k] = e.target.value; paintChips(); if (/Color$/.test(k)) schedule3D(); });
/* Tellimuse info subsections (Esipind, Külg, …): folded by default, the choice is remembered */
document.querySelectorAll(".subsec").forEach(sec => { const k = "valg_sub_" + sec.dataset.sub; try { if (localStorage.getItem(k) === "1") sec.classList.remove("closed"); } catch (e) {}
  sec.querySelector(".subh.tog").addEventListener("click", () => { const open = sec.classList.toggle("closed") === false; try { localStorage.setItem(k, open ? "1" : ""); } catch (e) {} }); });
let profTmr = null;
for (const k of GROUP_KEYS) $("g_" + k).addEventListener(k === "profType" ? "change" : "input", e => { S.groups[S.gCur][k] = e.target.value; paintChips(); if (/Color$/.test(k)) { schedule3D(); draw(); }
  /* type or side thickness of a part decides its contour offsets */
  if (k === "profType" || k === "sideMat") { syncProfType(); clearTimeout(profTmr); profTmr = setTimeout(() => { if (S.letters.length) { computeProfile(); recompute(); } }, 300); } });
$("g_name").addEventListener("input", e => { S.groups[S.gCur].name = e.target.value; document.querySelectorAll(".pname").forEach(x => { x.textContent = S.groups.length > 1 ? "· " + e.target.value : ""; }); const o = $("g_sel").options[S.gCur]; if (o) o.textContent = e.target.value || "Osa " + (S.gCur + 1); });
$("g_screwQty").addEventListener("input", e => { S.groups[S.gCur].screwQty = e.target.value.trim(); fillScrewQty(); });
$("g_screwQty").addEventListener("blur", () => fillScrewQty());
$("g_backMat").addEventListener("input", () => fillBackMat()); $("g_backMat").addEventListener("blur", () => fillBackMat());
for (const id of ["g_profType", "g_sideMat"]) $(id).addEventListener(id === "g_profType" ? "change" : "input", () => fillBackMat());
for (const id of ["s_profType", "s_preset"]) if ($(id)) $(id).addEventListener("change", () => setTimeout(fillBackMat, 0));
$("g_sel").addEventListener("change", e => { S.gCur = +e.target.value; fillGroups(); draw(); });
$("g_add").addEventListener("click", () => { S.groups.push(emptyGroup("Osa " + (S.groups.length + 1))); S.gCur = S.groups.length - 1; fillGroups(); $("g_name").focus(); $("g_name").select(); setPick(true); });
$("g_del").addEventListener("click", () => { if (S.groups.length < 2) return; const k = S.gCur; S.groups.splice(k, 1); for (const L of S.letters) { const g = L.group || 0; L.group = g === k ? 0 : g > k ? g - 1 : g; } S.gCur = 0; fillGroups(); if (S.letters.length) { computeProfile(); recompute(); } });
function setPick(on) { S.gPick = on; $("g_pick").classList.toggle("on", on); $("g_pick").textContent = on ? "Valmis (lõpeta määramine)" : "Määra tähti joonisel"; $("hint").textContent = on ? `Kliki tähtedel, et panna need ossa „${S.groups[S.gCur].name}“` : ""; draw(); }
$("g_pick").addEventListener("click", () => setPick(!S.gPick));
const GROUP_TINT = ["#2f7de1", "#e1572f", "#2fa36b", "#b02fe1", "#e1b42f", "#2fc4e1", "#e12f8c", "#7a8a2f"];
