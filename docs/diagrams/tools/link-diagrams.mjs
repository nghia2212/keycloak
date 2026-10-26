// Post-processes Archify output: makes the "class diagram ↗" sublabel of every module node in the
// Maven module tree a clickable link to class-diagram/<module>.class.html. Archify has no
// node-link field, so rerun this after every `archify finalize` of the tree (the edit makes
// Archify's own `check` report the tree HTML as changed).
//
// Usage: node docs/diagrams/tools/link-diagrams.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = join(dirname(fileURLToPath(import.meta.url)), '..', 'structure');
const treeHtml = join(here, 'maven-modules.tree.html');
const treeJson = JSON.parse(readFileSync(join(here, 'maven-modules.tree.json'), 'utf8'));
const MARK = 'class diagram ↗';

// node id -> diagram path relative to the tree HTML, derived from the tree's own labels:
// a module node is labelled "<dir>/", a submodule node "<sub>" under its module node
const byId = new Map(treeJson.nodes.map(n => [n.id, n]));
const links = {};
for (const n of treeJson.nodes) {
  if (!n.sublabel?.endsWith(MARK)) continue;
  const parent = byId.get(n.parent);
  const module = n.label.endsWith('/') ? n.label.slice(0, -1) : `${parent.label.replace(/\/$/, '')}/${n.label}`;
  const href = `../class-diagram/${module.replace(/\//g, '-')}.class.html`;
  if (!existsSync(join(here, href))) throw new Error(`${n.id}: ${href} does not exist`);
  links[n.id] = href;
}

let html = readFileSync(treeHtml, 'utf8');
for (const [nodeId, href] of Object.entries(links)) {
  const start = html.indexOf(`<g id="node-${nodeId}"`);
  if (start < 0) throw new Error(`node ${nodeId} not found`);
  const end = html.indexOf('</g>', start);
  const node = html.slice(start, end);
  if (node.includes('data-diagram-link')) continue;
  // wrap the whole (possibly multi-line) sublabel so wrapping position doesn't matter
  const linked = node.replace(
    /(<text data-detail="context"[^>]*>)([\s\S]*?)(<\/text>)/,
    (_, open, body, close) => `${open}<a href="${href}" target="_blank" data-diagram-link="" style="cursor:pointer">${body.replace(/<tspan([^>]*)>/g, '<tspan$1 style="text-decoration:underline">')}</a>${close}`,
  );
  if (linked === node) throw new Error(`sublabel not found on ${nodeId}`);
  html = html.slice(0, start) + linked + html.slice(end);
}

// Keep the link from also triggering the viewer's node focus toggle.
const guard = `<script data-diagram-link-guard>document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-diagram-link]');if(a){e.stopPropagation();window.open(a.getAttribute('href'),'_blank');e.preventDefault();}},true);</script>`;
if (!html.includes('data-diagram-link-guard')) html = html.replace('</body>', `${guard}\n</body>`);

writeFileSync(treeHtml, html);
console.log(`linked ${Object.keys(links).length} node(s) in ${treeHtml}`);
