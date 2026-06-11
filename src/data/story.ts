/**
 * Story scripts — a small declarative cutscene DSL interpreted by the
 * overworld scene: dialogue, battles, rewards, flags, badges, warps.
 */
import type { Facing } from '../engine/state';
import type { TrackId } from '../audio/audio';

export type ScriptOp =
  | { op: 'say'; text: string }
  | { op: 'choice'; prompt: string; options: { label: string; then: ScriptOp[] }[] }
  | { op: 'battle'; trainerId: string; winFlag?: string }
  /** trainerId resolved from rival stage + chosen starter at runtime */
  | { op: 'rivalBattle'; stage: number; winFlag?: string }
  | { op: 'wildBattle'; speciesId: string; level: number; resolveFlag?: string }
  | { op: 'giveItem'; item: string; qty: number }
  | { op: 'giveCreature'; speciesId: string; level: number; perfect?: boolean }
  | { op: 'setFlag'; flag: string; value?: boolean | number | string }
  | { op: 'if'; flag: string; value?: boolean | number | string; not?: boolean; then: ScriptOp[]; else?: ScriptOp[] }
  | { op: 'ifBadges'; count: number; then: ScriptOp[]; else?: ScriptOp[] }
  | { op: 'heal'; silent?: boolean }
  | { op: 'autosave' }
  | { op: 'warp'; map: string; spawn: string }
  | { op: 'movePlayer'; path: Facing[] }
  | { op: 'badge'; index: number }
  | { op: 'sfx'; name: 'heal' | 'badge' | 'levelup' | 'select' | 'evolve' }
  | { op: 'music'; track: TrackId }
  | { op: 'shop'; townId: string }
  | { op: 'credits' };

export const SCRIPTS: Record<string, ScriptOp[]> = {};
function S(id: string, ops: ScriptOp[]) {
  SCRIPTS[id] = ops;
}

// ----------------------------------------------------------- Embervale

S('block-no-starter', [
  { op: 'say', text: 'A voice calls out: "Hold on! It\'s dangerous to go out there alone!"\nProfessor Alder waves you toward the lab.' },
  { op: 'movePlayer', path: ['down'] },
]);

S('mom-talk', [
  {
    op: 'if', flag: 'momGift', not: true, then: [
      { op: 'say', text: 'Mom: Off to see Professor Alder? She has been asking about you all morning!' },
      { op: 'say', text: 'Mom: Take this — your grandfather swore by it. Keep it on a creature you love.' },
      { op: 'giveItem', item: 'luckycharm', qty: 1 },
      { op: 'setFlag', flag: 'momGift' },
      { op: 'say', text: 'Mom: Be careful out there. Come home if you need rest — and call... no wait, we do not have phones. Visit!' },
    ], else: [
      { op: 'heal' },
      { op: 'say', text: 'Mom: Your team looks tired! There. Good as new.\nI am so proud of you, sweetheart.' },
    ],
  },
]);

const STARTER_PICK = (speciesId: string, label: string): { label: string; then: ScriptOp[] } => ({
  label,
  then: [
    { op: 'giveCreature', speciesId, level: 5, perfect: true },
    { op: 'setFlag', flag: 'hasStarter' },
    { op: 'setFlag', flag: 'starter', value: speciesId },
    { op: 'giveItem', item: 'basicball', qty: 5 },
    { op: 'giveItem', item: 'potion', qty: 2 },
    { op: 'sfx', name: 'levelup' },
    { op: 'say', text: `Alder: A fine choice! ${label} suits you.\nTake these Basic Balls too — catch creatures by weakening them first, then throwing a ball.` },
    { op: 'say', text: 'Alder: Your Compendium records every species you meet. Veridia has eight gyms — earn all eight badges and the League itself will open to you.\nNow go! Kael left an hour ago and he will NOT let you forget it.' },
  ],
});

S('professor-starter', [
  {
    op: 'if', flag: 'hasStarter', not: true, then: [
      { op: 'say', text: 'Alder: There you are! I am Professor Alder. I study the bond between people and creatures.\nYou are starting your journey today, yes? Then you will need a partner.' },
      { op: 'say', text: 'Alder: Three young creatures wait in those capsules. Listen well — this choice tends to... define a person.' },
      {
        op: 'choice', prompt: 'Choose your partner!', options: [
          STARTER_PICK('emberling', 'Charmander'),
          STARTER_PICK('dribblet', 'Squirtle'),
          STARTER_PICK('sproutle', 'Bulbasaur'),
        ],
      },
    ], else: [
      { op: 'say', text: 'Alder: How is your partner doing? Remember — type matchups win battles. Inferno burns Verdant, Verdant drinks Aqua, Aqua drowns Inferno. The rest you will learn by losing, like everyone does.' },
    ],
  },
]);

// ----------------------------------------------------------- services

S('center-heal', [
  { op: 'say', text: 'Nurse: Welcome! Shall I restore your team?\n...There we go!' },
  { op: 'sfx', name: 'heal' },
  { op: 'heal' },
  { op: 'autosave' },
  { op: 'say', text: 'Nurse: All healed! Your progress has been saved.\nDo come again!' },
]);

for (const town of ['thornbury', 'duskhollow', 'voltis', 'portmaren', 'crestfall', 'cinderpeak', 'nocturne', 'aurelia']) {
  S(`shop-${town}`, [{ op: 'shop', townId: town }]);
}

// ----------------------------------------------------------- helpers / townsfolk

S('thornbury-guide', [
  {
    op: 'if', flag: 'badge1', then: [
      {
        op: 'if', flag: 'gotCutter', not: true, then: [
          { op: 'say', text: 'Guide: You beat Erika? Then you are ready for this — the Cutter Charm!\nWith it, your lead creature can slash through dense brush blocking the paths.' },
          { op: 'giveItem', item: 'cuttercharm', qty: 1 },
          { op: 'setFlag', flag: 'gotCutter' },
          { op: 'say', text: 'Guide: Walk up to any bush and press the action button. East of town, Route 5 is a shortcut to the coast — if you can cut through it.' },
        ], else: [
          { op: 'say', text: 'Guide: The region is a great loop. Gym order is your choice, but the wilds get fiercer the further you walk. West forest, then the quarry town — that is the gentle way around.' },
        ],
      },
    ], else: [
      { op: 'say', text: 'Guide: New trainer? Challenge Erika at the gym here first. And bring Inferno or Gale moves — Verdant types wilt before them.' },
    ],
  },
]);

S('voltis-collector', [
  {
    op: 'if', flag: 'voltisGift', not: true, then: [
      { op: 'say', text: 'Collector: I spent my whole life seeking a partner for my Cubone. Link Stones bond two souls into one — but my journey is done.\nTake my spare. Let it finish someone else\'s story.' },
      { op: 'giveItem', item: 'linkstone', qty: 1 },
      { op: 'setFlag', flag: 'voltisGift' },
    ], else: [
      { op: 'say', text: 'Collector: A Link Stone replaces what trainers once needed a partner for. Lonelier, maybe. But complete.' },
    ],
  },
]);

S('climber-gear', [
  {
    op: 'if', flag: 'badge6', then: [
      {
        op: 'if', flag: 'gotClimb', not: true, then: [
          { op: 'say', text: 'Climber: Blaine\'s badge! Ha! Then your hands are strong enough for these — my old Climbing Gear.\nRocky walls with hand-holds? Walk right up them.' },
          { op: 'giveItem', item: 'climbinggear', qty: 1 },
          { op: 'setFlag', flag: 'gotClimb' },
          { op: 'say', text: 'Climber: The quarry near Duskhollow hides a lower level. Worth the climb, if you ask me.' },
        ], else: [
          { op: 'say', text: 'Climber: Treat the mountain with respect, and it lets you pass. Usually.' },
        ],
      },
    ], else: [
      { op: 'say', text: 'Climber: I would lend you my Climbing Gear, but the cliffs would eat you alive. Earn Blaine\'s badge first — then we talk.' },
    ],
  },
]);

S('astronomer-talk', [
  {
    op: 'if', flag: 'hideoutCleared', then: [
      {
        op: 'if', flag: 'gotMasterball', not: true, then: [
          { op: 'say', text: 'Astronomer: You drove Eclipse off Hollow Isle? Then the Spire is next — and what sleeps inside it.\nI have kept this for the day someone worthy would need it. The Master Ball. It never fails. Use it wisely — there is exactly one.' },
          { op: 'giveItem', item: 'masterball', qty: 1 },
          { op: 'setFlag', flag: 'gotMasterball' },
        ], else: [
          { op: 'say', text: 'Astronomer: Mewtwo is not evil, whatever Eclipse believes. It is balance. Treat it that way.' },
        ],
      },
    ], else: [
      { op: 'say', text: 'Astronomer: My charts show the Twinlight Spire glowing brighter each night. Something stirs out there on Hollow Isle...' },
    ],
  },
]);

// ----------------------------------------------------------- rival beats

S('rival1', [
  { op: 'say', text: 'Kael: Hey! Neighbor! You finally got a creature? Show me!\n...That is what you picked? Bold. Wrong, but bold.' },
  { op: 'rivalBattle', stage: 1 },
  { op: 'setFlag', flag: 'rival1done' },
  { op: 'say', text: 'Kael: Whatever. I am off to win every badge in Veridia. Try to make it past Route 1, yeah?' },
]);

S('rival2', [
  { op: 'say', text: 'Kael: Oh good, you survived the forest. I already flattened the Thornbury gym. You? Thought so. Battle. Now.' },
  { op: 'rivalBattle', stage: 2 },
  { op: 'setFlag', flag: 'rival2done' },
  { op: 'say', text: 'Kael: Hmph. Listen — weird people in dark coats were sniffing around the quarry. Stay out of their way. That is MY advice, so it is excellent.' },
]);

S('rival3', [
  { op: 'say', text: 'Kael: The sea air, the gulls, the smell of victory — and you. Three badges, by the way. Do not answer, just battle!' },
  { op: 'rivalBattle', stage: 3 },
  { op: 'setFlag', flag: 'rival3done' },
  { op: 'say', text: 'Kael: ...You know what is annoying? You do not even train angry. HOW are you winning?\nUgh. The warehouse by the dock — Eclipse locked it down. Go be a hero, since you are so good at it.' },
]);

S('rival4', [
  { op: 'say', text: 'Kael: Nocturne. Quiet, dark, perfect for training. I can hear myself think out here.\n...I think about losing to you a lot, actually. Time to fix that!' },
  { op: 'rivalBattle', stage: 4 },
  { op: 'setFlag', flag: 'rival4done' },
  { op: 'say', text: 'Kael: ...Fine. FINE. You are good. I am better at being almost as good as you than anyone alive.\nThe League, neighbor. That is where this ends. Last one there is a Muk.' },
]);

S('rival5', [
  { op: 'say', text: 'Kael: Victory Road. One tunnel between us and the League.\nI promised myself something the day you beat me on Route 1: the last battle before the League would be you and me. Pay up.' },
  { op: 'rivalBattle', stage: 5 },
  { op: 'setFlag', flag: 'rival5done' },
  { op: 'say', text: 'Kael: ...Go. The Elite Four are waiting. I need a minute.\nAnd hey — do not lose to anyone who is not me.' },
]);

// ----------------------------------------------------------- Team Eclipse

S('forest-eclipse', [
  { op: 'say', text: 'Grunt: Team Eclipse business! This glowing little pest is coming with us. The Director wants every Lumina creature off the streets!' },
  { op: 'battle', trainerId: 'eclipse-forest1' },
  { op: 'say', text: 'The grunt flees into the trees!\nThe little Clefairy looks up at you, trembling — then presses against your leg.' },
  {
    op: 'choice', prompt: 'Take Clefairy with you?', options: [
      {
        label: 'Welcome it aboard', then: [
          { op: 'giveCreature', speciesId: 'glimkit', level: 6 },
          { op: 'say', text: 'Clefairy joined your team, glowing faintly with relief!' },
        ],
      },
      {
        label: 'Set it free', then: [
          { op: 'say', text: 'The Clefairy blinks gratefully and drifts into the canopy, shining like a lantern among the leaves.' },
        ],
      },
    ],
  },
  { op: 'setFlag', flag: 'forestEclipseDone' },
]);

S('quarry-eclipse1', [
  { op: 'say', text: 'Grunt: The shards in this quarry belong to Team Eclipse! Scram!' },
  { op: 'battle', trainerId: 'eclipse-quarry1', winFlag: 'quarryGrunt1' },
  { op: 'if', flag: 'quarryGrunt2', then: [{ op: 'setFlag', flag: 'quarryEclipseDone' }, { op: 'giveItem', item: 'prismshard', qty: 1 }, { op: 'say', text: 'The grunts scatter, dropping a Prism Shard!\nIt hums faintly — half warm, half cold.' }] },
]);

S('quarry-eclipse2', [
  { op: 'say', text: 'Grunt: Nobody saw us down here. Nobody LEAVES here either!' },
  { op: 'battle', trainerId: 'eclipse-quarry2', winFlag: 'quarryGrunt2' },
  { op: 'if', flag: 'quarryGrunt1', then: [{ op: 'setFlag', flag: 'quarryEclipseDone' }, { op: 'giveItem', item: 'prismshard', qty: 1 }, { op: 'say', text: 'The grunts scatter, dropping a Prism Shard!\nIt hums faintly — half warm, half cold.' }] },
]);

S('warehouse-admin', [
  { op: 'say', text: 'Mordent: Admin Mordent, Team Eclipse. The shard shipment leaves tonight, and you were not in the plan.' },
  { op: 'battle', trainerId: 'eclipse-admin1' },
  { op: 'setFlag', flag: 'warehouseCleared' },
  { op: 'say', text: 'Mordent: Keep the warehouse. The Director already has what he needs — a roost on Hollow Isle, far from prying eyes.\nMordent and the grunts melt into the night.' },
  { op: 'autosave' },
]);

S('hideout-admin', [
  { op: 'say', text: 'Mordent: You. AGAIN. I have been demoted twice because of you.\nNothing personal about what happens next.' },
  { op: 'battle', trainerId: 'eclipse-admin2' },
  { op: 'say', text: 'Mordent: Demoted... a third time...\nGo on then. Ruin the Director\'s day like you ruined mine.' },
]);

S('hideout-boss', [
  { op: 'say', text: 'Noxim: Director Noxim. You have unpicked my operation thread by thread, child.\nLight blinds. Only in perfect darkness are all things equal. Mewtwo will gift Veridia that equality — eternal eclipse.' },
  { op: 'battle', trainerId: 'eclipse-boss1' },
  { op: 'setFlag', flag: 'hideoutCleared' },
  { op: 'setFlag', flag: 'hasEclipseKey' },
  { op: 'giveItem', item: 'eclipsekey', qty: 1 },
  { op: 'say', text: 'Noxim: Dimmed... but not extinguished.\nHe hurls a crescent-shaped key at your feet and storms toward the Spire.\nYou obtained the Eclipse Key!' },
  { op: 'autosave' },
]);

S('spire-boss', [
  { op: 'say', text: 'Noxim: Too late! TOO LATE! The shards are set, the Spire sings, and Mewtwo STIRS!\nOne last obstacle, then. You. As always. You.' },
  { op: 'battle', trainerId: 'eclipse-boss2' },
  { op: 'setFlag', flag: 'spireCleared' },
  { op: 'say', text: 'Noxim drops to his knees as the Spire floods with twin light — gold above, violet below.\nNoxim: No... the eclipse was supposed to be forever...\nSomething vast turns its gaze upon you.' },
  { op: 'autosave' },
]);

S('umbralis-encounter', [
  { op: 'say', text: 'Mewtwo regards you — one eye blazing gold, one drinking the light around it.\nIt does not seem angry. It seems... curious which half of it you will answer to.' },
  { op: 'wildBattle', speciesId: 'umbralis', level: 50, resolveFlag: 'umbralisResolved' },
]);

// ----------------------------------------------------------- gyms & league

interface GymScriptSpec {
  num: number;
  leader: string;
  trainerId: string;
  badgeName: string;
  extra?: ScriptOp[];
  postLine: string;
}

const GYM_SCRIPTS: GymScriptSpec[] = [
  { num: 1, leader: 'Erika', trainerId: 'gym1-leader', badgeName: 'Verdant Badge', postLine: 'Erika: Visit the guide in town — she has something for trainers with my badge.' },
  { num: 2, leader: 'Brock', trainerId: 'gym2-leader', badgeName: 'Terra Badge', postLine: 'Brock: The quarry runs deep. Watch yourself down there.' },
  { num: 3, leader: 'Lt. Surge', trainerId: 'gym3-leader', badgeName: 'Volt Badge', postLine: 'Lt. Surge: Charge on, challenger. The coast road east hums with opportunity.' },
  {
    num: 4, leader: 'Misty', trainerId: 'gym4-leader', badgeName: 'Aqua Badge',
    extra: [
      { op: 'say', text: 'Misty: One more thing. Trainers with my badge ride the waves themselves.\nTake this Wave Charm — step to any shore and your creatures will carry you across the water.' },
      { op: 'giveItem', item: 'wavecharm', qty: 1 },
    ],
    postLine: 'Misty: The sea south of the dock leads to Hollow Isle. Strange tides lately...',
  },
  { num: 5, leader: 'Falkner', trainerId: 'gym5-leader', badgeName: 'Gale Badge', postLine: 'Falkner: The tunnel west runs beneath Mt. Cinder. Tell Blaine the wind sent you.' },
  { num: 6, leader: 'Blaine', trainerId: 'gym6-leader', badgeName: 'Inferno Badge', postLine: 'Blaine: The old climber in town has gear for hands as strong as yours now.' },
  { num: 7, leader: 'Piers', trainerId: 'gym7-leader', badgeName: 'Umbra Badge', postLine: 'Piers: Eclipse twists what darkness means. If you ever face their Director... show him the difference.' },
  { num: 8, leader: 'Valerie', trainerId: 'gym8-leader', badgeName: 'Lumina Badge', postLine: 'Valerie: Victory Road waits north of town. The League waits past it. Go and be seen.' },
];

for (const g of GYM_SCRIPTS) {
  S(`gym${g.num}-leader`, [
    {
      op: 'if', flag: `badge${g.num}`, then: [
        { op: 'say', text: g.postLine },
      ], else: [
        { op: 'battle', trainerId: g.trainerId },
        { op: 'sfx', name: 'badge' },
        { op: 'badge', index: g.num - 1 },
        { op: 'setFlag', flag: `badge${g.num}` },
        { op: 'say', text: `You received the ${g.badgeName}!` },
        ...(g.extra ?? []),
        { op: 'autosave' },
      ],
    },
  ]);
}

S('league-gate', [
  {
    op: 'ifBadges', count: 8, then: [
      { op: 'say', text: 'Gatekeeper: Eight badges... all eight. It is an honor, challenger.\nVictory Road lies ahead. The League stands at its end. Go make history.' },
    ], else: [
      { op: 'say', text: 'Gatekeeper: Halt! The League admits only trainers bearing all EIGHT gym badges.\nCome back when your badge case is full.' },
      { op: 'movePlayer', path: ['down'] },
    ],
  },
]);

for (let n = 1; n <= 4; n++) {
  S(`elite${n}-battle`, [
    {
      op: 'if', flag: `elite${n}done`, then: [
        { op: 'say', text: 'The chamber keeper bows. The way forward is open.' },
      ], else: [
        { op: 'battle', trainerId: `elite${n}`, winFlag: `elite${n}done` },
        { op: 'say', text: 'The door behind the dais unseals with a deep chime.' },
        { op: 'autosave' },
      ],
    },
  ]);
}

S('champion-battle', [
  { op: 'say', text: 'The Champion turns — and grins a painfully familiar grin.' },
  { op: 'rivalBattle', stage: 6 },
  { op: 'setFlag', flag: 'championDefeated' },
  { op: 'credits' },
]);
