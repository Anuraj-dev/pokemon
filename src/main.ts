/**
 * Pokemon (3D) — entrypoint and mode orchestrator. One WebGL renderer,
 * one rAF loop, and an active scene that swaps between the overworld,
 * battles, and DOM-only screens (title, menus, credits).
 */
import * as THREE from 'three';
import { registerAllSprites, hotSwapFileAssets } from './render3d/textures';
import { Overworld3D } from './game/overworld';
import { Battle3D } from './game/battle';
import { MenuSuite } from './game/menus';
import { titleScreen, creditsScreen, toggleFullscreen } from './game/title';
import { fade, uiRoot, sleep } from './ui/dom';
import { bindPointer, worldKeys, uiActive } from './input/input';
import { audio } from './audio/audio';
import { getState, hasState } from './engine/state';
import { mapById } from './data/maps';
import { setMode, activeModes } from './game/debug';
import type { BattleRequest, BattleOutcome } from './game/battleTypes';

interface ActiveScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update(dt: number): void;
  onResize(): void;
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.id = 'game3d';
document.body.appendChild(renderer.domElement);
uiRoot();
bindPointer(renderer.domElement);

let active: ActiveScene | null = null;

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  active?.onResize();
});

// Unlock audio on the first user gesture anywhere.
const unlock = () => audio.unlock();
window.addEventListener('keydown', unlock);
window.addEventListener('pointerdown', unlock);

// Render loop — runs forever; DOM-only screens just render a cleared frame.
let last = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (active) {
    active.update(dt);
    renderer.render(active.scene, active.camera);
  } else {
    renderer.clear();
  }
});

registerAllSprites();
setTimeout(hotSwapFileAssets, 100);

async function runOverworld(): Promise<void> {
  const menus = new MenuSuite();
  let creditsPending = false;

  const overworld: Overworld3D = new Overworld3D({
    startBattle: async (req: BattleRequest): Promise<BattleOutcome> => {
      audio.sfxEncounter();
      await fade('out', 280);
      const battle = new Battle3D(req);
      active = battle;
      setMode('battle', true);
      await fade('in', 200);
      const outcome = await battle.run();
      await fade('out', 260);
      battle.dispose();
      setMode('battle', false);
      active = overworld;
      await fade('in', 240);
      return outcome;
    },
    openMenu: (mode, stock) => menus.open(mode, stock),
    showCredits: () => {
      creditsPending = true;
    },
  });
  active = overworld;
  setMode('overworld', true);

  worldKeys.onConfirm = () => overworld.onConfirmKey();
  worldKeys.onMenu = () => overworld.onMenuKey();
  worldKeys.onFullscreen = toggleFullscreen;

  // stay here until quit-to-title; show credits when the champion falls
  while (!overworld.quitRequested) {
    if (creditsPending) {
      creditsPending = false;
      await creditsScreen();
      if (hasState()) audio.playMusic(mapById(getState().player.mapId).music);
    }
    await sleep(120);
  }

  worldKeys.onConfirm = null;
  worldKeys.onMenu = null;
  await fade('out', 250);
  overworld.dispose();
  setMode('overworld', false);
  active = null;
  await fade('in', 250);
}

async function game(): Promise<void> {
  while (true) {
    await titleScreen();
    await runOverworld();
  }
}

void game();

// Debug/automation handle (used by the smoke test; harmless in production).
declare global {
  interface Window {
    __monstra: { getState: typeof getState; hasState: typeof hasState; modes: () => string[]; ui: () => boolean };
  }
}
window.__monstra = { getState, hasState, modes: activeModes, ui: uiActive };
