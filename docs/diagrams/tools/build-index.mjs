// Writes docs/diagrams/README.md: one table row per diagram (title, file links, what it shows),
// grouped by folder, so diagrams can be browsed in the IDE/GitHub and found with a text search.
//
// Usage: node docs/diagrams/tools/build-index.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
const list = dir => readdirSync(join(root, dir)).filter(f => /\.(architecture|tree|class)\.json$/.test(f)).sort();
const row = cells => `| ${cells.join(' | ')} |`;
const links = p => `[html](${p.replace(/\.json$/, '.html')}) · [json](${p})`;

// short descriptions for the hand-made diagrams; others fall back to their first card line
const ABOUT = {
  'architecture/runtime-login-flow.architecture.json': 'Luồng đăng nhập OIDC lúc chạy: browser → endpoint → auth flow → session → token; DB, LDAP, IdP ngoài và ranh giới tin cậy',
  'architecture/module-layers.architecture.json': 'Module Maven theo tầng (assembly / implementations / SPI) và phụ thuộc giữa chúng, lấy từ pom.xml',
  'structure/maven-modules.tree.json': '29 module cấp 1 và submodule, nhóm theo trách nhiệm; link sang class diagram',
  'features/admin-account-menus.tree.json': 'Menu Admin Console và Account Console đọc từ app đang chạy, kèm tab và menu ẩn theo điều kiện',
};

const SECTIONS = [
  ['architecture', 'Kiến trúc', 'Hệ thống chạy thế nào và mã nguồn chia tầng ra sao.'],
  ['structure', 'Cấu trúc mã nguồn', 'Cây module Maven; node có "class diagram ↗" bấm được để mở class diagram của module.'],
  ['features', 'Chức năng & menu', 'Chức năng của app đang chạy và menu / tab tương ứng.'],
];

const lines = [
  '# Keycloak diagrams',
  '',
  'Diagram được vẽ bằng [Archify](https://github.com/tt-a1i/archify). Mỗi diagram có hai file cùng tên:',
  '`.json` là nguồn (đọc / sửa / tìm kiếm được, mỗi node có `sources` trỏ tới file và dòng code),',
  '`.html` là bản xem (mở trong trình duyệt).',
  '',
];

for (const [dir, title, intro] of SECTIONS) {
  lines.push(`## ${title}`, '', intro, '', row(['Diagram', 'Loại', 'Nội dung', 'File']), row(['---', '---', '---', '---']));
  for (const f of list(dir)) {
    const d = read(`${dir}/${f}`);
    const about = (ABOUT[`${dir}/${f}`] || d.cards?.[0]?.items?.[0] || d.nodes?.[0]?.sublabel || '').replace(/\|/g, '\\|');
    lines.push(row([`**${d.meta.title}**`, d.diagram_type, about, links(`${dir}/${f}`)]));
  }
  lines.push('');
}

// class diagrams: one row per module, grouped by the top-level module directory
lines.push('## Class diagram theo module', '',
  'Mỗi module (hoặc submodule) Maven một diagram. ✋ = chỉnh tay từ source; còn lại sinh bởi `tools/gen-class-diagrams.mjs`.', '',
  row(['Module', 'Số lớp vẽ', 'Lớp chính', 'File']), row(['---', '---', '---', '---']));
const handCurated = new Set(['common', 'server-spi', 'model-jpa', 'services']);
for (const f of list('class-diagram')) {
  const d = read(`class-diagram/${f}`);
  const slug = f.replace(/\.class\.json$/, '');
  const module = d.meta.title.replace(/ module types$/, '');
  const main = d.types.filter(t => !/^from /.test(t.sublabel || '')).slice(0, 4).map(t => `\`${t.label}\``).join(', ');
  lines.push(row([`${handCurated.has(slug) ? '✋ ' : ''}**${module}**`, String(d.types.length), main, links(`class-diagram/${f}`)]));
}

lines.push('', '## Công cụ', '',
  '| Script | Việc |', '| --- | --- |',
  '| `tools/finalize-all.sh` | Build + kiểm tra mọi diagram bằng Archify, chèn link vào cây module, tạo lại README này |',
  '| `tools/gen-class-diagrams.mjs` | Sinh class diagram từ `src/main/java` (bỏ qua diagram chỉnh tay) |',
  '| `tools/link-diagrams.mjs` | Biến "class diagram ↗" trong cây module thành link |',
  '| `tools/build-index.mjs` | Tạo README này |',
  '',
  '`.receipts/` chứa kết quả kiểm tra của Archify; `*.delivery.json` cạnh mỗi `.html` là biên nhận do Archify ghi.',
  '');

writeFileSync(join(root, 'README.md'), lines.join('\n'));
console.log('wrote', join(root, 'README.md'));
