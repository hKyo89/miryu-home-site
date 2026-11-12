import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const textTypes = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.txt', '.xml', '.webmanifest']);
const contactPatterns = [
  /\b(?:mailto|tel|sms)\s*:/i,
  /\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/i,
  /\b(?:wa\.me|(?:api|web)\.whatsapp\.com)\/(?:\+?\d|send\?[^"'\s]*\bphone=)/i,
  /(?:^|[\s="'(])\+\d{1,3}[\s().-]*(?:\d[\s().-]*){7,13}\d\b/,
  /\b(?:phone|telephone|whatsapp|mobile|telepon)\s*[:=]\s*["']?(?:\d[ .()-]*){7,15}\b/i,
];

async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'scripts') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await check(path);
    else if (textTypes.has(extname(path))) {
      const contents = (await readFile(path, 'utf8')).replace(/%40|&#64;|&#x40;|&commat;/gi, '@');
      if (contactPatterns.some(pattern => pattern.test(contents))) {
        console.error('Possible public contact information in ' + path);
        process.exitCode = 1;
      }
    }
  }
}

const directories = process.argv.slice(2);
if (!directories.length) throw new Error('Pass the public asset directories to check.');
for (const directory of directories) await check(directory);
if (!process.exitCode) console.log('Public contact scan passed.');
