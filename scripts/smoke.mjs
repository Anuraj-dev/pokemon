/**
 * End-to-end smoke test: boots the real game headless, starts a new game,
 * walks to the lab, takes a starter from Professor Alder, walks to Route 1,
 * fights the scripted rival battle, and opens the pause menu — asserting
 * real game state at every milestone via the window.__monstra handle.
 */
import { chromium } from 'playwright';

const URL = process.env.GAME_URL ?? 'http://localhost:5180';
const shots = process.argv.includes('--shots');

const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
page.on('pageerror', (err) => errors.push(String(err)));
page.on('dialog', (d) => d.accept('Smokey'));

const fail = (msg) => {
  console.error('✗ ' + msg);
  if (errors.length) console.error('page errors:\n' + errors.join('\n'));
  process.exit(1);
};

const probe = () =>
  page.evaluate(() => {
    const m = window.__monstra;
    const active = ['title', 'overworld', 'battle', 'menu', 'credits'].filter((k) => m.game.scene.isActive(k));
    if (!m.hasState()) return { active, st: null };
    const s = m.getState();
    return {
      active,
      st: {
        map: s.player.mapId, x: s.player.x, y: s.player.y,
        party: s.party.map((c) => ({ id: c.speciesId, lv: c.level, hp: c.hp })),
        money: s.player.money, flags: Object.keys(s.flags),
        bag: s.bag, seen: s.seen.length,
      },
    };
  });

const waitFor = async (label, pred, timeoutMs = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const p = await probe();
    if (pred(p)) return p;
    await page.waitForTimeout(200);
  }
  fail(`timeout waiting for: ${label} — last: ${JSON.stringify(await probe())}`);
};

const press = async (k, times = 1, delay = 220) => {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(k);
    await page.waitForTimeout(delay);
  }
};

/** Hold a key long enough for Phaser's per-frame polling to see it. */
const tap = async (k, holdMs = 130) => {
  await page.keyboard.down(k);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(k);
  await page.waitForTimeout(200);
};

/** Mash confirm until a predicate holds (advances dialogs/menus). */
const mash = async (label, pred, max = 50, delay = 380) => {
  for (let i = 0; i < max; i++) {
    const p = await probe();
    if (pred(p)) return p;
    await page.keyboard.down('z');
    await page.waitForTimeout(110);
    await page.keyboard.up('z');
    await page.waitForTimeout(delay);
  }
  fail(`mash gave up on: ${label} — last: ${JSON.stringify((await probe()).st)}`);
};

/** Hold an arrow until the player reaches the predicate position. */
const walk = async (dirKey, pred, timeoutMs = 8000) => {
  await page.keyboard.down(dirKey);
  const t0 = Date.now();
  let ok = false;
  while (Date.now() - t0 < timeoutMs) {
    const p = await probe();
    if (pred(p)) { ok = true; break; }
    await page.waitForTimeout(100);
  }
  await page.keyboard.up(dirKey);
  if (!ok) fail(`walk ${dirKey} never satisfied predicate — at ${JSON.stringify((await probe()).st)}`);
};

const shot = async (name) => {
  if (shots) await page.screenshot({ path: `/tmp/monstra-${name}.png` });
};

// ---------------------------------------------------------------- boot
console.log('· loading', URL);
await page.goto(URL);
await waitFor('title scene', (p) => p.active.includes('title'));
await shot('title');

// ---------------------------------------------------------------- new game
await press('Enter'); // New Game
await press('z', 6, 320); // save-storage notice (+ name prompt auto-accepted)
await waitFor('overworld with state', (p) => p.active.includes('overworld') && p.st !== null);
await press('z', 4, 320); // intro welcome dialog
let p = await probe();
if (p.st.map !== 'embervale') fail('did not start in embervale');
console.log('· new game started at', p.st.x, p.st.y);
await shot('overworld');

// ---------------------------------------------------------------- to the lab
// spawn (12,8) → path: down to y=10, left to x=4, up to y=9 (in front of lab door at 5,8)
await walk('ArrowDown', (p) => p.st.y >= 10);
await walk('ArrowLeft', (p) => p.st.x <= 5);
await walk('ArrowUp', (p) => p.st.map === 'lab' || p.st.y <= 8, 6000).catch?.(() => {});
p = await probe();
if (p.st.map !== 'lab') {
  // walk onto the door tile (5,8): adjust x then up again
  await walk('ArrowLeft', (p) => p.st.x <= 5 || p.st.map === 'lab', 3000);
  await walk('ArrowUp', (p) => p.st.map === 'lab', 4000);
}
console.log('· entered the lab');
await shot('lab');

// ---------------------------------------------------------------- starter
// lab spawn (6,6) → professor at (4,2): up to y=3, left to x=4, face up, talk
await walk('ArrowUp', (p) => p.st.y <= 3);
await walk('ArrowLeft', (p) => p.st.x <= 4, 4000);
await tap('ArrowUp'); // face professor (bumps into them harmlessly)
await mash('starter received', (p) => p.st.party.length === 1, 60);
await press('z', 12, 340); // remaining professor dialog
p = await probe();
if (p.st.party[0].id !== 'emberling') fail(`expected emberling, got ${p.st.party[0].id}`);
if (!p.st.flags.includes('hasStarter')) fail('hasStarter flag not set');
if ((p.st.bag.basicball ?? 0) < 5) fail('starter kit basicballs missing');
console.log('· got starter:', p.st.party[0].id, 'lv', p.st.party[0].lv);
await shot('starter');

// ---------------------------------------------------------------- to route 1
// exit lab: down to y=6, right to mat column x=6, down through mat (6,7) → embervale
await walk('ArrowDown', (p) => p.st.y >= 6, 5000);
await walk('ArrowRight', (p) => p.st.x >= 6, 5000);
await walk('ArrowDown', (p) => p.st.map === 'embervale', 5000);
await walk('ArrowRight', (p) => p.st.x >= 11);
await walk('ArrowUp', (p) => p.st.map === 'route1', 12000);
console.log('· reached route 1');

// ---------------------------------------------------------------- rival battle
// route1 south spawn (10,19); rival trigger row at y=18 → step up fires the
// cutscene. On a loss we black out home and march back (up to 4 tries).
for (let attempt = 1; ; attempt++) {
  if (attempt > 4) fail('could not beat the rival in 4 attempts');
  p = await probe();
  if (p.st.flags.includes('rival1done')) break;
  if (p.st.map === 'embervale') {
    await press('z', 4, 280); // clear blackout dialog leftovers
    await walk('ArrowUp', (p2) => p2.st.map === 'route1', 12000);
  }
  await walk('ArrowUp', (p2) => p2.st.y <= 18 || p2.active.includes('battle'), 5000);
  await mash('rival battle starts', (p2) => p2.active.includes('battle'), 30);
  if (attempt === 1) {
    console.log('· rival battle started');
    await shot('battle-start');
  }
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('z');
    await page.waitForTimeout(260);
    p = await probe();
    if (!p.active.includes('battle')) break;
    if (attempt === 1 && i === 12) await shot('battle-mid');
  }
  await waitFor('battle over', (p2) => !p2.active.includes('battle'), 30000);
  await press('z', 6, 320); // post-battle dialog (victory or blackout)
  p = await probe();
  console.log(`· rival attempt ${attempt}: ${p.st.flags.includes('rival1done') ? 'WON' : 'lost — blacked out, retrying'}`);
}
await shot('after-battle');

// ---------------------------------------------------------------- pause menu
await waitFor('overworld resumed', (p) => p.active.includes('overworld') && !p.active.includes('menu'));
await press('z', 4, 250); // clear any leftover dialog
await tap('Enter');
await waitFor('pause menu', (p) => p.active.includes('menu'), 8000);
await shot('menu');
await press('Escape', 2, 300);
await waitFor('menu closed', (p) => !p.active.includes('menu'), 8000);

// ---------------------------------------------------------------- wild catch
// Reach route 1 tall grass (right-middle block x13–15, y9–11) and pace until
// an encounter fires, then throw Basic Balls from the bag until caught.
p = await probe();
if (p.st.map === 'embervale') {
  await walk('ArrowUp', (p2) => p2.st.map === 'route1', 12000);
}
console.log('· hunting a wild encounter');
const battleActive = async () => (await probe()).active.includes('battle');
const fightThrough = async (label) => {
  console.log(`· fighting through: ${label}`);
  for (let i = 0; i < 100; i++) {
    await page.keyboard.press('z');
    await page.waitForTimeout(270);
    if (!(await battleActive())) break;
  }
  await press('z', 5, 300);
};
// Head north to the grass block (x12–14, y9–11); a route trainer may ambush
// us via line-of-sight on the way — fight through whatever engages.
for (let tries = 0; tries < 12; tries++) {
  p = await probe();
  if (p.active.includes('battle')) {
    await fightThrough('ambush en route');
    continue;
  }
  if (p.st.map === 'route1' && p.st.y <= 11) break;
  if (p.st.map === 'embervale') {
    await walk('ArrowUp', (p2) => p2.st.map === 'route1', 12000);
    continue;
  }
  await page.keyboard.down('ArrowUp');
  const t0 = Date.now();
  while (Date.now() - t0 < 4000) {
    const q = await probe();
    if (q.active.includes('battle') || (q.st.map === 'route1' && q.st.y <= 11)) break;
    await page.waitForTimeout(100);
  }
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(250);
  if (!(await battleActive())) await press('z', 3, 300); // clear trainer intro dialog if any
}
// Pace inside the grass until a wild battle fires.
let inBattle = await battleActive();
for (let i = 0; i < 80 && !inBattle; i++) {
  await tap(i % 4 < 2 ? 'ArrowRight' : 'ArrowLeft', 200);
  inBattle = await battleActive();
}
if (!inBattle) fail('no wild encounter after 80 grass steps');
console.log('· wild encounter!');
await page.waitForTimeout(4500); // intro text auto-advances
await shot('wild');
let caught = false;
for (let i = 0; i < 12; i++) {
  p = await probe();
  if (!p.active.includes('battle')) break;
  if (p.st.party.length >= 2) { caught = true; break; }
  // action menu: cursor starts on FIGHT → down to BAG → confirm → first item (Basic Ball) → confirm
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(250);
  await page.keyboard.press('z');
  await page.waitForTimeout(400);
  await page.keyboard.press('z');
  await page.waitForTimeout(9000); // throw + shakes + result text (auto-advance)
}
// drain any trailing dialogs (nickname prompt declined via ArrowDown handled above)
await mash('battle over after catching', (p2) => !p2.active.includes('battle'), 30, 500);
p = await probe();
caught = caught || p.st.party.length >= 2;
console.log(caught ? `· caught a wild creature! party: ${p.st.party.map((c) => c.id).join(', ')}` : '· wild battle ended without a catch (balls missed or KO)');
await shot('after-catch');

// ---------------------------------------------------------------- verdict
const fatal = errors.filter((e) => !e.includes('favicon'));
await browser.close();
if (fatal.length > 0) fail('console errors:\n' + fatal.join('\n'));
console.log('✓ E2E smoke passed — boot, new game, starter, route 1, rival battle, pause menu all work');
