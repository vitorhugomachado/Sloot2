import { execFileSync } from 'node:child_process';
const range = process.argv[2] || 'HEAD^..HEAD';
let files = '';
try { files = execFileSync('git', ['diff', '--name-only', range, '--', 'server/prisma/migrations'], { encoding: 'utf8' }); } catch { files = ''; }
const commits = range.split('..');
const revision = commits.at(-1) || 'HEAD';
const sql = files.trim().split(/\r?\n/).filter(Boolean).map((file) => execFileSync('git', ['show', `${revision}:${file}`], { encoding: 'utf8' })).join('\n');
if (/\b(DROP\s+(TABLE|COLUMN|INDEX)|TRUNCATE\b|DELETE\s+FROM|ALTER\s+TABLE[^;]*(?:DROP|TYPE))\b/i.test(sql)) throw new Error('Destructive migration detected; use an approved expand/contract release.');
console.log('No destructive migration detected.');
