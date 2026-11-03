/* Valgustähed — olek.js
   Rakenduse olek ja ühised abifunktsioonid: seaded (cfg), joonise olek (S), tagasivõtt, lõuend, teated.
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */
const $ = id => document.getElementById(id);
const DEF = {
  type: 1, density: "balanced",
  types: [{ name: "P0", pitch: 75, soor: 75, dash: 9 }, { name: "P1", pitch: 120, soor: 120, dash: 12 }, { name: "P2", pitch: 150, soor: 150, dash: 12 }, { name: "P3", pitch: 180, soor: 180, dash: 12 }],
  profType: "liist", offBase: -1.6, offSide: -1.2, offGroove: -4.2, rIn: 2, rOut: 1,
  edge: 20, holeD: 6, drainMode: "notch", notchDepth: 6, mountD: 6, mountEnd: 0, cableD: 8, mountTwo: 160, profile: 30, barGap: 800, barEnd: 20, barExt: false, barSegMax: 2000, postGap: 1200, corner: 35, multi: 1.6, rowGap: 1, panel: 2.5, hex: false, gap: 0.8, tol: 0.3, chordTol: 0.01, depth3d: 100, face3d: true, glow3d: true, curveMode: "lines", onSrc: true, overMax: 40, covMin: 70, units: "auto"
};
let cfg = loadCfg();
function loadCfg() { try { const s = JSON.parse(localStorage.getItem("ledp_cfg") || "null"); if (s && s.types && s.types.length === 4) return Object.assign(JSON.parse(JSON.stringify(DEF)), s); } catch (e) {} return JSON.parse(JSON.stringify(DEF)); }
function saveCfg() { try { localStorage.setItem("ledp_cfg", JSON.stringify(cfg)); } catch (e) {} }

const S = { name: "", srcText: null, srcFmt: null, sample: null, letters: [], chains: [], samp: [], leds: [], holes: [], bars: [], posts: [], spots: [], rep: null, wire: null, parseInfo: null, openCount: 0, dupes: 0, sel: null, selLetter: null, manual: false, tool: "select" };
const undo = [];
const view = { cx: 0, cy: 0, s: 1 };
const cv = $("cv"), ctx = cv.getContext("2d");
let W = 0, H = 0, DPR = 1;

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
const pct = v => v == null ? "–" : Math.round(v * 100) + "%";

let tt = null; function toast(s) { const t = $("toast"); t.textContent = s; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 3200); }
