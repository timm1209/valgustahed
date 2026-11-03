/* Valgustähed — main.js
   Käivitus: algväärtused ja esimene joonistus, samas järjekorras nagu v2.13-s.
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */
syncFrameProf();

/* ---------- boot ---------- */
readColors(); fillTypeSelects(); bindInputs(); fillPresets();
document.querySelectorAll(".layers input").forEach(i => i.addEventListener("change", () => { draw(); updateExpNote(); schedule3D(); }));
updateExpNote();
document.querySelector(".layers b").addEventListener("click", () => $("layers").classList.toggle("min"));
if (window.innerWidth < 820) { $("layers").classList.add("min"); $("sumBox").classList.add("min"); }
document.querySelector(".sumbox b").addEventListener("click", () => { const m = $("sumBox").classList.toggle("min"); try { localStorage.setItem("valg_summin", m ? "1" : ""); } catch (e) {} });
try { if (localStorage.getItem("valg_summin") === "1") $("sumBox").classList.add("min"); } catch (e) {}

S.groups = [emptyGroup("Tekst")]; S.gCur = 0;

S.order = emptyOrder();

fillOrder();

tplUI();

resize();
function boot() { if (typeof Delaunator === "undefined") { toast("Arvutusteek ei laadinud. Kontrolli internetiühendust."); return; } recompute(); updateFileInfo(); } /* start with an empty table */
if (document.readyState === "complete") boot(); else window.addEventListener("load", boot);
