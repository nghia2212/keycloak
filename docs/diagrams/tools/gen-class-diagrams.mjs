// Generates Archify class-diagram candidates (docs/diagrams/class-diagram/<module>.class.json) for
// Maven modules by scanning their src/main/java sources. Each diagram shows the most-referenced
// public types of the module, their inheritance and the dependencies between them.
//
// Usage: node docs/diagrams/tools/gen-class-diagrams.mjs [module ...]   (default: every module in MODULES)
// Then render each with: archify finalize class <json> <html> --repo-root . --quality showcase
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT = 'docs/diagrams/class-diagram';
const MAX_TYPES = 14;
const MAX_EDGES = 20;
const MAX_CHILDREN = 3;
// Modules whose 4-column layout exceeds Archify's desktop-readability width use 3 columns.
// CLASS_COLS / TYPE_MAX_W override this for experiments.
const NARROW = new Set(['adapters/saml', 'crypto/default', 'crypto/elytron', 'federation/kerberos', 'model/storage-private',
  'model/storage', 'operator', 'rest/admin-ui-ext', 'scim/model', 'server-spi-private', 'ssf/core']);
let COLS = 4;
const TYPE_MAX_W = process.env.TYPE_MAX_W ? Number(process.env.TYPE_MAX_W) : undefined;

// module dir -> extra source roots below it (default: the module dir itself)
export const MODULES = [
  'core', 'crypto/default', 'crypto/elytron', 'crypto/fips1402', 'util/embedded-ldap',
  'server-spi', 'server-spi-private', 'services',
  'model/infinispan', 'model/jpa', 'model/storage', 'model/storage-private', 'model/storage-services',
  'federation/ipatuura', 'federation/kerberos', 'federation/ldap', 'federation/sssd',
  'rest/admin-ui-ext', 'rest/admin-v2', 'authz/client', 'authz/policy',
  'saml-core-api', 'saml-core', 'scim/client', 'scim/core', 'scim/model', 'scim/services',
  'ssf/core', 'ssf/services', 'ssf/transmitter', 'authzen/services',
  'quarkus/config-api', 'quarkus/deployment', 'quarkus/runtime', 'operator',
  'integration/admin-client', 'integration/admin-client-core', 'integration/admin-client-jackson3',
  'integration/client-cli', 'integration/client-registration', 'adapters/saml', 'adapters/spi',
];

// Diagrams curated by hand from the source; never regenerated (common is not in MODULES at all).
export const HAND_CURATED = new Set(['server-spi', 'model/jpa', 'services']);

const git = cmd => execSync(`git ${cmd}`, { cwd: ROOT, maxBuffer: 1 << 28 }).toString();
const REVISION = git('rev-parse HEAD').trim();

export const slug = m => m.replace(/\//g, '-');

const stripGenerics = s => { let p; do { p = s; s = s.replace(/<[^<>]*>/g, ''); } while (s !== p); return s; };
const simple = t => stripGenerics(t).trim().split('.').pop().replace(/\[\]$/, '[]');
const shortType = t => {
  t = t.replace(/\s+/g, '').replace(/\b(?:[a-z]\w*\.)+([A-Z])/g, '$1');
  return t.length > 30 ? simple(t) : t;
};
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

function javadocBefore(lines, idx) {
  let i = idx - 1;
  while (i >= 0 && /^\s*@/.test(lines[i])) i--;
  if (i < 0 || !/\*\/\s*$/.test(lines[i])) return '';
  const end = i;
  while (i >= 0 && !/\/\*\*/.test(lines[i])) i--;
  if (i < 0) return '';
  const text = lines.slice(i, end + 1).join(' ')
    .replace(/\/\*\*|\*\//g, ' ').replace(/^\s*\*/gm, ' ').replace(/\s\*\s/g, ' ')
    .replace(/\{@(?:link|code|linkplain)\s+([^}]+)\}/g, (_, x) => x.split(/[#\s]/).filter(Boolean).pop())
    .replace(/<[^>]+>/g, ' ').split(/\s@\w+/)[0].replace(/\s+/g, ' ').trim();
  if (/^(Copyright|Licensed|@author|\$)/i.test(text)) return '';
  const first = (text.match(/^.*?[.!?](\s|$)/) || [text])[0].trim().replace(/[.:]$/, '');
  return clip(first, 40);
}

function parseFile(path) {
  const src = readFileSync(join(ROOT, path), 'utf8');
  const lines = src.split(/\r?\n/);
  const pkg = (src.match(/^package\s+([\w.]+);/m) || [])[1] || '';
  const declIdx = lines.findIndex(l => /^(?:public\s+|abstract\s+|final\s+|sealed\s+|non-sealed\s+|strictfp\s+)*(class|interface|enum|record|@interface)\s+\w+/.test(l));
  if (declIdx < 0) return null;
  let decl = '', j = declIdx;
  while (j < lines.length && !decl.includes('{')) decl += ' ' + lines[j++];
  decl = decl.split('{')[0].replace(/\s+/g, ' ').trim();
  const m = decl.match(/(class|interface|enum|record|@interface)\s+(\w+)/);
  if (!m || m[1] === '@interface' || !/^public\b/.test(decl)) return null;
  const name = m[2];
  const flat = stripGenerics(decl);
  const ext = (flat.match(/\bextends\s+(.+?)(?:\bimplements\b|\bpermits\b|$)/) || [])[1];
  const impl = (flat.match(/\bimplements\s+(.+?)(?:\bpermits\b|$)/) || [])[1];
  const list = s => (s ? s.split(',').map(simple).filter(Boolean) : []);
  let kind = m[1];
  if (kind === 'class' && /\babstract\b/.test(decl.split(m[1])[0])) kind = 'abstract';
  const isInterface = kind === 'interface';

  const methods = [], fields = [], constants = [];
  let recordComponents = [];
  if (kind === 'record') {
    const rc = decl.match(/record\s+\w+(?:<[^>]*>)?\s*\((.*)\)/);
    if (rc) recordComponents = rc[1].split(',').map(p => p.trim().split(/\s+/)).filter(p => p.length >= 2)
      .map(p => ({ name: p[p.length - 1], type: shortType(p.slice(0, -1).join(' ')) }));
  }
  let inEnumConstants = kind === 'enum';
  for (let i = j; i < lines.length; i++) {
    const line = lines[i];
    if (inEnumConstants) {
      const c = line.match(/^ {4}([A-Z][A-Z0-9_]*)\b/);
      if (c) constants.push({ name: c[1], line: i + 1 });
      if (/;\s*$/.test(line.split('//')[0]) && !/^ {4}[A-Z][A-Z0-9_]*\s*\(/.test(line) || /^ {4}(private|public|protected|static)\b/.test(line)) inEnumConstants = false;
      if (inEnumConstants) continue;
    }
    if (!/^ {4}\S/.test(line) || /^ {4}(\/\/|\*|\/\*|@|return\b|\})/.test(line)) continue;
    let sig = line.trim();
    if (/^[\w<>\[\],.? ]+\(/.test(sig) && !sig.includes(')')) {
      let k = i + 1;
      while (k < lines.length && k < i + 8 && !sig.includes(')')) sig += ' ' + lines[k++].trim();
    }
    const mm = sig.match(/^((?:(?:public|protected|private|static|default|abstract|final|synchronized|native)\s+)*)(?:<[^>]+>\s+)?([\w.<>\[\],? ]+?)\s+(\w+)\s*\(([^)]*)\)/);
    if (mm && !/^(new|return|throw|else|if)$/.test(mm[2])) {
      const mods = mm[1];
      const vis = /private/.test(mods) ? 'private' : /protected/.test(mods) ? 'protected' : /public/.test(mods) || isInterface ? 'public' : 'package';
      if (vis !== 'public' || mm[3] === name) continue;
      const params = mm[4].split(',').map(p => p.replace(/@\w+(\([^)]*\))?\s*/g, '').replace(/\bfinal\s+/, '').trim()).filter(Boolean);
      methods.push({
        name: mm[3], line: i + 1,
        paramTypes: params.map(p => simple(p.split(/\s+/).slice(0, -1).join(' '))),
        parameters: clip(params.map(p => p.split(/\s+/).pop()).join(', '), 28),
        returns: shortType(mm[2]),
        static: /static/.test(mods) || undefined,
        abstract: (isInterface && !/default|static/.test(mods)) || /abstract/.test(mods) || undefined,
      });
      continue;
    }
    const fm = sig.match(/^((?:(?:public|protected|private|static|final|volatile|transient)\s+)*)([\w.<>\[\],? ]+?)\s+(\w+)\s*(=|;)/);
    if (fm && !isInterface && /private|protected/.test(fm[1]) && !/static/.test(fm[1])) {
      fields.push({ name: fm[3], type: shortType(fm[2]), rawType: fm[2], line: i + 1, visibility: /private/.test(fm[1]) ? 'private' : 'protected' });
    }
  }
  return { name, kind, pkg, path, line: declIdx + 1, extends: list(ext), implements: list(impl), methods, fields, constants, recordComponents, doc: javadocBefore(lines, declIdx) };
}

const ident = name => name.replace(/[^A-Za-z0-9_]/g, '_');

// supertypes too generic to be worth drawing
const IGNORED_SUPERS = new Set(['Serializable', 'Closeable', 'AutoCloseable', 'Cloneable', 'Comparable', 'Runnable', 'Exception', 'RuntimeException', 'Object', 'Provider', 'ProviderFactory', 'EnvironmentDependentProviderFactory', 'ConfiguredProvider']);

// repo-wide index of public main types by simple name (first match wins), parsed lazily
const GLOBAL = (() => {
  const paths = new Map();
  for (const f of git('ls-files -- "*.java"').split('\n')) {
    if (!/\/src\/main\/java\//.test(f) || /^(testsuite|tests|test-framework|docs)\//.test(f)) continue;
    const n = f.split('/').pop().replace(/\.java$/, '');
    if (!paths.has(n)) paths.set(n, f);
  }
  const cache = new Map();
  return {
    has: n => paths.has(n),
    get: n => { if (!cache.has(n)) cache.set(n, paths.has(n) ? parseFile(paths.get(n)) : null); return cache.get(n) && { ...cache.get(n) }; },
  };
})();

function build(module) {
  COLS = Number(process.env.CLASS_COLS || (NARROW.has(module) ? 3 : 4));
  const files = git(`ls-files -- "${module}"`).split('\n')
    .filter(f => /\/src\/main\/java\/.*\.java$/.test(f) && !/(^|\/)tests?\//.test(f.slice(module.length)) && !/(package|module)-info\.java$/.test(f));
  const types = files.map(parseFile).filter(Boolean);
  const byName = new Map();
  for (const t of types) if (!byName.has(t.name)) byName.set(t.name, t);
  // reference score: number of other module files that mention the type name
  const tokens = files.map(f => new Set(readFileSync(join(ROOT, f), 'utf8').match(/\b[A-Z]\w+\b/g) || []));
  for (const t of byName.values()) {
    t.refs = 0;
    files.forEach((f, i) => { if (f !== t.path && tokens[i].has(t.name)) t.refs++; });
    t.supers = [...t.extends, ...t.implements].filter(s => byName.has(s) && s !== t.name);
  }
  // constant holders (no public methods) are referenced a lot but say little about the design
  const score = t => (t.refs + (t.kind === 'interface' || t.kind === 'abstract' ? 3 : 0) + t.methods.length * 0.1)
    * (t.kind === 'class' && t.methods.length === 0 ? 0.2 : 1);
  const ranked = [...byName.values()].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));

  // supertypes declared outside the module that several module types extend/implement
  const extCount = new Map();
  for (const t of byName.values()) for (const s of [...t.extends, ...t.implements]) {
    if (byName.has(s) || !GLOBAL.has(s) || IGNORED_SUPERS.has(s)) continue;
    extCount.set(s, (extCount.get(s) || 0) + 1);
  }

  // types mentioned by a type's signatures/fields (used to grow a connected selection)
  const links = t => new Set([...t.supers, ...t.fields.map(f => simple(f.rawType)), ...t.methods.flatMap(m => [simple(m.returns), ...m.paramTypes])].filter(n => byName.has(n) && n !== t.name));
  const linkCache = new Map([...byName.values()].map(t => [t.name, links(t)]));
  const connected = (a, b) => linkCache.get(a).has(b) || linkCache.get(b).has(a);

  const chosen = new Set(ranked.slice(0, Math.ceil(MAX_TYPES / 2)).map(t => t.name));
  for (const t of ranked) {
    if (chosen.size >= MAX_TYPES) break;
    if (!chosen.has(t.name) && [...chosen].some(c => connected(c, t.name))) chosen.add(t.name);
  }
  for (const t of ranked) { if (chosen.size >= MAX_TYPES) break; chosen.add(t.name); }
  let sel = ranked.filter(t => chosen.has(t.name));

  // add up to 3 external supertypes shared by >= 2 selected types
  const extUse = new Map();
  for (const t of sel) for (const s of [...t.extends, ...t.implements]) if (extCount.has(s)) extUse.set(s, (extUse.get(s) || 0) + 1);
  const externals = [...extUse.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([s]) => GLOBAL.get(s)).filter(Boolean);
  for (const e of externals) { e.external = true; e.supers = []; e.fields = []; byName.set(e.name, e); chosen.add(e.name); }
  for (const t of sel) t.supers = [...t.extends, ...t.implements].filter(s => chosen.has(s) && s !== t.name);
  sel = [...externals, ...sel];

  // relationships
  const edges = [], seen = new Set();
  const add = (from, to, kind) => {
    const key = [from, to].sort().join('|');
    if (from === to || seen.has(key)) return;
    seen.add(key); edges.push({ from, to, kind });
  };
  for (const t of sel) for (const s of t.supers) if (chosen.has(s)) add(t.name, s, byName.get(s).kind === 'interface' && t.kind !== 'interface' ? 'realization' : 'inheritance');
  for (const t of sel) for (const f of t.fields) { const ft = simple(f.rawType); if (chosen.has(ft)) add(t.name, ft, 'association'); }
  for (const t of sel) for (const m of t.methods) for (const ty of [simple(m.returns), ...m.paramTypes]) if (chosen.has(ty)) add(t.name, ty, 'dependency');
  const order = { inheritance: 0, realization: 0, association: 1, dependency: 2 };
  const weight = n => byName.get(n).refs || 0;
  edges.sort((a, b) => order[a.kind] - order[b.kind] || (weight(b.from) + weight(b.to)) - (weight(a.from) + weight(a.to)));

  // Drawn relationships form a forest so the tidy-tree layout below never crosses edges:
  // each type gets at most one "upper" neighbour, a parent at most MAX_CHILDREN children, and a
  // tree at most COLS leaves. Supertypes / used types sit above. Remaining edges go to a card.
  const parent = new Map(), children = new Map(sel.map(t => [t.name, []]));
  const root = n => { while (parent.has(n)) n = parent.get(n); return n; };
  const leaves = n => (children.get(n).length ? children.get(n).reduce((s, c) => s + leaves(c), 0) : 1);
  const kept = [], dropped = [];
  for (const e of edges) {
    const up = e.to, down = e.from;
    let ok = !parent.has(down) && root(up) !== root(down) && children.get(up).length < MAX_CHILDREN;
    if (ok) {
      children.get(up).push(down); parent.set(down, up);
      if (leaves(root(up)) > COLS) { children.get(up).pop(); parent.delete(down); ok = false; }
    }
    (ok && kept.length < MAX_EDGES ? kept : dropped).push(e);
  }

  // tidy-tree layout: leaves take consecutive integer columns, a parent is centred over its
  // children (rounded to the 0.5 grid); trees are packed left to right into bands of COLS columns.
  const placed = new Map();
  const depthOf = n => (children.get(n).length ? 1 + Math.max(...children.get(n).map(depthOf)) : 0);
  const roots = sel.map(t => t.name).filter(n => !parent.has(n))
    .sort((a, b) => leaves(b) - leaves(a) || depthOf(b) - depthOf(a) || weight(b) - weight(a));
  let bandRow = 0, bandCol = 0, bandDepth = 0;
  const assign = (n, row, nextCol) => {
    const cs = children.get(n);
    if (!cs.length) { placed.set(n, { row, col: nextCol }); return nextCol + 1; }
    let c = nextCol;
    for (const ch of cs) c = assign(ch, row + 1, c);
    const first = placed.get(cs[0]).col, last = placed.get(cs[cs.length - 1]).col;
    placed.set(n, { row, col: Math.round((first + last)) / 2 });
    return c;
  };
  for (const r of roots) {
    const w = leaves(r), dep = depthOf(r);
    if (bandCol + w > COLS) { bandRow += bandDepth + 1; bandCol = 0; bandDepth = 0; }
    assign(r, bandRow, bandCol);
    bandCol += w; bandDepth = Math.max(bandDepth, dep);
  }

  const typeNodes = sel.map(t => {
    const p = placed.get(t.name);
    const home = t.external ? t.path.split('/src/main/java/')[0] : null;
    const node = { id: 't_' + ident(t.name), label: t.name, kind: t.kind, sublabel: t.external ? clip(`from ${home}/`, 40) : t.doc || clip(t.pkg.replace(/^org\.keycloak\./, ''), 40), row: Math.min(p.row, 12), col: p.col };
    const unique = t.methods.filter((m, i, a) => a.findIndex(x => x.name === m.name) === i);
    const accessor = m => /^(get|set|is|has)[A-Z]/.test(m.name) || /^(equals|hashCode|toString)$/.test(m.name);
    const shownMethods = [...unique.filter(m => !accessor(m)), ...unique.filter(accessor)].slice(0, t.external ? 3 : 4)
      .sort((a, b) => a.line - b.line);
    let attrs = [];
    if (t.kind === 'enum') attrs = t.constants.slice(0, 4).map(c => ({ name: c.name, visibility: 'public' }));
    else if (t.kind === 'record') attrs = t.recordComponents.slice(0, 4).map(c => ({ name: c.name, type: c.type, visibility: 'private' }));
    else attrs = t.fields.slice(0, 2).map(f => ({ name: f.name, type: f.type, visibility: f.visibility }));
    if (t.kind === 'enum' && t.constants.length > 4) attrs.push({ name: '…', visibility: 'public' });
    if (attrs.length) node.attributes = attrs;
    if (shownMethods.length) node.methods = shownMethods.map(m => {
      const o = { name: m.name, returns: m.returns, visibility: 'public' };
      if (m.parameters) o.parameters = m.parameters;
      if (m.static) o.static = true;
      if (m.abstract) o.abstract = true;
      return o;
    });
    const lastLine = Math.max(t.line, ...shownMethods.map(m => m.line), ...t.constants.slice(0, 4).map(c => c.line), ...t.fields.slice(0, 2).map(f => f.line));
    node.sources = [{ path: t.path, line: t.line, ...(lastLine > t.line ? { end_line: lastLine } : {}) }];
    return node;
  });

  const pkgCounts = {};
  for (const t of byName.values()) { const p = t.pkg.replace(/^org\.keycloak\./, ''); pkgCounts[p] = (pkgCounts[p] || 0) + 1; }
  const topPkgs = Object.entries(pkgCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([p, n]) => `${p} (${n})`);
  const rest = ranked.filter(t => !chosen.has(t.name)).slice(0, 8).map(t => t.name);
  const shown = sel.filter(t => !t.external).length;
  const pom = readFileSync(join(ROOT, module, 'pom.xml'), 'utf8').replace(/<parent>[\s\S]*?<\/parent>/, '');
  const artifact = (pom.match(/<artifactId>([^<]+)<\/artifactId>/) || [])[1] || module;

  const cards = [
    { dot: 'cyan', title: 'Scope', items: [
      `Module ${module}/ (${artifact}): ${byName.size - externals.length} public types, ${shown} shown`,
      'Types chosen by how often other files in the module reference them; members are a selection',
      ...(externals.length ? [`${externals.map(e => e.name).join(', ')}: supertypes from other modules (sublabel "from …")`] : []),
    ] },
    { dot: 'violet', title: 'Main packages', items: topPkgs },
  ];
  if (dropped.length) {
    const verb = { inheritance: 'extends', realization: 'implements', association: 'has a', dependency: 'uses' };
    cards.push({ dot: 'amber', title: 'Other relationships (not drawn)', items: dropped.slice(0, 10).map(e => `${e.from} ${verb[e.kind]} ${e.to}`)
      .concat(dropped.length > 10 ? [`…and ${dropped.length - 10} more`] : []) });
  }
  if (rest.length) cards.push({ dot: 'emerald', title: 'Next most-referenced (not drawn)', items: [rest.join(', ')] });

  return {
    schema_version: 1,
    diagram_type: 'class',
    meta: {
      title: `${module} module types`,
      output: `${OUT}/${slug(module)}.class.html`,
      quality_profile: 'showcase',
      locale: 'en',
      repository: { url: 'https://github.com/keycloak/keycloak.git', provider: 'github', link_mode: 'web', revision: REVISION },
    },
    layout: { mode: 'grid', ...(TYPE_MAX_W ? { typeMaxW: TYPE_MAX_W } : {}) },
    types: typeNodes,
    relationships: kept.map((e, i) => ({ id: `r${i}_${ident(e.from)}_${ident(e.to)}`, from: 't_' + ident(e.from), to: 't_' + ident(e.to), kind: e.kind })),
    cards,
  };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('gen-class-diagrams.mjs')) {
  const targets = process.argv.slice(2).length ? process.argv.slice(2) : MODULES;
  mkdirSync(join(ROOT, OUT), { recursive: true });
  for (const m of targets) {
    if (HAND_CURATED.has(m)) { console.log(`${m}: hand-curated, skipped`); continue; }
    const doc = build(m);
    writeFileSync(join(ROOT, OUT, `${slug(m)}.class.json`), JSON.stringify(doc, null, 2) + '\n');
    console.log(`${m}: ${doc.types.length} types, ${doc.relationships.length} relationships`);
  }
}
