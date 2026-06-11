import { describe, expect, it } from 'vitest';
import { RECIPES } from '../src/game/moveFx';
import { MOVES } from '../src/data/moves';

describe('move FX recipes', () => {
  it('gives every move its own animation recipe', () => {
    for (const id of Object.keys(MOVES)) {
      expect(RECIPES[id], `move ${id} has no FX recipe`).toBeDefined();
      expect(RECIPES[id].steps.length).toBeGreaterThan(0);
    }
  });

  it('has no orphan recipes for removed moves', () => {
    for (const id of Object.keys(RECIPES)) {
      expect(MOVES[id], `recipe ${id} points at a missing move`).toBeDefined();
    }
  });
});
