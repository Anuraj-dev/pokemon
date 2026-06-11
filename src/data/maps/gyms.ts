/**
 * Gym interiors — one per type, each a small maze with an apprentice
 * trainer and the leader at the back. Badge logic lives in story scripts.
 */
import type { MapDef } from './defs';

const LAYOUTS: string[][] = [
  [
    'IIIIIIIIIIIIII',
    'IGGGGGpGGGGGGI',
    'IGGGGGGGGGGGGI',
    'IGGIIIIIIIGGGI',
    'IGGGGGGGGIGGGI',
    'IGIIIIGGGIGGGI',
    'IGGGGIGGGIGGGI',
    'IGpGGIGGGGGGGI',
    'IGGGGIGGGGGGGI',
    'IIIIIIaaIIIIII',
  ],
  [
    'IIIIIIIIIIIIII',
    'IGGGGGGpGGGGGI',
    'IGGGGGGGGGGGGI',
    'IIIIGGIIIIIGGI',
    'IGGGGGGGGGIGGI',
    'IGGIIIIIGGIGGI',
    'IGGIGGGGGGIGGI',
    'IGGIGGpGGGIGGI',
    'IGGGGGGGGGGGGI',
    'IIIIIIaaIIIIII',
  ],
  [
    'IIIIIIIIIIIIII',
    'IGGGGGGpGGGGGI',
    'IGGGGGGGGGGGGI',
    'IGGIIIIIIIIGGI',
    'IGGIGGGGGGIGGI',
    'IGGIGGppGGIGGI',
    'IGGIGGGGGGIGGI',
    'IGGIIGGGIIIGGI',
    'IGGGGGGGGGGGGI',
    'IIIIIIaaIIIIII',
  ],
];

interface GymSpec {
  num: number;
  leader: string;
  town: string;
  leaderTrainer: string;
  apprentice: string;
  leaderSprite: string;
  apprenticeSprite: string;
  leaderPos: [number, number];
  apprenticePos: [number, number];
  motto: string;
}

const GYMS: GymSpec[] = [
  { num: 1, leader: 'Erika', town: 'thornbury', leaderTrainer: 'gym1-leader', apprentice: 'gym1-trainer', leaderSprite: 'leader1', apprenticeSprite: 'boy', leaderPos: [6, 1], apprenticePos: [7, 6], motto: 'Patience grows victories.' },
  { num: 2, leader: 'Brock', town: 'duskhollow', leaderTrainer: 'gym2-leader', apprentice: 'gym2-trainer', leaderSprite: 'leader2', apprenticeSprite: 'girl', leaderPos: [7, 1], apprenticePos: [6, 6], motto: 'Be the bedrock.' },
  { num: 3, leader: 'Lt. Surge', town: 'voltis', leaderTrainer: 'gym3-leader', apprentice: 'gym3-trainer', leaderSprite: 'leader3', apprenticeSprite: 'scientist', leaderPos: [7, 1], apprenticePos: [6, 5], motto: 'Keep current.' },
  { num: 4, leader: 'Misty', town: 'portmaren', leaderTrainer: 'gym4-leader', apprentice: 'gym4-trainer', leaderSprite: 'leader4', apprenticeSprite: 'swimmer', leaderPos: [6, 1], apprenticePos: [7, 6], motto: 'Flow around every obstacle.' },
  { num: 5, leader: 'Falkner', town: 'crestfall', leaderTrainer: 'gym5-leader', apprentice: 'gym5-trainer', leaderSprite: 'leader5', apprenticeSprite: 'ranger', leaderPos: [7, 1], apprenticePos: [6, 6], motto: 'Rise above.' },
  { num: 6, leader: 'Blaine', town: 'cinderpeak', leaderTrainer: 'gym6-leader', apprentice: 'gym6-trainer', leaderSprite: 'leader6', apprenticeSprite: 'hiker', leaderPos: [7, 1], apprenticePos: [6, 5], motto: 'Temper yourself.' },
  { num: 7, leader: 'Piers', town: 'nocturne', leaderTrainer: 'gym7-leader', apprentice: 'gym7-trainer', leaderSprite: 'leader7', apprenticeSprite: 'lass', leaderPos: [6, 1], apprenticePos: [7, 6], motto: 'See in the dark.' },
  { num: 8, leader: 'Valerie', town: 'aurelia', leaderTrainer: 'gym8-leader', apprentice: 'gym8-trainer', leaderSprite: 'leader8', apprenticeSprite: 'girl', leaderPos: [7, 1], apprenticePos: [6, 6], motto: 'Shine, and be seen.' },
];

export const GYM_MAPS: MapDef[] = GYMS.map((g) => ({
  id: `gym${g.num}`,
  name: `${g.leader}'s Gym`,
  music: 'gym',
  indoor: true,
  grid: LAYOUTS[(g.num - 1) % LAYOUTS.length],
  spawns: { door: { x: 6, y: 8, facing: 'up' } },
  warps: [
    { x: 6, y: 9, to: g.town, spawn: 'gym-door' },
    { x: 7, y: 9, to: g.town, spawn: 'gym-door' },
  ],
  signs: [],
  npcs: [
    {
      id: 'leader',
      sprite: g.leaderSprite,
      x: g.leaderPos[0],
      y: g.leaderPos[1],
      facing: 'down',
      script: `gym${g.num}-leader`,
    },
    {
      id: 'apprentice',
      sprite: g.apprenticeSprite,
      x: g.apprenticePos[0],
      y: g.apprenticePos[1],
      facing: 'down',
      trainer: { trainerId: g.apprentice, sightRange: 3 },
      dialogue: [g.motto],
    },
  ],
}));
