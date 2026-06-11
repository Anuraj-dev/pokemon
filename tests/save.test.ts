/** save-system: round-trip integrity and forward-safe loading. */
import { describe, it, expect } from 'vitest';
import { serialize, deserialize, validateSave } from '../src/engine/save';
import { newGameState, setState, addCreature, setFlag } from '../src/engine/state';
import { createCreature } from '../src/engine/creature';
import { RNG } from '../src/core/rng';

describe('save system', () => {
  it('round-trips a full game state', () => {
    const s = newGameState('Tester');
    setState(s);
    const rng = new RNG(99);
    addCreature(createCreature(rng, 'emberling', 12, { ot: 'player' }));
    addCreature(createCreature(rng, 'chirpuff', 7, { ot: 'player' }));
    for (let i = 0; i < 8; i++) addCreature(createCreature(rng, 'nibbit', 5)); // overflow into box
    s.player.money = 12345;
    s.player.badges.push('badge1', 'badge2');
    s.bag = { potion: 3, basicball: 9, wavecharm: 1 };
    setFlag('starter', 'emberling');
    setFlag('badge1');
    s.repelSteps = 42;

    const restored = deserialize(serialize(s));
    expect(restored.player.name).toBe('Tester');
    expect(restored.player.money).toBe(12345);
    expect(restored.player.badges).toEqual(['badge1', 'badge2']);
    expect(restored.party.length).toBe(6);
    expect(restored.boxes[0].length).toBe(4);
    expect(restored.party[0].speciesId).toBe('emberling');
    expect(restored.party[0].ivs).toEqual(s.party[0].ivs);
    expect(restored.flags.starter).toBe('emberling');
    expect(restored.bag.basicball).toBe(9);
    expect(restored.repelSteps).toBe(42);
    expect(validateSave(restored)).toBe(true);
    setState(null);
  });

  it('loads older/partial payloads with defaults (forward-safe)', () => {
    const partial = JSON.stringify({
      version: 0,
      player: { name: 'Old', mapId: 'embervale', x: 1, y: 1, facing: 'down', money: 5, badges: [] },
      party: [],
    });
    const restored = deserialize(partial);
    expect(restored.player.name).toBe('Old');
    expect(restored.boxes.length).toBe(8);
    expect(restored.settings.musicVol).toBeGreaterThan(0);
    expect(restored.seen).toEqual([]);
    expect(validateSave(restored)).toBe(true);
  });

  it('rejects corrupt payloads', () => {
    expect(() => deserialize('not json')).toThrow();
  });
});
