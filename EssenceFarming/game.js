/* ==========================================================
   Essence Farming — game engine.
   Save key and state shape are kept from the original
   ("df_v5_save") so existing saves keep working.

   Everything runs on ONE page (index.html, with tabs). It used to be four
   pages, and browsers that give every file:// page its own storage ended up
   with four separate saves.
   ========================================================== */
const SAVE_KEY = 'df_v5_save';
const fmt = (n) => Arcade.fmt(n);

const BASE_STATE = {
    essence: 50, crystals: 0, hireCost: 15, farmers: [],
    dust: 0, autoDust: 0, voidFocus: 0, harvestChain: 0, orbLvl: 0,
    researchUnlocked: false, dm: 0, dmTier: 0,
    expUnlocked: false, expMult: 1,
    dustMultClick: 1, dustMultSec: 1, milestoneMod: 1,
    diamonds: 0, rubies: 0, autoCondense: false,
    d_up1: 0, d_up2: 0, r_up1: 0, r_up2: 0,
    dustUpLvl: 0, mileUpLvl: 0,
    ghUnlocked: false, plots: 1, ghCrops: [],
    selectedCrop: 'wheat', unlockedCrops: ['wheat'],
    cropInventory: { wheat: 0, corn: 0, soy: 0, potato: 0, pumpkin: 0, starfruit: 0, bloom: 0 },
    goldenCrops: 0, diamondCrops: 0,
    upgrades: { wheat: [0, 0, 0], corn: [0, 0, 0], soy: [0, 0, 0], potato: [0, 0, 0], pumpkin: [0, 0, 0], starfruit: [0, 0, 0], bloom: [0, 0, 0] },
    rareUpgrades: { goldEff: 0, diamMast: 0 },
    clicks: 0, multiplier: 1, totalGain: 0,
    lastUpdate: Date.now(),
    // ---- added in v6 ----
    runEssence: 0, lifetimeEssence: 0,
    frontier: null,                       // { aether, tiles: { 'x,y': { b, lvl } }, seed, projects: {} }
    autoHarvest: false,
    // ---- kept through ascension ----
    seeds: 0, totalSeeds: 0, ascensions: 0, perks: {}, relics: {}, bestRun: 0,
    hybrids: {}, discovered: [], history: [], events: { seen: 0, storms: 0, merchants: 0 },
    // ---- transcendence (second prestige) ----
    shards: 0, totalShards: 0, transcends: 0, tUps: {}, seedsSinceT: 0,
};
const KEEP_ON_ASCEND = ['seeds', 'totalSeeds', 'ascensions', 'perks', 'relics', 'bestRun', 'lifetimeEssence', 'lastUpdate',
    'hybrids', 'discovered', 'history', 'events', 'shards', 'totalShards', 'transcends', 'tUps', 'seedsSinceT'];

/* ---------- Crops ---------- */
const CROPS = {
    wheat:     { icon: '🌾', name: 'Wheat',     time: 100,  cost: 0,    tier: 1 },
    corn:      { icon: '🌽', name: 'Corn',      time: 300,  cost: 1e18, tier: 3 },
    soy:       { icon: '🌱', name: 'Soy',       time: 600,  cost: 1e21, tier: 8 },
    potato:    { icon: '🥔', name: 'Potato',    time: 1200, cost: 1e25, tier: 20 },
    pumpkin:   { icon: '🎃', name: 'Pumpkin',   time: 2400, cost: 1e29, tier: 50 },
    starfruit: { icon: '⭐', name: 'Starfruit', time: 3600, cost: 1e34, tier: 140 },
    bloom:     { icon: '🌺', name: 'Void Bloom', time: 6000, cost: 1e40, tier: 400 },
};
const CROP_KEYS = Object.keys(CROPS);
const CROP_UPGRADES = {
    wheat: [
        { name: 'Wheat Yield', desc: (l) => `×${1 + l} wheat per harvest` },
        { name: 'Crop Growth', desc: (l) => `All crops grow ${10 * l}% faster` },
        { name: 'Essence Grains', desc: (l) => `Harvests give ${(l * 10)}% of your yield/s as essence (× crop tier)` },
    ],
    corn: [
        { name: 'Corn Yield', desc: (l) => `×${1 + l} corn per harvest` },
        { name: 'Dusty Corn', desc: (l) => `+${l * 50}% passive void dust` },
        { name: 'Bulk Growth', desc: (l) => `Stack up to ${1 + l} seeds in one plot` },
    ],
    soy: [
        { name: 'Soy Yield', desc: (l) => `×${1 + l} soy per harvest` },
        { name: 'Milestone Soil', desc: (l) => `×${(1 + l * 0.1).toFixed(1)} global yield` },
        { name: 'Tofu Power', desc: (l) => `+${(l * 0.2).toFixed(1)}% diamond crop chance` },
    ],
    potato: [
        { name: 'Potato Yield', desc: (l) => `×${1 + l} potatoes per harvest` },
        { name: 'Gem Roots', desc: (l) => `${l * 3}% chance per harvest to dig up a diamond` },
        { name: 'Mashed Essence', desc: (l) => `×${1 + l} Essence Grains value` },
    ],
    pumpkin: [
        { name: 'Pumpkin Yield', desc: (l) => `×${1 + l} pumpkins per harvest` },
        { name: 'Spirit Blessing', desc: (l) => `+${l}% golden crop chance` },
        { name: "Jack's Fortune", desc: (l) => `Pumpkin harvests roll ×1–×${2 + l}` },
    ],
    starfruit: [
        { name: 'Starfruit Yield', desc: (l) => `×${1 + l} starfruit per harvest` },
        { name: 'Stellar Dust', desc: (l) => `Harvests also give ${l * 5}s of passive dust` },
        { name: 'Aether Sap', desc: (l) => `+${l * 10}% Aether production` },
    ],
    bloom: [
        { name: 'Bloom Yield', desc: (l) => `×${1 + l} void blooms per harvest` },
        { name: 'Dark Pollen', desc: (l) => `+${l * 15}% dark matter from condensing` },
        { name: 'Soul Nectar', desc: (l) => `+${l * 3}% soul seeds on ascension` },
    ],
};
const CROP_BASE_PRICE = { wheat: 10, corn: 15, soy: 30, potato: 40, pumpkin: 50, starfruit: 60, bloom: 80 };

/* ---------- Hybrids: cross-breed two crops (or get lucky with a mutation between neighbouring plots) ---------- */
const HYBRIDS = {
    maize:    { a: 'wheat', b: 'corn', icon: '🌟', name: 'Golden Maize', kind: 'ess', per: 0.05, label: 'essence' },
    dustbean: { a: 'corn', b: 'soy', icon: '🫘', name: 'Dust Bean', kind: 'dust', per: 0.08, label: 'void dust' },
    gemtuber: { a: 'soy', b: 'potato', icon: '💠', name: 'Gem Tuber', kind: 'gems', per: 0.06, label: 'gem finds' },
    squash:   { a: 'potato', b: 'pumpkin', icon: '🍈', name: 'Spirit Squash', kind: 'grow', per: 0.05, label: 'crop growth' },
    gourd:    { a: 'pumpkin', b: 'starfruit', icon: '☄️', name: 'Comet Gourd', kind: 'aether', per: 0.08, label: 'Aether' },
    lotus:    { a: 'starfruit', b: 'bloom', icon: '🪷', name: 'Nebula Lotus', kind: 'dm', per: 0.08, label: 'dark matter' },
    rye:      { a: 'wheat', b: 'bloom', icon: '🥀', name: 'Void Rye', kind: 'seeds', per: 0.02, label: 'soul seeds' },
};
const hybridOf = (x, y) => Object.keys(HYBRIDS).find(k => (HYBRIDS[k].a === x && HYBRIDS[k].b === y) || (HYBRIDS[k].a === y && HYBRIDS[k].b === x)) || null;
const hybridCount = (k) => (state.hybrids && state.hybrids[k]) || 0;
function hybridBonus(kind) {
    let t = 0;
    for (const [k, H] of Object.entries(HYBRIDS)) if (H.kind === kind) t += H.per * Math.pow(hybridCount(k), 0.8);
    return t * Math.pow(1.5, tLvl('sprout'));
}
const breedCost = (k) => Math.ceil(25 * Math.pow(1 + hybridCount(k), 1.35));
function gainHybrid(k, n) {
    state.hybrids[k] = hybridCount(k) + (n || 1);
    const fresh = !state.discovered.includes(k);
    if (fresh) state.discovered.push(k);
    return fresh;
}
/** Spend crops of both parents for a 65% chance at one hybrid. */
function crossBreed(x, y) {
    const k = hybridOf(x, y);
    if (!k) return { ok: false, why: 'These two won\'t cross' };
    const c = breedCost(k);
    if (state.cropInventory[x] < c || state.cropInventory[y] < c) return { ok: false, why: `Needs ${fmt(c)} of each parent` };
    state.cropInventory[x] -= c; state.cropInventory[y] -= c;
    if (Math.random() < 0.65) { const fresh = gainHybrid(k); save(); return { ok: true, k, fresh }; }
    save();
    return { ok: false, why: 'The seeds didn\'t take this time', spent: true };
}

/* ---------- Transcendence: the prestige above ascension ---------- */
const TRANSCEND_ASC = 5, TRANSCEND_SEEDS = 1000;
const TUPS = {
    eternal: { icon: '♾️', name: 'Eternal Harvest', desc: (l) => `×${Math.pow(3, l)} essence`, base: 1, grow: 2, max: 12 },
    echo:    { icon: '🔔', name: 'Seed Echo', desc: (l) => `×${Math.pow(1.5, l).toFixed(2)} soul seeds from ascending`, base: 1, grow: 2.2, max: 10 },
    aether:  { icon: '✦', name: 'Aether Well', desc: (l) => `×${Math.pow(2, l)} Aether`, base: 2, grow: 2, max: 8 },
    memory:  { icon: '🧠', name: 'Deep Memory', desc: (l) => `Keep ${l * 20}% of perk levels when you transcend`, base: 3, grow: 2.5, max: 5 },
    genesis: { icon: '🌱', name: 'Genesis', desc: () => 'Every run starts with the greenhouse, 4 plots and corn', base: 4, grow: 1, max: 1 },
    sprout:  { icon: '🧬', name: 'Hybrid Vigour', desc: (l) => `Hybrid bonuses ×${Math.pow(1.5, l).toFixed(2)}`, base: 2, grow: 2.4, max: 5 },
};
const tLvl = (k) => (state.tUps && state.tUps[k]) || 0;
const tCost = (k) => Math.ceil(TUPS[k].base * Math.pow(TUPS[k].grow, tLvl(k)));
function shardGain() {
    if (state.ascensions < TRANSCEND_ASC || state.seedsSinceT < TRANSCEND_SEEDS) return 0;
    return Math.max(1, Math.floor(Math.sqrt(state.seedsSinceT / 250)));
}

/* ---------- Ascension perks & relics ---------- */
const PERKS = {
    quick:    { icon: '⚡', name: 'Quick Start', desc: (l) => `Start runs with ${fmt(50 * Math.pow(100, l))} essence`, base: 2, grow: 1.6, max: 15 },
    veteran:  { icon: '👨‍🌾', name: 'Veteran Hands', desc: (l) => `Start runs with ${l} extra farmer${l === 1 ? '' : 's'}`, base: 3, grow: 1.8, max: 10 },
    crystal:  { icon: '💠', name: 'Void Memory', desc: (l) => `Start runs with ${l * 3} void crystals`, base: 4, grow: 1.7, max: 20 },
    orb:      { icon: '🔮', name: 'Orb Mastery', desc: (l) => `Orb multiplier keeps compounding for ${400 + l * 100} clicks`, base: 3, grow: 1.6, max: 20 },
    mile:     { icon: '📈', name: 'Milestone Mastery', desc: (l) => `Every 10 farmer levels gives ×${(2 + l * 0.1).toFixed(1)} instead of ×2`, base: 8, grow: 2.2, max: 10 },
    lab:      { icon: '🔬', name: 'Lab Grant', desc: (l) => `Research starts unlocked · +${(l - 1) * 50}% dark matter`, base: 10, grow: 2, max: 10 },
    vault:    { icon: '🏡', name: 'Seed Vault', desc: (l) => `Greenhouse starts unlocked · +${l * 25}% crop yield`, base: 15, grow: 2, max: 10 },
    golden:   { icon: '🌟', name: 'Golden Thumb', desc: (l) => `+${l * 2}% golden crop chance`, base: 5, grow: 1.7, max: 10 },
    auto:     { icon: '🤖', name: 'Green Thumbs', desc: () => 'The greenhouse harvests and replants by itself', base: 30, grow: 1, max: 1 },
    map:      { icon: '🗺️', name: 'Cartographer', desc: (l) => `Frontier starts unlocked · +${l * 25}% Aether`, base: 25, grow: 2.2, max: 10 },
    warp:     { icon: '⏳', name: 'Time Warp', desc: (l) => `+${l * 2}h offline time, +${l * 10}% offline gains`, base: 6, grow: 1.8, max: 8 },
    bloom:    { icon: '🌸', name: 'Soul Bloom', desc: (l) => `Each soul seed gives +${10 + l * 2}% essence`, base: 20, grow: 2.5, max: 25 },
};
const RELICS = {
    idol:      { icon: '🗿', name: 'Essence Idol', desc: '+20% essence' },
    compass:   { icon: '🧭', name: 'Old Compass', desc: '−5% frontier claim cost' },
    lens:      { icon: '🔭', name: 'Void Lens', desc: '+15% void dust' },
    sickle:    { icon: '🌙', name: 'Moon Sickle', desc: 'Crops grow 10% faster' },
    crown:     { icon: '👑', name: 'Seed Crown', desc: '+5% soul seeds on ascension' },
    prism:     { icon: '🔺', name: 'Dark Prism', desc: '+15% dark matter' },
    hourglass: { icon: '⌛', name: 'Hourglass', desc: '+1h offline time' },
    heart:     { icon: '💗', name: 'Gem Heart', desc: '+15% gem finds' },
};
const RELIC_MAX = 10;

/* ---------- Frontier ---------- */
const BIOMES = {
    home:     { icon: '🏠', name: 'Homestead', aether: 1, up: 15, bonus: null, color: '#3f6212' },
    meadow:   { icon: '🌾', name: 'Meadow', aether: 1, up: 20, bonus: ['ess', 0.06, '+6% essence'], color: '#4d7c0f' },
    forest:   { icon: '🌲', name: 'Forest', aether: 2, up: 30, bonus: ['dust', 0.1, '+10% void dust'], color: '#166534' },
    lake:     { icon: '💧', name: 'Lake', aether: 1.5, up: 25, bonus: ['grow', 0.06, '+6% crop growth'], color: '#0e7490' },
    mountain: { icon: '⛰️', name: 'Mountain', aether: 3, up: 40, bonus: ['gems', 0.08, '+8% gem finds'], color: '#57534e' },
    crystal:  { icon: '💠', name: 'Crystal Field', aether: 5, up: 70, bonus: ['dm', 0.08, '+8% dark matter'], color: '#4338ca' },
    rift:     { icon: '🌀', name: 'Void Rift', aether: 8, up: 110, bonus: ['orb', 0.1, '+10% orb dust'], color: '#6b21a8' },
    sky:      { icon: '☁️', name: 'Sky Isle', aether: 15, up: 200, bonus: ['all', 0.04, '+4% all essence & dust'], color: '#0369a1' },
    ruins:    { icon: '🏛️', name: 'Ancient Ruins', aether: 0.5, up: 60, bonus: ['seeds', 0.02, '+2% soul seeds'], color: '#78350f' },
};
const PROJECTS = {
    leyline:  { icon: '〰️', name: 'Ley Lines', desc: (l) => `×${Math.pow(2, l)} essence yield`, base: 400, grow: 9, max: 30 },
    pump:     { icon: '⛽', name: 'Dust Pump', desc: (l) => `×${Math.pow(2, l)} void dust`, base: 300, grow: 8, max: 30 },
    array:    { icon: '📡', name: 'Condenser Array', desc: (l) => `×${Math.pow(2, l)} dark matter`, base: 600, grow: 10, max: 25 },
    sprinkle: { icon: '🚿', name: 'Sprinklers', desc: (l) => `Crops grow ${l * 25}% faster`, base: 250, grow: 6, max: 20 },
    harvester:{ icon: '🤖', name: 'Auto-Harvester', desc: () => 'Greenhouse harvests and replants by itself', base: 1500, grow: 1, max: 1 },
    scouts:   { icon: '🔦', name: 'Scouts', desc: (l) => `Claiming land costs ${l * 4}% less`, base: 800, grow: 5, max: 15 },
};
const FRONTIER_COST = 1e21;

function hash2(x, y, s) {
    let h = Math.imul(x ^ 0x27d4eb2d, 0x85ebca6b) ^ Math.imul(y + 0x165667b1, 0xc2b2ae35) ^ (s | 0);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
}
const ring = (x, y) => Math.max(Math.abs(x), Math.abs(y));
function biomeAt(x, y) {
    if (!x && !y) return 'home';
    const d = ring(x, y), r = hash2(x, y, state.frontier.seed);
    if (r < 0.06) return 'ruins';
    // further out the land gets richer
    const table = [['meadow', 30], ['forest', 26], ['lake', 18], ['mountain', 14 + d], ['crystal', d > 1 ? 6 + d * 1.5 : 0], ['rift', d > 2 ? 3 + d : 0], ['sky', d > 4 ? 1 + d * 0.6 : 0]];
    const tot = table.reduce((a, t) => a + t[1], 0);
    let k = hash2(y, x, state.frontier.seed + 99) * tot;
    for (const [b, w] of table) { k -= w; if (k <= 0) return b; }
    return 'meadow';
}

/* ---------- State & migration ---------- */
function migrate(s) {
    s = s && typeof s === 'object' ? s : {};
    for (const k in BASE_STATE) if (s[k] === undefined || (s[k] === null && BASE_STATE[k] !== null)) s[k] = structuredClone(BASE_STATE[k]);
    s.upgrades = s.upgrades || {};
    s.cropInventory = s.cropInventory || {};
    for (const c of CROP_KEYS) {
        if (!Array.isArray(s.upgrades[c])) s.upgrades[c] = [0, 0, 0];
        if (typeof s.cropInventory[c] !== 'number') s.cropInventory[c] = 0;
    }
    s.rareUpgrades = Object.assign({ goldEff: 0, diamMast: 0 }, s.rareUpgrades);
    s.hybrids = s.hybrids || {}; s.discovered = s.discovered || []; s.tUps = s.tUps || {};
    s.events = Object.assign({ seen: 0, storms: 0, merchants: 0 }, s.events);
    if (!Array.isArray(s.history)) s.history = [];
    s.perks = s.perks || {}; s.relics = s.relics || {};
    s.farmers.forEach(f => { f.mult = f.mult || 1; f.cost = f.cost || 10; f.exp = f.exp || 0; f.m_lvl = f.m_lvl || 0; });
    if (s.frontier && !s.frontier.projects) s.frontier.projects = {};
    return s;
}

let state = migrate(Arcade.load(SAVE_KEY, null));

function save() {
    state.lastUpdate = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { }
}

/* ---------- Only one tab runs the economy ---------- */
const TAB_ID = Math.random().toString(36).slice(2);
function isMaster() {
    const lock = Arcade.load(SAVE_KEY + '.lock', null), now = Date.now();
    if (!lock || lock.id === TAB_ID || now - lock.t > 1500) { Arcade.save(SAVE_KEY + '.lock', { id: TAB_ID, t: now }); return true; }
    return false;
}
window.addEventListener('storage', (e) => {
    if (e.key === SAVE_KEY && e.newValue) { try { state = migrate(JSON.parse(e.newValue)); } catch (err) { } }
});
// coming back through the back/forward cache restores an old copy in memory
window.addEventListener('pageshow', (e) => { if (e.persisted) state = migrate(Arcade.load(SAVE_KEY, null)); });

/* ---------- Bonuses ---------- */
const perk = (k) => state.perks[k] || 0;
const relic = (k) => state.relics[k] || 0;
const project = (k) => (state.frontier && state.frontier.projects[k]) || 0;
// sum of a biome bonus across every claimed tile (bonus × tile level)
function landBonus(kind) {
    if (!state.frontier) return 0;
    let t = 0;
    for (const tile of Object.values(state.frontier.tiles)) {
        const B = BIOMES[tile.b];
        if (B.bonus && (B.bonus[0] === kind || (kind !== 'seeds' && kind !== 'gems' && kind !== 'grow' && B.bonus[0] === 'all' && (kind === 'ess' || kind === 'dust')))) t += B.bonus[1] * tile.lvl;
    }
    return t;
}
const seedBonus = () => 1 + state.seeds * (0.1 + perk('bloom') * 0.02);
const vBoost = () => Math.pow(1.15, state.crystals || 0) * (1 + (state.d_up1 || 0) * 0.05);
const milestonePower = () => (1 + (state.voidFocus || 0) * 0.12) * (state.milestoneMod || 1);
function globalMult() {
    return vBoost()
        * (1 + (state.r_up2 || 0) * 0.25)
        * (1 + state.upgrades.soy[1] * 0.1)
        * Math.pow(1.15, state.rareUpgrades.diamMast || 0)
        * seedBonus()
        * (1 + relic('idol') * 0.2)
        * (1 + landBonus('ess'))
        * Math.pow(2, project('leyline'))
        * (1 + hybridBonus('ess'))
        * Math.pow(3, tLvl('eternal'));
}
// Farmer EXP milestones: ×1.6 each (they used to double forever, which broke the late game)
const expBonus = (f) => Math.pow(1.6, f.m_lvl || 0) * (1 + (state.r_up1 || 0) * 0.2);
const expReq = (f) => 10 * Math.pow(2.6, f.m_lvl || 0);
const farmerYield = (f) => f.level * f.mult * milestonePower() * expBonus(f) * globalMult();
const totalYield = () => state.farmers.reduce((a, f) => a + farmerYield(f), 0);
const costReduction = () => Math.max(0.5, 1 - (state.d_up2 || 0) * 0.01);
const farmerCost = (f) => f.cost * costReduction();
const dustMult = () => (state.dustMultSec || 1) * (1 + relic('lens') * 0.15) * (1 + landBonus('dust')) * Math.pow(2, project('pump')) * (1 + hybridBonus('dust'));
const passiveDust = () => Math.pow(state.autoDust || 0, 2.5) * 0.1 * dustMult() * (1 + state.upgrades.corn[1] * 0.5);
const orbCap = () => 400 + perk('orb') * 100;
const orbMultiplier = () => Math.pow(1.01, Math.min(state.clicks, orbCap())) * (1 + Math.max(0, state.clicks - orbCap()) * 0.002);
const orbGain = () => (1 + (state.orbLvl || 0)) * orbMultiplier() * (state.dustMultClick || 1) * (1 + landBonus('orb')) * (1 + relic('lens') * 0.15) * Math.pow(2, project('pump'));
const condenseCost = () => 1e6 * Math.pow(25, state.dmTier || 0);
const dmMult = () => (1 + Math.max(0, perk('lab') - 1) * 0.5) * (1 + relic('prism') * 0.15) * (1 + landBonus('dm')) * (1 + state.upgrades.bloom[1] * 0.15) * Math.pow(2, project('array')) * (1 + hybridBonus('dm'));
const condenseGain = () => Math.pow(10, state.dmTier || 0) * dmMult();
const growSpeed = () => (1 + state.upgrades.wheat[1] * 0.1) * (1 + relic('sickle') * 0.1) * (1 + landBonus('grow')) * (1 + project('sprinkle') * 0.25) * (1 + hybridBonus('grow')) * (eventOn('rain') ? 1.5 : 1);
const gemLuck = () => (1 + state.upgrades.potato[1] * 0.03) * (1 + relic('heart') * 0.15) * (1 + landBonus('gems')) * (1 + hybridBonus('gems'));
const cropYieldMult = () => 1 + perk('vault') * 0.25;
const offlineHours = () => 8 + perk('warp') * 2 + relic('hourglass');
const tenMilestone = () => 2 + perk('mile') * 0.1;

/* ---------- Costs ---------- */
function cropUpgradeCost(crop, i) {
    const lvl = state.upgrades[crop][i];
    if (crop === 'corn' && i === 2) return Math.floor(5 * Math.pow(5, lvl));
    const base = CROP_BASE_PRICE[crop];
    return Math.floor((base + i * base * 2) * Math.pow(1.2, lvl));
}
const plotCost = () => Math.floor(15 * Math.pow(2, state.plots - 1));
const MAX_PLOTS = 20;
const GH_COST = 1e16;
const RESEARCH_COST = 300000;
const tierCost = () => 100 * Math.pow(12, state.dmTier || 0);
const dustInfuseCost = () => 15 * Math.pow(3, state.dustUpLvl || 0);
const mileTuneCost = () => 75 * Math.pow(3, state.mileUpLvl || 0);
const gemCost = (k) => Math.floor(Math.pow(2.2, state[k] || 0));
const goldEffCost = () => 10 + state.rareUpgrades.goldEff * 5;
const diamMastCost = () => 5 + state.rareUpgrades.diamMast * 3;
const perkCost = (k) => Math.ceil(PERKS[k].base * Math.pow(PERKS[k].grow, perk(k)));
const projectCost = (k) => Math.ceil(PROJECTS[k].base * Math.pow(PROJECTS[k].grow, project(k)));

const VOID_SHOP = {
    crystals: { name: 'Void Crystal', desc: '×1.15 to all yield', cur: 'essence', base: 500, scale: 2.8 },
    autoDust: { name: 'Dust Well', desc: 'Passive dust income', cur: 'dust', base: 50, scale: 2.2 },
    voidFocus: { name: 'Void Focus', desc: '+12% milestone power', cur: 'dust', base: 1000, scale: 5 },
    harvestChain: { name: 'Harvest Chain', desc: 'Levelling a farmer bursts essence', cur: 'dust', base: 5000, scale: 6 },
};
const voidCost = (key) => VOID_SHOP[key].base * Math.pow(VOID_SHOP[key].scale, state[key] || 0);

/* ---------- Essence bookkeeping ---------- */
function addEssence(x) {
    state.essence += x;
    state.runEssence += x;
    state.lifetimeEssence += x;
}

/* ---------- Farm actions ---------- */
function hire(free) {
    if (!free && state.essence < state.hireCost) return false;
    if (!free) state.essence -= state.hireCost;
    state.farmers.push({ level: 1, cost: 10, mult: 1, exp: 0, m_lvl: 0 });
    const n = state.farmers.length;
    state.hireCost *= n < 10 ? 1.8 : n < 15 ? 2.5 : 8.0;
    if (!free) { Arcade.sfx('level'); save(); }
    return true;
}

function upgradeFarmer(i, quiet) {
    const f = state.farmers[i];
    const c = farmerCost(f);
    if (state.essence < c) return false;
    state.essence -= c;
    f.level++;
    f.cost *= f.level > 100 ? 1.4 : 1.22;
    if (f.level % 10 === 0) f.mult *= tenMilestone();
    if (f.level % 25 === 0) f.mult *= 2.5;
    if (state.harvestChain > 0) addEssence(f.level * f.mult * milestonePower() * vBoost() * 3 * state.harvestChain);
    if (!quiet) { Arcade.sfx(f.level % 10 === 0 ? 'power' : 'coin'); save(); }
    return true;
}

function buyAllUpgrades() {
    let bought = 0, guard = 0;
    while (guard++ < 5000) {
        let best = -1, bc = Infinity;
        state.farmers.forEach((f, i) => { const c = farmerCost(f); if (c < bc) { bc = c; best = i; } });
        if (best < 0 || state.essence < bc) break;
        upgradeFarmer(best, true);
        bought++;
    }
    if (bought) { Arcade.sfx('power'); save(); }
    return bought;
}

function unlockGreenhouse() {
    if (state.ghUnlocked || state.essence < GH_COST) { Arcade.sfx('bad'); return false; }
    state.essence -= GH_COST; state.ghUnlocked = true; save();
    Arcade.toast('Greenhouse unlocked!', 'gold'); Arcade.sfx('win');
    return true;
}

/* ---------- Void ---------- */
function buyVoid(key) {
    const s = VOID_SHOP[key], c = voidCost(key);
    if (state[s.cur] < c) { Arcade.sfx('bad'); return false; }
    state[s.cur] -= c;
    state[key] = (state[key] || 0) + 1;
    Arcade.sfx('coin');
    save();
    return true;
}
function infuseOrb() {
    const c = Math.pow(2, state.orbLvl || 0);
    if (state.dust < c) { Arcade.sfx('bad'); return false; }
    state.dust -= c; state.orbLvl++; save(); Arcade.sfx('coin');
    return true;
}
function clickOrb(bonus) {
    state.clicks++;
    state.multiplier = orbMultiplier();
    const gain = orbGain() * (bonus || 1);
    state.dust += gain;
    save();
    return gain;
}
function unlockResearch() {
    if (state.researchUnlocked || state.dust < RESEARCH_COST) { Arcade.sfx('bad'); return false; }
    state.dust -= RESEARCH_COST; state.researchUnlocked = true; save();
    Arcade.toast('Research Lab unlocked!', 'gold'); Arcade.sfx('win');
    return true;
}

/* ---------- Research ---------- */
function condense() {
    if (state.essence < condenseCost()) return false;
    state.essence -= condenseCost();
    state.dm += condenseGain();
    save();
    return true;
}
function researchBuy(kind) {
    const spend = (c) => { if (state.dm < c) { Arcade.sfx('bad'); return false; } state.dm -= c; return true; };
    if (kind === 'exp') { if (state.expUnlocked || !spend(50)) return false; state.expUnlocked = true; Arcade.sfx('win'); }
    else if (kind === 'tier') { if (!spend(tierCost())) return false; state.dmTier++; Arcade.sfx('power'); }
    else if (kind === 'dust') { if (!spend(dustInfuseCost())) return false; state.dustUpLvl++; state.dustMultSec *= 1.6; state.dustMultClick *= 1.35; Arcade.sfx('coin'); }
    else if (kind === 'mile') { if (!spend(mileTuneCost())) return false; state.mileUpLvl++; state.milestoneMod *= 1.1; Arcade.sfx('coin'); }
    save();
    return true;
}
function forgeGem(k, cur) {
    const c = gemCost(k);
    if (state[cur] < c) { Arcade.sfx('bad'); return false; }
    state[cur] -= c; state[k] = (state[k] || 0) + 1; save(); Arcade.sfx('power');
    return true;
}

/* ---------- Greenhouse ---------- */
function plant(i, type) {
    state.ghCrops[i] = { type, status: 'growing', progress: 0, stack: 1, time: CROPS[type].time };
}
function harvest(i, quiet) {
    const p = state.ghCrops[i], t = p.type, ups = state.upgrades[t], stack = p.stack || 1;
    let mult = (1 + ups[0]) * cropYieldMult();
    let roll = 1;
    if (t === 'pumpkin' && ups[2] > 0) { roll = Arcade.randi(1, 2 + ups[2]); mult *= roll; }
    const crops = Math.floor(stack * mult);
    state.cropInventory[t] += crops;
    const out = { crops, roll, type: t, grains: 0, rare: null };
    const grains = state.upgrades.wheat[2] * 0.1 * (state.totalGain || 1) * CROPS[t].tier * stack * (1 + state.upgrades.potato[2]);
    if (grains > 0) { addEssence(grains); out.grains = grains; }
    if (t === 'starfruit' && ups[1]) state.dust += passiveDust() * ups[1] * 5 * stack;
    const r = Math.random();
    const diamLuck = 0.001 + state.upgrades.soy[2] * 0.002;
    const goldLuck = diamLuck + 0.01 + state.upgrades.pumpkin[1] * 0.01 + perk('golden') * 0.02;
    if (r < diamLuck) { state.diamondCrops += stack; out.rare = 'diamond'; }
    else if (r < goldLuck) { state.goldenCrops += stack; out.rare = 'gold'; }
    if (Math.random() < state.upgrades.potato[1] * 0.03 * gemLuck()) { state.diamonds++; out.gem = true; }
    // mutation: a crop next to a different crop can cross-pollinate into a hybrid
    for (const j of [i - 1, i + 1, i - 5, i + 5]) {
        const n = state.ghCrops[j];
        if (j < 0 || j >= state.plots || !n || (n.status !== 'growing' && n.status !== 'ready') || n.type === t) continue;
        const h = hybridOf(t, n.type);
        if (h && Math.random() < 0.04) { out.mutation = h; out.freshHybrid = gainHybrid(h); break; }
    }
    state.ghCrops[i] = { status: 'empty' };
    return out;
}
const autoHarvesting = () => perk('auto') > 0 || project('harvester') > 0;
function harvestAll() {
    let n = 0, total = 0, rares = 0;
    for (let i = 0; i < state.plots; i++) {
        const p = state.ghCrops[i];
        if (p && p.status === 'ready') { const o = harvest(i, true); n++; total += o.crops; if (o.rare) rares++; }
    }
    return { n, total, rares };
}
function plantAll(type) {
    let n = 0;
    for (let i = 0; i < state.plots; i++) {
        const p = state.ghCrops[i];
        if (!p || p.status === 'empty') { plant(i, type); n++; }
    }
    return n;
}
function buyPlot() {
    const c = plotCost();
    if (state.plots >= MAX_PLOTS || state.cropInventory.wheat < c) { Arcade.sfx('bad'); return false; }
    state.cropInventory.wheat -= c; state.plots++; save(); Arcade.sfx('coin');
    return true;
}
function unlockNextCrop() {
    const next = CROP_KEYS[state.unlockedCrops.length];
    if (!next || state.essence < CROPS[next].cost) { Arcade.sfx('bad'); return null; }
    state.essence -= CROPS[next].cost; state.unlockedCrops.push(next); state.selectedCrop = next;
    save(); Arcade.sfx('win');
    return next;
}
function buyCropUpgrade(crop, i) {
    const cost = cropUpgradeCost(crop, i);
    if (state.cropInventory[crop] < cost) { Arcade.sfx('bad'); return false; }
    state.cropInventory[crop] -= cost; state.upgrades[crop][i]++; save(); Arcade.sfx('coin');
    return true;
}
const goldValue = () => state.goldenCrops * (state.totalGain || 1) * 600 * (1 + state.rareUpgrades.goldEff * 0.25);
const diamValue = () => state.diamondCrops * (state.totalGain || 1) * 1800;

/* ---------- Frontier ---------- */
function unlockFrontier(free) {
    if (state.frontier) return false;
    if (!free) { if (state.essence < FRONTIER_COST) { Arcade.sfx('bad'); return false; } state.essence -= FRONTIER_COST; }
    state.frontier = { aether: 0, seed: (Math.random() * 1e9) | 0, tiles: { '0,0': { b: 'home', lvl: 1 } }, projects: {} };
    if (!free) { save(); Arcade.toast('🗺️ The Frontier is open!', 'gold'); Arcade.sfx('win'); }
    return true;
}
const claimedCount = () => Object.keys(state.frontier.tiles).length;
const claimCost = (x, y) => eventOn('explorer') ? 0 : Math.ceil(20 * Math.pow(1.42, claimedCount() - 1) * (1 + ring(x, y) * 0.35) * Math.max(0.3, 1 - relic('compass') * 0.05 - project('scouts') * 0.04));
const tileUpCost = (t, x, y) => Math.ceil(BIOMES[t.b].up * Math.pow(2.6, t.lvl - 1) * (1 + ring(x, y) * 0.25));
const aetherMult = () => (1 + perk('map') * 0.25) * (1 + state.upgrades.starfruit[2] * 0.1) * (1 + hybridBonus('aether')) * Math.pow(2, tLvl('aether')) * (eventOn('storm') ? 0.5 : 1);

/* ---------- Frontier events ---------- */
// storm: halves Aether until it passes (or you pay to calm it — that brings rain, +50% crop growth)
// merchant: three one-off deals · bloom: collect a burst of Aether · explorer: your next claim is free
const EVENTS = {
    storm: { icon: '⛈️', name: 'Storm', secs: 75 },
    rain: { icon: '🌧️', name: 'Gentle rain', secs: 120 },
    merchant: { icon: '🧙', name: 'Wandering merchant', secs: 150 },
    bloom: { icon: '🌈', name: 'Aether bloom', secs: 45 },
    explorer: { icon: '🧭', name: 'Lost explorer', secs: 120 },
};
const eventOn = (k) => !!(state.frontier && state.frontier.event && state.frontier.event.kind === k && Date.now() < state.frontier.event.until)
    || (k === 'rain' && state.frontier && state.frontier.rainUntil > Date.now());
function rollEvent() {
    const F = state.frontier;
    if (!F) return;
    const now = Date.now();
    if (F.event && now >= F.event.until) F.event = null;
    if (!F.nextEvent) F.nextEvent = now + Arcade.rand(120, 240) * 1000;
    if (F.event || now < F.nextEvent) return;
    F.nextEvent = now + Arcade.rand(180, 360) * 1000;
    const kind = Arcade.pick(['storm', 'merchant', 'merchant', 'bloom', 'bloom', 'explorer']);
    const ev = { kind, until: now + EVENTS[kind].secs * 1000 };
    if (kind === 'merchant') {
        const rate = Math.max(1, aetherPerSec() / aetherMult());
        ev.offers = [
            { id: 'relic', label: 'A dusty relic', cost: Math.ceil(rate * 900), cur: 'aether', done: false },
            { id: 'aether', label: `✦ ${fmt(rate * 400)} Aether`, cost: Math.max(1, (state.totalGain || 1) * 600), cur: 'essence', done: false, amount: rate * 400 },
            { id: 'hybrid', label: 'A packet of hybrid seeds', cost: Math.max(5, Math.ceil(rate * 300)), cur: 'aether', done: false },
        ];
    }
    F.event = ev;
    state.events.seen++;
    if (kind === 'storm') state.events.storms++;
    if (kind === 'merchant') state.events.merchants++;
    Arcade.toast(`${EVENTS[kind].icon} Frontier event: ${EVENTS[kind].name}!`, kind === 'storm' ? 'bad' : 'gold', 3000);
}
function calmStorm() {
    const F = state.frontier;
    if (!eventOn('storm')) return false;
    const c = Math.ceil(aetherPerSec() * 2 * 40);
    if (F.aether < c) { Arcade.sfx('bad'); return false; }
    F.aether -= c; F.event = null; F.rainUntil = Date.now() + EVENTS.rain.secs * 1000;
    save(); Arcade.sfx('power');
    return true;
}
function collectBloom() {
    const F = state.frontier;
    if (!eventOn('bloom')) return 0;
    const n = aetherPerSec() * 150;
    F.aether += n; F.event = null; save(); Arcade.sfx('coin');
    return n;
}
function buyOffer(id) {
    const F = state.frontier, ev = F && F.event;
    if (!ev || ev.kind !== 'merchant' || Date.now() >= ev.until) return null;
    const o = ev.offers.find(x => x.id === id);
    if (!o || o.done) return null;
    const have = o.cur === 'aether' ? F.aether : state.essence;
    if (have < o.cost) { Arcade.sfx('bad'); return null; }
    if (o.cur === 'aether') F.aether -= o.cost; else state.essence -= o.cost;
    o.done = true;
    let got = '';
    if (id === 'relic') {
        const pool = Object.keys(RELICS).filter(k => relic(k) < RELIC_MAX);
        if (pool.length) { const r = Arcade.pick(pool); state.relics[r] = relic(r) + 1; got = `${RELICS[r].icon} ${RELICS[r].name} (Lv ${state.relics[r]})`; }
        else { F.aether += o.cost; got = 'a refund — your relics are all maxed'; }
    } else if (id === 'aether') { F.aether += o.amount; got = '✦ ' + fmt(o.amount); }
    else {
        const known = Object.keys(HYBRIDS).filter(k => state.unlockedCrops.includes(HYBRIDS[k].a) && state.unlockedCrops.includes(HYBRIDS[k].b));
        const k = Arcade.pick(known.length ? known : ['maize']);
        gainHybrid(k, 3); got = `3 × ${HYBRIDS[k].icon} ${HYBRIDS[k].name}`;
    }
    save(); Arcade.sfx('coin');
    return got;
}
function tileAether(t, x, y) { return BIOMES[t.b].aether * (1 + ring(x, y) * 0.3) * Math.pow(1.9, t.lvl - 1); }
function aetherPerSec() {
    if (!state.frontier) return 0;
    let a = 0;
    for (const [k, t] of Object.entries(state.frontier.tiles)) { const [x, y] = k.split(',').map(Number); a += tileAether(t, x, y); }
    return a * aetherMult();
}
function claimable(x, y) {
    const T = state.frontier.tiles;
    if (T[x + ',' + y]) return false;
    return !!(T[(x + 1) + ',' + y] || T[(x - 1) + ',' + y] || T[x + ',' + (y + 1)] || T[x + ',' + (y - 1)]);
}
function claimTile(x, y) {
    if (!claimable(x, y)) return null;
    const c = claimCost(x, y);
    if (state.frontier.aether < c) { Arcade.sfx('bad'); return null; }
    state.frontier.aether -= c;
    const b = biomeAt(x, y);
    state.frontier.tiles[x + ',' + y] = { b, lvl: 1 };
    if (eventOn('explorer')) { state.frontier.event = null; Arcade.toast('🧭 The explorer showed you the way — free claim!', 'gold', 1800); }
    let found = null;
    if (b === 'ruins') {
        const pool = Object.keys(RELICS).filter(k => relic(k) < RELIC_MAX);
        if (pool.length) { found = Arcade.pick(pool); state.relics[found] = relic(found) + 1; }
    }
    save();
    Arcade.sfx(found ? 'win' : 'coin');
    return { b, found };
}
function upgradeTile(x, y) {
    const t = state.frontier.tiles[x + ',' + y];
    if (!t || t.lvl >= 25) return false;
    const c = tileUpCost(t, x, y);
    if (state.frontier.aether < c) { Arcade.sfx('bad'); return false; }
    state.frontier.aether -= c; t.lvl++; save(); Arcade.sfx('power');
    return true;
}
function buyProject(k) {
    const P = PROJECTS[k];
    if (project(k) >= P.max) return false;
    const c = projectCost(k);
    if (state.frontier.aether < c) { Arcade.sfx('bad'); return false; }
    state.frontier.aether -= c; state.frontier.projects[k] = project(k) + 1; save(); Arcade.sfx('power');
    return true;
}

/* ---------- Ascension ---------- */
const ASCEND_MIN = 1e18;
function seedGain() {
    if (state.runEssence < ASCEND_MIN) return 0;
    return Math.floor(5 * Math.pow(state.runEssence / ASCEND_MIN, 0.22)
        * (1 + relic('crown') * 0.05) * (1 + landBonus('seeds')) * (1 + state.upgrades.bloom[2] * 0.03)
        * (1 + hybridBonus('seeds')) * Math.pow(1.5, tLvl('echo')));
}
/** Run-start boosts shared by ascension and transcendence. */
function startPerks() {
    state.essence = 50 * Math.pow(100, perk('quick'));
    for (let i = 0; i < perk('veteran'); i++) hire(true);
    state.hireCost = 15 * Math.pow(1.8, perk('veteran'));
    state.crystals = perk('crystal') * 3;
    if (perk('lab')) state.researchUnlocked = true;
    if (perk('vault')) state.ghUnlocked = true;
    if (perk('map')) unlockFrontier(true);
    if (tLvl('genesis')) { state.ghUnlocked = true; state.plots = Math.max(state.plots, 4); if (!state.unlockedCrops.includes('corn')) state.unlockedCrops.push('corn'); }
}
function transcend() {
    const gain = shardGain();
    if (gain <= 0) return 0;
    const keep = {};
    for (const k of ['relics', 'bestRun', 'lifetimeEssence', 'lastUpdate', 'discovered', 'history', 'events', 'shards', 'totalShards', 'transcends', 'tUps', 'ascensions', 'totalSeeds']) keep[k] = state[k];
    const kept = {};
    for (const [k, lv] of Object.entries(state.perks)) { const n = Math.floor(lv * tLvl('memory') * 0.2); if (n) kept[k] = n; }
    keep.bestRun = Math.max(state.bestRun || 0, state.runEssence);
    state = migrate(structuredClone(BASE_STATE));
    Object.assign(state, keep);
    state.perks = kept;
    state.shards += gain; state.totalShards += gain; state.transcends++;
    startPerks();
    save();
    Arcade.sfx('win');
    Arcade.report('transcends', state.transcends);
    return gain;
}
function buyTUp(k) {
    if (tLvl(k) >= TUPS[k].max) return false;
    const c = tCost(k);
    if (state.shards < c) { Arcade.sfx('bad'); return false; }
    state.shards -= c; state.tUps[k] = tLvl(k) + 1;
    if (k === 'genesis') startPerks();
    save(); Arcade.sfx('power');
    return true;
}
function ascend() {
    const gain = seedGain();
    if (gain <= 0) return 0;
    const kept = {};
    for (const k of KEEP_ON_ASCEND) kept[k] = state[k];
    kept.bestRun = Math.max(state.bestRun || 0, state.runEssence);
    state = migrate(structuredClone(BASE_STATE));
    Object.assign(state, kept);
    state.seeds += gain;
    state.totalSeeds += gain;
    state.seedsSinceT = (state.seedsSinceT || 0) + gain;
    state.ascensions++;
    startPerks();
    save();
    Arcade.report('ascensions', state.ascensions);
    Arcade.sfx('win');
    return gain;
}
function buyPerk(k) {
    if (perk(k) >= PERKS[k].max) return false;
    const c = perkCost(k);
    if (state.seeds < c) { Arcade.sfx('bad'); return false; }
    state.seeds -= c;
    state.perks[k] = perk(k) + 1;
    // perks that unlock something take effect immediately
    if (k === 'lab') state.researchUnlocked = true;
    if (k === 'vault') state.ghUnlocked = true;
    if (k === 'map') unlockFrontier(true);
    save(); Arcade.sfx('power');
    return true;
}

/* ---------- Heartbeat (10 ticks / second) ---------- */
let condenseTick = 0, saveTick = 0;
function heartbeat() {
    if (!isMaster()) return;
    const dt = 0.1;
    let total = 0;
    for (const f of state.farmers) {
        total += farmerYield(f);
        if (state.expUnlocked) {
            f.exp = (f.exp || 0) + f.level * 0.01 * (state.expMult || 1);
            if (f.exp >= expReq(f)) { f.exp = 0; f.m_lvl = (f.m_lvl || 0) + 1; }
            if (Math.random() < 0.001 * gemLuck()) state.diamonds++;
            if (Math.random() < 0.0001 * gemLuck()) state.rubies++;
        }
    }
    state.totalGain = total;
    addEssence(total * dt);
    state.dust += passiveDust() * dt;
    if (state.frontier) state.frontier.aether += aetherPerSec() * dt;

    if (state.autoCondense && state.researchUnlocked && ++condenseTick >= 30) {
        condenseTick = 0;
        condense();
    }
    if (state.ghUnlocked) {
        const g = growSpeed();
        for (let i = 0; i < state.ghCrops.length; i++) {
            const c = state.ghCrops[i];
            if (c && c.status === 'growing') {
                c.progress += g;
                if (c.progress >= c.time) { c.status = 'ready'; c.progress = c.time; }
            }
            if (autoHarvesting() && i < state.plots && c && c.status === 'ready') { const t = c.type; harvest(i, true); plant(i, t); }
        }
        if (autoHarvesting()) for (let i = 0; i < state.plots; i++) if (!state.ghCrops[i] || state.ghCrops[i].status === 'empty') plant(i, state.selectedCrop);
    }
    if (++saveTick >= 5) { saveTick = 0; save(); }
    if (++histTick >= 300) { histTick = 0; sampleHistory(); }
    if (++eventTick >= 10) { eventTick = 0; rollEvent(); }
}
let histTick = 290, eventTick = 0;
/** Essence/sec every 30s, last 4 hours — drawn on the Stats tab. */
function sampleHistory() {
    const h = state.history;
    h.push([Date.now(), state.totalGain || 0, state.essence]);
    while (h.length > 480) h.shift();
}

function offlineProgress() {
    const secs = Math.min(offlineHours() * 3600, (Date.now() - (state.lastUpdate || Date.now())) / 1000);
    if (secs < 60) return;
    const rate = 0.5 * (1 + perk('warp') * 0.1);
    const ess = totalYield() * secs * rate;
    const dust = passiveDust() * secs * rate;
    const aeth = aetherPerSec() * secs * rate;
    addEssence(ess);
    state.dust += dust;
    if (state.frontier) state.frontier.aether += aeth;
    if (state.ghUnlocked) for (const c of state.ghCrops) if (c && c.status === 'growing') { c.progress = Math.min(c.time, c.progress + secs * 10 * growSpeed()); if (c.progress >= c.time) c.status = 'ready'; }
    save();
    setTimeout(() => Arcade.toast(`Welcome back! Your farmers gathered ${fmt(ess)} essence` + (dust > 0 ? `, ${fmt(dust)} dust` : '') + (aeth > 0 ? ` and ${fmt(aeth)} Aether` : '') + ' while you were away.', 'gold', 5000), 400);
}

/* ---------- Header & tab locks ---------- */
function navState() {
    return {
        farm: true,
        void: state.farmers.length >= 5 || state.ascensions > 0,
        research: state.researchUnlocked,
        greenhouse: state.ghUnlocked,
        frontier: !!state.frontier || state.ghUnlocked,
        ascend: state.runEssence >= 1e15 || state.ascensions > 0,
        stats: true,
    };
}
const NAV_HINTS = { void: 'Hire 5 farmers to open the Void', research: 'Unlock in the Void (300K dust)', greenhouse: 'Unlock on the farm (10Qa essence)', frontier: 'Unlock the greenhouse first', ascend: 'Earn 1Qa essence in one run' };
function refreshHeader() {
    Arcade.text('hEss', fmt(state.essence));
    Arcade.text('hYield', fmt(state.totalGain || totalYield()) + '/s');
    Arcade.text('hDust', fmt(state.dust));
    Arcade.text('hDm', fmt(state.dm));
    Arcade.text('hAeth', fmt(state.frontier ? state.frontier.aether : 0));
    Arcade.text('hSeeds', fmt(state.seeds));
    const show = (id, on) => { const e = document.getElementById(id); if (e) e.hidden = !on; };
    show('dmChip', state.researchUnlocked);
    show('dustChip', navState().void || state.dust > 0);
    show('aethChip', !!state.frontier);
    show('seedChip', state.totalSeeds > 0);
    Arcade.text('hShards', fmt(state.shards));
    show('shardChip', state.totalShards > 0);
    const ev = state.frontier && state.frontier.event && Date.now() < state.frontier.event.until;
    show('evDot', !!ev);
}

if (isMaster()) offlineProgress();
setInterval(heartbeat, 100);
window.addEventListener('pagehide', () => { if (isMaster()) save(); });
