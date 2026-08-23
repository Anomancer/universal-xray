(() => {
  'use strict';

  const KEY = 'bhc_xray_language_v1';

  let language = 'fi';

  try {
    const stored = localStorage.getItem(KEY);
    language = stored === 'en' ? 'en' : 'fi';
  } catch (_) {}

  const FI_TO_EN = {
    'KIELI': 'LANGUAGE',

    'Etusivu': 'Home',
    'Analysoi': 'Analyse',
    'Tekstin röntgen': 'Text X-Ray',
    'Kuviokartasto': 'Pattern Atlas',
    'Selainröntgen': 'Browser X-Ray',
    'Pelit & markkinat': 'Games & Markets',
    'Kasinomatematiikka': 'Casino Mathematics',
    'Vedonlyönti': 'Betting',
    'Markkinat': 'Markets',
    'Oma toiminta': 'My Behaviour',
    'Toistuvat silmukat': 'Repeated Loops',
    'Impulssijarru': 'Impulse Breaker',
    'Kitkalaboratorio': 'Friction Lab',
    'Rauhoittumistila': 'Calm Room',
    'Omat havainnot': 'My Observations',
    'Päiväkirja': 'Journal',
    'Seuraukset': 'Outcomes',
    'Työkalut': 'Tools',
    'Varmuuskopio': 'Backup',
    'Asetukset': 'Settings',
    'Kaikki työkalut': 'All tools',

    'Tutki tekstiä': 'Analyse text',
    'Väitteet, oletukset, kehystys ja tarkistuskohdat.':
      'Claims, assumptions, framing and verification points.',
    'Kasino, vedonlyönti, markkinat ja hype.':
      'Casino mechanics, betting, markets and hype.',
    'Tutki omaa toimintaa': 'Explore your behaviour',
    'Silmukat, impulssit, kitka ja omat havainnot.':
      'Loops, impulses, friction and personal observations.',
    'Päiväkirja, seuraukset ja paikallinen aineisto.':
      'Journal, outcomes and locally stored observations.',

    'Näe mekanismi.': 'See the mechanism.',
    'Ota toimijuus takaisin.': 'Take agency back.',
    'Riippuvuussilmukat, uhkapelimatematiikka, markkinahype ja manipuloivat rakenteet samassa paikallisessa röntgenlaboratoriossa.':
      'Dependency loops, gambling mathematics, market hype and manipulative structures in one local X-Ray laboratory.',
    'Avaa Casino X-Ray': 'Open Casino X-Ray',
    'Skannaa rakenne': 'Scan structure',

    'Nolla analytiikkaa. Nolla ulkoista käyttäjädatan lähetystä.':
      'Zero analytics. Zero external transmission of user data.',
    'Laskenta, heuristiikat, Journal ja simulaatiot ajetaan tässä selainversiossa paikallisesti. Service Worker hakee vain saman originin sovellustiedostoja.':
      'Calculations, heuristics, the Journal and simulations run locally in this browser build. The Service Worker only retrieves application files from the same origin.',

    'Iho': 'Skin',
    'Valikko': 'Menu',
    'Sulje valikko': 'Close menu',
    'Kaikki': 'All',
    'Mittaus / laskenta / simulaatio': 'Measurement / calculation / simulation',

    'Iho pois kasinomatematiikasta.':
      'Strip the skin off casino mathematics.',
    'Synteettinen simulaattori näyttää odotusarvon ja satunnaisvaihtelun erikseen. Se ei mallinna tietyn kasinon peliä eikä ennusta seuraavaa kierrosta.':
      'The synthetic simulator separates expected value from random variation. It does not model a specific casino game or predict the next spin.',
    'RTP / EV -penkki': 'RTP / EV bench',
    'Panos / kierros (€)': 'Stake / spin (€)',
    'Kierrokset / ajo': 'Spins / run',
    'Rinnakkaiset ajot': 'Parallel runs',
    'Synteettinen volatiliteetti': 'Synthetic volatility',
    'Alkubudjetti (€)': 'Starting bankroll (€)',
    'Kierrosta / minuutti': 'Spins / minute',
    'Laskennallinen house edge': 'Calculated house edge',
    'Aja X-Ray -simulaatiot': 'Run X-Ray simulations',
    'Raaka rakenne': 'Raw structure',
    'Teoreettinen EV / ajo': 'Theoretical EV / run',
    'Mediaani netto': 'Median net',
    'Voitollisia ajoja': 'Profitable runs',
    'Budjetti olisi rikkoutunut': 'Bankroll would have broken',
    'Aika / ajo': 'Time / run',
    'Ei ajettu.': 'Not run.',

    'Kerroin on hinta. Puretaan mitä sen sisällä on.':
      'Odds are a price. Let us inspect what is inside.',
    'Overround näkyviin': 'Expose the overround',
    'Desimaalikertoimet samasta markkinasta': 'Decimal odds from the same market',
    'Laske rakenne': 'Calculate structure',
    'Kaikkien pitää osua.': 'Every leg must hit.',
    'Yhden jalan osumatodennäköisyys %': 'Single-leg hit probability %',
    'Jalkoja': 'Legs',
    'Laske yhdistelmä': 'Calculate accumulator',
    'Jättipotti ja sen todennäköisyys samaan ruutuun.':
      'Put the jackpot and its probability on the same screen.',
    'Lipun hinta €': 'Ticket price €',
    'Mahdollisia yhdistelmiä': 'Possible combinations',
    'Jackpot €': 'Jackpot €',
    'Muiden voittojen EV / lippu €': 'EV of other prizes / ticket €',
    'Laske jackpot-rakenne': 'Calculate jackpot structure',
    'Pooli ennen tarinaa.': 'Pool before narrative.',
    'Kokonaispooli €': 'Total pool €',
    'Takeout %': 'Takeout %',
    'Voittavan valinnan osuus poolista %': 'Winning selection share of pool %',
    'Esimerkkipanos €': 'Example stake €',
    'Laske pooli': 'Calculate pool',

    'Punainen ja vihreä kynttilä ovat menneen hinnan yhteenveto.':
      'A red or green candle is a summary of past price movement.',
    'Täysin synteettinen chartti': 'Fully synthetic chart',
    'Kynttilöitä': 'Candles',
    'Volatiliteetti % / askel': 'Volatility % / step',
    'Generoi random walk': 'Generate random walk',
    'Kolme vihreää. Entä seuraava?': 'Three green candles. What about the next one?',
    'Aja random-walk-null': 'Run random-walk null',
    'Treidi ei tapahdu tyhjiössä.': 'A trade does not happen in a vacuum.',
    'Pääoma €': 'Capital €',
    'Treidejä / päivä': 'Trades / day',
    'Päiviä': 'Days',
    'Laske kitka': 'Calculate friction',
    'Vipu suurentaa myös väärän suunnan.':
      'Leverage also magnifies movement in the wrong direction.',
    'Oma pääoma €': 'Equity €',
    'Vipu ×': 'Leverage ×',
    'Vastaliike %': 'Adverse move %',
    'Laske herkkyys': 'Calculate sensitivity',

    'Silmukka ensin. Sitten testataan toistuuko se.':
      'Map the loop first. Then test whether it repeats.',
    'Ilmiö': 'Phenomenon',
    'Triggeri': 'Trigger',
    'Toiminta': 'Action',
    'Välitön palkkio': 'Immediate reward',
    'Jälkivaikutus / kustannus': 'After-effect / cost',
    'Piirrä hypoteesi': 'Map hypothesis',
    'Mekanismi': 'Mechanism',
    'Siirrä Journaliin': 'Move to Journal',
    'Testaa omaa silmukkahypoteesia.': 'Test your loop hypothesis.',
    'Aja analyysi': 'Run analysis',
    'Avaa Journal': 'Open Journal',

    'Lisää päätöksen ja impulssin väliin tila.':
      'Create space between impulse and decision.',
    'Mitä tekisi mieli tehdä juuri nyt?': 'What do you feel like doing right now?',
    'Mikä vaihtoehto olisi 10 minuuttia myöhemmin edelleen mahdollinen?':
      'What alternative would still be available ten minutes from now?',
    'Viive': 'Delay',
    'Käynnistä viive': 'Start delay',
    'Ei aktiivista impulssia.': 'No active impulse.',
    'Keskeytä': 'Cancel',

    'Rakenna kitka ennen päätöstä.': 'Build friction before the decision.',
    'Uusi kitkasääntö': 'New friction rule',
    'Nimi': 'Name',
    'Laukaisin': 'Trigger',
    'Käsin': 'Manual',
    'Tarkistuskysymys': 'Check question',
    'Näytä Journal-yhteenveto': 'Show Journal summary',
    'Tarjoa Calm Room': 'Offer Calm Room',
    'Vaadi tietoinen vahvistus': 'Require conscious confirmation',
    'Tallenna kitkasääntö': 'Save friction rule',
    'Omat säännöt': 'My rules',
    'Ei vielä sääntöjä.': 'No rules yet.',
    'Vie JSON extensionille': 'Export JSON for extension',
    'Tuo JSON': 'Import JSON',
    'Testaa mitä tapahtuisi.': 'Test what would happen.',
    'Aja kitkatesti': 'Run friction test',
    'Manuaalinen laukaisu': 'Manual trigger',
    'Ei testiä vielä.': 'No test yet.',
    'Päätös on edelleen sinun.': 'The decision is still yours.',
    'Mitä huomaat nyt?': 'What do you notice now?',
    'Jatka päätökseen': 'Continue to decision',
    'Lopeta testi': 'End test',

    'Syötä teksti. Riisu väiteketju näkyviin.':
      'Paste text. Expose the claim chain.',
    'Linssi': 'Lens',
    'Yleinen X-Ray': 'General X-Ray',
    'Uutinen / politiikka': 'News / politics',
    'Guru / self-help': 'Guru / self-help',
    'Verkkokauppa / dark patterns': 'E-commerce / dark patterns',
    'Työelämä / pöhinäjargon': 'Work / corporate jargon',
    'Viestittely / ihmissuhde': 'Messaging / relationships',
    'AI / auktoriteettipuhe': 'AI / authority framing',
    'Terveys / biohacking': 'Health / biohacking',
    'Deitti-app / pyyhkäisy': 'Dating apps / swiping',
    'Tuottavuus / metatyö': 'Productivity / meta-work',
    'Sijoitus / hype': 'Investing / hype',
    'Analysoitava teksti': 'Text to analyse',
    'Liitä tähän teksti. Mitään ei lähetetä verkkoon.':
      'Paste text here. Nothing is sent to the network.',
    'Poista iho': 'Strip skin',
    'Tyhjennä': 'Clear',
    'Röntgen-tulos': 'X-Ray result',
    'Väitelauseita': 'Claims',
    'Tukiankkureita': 'Support anchors',
    'Logiikkasiltoja': 'Logic bridges',
    'Epävarmuuksia': 'Uncertainties',
    'Lauseita': 'Sentences',
    'Kysymyksiä': 'Questions',
    'Absoluuttikieltä': 'Absolute language',
    'Painehavaintoja': 'Pressure cues',
    'Syötä teksti ja aja skannaus.': 'Paste text and run a scan.',
    'Iho päällä / iho pois.': 'Skin on / skin off.',
    'Kopioi riisuttu rakenne': 'Copy stripped structure',
    'Vie JSON': 'Export JSON',
    'ALKUPERÄINEN': 'ORIGINAL',
    'RIISUTTU RAKENNE': 'STRIPPED STRUCTURE',
    'Ei analyysiä vielä.': 'No analysis yet.',
    'Väitteet': 'Claims',
    'Näkyvä tuki': 'Visible support',
    'Oletukset / logiikkasillat': 'Assumptions / logic bridges',
    'Kehystys / tunnekoukut': 'Framing / emotional hooks',
    'Kannustin / pyydetty toiminta': 'Incentive / requested action',
    'Mitä ei tiedetä': 'What is unknown',
    'Vastatesti': 'Counter-test',
    'Mihin johtopäätös nojaa?': 'What does the conclusion rest on?',

    'Toimijuuden DevTools selaimeen.': 'DevTools for agency in the browser.',
    'Ei pysyvää <all_urls>-lupaa.': 'No permanent <all_urls> permission.',
    'Mitä sivulla tapahtuu?': 'What happens on the page?',
    'Extension sisältyy release-kansioon.': 'The extension is included in the release.',
    'Lataa WebExtension ZIP': 'Download WebExtension ZIP',

    'Sama mekanismi, eri naamio.': 'Same mechanism, different mask.',
    'Hae': 'Search',
    'Perhe': 'Family',
    'Kaikki perheet': 'All families',
    'Patternien väliset rakenteelliset yhteydet':
      'Structural relationships between patterns',
    'Valitse mekanismi': 'Select a mechanism',
    'Klikkaa kartan solmua tai passport-korttia.':
      'Click a node on the map or a passport card.',

    'Kitka ei ole onnistuminen ennen kuin katsotaan mitä tapahtui.':
      'Friction is not success until we inspect what happened.',
    'Ei odottavaa kitkasessiota.': 'No pending friction session.',
    'Urge ennen 0–10': 'Urge before 0–10',
    'Urge jälkeen 0–10': 'Urge after 0–10',
    'Päätös': 'Decision',
    'Jälkikustannus 0–10': 'After-cost 0–10',
    'Muistiinpano': 'Note',
    'Tallenna outcome': 'Save outcome',
    'Kitkasäännöt': 'Friction rules',
    'Mekanismit': 'Mechanisms',
    'Paikallinen havaintoloki': 'Local observation log',
    'Poista kaikki': 'Delete all',

    'Kerää havainto ennen selitystä.': 'Collect the observation before the explanation.',
    'Päivä': 'Date',
    'Ei luokitusta': 'No category',
    'Urge / impulssi 0–10': 'Urge / impulse 0–10',
    'Mieliala 0–10': 'Mood 0–10',
    'Uni (h)': 'Sleep (h)',
    'Trigger-ryhmä': 'Trigger group',
    'Trigger / tapahtuma': 'Trigger / event',
    'Toteutuiko toiminta?': 'Did the action happen?',
    'Kyllä': 'Yes',
    'Ei': 'No',
    'Välitön palkkio 0–10': 'Immediate reward 0–10',
    'Välitön palkkio / helpotus': 'Immediate reward / relief',
    'Jälkivaikutus': 'After-effect',
    'Vapaa teksti': 'Free text',
    'Tallenna havainto': 'Save observation',
    'Ei vielä merkintöjä.': 'No entries yet.',

    'Ei palkintoa. Ei pisteitä. Ei feediä.':
      'No reward. No points. No feed.',
    'Sisään': 'Inhale',
    'Ulos': 'Exhale',
    'Pysäytä liike': 'Stop motion',
    'Käynnistä liike': 'Start motion',
    'Takaisin': 'Back',

    'Koko paikallinen tila. Yksi tiedosto.':
      'All local state. One file.',
    'Vie ja palauta': 'Export and restore',
    'Vie .bhcxray': 'Export .bhcxray',
    'Palauta .bhcxray': 'Restore .bhcxray',
    'Ei palautuksia tässä istunnossa.': 'No restores in this session.',
    'Poista paikallinen käyttäjädata': 'Delete local user data',
    'Poista kaikki paikallinen käyttäjädata': 'Delete all local user data',
    'Mitä tiedostoon menee?': 'What goes into the file?',

    'Paikallisen koneen asetukset.': 'Local system settings.',
    'Käyttöliittymä': 'Interface',
    'Vähennä liikettä': 'Reduce motion',
    'Tekninen iho oletuksena pois': 'Technical skin off by default',
    'Data & varmuuskopio': 'Data & backup',
    'Avaa System Vault': 'Open System Vault',

    'Avaa asetukset': 'Open settings',
    'Ei dataa': 'No data'
  };

  const TECH_TO_FI = {
    'X-RAY LENS': 'RÖNTGENLINSSI',
    'NAVIGATION': 'NAVIGOINTI',
    'CLOSE': 'SULJE',

    'NETWORK': 'VERKKO',
    'STORAGE': 'TALLENNUS',
    'MODULES': 'MODUULIT',
    'APP EGRESS': 'ULOSMENO',
    'LOCAL STATE': 'PAIKALLINEN TILA',
    'LAST CASINO RUN': 'VIIMEISIN KASINOAJO',
    'LAST X-RAY': 'VIIMEISIN RÖNTGEN',

    'SIMULATOR': 'SIMULAATTORI',
    'X-RAY OUTPUT': 'RÖNTGENTULOS',
    'LOSS DISGUISED AS WIN': 'TAPPIO VOITON VAATTEISSA',
    'SUNK COST': 'UPONNUT KUSTANNUS',
    'REALITY TRANSLATOR': 'TODELLISUUSKÄÄNNIN',

    'SPORTSBOOK MARGIN': 'VEDONLYÖNNIN MARGINAALI',
    'ACCUMULATOR': 'YHDISTELMÄVETO',
    'LOTTERY / JACKPOT': 'LOTTO / JACKPOT',
    'RACING / PARI-MUTUEL': 'RAVIT / PARI-MUTUEL',

    'CANDLE AUTOPSY': 'KYNTTILÄRUUMIINAVAUS',
    'PATTERN NULL LAB': 'NOLLAHYPOTEESILABRA',
    'COST DRAG': 'KULUKITKA',
    'LEVERAGE X-RAY': 'VIPURÖNTGEN',
    'TRADING HYPE AUTOPSY': 'TREIDAUSHYPEN RUUMIINAVAUS',

    'LOOP HYPOTHESIS': 'SILMUKKAHYPOTEESI',
    'JOURNAL CORRELATION BENCH': 'PÄIVÄKIRJAN YHTEYSANALYYSI',
    'FRICTION TIMER': 'KITKA-AJASTIN',
    'RULE BUILDER': 'SÄÄNTÖRAKENTAJA',
    'LOCAL RULESET': 'PAIKALLISET SÄÄNNÖT',
    'FRICTION SIMULATOR': 'KITKASIMULAATTORI',
    'ACTIVE FRICTION SESSION': 'AKTIIVINEN KITKASESSIO',
    'EXTENSION BRIDGE': 'LAAJENNUSSILTA',

    'UNIVERSAL X-RAY BENCH': 'YLEISRÖNTGEN',
    'BENCH OVERVIEW': 'YHTEENVETO',
    'SIDE-BY-SIDE SKIN MODE': 'RINNAKKAINEN IHONPOISTO',
    'CLAIM GRAPH': 'VÄITEVERKKO',

    'X-RAY INTERCEPT': 'SELAINRÖNTGEN',
    'PERMISSION SURFACE': 'KÄYTTÖOIKEUDET',
    'INSTALL / LOAD UNPACKED': 'ASENNUS / LATAA PAKKAAMATON',

    'PATTERN ATLAS': 'KUVIOKARTASTO',
    'MECHANISM MAP': 'MEKANISMIKARTTA',
    'PATTERN PASSPORT': 'KUVIOPASSI',

    'OUTCOME LAB': 'SEURAUSLABORATORIO',
    'OUTCOME SUMMARY': 'SEURAUSTEN YHTEENVETO',
    'DELAY COHORTS': 'VIIVERYHMÄT',
    'RULE COHORTS': 'SÄÄNTÖRYHMÄT',
    'PATTERN COHORTS': 'KUVIORYHMÄT',
    'OUTCOME LOG': 'SEURAUSLOKI',

    'YOUR DATA': 'OMA DATA',
    'CALM ROOM': 'RAUHOITTUMISTILA',
    'SYSTEM VAULT': 'VARMUUSKOPIO',
    'SYSTEM BACKUP': 'JÄRJESTELMÄVARMUUSKOPIO',
    'DATA LIFECYCLE': 'DATAN ELINKAARI',
    'BACKUP MANIFEST': 'VARMUUSKOPION SISÄLTÖ',
    'SETTINGS': 'ASETUKSET',

    'ENGINE ROOM': 'KONEHUONE',
    'MODULE REGISTRY': 'MODUULIREKISTERI',

    'MEASURED': 'MITATTU',
    'CALCULATED': 'LASKETTU',
    'SIMULATED': 'SIMULOITU',
    'USER-REPORTED': 'KÄYTTÄJÄN KIRJAAMA',
    'HEURISTIC': 'HEURISTINEN',
    'INTERPRETATION': 'TULKINTA',

    'READY': 'VALMIS',
    'LOCAL': 'PAIKALLINEN',
    'OFFLINE': 'OFFLINE',
    'ACTIVE TAB ONLY': 'VAIN AKTIIVINEN VÄLILEHTI',
    'NOT ACTIVE': 'EI KÄYTÖSSÄ'
  };

  const EN_PATTERNS = [
    [/^(\d+) merkintää$/, '$1 entries'],
    [/^(\d+) outcomea$/, '$1 outcomes'],
    [/^(\d+) sääntöä$/, '$1 rules'],
    [/^vielä (\d+) havaintoa/i, '$1 observations remaining'],
    [/^Viive (\d+) min$/, 'Delay $1 min'],
    [/^Odota (\d+) min$/, 'Wait $1 min'],
    [/^Urge (\d+(?:[.,]\d+)?)\/10$/, 'Urge $1/10'],
    [/^Mieliala (\d+(?:[.,]\d+)?)\/10$/, 'Mood $1/10'],
    [/^Uni (\d+(?:[.,]\d+)?) h$/, 'Sleep $1 h']
  ];

  function translateString(value) {
    if (!value) return value;

    const leading = value.match(/^\s*/)?.[0] || '';
    const trailing = value.match(/\s*$/)?.[0] || '';
    const text = value.trim();

    if (!text) return value;

    let translated = text;

    if (language === 'en') {
      translated = FI_TO_EN[text] || text;

      if (translated === text) {
        for (const [pattern, replacement] of EN_PATTERNS) {
          if (pattern.test(text)) {
            translated = text.replace(pattern, replacement);
            break;
          }
        }
      }
    } else {
      translated = TECH_TO_FI[text] || text;
    }

    return `${leading}${translated}${trailing}`;
  }

  function translateNode(node) {
    if (!node) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement;
      if (!parent) return;

      if (
        parent.closest('script, style, code, pre') ||
        parent.hasAttribute('data-no-i18n')
      ) return;

      node.nodeValue = translateString(node.nodeValue);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    if (node.matches('script, style, code, pre,[data-no-i18n]')) return;

    for (const attr of ['placeholder', 'title', 'aria-label']) {
      if (node.hasAttribute(attr)) {
        node.setAttribute(attr, translateString(node.getAttribute(attr)));
      }
    }

    node.childNodes.forEach(translateNode);
  }

  // Prevent translated option labels from changing application values.
  document.querySelectorAll('option:not([value])').forEach(option => {
    option.setAttribute('value', option.textContent.trim());
  });

  document.documentElement.lang = language;

  const select = document.getElementById('languageSelect');
  if (select) {
    select.value = language;

    select.addEventListener('change', event => {
      const next = event.target.value === 'en' ? 'en' : 'fi';

      try {
        localStorage.setItem(KEY, next);
      } catch (_) {}

      location.reload();
    });
  }

  translateNode(document.body);

  let translating = false;

  const observer = new MutationObserver(records => {
    if (translating) return;

    translating = true;

    try {
      for (const record of records) {
        if (record.type === 'characterData') {
          translateNode(record.target);
        }

        for (const node of record.addedNodes || []) {
          translateNode(node);
        }
      }
    } finally {
      translating = false;
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  window.BHC_I18N = Object.freeze({
    language: () => language,
    locale: () => language === 'en' ? 'en-GB' : 'fi-FI',
    t: translateString
  });
})();
