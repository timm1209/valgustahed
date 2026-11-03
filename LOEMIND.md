# Valgustähed v2.22

DXF tähekontuuridest raam, veeavad, kinnitusavad ja LED-id. Sama rakendus mis DAG Tellimuste lehe Valgustähtede vahelehel, sama kujundusega, aga eraldi ja ilma tellimuste osata.

## Käivitamine

Ava `index.html` brauseris (Chrome, Edge või Firefox). Paigaldamist pole vaja.

- Kõik teegid on kaustas `lib/`, nii et rakendus töötab ka ilma internetita. Internetiga laaditakse lisaks fondid (IBM Plex, Barlow), ilma internetita kasutab brauser oma fonti.
- Eksporditud failid (DXF, DWG, PDF, projekt) salvestuvad brauseri allalaadimiste kausta.
- Seaded ja profiili eelseadistused jäävad brauserisse alles iga lehe asukoha kohta eraldi.

GitHubis töötab see GitHub Pagesiga otse: lae kogu kaust repositooriumi ja lülita Pages sisse.

## Failid

| Kaust / fail | Sisu |
|---|---|
| `index.html` | Leht: paneelid, nupud ja kujundus |
| `js/core/` | Arvutusosa (DOM-i ei kasuta) |
| `js/core/geom.js` | Põhigeomeetria |
| `js/core/dxf-lugemine.js` | DXF-faili lugemine |
| `js/core/tahed.js` | Kontuuridest tähed |
| `js/core/keskjoon.js` | Tähe keskjoon |
| `js/core/led.js` | LED-ide paigutus, raport, juhe |
| `js/core/veeavad.js` | Veeavade asukohad |
| `js/core/profiil.js` | Põhja, külje ja soone nihked |
| `js/core/raam.js` | Raam, pulgad, kinnitusavad, mõõdud |
| `js/core/dxf-kirjutamine.js` | DXF-i kirjutamine, külje splainid, ZIP |
| `js/core/naidised.js` | Näidiskujud |
| `js/core.js` | Arvutusosa avalik liides (`Core`) |
| `js/olek.js` | Seaded, joonise olek, teated |
| `js/sisend.js` | DXF-i laadimine ja lohistamine |
| `js/profiil.js` | Profiil ja eelseadistused |
| `js/paigutus.js` | Paigutus ja tagasivõtt |
| `js/paneel.js` | Parempoolne paneel, koondinfo, raport |
| `js/vaade2d.js` | 2D-joonis, mõõdulint, mõõdud |
| `js/raam.js` | Raami muutmine, lõikeloend |
| `js/tooriistad.js` | Hiir, tööriistad, kiirklahvid |
| `js/eksport.js` | LED-joonise eksport (DXF/DWG), külg |
| `js/projekt.js` | Projektifail (.ledprojekt.json) |
| `js/joonised.js` | Raamijoonis, tootmisjoonis, PDF-joonised |
| `js/tellimus.js` | Tellimuse info ja osad, RAL-värvid |
| `js/kliendi-pdf.js` | Kliendi PDF |
| `js/vaade3d.js` | 3D-vaade |
| `js/naidisfail.js` | Mall (.dwt/.dwg → eksport DWG, .dxf → eksport DXF): LED-joonis lisatakse malli mudelruumi punkti 0;0, DWGPROPS täidetakse, vaateaknad sätitakse |
| `js/templat.js` | Ettevõtte joonise templat (praegu välja lülitatud) |
| `js/tplmerge.js` | Templati ühendamine |
| `js/main.js` | Käivitus |
| `lib/acadts-DAG.patch` | acad-ts 3.2.0 parandused (väljad, päise lipud, dünaamilised plokid, muutmata objektid algse kirjena) |
| `lib/` | Teegid: acad-ts (DWG ja DXF lugemine/kirjutamine), Clipper, Delaunator, three.js, jsPDF |

Kõik `js/` failid jagavad ühist skoopi ja laaditakse `index.html`-is kindlas järjekorras: arvutusosa enne, `main.js` viimasena.
