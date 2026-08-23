(() => {
  'use strict';

  const VERSION = '1.0.0';
  const RULE_FORMAT = 'bhc-xray-friction-rules';
  const RULE_VERSION = 1;
  const TYPES = new Set(['domain','pattern','manual']);

  const clean = value => String(value ?? '').trim();
  const clamp = (n, a, b) => Math.max(a, Math.min(b, Number(n) || 0));
  const id = () => globalThis.crypto?.randomUUID?.() || `friction-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function normalizeRule(input = {}) {
    const rawTrigger = input.trigger && typeof input.trigger === 'object' ? input.trigger : {};
    const type = TYPES.has(rawTrigger.type) ? rawTrigger.type : 'manual';
    const value = type === 'domain' ? clean(rawTrigger.value).toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0] : clean(rawTrigger.value);
    return {
      id: clean(input.id) || id(),
      schemaVersion: RULE_VERSION,
      name: clean(input.name) || 'Nimetön kitkasääntö',
      enabled: input.enabled !== false,
      trigger: { type, value },
      delayMinutes: clamp(input.delayMinutes, 0, 120),
      prompt: clean(input.prompt),
      actions: {
        showJournal: !!input.actions?.showJournal,
        offerCalm: input.actions?.offerCalm !== false,
        requireConfirm: !!input.actions?.requireConfirm
      },
      createdAt: clean(input.createdAt) || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function hostFromUrl(url) {
    try { return new URL(url).hostname.toLowerCase().replace(/^www\./,''); }
    catch { return clean(url).toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0]; }
  }

  function domainMatches(host, ruleDomain) {
    const h = clean(host).toLowerCase().replace(/^www\./,'');
    const d = clean(ruleDomain).toLowerCase().replace(/^www\./,'');
    if (!h || !d) return false;
    return h === d || h.endsWith(`.${d}`);
  }

  function ruleMatches(rule, context = {}) {
    if (!rule?.enabled) return false;
    const type = rule.trigger?.type;
    if (type === 'manual') return !!context.manual;
    if (type === 'domain') return domainMatches(hostFromUrl(context.url || context.domain || ''), rule.trigger.value);
    if (type === 'pattern') return (context.patternIds || []).map(String).includes(String(rule.trigger.value));
    return false;
  }

  function evaluate(context = {}, rules = []) {
    const normalized = (Array.isArray(rules) ? rules : []).map(normalizeRule);
    const matches = normalized.filter(rule => ruleMatches(rule, context));
    const prompts = [...new Set(matches.map(x => x.prompt).filter(Boolean))];
    const delayMinutes = matches.reduce((max, x) => Math.max(max, Number(x.delayMinutes) || 0), 0);
    const actions = {
      showJournal: matches.some(x => x.actions.showJournal),
      offerCalm: matches.some(x => x.actions.offerCalm),
      requireConfirm: matches.some(x => x.actions.requireConfirm)
    };
    return {
      matched: matches.length > 0,
      matchedCount: matches.length,
      ruleIds: matches.map(x => x.id),
      rules: matches,
      delayMinutes,
      prompts,
      actions,
      context: {
        url: clean(context.url),
        domain: hostFromUrl(context.url || context.domain || ''),
        patternIds: [...new Set((context.patternIds || []).map(String))],
        manual: !!context.manual
      }
    };
  }

  function exportBundle(rules = []) {
    return {
      format: RULE_FORMAT,
      version: RULE_VERSION,
      exportedAt: new Date().toISOString(),
      rules: (Array.isArray(rules) ? rules : []).map(normalizeRule),
      note: 'Voluntary friction rules. No automatic browsing surveillance is implied by this file.'
    };
  }

  function importBundle(payload) {
    if (!payload || payload.format !== RULE_FORMAT || Number(payload.version) !== RULE_VERSION || !Array.isArray(payload.rules)) {
      throw new Error('Tuntematon Friction Rules -tiedostomuoto.');
    }
    return payload.rules.map(normalizeRule);
  }

  function selfTest() {
    const rules = [
      normalizeRule({ name:'Domain', trigger:{type:'domain',value:'example.com'}, delayMinutes:5 }),
      normalizeRule({ name:'Scarcity', trigger:{type:'pattern',value:'pressure.scarcity'}, delayMinutes:2 }),
      normalizeRule({ name:'Manual', trigger:{type:'manual'}, delayMinutes:1 })
    ];
    const a = evaluate({ url:'https://shop.example.com/item', patternIds:['pressure.scarcity'] }, rules);
    const b = evaluate({ url:'https://other.test', patternIds:[], manual:false }, rules);
    const c = evaluate({ manual:true }, rules);
    const problems = [];
    if (a.matchedCount !== 2 || a.delayMinutes !== 5) problems.push('domain+pattern merge failed');
    if (b.matched) problems.push('false positive context match');
    if (!c.matched || c.matchedCount !== 1) problems.push('manual trigger failed');
    if (!domainMatches('sub.example.com','example.com')) problems.push('subdomain match failed');
    return { ok: problems.length === 0, problems, version:VERSION, ruleFormat:RULE_FORMAT, ruleVersion:RULE_VERSION };
  }

  globalThis.BHCFrictionCore = Object.freeze({ VERSION, RULE_FORMAT, RULE_VERSION, normalizeRule, hostFromUrl, domainMatches, evaluate, exportBundle, importBundle, selfTest });
})();
