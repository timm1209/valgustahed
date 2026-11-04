/* Valgustähed — kliendi-pdf.js
   Kliendi PDF (visualiseering 3D-pildiga).
   Kõik failid jagavad ühist globaalset skoopi; laadimise järjekord on index.html-is. */

/* ===================== CLIENT PDF ===================== */

function ensurePdf() { return window.jspdf ? Promise.resolve() : loadScript("lib/jspdf.umd.min.js"); }
/* 3D view rendered off-screen at a fixed size for print, the on-screen view is restored afterwards */
function snapshot3D(wpx, hpx) {
  const r = T3.r, cam = T3.cam, old = new THREE.Vector2(); r.getSize(old); const oldPR = r.getPixelRatio();
  const oldPos = cam.position.clone(), oldTarget = T3.ctl.target.clone(), oldNear = cam.near, oldFar = cam.far;
  r.setPixelRatio(1); r.setSize(wpx, hpx, false); cam.aspect = wpx / hpx; cam.updateProjectionMatrix();
  /* keep the chosen viewing angle, but frame the whole sign tightly: project the box corners and step the camera in or out */
  const box = new THREE.Box3().setFromObject(T3.group), c = box.getCenter(new THREE.Vector3());
  const dir = oldPos.clone().sub(oldTarget).normalize(); let dist = oldPos.distanceTo(oldTarget);
  const corners = []; for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
  for (let it = 0; it < 6; it++) {
    cam.position.copy(c).addScaledVector(dir, dist); cam.lookAt(c); cam.updateMatrixWorld();
    let m = 0; for (const q of corners) { const v = q.clone().project(cam); m = Math.max(m, Math.abs(v.x), Math.abs(v.y)); }
    dist *= m / 0.9;
  }
  cam.position.copy(c).addScaledVector(dir, dist); cam.lookAt(c); cam.near = Math.max(1, dist / 500); cam.far = dist * 50; cam.updateProjectionMatrix();
  render3D(); const url = r.domElement.toDataURL("image/jpeg", 0.92);
  cam.position.copy(oldPos); T3.ctl.target.copy(oldTarget); cam.near = oldNear; cam.far = oldFar;
  r.setPixelRatio(oldPR); r.setSize(old.x, old.y, false); cam.aspect = old.x / Math.max(1, old.y); cam.updateProjectionMatrix(); T3.ctl.update(); render3D();
  return url;
}
const hexRGB = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
async function exportPdf() {
  if (!S.letters.length) { toast("Pole midagi eksportida."); return; }
  const btn = $("btnPdf"); btn.disabled = true; btn.textContent = "Koostan PDF-i…";
  try {
    await ensurePdf(); if (!T3.r) { toast("Ava enne 3D-vaade."); return; }
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = 297, H = 210, M = 14, ink = [28, 33, 38], mut = [104, 114, 122], line = [214, 219, 223], acc = [211, 32, 43];
    const title = (S.order.title || "").trim() || (S.name || "Valgustäht").replace(/\.(dxf|dwg|json)$/i, "").replace(/_/g, " ");
    const date = new Date().toLocaleDateString("et-EE", { day: "numeric", month: "long", year: "numeric" });
    /* header */
    doc.setFillColor(...acc); doc.circle(M + 2, M + 3.2, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(...ink); doc.text(title, M + 7, M + 5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...mut); doc.text("Valgustähtede visualiseering", M + 7, M + 11);
    doc.text(date, W - M, M + 5, { align: "right" });
    doc.setDrawColor(...line); doc.setLineWidth(0.3); doc.line(M, M + 15, W - M, M + 15);
    /* 3D image */
    const xs = S.letters.flatMap(L => [L.bb.x0, L.bb.x1]), ys = S.letters.flatMap(L => [L.bb.y0, L.bb.y1]);
    const sw = Math.round(Math.max(...xs) - Math.min(...xs)), shh = Math.round(Math.max(...ys) - Math.min(...ys));
    const wide = sw / Math.max(1, shh) > 2.2; /* wide signs: picture across the page, specs in four columns below */
    const ix = M, iy = M + 20, iw = wide ? W - 2 * M : 178, ih = wide ? 112 : 150;
    const img = snapshot3D(Math.round(iw * 10), Math.round(ih * 10));
    doc.setFillColor(244, 246, 247); doc.roundedRect(ix, iy, iw, ih, 2.5, 2.5, "F");
    doc.addImage(img, "JPEG", ix, iy, iw, ih, undefined, "FAST");
    doc.setDrawColor(...line); doc.roundedRect(ix, iy, iw, ih, 2.5, 2.5, "S");
    /* spec column */
    let cx = ix + iw + 10, cw = W - M - cx, y = iy + 2; const colW = (W - 2 * M - 3 * 8) / 4, y0 = iy + ih + 9;
    const col = k => { if (wide) { cx = M + k * (colW + 8); cw = colW; y = y0; } else if (k) y += 3; };
    const o = S.order, frameLen = (S.bars.reduce((a, b) => a + b.x1 - b.x0, 0) + postLen()) / 1000;
    const section = name => { doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...acc); doc.text(name.toUpperCase(), cx, y, { charSpace: 0.4 }); y += 2; doc.setDrawColor(...line); doc.line(cx, y, cx + cw, y); y += 5; };
    const row = (label, value, colorStr) => {
      if (!value) return; doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...mut); doc.text(label, cx, y);
      let vx = cx + (wide ? 22 : 30); const c = colorStr != null ? colorOf(colorStr) : null;
      if (c != null) { doc.setFillColor(...hexRGB(c)); doc.setDrawColor(...line); doc.roundedRect(vx, y - 3.2, 4, 4, 0.8, 0.8, "FD"); vx += 6; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...ink);
      const lines = doc.splitTextToSize(String(value), cx + cw - vx); doc.text(lines, vx, y);
      y += 4.6 * lines.length + 2.4;
    };
    col(0); section("Mõõdud"); row("Laius", `${sw} mm`); row("Kõrgus", `${shh} mm`); row("Sügavus", `${Math.max(...S.letters.map((L, i) => depthOf(i)))} mm`);
    col(1); section("Esipind"); row("Materjal", gval("faceMat") || "–"); row("Värv", gval("faceColor") || "–", usedGroups()[0] && usedGroups()[0].faceColor); row("Kile", gval("faceFilm"));
    col(2); section("Külg"); row("Sügavus", usedGroups().map(g => sideSpec(g).text + " mm").filter((v, i, a) => a.indexOf(v) === i).join(" / ")); row("Värv", gval("sideColor") || "–", usedGroups()[0] && usedGroups()[0].sideColor);
    col(3); section("Raam"); row("Profiil", frameProfileName()); row("Materjal", o.frameMat || "–"); row("Värv", o.frameColor || "–", o.frameColor);
    /* footer */
    doc.setDrawColor(...line); doc.line(M, H - M - 4, W - M, H - M - 4);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...mut);
    doc.text("Visualiseering on illustratiivne. Värvitoonid ekraanil ja trükis võivad tegelikust materjalist erineda.", M, H - M + 0.5);
    const bytes = new Uint8Array(doc.output("arraybuffer")); const name = baseName() + " visualiseering.pdf";
    let dl = null; try { dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null; } catch (e) { dl = null; }
    if (dl) { try { await dl.save({ filename: name, data: bytes }); toast("PDF salvestatud: " + name); } catch (e) { if (!(e && e.code === "declined")) toast("Salvestamine ei õnnestunud: " + (e && e.message || "tundmatu viga")); } }
    else { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); toast("PDF salvestatud: " + name); }
  } catch (e) { console.error(e); toast("PDF-i koostamine ebaõnnestus: " + (e.message || e)); }
  finally { btn.disabled = false; btn.textContent = "PDF kliendile"; }
}
$("btnPdf").addEventListener("click", exportPdf);
