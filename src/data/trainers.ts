/**
 * Trainer definitions — route trainers, gym leaders, Team Eclipse, the
 * rival (variant per player starter), Elite Four, and the Champion.
 */

export interface TrainerMon {
  speciesId: string;
  level: number;
  heldItem?: string;
}

export interface TrainerDef {
  id: string;
  name: string;
  sprite: string;
  party: TrainerMon[];
  payBase: number; // money = payBase × highest level
  smart?: boolean;
  intro: string;
  defeat: string;
  postDefeat?: string; // overworld line after losing
}

const T = (
  id: string,
  name: string,
  sprite: string,
  party: TrainerMon[],
  payBase: number,
  intro: string,
  defeat: string,
  opts: Partial<TrainerDef> = {},
): TrainerDef => ({ id, name, sprite, party, payBase, intro, defeat, ...opts });

const mon = (speciesId: string, level: number, heldItem?: string): TrainerMon => ({ speciesId, level, heldItem });

export const TRAINERS: Record<string, TrainerDef> = {};
function add(t: TrainerDef) {
  TRAINERS[t.id] = t;
}

// ------------------------------------------------------------- route folk

add(T('r1-youngster', 'Youngster Finn', 'boy', [mon('nibbit', 4), mon('chirpuff', 4)], 16,
  'I just caught these! Let me try them out on you!',
  'Aww, they tried their best...',
  { postDefeat: 'Back to the tall grass for more training.' }));
add(T('forest-lass', 'Lass Poppy', 'lass', [mon('larvit', 6), mon('chirpuff', 7)], 16,
  'The forest creatures trust me. Watch this!',
  'Even the forest could not help me!',
  { postDefeat: 'Listen... the forest hums when Butterfree are near.' }));
add(T('forest-catcher', 'Bug Catcher Milo', 'boy', [mon('larvit', 7), mon('cocoonix', 8), mon('larvit', 6)], 14,
  'My bugs evolve faster than anything you have!',
  'They evolve fast, but they faint fast too...',
  { postDefeat: 'Metapod is tough, but it barely moves. Hmm.' }));
add(T('r2-hiker', 'Hiker Boris', 'hiker', [mon('pebblit', 9), mon('golemite', 11)], 28,
  'The mountain road builds strong legs and stronger creatures!',
  'Solid as rock, beaten all the same!',
  { postDefeat: 'Terra types fear Aqua and Verdant moves. Learned that the hard way.' }));
add(T('r2-lass', 'Lass Wren', 'lass', [mon('sparkit', 10)], 20,
  'Pikachu, show them what static means!',
  'Shocking. Truly shocking.',
  { postDefeat: 'There is a quarry cave ahead. Bring a strong team.' }));
add(T('r3-ranger', 'Ranger Iva', 'ranger', [mon('gnawber', 13), mon('galewing', 13)], 32,
  'Rangers keep this road safe. Prove you can handle it!',
  'You can clearly handle yourself.',
  { postDefeat: 'Voltis City runs on Magneton magnetism. Fascinating creatures.' }));
add(T('r3-scientist', 'Scientist Hartl', 'scientist', [mon('magnerock', 14)], 40,
  'I study electromagnetic creatures. Care to contribute data?',
  'Intriguing data. Unfortunate result.',
  { postDefeat: 'Magneton levitates. Terra moves cannot touch it!' }));
add(T('r4-fisher', 'Fisher Eli', 'fisher', [mon('finlet', 15), mon('finlet', 16), mon('murklob', 17)], 28,
  'Everything I own, I fished out of this sea!',
  'Should have thrown that one back...',
  { postDefeat: 'Muk look like trash bags. They are not. Respect them.' }));
add(T('r4-swimmer', 'Swimmer Lale', 'swimmer', [mon('finlet', 17), mon('cascotter', 18)], 24,
  'The current is strong today. So am I!',
  'Swept away!',
  { postDefeat: 'Past Port Maren, the open sea hides an island. Few have landed there.' }));
add(T('r5-boy', 'Camper Theo', 'boy', [mon('shadepup', 11), mon('nibbit', 12)], 22,
  'I camp here so I can battle everyone who passes!',
  'I will battle the NEXT one who passes...',
  { postDefeat: 'This shortcut needs a Cutter Charm. The brush grows back overnight.' }));
add(T('r6-hiker', 'Hiker Gerda', 'hiker', [mon('bouldrok', 19), mon('magmite', 19)], 30,
  'These cliffs are my home turf!',
  'Tumbled clean off my turf!',
  { postDefeat: 'Crestfall winds will knock you off ledges. Walk careful.' }));
add(T('r6-ranger', 'Ranger Sol', 'ranger', [mon('galewing', 20), mon('shadepup', 19), mon('sparkit', 20)], 32,
  'The cliff path breeds tough birds and tougher rangers!',
  'The wind is out of my sails.',
  { postDefeat: 'Gale types hate Volt moves. And other Gale moves, oddly.' }));
add(T('mtcinder-hiker', 'Hiker Flint', 'hiker', [mon('magmite', 24), mon('bouldrok', 25)], 34,
  'The mountain core keeps me warm. My team keeps me winning!',
  'My fire went out!',
  { postDefeat: 'Slugma shed warm pebbles. I collect them. Do not judge me.' }));
add(T('mtcinder-scientist', 'Scientist Pyra', 'scientist', [mon('magmaul', 26)], 44,
  'Geothermal readings are spiking — and so is my team!',
  'Readings... flatlined.',
  { postDefeat: 'Team Eclipse asked about the mountain shards. I refused them.' }));
add(T('r8-girl', 'Picnicker Mab', 'girl', [mon('flutterveil', 27), mon('glimkit', 26)], 24,
  'A picnic under the dusk sky! Care to join — or battle?',
  'You squashed my sandwiches AND my pride.',
  { postDefeat: 'Togepi glow brighter near Nocturne. Strange, for such a dark town.' }));
add(T('r8-ranger', 'Ranger Hawthorne', 'ranger', [mon('duskhound', 28), mon('gnawber', 27)], 34,
  'Few make it this far around the loop. Show me why you did!',
  'That is why, then.',
  { postDefeat: 'Houndoom only evolve under a Dusk Stone. Mine found one itself.' }));
add(T('r10-lass', 'Lass Selene', 'lass', [mon('nocturnix', 30), mon('murklob', 29)], 26,
  'The road to Aurelia is paved with losses. Mostly mine!',
  'Mostly mine, like I said...',
  { postDefeat: 'Aurelia means "the golden one". Wait till you see the gym.' }));
add(T('r10-scientist', 'Scientist Vellum', 'scientist', [mon('magnerock', 31), mon('voltail', 32)], 44,
  'I left Voltis to study Lumina particles. Defend yourself!',
  'My hypothesis collapses!',
  { postDefeat: 'Umbra and Lumina are two halves of one force. The Spire proves it.' }));
add(T('vr-ace1', 'Ace Rune', 'ranger', [mon('terradon', 41), mon('tempestrel', 41), mon('marlance', 42)], 48,
  'Victory Road weeds out the almosts. Are you an almost?',
  'You are no almost.',
  { postDefeat: 'The Elite Four heal between battles. You will not. Pack deep.' }));
add(T('vr-ace2', 'Ace Vesna', 'lass', [mon('duskhound', 42), mon('luminara', 42), mon('magmaul', 43)], 48,
  'I have beaten everyone who walked this tunnel today!',
  'Today had one battle too many!',
  { postDefeat: 'The Champion waits past the Elite Four. Nobody knows who it is lately.' }));
add(T('vr-ace3', 'Ace Aldous', 'hiker', [mon('gargantuan', 43), mon('dracryon', 44)], 48,
  'Last gate before the League. I AM the gate!',
  'Gate: open.',
  { postDefeat: 'Dragonite took me eleven years to raise. Worth every day.' }));

// --------------------------------------------------------------- gyms

add(T('gym1-trainer', 'Sprout Hand Lyle', 'boy', [mon('nibbit', 9), mon('larvit', 9)], 18,
  'Leader Erika taught me everything about Verdant types!',
  'I still have more to learn!',
  { postDefeat: 'Erika uses healing moves. Hit hard and fast.' }));
add(T('gym1-leader', 'Leader Erika', 'leader1', [mon('nibbit', 10), mon('flutterveil', 12, 'oranberry')], 100,
  'Welcome to Thornbury Gym. I am Erika. The forest taught me patience — let me teach it to you!',
  'Patience, growth... and pruning. You have all three. The Verdant Badge is yours!',
  { smart: true }));
add(T('gym2-trainer', 'Quarry Hand Dot', 'girl', [mon('pebblit', 13), mon('pebblit', 14)], 20,
  'We dig all day and battle all night!',
  'Dig deep, they said...',
  { postDefeat: 'Brock’s Graveler endures one hit at full health. Plan for it.' }));
add(T('gym2-leader', 'Leader Brock', 'leader2', [mon('pebblit', 14), mon('golemite', 15), mon('bouldrok', 17, 'oranberry')], 100,
  'Brock. Quarry master. My team is bedrock — let us see you move the earth!',
  'Ha! The bedrock cracked! Take the Terra Badge, it is well earned.',
  { smart: true }));
add(T('gym3-trainer', 'Coil Tech Ria', 'scientist', [mon('sparkit', 18), mon('magnerock', 19)], 24,
  'Our generators run on creature static. Feel the current!',
  'Circuit... broken...',
  { postDefeat: 'Terra types ground out Volt moves entirely.' }));
add(T('gym3-leader', 'Leader Lt. Surge', 'leader3', [mon('sparkit', 19), mon('magnerock', 20), mon('voltail', 22, 'voltcharm')], 100,
  'I am Lt. Surge! Voltis City hums at my frequency. Try to keep up with it!',
  'Fully discharged! The Volt Badge is yours — wear it with a spark.',
  { smart: true }));
add(T('gym4-trainer', 'Deckhand Juno', 'swimmer', [mon('finlet', 22), mon('cascotter', 23)], 24,
  'The gym pool is seawater. My team feels right at home!',
  'Abandon ship!',
  { postDefeat: 'Misty’s Seaking outspeeds almost everything. Paralyze it!' }));
add(T('gym4-leader', 'Leader Misty', 'leader4', [mon('finlet', 23), mon('murklob', 24), mon('marlance', 26, 'aquacharm')], 100,
  'Misty, harbor master of Port Maren. The tide is coming in — can you swim?',
  'Swept me right off the deck! The Aqua Badge belongs to you.',
  { smart: true }));
add(T('gym5-trainer', 'Wind Runner Kae', 'ranger', [mon('galewing', 26), mon('battik', 27)], 26,
  'Up here, the wind decides who stands. The wind — and me!',
  'Blown clean away!',
  { postDefeat: 'Falkner’s Pidgeot dives on the second turn. Switch or shield.' }));
add(T('gym5-leader', 'Leader Falkner', 'leader5', [mon('galewing', 27), mon('battik', 28), mon('tempestrel', 30, 'galecharm')], 100,
  'Falkner of the high cliffs! My team has never touched the ground. Let us see if you can reach them!',
  'Grounded at last! Take the Gale Badge — you have earned the sky.',
  { smart: true }));
add(T('gym6-trainer', 'Forge Hand Brand', 'hiker', [mon('magmite', 30), mon('magmite', 31)], 28,
  'The forge gym burns away the unworthy!',
  'I am... slightly singed.',
  { postDefeat: 'Blaine’s creatures cannot be burned. Bring water, not fire.' }));
add(T('gym6-leader', 'Leader Blaine', 'leader6', [mon('magmite', 31), mon('flarewolf', 32), mon('magmaul', 34, 'infernocharm')], 100,
  'Blaine keeps the mountain’s forge. Everything I love is tempered in fire — including challengers!',
  'Tempered, tested, true. The Inferno Badge is yours, hot off the forge.',
  { smart: true }));
add(T('gym7-trainer', 'Shade Walker Nyx', 'lass', [mon('shadepup', 34), mon('battik', 35)], 28,
  'In Nocturne we battle by starlight only.',
  'Lights out... for me.',
  { postDefeat: 'Piers’s Houndoom strikes first from the shadows. Be faster.' }));
add(T('gym7-leader', 'Leader Piers', 'leader7', [mon('nocturnix', 36), mon('murklob', 36), mon('duskhound', 38, 'umbracharm')], 100,
  'I am Piers. Darkness is not evil — it is rest, it is depth, it is patience. Show me you understand it.',
  'You walked through my dark and came out whole. The Umbra Badge is yours.',
  { smart: true }));
add(T('gym8-trainer', 'Acolyte Sun', 'girl', [mon('glimkit', 38), mon('flutterveil', 38)], 30,
  'The light of Aurelia shines through my team!',
  'Eclipsed!',
  { postDefeat: 'Valerie’s Togetic heals itself. Bring overwhelming force.' }));
add(T('gym8-leader', 'Leader Valerie', 'leader8', [mon('glimkit', 39), mon('flutterveil', 40), mon('luminara', 42, 'luminacharm')], 100,
  'Valerie of Aurelia. Light reveals everything — including exactly how strong you are. Shall we look?',
  'Radiant! Absolutely radiant! The Lumina Badge — your eighth — is yours. The League awaits you.',
  { smart: true }));

// ------------------------------------------------------- Team Eclipse

add(T('eclipse-forest1', 'Eclipse Grunt', 'grunt', [mon('shadepup', 8), mon('battik', 8)], 24,
  'Team Eclipse business! This glowing rat is ours now. Scram!',
  'Tch! The boss will hear about this!',
  { postDefeat: 'We will swallow every light in Veridia eventually...' }));
add(T('eclipse-quarry1', 'Eclipse Grunt', 'grunt', [mon('battik', 14), mon('shadepup', 15)], 24,
  'The shards in this quarry belong to Team Eclipse!',
  'You... you dug your own grave, kid!',
  { postDefeat: 'The Director wants every Prism Shard. Do not ask why.' }));
add(T('eclipse-quarry2', 'Eclipse Grunt', 'grunt', [mon('murklob', 15)], 24,
  'Nobody saw us down here. Nobody LEAVES here either!',
  'Everyone is going to hear about this...',
  { postDefeat: 'Fine, take the shard. There are more where it came from.' }));
add(T('eclipse-port1', 'Eclipse Grunt', 'grunt', [mon('shadepup', 22), mon('battik', 22)], 24,
  'The warehouse is closed for... renovations. Eclipse renovations!',
  'The Admin is NOT going to like you.',
  { postDefeat: 'Mordent never loses. You are doomed. Doomed!' }));
add(T('eclipse-port2', 'Eclipse Grunt', 'grunt', [mon('murklob', 23)], 24,
  'You again?! Why are you ALWAYS where we are?!',
  'Why are you always STRONGER than us?!',
  { postDefeat: 'I am updating my resume after this.' }));
add(T('eclipse-admin1', 'Admin Mordent', 'admin', [mon('duskhound', 25), mon('nocturnix', 24), mon('murklob', 26, 'oranberry')], 60,
  'Mordent, Eclipse Admin. The shard shipment is mine. You are a rounding error — let me erase you.',
  'A rounding error... that rounded me down to zero.',
  { smart: true, postDefeat: 'Keep the warehouse. The Director already has what he needs.' }));
add(T('eclipse-hideout1', 'Eclipse Grunt', 'grunt', [mon('battik', 34), mon('shadepup', 34)], 24,
  'How did you find the island?! Intruder! INTRUDER!',
  'Intruder repellent... failed...',
  { postDefeat: 'The Director is at the back. You will regret this.' }));
add(T('eclipse-hideout2', 'Eclipse Grunt', 'grunt', [mon('murklob', 35), mon('nocturnix', 35)], 24,
  'The ritual needs silence. You are very, very loud.',
  'Loud AND violent. Noted.',
  { postDefeat: 'The Spire... the Director will wake what sleeps there.' }));
add(T('eclipse-admin2', 'Admin Mordent', 'admin', [mon('nocturnix', 36), mon('duskhound', 37), mon('murklob', 37, 'lumberry')], 60,
  'You. Again. I have been demoted twice because of you. NOTHING personal about what happens next.',
  'Demoted... a third time...',
  { smart: true, postDefeat: 'Go on then. The Director is past that door. Ruin his day like you ruined mine.' }));
add(T('eclipse-boss1', 'Director Noxim', 'boss', [mon('duskhound', 38), mon('magnerock', 38), mon('nocturnix', 40, 'focussash')], 120,
  'Director Noxim. Light blinds, child — only in perfect darkness do all things become equal. Team Eclipse will gift the world that equality.',
  'Dimmed... but not extinguished. The Spire will still open for me.',
  { smart: true, postDefeat: 'Keep the key. The Spire admits anyone brave enough to climb it.' }));
add(T('eclipse-boss2', 'Director Noxim', 'boss', [mon('nocturnix', 44), mon('murklob', 44), mon('magnerock', 45), mon('duskhound', 47, 'umbracharm')], 140,
  'You are too late! Necrozma stirs! When it wakes, every light in Veridia goes out at once — starting with yours!',
  'No... the eclipse... was supposed to be FOREVER...',
  { smart: true, postDefeat: 'It chose to look at you instead of me. Why? WHY?' }));

// ------------------------------------------------------- Elite Four

add(T('elite1', 'Elite Cormac', 'elite1', [mon('bouldrok', 44), mon('magmaul', 45), mon('gargantuan', 46, 'oranberry'), mon('terradon', 47, 'terracharm')], 160,
  'Cormac of the Elite Four. I am the mountain at the gate. Climb, or turn back.',
  'The mountain... moves aside.',
  { smart: true }));
add(T('elite2', 'Elite Isolde', 'elite2', [mon('marlance', 45), mon('murklob', 46), mon('cascotter', 46), mon('tidalord', 48, 'aquacharm')], 160,
  'Isolde. Second of the Four. The sea forgives nothing. Neither do I.',
  'The tide... recedes.',
  { smart: true }));
add(T('elite3', 'Elite Corvus', 'elite3', [mon('nocturnix', 46), mon('battik', 45), mon('murklob', 47), mon('duskhound', 49, 'scopelens')], 160,
  'Corvus, third of the Four. Piers taught you darkness is gentle? I am the other kind.',
  'Back... to the shadows.',
  { smart: true }));
add(T('elite4', 'Elite Liora', 'elite4', [mon('flutterveil', 46), mon('tempestrel', 47), mon('luminara', 49, 'lumberry'), mon('dracryon', 50, 'focussash')], 160,
  'Liora, last of the Four. Beyond me sits the Champion. Beyond you — probably the exit. Shall we?',
  'Blinding... in the best way. Go. The Champion waits.',
  { smart: true }));

// ----------------------------------------------- rival variants (by starter)

const RIVAL_COUNTER: Record<string, string> = {
  emberling: 'dribblet',
  dribblet: 'sproutle',
  sproutle: 'emberling',
};
const RIVAL_LINES: Record<string, [string, string, string]> = {
  dribblet: ['dribblet', 'cascotter', 'tidalord'],
  sproutle: ['sproutle', 'thornbeast', 'sylvaurus'],
  emberling: ['emberling', 'flarewolf', 'pyrothane'],
};

export function rivalTrainerId(stage: number, playerStarter: string): string {
  return `rival${stage}-${playerStarter}`;
}

for (const playerStarter of Object.keys(RIVAL_COUNTER)) {
  const line = RIVAL_LINES[RIVAL_COUNTER[playerStarter]];
  add(T(`rival1-${playerStarter}`, 'Rival Kael', 'rival', [mon(line[0], 5)], 40,
    'Heh, you picked that one? Perfect. Mine eats yours for breakfast. Let me show you!',
    'What?! Beginner’s luck. Enjoy it while it lasts.',
    { smart: true }));
  add(T(`rival2-${playerStarter}`, 'Rival Kael', 'rival', [mon('chirpuff', 12), mon(line[1], 14)], 40,
    'Still crawling around the early routes? I already have a badge. Try to keep up — actually, try to survive!',
    'Tch. You train hard, I will give you that.',
    { smart: true }));
  add(T(`rival3-${playerStarter}`, 'Rival Kael', 'rival', [mon('galewing', 22), mon('shadepup', 23), mon(line[1], 25, 'oranberry')], 40,
    'The port, the sea, the salt air — and you, again. Three badges now. You? Thought so. Battle!',
    'Every time. EVERY time. What is your secret?!',
    { smart: true }));
  add(T(`rival4-${playerStarter}`, 'Rival Kael', 'rival', [mon('tempestrel', 31), mon('duskhound', 32), mon('voltail', 31), mon(line[2], 34, 'oranberry')], 40,
    'Nocturne suits me. Dark, quiet, no distractions from training. Except you. You are the distraction. Fix that for me by losing!',
    'I keep losing the battles that matter... why?',
    { smart: true }));
  add(T(`rival5-${playerStarter}`, 'Rival Kael', 'rival', [mon('tempestrel', 42), mon('voltail', 42), mon('duskhound', 43), mon('terradon', 43), mon(line[2], 45, 'oranberry')], 40,
    'Victory Road. Fitting. One of us walks out a League challenger — and one walks home. Ready?',
    '...Go. Before I change my mind about being happy for you.',
    { smart: true }));
  add(T(`champion-${playerStarter}`, 'Champion Kael', 'champion', [
    mon('tempestrel', 50), mon('voltail', 50), mon('gargantuan', 51), mon('duskhound', 51, 'scopelens'), mon('luminara', 51, 'lumberry'), mon(line[2], 53, 'oranberry'),
  ], 200,
    'Surprised? I beat the Elite Four two days ago. Champion Kael — has a ring to it. You and me, one last time. Everything we have. No excuses, no luck. The whole journey comes down to this!',
    'No excuses. No luck. You are... the better trainer. Champion.',
    { smart: true }));
}

export function trainerById(id: string): TrainerDef {
  const t = TRAINERS[id];
  if (!t) throw new Error(`Unknown trainer: ${id}`);
  return t;
}
