/**
 * One-off content update: replace the placeholder `terms` and `privacy` pages
 * for the eFakturuj B2B portal with the real Slovak legal text
 * (Všeobecné obchodné podmienky + Informácie o spracúvaní osobných údajov,
 * effective 1.6.2026, v1.0), then publish them.
 *
 * The efakturuj frontend renders these at /p/terms and /p/privacy via the public
 * pages endpoint. Each page becomes a single `content-rich-text` block (same shape
 * the placeholders used) plus Slovak SEO title/description.
 *
 * Idempotent: overwrites blocks+seo to the canonical content on every run.
 * Dry-run by default — prints current + planned state and writes NOTHING.
 * Set APPLY=1 to actually write + publish.
 *
 * Run (from vinc-commerce-suite):
 *   TENANT_ID=efakturuj-sk dotenv -e .env -o -- vite-node scripts/update-efakturuj-legal-pages.ts
 *   TENANT_ID=efakturuj-sk APPLY=1 dotenv -e .env -o -- vite-node scripts/update-efakturuj-legal-pages.ts
 */
import { connectWithModels } from "@/lib/db/connection";
import { getPortalByDomain } from "@/lib/services/b2b-portal.service";

const TENANT_ID = process.env.TENANT_ID || "efakturuj-sk";
const DOMAIN = process.env.LEGAL_DOMAIN || "efakturuj.sk";
const APPLY = process.env.APPLY === "1";

type PageUpdate = {
  pageSlug: string;
  name: string;
  seo: { title: string; description: string };
  html: string;
};

// ── Terms of Service (Všeobecné obchodné podmienky) ─────────────────────────
const TERMS_HTML = `
<p><strong>Prevádzkovateľ služby: Efakturuj, s. r. o.</strong><br/>
Sídlo: Fedinova 1083/16, 851 01 Bratislava – mestská časť Petržalka, Slovenská republika<br/>
IČO: 57546495<br/>
DIČ: 2122813913<br/>
E-mail: info@efakturuj.sk<br/>
Web: www.efakturuj.sk</p>
<p>Účinnosť od: 1.6.2026 &middot; Verzia: 1.0</p>

<h2>1. Úvodné ustanovenia</h2>
<p>1.1. Tieto všeobecné obchodné podmienky upravujú práva a povinnosti spoločnosti Efakturuj, s. r. o. ako poskytovateľa služby eFakturuj a jeho zákazníkov pri používaní webovej aplikácie, API, integračných modulov, mobilnej aplikácie, sandboxu, white-label riešenia a súvisiacich služieb elektronickej fakturácie.</p>
<p>1.2. Služba eFakturuj je určená najmä pre podnikateľov, právnické osoby, účtovníkov, účtovné firmy, dodávateľov ekonomického softvéru, ERP systémov, e-shopových riešení a iné subjekty, ktoré potrebujú vytvárať, odosielať, prijímať, validovať, archivovať alebo technicky spracúvať elektronické faktúry vo formáte požadovanom právnymi predpismi Slovenskej republiky a pravidlami siete Peppol.</p>
<p>1.3. Služba eFakturuj slúži ako technické riešenie na výmenu elektronických faktúr a súvisiacich dátových dokumentov. Služba sama osebe nenahrádza účtovné, daňové, právne ani audítorské poradenstvo.</p>
<p>1.4. Používaním služby, registráciou účtu, aktiváciou API kľúča, podpisom objednávky, zmluvy alebo iným potvrdením objednávky zákazník potvrdzuje, že sa oboznámil s týmito VOP a súhlasí s nimi.</p>

<h2>2. Definície</h2>
<p>2.1. <strong>eFakturuj</strong> znamená službu poskytovanú spoločnosťou Efakturuj, s. r. o., ktorá umožňuje technickú prípravu, validáciu, konverziu, odosielanie, prijímanie, spracovanie, hlásenie a archiváciu elektronických faktúr a súvisiacich metadát.</p>
<p>2.2. <strong>Poskytovateľ</strong> znamená spoločnosť Efakturuj, s. r. o.</p>
<p>2.3. <strong>Zákazník</strong> alebo <strong>Používateľ</strong> znamená fyzickú osobu – podnikateľa, právnickú osobu alebo inú organizáciu, ktorá využíva službu eFakturuj na základe registrácie, objednávky, zmluvy alebo iného právneho titulu.</p>
<p>2.4. <strong>Koncový používateľ</strong> znamená osoba, ktorej zákazník umožní prístup do služby, najmä zamestnanec, člen tímu, účtovník, externý poradca alebo poverený zástupca.</p>
<p>2.5. <strong>Elektronická faktúra</strong> znamená faktúru vyhotovenú v štruktúrovanom elektronickom formáte, najmä XML/UBL 2.1/Peppol BIS, ktorý umožňuje automatizované spracovanie.</p>
<p>2.6. <strong>Peppol</strong> znamená európsku sieť a súbor pravidiel pre bezpečnú výmenu elektronických obchodných dokumentov.</p>
<p>2.7. <strong>Peppol BIS</strong> znamená štandardizovaný formát elektronických faktúr používaný v sieti Peppol, založený na európskej norme EN 16931 a technickom formáte UBL 2.1.</p>
<p>2.8. <strong>UBL</strong> znamená Universal Business Language, technický XML formát používaný na štruktúrovanú výmenu obchodných dokumentov.</p>
<p>2.9. <strong>Access Point / AP</strong> znamená technický prístupový bod do siete Peppol.</p>
<p>2.10. <strong>Digitálny poštár / doručovacia služba</strong> znamená službu, ktorá zabezpečuje doručovanie elektronických faktúr a súvisiacich dátových dokumentov medzi odosielateľom, príjemcom, sieťou Peppol a príslušnými orgánmi verejnej moci podľa platnej legislatívy.</p>
<p>2.11. <strong>Sprostredkovateľ doručovacej služby</strong> znamená subjekt, ktorý poskytuje zákazníkom služby doručovania elektronických faktúr vo vlastnom mene, prípadne prostredníctvom certifikovaného poskytovateľa doručovacej služby alebo v spolupráci s ním.</p>
<p>2.12. <strong>API</strong> znamená aplikačné programové rozhranie služby eFakturuj, ktoré umožňuje napojenie ERP, účtovných softvérov, e-shopov, portálov, mobilných aplikácií alebo iných systémov.</p>
<p>2.13. <strong>Sandbox</strong> znamená testovacie prostredie určené na vývoj, overenie integrácie a testovanie funkcionalít bez právnych účinkov produkčného odosielania.</p>
<p>2.14. <strong>White-label riešenie</strong> znamená poskytovanie služby eFakturuj partnerovi alebo integrátorovi tak, aby ju mohol sprístupniť svojim zákazníkom pod vlastnou značkou alebo v rámci vlastného systému.</p>
<p>2.15. <strong>Integrátor</strong> znamená zákazník alebo partner, ktorý integruje službu eFakturuj do svojho softvéru, ERP, účtovného systému, e-shopu, portálu alebo iného riešenia a sprístupňuje ju svojim klientom.</p>
<p>2.16. <strong>Dátový dokument</strong> znamená elektronická faktúra, dobropis, ťarchopis, metadáta, potvrdenie o doručení, stavová správa, technická odpoveď, hlásenie alebo iný súvisiaci elektronický dokument.</p>
<p>2.17. <strong>Auditný archív</strong> znamená technické uloženie elektronických faktúr, súvisiacich metadát, stavových správ, technických potvrdení a logov počas trvania služby alebo počas dohodnutej retenčnej doby.</p>

<h2>3. Predmet služby</h2>
<p>3.1. eFakturuj poskytuje najmä tieto funkcionality:</p>
<ul>
<li>a) vytvorenie alebo prijatie fakturačných dát od zákazníka,</li>
<li>b) konverziu fakturačných dát do požadovaného štruktúrovaného formátu, najmä UBL 2.1/Peppol BIS,</li>
<li>c) technickú validáciu elektronickej faktúry podľa dostupných validačných pravidiel,</li>
<li>d) odoslanie elektronickej faktúry cez sieť Peppol alebo iný podporovaný kanál,</li>
<li>e) prijímanie elektronických faktúr pre zákazníka,</li>
<li>f) doručovanie stavových správ a technických potvrdení,</li>
<li>g) hlásenie vybraných údajov Finančnej správe SR, ak je táto funkcionalita pre zákazníka aktivovaná a technicky dostupná,</li>
<li>h) archiváciu elektronických faktúr, metadát, stavových správ a technických logov,</li>
<li>i) poskytovanie API, dokumentácie, webhookov a integračných nástrojov,</li>
<li>j) poskytovanie sandboxu, testovacieho prostredia a vývojárskej podpory,</li>
<li>k) používateľskú konzolu pre vystavovanie, prijímanie a správu faktúr,</li>
<li>l) tímové prístupy, role a oprávnenia,</li>
<li>m) white-label riešenia pre partnerov a integrátorov,</li>
<li>n) ďalšie súvisiace služby podľa aktuálnej ponuky poskytovateľa.</li>
</ul>
<p>3.2. Presný rozsah služby závisí od vybraného balíka, individuálnej zmluvy, objednávky, aktivovaných modulov alebo technickej dokumentácie.</p>
<p>3.3. Poskytovateľ môže službu priebežne rozvíjať, meniť, dopĺňať alebo technicky upravovať, najmä z dôvodu legislatívnych zmien, zmien pravidiel Peppol, požiadaviek Finančnej správy SR, bezpečnosti, stability služby alebo zlepšovania používateľského zážitku.</p>
<p>3.4. Niektoré funkcionality môžu byť dostupné len v testovacom režime, pilotnej prevádzke, beta verzii alebo na základe osobitnej dohody.</p>

<h2>4. Registrácia a uzatvorenie zmluvy</h2>
<p>4.1. Zmluva medzi poskytovateľom a zákazníkom vzniká najmä:</p>
<ul>
<li>a) registráciou zákazníka v službe,</li>
<li>b) aktiváciou účtu alebo API kľúča,</li>
<li>c) odoslaním a potvrdením objednávky,</li>
<li>d) podpisom individuálnej zmluvy,</li>
<li>e) začatím používania služby po tom, čo bol zákazník oboznámený s týmito VOP.</li>
</ul>
<p>4.2. Zákazník je povinný pri registrácii uvádzať pravdivé, aktuálne a úplné údaje. Zákazník zodpovedá za správnosť identifikačných údajov, najmä obchodného mena, sídla, IČO, DIČ, IČ DPH, Peppol ID, bankového účtu, kontaktných osôb a fakturačných údajov.</p>
<p>4.3. Poskytovateľ je oprávnený overiť identitu zákazníka, jeho oprávnenie konať za spoločnosť a oprávnenie používať konkrétne identifikátory, najmä DIČ, IČ DPH, Peppol ID alebo iný elektronický identifikátor.</p>
<p>4.4. Poskytovateľ je oprávnený odmietnuť registráciu alebo aktiváciu služby, ak má dôvodné pochybnosti o totožnosti zákazníka, oprávnení konať, zákonnosti používania služby, bezpečnostnom riziku alebo ak by poskytovanie služby mohlo byť v rozpore s právnymi predpismi alebo pravidlami siete Peppol.</p>

<h2>5. Účet, oprávnenia a bezpečnosť</h2>
<p>5.1. Zákazník zodpovedá za správu svojho účtu, koncových používateľov, rolí a oprávnení.</p>
<p>5.2. Zákazník je povinný zabezpečiť, aby prístupové údaje, heslá, API kľúče, tokeny a iné autentifikačné prvky neboli sprístupnené neoprávneným osobám.</p>
<p>5.3. Ak zákazník zistí alebo má podozrenie na zneužitie účtu, únik hesla, API kľúča alebo neoprávnený prístup, je povinný bezodkladne informovať poskytovateľa.</p>
<p>5.4. Poskytovateľ môže dočasne obmedziť alebo pozastaviť prístup k účtu, ak existuje podozrenie na bezpečnostný incident, neoprávnené použitie, porušenie VOP, porušenie pravidiel Peppol, ohrozenie stability služby alebo práv tretích osôb.</p>

<h2>6. Práva a povinnosti zákazníka</h2>
<p>6.1. Zákazník je povinný používať službu v súlade s právnymi predpismi, týmito VOP, technickou dokumentáciou, pravidlami siete Peppol a pokynmi poskytovateľa.</p>
<p>6.2. Zákazník zodpovedá za:</p>
<ul>
<li>a) vecnú, účtovnú, daňovú a právnu správnosť faktúr,</li>
<li>b) správnosť údajov uvedených vo faktúrach,</li>
<li>c) existenciu právneho dôvodu na vystavenie faktúry,</li>
<li>d) správnosť sadzby DPH, oslobodenia od DPH, prenesenia daňovej povinnosti alebo iného daňového režimu,</li>
<li>e) správnosť identifikácie odberateľa a dodávateľa,</li>
<li>f) správnosť bankových údajov, variabilných symbolov a platobných údajov,</li>
<li>g) dodržanie lehôt na vystavenie, odoslanie, prijatie, zaúčtovanie a archiváciu faktúr,</li>
<li>h) oprávnenie spracúvať osobné údaje obsiahnuté vo faktúrach,</li>
<li>i) správnosť údajov zasielaných poskytovateľovi cez API alebo iný integračný kanál.</li>
</ul>
<p>6.3. Zákazník nesmie službu používať na:</p>
<ul>
<li>a) zasielanie fiktívnych, podvodných alebo neoprávnených faktúr,</li>
<li>b) porušovanie daňových, účtovných alebo iných právnych predpisov,</li>
<li>c) neoprávnené získavanie údajov tretích osôb,</li>
<li>d) narušenie bezpečnosti, stability alebo dostupnosti služby,</li>
<li>e) obchádzanie limitov, cenníka alebo technických obmedzení služby,</li>
<li>f) reverse engineering, neoprávnené kopírovanie alebo zneužitie API, dokumentácie alebo softvéru.</li>
</ul>
<p>6.4. Zákazník je povinný zabezpečiť, aby všetci jeho koncoví používatelia dodržiavali tieto VOP.</p>
<p>6.5. Ak zákazník vystupuje ako integrátor alebo white-label partner, zodpovedá za to, že jeho vlastní zákazníci budú riadne informovaní o používaní služby eFakturuj, o spracúvaní osobných údajov a o rozdelení zodpovednosti medzi integrátora, eFakturuj a koncového klienta.</p>

<h2>7. Práva a povinnosti poskytovateľa</h2>
<p>7.1. Poskytovateľ zabezpečuje technickú prevádzku služby eFakturuj s odbornou starostlivosťou.</p>
<p>7.2. Poskytovateľ zodpovedá najmä za:</p>
<ul>
<li>a) technické fungovanie služby v rozsahu dohodnutom so zákazníkom,</li>
<li>b) primeranú dostupnosť služby,</li>
<li>c) poskytovanie API, dokumentácie a technických rozhraní,</li>
<li>d) spracovanie dát zákazníka podľa technických pravidiel služby,</li>
<li>e) primerané bezpečnostné opatrenia,</li>
<li>f) odosielanie a prijímanie elektronických faktúr podľa dostupnosti siete Peppol a ďalších integrovaných systémov,</li>
<li>g) uchovávanie technických logov a auditných záznamov v rozsahu služby,</li>
<li>h) informovanie zákazníka o dôležitých zmenách služby.</li>
</ul>
<p>7.3. Poskytovateľ nezodpovedá za vecnú, účtovnú, daňovú ani právnu správnosť obsahu faktúr, ak tieto údaje dodal alebo potvrdil zákazník.</p>
<p>7.4. Poskytovateľ nezodpovedá za nesprávne údaje, ktoré zákazník odošle do služby, ani za následky spôsobené nesprávnym nastavením ERP, účtovného systému, e-shopu, API integrácie alebo oprávnení používateľov.</p>
<p>7.5. Poskytovateľ je oprávnený vykonať automatizovanú technickú validáciu faktúr. Validácia však neznamená potvrdenie daňovej, účtovnej alebo právnej správnosti faktúry.</p>
<p>7.6. Poskytovateľ môže odmietnuť technické odoslanie dokumentu, ak dokument nespĺňa technické požiadavky, validačné pravidlá, bezpečnostné pravidlá alebo ak existuje dôvodné podozrenie na zneužitie služby.</p>

<h2>8. Peppol, Finančná správa a externé systémy</h2>
<p>8.1. Zákazník berie na vedomie, že služba eFakturuj je závislá aj od dostupnosti a pravidiel tretích strán, najmä siete Peppol, certifikačných autorít, Finančnej správy SR, externých poskytovateľov infraštruktúry, účtovných softvérov, ERP systémov, e-shopových platforiem a bankových alebo platobných služieb.</p>
<p>8.2. Poskytovateľ nezodpovedá za výpadky, zmeny pravidiel, oneskorenia alebo technické obmedzenia spôsobené tretími stranami, ak ich nemohol ovplyvniť.</p>
<p>8.3. Ak dôjde k zmene legislatívy, technických špecifikácií, validačných pravidiel, Peppol požiadaviek alebo požiadaviek Finančnej správy SR, poskytovateľ je oprávnený službu primerane upraviť.</p>
<p>8.4. Ak je pre poskytovanie služby potrebná registrácia zákazníka, jeho identifikátora alebo iného údaja v systéme Peppol, SMP, v zozname sprostredkovateľov alebo v inom systéme, zákazník poskytne poskytovateľovi potrebnú súčinnosť.</p>

<h2>9. Ceny a platobné podmienky</h2>
<p>9.1. Cena služby sa riadi aktuálnym cenníkom zverejneným na webovej stránke www.efakturuj.sk, individuálnou ponukou alebo osobitnou zmluvou.</p>
<p>9.2. Ceny môžu byť stanovené najmä ako mesačný paušál, ročný paušál, cena za počet faktúr, cena za objem spracovaných dokumentov, cena za integráciu, cena za white-label riešenie, cena za podporu alebo kombinácia týchto modelov.</p>
<p>9.3. Ak cenník alebo zmluva neustanovuje inak, ceny sú uvedené bez DPH.</p>
<p>9.4. Zákazník je povinný uhrádzať cenu riadne a včas podľa vystavenej faktúry.</p>
<p>9.5. V prípade omeškania s úhradou je poskytovateľ oprávnený po predchádzajúcom upozornení obmedziť alebo pozastaviť poskytovanie služby.</p>
<p>9.6. Pozastavenie služby z dôvodu omeškania zákazníka nezbavuje zákazníka povinnosti uhradiť splatné záväzky.</p>
<p>9.7. Poskytovateľ môže meniť cenník. Pri podstatnej zmene ceny pre existujúceho zákazníka poskytovateľ oznámi zmenu vopred, spravidla aspoň 30 dní pred účinnosťou zmeny. Ak zákazník so zmenou nesúhlasí, môže zmluvu ukončiť ku dňu účinnosti zmeny, ak osobitná zmluva neustanovuje inak.</p>

<h2>10. Dostupnosť, SLA a údržba</h2>
<p>10.1. Poskytovateľ sa usiluje zabezpečiť vysokú dostupnosť služby. Konkrétna úroveň dostupnosti, reakčné doby podpory a servisné parametre môžu byť určené v cenníku, objednávke alebo individuálnej SLA.</p>
<p>10.2. Poskytovateľ môže vykonávať plánovanú údržbu, aktualizácie, bezpečnostné zásahy alebo technické zmeny služby.</p>
<p>10.3. Ak je to primerane možné, poskytovateľ oznámi plánovanú údržbu vopred.</p>
<p>10.4. Za nedostupnosť služby sa nepovažuje najmä:</p>
<ul>
<li>a) plánovaná údržba,</li>
<li>b) výpadok spôsobený zákazníkom alebo jeho systémami,</li>
<li>c) výpadok siete Peppol alebo systémov tretích strán,</li>
<li>d) výpadok internetu, hostingových, cloudových alebo telekomunikačných služieb mimo kontroly poskytovateľa,</li>
<li>e) zásah vyššej moci, kybernetický útok alebo bezpečnostný incident, ktorému nebolo možné primerane zabrániť.</li>
</ul>

<h2>11. Archivácia a uchovávanie dát</h2>
<p>11.1. Služba môže obsahovať auditný archív elektronických faktúr, metadát, stavových správ, technických potvrdení a logov.</p>
<p>11.2. Rozsah a doba uchovávania dát závisí od zákonných požiadaviek a technických nastavení služby.</p>
<p>11.3. Ak nie je dohodnuté inak, poskytovateľ uchováva dáta zákazníka počas trvania zmluvy a po jej ukončení počas primeranej technickej lehoty potrebnej na export, migráciu alebo vymazanie dát.</p>
<p>11.4. Zákazník je oprávnený požiadať o export svojich dát v technicky dostupnom formáte, ak tomu nebránia bezpečnostné, právne alebo technické dôvody.</p>

<h2>12. Integrácie, API a white-label</h2>
<p>12.1. Zákazník môže službu využívať prostredníctvom webovej aplikácie, API, ERP integrácie, e-shopového pluginu, mobilnej aplikácie alebo iného podporovaného rozhrania.</p>
<p>12.2. Pri používaní API je zákazník povinný dodržiavať technickú dokumentáciu, bezpečnostné pravidlá, limity a pokyny poskytovateľa.</p>
<p>12.3. Poskytovateľ môže zaviesť technické limity API, najmä limity počtu požiadaviek, objemu dát, veľkosti súborov, počtu používateľov, počtu tenantov alebo počtu spracovaných dokumentov.</p>
<p>12.4. Zákazník nesmie API používať spôsobom, ktorý ohrozuje stabilitu služby alebo obchádza dohodnutý obchodný model.</p>
<p>12.5. White-label alebo partnerské využitie služby je možné len na základe osobitnej dohody alebo zmluvy.</p>
<p>12.6. Integrátor zodpovedá za vlastný vzťah so svojimi klientmi, za správne informovanie klientov, za svoje obchodné podmienky, používateľskú podporu prvej úrovne, vlastnú cenotvorbu a za správnosť dát, ktoré do služby eFakturuj zasiela.</p>
<p>12.7. Ak integrátor vystupuje voči svojim klientom ako samostatný dodávateľ, musí zabezpečiť, aby jeho klienti boli riadne informovaní o tom, či eFakturuj vystupuje ako technický poskytovateľ, subdodávateľ, sprostredkovateľ alebo iná osoba zapojená do doručovania e-faktúr.</p>

<h2>13. Duševné vlastníctvo</h2>
<p>13.1. Služba eFakturuj, jej softvér, API, dokumentácia, dizajn, databázové štruktúry, know-how, obchodné označenia, logá a súvisiace materiály sú chránené právami duševného vlastníctva.</p>
<p>13.2. Zákazník získava nevýhradné, neprenosné a časovo obmedzené právo používať službu počas trvania zmluvy a len v rozsahu potrebnom na riadne využívanie služby.</p>
<p>13.3. Zákazník nesmie službu kopírovať, prenajímať, sublicencovať, spätne analyzovať, obchádzať jej technické obmedzenia ani vytvárať odvodené diela, ak to nie je výslovne povolené.</p>
<p>13.4. Zákazník zostáva vlastníkom dát a dokumentov, ktoré do služby vloží alebo ktoré prostredníctvom služby spracúva.</p>

<h2>14. Dôvernosť</h2>
<p>14.1. Zmluvné strany sú povinné zachovávať mlčanlivosť o dôverných informáciách druhej strany.</p>
<p>14.2. Za dôverné informácie sa považujú najmä obchodné, technické, finančné, daňové, účtovné, bezpečnostné, integračné a používateľské informácie, ktoré nie sú verejne dostupné.</p>
<p>14.3. Povinnosť mlčanlivosti sa nevzťahuje na informácie, ktoré:</p>
<ul>
<li>a) sú verejne dostupné bez porušenia povinnosti mlčanlivosti,</li>
<li>b) musia byť sprístupnené na základe zákona alebo rozhodnutia orgánu verejnej moci,</li>
<li>c) boli preukázateľne známe prijímajúcej strane pred ich poskytnutím,</li>
<li>d) boli získané od tretej osoby oprávnenej ich poskytnúť.</li>
</ul>

<h2>15. Ochrana osobných údajov</h2>
<p>15.1. Ochrana osobných údajov je upravená v dokumente „Informácie o spracúvaní osobných údajov“ a v Prílohe č. 1 týchto VOP – Zmluva o spracúvaní osobných údajov.</p>
<p>15.2. Pri spracúvaní obsahu faktúr zákazníka vystupuje poskytovateľ spravidla ako sprostredkovateľ v mene zákazníka, ktorý je prevádzkovateľom osobných údajov.</p>
<p>15.3. Pri spracúvaní údajov potrebných na vlastnú prevádzku služby, správu účtu, fakturáciu za službu, marketing, bezpečnosť a plnenie zákonných povinností vystupuje poskytovateľ ako samostatný prevádzkovateľ.</p>

<h2>16. Zodpovednosť za škodu</h2>
<p>16.1. Poskytovateľ zodpovedá za škodu spôsobenú porušením svojich povinností podľa právnych predpisov a zmluvy.</p>
<p>16.2. Poskytovateľ nezodpovedá za škodu spôsobenú:</p>
<ul>
<li>a) nesprávnymi, neúplnými alebo nepravdivými údajmi zákazníka,</li>
<li>b) daňovou, účtovnou alebo právnou nesprávnosťou faktúr,</li>
<li>c) oneskoreným odoslaním dát zákazníkom,</li>
<li>d) nesprávnym nastavením integrácie, účtu alebo oprávnení zákazníka,</li>
<li>e) výpadkom systémov tretích strán,</li>
<li>f) zásahom vyššej moci,</li>
<li>g) porušením povinností zákazníka,</li>
<li>h) používaním služby v rozpore s dokumentáciou alebo VOP.</li>
</ul>
<p>16.3. Ak nie je v individuálnej zmluve dohodnuté inak, celková zodpovednosť poskytovateľa za škodu voči zákazníkovi je obmedzená na sumu zaplatenú zákazníkom za službu za posledné 3 mesiace pred vznikom škody.</p>
<p>16.4. Obmedzenie zodpovednosti sa nevzťahuje na škodu spôsobenú úmyselne, na škodu spôsobenú hrubou nedbanlivosťou, ani na prípady, v ktorých obmedzenie zodpovednosti nepripúšťa zákon.</p>

<h2>17. Reklamácie a podpora</h2>
<p>17.1. Zákazník môže kontaktovať podporu poskytovateľa prostredníctvom e-mailu info@efakturuj.sk, používateľskej konzoly alebo iného komunikačného kanála určeného poskytovateľom.</p>
<p>17.2. Reklamácia alebo technický incident musí obsahovať dostatočný opis problému, identifikáciu zákazníka, čas výskytu, identifikátor dokumentu, chybové hlásenie a ďalšie dostupné informácie potrebné na preverenie problému.</p>
<p>17.3. Poskytovateľ vybavuje reklamácie a incidenty v primeranej lehote podľa závažnosti, dostupnosti informácií a zvoleného balíka podpory.</p>
<p>17.4. Poskytovateľ môže požadovať od zákazníka súčinnosť potrebnú na preverenie problému.</p>

<h2>18. Trvanie a ukončenie zmluvy</h2>
<p>18.1. Zmluva sa uzatvára na dobu neurčitú, ak z objednávky alebo individuálnej zmluvy nevyplýva inak.</p>
<p>18.2. Zákazník môže zmluvu ukončiť výpoveďou, zrušením predplatného alebo iným spôsobom uvedeným v objednávke, zmluve alebo používateľskej konzole.</p>
<p>18.3. Poskytovateľ môže zmluvu ukončiť výpoveďou s výpovednou lehotou 10 dní, ak nie je dohodnuté inak.</p>
<p>18.4. Poskytovateľ môže zmluvu ukončiť okamžite, ak zákazník:</p>
<ul>
<li>a) podstatne poruší VOP alebo zmluvu,</li>
<li>b) používa službu nezákonne alebo podvodne,</li>
<li>c) ohrozuje bezpečnosť alebo stabilitu služby,</li>
<li>d) je v omeškaní s úhradou dlhšie ako 15 dní po upozornení,</li>
<li>e) porušuje pravidlá Peppol alebo práva tretích osôb.</li>
</ul>
<p>18.5. Po ukončení zmluvy môže poskytovateľ obmedziť prístup zákazníka do služby. Zákazník má právo na export dát v primeranej lehote, ak tomu nebránia právne, bezpečnostné alebo technické dôvody.</p>
<p>18.6. Po uplynutí retenčnej lehoty je poskytovateľ oprávnený dáta zákazníka vymazať alebo anonymizovať, ak osobitný právny predpis alebo oprávnený záujem nevyžaduje ich ďalšie uchovanie.</p>

<h2>19. Zmeny VOP</h2>
<p>19.1. Poskytovateľ môže tieto VOP meniť najmä z dôvodu legislatívnych zmien, zmien služby, zmien pravidiel Peppol, zmien bezpečnostných požiadaviek, zmien cenníka alebo zlepšenia zmluvnej dokumentácie.</p>
<p>19.2. Podstatné zmeny VOP oznámi poskytovateľ zákazníkovi spravidla aspoň 30 dní vopred.</p>
<p>19.3. Ak zákazník s podstatnou zmenou nesúhlasí, môže zmluvu ukončiť ku dňu účinnosti zmeny.</p>
<p>19.4. Za podstatnú zmenu sa nepovažuje najmä oprava preklepov, spresnenie formulácií, doplnenie novej funkcionality bez negatívneho dopadu na zákazníka, zmena technickej dokumentácie alebo zmena vyvolaná legislatívou alebo pravidlami Peppol.</p>

<h2>20. Záverečné ustanovenia</h2>
<p>20.1. Tieto VOP sa riadia právnym poriadkom Slovenskej republiky.</p>
<p>20.2. Spory vzniknuté zo zmluvy alebo v súvislosti so službou sa zmluvné strany pokúsia riešiť prednostne dohodou.</p>
<p>20.3. Ak nedôjde k dohode, na riešenie sporov sú príslušné vecne a miestne príslušné súdy Slovenskej republiky.</p>
<p>20.4. Ak sa niektoré ustanovenie týchto VOP ukáže ako neplatné, neúčinné alebo nevymáhateľné, nemá to vplyv na platnosť ostatných ustanovení.</p>
<p>20.5. Neoddeliteľnou súčasťou týchto VOP je Príloha č. 1 – Zmluva o spracúvaní osobných údajov.</p>
<p>V Bratislave dňa 1.6.2026<br/>Dagmara Abia, konateľ eFakturuj, s.r.o.</p>
`.trim();

// ── Privacy (Informácie o spracúvaní osobných údajov) ───────────────────────
const PRIVACY_HTML = `
<p><strong>Prevádzkovateľ: Efakturuj, s. r. o.</strong><br/>
Sídlo: Fedinova 1083/16, 851 01 Bratislava – mestská časť Petržalka, Slovenská republika<br/>
IČO: 57546495<br/>
DIČ: 2122813913<br/>
E-mail pre ochranu osobných údajov: info@efakturuj.sk<br/>
Web: www.efakturuj.sk</p>
<p>Účinnosť od: 1.6.2026 &middot; Verzia: 1.0</p>

<h2>1. Úvod</h2>
<p>1.1. Spoločnosť Efakturuj, s. r. o. spracúva osobné údaje v súvislosti s prevádzkou webovej stránky www.efakturuj.sk, poskytovaním služby eFakturuj, komunikáciou so zákazníkmi, správou používateľských účtov, fakturáciou za služby, poskytovaním podpory, marketingom, bezpečnosťou a plnením zákonných povinností.</p>
<p>1.2. Tento dokument vysvetľuje, aké osobné údaje spracúvame, na aké účely, na akom právnom základe, ako dlho ich uchovávame, komu ich môžeme sprístupniť a aké práva majú dotknuté osoby.</p>
<p>1.3. Pri spracúvaní obsahu faktúr a dát zákazníka vystupujeme spravidla ako sprostredkovateľ v mene zákazníka. Pri spracúvaní údajov potrebných na vlastnú prevádzku služby vystupujeme ako samostatný prevádzkovateľ.</p>

<h2>2. Kedy vystupujeme ako prevádzkovateľ</h2>
<p>2.1. Ako prevádzkovateľ spracúvame osobné údaje najmä v týchto prípadoch:</p>
<ul>
<li>a) návšteva webovej stránky www.efakturuj.sk,</li>
<li>b) vyplnenie kontaktného formulára, žiadosť o demo alebo žiadosť o API kľúč,</li>
<li>c) registrácia zákazníckeho účtu,</li>
<li>d) správa zákazníckeho vzťahu,</li>
<li>e) fakturácia za naše služby,</li>
<li>f) poskytovanie zákazníckej a technickej podpory,</li>
<li>g) obchodná komunikácia a marketing,</li>
<li>h) evidencia zmluvných dokumentov,</li>
<li>i) ochrana právnych nárokov,</li>
<li>j) bezpečnosť služby a prevencia zneužitia.</li>
</ul>

<h2>3. Kedy vystupujeme ako sprostredkovateľ</h2>
<p>3.1. Ako sprostredkovateľ vystupujeme vtedy, keď v mene zákazníka technicky spracúvame osobné údaje obsiahnuté v elektronických faktúrach, metadátach, stavových správach, účtovných dátach alebo iných dátových dokumentoch zákazníka.</p>
<p>3.2. V takom prípade je zákazník prevádzkovateľom osobných údajov a zodpovedá za to, že má právny základ na spracúvanie osobných údajov obsiahnutých vo faktúrach a súvisiacich dokumentoch.</p>
<p>3.3. Podmienky spracúvania osobných údajov v mene zákazníka sú upravené v Zmluve o spracúvaní osobných údajov, ktorá tvorí prílohu VOP.</p>

<h2>4. Kategórie osobných údajov</h2>
<p>4.1. V závislosti od účelu môžeme spracúvať najmä tieto kategórie osobných údajov:</p>
<ul>
<li>a) identifikačné údaje: meno, priezvisko, pracovná pozícia, názov spoločnosti, IČO, DIČ, IČ DPH,</li>
<li>b) kontaktné údaje: e-mail, telefón, adresa sídla alebo miesta podnikania, korešpondenčná adresa,</li>
<li>c) prihlasovacie a používateľské údaje: používateľské meno, rola, oprávnenia, nastavenia účtu,</li>
<li>d) technické údaje: IP adresa, logy, identifikátory zariadení, informácie o prehliadači, API volania, tokeny, stavové správy,</li>
<li>e) fakturačné a platobné údaje: číslo faktúry, suma, dátum vystavenia, splatnosť, bankové spojenie, variabilný symbol,</li>
<li>f) údaje vo faktúrach: meno a priezvisko fyzickej osoby, adresa, identifikátory, transakčné údaje, IBAN, e-mail alebo telefón, ak sú uvedené vo faktúre,</li>
<li>g) komunikačné údaje: obsah e-mailov, správ, požiadaviek podpory a obchodnej komunikácie,</li>
<li>h) marketingové údaje: preferencie, súhlas so zasielaním noviniek, história komunikácie,</li>
<li>i) bezpečnostné údaje: záznamy o prístupe, pokusy o prihlásenie, incidenty, auditné záznamy.</li>
</ul>

<h2>5. Účely a právne základy spracúvania</h2>
<p><strong>5.1. Registrácia a správa účtu.</strong> Spracúvame údaje potrebné na vytvorenie, správu a zabezpečenie účtu. Právny základ: plnenie zmluvy alebo opatrenia pred uzatvorením zmluvy.</p>
<p><strong>5.2. Poskytovanie služby eFakturuj.</strong> Spracúvame údaje potrebné na technické vytvorenie, validáciu, odoslanie, prijatie, hlásenie a archiváciu elektronických faktúr. Právny základ: plnenie zmluvy; pri dátach zákazníka spracúvanie v mene zákazníka podľa čl. 28 GDPR.</p>
<p><strong>5.3. Fakturácia a účtovníctvo.</strong> Spracúvame údaje potrebné na vystavenie faktúr za naše služby, vedenie účtovníctva a plnenie daňových povinností. Právny základ: splnenie zákonnej povinnosti.</p>
<p><strong>5.4. Zákaznícka a technická podpora.</strong> Spracúvame údaje potrebné na vybavenie požiadaviek, riešenie incidentov a poskytovanie pomoci. Právny základ: plnenie zmluvy a oprávnený záujem.</p>
<p><strong>5.5. Bezpečnosť služby.</strong> Spracúvame technické logy, IP adresy, prístupy, incidenty a bezpečnostné záznamy na ochranu služby, dát a používateľov. Právny základ: oprávnený záujem na bezpečnosti a ochrane práv.</p>
<p><strong>5.6. Marketing a obchodná komunikácia.</strong> Spracúvame kontaktné údaje na zasielanie informácií o službe, novinkách, legislatívnych aktualitách alebo pozvánkach na webináre. Právny základ: súhlas alebo oprávnený záujem pri existujúcich obchodných kontaktoch, ak to umožňuje zákon.</p>
<p><strong>5.7. Ochrana právnych nárokov.</strong> Spracúvame údaje potrebné na preukazovanie, uplatňovanie alebo obhajobu právnych nárokov. Právny základ: oprávnený záujem.</p>
<p><strong>5.8. Plnenie zákonných povinností.</strong> Spracúvame údaje vyžadované právnymi predpismi, orgánmi verejnej moci alebo regulačnými pravidlami. Právny základ: splnenie zákonnej povinnosti.</p>

<h2>6. Príjemcovia osobných údajov</h2>
<p>6.1. Osobné údaje môžeme sprístupniť len v nevyhnutnom rozsahu týmto kategóriám príjemcov:</p>
<ul>
<li>a) poskytovatelia IT infraštruktúry, cloudu a hostingu,</li>
<li>b) poskytovatelia bezpečnostných, monitorovacích a analytických nástrojov,</li>
<li>c) poskytovatelia e-mailových, CRM a komunikačných služieb,</li>
<li>d) účtovní, daňoví, právni a audítorskí poradcovia,</li>
<li>e) poskytovatelia platobných a fakturačných služieb,</li>
<li>f) certifikovaní poskytovatelia doručovacej služby, Peppol Access Pointy alebo iní účastníci doručovacieho procesu,</li>
<li>g) Finančná správa SR alebo iné orgány verejnej moci, ak to vyžaduje zákon,</li>
<li>h) integrátori, ERP systémy, e-shopové platformy alebo partneri podľa nastavení zákazníka,</li>
<li>i) sub-sprostredkovatelia uvedení v aktuálnom zozname sub-sprostredkovateľov.</li>
</ul>

<h2>7. Prenosy osobných údajov mimo EÚ/EHP</h2>
<p>7.1. Osobné údaje spracúvame v rámci Európskej únie alebo Európskeho hospodárskeho priestoru.</p>

<h2>8. Doba uchovávania</h2>
<p>8.1. Osobné údaje uchovávame len počas doby potrebnej na konkrétny účel.</p>
<p>8.2. Orientačné doby uchovávania:</p>
<ul>
<li>a) údaje zákazníckeho účtu: počas trvania zmluvy a primeranú dobu po jej ukončení,</li>
<li>b) účtovné a daňové doklady: po dobu vyžadovanú právnymi predpismi,</li>
<li>c) technické logy: spravidla po dobu potrebnú na bezpečnosť, diagnostiku a audit,</li>
<li>d) podporná komunikácia: po dobu vybavenia požiadavky a primeranú dobu na ochranu právnych nárokov,</li>
<li>e) marketingové údaje: do odvolania súhlasu alebo vznesenia námietky,</li>
<li>f) údaje spracúvané v mene zákazníka: podľa zmluvy so zákazníkom a jeho pokynov.</li>
</ul>
<p>8.3. Po uplynutí retenčnej doby údaje vymažeme, anonymizujeme alebo archivujeme, ak je to potrebné na splnenie zákonnej povinnosti alebo ochranu právnych nárokov.</p>

<h2>9. Cookies a podobné technológie</h2>
<p>9.1. Webová stránka www.efakturuj.sk môže používať cookies a podobné technológie.</p>
<p>9.2. Cookies môžu byť:</p>
<ul>
<li>a) nevyhnutné – potrebné na fungovanie webovej stránky a služby,</li>
<li>b) analytické – pomáhajú zlepšovať web a službu,</li>
<li>c) marketingové – umožňujú merať a prispôsobovať marketingovú komunikáciu,</li>
<li>d) preferenčné – zapamätajú si používateľské nastavenia.</li>
</ul>
<p>9.3. Nevyhnutné cookies používame na základe oprávneného záujmu. Ostatné cookies používame len na základe súhlasu, ak to vyžaduje zákon.</p>
<p>9.4. Používateľ môže svoj súhlas s cookies kedykoľvek zmeniť alebo odvolať prostredníctvom cookie lišty alebo nastavení prehliadača.</p>

<h2>10. Bezpečnosť</h2>
<p>10.1. Prijímame primerané technické a organizačné opatrenia na ochranu osobných údajov pred neoprávneným prístupom, stratou, zneužitím, zničením alebo zmenou.</p>
<p>10.2. Medzi opatrenia môže patriť najmä:</p>
<ul>
<li>a) šifrovanie prenosu dát,</li>
<li>b) riadenie prístupov a používateľských rolí,</li>
<li>c) autentifikácia používateľov,</li>
<li>d) obmedzenie prístupu podľa potreby,</li>
<li>e) logovanie a monitoring,</li>
<li>f) zálohovanie,</li>
<li>g) bezpečnostné aktualizácie,</li>
<li>h) interné pravidlá prístupu k dátam,</li>
<li>i) zmluvné záväzky mlčanlivosti,</li>
<li>j) preverovanie a riadenie sub-sprostredkovateľov.</li>
</ul>

<h2>11. Práva dotknutých osôb</h2>
<p>11.1. Dotknutá osoba má podľa GDPR najmä tieto práva:</p>
<ul>
<li>a) právo na prístup k osobným údajom,</li>
<li>b) právo na opravu nepresných údajov,</li>
<li>c) právo na vymazanie údajov,</li>
<li>d) právo na obmedzenie spracúvania,</li>
<li>e) právo na prenosnosť údajov,</li>
<li>f) právo namietať proti spracúvaniu,</li>
<li>g) právo odvolať súhlas, ak je spracúvanie založené na súhlase,</li>
<li>h) právo podať návrh alebo sťažnosť dozornému orgánu.</li>
</ul>
<p>11.2. Žiadosť je možné zaslať na e-mail: info@efakturuj.sk.</p>
<p>11.3. Ak sa žiadosť týka osobných údajov obsiahnutých vo faktúrach zákazníka, pri ktorých vystupujeme ako sprostredkovateľ, žiadosť môže byť postúpená príslušnému zákazníkovi ako prevádzkovateľovi.</p>

<h2>12. Dozorný orgán</h2>
<p>12.1. Dotknutá osoba má právo obrátiť sa na dozorný orgán:</p>
<p>Úrad na ochranu osobných údajov Slovenskej republiky<br/>
Hraničná 12<br/>
820 07 Bratislava 27<br/>
Slovenská republika<br/>
Web: www.dataprotection.gov.sk</p>

<h2>13. Zmeny v úprave ochrany osobných údajov</h2>
<p>13.1. Tento dokument môžeme priebežne aktualizovať, najmä z dôvodu legislatívnych zmien, zmien služby, zmien sub-sprostredkovateľov alebo bezpečnostných opatrení.</p>
<p>13.2. Aktuálna verzia je vždy dostupná na webovej stránke www.efakturuj.sk.</p>
<p>V Bratislave dňa 1.6.2026<br/>Dagmara Abia, konateľ eFakturuj, s.r.o.</p>
`.trim();

// ── Company (Informácie o spoločnosti) ──────────────────────────────────────
const COMPANY_HTML = `
<p style="font-size:1.6rem;line-height:1.3;font-weight:600;letter-spacing:-0.01em;margin:0.5rem 0 1.75rem;">Najlepšia technológia je tá, ktorú nevidíte.</p>

<p>Elektronická fakturácia sa väčšine firiem predstavuje ako ďalšia povinnosť. My sme sa rozhodli spraviť z nej niečo neviditeľné – a vrátiť podnikateľom to najvzácnejšie, čo majú: <strong>čas a pokoj</strong>.</p>

<img src="https://www.efakturuj.sk/vinc/efakturuj-app-home-cut.png" alt="eFakturuj – prehľad faktúr" loading="lazy" style="width:100%;height:auto;border-radius:16px;margin:2rem 0;box-shadow:0 10px 40px rgba(0,0,0,0.08);" />

<h2>Naše poslanie</h2>
<p>eFakturuj postavili ľudia z Bratislavy. Nechceli sme len ďalší nástroj na faktúry. Chceli sme <strong>partnera pre každého podnikateľa</strong> – nech ste živnostník, e-shop, účtovník alebo dodávateľ softvéru.</p>
<p>eFakturuj stojí ticho medzi vašou firmou a štátom. Vy vystavíte faktúru – a je hotovo. Konverzia do formátu UBL 2.1 / Peppol BIS, kontrola slovenských pravidiel DPH, doručenie cez Peppol a potvrdenie pre Finančnú správu sa stanú samy. Žiadne ďalšie kroky. Žiadne výhovorky.</p>
<blockquote>Účtovníkov nevnímame ako zákazníkov. Vnímame ich ako partnerov.</blockquote>

<h2>Naša vízia</h2>
<p>Jeden nástroj nikdy nevyrieši potreby všetkých. Preto nestaviame nástroj – <strong>staviame platformu</strong>.</p>
<p>Chceme byť <strong>„Shopify pre elektronické faktúry“</strong>: otvorený ekosystém, kde spájame množstvo talentov, ktorí vytvárajú moduly, integrácie a riešenia – a celú túto silu dávame priamo do rúk podnikateľom. Tak ako Shopify otvoril e-commerce miliónom ľudí, eFakturuj chce otvoriť elektronickú fakturáciu každej firme na Slovensku.</p>
<p>Nie je to riešenie prispôsobené zo zahraničia. Je vybudované od nuly pre slovenské pravidlá – a navrhnuté tak, aby rástlo spolu s vašimi potrebami.</p>

<img src="https://www.efakturuj.sk/vinc/console-faktury.png" alt="eFakturuj – konzola a doručovanie faktúr" loading="lazy" style="width:100%;height:auto;border-radius:16px;margin:2rem 0;box-shadow:0 10px 40px rgba(0,0,0,0.08);" />

<h2>Náš tím</h2>
<p>Skúsenosti v práve, biznise, komunikácii a technológii – všetko pod jednou strechou.</p>

<img src="https://www.efakturuj.sk/team-photos/group.webp" alt="Tím eFakturuj" loading="lazy" style="width:100%;height:auto;border-radius:16px;margin:1.5rem 0 2rem;" />

<div style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin:0 0 1.5rem;">
<img src="https://www.efakturuj.sk/team-photos/dagmara.webp" alt="Dagmara Abia" loading="lazy" style="width:104px;height:104px;border-radius:9999px;object-fit:cover;" />
<img src="https://www.efakturuj.sk/team-photos/yiresse.webp" alt="Yiresse Abia" loading="lazy" style="width:104px;height:104px;border-radius:9999px;object-fit:cover;" />
<img src="https://www.efakturuj.sk/team-photos/nidal.webp" alt="Nidal Saleh" loading="lazy" style="width:104px;height:104px;border-radius:9999px;object-fit:cover;" />
<img src="https://www.efakturuj.sk/team-photos/michaela.webp" alt="Michaela Saleh" loading="lazy" style="width:104px;height:104px;border-radius:9999px;object-fit:cover;" />
<img src="https://www.efakturuj.sk/team-photos/gabriela.webp" alt="Gabriela Sojčáková" loading="lazy" style="width:104px;height:104px;border-radius:9999px;object-fit:cover;" />
</div>

<ul>
<li><strong>Mgr. Dagmara Abia, LL.M., M.Sc.</strong> – CEO. Vedie eFakturuj; korporátne právo pre medzinárodné firmy vstupujúce na trh CZ/SK.</li>
<li><strong>Yiresse Abia</strong> – CTO. 15 rokov budovania B2B platforiem vo veľkom, vrátane platformy VINC (300+ mil. € GMV, 20 000+ európskych firiem).</li>
<li><strong>Nidal Saleh, MBA</strong> – Stratégia. Takmer 20 rokov v projektovom riadení a veľkých IT transformáciách, najmä vo finančných službách.</li>
<li><strong>Michaela Saleh, Ph.Dr.</strong> – Komunikácia. Dve dekády v slovenských médiách, marketing a PR.</li>
<li><strong>Gabriela Sojčáková</strong> – Prevádzka &amp; partnerstvá. Riadi onboarding a sieť partnerov-účtovníkov.</li>
</ul>

<h2>Identifikačné údaje</h2>
<p><strong>Obchodné meno:</strong> Efakturuj, s. r. o.<br/>
<strong>Sídlo:</strong> Fedinova 1083/16, 851 01 Bratislava – mestská časť Petržalka, Slovenská republika<br/>
<strong>IČO:</strong> 57546495<br/>
<strong>DIČ:</strong> 2122813913</p>

<h2>Kontakt</h2>
<p><strong>E-mail:</strong> info@efakturuj.sk<br/>
<strong>Web:</strong> www.efakturuj.sk</p>
`.trim();

// ── Cookie Policy (Zásady používania súborov cookies) ───────────────────────
const COOKIES_HTML = `
<p><strong>Prevádzkovateľ: Efakturuj, s. r. o.</strong>, Fedinova 1083/16, 851 01 Bratislava – mestská časť Petržalka, IČO: 57546495, DIČ: 2122813913, e-mail: info@efakturuj.sk, web: www.efakturuj.sk.</p>
<p>Účinnosť od: 1.6.2026 &middot; Verzia: 1.0</p>

<h2>1. Úvod a rozsah</h2>
<p>1.1. Zásady obsiahnuté v tomto dokumente vysvetľujú, aké súbory cookies a podobné technológie používame na webe www.efakturuj.sk, na aké účely, na akom právnom základe, ako dlho ich uchovávame a ako môžete svoj súhlas udeliť, spravovať alebo odvolať.</p>
<p>1.2. Zásady dopĺňajú dokument „Informácie o spracúvaní osobných údajov“; v prípade, že cez cookies dochádza k spracúvaniu osobných údajov, uplatní sa aj uvedený dokument.</p>

<h2>2. Čo sú cookies a podobné technológie</h2>
<p>2.1. Cookies sú malé textové súbory, ktoré sa ukladajú vo vašom koncovom zariadení pri návšteve webu a umožňujú zapamätať si nastavenia a úkony, merať návštevnosť a zlepšovať web. Za podobné technológie sa považujú aj local storage, pixely (web beacons), SDK a podobné nástroje na ukladanie alebo získavanie informácií zo zariadenia.</p>
<p>2.2. Podľa pôvodu rozlišujeme cookies vlastné (first-party) a cookies tretích strán (third-party). Podľa trvania rozlišujeme relačné (session – zaniknú po zatvorení prehliadača) a trvalé (persistent – zostávajú po dohodnutú dobu).</p>

<h2>3. Právny rámec</h2>
<p>3.1. Používanie cookies upravuje § 109 ods. 8 zákona č. 452/2021 Z. z. o elektronických komunikáciách (ZEK), ktorým bola transponovaná smernica 2002/58/ES (ePrivacy), v spojení s Nariadením (EÚ) 2016/679 (GDPR) a zákonom č. 18/2018 Z. z.</p>
<p>3.2. Podľa § 109 ods. 8 ZEK je ukladanie alebo získavanie prístupu k informáciám v koncovom zariadení používateľa možné len s jeho preukázateľným súhlasom. Súhlas sa nevyžaduje pri cookies, ktorých jediným účelom je prenos správy cez sieť, alebo ktoré sú bezpodmienečne potrebné na poskytnutie služby informačnej spoločnosti, ktorú používateľ výslovne požaduje (nevyhnutné cookies).</p>
<p>3.3. Na preferenčné, analytické a marketingové cookies sa vyžaduje súhlas, ktorý musí spĺňať náležitosti podľa GDPR (čl. 4 bod 11 a čl. 7): slobodný, konkrétny, informovaný, jednoznačný, preukázateľný a odvolateľný.</p>
<p>3.4. Nad dodržiavaním pravidiel vykonávajú dohľad dva orgány: Úrad pre reguláciu elektronických komunikácií a poštových služieb (za porušenie ZEK) a Úrad na ochranu osobných údajov SR (za porušenie pravidiel ochrany osobných údajov).</p>

<h2>4. Kedy je cookie osobným údajom</h2>
<p>4.1. Cookie je osobným údajom vtedy, ak ho možno priradiť ku konkrétnej fyzickej osobe (napr. spojením s IP adresou alebo identifikátorom). V takom prípade sa na spracúvanie uplatní aj GDPR a dokument „Informácie o spracúvaní osobných údajov“.</p>

<h2>5. Kategórie cookies</h2>
<p>5.1. Podľa účelu používame nasledujúce kategórie:</p>
<table>
<thead><tr><th>Kategória</th><th>Účel</th><th>Právny základ</th><th>Typ</th><th>Doba (návrh)</th></tr></thead>
<tbody>
<tr><td>Nevyhnutné</td><td>Prihlásenie, bezpečnosť, 2FA overenie zariadenia, uloženie vášho súhlasu s cookies.</td><td>§ 109 ods. 8 ZEK – bez súhlasu (informačná povinnosť)</td><td>vlastné</td><td>12 m.</td></tr>
<tr><td>Funkčné</td><td>Zapamätanie vašich nastavení (jazyk, stav bočného panela).</td><td>§ 109 ods. 8 ZEK – nevyhnutné na poskytnutie vyžiadanej služby</td><td>vlastné</td><td>do 12 m.</td></tr>
</tbody>
</table>
<p><em>Pozn.: Analytické ani marketingové cookies aktuálne nepoužívame. Všetky cookies uvedené nižšie sú vlastné (first-party). Ak v budúcnosti nasadíme cookies vyžadujúce súhlas, aktivujú sa až po vašom predchádzajúcom súhlase a doplníme ich do týchto zásad.</em></p>

<h2>6. Konkrétny zoznam používaných cookies</h2>
<p>6.1. Aktuálne používame tieto cookies (zoznam sa môže meniť podľa nasadených nástrojov):</p>
<table>
<thead><tr><th>Názov</th><th>Poskytovateľ</th><th>Účel</th><th>Typ</th><th>Doba</th></tr></thead>
<tbody>
<tr><td>authjs.session-token (na HTTPS __Secure-authjs.session-token)</td><td>eFakturuj (vlastné)</td><td>Prihlásenie / bezpečnosť – udržanie prihlásenej relácie (nevyhnutné)</td><td>vlastné</td><td>relácia (do zatvorenia prehliadača)</td></tr>
<tr><td>ef_td</td><td>eFakturuj (vlastné)</td><td>Bezpečnosť – dôveryhodné zariadenie pre 2FA overenie</td><td>vlastné</td><td>30 dní</td></tr>
<tr><td>locale</td><td>eFakturuj (vlastné)</td><td>Funkčnosť – uloženie zvoleného jazyka (sk/en/cs)</td><td>vlastné</td><td>1 rok</td></tr>
<tr><td>sidebar_state</td><td>eFakturuj (vlastné)</td><td>Funkčnosť – stav bočného panela (rozbalený/zbalený)</td><td>vlastné</td><td>7 dní</td></tr>
<tr><td>cookie_consent</td><td>eFakturuj (vlastné)</td><td>Uloženie vášho súhlasu s cookies (nevyhnutné)</td><td>vlastné</td><td>1 rok</td></tr>
</tbody>
</table>

<h2>7. Cookies tretích strán a prenos mimo EÚ/EHP</h2>
<p>7.1. Aktuálne nepoužívame cookies tretích strán. Všetky cookies uvedené v čl. 6 sú vlastné (first-party) a prostredníctvom cookies neprenášame osobné údaje mimo EÚ/EHP.</p>
<p>7.2. Ak v budúcnosti nasadíme nástroj tretej strany (napr. analytiku), doplníme jeho údaje do čl. 6 a prípadný prenos mimo EÚ/EHP zabezpečíme podľa kapitoly V GDPR (napr. štandardné zmluvné doložky). Takéto cookies sa aktivujú až po vašom súhlase.</p>

<h2>8. Súhlas – ako ho získavame</h2>
<p>8.1. Keďže aktuálne používame iba nevyhnutné a funkčné (vlastné) cookies, súhlas sa zo zákona nevyžaduje a informačnú povinnosť plníme týmito zásadami. Ak nasadíme cookies vyžadujúce súhlas (analytické alebo marketingové), zobrazí sa cookie lišta a takéto cookies sa neuložia skôr, než na to udelíte súhlas.</p>
<p>8.2. Cookie lišta pri zobrazení spĺňa najmä tieto požiadavky:</p>
<ul>
<li>a) na prvej vrstve obsahuje rovnocenné tlačidlá „Prijať všetky“ a „Odmietnuť všetky“, ako aj možnosť „Nastavenia“;</li>
<li>b) súhlas sa udeľuje aktívnym úkonom; žiadne políčka nie sú vopred zaškrtnuté;</li>
<li>c) umožňuje udeliť súhlas granulárne pre jednotlivé kategórie (účely) osobitne;</li>
<li>d) neobsahuje klamlivý dizajn (napr. skrytý odkaz namiesto tlačidla na odmietnutie);</li>
<li>e) udelenie súhlasu vieme preukázať (uchovávame záznam o súhlase).</li>
</ul>

<h2>9. Odvolanie a zmena súhlasu</h2>
<p>9.1. Súhlas môžete kedykoľvek zmeniť alebo odvolať prostredníctvom odkazu „Nastavenia cookies“ na webe alebo v nastaveniach prehliadača. Odvolanie súhlasu nemá vplyv na zákonnosť spracúvania pred jeho odvolaním.</p>

<h2>10. Uchovávanie záznamu o súhlase</h2>
<p>10.1. Ak používame cookies vyžadujúce súhlas, záznam o vašom súhlase (rozsah, čas a spôsob udelenia) uchovávame na účely preukázania súladu; tento údaj je uložený v cookie cookie_consent. Súhlas platí spravidla najviac 12 mesiacov, po uplynutí si ho opätovne vyžiadame; ak návštevník súhlas neudelí, opätovne sa naň spýtame najskôr po 6 mesiacoch.</p>

<h2>11. Správa cookies v prehliadači a v zariadení</h2>
<p>11.1. Cookies môžete spravovať, blokovať alebo vymazať aj v nastaveniach prehliadača (Chrome, Firefox, Safari, Edge a i.). Návody poskytovateľov prehliadačov sú dostupné v ich podpore.</p>
<p>11.2. Niektoré prehliadače podporujú signál „Do Not Track“ alebo obdobné mechanizmy; na mobilných zariadeniach možno spravovať reklamné identifikátory v nastaveniach systému. Blokovanie nevyhnutných cookies môže obmedziť funkčnosť webu a služby.</p>

<h2>12. Zmeny zásad, kontakt a dozorné orgány</h2>
<p>12.1. Tieto zásady môžeme aktualizovať, najmä pri zmene nasadených nástrojov alebo legislatívy; aktuálna verzia je dostupná na www.efakturuj.sk. Akékoľvek dotazy môžete smerovať na: info@efakturuj.sk.</p>
<p>12.2. Dozorné orgány:</p>
<p>Úrad na ochranu osobných údajov SR, Galvaniho Business Centrum II, Galvaniho 7/B, Bratislava (https://dataprotection.gov.sk/sk/).<br/>
Úrad pre reguláciu elektronických komunikácií a poštových služieb, Továrenská 2580, 811 09 Bratislava (https://www.teleoff.gov.sk/).</p>
<p>V Bratislave dňa 1.6.2026<br/>Dagmara Abia, konateľ Efakturuj, s.r.o.</p>
`.trim();

const PAGES: PageUpdate[] = [
  {
    pageSlug: "terms",
    name: "Všeobecné obchodné podmienky",
    seo: {
      title: "Všeobecné obchodné podmienky",
      description: "Všeobecné obchodné podmienky služby eFakturuj (účinné od 1.6.2026, verzia 1.0).",
    },
    html: TERMS_HTML,
  },
  {
    pageSlug: "privacy",
    name: "Ochrana osobných údajov",
    seo: {
      title: "Ochrana osobných údajov",
      description:
        "Informácie o spracúvaní osobných údajov v službe eFakturuj (účinné od 1.6.2026, verzia 1.0).",
    },
    html: PRIVACY_HTML,
  },
  {
    pageSlug: "company",
    name: "Efakturuj, s. r. o.",
    seo: {
      title: "Efakturuj, s. r. o.",
      description: "Identifikačné a kontaktné údaje spoločnosti Efakturuj, s. r. o. — prevádzkovateľa služby eFakturuj.",
    },
    html: COMPANY_HTML,
  },
  {
    pageSlug: "cookies",
    name: "Zásady používania súborov cookies",
    seo: {
      title: "Zásady používania súborov cookies",
      description:
        "Aké cookies a podobné technológie používame na www.efakturuj.sk, na aké účely a ako spravovať súhlas (účinné od 1.6.2026, verzia 1.0).",
    },
    html: COOKIES_HTML,
  },
];

async function main() {
  const tenantDb = `vinc-${TENANT_ID}`;
  console.log(`[legal] tenantDb=${tenantDb} domain=${DOMAIN} APPLY=${APPLY}`);

  const portal = await getPortalByDomain(tenantDb, DOMAIN);
  if (!portal) throw new Error(`No active portal found for domain "${DOMAIN}" in ${tenantDb}`);
  const portalSlug = (portal as { slug: string }).slug;
  console.log(`[legal] portalSlug=${portalSlug}`);

  const { HomeTemplate } = await connectWithModels(tenantDb);
  const now = new Date().toISOString();

  const blocksFor = (html: string) => [
    { id: "b1", type: "content-rich-text", order: 0, config: { html }, metadata: {} },
  ];

  for (const page of PAGES) {
    const templateId = `b2b-${portalSlug}-page-${page.pageSlug}`;
    const doc = await HomeTemplate.findOne({ templateId });

    if (!doc) {
      console.log(`\n[legal] ${page.pageSlug}: NO template (${templateId}) — will CREATE.`);
      console.log(`         new title="${page.seo.title}" htmlChars=${page.html.length}`);
      if (!APPLY) continue;
      await HomeTemplate.create({
        templateId,
        name: page.name,
        version: 1,
        blocks: blocksFor(page.html),
        seo: page.seo,
        status: "published",
        label: "Version 1",
        createdAt: now,
        lastSavedAt: now,
        publishedAt: now,
        createdBy: "legal-migration",
        isCurrent: true,
        isCurrentPublished: true,
        isDefault: true,
        isActive: true,
      });
      console.log(`         CREATED + PUBLISHED.`);
      continue;
    }

    const current = (doc.blocks || []) as Array<{ type?: string; config?: { html?: string } }>;
    const currentHtml = current.map((b) => b.config?.html || "").join("");
    console.log(`\n[legal] ${page.pageSlug}: templateId=${templateId} status=${(doc as { status?: string }).status}`);
    console.log(`         current blocks=${current.length} htmlChars=${currentHtml.length}`);
    console.log(`         new title="${page.seo.title}" htmlChars=${page.html.length}`);

    if (!APPLY) continue;

    doc.set("blocks", blocksFor(page.html));
    doc.set("seo", page.seo);
    doc.set("status", "published");
    doc.set("publishedAt", now);
    doc.set("lastSavedAt", now);
    doc.set("isCurrentPublished", true);
    doc.set("isDefault", true);
    doc.markModified("blocks");
    doc.markModified("seo");
    await doc.save();
    console.log(`         APPLIED + PUBLISHED.`);
  }

  if (!APPLY) {
    console.log("\n[legal] DRY RUN — no write performed. Re-run with APPLY=1 to apply + publish.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[legal] FAILED:", err);
    process.exit(1);
  });
