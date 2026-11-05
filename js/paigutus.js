/* Valgustähed — paigutus.js
   LED-ide ja veeavade paigutus, tagasivõtt, kogu arvutuse uuesti käivitamine.
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */

/* ---------- placement ---------- */
function snapshot() { undo.push(JSON.stringify({ mountAdd: S.mountAdd || [], mountDel: S.mountDel || [], leds: S.leds, holes: S.holes, bars: S.bars, posts: S.posts, rails: S.rails || [], types: S.letters.map(L => [L.type, L.mode]), manual: S.manual })); if (undo.length > 60) undo.shift(); }
function restore() { const s = undo.pop(); if (!s) { toast("Rohkem pole võtta tagasi."); return; } const o = JSON.parse(s); S.mountAdd = o.mountAdd || []; S.mountDel = o.mountDel || []; S.leds = o.leds; S.holes = o.holes; S.bars = o.bars; S.posts = o.posts || []; S.rails = o.rails || []; o.types.forEach((v, i) => { if (S.letters[i]) { S.letters[i].type = v[0]; S.letters[i].mode = v[1]; } }); S.manual = o.manual; S.sel = null; recompute(); }
function typeOf(L) { return L.type ?? cfg.type; }
function placeOne(li) {
  const L = S.letters[li]; const ti = typeOf(L); const t = cfg.types[ti];
  let leds = Core.placeLetter(L, S.chains[li] || [], cfg, t);
  const add = Core.gapFill(leds, S.samp[li], t.pitch, cfg.gap * t.pitch, cfg.edge);
  leds = Core.mergeLeds([...leds, ...add], t.pitch * 0.45);
  return leds.map(l => ({ x: l.x, y: l.y, a: l.a || 0, t: ti, L: li }));
}
function autoPlace() {
  if (!S.letters.length) return; snapshotIf();
  S.leds = []; S.holes = [];
  S.letters.forEach((L, li) => { S.leds.push(...placeOne(li)); if (cfg.drainMode !== "none") S.holes.push(...Core.drainHoles(L, cfg.holeD).map(h => ({ ...h, L: li }))); });
  S.mountAdd = []; S.mountDel = [];
  S.bars = Core.frameBars(S.letters, cfg); S.posts = Core.framePosts(S.letters, S.bars, cfg); Core.snapBars(S.bars, S.posts); S.posts.push(...Core.dotPosts(S.letters, S.bars, cfg)); S.manual = false; $("btnAuto").classList.remove("pulse");
  recompute();
}
function snapshotIf() { if (S.leds.length || S.holes.length) snapshot(); }
function replaceLetter(li) { snapshot(); S.leds = S.leds.filter(l => l.L !== li).concat(placeOne(li)); recompute(); }
function applyNotches() {
  if (!S.prof) return;
  S.prof.forEach((p, i) => {
    if (!p || !p.baseRaw) return;
    if (cfg.drainMode !== "notch") { p.base = p.baseRaw; return; }
    const ns = S.holes.filter(h => h.L === i).map(h => { const y0 = Core.edgeBelow(p.baseRaw, h.x, h.y); return y0 === null ? null : { x: h.x, y0, w: cfg.holeD, depth: cfg.notchDepth }; }).filter(Boolean);
    p.base = Core.notchLoops(p.baseRaw, ns) || p.baseRaw;
  });
}
function recompute() {
  S.multi = (S.multi || []).filter(q => (S.posts || []).includes(q)); renderAlign();
  applyNotches();
  updateJoints(); refreshMounts();
  S.rep = Core.report(S.letters, S.leds, cfg.types, cfg, S.samp, S.chains); S.spots = S.rep.spots; S.wire = Core.wireOrder(S.letters, S.leds);
  renderVal(); renderRep(); renderSummary(); draw(); schedule3D();
  if (typeof fillScrewQty === "function") { fillScrewQty(); fillBackMat(); }
  if (typeof dbUI === "function") dbUI();
}
let tmr = null; function onCfgChange(kind) { saveCfg(); clearTimeout(tmr); tmr = setTimeout(() => { if (kind === "source") { reloadSource(); return; } if (kind === "samples") computeSamples(); if (S.manual) { $("btnAuto").classList.add("pulse"); recompute(); toast("Seaded muutusid. Vajuta „Paiguta automaatselt“, et käsitsi muudatused üle kirjutada."); } else autoPlace(); }, 250); }

$("btnAuto").addEventListener("click", autoPlace);
