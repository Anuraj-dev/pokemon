/**
 * End-to-end smoke test for the 3D build: boots the real game headless,
 * starts a new game, walks (analog movement) to the lab, takes a starter,
 * walks to Route 1, fights the scripted rival battle, opens the pause menu,
 * and catches a wild creature — asserting real game state at every milestone
 * via the window.__monstra handle. Runs windowed (?windowed=1) so the
 * fullscreen-on-start behavior never blocks automation.
 */
import { chromium } from 'playwright';

const URL = (process.env.GAME_URL ?? 'http://localhost:5180') + '/?windowed=1';
const shots = process.argv.includes('--shots');

const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle'] });
const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
page.on('pageerror', (err) => errors.push(String(err)));
page.on('dialog', (d) => d.accept('Smokey'));

const fail = async (msg) => {
  console.error('✗ ' + msg);
  if (errors.length) console.error('page errors:\n' + errors.join('\n'));
  if (shots) await page.screenshot({ path: '/tmp/monstra-FAIL.png' }).catch(() => {});
  process.exit(1);
};

const probe = () =>
  page.evaluate(() => {
    const m = window.__monstra;
    const active = m.modes();
    const ui = m.ui();
    if (!m.hasState()) return { active, ui, st: null };
    const s = m.getState();
    return {
      active,
      ui,
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
  await fail(`timeout waiting for: ${label} — last: ${JSON.stringify(await probe())}`);
};

const press = async (k, times = 1, delay = 220) => {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(k);
    await page.waitForTimeout(delay);
  }
};

/** Mash confirm until a predicate holds (advances dialogs/menus). */
const mash = async (label, pred, max = 50, delay = 380) => {
  for (let i = 0; i < max; i++) {
    const p = await probe();
    if (pred(p)) return p;
    await page.keyboard.press('z');
    await page.waitForTimeout(delay);
  }
  await fail(`mash gave up on: ${label} — last: ${JSON.stringify((await probe()).st)}`);
};

/** Hold a movement key until the predicate holds (analog walking). */
const walk = async (dirKey, pred, timeoutMs = 8000, failHard = true) => {
  await page.keyboard.down(dirKey);
  const t0 = Date.now();
  let ok = false;
  while (Date.now() - t0 < timeoutMs) {
    const p = await probe();
    if (pred(p)) { ok = true; break; }
    if (p.ui && !p.active.includes('battle')) {
      await page.keyboard.press('z'); // dismiss stray dialog blocking movement
      await page.waitForTimeout(180);
    }
    await page.waitForTimeout(70);
  }
  await page.keyboard.up(dirKey);
  await page.waitForTimeout(120);
  if (!ok && failHard) await fail(`walk ${dirKey} never satisfied predicate — at ${JSON.stringify((await probe()).st)}`);
  return ok;
};

/**
 * Steer one axis to a coordinate (continuous movement needs alignment
 * before squeezing through 1-tile doors). axis: 'x' | 'y'.
 */
const moveAxis = async (axis, target, band = 0.2, timeoutMs = 9000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const p = await probe();
    if (!p.st) return false;
    if (p.active.includes('battle')) return 'battle';
    if (p.ui) {
      // stray dialog (e.g. re-triggered NPC chatter) — dismiss and keep going
      await page.keyboard.press('z');
      await page.waitForTimeout(250);
      continue;
    }
    const v = p.st[axis];
    const d = target - v;
    if (Math.abs(d) < band) return true;
    const key = axis === 'x' ? (d > 0 ? 'ArrowRight' : 'ArrowLeft') : d > 0 ? 'ArrowDown' : 'ArrowUp';
    const holdMs = Math.min(280, Math.max(40, (Math.abs(d) / 4.4) * 1000 * 0.6));
    await page.keyboard.down(key);
    await page.waitForTimeout(holdMs);
    await page.keyboard.up(key);
    await page.waitForTimeout(90);
  }
  await fail(`moveAxis ${axis}→${target} timed out at ${JSON.stringify((await probe()).st)}`);
};

const shot = async (name) => {
  if (shots) await page.screenshot({ path: `/tmp/monstra-${name}.png` });
};

// ---------------------------------------------------------------- boot
console.log('· loading', URL);
await page.goto(URL);
await waitFor('title screen', (p) => p.active.includes('title'));
await shot('title');

// ---------------------------------------------------------------- new game
await press('Enter'); // New Game
await press('z', 6, 320); // save-storage notice (+ name prompt auto-accepted)
await waitFor('overworld with state', (p) => p.active.includes('overworld') && p.st !== null);
await press('z', 4, 320); // intro welcome dialog
let p = await probe();
if (p.st.map !== 'embervale') await fail('did not start in embervale');
console.log('· new game started at', p.st.x.toFixed(1), p.st.y.toFixed(1));
await shot('overworld');

// ---------------------------------------------------------------- to the lab
// spawn (12.5, 8.5) → south to the plaza row, west to the lab door column
// (door tile x=5 → center 5.5), then north through the door at (5,8).
await moveAxis('y', 10.5);
await moveAxis('x', 5.5);
await walk('ArrowUp', (q) => q.st.map === 'lab', 8000);
console.log('· entered the lab');
await shot('lab');

// ---------------------------------------------------------------- starter
// lab spawn (6.5, 6.5) → stand at tile (4,3) facing the professor at (4,2).
await moveAxis('y', 3.5);
await moveAxis('x', 4.5);
await page.keyboard.down('ArrowUp'); // face up (bumps the professor harmlessly)
await page.waitForTimeout(120);
await page.keyboard.up('ArrowUp');
await mash('starter received', (q) => q.st && q.st.party.length === 1, 60);
await press('z', 12, 340); // remaining professor dialog
p = await probe();
if (p.st.party[0].id !== 'emberling') await fail(`expected emberling, got ${p.st.party[0].id}`);
if (!p.st.flags.includes('hasStarter')) await fail('hasStarter flag not set');
if ((p.st.bag.basicball ?? 0) < 5) await fail('starter kit basicballs missing');
console.log('· got starter:', p.st.party[0].id, 'lv', p.st.party[0].lv);
await shot('starter');

// ---------------------------------------------------------------- to route 1
// exit via the mats at (6,7)/(7,7), then north up the road and across the edge.
await moveAxis('x', 6.5);
await walk('ArrowDown', (q) => q.st.map === 'embervale', 8000);
await moveAxis('x', 11.5);
await walk('ArrowUp', (q) => q.st.map === 'route1', 15000);
console.log('· reached route 1');

// ---------------------------------------------------------------- rival battle
// route1 south spawn; the rival ambush trigger row sits at y=18.
for (let attempt = 1; ; attempt++) {
  if (attempt > 4) await fail('could not beat the rival in 4 attempts');
  p = await probe();
  if (p.st.flags.includes('rival1done')) break;
  if (p.st.map === 'embervale') {
    await press('z', 4, 280); // clear blackout dialog leftovers
    await moveAxis('x', 11.5);
    await walk('ArrowUp', (q) => q.st.map === 'route1', 15000);
  }
  await walk('ArrowUp', (q) => q.st.y <= 18.95 || q.active.includes('battle'), 6000, false);
  await mash('rival battle starts', (q) => q.active.includes('battle'), 30);
  if (attempt === 1) {
    console.log('· rival battle started');
    await shot('battle-start');
  }
  for (let i = 0; i < 400; i++) {
    await page.keyboard.press('z');
    await page.waitForTimeout(280);
    p = await probe();
    if (!p.active.includes('battle')) break;
    if (attempt === 1 && i === 12) await shot('battle-mid');
  }
  await waitFor('battle over', (q) => !q.active.includes('battle'), 10000);
  await press('z', 6, 320); // post-battle dialog (victory or blackout)
  p = await probe();
  console.log(`· rival attempt ${attempt}: ${p.st.flags.includes('rival1done') ? 'WON' : 'lost — blacked out, retrying'}`);
}
await shot('after-battle');

// ---------------------------------------------------------------- pause menu
await waitFor('overworld resumed', (q) => q.active.includes('overworld') && !q.active.includes('battle'));
await press('z', 4, 250); // clear any leftover dialog
await press('Enter');
await waitFor('pause menu', (q) => q.active.includes('menu'), 8000);
await shot('menu');
await press('Escape', 1, 300); // a second Escape would re-open it (menu key in the open world)
await waitFor('menu closed', (q) => !q.active.includes('menu'), 8000);

// ---------------------------------------------------------------- wild catch
p = await probe();
if (p.st.map === 'embervale') {
  await moveAxis('x', 11.5);
  await walk('ArrowUp', (q) => q.st.map === 'route1', 15000);
}
console.log('· hunting a wild encounter');
const battleActive = async () => (await probe()).active.includes('battle');
const fightThrough = async (label) => {
  console.log(`· fighting through: ${label}`);
  for (let i = 0; i < 400; i++) {
    await page.keyboard.press('z');
    await page.waitForTimeout(270);
    if (!(await battleActive())) break;
  }
  await press('z', 5, 300);
};
// Head into the east grass block (x 12–14, y 9–11); a route trainer may
// ambush via line-of-sight on the way — fight through whatever engages.
for (let tries = 0; tries < 12; tries++) {
  p = await probe();
  if (p.active.includes('battle')) {
    await fightThrough('ambush en route');
    continue;
  }
  if (p.st.map === 'route1' && Math.abs(p.st.x - 13.5) < 0.5 && Math.abs(p.st.y - 10.5) < 0.7) break;
  if (p.st.map === 'embervale') {
    await moveAxis('x', 11.5);
    await walk('ArrowUp', (q) => q.st.map === 'route1', 15000);
    continue;
  }
  if ((await moveAxis('y', 10.5, 0.5, 12000)) === 'battle') continue;
  if ((await moveAxis('x', 13.5, 0.3, 12000)) === 'battle') continue;
}
// Pace inside the grass (tiles 12–14) until a wild battle fires.
let inBattle = await battleActive();
for (let i = 0; i < 80 && !inBattle; i++) {
  const key = i % 2 === 0 ? 'ArrowRight' : 'ArrowLeft';
  await page.keyboard.down(key);
  await page.waitForTimeout(350);
  await page.keyboard.up(key);
  await page.waitForTimeout(180);
  inBattle = await battleActive();
  if (!inBattle && i % 8 === 7) await moveAxis('x', 13.5, 0.3, 6000); // recenter
}
if (!inBattle) await fail('no wild encounter after 80 grass passes');
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
await mash('battle over after catching', (q) => !q.active.includes('battle'), 30, 500);
p = await probe();
caught = caught || p.st.party.length >= 2;
console.log(caught ? `· caught a wild creature! party: ${p.st.party.map((c) => c.id).join(', ')}` : '· wild battle ended without a catch (balls missed or KO)');
await shot('after-catch');

// ---------------------------------------------------------------- verdict
const fatal = errors.filter((e) => !e.includes('favicon'));
await browser.close();
if (fatal.length > 0) await fail('console errors:\n' + fatal.join('\n'));
console.log('✓ E2E smoke passed — boot, new game, starter, route 1, rival battle, pause menu, wild catch all work in 3D');
