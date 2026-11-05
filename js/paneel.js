/* Valgustähed — paneel.js
   Parempoolne paneel: sisendväljad, koondinfo, kontroll ja raport.
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */

/* ---------- panel ---------- */
function fillTypeSelects() {
  const opts = cfg.types.map((t, i) => `<option value="${i}">${t.name} — ${t.pitch} mm · Ø${t.soor}</option>`).join("");
  $("s_type").innerHTML = opts; $("s_type").value = cfg.type; $("s_pitch").value = cfg.types[cfg.type].pitch;
  $("l_type").innerHTML = `<option value="">vaikimisi</option>` + opts;
  $("typeRows").innerHTML = cfg.types.map((t, i) => `<tr><td>${t.name}</td><td><input type="number" id="t${i}_pitch" value="${t.pitch}" min="20" step="5" aria-label="${t.name} samm"></td><td><input type="number" id="t${i}_soor" value="${t.soor}" min="10" step="5" aria-label="${t.name} söör"></td><td><input type="number" id="t${i}_dash" value="${t.dash}" min="1" step="1" aria-label="${t.name} kriips"></td></tr>`).join("");
  cfg.types.forEach((t, i) => ["pitch", "soor", "dash"].forEach(k => $(`t${i}_${k}`).addEventListener("change", e => { const v = parseFloat(e.target.value); if (!(v > 0)) return; t[k] = v; if (k === "pitch" && i === cfg.type) $("s_pitch").value = v; const keep = $("s_type").value; fillTypeSelects(); $("s_type").value = keep; onCfgChange(k === "pitch" ? "samples" : "place"); })));
}
function bindInputs() {
  const num = [["s_edge", "edge"], ["s_holeD", "holeD"], ["s_notchDepth", "notchDepth", "rep"], ["s_mountD", "mountD", "rep"], ["s_cableD", "cableD", "rep"], ["s_mountEnd", "mountEnd", "rep"], ["s_mountTwo", "mountTwo", "rep"], ["s_profile", "profile", "frame"], ["s_barGap", "barGap"], ["s_barEnd", "barEnd"], ["s_postGap", "postGap"], ["s_corner", "corner"], ["s_multi", "multi"], ["s_rowGap", "rowGap"], ["s_panel", "panel"], ["s_gap", "gap"], ["s_overMax", "overMax", "rep"], ["s_covMin", "covMin", "rep"], ["s_tol", "tol", "source"], ["s_chord", "chordTol", "source"]];
  for (const [id, k, kind] of num) { $(id).value = cfg[k]; $(id).addEventListener("change", e => { const v = parseFloat(String(e.target.value).replace(",", ".")); if (isNaN(v)) { e.target.value = cfg[k]; return; } cfg[k] = v; if (kind === "frame") { setFrameSize(v); return; } if (kind === "rep") { saveCfg(); recompute(); } else onCfgChange(kind || "place"); }); }
  for (const [id, k] of [["s_offBase", "offBase"], ["s_offSide", "offSide"], ["s_offGroove", "offGroove"], ["s_rIn", "rIn"], ["s_rOut", "rOut"]]) { $(id).value = cfg[k]; $(id).addEventListener("change", e => { const v = parseFloat(String(e.target.value).replace(",", ".")); if (isNaN(v)) { e.target.value = cfg[k]; return; } cfg[k] = v; saveCfg(); computeProfile(); draw(); syncPreset(); }); }
  $("s_hex").checked = cfg.hex; $("s_hex").addEventListener("change", e => { cfg.hex = e.target.checked; onCfgChange("place"); });
  $("s_density").value = cfg.density; $("s_density").addEventListener("change", e => { cfg.density = e.target.value; onCfgChange("place"); });
  $("s_barExt").checked = !!cfg.barExt; $("s_barSegMax").value = cfg.barSegMax; syncBarExt();
  $("s_barExt").addEventListener("change", e => { cfg.barExt = e.target.checked; saveCfg(); syncBarExt(); recompute(); toast(cfg.barExt ? `Raami jätk: osad kuni ${Core.fmtMM(cfg.barSegMax)} mm` : "Raami jätk eemaldatud"); });
  $("s_barSegMax").addEventListener("change", e => { const v = parseFloat(String(e.target.value).replace(",", ".")); if (isNaN(v) || v < 100) { e.target.value = cfg.barSegMax; return; } cfg.barSegMax = v; saveCfg(); recompute(); });
  $("s_profType").value = cfg.profType || "liist"; syncProfType(); $("s_profType").addEventListener("change", e => { cfg.profType = e.target.value; syncProfType(); onProfType(); recompute(); });
  $("s_drainMode").value = cfg.drainMode; $("s_drainMode").addEventListener("change", e => {
    const was = cfg.drainMode; cfg.drainMode = e.target.value; saveCfg();
    if (cfg.drainMode === "none" && S.holes.length) { snapshot(); S.holes = []; toast("Veeavad eemaldatud"); }
    else if (was === "none" && cfg.drainMode !== "none" && !S.holes.length && S.letters.length) { snapshot(); S.letters.forEach((L, li) => S.holes.push(...Core.drainHoles(L, cfg.holeD).map(h => ({ ...h, L: li })))); }
    recompute(); });
  const fmtLabels = () => { const d = $("s_fileFmt").value === "dwg" ? "DWG" : "DXF"; $("btnExport").textContent = typeof nfActive === "function" && nfActive() ? "Ekspordi malli peale (" + (nfIsDxf(NF.name) ? "DXF" : "DWG") + ")" : "Ekspordi " + d; $("btnExportSide").textContent = `Ekspordi külg (spline ${d} 2000)`; let t = d; try { if (tplActive()) t = "DXF, templat"; } catch (e) { /* template code not initialised yet */ } $("btnExportFrame").textContent = `Ekspordi raami joonis (${t})`; $("btnExportSheet").textContent = `Ekspordi tootmisjoonis (${t})`; };
  window.__fmtLabels = fmtLabels;
  $("s_fileFmt").value = cfg.fileFmt || "dxf"; fmtLabels(); $("s_fileFmt").addEventListener("change", e => { cfg.fileFmt = e.target.value; saveCfg(); updateExpNote(); fmtLabels(); });
  $("s_curveMode").value = cfg.curveMode; $("s_curveMode").addEventListener("change", e => { cfg.curveMode = e.target.value; saveCfg(); });
  $("s_units").value = cfg.units; $("s_units").addEventListener("change", e => { cfg.units = e.target.value; saveCfg(); if (S.srcText) reloadSource(); });
  $("s_type").addEventListener("change", e => { cfg.type = +e.target.value; $("s_pitch").value = cfg.types[cfg.type].pitch; onCfgChange("place"); });
  $("s_pitch").addEventListener("change", e => { const v = parseFloat(e.target.value); if (!(v > 0)) return; cfg.types[cfg.type].pitch = v; fillTypeSelects(); onCfgChange("samples"); });
  $("btnReset").addEventListener("click", () => { cfg = JSON.parse(JSON.stringify(DEF)); saveCfg(); fillTypeSelects(); bindValues(); computeSamples(); computeProfile(); autoPlace(); syncPreset(); toast("Vaikeseaded taastatud"); });
  $("l_type").addEventListener("change", e => { const L = S.letters[S.selLetter]; if (!L) return; L.type = e.target.value === "" ? null : +e.target.value; replaceLetter(S.selLetter); showLetter(); });
  $("l_mode").addEventListener("change", e => { const L = S.letters[S.selLetter]; if (!L) return; L.mode = e.target.value; replaceLetter(S.selLetter); showLetter(); });
  $("btnLetter").addEventListener("click", () => { if (S.selLetter != null) replaceLetter(S.selLetter); });
  document.querySelectorAll(".sec>h2").forEach(h => h.addEventListener("click", () => h.parentElement.classList.toggle("closed")));
}
function bindValues() { setTimeout(syncFrameProf, 0); $("s_barExt").checked = !!cfg.barExt; $("s_barSegMax").value = cfg.barSegMax; syncBarExt(); $("s_profType").value = cfg.profType || "liist"; syncProfType(); $("s_drainMode").value = cfg.drainMode || "notch"; for (const [id, k] of [["s_notchDepth", "notchDepth"], ["s_offBase", "offBase"], ["s_offSide", "offSide"], ["s_offGroove", "offGroove"], ["s_rIn", "rIn"], ["s_rOut", "rOut"], ["s_edge", "edge"], ["s_holeD", "holeD"], ["s_mountD", "mountD"], ["s_cableD", "cableD"], ["s_mountEnd", "mountEnd"], ["s_mountTwo", "mountTwo"], ["s_profile", "profile"], ["s_barGap", "barGap"], ["s_barEnd", "barEnd"], ["s_postGap", "postGap"], ["s_corner", "corner"], ["s_multi", "multi"], ["s_rowGap", "rowGap"], ["s_panel", "panel"], ["s_gap", "gap"], ["s_overMax", "overMax"], ["s_covMin", "covMin"], ["s_tol", "tol"], ["s_chord", "chordTol"]]) $(id).value = cfg[k]; $("s_hex").checked = cfg.hex; $("s_density").value = cfg.density; $("s_units").value = cfg.units; $("s_curveMode").value = cfg.curveMode || "lines"; }
const MODE_NAME = { line: "keskjoon (1 rida)", rows: "mitu rida", fill: "pinnatäide", auto: "automaatne" };
function showLetter() {
  const L = S.letters[S.selLetter]; $("secLetter").hidden = !L; if (!L) return;
  const w = L.bb.x1 - L.bb.x0, h = L.bb.y1 - L.bb.y0; const n = S.leds.filter(l => l.L === S.selLetter).length;
  $("letInfo").textContent = `Kuju ${S.selLetter + 1}: ${w.toFixed(0)} × ${h.toFixed(0)} mm, ${L.holes.length} auku, ${n} LED-i. Kasutatud: ${MODE_NAME[L.usedMode] || "–"}.`;
  $("l_type").value = L.type == null ? "" : String(L.type); $("l_mode").value = L.mode;
}
function updateFileInfo() { $("fileInfo").textContent = S.name; }
/* summary of the current choices, bottom of the side panel */
function renderSummary() {
  const el = $("sumList"); if (!el) return;
  const mm = v => String(Math.round(+v * 100) / 100).replace(".", ",");
  const W = S.letters.length ? Math.max(...S.letters.map(L => L.bb.x1)) - Math.min(...S.letters.map(L => L.bb.x0)) : 0, Hh = S.letters.length ? Math.max(...S.letters.map(L => L.bb.y1)) - Math.min(...S.letters.map(L => L.bb.y0)) : 0;
  const bars = S.bars || [], rp = (S.rails || []).flatMap(r => railGeom(r).poly), fxs = [...bars.flatMap(b => [b.x0, b.x1]), ...rp.map(p => p[0])], fys = [...bars.flatMap(b => [b.y - b.h / 2, b.y + b.h / 2]), ...rp.map(p => p[1])];
  const fx0 = fxs.length ? Math.min(...fxs) : 0, fx1 = fxs.length ? Math.max(...fxs) : 0, fy0 = fys.length ? Math.min(...fys) : 0, fy1 = fys.length ? Math.max(...fys) : 0;
  const drain = { notch: "sälk põhja servas", hole: "ümar ava", none: "ei ole" }[cfg.drainMode || "notch"];
  /* Profiil, Esipind, Külg and LED come from each part (Osad); with several parts each row is given per part */
  const TN = { p3: "P3 tahavalgusega", liist: "P6 peidetud liistuga", klaas: "P6 paks klaas" };
  const val = v => String(v || "").trim();
  const join = (...a) => a.map(val).filter(Boolean).join(" · ") || "—";
  const used = []; S.letters.forEach((L, i) => { const gi = L.group || 0; if (!used.some(u => u.gi === gi)) used.push({ gi, i }); });
  if (!used.length) used.push({ gi: 0, i: -1 });
  const per = (label, f) => { const G = S.groups || [], vs = used.map(u => [G[u.gi] || G[0] || {}, u.i]).map(([g, i]) => [g, f(g, i)]); const same = vs.every(v => v[1] === vs[0][1]);
    return same || vs.length < 2 ? [[label, vs[0][1]]] : vs.map(([g, v]) => [`${label}: ${g.name || "osa"}`, v]); };
  const profOf = i => (i >= 0 && S.prof && S.prof[i] && S.prof[i].offs) || { type: cfg.profType || "liist", offBase: cfg.offBase, offSide: cfg.offSide, offGroove: cfg.offGroove };
  const yes = v => /^(jah|yes|ja|on|true|1)$/i.test(val(v)) ? "dimmerdatav" : /^(ei|no|false|0)$/i.test(val(v)) ? "ei ole dimmerdatav" : val(v) ? "dimmerdatav: " + val(v) : "";
  const rows = [
    ...per("Profiil", (g, i) => { const q = profOf(i); return TN[q.type] || q.type; }),
    ...per("Esipind", g => join(g.faceMat)),
    ...per("Külg", g => join(sideSpec(g).text + " mm", g.sideColor)),
    ["Raam", join(frameProfileName(), S.order && S.order.frameMat, S.order && S.order.frameColor)],
    ...per("LED", g => join(g.lightTemp, yes(g.dimmable))),
    ["Raami suurus", fxs.length ? `${Math.round(fx1 - fx0)} × ${Math.round(fy1 - fy0)} mm` : "—"],
    ...(bars.length || (S.rails || []).length ? [["Raami osad", `${barPieces()} profiili · ${(S.posts || []).length} pulka` + ((S.rails || []).length ? ` · ${S.rails.length} nurga all` : "") + (cfg.barExt && bars.length ? ` · jätk ≤ ${mm(cfg.barSegMax)} mm` : "")]] : []),
    ["Veeavad", cfg.drainMode === "none" ? "ei ole" : `${drain} · Ø${mm(cfg.holeD)}${S.holes.length ? ` · ${S.holes.length} tk` : ""}`],
    ["Kinnitusavad", `Ø${mm(cfg.mountD)}${(S.mounts || []).length ? ` · ${S.mounts.length} tk` : ""}`],
    ...(anyP3() ? [["Kaabliavad", `Ø${mm(cfg.cableD || 8)}${S.cables && S.cables.length ? ` · ${S.cables.length} tk` : ""}`]] : []),
    ["Sildi mõõdud", S.letters.length ? `${Math.round(W)} × ${Math.round(Hh)} mm` : "—"]
  ];
  el.innerHTML = rows.map(([k, v]) => `<div><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("");
}
function renderVal() {
  const m = []; const nL = S.letters.length; const nH = S.letters.reduce((s, L) => s + L.holes.length, 0);
  if (nL) m.push(["ok", `${nL} kuju (${nL + nH} suletud kontuuri, sh ${nH} auku).`]); else m.push([S.name ? "bad" : "ok", S.name ? "Ühtegi suletud kontuuri pole." : "Laadi DXF-fail, et alustada."]);
  if (S.openCount) m.push(["warn", `${S.openCount} avatud kontuuri jäi välja. Suurenda suletuse tolerantsi või sulge need CAD-is.`]);
  if (S.dupes) m.push(["warn", `${S.dupes} topeltkontuuri eemaldati.`]);
  const pi = S.parseInfo; if (pi) { if (pi.text) m.push(["warn", `${pi.text} tekstiobjekti jäeti vahele. Teisenda tekst CAD-is kõverateks.`]); const ig = Object.entries(pi.ignored).filter(([k]) => !["HATCH", "DIMENSION", "POINT", "VIEWPORT", "ATTRIB", "ATTDEF", "SOLID", "3DFACE"].includes(k)); if (ig.length) m.push(["warn", "Toetamata objektid: " + ig.map(([k, v]) => `${k} ×${v}`).join(", ")]); m.push(["ok", `Faili ühik: ${pi.fileUnit}${cfg.units !== "auto" ? `, kasutatakse: ${$("s_units").selectedOptions[0].text}` : ""}.`]); }
  if (cfg.barExt) { const bad = (S.bars || []).filter(b => b.j && b.j.fail).length; if (bad) m.push(["warn", `Raami jätk: ${bad} profiilil ei leidunud tähtede vahel kohta, et osad jääks alla ${Core.fmtMM(cfg.barSegMax)} mm. Suurenda max segmenti.`]);  const long = (S.bars || []).filter(b => b.j && b.j.man && [b.x0, ...b.j.xs, b.x1].some((x, i, a) => i && x - a[i - 1] > cfg.barSegMax + 0.5)).length; if (long) m.push(["warn", `Raami jätk: käsitsi sätitud jätkukohtadega on ${long} profiilil osa pikem kui ${Core.fmtMM(cfg.barSegMax)} mm.`]); }
  if (S.bars.length) { const off = S.letters.map((L, i) => Core.letterOnFrame(L, S.bars) || (S.posts || []).some(q => q.dot === i && q.seg) ? null : i + 1).filter(Boolean); if (off.length) m.push(["warn", `Raam ei ulatu kujudeni: ${off.join(", ")}. Lisa kinnitus käsitsi.`]); }
  const thin = S.letters.map((L, i) => { const ch = S.chains[i] || []; const r = ch.flatMap(c => c.pts.map(p => p[2])).sort((a, b) => a - b); const med = r[r.length >> 1] || 0; return med * 2 < cfg.edge * 2 && med > 0 ? i + 1 : null; }).filter(Boolean);
  if (thin.length) m.push(["warn", `Kitsas joon (alla ${cfg.edge * 2} mm) kujudel: ${thin.join(", ")}. LED jääb servale lähemale kui ${cfg.edge} mm.`]);
  if ($("valMsgs")) $("valMsgs").innerHTML = m.map(([c, t]) => `<div class="msg ${c}">${esc(t)}</div>`).join("");
}
function postLen() { return (S.posts || []).reduce((s, q) => s + Core.postSegs(S.bars, q).reduce((a, g) => a + g[1] - g[0], 0), 0); }
function postCov(q) { const g = Core.postSegs(S.bars, q); const L = g.reduce((a, v) => a + v[1] - v[0], 0); if (!L) return { len: 0, out: 0 }; let out = 0; for (const [lo, hi] of g) out += (1 - Core.postCover(S.letters, q.x, q.w, lo, hi, 200)) * (hi - lo); return { len: L, out }; }

function renderRep() {
  const r = S.rep; if (!r) return;
  $("k_cov").textContent = pct(r.coverage); $("k_cov").className = r.coverage * 100 < cfg.covMin ? "w" : "";
  $("k_over").textContent = pct(r.over); $("k_over").className = r.over * 100 > cfg.overMax ? "w" : "";
  $("k_axis").textContent = pct(r.axis); $("k_dens").textContent = "±" + Math.round(r.density * 100) + "%";
  $("k_leds").textContent = S.leds.length; $("k_holes").textContent = S.holes.length;
  const byT = cfg.types.map((t, i) => [t.name, S.leds.filter(l => l.t === i).length]).filter(x => x[1]);
  const barLen = S.bars.reduce((s, b) => s + (b.x1 - b.x0), 0);
  const w = S.letters.length ? Math.max(...S.letters.map(L => L.bb.x1)) - Math.min(...S.letters.map(L => L.bb.x0)) : 0, h = S.letters.length ? Math.max(...S.letters.map(L => L.bb.y1)) - Math.min(...S.letters.map(L => L.bb.y0)) : 0;
  const rows = [...byT.map(([n, c]) => [`LED ${n}`, `${c} tk`]), ["Raamiprofiil", `${barPieces()} tk · ${(barLen / 1000).toFixed(2)} m`], ["Vertikaalpulgad", `${(S.posts || []).length} tk · ${(postLen() / 1000).toFixed(2)} m`], ["Juhe (hinnang)", `${((S.wire ? S.wire.len : 0) / 1000).toFixed(1)} m`], ["Mõõdud", `${w.toFixed(0)} × ${h.toFixed(0)} mm`], ["Valgustatav pind", `${(S.letters.reduce((s, L) => s + L.area, 0) / 1e6).toFixed(3)} m²`]];
  const mn = S.mounts || []; $("holeList").innerHTML = `<div><span>Kinnitusavad</span><span>${mn.length} tk · Ø${cfg.mountD}</span></div><div><span>sh 2 avaga lõike</span><span>${new Set(mn.filter(m => m.w > cfg.mountTwo).map(m => m.y.toFixed(1) + "_" + m.L + "_" + m.w.toFixed(1))).size}</span></div>${anyP3() && S.cables && S.cables.length ? `<div><span>Kaabliavad (P3)</span><span>${S.cables.length} tk · Ø${cfg.cableD || 8}</span></div>` : ""}${mn.some(m => m.dot) ? `<div><span>sh täppide pulkadel</span><span>${mn.filter(m => m.dot).length}</span></div>` : ""}<div><span>Veeavad</span><span>${S.holes.length} tk · Ø${cfg.holeD}</span></div>`;
  const psp = Core.postSpan(S.bars); const posts = (S.posts || []).slice().sort((a, b) => a.x - b.x);
  const pc = posts.map(postCov);
  const postRows = posts.map((q, i) => `<div><span>Pulk ${i + 1}</span><span>${pc[i].len.toFixed(0)} mm · ${pc[i].out < 1 ? "peidus" : "paistab ~" + pc[i].out.toFixed(0) + " mm"}</span></div>`).join("");
  const postWarn = pc.some(c => c.out >= 1) ? `<div class="msg warn">Mõni pulk paistab tähtede vahelt välja. Lohista seda Shiftiga või vähenda pulkade vahet.</div>` : "";
  const gaps = S.bars.slice().sort((p, q) => p.y - q.y).map((b, i, arr) => i ? b.y - arr[i - 1].y : null).filter(v => v != null);
  const railRows = (S.rails || []).map((r, k) => { const g = railGeom(r); return `<div><span>Nurga all ${k + 1}</span><span>${Math.round(g.long)} mm${g.angA || g.angB ? ` · ${railDeg(g.angA)}/${railDeg(g.angB)}` : ""}</span></div>`; }).join("");
  $("frameList").innerHTML = (S.rails || []).length && !S.bars.length ? railRows : S.bars.length ? S.bars.slice().sort((p, q) => q.y - p.y).map((b, i) => { const xs = [b.x0, ...((b.j && b.j.xs) || []), b.x1], parts = xs.slice(1).map((x, k) => (x - xs[k]).toFixed(0)); return `<div><span>Profiil ${i + 1}</span><span>${(b.x1 - b.x0).toFixed(0)} mm</span></div>` + (parts.length > 1 ? `<div><span>&nbsp;&nbsp;jätkuga osad</span><span>${parts.join(" + ")}</span></div>` : ""); }).join("") + (gaps.length ? `<div><span>Suurim vahe</span><span>${Math.max(...gaps).toFixed(0)} mm</span></div>` : "") + postRows + postWarn : `<div class="msg warn">Raami ei õnnestunud paigutada.</div>`; if (S.bars.length && railRows) $("frameList").innerHTML += railRows;
  $("repList").innerHTML = rows.map(([a, b]) => `<div><span>${a}</span><span>${b}</span></div>`).join("");
  const m = [];
  if (r.spots.length) m.push(["warn", `Kontroll: ${r.spots.length} tühja kohta (märgitud ristiga).`]); else m.push(["ok", "Kontroll: tühje kohti ega paigutusvigu ei leitud."]);
  if (r.coverage * 100 < cfg.covMin) m.push(["warn", `Kate ${pct(r.coverage)} on alla lävendi ${cfg.covMin}%.`]);
  if (r.over * 100 > cfg.overMax) m.push(["warn", `Ülevalgustus ${pct(r.over)} ületab lävendit ${cfg.overMax}%.`]);
  if (r.nearEdge) m.push(["warn", `${r.nearEdge} LED-i on servale lähemal kui ${Math.round(cfg.edge * 0.75)} mm.`]);
  $("repMsgs").innerHTML = m.map(([c, t]) => `<div class="msg ${c}">${esc(t)}</div>`).join("");
  $("f_leds").textContent = S.leds.length; $("f_cov").textContent = pct(r.coverage);
  $("stCounts").textContent = `${S.leds.length} LED-i · ${S.holes.length} auku · ${S.bars.length} profiili · ${(S.posts || []).length} pulka` + ((S.rails || []).length ? ` · ${S.rails.length} nurga all` : "");
  if (S.selLetter != null) showLetter();
}

/* the summary follows the order and part fields as they are typed */
document.addEventListener("input", e => { const id = e.target && e.target.id || ""; if (/^g_|^o_frame/.test(id)) setTimeout(renderSummary, 0); });
document.addEventListener("change", e => { const id = e.target && e.target.id || ""; if (/^g_|^o_frame/.test(id)) setTimeout(renderSummary, 0); });
