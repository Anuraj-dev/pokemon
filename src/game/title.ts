/**
 * Title + credits screens — DOM overlays. The Press-Start selection also
 * enters fullscreen (skipped with ?windowed=1 for dev and automation).
 */
import { ListMenu, DialogBox, el, label, fade, GAME_W, GAME_H } from '../ui/dom';
import { InputTap } from '../input/input';
import { audio } from '../audio/audio';
import { SLOTS, slotSummary, loadFromSlot, anySaveExists, formatPlaytime, type SlotId } from '../engine/save';
import { newGameState, setState, getState } from '../engine/state';
import { creatureKey, spriteSnapshot } from '../render3d/textures';
import { speciesById, SPECIES_ORDER } from '../data/species';
import { displayName } from '../engine/creature';
import { gameRNG } from '../core/rng';
import { setMode } from './debug';

function windowed(): boolean {
  return new URLSearchParams(location.search).has('windowed');
}

export function requestGameFullscreen(): void {
  if (windowed() || document.fullscreenElement) return;
  void document.documentElement.requestFullscreen?.().catch(() => {});
}

export function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.().catch(() => {});
}

/** Show the title screen; resolves once a game is started or loaded. */
export async function titleScreen(): Promise<void> {
  audio.playMusic('title');
  setMode('title', true);
  const screen = el('div', 'screen title-screen');

  // drifting creature silhouettes for atmosphere
  for (let i = 0; i < 6; i++) {
    const id = SPECIES_ORDER[gameRNG.int(0, SPECIES_ORDER.length - 1)];
    const img = spriteSnapshot(creatureKey(id, 'front'));
    img.className = 'sprite drift';
    img.style.cssText += `left:${gameRNG.int(30, GAME_W - 80)}px;top:${gameRNG.int(40, GAME_H - 120)}px;width:64px;height:64px;animation-delay:${i * 0.7}s;`;
    screen.appendChild(img);
  }

  const t = label(screen, 0, 48, 'POKEMON', 'title-logo');
  t.style.width = `${GAME_W}px`;
  const sub = label(screen, 0, 104, '— Tales of Veridia · 3D —', 'blue center');
  sub.style.width = `${GAME_W}px`;
  const hint = label(screen, 0, GAME_H - 22, 'Z: confirm · X: back · WASD: move · Shift: run · drag: camera · F: fullscreen', 'small center');
  hint.style.width = `${GAME_W}px`;

  try {
    while (true) {
      const hasSaves = anySaveExists();
      const menu = new ListMenu(
        [{ label: 'New Game' }, { label: 'Continue', disabled: !hasSaves }],
        { x: GAME_W / 2 - 80, y: 168, width: 160, startIndex: hasSaves ? 1 : 0 },
      );
      const pick = await menu.choose();
      if (pick === 0) {
        requestGameFullscreen();
        const dialog = new DialogBox();
        await dialog.show('Welcome to the world of Pokemon!\nA note on saving: your adventure is stored in this browser. Clearing browser data will erase your saves.');
        dialog.destroy();
        let name = '';
        try {
          name = window.prompt('What is your name, trainer?', 'Ari')?.trim().slice(0, 10) ?? '';
        } catch {
          name = '';
        }
        setState(newGameState(name || 'Ari'));
        await fade('out');
        audio.stopMusic();
        await fade('in');
        return;
      } else if (pick === 1) {
        const loaded = await continueMenu();
        if (loaded) {
          requestGameFullscreen();
          await fade('out');
          audio.stopMusic();
          await fade('in');
          return;
        }
      }
    }
  } finally {
    setMode('title', false);
    screen.remove();
  }
}

async function continueMenu(): Promise<boolean> {
  const items = SLOTS.map((slot) => {
    const s = slotSummary(slot);
    if (!s) return { label: `${slotLabel(slot)} — empty`, disabled: true };
    return {
      label: `${slotLabel(slot)} — ${s.playerName}`,
      rightLabel: `☆${s.badges} ${formatPlaytime(s.playtimeMs)}`,
    };
  });
  const menu = new ListMenu(items, { x: GAME_W / 2 - 130, y: 162, width: 260, title: 'Load which save?' });
  const pick = await menu.choose();
  if (pick === null) return false;
  const state = loadFromSlot(SLOTS[pick]);
  if (!state) return false;
  gameRNG.setSeed(state.rngSeed);
  setState(state);
  return true;
}

function slotLabel(slot: SlotId): string {
  return slot === 'auto' ? 'Autosave' : `Slot ${slot.slice(-1)}`;
}

/** Hall of Fame + credits roll; resolves when the player dismisses it. */
export async function creditsScreen(): Promise<void> {
  audio.playMusic('credits');
  setMode('credits', true);
  const s = getState();
  const screen = el('div', 'screen credits-screen');

  const h = label(screen, 0, 24, 'HALL OF FAME', 'title-logo small-logo gold');
  h.style.width = `${GAME_W}px`;
  const sub = label(screen, 0, 56, `Champion ${s.player.name} · ${formatPlaytime(s.player.playtimeMs)} · ${s.caught.length} caught`, 'small center');
  sub.style.width = `${GAME_W}px`;

  s.party.forEach((c, i) => {
    const x = 50 + (i % 3) * 130;
    const y = 96 + Math.floor(i / 3) * 95;
    const img = spriteSnapshot(creatureKey(c.speciesId, 'front', c.shiny));
    img.className = 'sprite fame';
    img.style.cssText += `left:${x}px;top:${y}px;width:64px;height:64px;animation-delay:${i * 0.35}s;`;
    screen.appendChild(img);
    const t = label(screen, x - 33, y + 68, `${displayName(c)} Lv${c.level}`, 'small center');
    t.style.width = '130px';
    void speciesById(c.speciesId);
  });

  const credits = label(
    screen,
    0,
    GAME_H,
    'POKEMON — Tales of Veridia\n\nA complete creature-collecting RPG,\nnow in full 3D.\n\nEvery tile extruded procedurally.\nEvery note synthesized live.\n\nThank you for playing.\n\nThe world of Veridia is still out there —\nwild shinies, unfilled boxes,\nand one very humbled rival.\n\nPress confirm to return to your journey.',
    'center credits-roll',
  );
  credits.style.width = `${GAME_W}px`;
  credits.style.whiteSpace = 'pre';

  await new Promise<void>((resolve) => {
    setTimeout(() => {
      const tap = new InputTap({
        confirm: () => {
          tap.dispose();
          resolve();
        },
      });
    }, 2500);
  });
  audio.stopMusic();
  setMode('credits', false);
  screen.remove();
}
