import type { CreatureInstance } from '../engine/creature';
import type { TrackId } from '../audio/audio';

export type BattleBiome = 'grass' | 'cave' | 'water' | 'gym' | 'dark' | 'indoor';

export interface BattleRequest {
  kind: 'wild' | 'trainer';
  foeParty: CreatureInstance[];
  foeName?: string;
  foeIsSmart?: boolean;
  payBase?: number;
  canCatch: boolean;
  canRun: boolean;
  music: TrackId;
  /** arena theming from where the encounter happened */
  biome: BattleBiome;
}

export type BattleOutcome = 'win' | 'loss' | 'fled' | 'caught';
