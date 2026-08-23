(() => {
  'use strict';

  const VERSION = '1.4.0';

  const LIB = globalThis.BHCPatternLibrary;
  if (!LIB) throw new Error('BHC Pattern Library missing');
  const { BASE_PATTERNS, LENS_PATTERNS, SUPPORT_PATTERNS, LOGIC_PATTERNS, INCENTIVE_PATTERNS, ABSOLUTE_RE, QUALIFIER_RE } = LIB.registry();

  function uniq(values) { return [...new Set(values.filter(Boolean))]; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function splitSentences(text) {
    const clean = String(text || '').replace(/\r/g, '').trim();
    if (!clean) return [];
    const parts = clean.split(/(?<=[.!?])(?:\s+|\n+)|\n{2,}/).map(s => s.trim()).filter(Boolean);
    return parts.length ? parts : [clean];
  }
  function matches(re, text) {
    const rx = new RegExp(re.source, re.flags);
    return [...String(text).matchAll(rx)].map(m => m[0]);
  }
  function sentenceKind(text) {
    if (/\?\s*$/.test(text)) return 'question';
    if (/^\s*[-•*]\s*/.test(text)) return 'bullet';
    return 'claim';
  }
  function claimConfidence(text) {
    let score = 0.45;
    if (/\b(on|ovat|oli|tulee|aiheuttaa|johtuu|tarkoittaa|is|are|was|will|causes?|means?)\b/i.test(text)) score += .18;
    if (/\d/.test(text)) score += .1;
    if (ABSOLUTE_RE.test(text)) score += .08;
    ABSOLUTE_RE.lastIndex = 0;
    if (QUALIFIER_RE.test(text)) score -= .04;
    QUALIFIER_RE.lastIndex = 0;
    return clamp(score, .2, .9);
  }

  function analyze(text, lens = 'general') {
    const source = String(text || '').trim();
    const sentences = splitSentences(source).map((sentence, index) => ({
      id:`s${index + 1}`,
      index,
      text:sentence,
      kind:sentenceKind(sentence)
    }));

    const patterns = [...BASE_PATTERNS, ...(LENS_PATTERNS[lens] || [])];
    const patternHits = [];
    for (const p of patterns) {
      const all = matches(p.re, source);
      if (!all.length) continue;
      const sentenceIds = sentences.filter(s => matches(p.re, s.text).length).map(s => s.id);
      patternHits.push({
        id:p.id, group:p.group, name:p.name, icon:p.icon, desc:p.desc,
        matches:uniq(all).slice(0, 8), count:all.length, score:p.weight * Math.min(4, all.length), sentenceIds
      });
    }

    const claims = sentences.filter(s => s.kind !== 'question' && s.text.length >= 8).slice(0, 40).map((s, idx) => ({
      id:`c${idx + 1}`,
      sentenceId:s.id,
      text:s.text,
      confidence:claimConfidence(s.text)
    }));

    const supports = [];
    for (const s of sentences) {
      for (const p of SUPPORT_PATTERNS) {
        const found = matches(p.re, s.text);
        if (found.length) supports.push({ id:`sup${supports.length + 1}`, sentenceId:s.id, kind:p.id, label:p.name, matches:uniq(found).slice(0,5), text:s.text });
      }
    }

    const assumptions = [];
    for (const s of sentences) {
      for (const p of LOGIC_PATTERNS) {
        if (p.re.test(s.text)) assumptions.push({ id:`a${assumptions.length + 1}`, sentenceId:s.id, kind:p.id, label:p.name, text:s.text, note:p.desc });
      }
    }

    const incentives = [];
    for (const s of sentences) {
      for (const p of INCENTIVE_PATTERNS) {
        if (p.re.test(s.text)) incentives.push({ id:`i${incentives.length + 1}`, sentenceId:s.id, kind:p.id, label:p.name, text:s.text, note:p.desc });
      }
    }

    const uncertainties = [];
    for (const claim of claims) {
      const supportFor = supports.filter(s => s.sentenceId === claim.sentenceId);
      const sentence = claim.text;
      const numeric = /\d|%|€|\beuro\b|\busd\b/i.test(sentence);
      const authority = /\b(tutkimus|asiantuntija|tutkija|data|raportti|experts?|scientists?|study|report|data)\b/i.test(sentence);
      const causal = assumptions.some(a => a.sentenceId === claim.sentenceId && a.kind === 'causal');
      const absolute = matches(ABSOLUTE_RE, sentence);
      if (numeric && !supportFor.some(s => s.kind === 'source' || s.kind === 'citation')) {
        uncertainties.push({ id:`u${uncertainties.length + 1}`, claimId:claim.id, sentenceId:claim.sentenceId, kind:'source-gap', label:'Numeroväite tarvitsee lähteen', note:'Tekstissä on numero tai määrä, mutta samassa lauseessa ei näy lähde- tai viiteankkuria.' });
      }
      if (authority && !supportFor.some(s => s.kind === 'citation')) {
        uncertainties.push({ id:`u${uncertainties.length + 1}`, claimId:claim.id, sentenceId:claim.sentenceId, kind:'authority-gap', label:'Auktoriteettiviittaus ilman näkyvää viitettä', note:'Auktoriteetti mainitaan, mutta tekstikatkelma ei itsessään mahdollista lähteen tarkistamista.' });
      }
      if (causal) {
        uncertainties.push({ id:`u${uncertainties.length + 1}`, claimId:claim.id, sentenceId:claim.sentenceId, kind:'causal-gap', label:'Kausaalinen yhteys tarvitsee erillisen näytön', note:'Samassa lauseessa oleva syy-seurausmuotoilu ei yksin osoita kausaliteettia.' });
      }
      if (absolute.length) {
        uncertainties.push({ id:`u${uncertainties.length + 1}`, claimId:claim.id, sentenceId:claim.sentenceId, kind:'absolute', label:'Absoluuttinen muotoilu', note:`Poikkeus riittäisi heikentämään muotoa: ${uniq(absolute).join(', ')}.` });
      }
    }

    const countercases = [];
    uncertainties.forEach(u => {
      let note = 'Mikä havainto pitäisi nähdä, jos väite olisi väärä tai vain osittain tosi?';
      if (u.kind === 'causal-gap') note = 'Vaihtoehtoinen selitys tai kolmas tekijä voi tuottaa saman havainnon. Teksti ei tässä erottele niitä.';
      if (u.kind === 'source-gap' || u.kind === 'authority-gap') note = 'Vahvin vastatesti on tarkistaa alkuperäinen lähde, otos, vertailuryhmä ja se, tukeeko lähde juuri tätä muotoilua.';
      if (u.kind === 'absolute') note = 'Yksi luotettava vastaesimerkki riittää osoittamaan, että absoluuttinen muoto on liian vahva.';
      countercases.push({ id:`cc${countercases.length + 1}`, claimId:u.claimId, sentenceId:u.sentenceId, label:'Vastatesti', note });
    });

    for (const hit of patternHits.filter(h => h.id === 'social')) {
      hit.sentenceIds.forEach(sentenceId => {
        const claim = claims.find(c => c.sentenceId === sentenceId);
        if (claim && !countercases.some(c => c.claimId === claim.id && c.note.includes('Suosio'))) {
          countercases.push({ id:`cc${countercases.length + 1}`, claimId:claim.id, sentenceId, label:'Vastatesti', note:'Suosio tai muiden toiminta ei yksin osoita väitteen paikkansapitävyyttä.' });
        }
      });
    }

    const frames = patternHits.filter(h => h.group === 'frame');
    const hooks = patternHits.filter(h => h.group === 'hook');
    const patternIncentives = patternHits.filter(h => h.group === 'incentive').map((h, idx) => ({ id:`pi${idx + 1}`, sentenceId:h.sentenceIds[0] || null, kind:h.id, label:h.name, text:h.matches.join(', '), note:h.desc }));
    const allIncentives = [...incentives, ...patternIncentives];

    const structure = {
      sentences: sentences.length,
      questions: sentences.filter(s => s.kind === 'question').length,
      claims: claims.length,
      absolutes: matches(ABSOLUTE_RE, source).length,
      qualifiers: matches(QUALIFIER_RE, source).length,
      pressureCues: patternHits.reduce((sum, h) => sum + h.count, 0)
    };

    const rawScore = patternHits.reduce((sum, h) => sum + h.score, 0);
    const score = Math.round(clamp(rawScore * 5, 0, 100));

    const graph = claims.slice(0, 10).map(claim => {
      const sentenceId = claim.sentenceId;
      const support = supports.filter(s => s.sentenceId === sentenceId).slice(0,2);
      const assumption = assumptions.filter(a => a.sentenceId === sentenceId).slice(0,2);
      const pressure = patternHits.filter(h => h.sentenceIds.includes(sentenceId)).slice(0,2);
      const uncertainty = uncertainties.filter(u => u.claimId === claim.id).slice(0,2);
      return { claim, support, assumption, pressure, uncertainty };
    });

    const stripped = buildStrippedView({ claims, supports, assumptions, frames, hooks, incentives:allIncentives, uncertainties, countercases });

    return {
      version: VERSION,
      lens,
      source,
      sentences,
      claims,
      supports,
      assumptions,
      frames,
      hooks,
      incentives: allIncentives,
      uncertainties,
      countercases,
      patternHits,
      graph,
      stripped,
      structure,
      score
    };
  }

  function buildStrippedView(result) {
    const lines = [];
    lines.push('VÄITTEET');
    if (!result.claims.length) lines.push('• Ei selviä väitelauseita tämän heuristiikan mukaan.');
    result.claims.slice(0,12).forEach(c => lines.push(`• ${c.text}`));
    lines.push('', 'NÄKYVÄ TUKI / ANKKURIT');
    if (!result.supports.length) lines.push('• Ei näkyviä numero-, lähde-, URL- tai lainausankkureita.');
    result.supports.slice(0,12).forEach(s => lines.push(`• ${s.label}: ${s.matches.join(', ')}`));
    lines.push('', 'LOGIIKKASILLAT / OLETUKSET');
    if (!result.assumptions.length) lines.push('• Ei tämän sanaston tunnistamia eksplisiittisiä logiikkasiltoja.');
    result.assumptions.slice(0,10).forEach(a => lines.push(`• ${a.label}: ${a.note}`));
    lines.push('', 'KEHYSTYS & TUNNEKOUKUT');
    const pressure = [...result.frames, ...result.hooks];
    if (!pressure.length) lines.push('• Ei osumia tämän heuristiikan paine-/kehystyssanastoilla.');
    pressure.slice(0,12).forEach(h => lines.push(`• ${h.name}: ${h.desc}`));
    lines.push('', 'KANNUSTIN / PYYDETTY TOIMINTA');
    if (!result.incentives.length) lines.push('• Ei selkeää toimintakehotetta tämän sanaston perusteella.');
    result.incentives.slice(0,10).forEach(i => lines.push(`• ${i.label}: ${i.note}`));
    lines.push('', 'MITÄ EI VOI PÄÄTELLÄ TÄSTÄ TEKSTISTÄ YKSIN');
    if (!result.uncertainties.length) lines.push('• Heuristiikka ei löytänyt erityistä aukkoa. Tämä ei todista väitteitä oikeiksi.');
    result.uncertainties.slice(0,12).forEach(u => lines.push(`• ${u.label}: ${u.note}`));
    lines.push('', 'VASTATESTI');
    if (!result.countercases.length) lines.push('• Kysy: mikä havainto pitäisi nähdä, jos pääväite olisi väärä?');
    result.countercases.slice(0,10).forEach(c => lines.push(`• ${c.note}`));
    return lines.join('\n');
  }

  function selfTest() {
    const sample = 'Vain 3 paikkaa jäljellä. Tutkimus todistaa 100 % varmasti, että tämä toimii, koska kaikki menestyjät tekevät näin. Osta nyt.';
    const out = analyze(sample, 'guru');
    const problems = [];
    if (!out.claims.length) problems.push('claim extraction empty');
    if (!out.patternHits.some(h => h.id === 'scarcity')) problems.push('scarcity not found');
    if (!out.patternHits.some(h => h.id === 'certainty')) problems.push('certainty not found');
    if (!out.assumptions.some(a => a.kind === 'causal')) problems.push('causal bridge not found');
    if (!out.incentives.some(i => i.kind === 'buy')) problems.push('purchase incentive not found');
    if (!out.uncertainties.length) problems.push('uncertainty layer empty');
    if (!out.graph.length) problems.push('graph empty');
    const libTest = LIB.selfTest();
    if (!libTest.ok) problems.push(...libTest.problems.map(p => `pattern library: ${p}`));
    return { ok: problems.length === 0, problems, sample: { claims:out.claims.length, patterns:out.patternHits.length, uncertainties:out.uncertainties.length }, patternLibrary: libTest };
  }

  window.BHCUniversalCore = Object.freeze({ VERSION, analyze, selfTest, splitSentences });
})();
