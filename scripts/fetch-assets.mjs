/**
 * Downloads battle sprites (front/back, normal/shiny) and cries from the
 * public PokeAPI asset repos into public/assets/, keyed by our species ids
 * so the existing hot-swap loader picks them up automatically.
 *
 * Usage: node scripts/fetch-assets.mjs
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** species id -> national dex number */
const DEX = {
  emberling: 4, flarewolf: 5, pyrothane: 6, // Charmander line
  dribblet: 7, cascotter: 8, tidalord: 9, // Squirtle line
  sproutle: 1, thornbeast: 2, sylvaurus: 3, // Bulbasaur line
  nibbit: 399, gnawber: 400, // Bidoof line
  chirpuff: 16, galewing: 17, tempestrel: 18, // Pidgey line
  larvit: 10, cocoonix: 11, flutterveil: 12, // Caterpie line
  sparkit: 25, voltail: 26, // Pikachu line
  pebblit: 74, bouldrok: 75, terradon: 76, // Geodude line
  finlet: 118, marlance: 119, // Goldeen line
  magmite: 218, magmaul: 219, // Slugma line
  shadepup: 228, duskhound: 229, // Houndour line
  glimkit: 175, luminara: 176, // Togepi line
  battik: 41, nocturnix: 42, // Zubat line
  murklob: 89, // Muk
  magnerock: 82, // Magneton
  golemite: 622, gargantuan: 623, // Golett line
  draklet: 147, drakhorn: 148, dracryon: 149, // Dratini line
  umbralis: 800, // Necrozma
};

const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const CRIES = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest';

async function fetchTo(url, dest) {
  try {
    await access(dest);
    return 'cached';
  } catch { /* not downloaded yet */ }
  const res = await fetch(url);
  if (!res.ok) return `HTTP ${res.status}`;
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return 'ok';
}

let failures = 0;
const jobs = [];
for (const [id, n] of Object.entries(DEX)) {
  const base = join(ROOT, 'public', 'assets');
  jobs.push(
    [`${SPRITES}/${n}.png`, join(base, 'sprites', 'creature', id, 'front.png')],
    [`${SPRITES}/back/${n}.png`, join(base, 'sprites', 'creature', id, 'back.png')],
    [`${SPRITES}/shiny/${n}.png`, join(base, 'sprites', 'creature', id, 'front', 'shiny.png')],
    [`${SPRITES}/back/shiny/${n}.png`, join(base, 'sprites', 'creature', id, 'back', 'shiny.png')],
    [`${CRIES}/${n}.ogg`, join(base, 'cries', `${id}.ogg`)],
  );
}

// modest concurrency to be polite to the CDN
const POOL = 8;
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const [url, dest] = jobs[next++];
    const r = await fetchTo(url, dest);
    if (r !== 'ok' && r !== 'cached') {
      failures++;
      console.error(`✗ ${url} → ${r}`);
    }
  }
}
await Promise.all(Array.from({ length: POOL }, worker));
console.log(`done: ${jobs.length - failures}/${jobs.length} assets in place${failures ? `, ${failures} FAILED` : ''}`);
process.exit(failures ? 1 : 0);
