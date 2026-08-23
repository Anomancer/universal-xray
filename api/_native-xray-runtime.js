import vm from 'node:vm';

let cachedByOrigin = new Map();

function normalizeOrigin(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsupported public origin protocol');
  return url.origin;
}

function requestOrigin(req) {
  const configured = process.env.BHC_XRAY_PUBLIC_ORIGIN;
  if (configured) return normalizeOrigin(configured);
  const host = String(req?.headers?.host || 'universal-xray.vercel.app').trim().toLowerCase();
  const proto = String(req?.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const isCanonical = host === 'universal-xray.vercel.app';
  const isVercelPreview = host.endsWith('.vercel.app') && host.includes('universal-xray');
  // Do not turn a caller-controlled Host header into an arbitrary server-side fetch target.
  // Custom domains can be enabled explicitly with BHC_XRAY_PUBLIC_ORIGIN.
  if (!isCanonical && !isVercelPreview) return 'https://universal-xray.vercel.app';
  return normalizeOrigin(`${proto}://${host}`);
}

export function analyzerFromScripts(patternLibraryCode, universalCoreCode) {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox, {
    name: 'bhc-universal-xray-native-node',
    codeGeneration: { strings: false, wasm: false }
  });
  new vm.Script(String(patternLibraryCode), { filename: 'pattern-library.js' }).runInContext(context, { timeout: 1200 });
  new vm.Script(String(universalCoreCode), { filename: 'universal-core.js' }).runInContext(context, { timeout: 1200 });
  const core = context.BHCUniversalCore;
  const patterns = context.BHCPatternLibrary;
  if (!core?.analyze || !core?.selfTest) throw new Error('BHCUniversalCore did not initialize');
  if (!patterns?.selfTest) throw new Error('BHCPatternLibrary did not initialize');
  return { core, patterns };
}

export async function loadNativeXRay(req, { fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch is required');
  const origin = requestOrigin(req);
  if (cachedByOrigin.has(origin)) return cachedByOrigin.get(origin);
  const loading = (async () => {
    const urls = [`${origin}/pattern-library.js`, `${origin}/universal-core.js`];
    const [patternRes, coreRes] = await Promise.all(urls.map(url => fetchImpl(url, {
      headers: { accept: 'application/javascript,text/javascript;q=0.9,*/*;q=0.1' },
      redirect: 'follow'
    })));
    if (!patternRes.ok) throw new Error(`Pattern Library HTTP ${patternRes.status}`);
    if (!coreRes.ok) throw new Error(`Universal Core HTTP ${coreRes.status}`);
    const [patternCode, coreCode] = await Promise.all([patternRes.text(), coreRes.text()]);
    const runtime = analyzerFromScripts(patternCode, coreCode);
    const selfTest = runtime.core.selfTest();
    if (!selfTest?.ok) throw new Error(`Universal X-Ray self-test failed: ${(selfTest?.problems || []).join(', ')}`);
    return {
      ...runtime,
      origin,
      versions: { universalCore: runtime.core.VERSION, patternLibrary: runtime.patterns.VERSION },
      selfTest,
      loadedAt: new Date().toISOString()
    };
  })();
  cachedByOrigin.set(origin, loading);
  try { return await loading; }
  catch (error) { cachedByOrigin.delete(origin); throw error; }
}

export function clearNativeXRayCache() { cachedByOrigin = new Map(); }
