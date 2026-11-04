# Valgustähed v2.31

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
| `js/andmebaas.js` | Supabase'i ühendus ja tööd: salvesta/uuenda, nimekiri otsinguga, ava, kustuta |
| `js/kasutajad.js` | Sisselogimisleht, kasutajamenüü, parooli muutmine/taastamine, admini paneel |
| `supabase/functions/kasutajad/index.ts` | Serverifunktsioon kasutajate loomiseks, muutmiseks ja kustutamiseks (ainult admin) |
| `js/andmebaas-config.js` | Supabase'i projekti aadress ja anon võti (kõigile arvutitele ühine) |
| `supabase.sql` | Tabelid `kasutajad` ja `tood`, rollid ja ligipääsureeglid (käivita Supabase'i SQL Editoris) |
| `js/naidisfail.js` | Mall (.dwt/.dwg → eksport DWG, .dxf → eksport DXF): LED-joonis lisatakse malli mudelruumi punkti 0;0, DWGPROPS täidetakse, vaateaknad sätitakse |
| `js/templat.js` | Ettevõtte joonise templat (praegu välja lülitatud) |
| `js/tplmerge.js` | Templati ühendamine |
| `js/main.js` | Käivitus |
| `lib/acadts-DAG.patch` | acad-ts 3.2.0 parandused (väljad, päise lipud, dünaamilised plokid, muutmata objektid algse kirjena) |
| `lib/supabase.js` | supabase-js 2.117.3 (MIT) |
| `lib/` | Teegid: acad-ts (DWG ja DXF lugemine/kirjutamine), Clipper, Delaunator, three.js, jsPDF |

Kõik `js/` failid jagavad ühist skoopi ja laaditakse `index.html`-is kindlas järjekorras: arvutusosa enne, `main.js` viimasena.

## Andmebaas ja kasutajad (Supabase)

Rakendusse pääseb ainult sisseloginud ja aktiivne kasutaja. Rollid: **Admin** (loob kasutajaid, muudab rolle, blokeerib, paneb uue parooli, kustutab) ja **Kasutaja**. Iga kasutaja saab oma parooli muuta (nimemenüü → Muuda parooli) ja unustatud parooli e-posti kaudu taastada. Kõik kasutajad näevad, muudavad ja kustutavad kõiki töid; iga töö juures on näha, kes selle tegi ja kes viimati muutis.

1. **Projekt:** supabase.com → New project (tasuta plaan, regioon nt Frankfurt).
2. **Tabelid:** SQL Editor → New query → kleebi `supabase.sql` sisu → **Run**.
3. **Sisselogimine:** Authentication → Sign In / Providers → *Email* sees, *Allow new users to sign up* **välja**.
   Authentication → URL Configuration → *Site URL* = `https://timm1209.github.io/valgustahed/` (parooli taastamise link viib sinna).
4. **Serverifunktsioon:** Edge Functions → Deploy a new function → *Via Editor* → nimi **kasutajad** → kleebi `supabase/functions/kasutajad/index.ts` sisu → **Deploy function**; siis funktsiooni seadetes lülita **Verify JWT** välja (funktsioon kontrollib sisselogimist ise).
5. **Esimene admin:** Authentication → Users → Add user → Create new user (sinu e-post ja parool, *Auto Confirm User*).
   Siis SQL Editoris: `update public.kasutajad set roll = 'admin', nimi = 'Sinu Nimi' where email = 'sinu@epost.ee';`
6. **Ühendus:** Project Settings → Data API → *Project URL* ja API Keys → *Publishable key* (`sb_publishable_…`, või vanemas projektis *anon public*) faili `js/andmebaas-config.js`.
   `service_role` võtit ära kuhugi rakendusse pane.

Edasi loob admin kasutajad rakenduses: nimemenüü → **Kasutajad ja õigused**.
Töö salvestub koos lähte-DXF-i, seadete, LED-ide, avade ja raamiga (sama sisu mis projektifailil). Kui töö on andmebaasist avatud, uuendab „Salvesta andmebaasi“ sama tööd; „Salvesta uue tööna“ teeb koopia.
