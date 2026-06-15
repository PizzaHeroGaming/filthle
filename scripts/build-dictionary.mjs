// Regenerates src/dictionary.js from scripts/words-raw.txt.
//
// Usage:  node scripts/build-dictionary.mjs
//
// words-raw.txt is the Wordle valid-guess list (one 5-letter word per line).
// To refresh it:
//   curl -L https://raw.githubusercontent.com/tabatkins/wordle-list/main/words \
//     -o scripts/words-raw.txt
//
// The output is a single newline-joined string (smallest practical bundle).
// words.js unions this with the vulgar ANSWER_POOL at runtime, so you do NOT
// need to add answer words here — that's handled automatically.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const inPath = join(here, 'words-raw.txt');
const outPath = join(here, '..', 'src', 'dictionary.js');

const raw = readFileSync(inPath, 'utf8');
const words = [
  ...new Set(
    raw
      .split(/\r?\n/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => /^[a-z]{5}$/.test(w))
  ),
].sort();

const header =
  `// Auto-generated 5-letter English word list for guess validation.\n` +
  `// Source: Wordle valid-guess list (tabatkins/wordle-list), ${words.length} words.\n` +
  `// Regenerate with: node scripts/build-dictionary.mjs  — do NOT hand-edit.\n` +
  `// Stored as one newline-joined string to keep the bundle small.\n\n`;

const body = 'export const DICTIONARY_RAW = `' + words.join('\n') + '`;\n';

writeFileSync(outPath, header + body);
console.log(`Wrote ${outPath} with ${words.length} words.`);
