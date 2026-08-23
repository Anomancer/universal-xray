(() => {
  'use strict';

  const VERSION = '1.10.0';

  const BASE_PATTERNS = [
    { id:'urgency', group:'hook', name:'Kiire / aikapaine', icon:'⏱', weight:2, scope:['general','shopping','news','guru'], evidence:'heuristic', re:/\b(heti|nyt|tänään|viimeinen mahdollisuus|toimi nopeasti|ennen kuin|deadline|urgent|now|today|last chance|act fast)\b/gi, desc:'Teksti yrittää nopeuttaa päätöstä.' },
    { id:'scarcity', group:'hook', name:'Niukkuus', icon:'◒', weight:2, scope:['general','shopping','guru'], evidence:'heuristic', re:/\b(vain \d+|vain muutama|loppumassa|rajattu erä|paikkaa jäljellä|limited|only \d+|few left|selling out)\b/gi, desc:'Saatavuutta kuvataan niukkana tai katoavana.' },
    { id:'social', group:'frame', name:'Sosiaalinen todiste', icon:'≋', weight:1.5, scope:['general','shopping','news','dating','investing'], evidence:'heuristic', re:/\b(kaikki|tuhannet|miljoonat|suosituin|muutkin|\d+ muuta|everyone|thousands|millions|most popular|people are viewing)\b/gi, desc:'Päätöstä perustellaan muiden käyttäytymisellä.' },
    { id:'fear', group:'hook', name:'Pelko / uhka', icon:'⚠', weight:2, scope:['general','news','health','investing'], evidence:'heuristic', re:/\b(katastrofi|vaarallinen|uhka|menetät|pilaa|tuhoaa|pelottava|disaster|dangerous|threat|you will lose|destroy)\b/gi, desc:'Teksti nostaa uhkaa tai menetyksen tunnetta.' },
    { id:'certainty', group:'frame', name:'Ylivarma kieli', icon:'!', weight:1.2, scope:['general','guru','health','investing','ai'], evidence:'heuristic', re:/\b(aina|ei koskaan|varmasti|kiistatta|100 ?%|todistettu toimivaksi|taattu|always|never|guaranteed|undeniably|proven to work)\b/gi, desc:'Epävarmuutta häivytetään absoluuttisilla ilmaisuilla.' },
    { id:'authority', group:'frame', name:'Auktoriteettikehys', icon:'⌁', weight:1.2, scope:['general','news','health','ai','guru'], evidence:'heuristic', re:/\b(asiantuntijat sanovat|tutkijat todistivat|lääkärit eivät kerro|salattu tieto|experts say|scientists proved|doctors don.?t want|secret knowledge)\b/gi, desc:'Auktoriteettia käytetään väitteen painottamiseen ilman näkyvää näyttöä.' },
    { id:'guilt', group:'hook', name:'Syyllistävä paine', icon:'↯', weight:2, scope:['general','relationship','work'], evidence:'heuristic', re:/\b(jos oikeasti välittäisit|sinun pitäisi hävetä|oma vikasi|etkö muka|if you really cared|you should be ashamed|your fault)\b/gi, desc:'Teksti sitoo suostumisen moraaliseen arvoon tai syyllisyyteen.' },
    { id:'attack', group:'frame', name:'Henkilöhyökkäys', icon:'×', weight:1.8, scope:['general','news','relationship'], evidence:'heuristic', re:/\b(idiootti|tyhmä|säälittävä|luuseri|valehtelija|idiot|stupid|pathetic|loser|liar)\b/gi, desc:'Huomio siirtyy väitteestä henkilöön.' },
    { id:'sunk-cost-language', group:'frame', name:'Sunk cost -kieli', icon:'↘', weight:1.6, scope:['general','investing','relationship','productivity'], evidence:'heuristic', re:/\b(jo käyttänyt niin paljon|jo sijoittanut niin paljon|ei voi lopettaa nyt|liian pitkällä lopettaakseni|already spent so much|already invested so much|can.?t stop now|too far to quit)\b/gi, desc:'Jo syntynyttä kustannusta käytetään perusteluna jatkaa päätöstä.' }
  ];

  const LENS_PATTERNS = {
    shopping: [
      { id:'checkout', group:'incentive', name:'Ostopaine', icon:'$', weight:2, scope:['shopping'], evidence:'heuristic', re:/\b(osta nyt|lisää ostoskoriin|ilmainen toimitus vain|varaa heti|buy now|checkout now|free shipping only)\b/gi, desc:'Teksti työntää suoraan konversioon.' }
    ],
    guru: [
      { id:'funnel', group:'frame', name:'High-ticket / transformaatio', icon:'◇', weight:2, scope:['guru'], evidence:'heuristic', re:/\b(mastermind|transformaatio|läpimurto|salainen kaava|kuusinumeroinen|high.ticket|breakthrough|secret formula|six.figure)\b/gi, desc:'Tyypillistä transformaatio- ja funnel-sanastoa.' }
    ],
    work: [
      { id:'jargon', group:'frame', name:'Pöhinäjargon', icon:'⌘', weight:1.2, scope:['work'], evidence:'heuristic', re:/\b(näköalapaikka|dynaaminen|ketterä|joustava|rockstar|ninja|synergia|proaktiivinen|agile|dynamic|synergy|fast.paced)\b/gi, desc:'Abstrakti työelämäkieli voi peittää konkreettisia ehtoja.' }
    ],
    relationship: [
      { id:'relpressure', group:'hook', name:'Suhdepaine', icon:'∴', weight:2, scope:['relationship'], evidence:'heuristic', re:/\b(jos rakastaisit|kaiken mitä olen tehnyt|et koskaan välitä|aina teet näin|if you loved me|after all i.ve done|you never care)\b/gi, desc:'Teksti voi sitoa rajan tai suostumisen suhteen arvoon.' }
    ],
    news: [
      { id:'click', group:'hook', name:'Klikki-/raivokehys', icon:'⚡', weight:1.5, scope:['news'], evidence:'heuristic', re:/\b(jyrähtää|kohupaljastus|järkyttävä|et usko|katso kuvat|raivostuttaa|slams|shocking|you won.t believe|outrage)\b/gi, desc:'Otsikkomainen tunnekiihdytys.' }
    ],
    ai: [
      { id:'anthro', group:'frame', name:'AI-auktoriteetti / antropomorfismi', icon:'AI', weight:1.5, scope:['ai'], evidence:'heuristic', re:/\b(ai tietää|tekoäly ymmärtää varmasti|malli ei voi erehtyä|tietoinen tekoäly|ai knows|ai understands|cannot be wrong|conscious ai)\b/gi, desc:'Mallille annetaan enemmän varmuutta tai toimijuutta kuin teksti yksin perustelee.' }
    ],
    health: [
      { id:'healthclaim', group:'frame', name:'Terveyden pikaratkaisu', icon:'+', weight:1.8, scope:['health'], evidence:'heuristic', re:/\b(detox|ihmekuuri|parantaa kaiken|poistaa tulehduksen|boostaa immuniteettia|miracle cure|heals everything|boosts immunity)\b/gi, desc:'Terveyshyöty esitetään laajana tai varmana ilman näkyvää tutkimusasetelmaa.' }
    ],
    dating: [
      { id:'datingpressure', group:'hook', name:'Pyyhkäisy-/FOMO-kehys', icon:'♡', weight:1.4, scope:['dating'], evidence:'heuristic', re:/\b(match odottaa|uusi tykkäys|joku tykkäsi sinusta|älä missaa|your match is waiting|new like|someone likes you|don.t miss)\b/gi, desc:'Ilmoitus- tai puhekieli voi rakentaa sosiaalista FOMOa.' }
    ],
    productivity: [
      { id:'meta', group:'frame', name:'Metatyön kieli', icon:'↻', weight:1.2, scope:['productivity'], evidence:'heuristic', re:/\b(optimoida workflow|järjestelmän hienosäätö|second brain|ultimate productivity|täydellinen järjestelmä|optimize your workflow|perfect system)\b/gi, desc:'Huomio voi siirtyä työn tekemisestä työn järjestelmän jatkuvaan säätämiseen.' }
    ],
    investing: [
      { id:'hype', group:'hook', name:'Sijoitushype', icon:'↗', weight:2, scope:['investing'], evidence:'heuristic', re:/\b(to the moon|100x|riskitön tuotto|varma nousu|seuraava bitcoin|guaranteed return|next bitcoin|can.t lose|rug pull)\b/gi, desc:'Tuottoa tai nousua kehystetään poikkeuksellisen varmana tai rajattomana.' }
    ],
    betting: [
      { id:'odds-certainty', group:'hook', name:'Varma kohde / vihjevarmuus', icon:'✓', weight:2, scope:['betting'], evidence:'heuristic', re:/\b(varma kohde|varma veto|päivän pankki|pakko osua|sure bet|lock of the day|can.t miss|guaranteed pick|hot tip)\b/gi, desc:'Epävarma tapahtuma kehystetään poikkeuksellisen varmaksi.' },
      { id:'jackpot-salience', group:'hook', name:'Jackpot-salienssi', icon:'★', weight:1.6, scope:['betting'], evidence:'heuristic', re:/\b(jackpot|päävoitto|miljoonapotti|miljoonien potti|jättipotti|million jackpot|grand prize|life.changing jackpot)\b/gi, desc:'Huomio ankkuroidaan suuren päävoiton kokoon todennäköisyyden sijasta.' },
      { id:'accumulator-language', group:'frame', name:'Yhdistelmävedon kertautuminen', icon:'×', weight:1.4, scope:['betting'], evidence:'heuristic', re:/\b(moniveto|yhdistelmäveto|pitkä kuponki|accumulator|acca|parlay|multi.bet|same game parlay)\b/gi, desc:'Useita ehtoja niputetaan yhteen, jolloin kaikkien pitää toteutua.' },
      { id:'near-miss-language', group:'hook', name:'Melkein osui -kehys', icon:'≈', weight:1.5, scope:['betting'], evidence:'heuristic', re:/\b(melkein osui|yksi jalka petti|yksi kohde jäi|one leg away|almost hit|so close|near miss)\b/gi, desc:'Lähiosuma voi tuntua informatiivisemmalta kuin riippumaton lopputulos oikeuttaa.' }
    ],
    trading: [
      { id:'chart-hindsight', group:'frame', name:'Kynttiläkuvion jälkiviisaus', icon:'▥', weight:1.6, scope:['trading'], evidence:'heuristic', re:/\b(selvä breakout|selkeä breakout|obvious breakout|head and shoulders|pää ja hartiat|tuki piti|vastus murtui|support held|resistance broke|price action confirms)\b/gi, desc:'Jälkikäteen nimetty kuvio voi näyttää selvältä ilman osoitettua ennustearvoa.' },
      { id:'leverage-amplification', group:'hook', name:'Vipu / leverage', icon:'×', weight:1.8, scope:['trading'], evidence:'heuristic', re:/\b(vipu|vivulla|leverage|leveraged|\d{1,3}x\s*(?:vipu|leverage)?|margin trade|perpetuals?)\b/gi, desc:'Vipu moninkertaistaa sekä voiton että tappion herkkyyden hinnan liikkeelle.' },
      { id:'signal-selling', group:'incentive', name:'Signaali- / copy-trading-myynti', icon:'⌁', weight:1.7, scope:['trading'], evidence:'heuristic', re:/\b(trading signal|signaaliryhmä|vip signals?|copy trade|copy trading|seuraa treidejäni|follow my trades|entry signal|buy signal|sell signal)\b/gi, desc:'Päätös ulkoistetaan signaalille tai toiselle treidaajalle ilman näkyvää out-of-sample-näyttöä.' },
      { id:'candle-certainty', group:'frame', name:'Kynttilä = ennuste -kieli', icon:'▮', weight:1.5, scope:['trading'], evidence:'heuristic', re:/\b(kynttilä kertoo|chart says|chart kertoo|varma käänne|confirmed reversal|bullish candle means|bearish candle means|seuraavaksi nousee|seuraavaksi laskee)\b/gi, desc:'Menneen hinnan yhteenveto esitetään suoraan tulevan liikkeen ennusteena.' }
    ]
  };

  const SUPPORT_PATTERNS = [
    { id:'number', name:'Numerot / määrät', evidence:'measured', re:/(?:\b\d+(?:[.,]\d+)?\s?(?:%|€|eur|euroa|dollaria|usd|x|kertaa|vuotta|päivää|tuntia|minutes?|hours?|days?|years?)\b|\b\d{2,}\b)/gi },
    { id:'source', name:'Lähde- tai tutkimusviittaus', evidence:'measured', re:/\b(tutkimus|tutkimuksen mukaan|raportti|raportin mukaan|datan mukaan|lähde|meta-analyysi|satunnaistettu|study|according to|report|data shows|source|meta-analysis|randomi[sz]ed)\b/gi },
    { id:'citation', name:'Näkyvä URL / viite', evidence:'measured', re:/(https?:\/\/\S+|www\.\S+|\[[0-9]+\]|doi:\s*\S+)/gi },
    { id:'quote', name:'Suora lainausmerkki', evidence:'measured', re:/[“”"«»][^“”"«»]{4,}[“”"«»]/g }
  ];

  const LOGIC_PATTERNS = [
    { id:'causal', name:'Kausaalinen silta', evidence:'heuristic', re:/\b(koska|siksi|joten|johtuu|aiheuttaa|seurauksena|tämän vuoksi|because|therefore|causes?|results? in|due to)\b/i, desc:'Teksti yhdistää syyn ja seurauksen. Yhteyden vahvuus vaatii erillistä näyttöä.' },
    { id:'conditional', name:'Ehdollinen oletus', evidence:'heuristic', re:/\b(jos|mikäli|edellyttäen|if|provided that|assuming)\b/i, desc:'Johtopäätös nojaa eksplisiittiseen ehtoon tai oletukseen.' },
    { id:'necessity', name:'Pakko / normatiivinen silta', evidence:'heuristic', re:/\b(täytyy|pitää|on pakko|pitäisi|must|have to|should)\b/i, desc:'Teksti siirtyy kuvauksesta siihen, mitä pitäisi tehdä.' },
    { id:'meaning', name:'Tulkinnallinen silta', evidence:'heuristic', re:/\b(tämä tarkoittaa|siis|tästä seuraa|toisin sanoen|this means|therefore|in other words)\b/i, desc:'Teksti tekee tulkinnallisen siirtymän havainnosta johtopäätökseen.' }
  ];

  const INCENTIVE_PATTERNS = [
    { id:'buy', name:'Osto / konversio', evidence:'heuristic', re:/\b(osta|tilaa|varaa|liity|maksa|buy|order|book|subscribe|sign up)\b/i, desc:'Teksti pyytää rahallista tai rekisteröitymiseen liittyvää toimintaa.' },
    { id:'engage', name:'Huomio / sitoutuminen', evidence:'heuristic', re:/\b(klikkaa|jaa|seuraa|tykkää|kommentoi|katso|click|share|follow|like|comment|watch)\b/i, desc:'Teksti pyytää huomio- tai sitoutumistoimintoa.' },
    { id:'political', name:'Poliittinen toiminta', evidence:'heuristic', re:/\b(äänestä|kannata|allekirjoita|lahjoita|vote|support|sign the petition|donate)\b/i, desc:'Teksti pyytää poliittista tai järjestöllistä toimintaa.' },
    { id:'compliance', name:'Suostumus / myöntyminen', evidence:'heuristic', re:/\b(suostu|vastaa heti|todista että|myönnä|agree|reply now|prove that|admit)\b/i, desc:'Teksti pyytää välitöntä suostumusta tai myöntymistä.' }
  ];

  const ATLAS = [
    { id:'scarcity', name:'Artificial / Unverified Scarcity', family:'pressure', domains:['verkkokauppa','guru','tapahtumat'], detector:'text', related:['urgency','social','default-choice'], friction:['Poista aikapaine näkyvistä 5 minuutiksi.','Kysy: onko niukkuus todennettavissa tästä käyttöliittymästä?'], limit:'Detektori tunnistaa vain tekstikuvion, ei varaston todellista tilaa.', desc:'Niukkuutta käytetään päätöksenteon nopeuttamiseen.' },
    { id:'urgency', name:'Urgency / Countdown Pressure', family:'pressure', domains:['verkkokauppa','uutiset','funnelit'], detector:'text+dom', related:['scarcity','attention-capture'], friction:['Lisää 5–10 minuutin viive ennen päätöstä.','Kysy: muuttuisiko päätös jos kelloa ei olisi?'], limit:'Timer-tyyppinen DOM voidaan mitata, mutta aitoutta tai tarkoitusta ei voida päätellä siitä.', desc:'Aikapaine pienentää harkintaikkunaa.' },
    { id:'social', name:'Social Proof', family:'social', domains:['kauppa','deitti','sijoitus','some'], detector:'text', related:['scarcity','authority','variable-reward'], friction:['Piilota muiden määrä hetkeksi päätöksestä.','Kysy: mitä valitsisin ilman muiden käyttäytymistä?'], limit:'Suosio ei itsessään osoita väitteen paikkansapitävyyttä.', desc:'Muiden käyttäytymistä käytetään oman päätöksen perusteluna.' },
    { id:'sunk-cost-language', name:'Sunk Cost', family:'decision', domains:['rahapelaaminen','sijoitus','projekti','ihmissuhde'], detector:'text', related:['variable-reward'], friction:['Kysy päätös vain tulevien kustannusten ja hyötyjen perusteella.','Kirjaa jo menetetty resurssi erilliseen kenttään.'], limit:'Tekstihavainto ei kerro, onko jatkaminen kokonaisuutena järkevää.', desc:'Jo menetettyä resurssia käytetään perusteena jatkaa.' },
    { id:'variable-reward', name:'Variable Reward', family:'reinforcement', domains:['rahapelaaminen','some','deitti','mystery box'], detector:'atlas-only', related:['attention-capture','social','sunk-cost-language'], friction:['Aseta ennalta päätetty sessioraja.','Katkaise seuraavan palkkion odottaminen viiveellä.'], limit:'1.6 ei päättele reinforcement-schedulea pelkästä sivutekstistä.', desc:'Palkkio tulee vaihtelevasti ja ennakoimattomasti.' },
    { id:'authority', name:'Authority Framing', family:'credibility', domains:['terveys','AI','uutiset','guru'], detector:'text', related:['social'], friction:['Kysy mikä konkreettinen näyttö on näkyvissä ilman auktoriteettinimeä.'], limit:'Tekstiheuristiikka ei tarkista, onko auktoriteetti aito, pätevä tai relevantti.', desc:'Auktoriteetti toimii uskottavuusankkurina.' },
    { id:'default-choice', name:'Preselected / Default Choice', family:'interface', domains:['lomakkeet','tilaukset','suostumus'], detector:'dom', related:['scarcity','attention-capture'], friction:['Palauta valinta neutraaliksi ennen päätöstä.','Kysy mitä valitsisit jos mitään ei olisi esivalittu.'], limit:'Mittaus kertoo oletusvalinnasta, ei sen tarkoituksesta.', desc:'Valmiiksi valittu kontrolli muuttaa päätöksen lähtöasetelmaa.' },
    { id:'attention-capture', name:'Attention Capture', family:'interface', domains:['some','uutiset','kauppa'], detector:'atlas-only', related:['urgency','variable-reward','default-choice'], friction:['Vaihda hetkeksi Calm Roomiin tai poista animaatio.','Tee päätös staattisesta näkymästä.'], limit:'Atlas ei anna huomiomekanismeista yhtä manipulaatiopistemäärää.', desc:'Liike, kontrasti, ilmoitukset ja rytmi ohjaavat huomiota.' },
    { id:'overround-vig', name:'Overround / Vig', family:'pricing', domains:['pitkäveto','urheiluvedonlyönti','kertoimet'], detector:'atlas-only', related:['odds-certainty','accumulator-compounding'], friction:['Muunna kaikki saman markkinan kertoimet implisiittisiksi todennäköisyyksiksi ennen tulkintaa.','Katso summa ennen kuin kutsut kerrointa reiluksi hinnaksi.'], limit:'Overround kuvaa tarjottujen kertoimien hintamarginaalia, ei takaa yksittäisen vedon toteutuvaa tappioastetta.', desc:'Toisensa poissulkevien lopputulosten implisiittisten todennäköisyyksien summa voi ylittää 100 %.' },
    { id:'accumulator-compounding', name:'Accumulator / Parlay Compounding', family:'probability', domains:['pitkäveto','moniveto','same game parlay'], detector:'atlas-only', related:['overround-vig','near-miss-language','variable-reward'], friction:['Laske ensin kuinka nopeasti kaikkien ehtojen yhteistodennäköisyys pienenee.','Erottele iso kerroin ja korkea osumatodennäköisyys toisistaan.'], limit:'Yksinkertainen kertolasku olettaa riippumattomat ehdot; korreloituneet kohteet vaativat eri mallin.', desc:'Kun kaikkien jalkojen pitää osua, yhteistodennäköisyys kertautuu alaspäin.' },
    { id:'jackpot-salience', name:'Jackpot Salience', family:'attention', domains:['lotto','arvonta','jackpot'], detector:'text', related:['variable-reward','near-miss-language','attention-capture'], friction:['Näytä päävoiton koko ja päävoiton todennäköisyys samassa näkymässä.','Käännä lipun hinta odotusarvoksi ennen jättipotin katsomista.'], limit:'Päävoiton yksinkertainen EV voi yliarvioida arvoa, jos potti jaetaan usean voittajan kesken tai sääntöihin liittyy muita ehtoja.', desc:'Suuri päävoitto on psykologisesti näkyvä, vaikka sen todennäköisyys olisi hyvin pieni.' },
    { id:'pari-mutuel-takeout', name:'Pari-Mutuel Takeout', family:'pricing', domains:['ravit','poolivedot','totalisaattori'], detector:'atlas-only', related:['overround-vig','social'], friction:['Katso ensin poolista poistettava takeout ennen hevosten tarinaa.','Muista, että lopullinen payout riippuu myös siitä, kuinka paljon muut panostavat samaan lopputulokseen.'], limit:'Poolimalli ei yksin kerro yhden hevosen todellista voittotodennäköisyyttä.', desc:'Poolista poistetaan järjestäjän osuus ennen kuin jäljelle jäävä raha jaetaan voittaville panoksille.' },
    { id:'odds-certainty', name:'Certainty Framing in Betting', family:'credibility', domains:['vihjeet','pitkäveto','ravi'], detector:'text', related:['overround-vig','social','authority'], friction:['Korvaa sana “varma” numeerisella epävarmuudella.','Kysy mikä havainto erottaa vihjeen sattumasta pitkällä aikavälillä.'], limit:'Tekstihavainto kertoo varmuuskielestä, ei vihjeen todellisesta laadusta.', desc:'Epävarmaa lopputulosta myydään varmana, pankkina tai pakkona.' },
    { id:'near-miss-language', name:'Near-Miss Salience', family:'reinforcement', domains:['rahapelaaminen','moniveto','lotto'], detector:'text', related:['variable-reward','accumulator-compounding','jackpot-salience'], friction:['Kirjaa “melkein” erillään seuraavan yrityksen todennäköisyydestä.'], limit:'Lähiosuman tunne ei itsessään muuta riippumattoman seuraavan tapahtuman todennäköisyyttä.', desc:'Melkein onnistuminen voi lisätä kokemusta siitä, että onnistuminen oli “lähellä”.' },
    { id:'chart-hindsight', name:'Chart Hindsight / Pattern Apophenia', family:'inference', domains:['treidaus','kynttilät','tekninen analyysi'], detector:'text', related:['candle-certainty','volatility-salience','signal-selling'], friction:['Testaa sama kuvio sokkona tai synteettisessä random walkissa.','Vaadi out-of-sample-tulos kulujen jälkeen ennen kuin kutsut kuviota edgeksi.'], limit:'Kuvion löytyminen historiasta ei itsessään osoita ennustearvoa.', desc:'Ihminen löytää helposti merkityksellisiä muotoja myös satunnaisesta hintasarjasta.' },
    { id:'candle-certainty', name:'Candlestick Predictive Certainty', family:'inference', domains:['treidaus','kynttilät'], detector:'text', related:['chart-hindsight','volatility-salience'], friction:['Muista: OHLC kuvaa jo tapahtunutta hintaa.','Vertaa seuraavan kynttilän osumatarkkuutta baselineen.'], limit:'Kynttilä voi olla hyödyllinen tiivistelmä hinnasta ilman että se yksin ennustaa seuraavan liikkeen.', desc:'Menneen hintakynttilän muoto tulkitaan suoraan tulevan hinnan ennusteeksi.' },
    { id:'leverage-amplification', name:'Leverage Amplification', family:'risk', domains:['treidaus','futuurit','perpetualit'], detector:'text', related:['volatility-salience','sunk-cost-language'], friction:['Laske ensin kuinka pieni vastaliike syö oman pääoman annetulla vivulla.','Katso nimellisarvo ennen prosentuaalista tuottotavoitetta.'], limit:'Yksinkertainen vipulaskuri ei mallinna maintenance marginia, fundingia, gap-riskiä tai välittäjäkohtaisia likvidaatiokäytäntöjä.', desc:'Vipu kasvattaa position nimellisarvon suuremmaksi kuin oma pääoma ja moninkertaistaa hinnan liikkeen vaikutuksen omaan pääomaan.' },
    { id:'transaction-friction', name:'Spread / Fees / Slippage Drag', family:'pricing', domains:['treidaus','day trading','markkinat'], detector:'atlas-only', related:['signal-selling','chart-hindsight'], friction:['Laske strategian tulos aina kulujen jälkeen.','Kerro treidien määrä nimellisarvolla ennen kuin ajattelet “pientä” bps-kulua.'], limit:'Todellinen spread ja slippage vaihtelevat instrumentin, ajan, koon ja toteutuksen mukaan.', desc:'Pienet yksikkökulut kertautuvat, kun sama pääoma kierrätetään monta kertaa.' },
    { id:'signal-selling', name:'Signal Selling / Copy Trading', family:'credibility', domains:['treidaus','some','maksulliset ryhmät'], detector:'text', related:['social','authority','chart-hindsight','transaction-friction'], friction:['Kysy onko tulos out-of-sample ja kulujen jälkeen.','Erottele signaalin myyjän kannustin oman kaupankäynnin tuotosta.'], limit:'Signaalikielen tunnistus ei kerro myyjän todellista track recordia.', desc:'Päätöksenteko ulkoistetaan signaalille, vaikuttajalle tai kopioitavalle tilille.' },
    { id:'volatility-salience', name:'Volatility Salience', family:'attention', domains:['treidaus','crypto','markkinat'], detector:'atlas-only', related:['chart-hindsight','leverage-amplification','attention-capture'], friction:['Vaihda hetkeksi kynttilästä pidemmän aikavälin log-tuottoon tai prosenttiskaalaan.','Erota suuri liike ja ennustettava liike toisistaan.'], limit:'Volatiliteetti kertoo vaihtelun suuruudesta, ei suunnasta.', desc:'Suuret punaiset ja vihreät liikkeet tekevät satunnaisvaihtelusta visuaalisesti merkityksellisen tuntuista.' }
  ];

  const ABSOLUTE_RE = /\b(aina|ei koskaan|kaikki|kukaan ei|varmasti|kiistatta|100 ?%|taattu|always|never|everyone|no one|guaranteed|undeniably)\b/gi;
  const QUALIFIER_RE = /\b(ehkä|mahdollisesti|todennäköisesti|voi|saattaa|näyttää|viittaa|arviolta|perhaps|possibly|probably|may|might|suggests?|appears?)\b/gi;

  function cloneRegex(re) { return new RegExp(re.source, re.flags); }
  function matches(re, text) { return [...String(text || '').matchAll(cloneRegex(re))].map(m => m[0]); }
  function patternsFor(lens='general') { return [...BASE_PATTERNS, ...(LENS_PATTERNS[lens] || [])]; }
  function scanText(text, lens='general') {
    return patternsFor(lens).map(p => {
      const found = matches(p.re, text);
      return found.length ? { id:p.id, name:p.name, group:p.group, icon:p.icon, evidence:p.evidence || 'heuristic', count:found.length, matches:[...new Set(found)].slice(0,8), desc:p.desc } : null;
    }).filter(Boolean);
  }
  function passport(id) { return ATLAS.find(x => x.id === id) || null; }
  function graph() {
    const nodes = ATLAS.map(x => ({ id:x.id, name:x.name, family:x.family, detector:x.detector, domains:[...x.domains] }));
    const edgeMap = new Map();
    const addEdge = (a,b,reason,weight=1) => { if(!a||!b||a===b)return; const [x,y]=[a,b].sort(); const key=`${x}::${y}`; const prev=edgeMap.get(key)||{source:x,target:y,reasons:[],weight:0}; if(!prev.reasons.includes(reason))prev.reasons.push(reason); prev.weight=Math.max(prev.weight,weight); edgeMap.set(key,prev); };
    ATLAS.forEach(item => (item.related||[]).forEach(id => addEdge(item.id,id,'related',3)));
    for(let i=0;i<ATLAS.length;i++) for(let j=i+1;j<ATLAS.length;j++) {
      const shared=ATLAS[i].domains.filter(d=>ATLAS[j].domains.includes(d));
      if(shared.length) addEdge(ATLAS[i].id,ATLAS[j].id,`shared domain: ${shared.join(', ')}`,1+shared.length);
      if(ATLAS[i].family===ATLAS[j].family) addEdge(ATLAS[i].id,ATLAS[j].id,`family: ${ATLAS[i].family}`,2);
    }
    return { nodes, edges:[...edgeMap.values()] };
  }
  function registry() { return { BASE_PATTERNS, LENS_PATTERNS, SUPPORT_PATTERNS, LOGIC_PATTERNS, INCENTIVE_PATTERNS, ABSOLUTE_RE, QUALIFIER_RE, ATLAS }; }
  function manifest() {
    const scan = [...BASE_PATTERNS, ...Object.values(LENS_PATTERNS).flat()];
    return {
      version:VERSION,
      scanPatterns:scan.map(p => ({ id:p.id, name:p.name, group:p.group, scope:p.scope || [], evidence:p.evidence || 'heuristic', description:p.desc })),
      supportPatterns:SUPPORT_PATTERNS.map(p => ({ id:p.id, name:p.name, evidence:p.evidence })),
      logicPatterns:LOGIC_PATTERNS.map(p => ({ id:p.id, name:p.name, evidence:p.evidence, description:p.desc })),
      incentivePatterns:INCENTIVE_PATTERNS.map(p => ({ id:p.id, name:p.name, evidence:p.evidence, description:p.desc })),
      atlas:ATLAS.map(x => ({...x})),
      graph:graph()
    };
  }
  function selfTest() {
    const out = scanText('Vain 2 jäljellä. Osta nyt. Kaikki muutkin valitsivat tämän.', 'shopping');
    const ids = new Set(out.map(x => x.id));
    const problems=[];
    if (!ids.has('scarcity')) problems.push('scarcity missing');
    if (!ids.has('checkout')) problems.push('checkout missing');
    if (!ids.has('social')) problems.push('social proof missing');
    const duplicateIds = manifest().scanPatterns.map(x=>x.id).filter((id,i,a)=>a.indexOf(id)!==i);
    if (duplicateIds.length) problems.push(`duplicate scan ids: ${[...new Set(duplicateIds)].join(', ')}`);
    const g=graph(); if(g.nodes.length!==ATLAS.length || !g.edges.length) problems.push('atlas graph failed');
    if(ATLAS.some(x=>!x.limit || !Array.isArray(x.friction))) problems.push('passport metadata incomplete');
    return { ok:problems.length===0, problems, atlasCount:ATLAS.length, scanCount:manifest().scanPatterns.length, edgeCount:g.edges.length };
  }

  globalThis.BHCPatternLibrary = Object.freeze({ VERSION, registry, patternsFor, scanText, passport, graph, manifest, selfTest, matches });
})();
