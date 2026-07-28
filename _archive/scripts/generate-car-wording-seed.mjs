import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const csvPath = path.join(root, 'car_wording.csv');
const outPath = path.join(root, 'supabase/seeds/car_wording.sql');

const raw = fs.readFileSync(csvPath, 'utf8');
const lines = raw.split(/\r?\n/);
const records = [];
let current = null;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  const match = line.match(/^(\d+)\|([^|]*)\|(.*)$/);
  if (match) {
    if (current) records.push(current);
    current = { id: Number(match[1]), subject: match[2], content: match[3] };
  } else if (current) {
    current.content += (current.content ? '\n' : '') + line;
  }
}
if (current) records.push(current);

const sqlEscape = (str) => str.replace(/'/g, "''");

const sql = [
  '-- CAR wording seed data from car_wording.csv',
  '-- Generated automatically; re-run: node scripts/generate-car-wording-seed.mjs',
  '',
  'insert into car_wording (car_wording_id, subject, content)',
  'values',
  ...records.map((r, idx) => {
    const tag = `content_${r.id}`;
    const subject = sqlEscape(r.subject.trim());
    const content = r.content.trim();
    const suffix = idx === records.length - 1 ? '' : ',';
    return `  (${r.id}, '${subject}', $${tag}$${content}$${tag}$)${suffix}`;
  }),
  'on conflict (car_wording_id) do update set',
  '  subject = excluded.subject,',
  '  content = excluded.content;',
  '',
];

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, sql.join('\n'));
console.log(`Wrote ${records.length} CAR wording rows to ${outPath}`);
