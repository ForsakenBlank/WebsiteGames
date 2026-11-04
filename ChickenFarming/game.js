/* ==========================================================
   Chicken Farming, game logic.
   Save key and data shape are kept from the original game
   ("ChickenGame") so existing saves keep working.

   Everything runs on ONE page (index.html) with tabs. The game used to be
   split over index.html + market.html, and browsers that give every
   file:// page its own storage ended up with two separate saves.
   ========================================================== */
const GameSave = 'ChickenGame';
const fmt = (n) => Arcade.fmt(n);

const DEFAULTS = {
    eggs: 0,
    chickens: 1,
    incubators: 0,
    IncubatorGenerator: 0,
    EggsPerChicken: 1,
    Unlocks: {
        Farmers: { Unlocked: false, name: 'Farmers', desc: 'Hire legendary farmers to fight chickens for you.', Cost: 100000, CostType: 'eggs', lvlReq: 20 },
        Hunt: { Unlocked: false, name: "Hunter's License", desc: 'Unlocks the Egg Hunt, a hands-on side game. It never resets and boosts the whole farm.', Cost: 25000, CostType: 'eggs', lvlReq: 10 },
    },
    combatData: { currentHp: 10, maxHp: 10, level: 1, chickensKilledOnLevel: 0, isBoss: false },
    AmountOfFarmersUnlocked: 0,
    DamageMultipliers: 1,
    FarmerDamageMultiplier: 1,
    CritChance: 8,
    CritDamage: 2,
    Farmers: {},
    EvilEggs: 0,
    EvilChickens: 0,
    EvilChickenChance: 0,
    EvilChickenConvertAmount: 1,
    EvilChickenReproductionRate: 1.0,
    Level: 0,
    exp: 0,
    expReq: 100,
    Upgrades: {
        Normal: {
            EggsPerChicken: { cost: 10, lvl: 0 },
            incubators: { cost: 20, lvl: 0 },
            feed: { cost: 0, lvl: 0 },
            cartons: { cost: 0, lvl: 0 },
            tutor: { cost: 0, lvl: 0 },
            EvilChickenChance: { cost: 1000, lvl: 0 },
            dummies: { cost: 0, lvl: 0 },
            beaks: { cost: 0, lvl: 0 },
            haggle: { cost: 0, lvl: 0 },
            silo: { cost: 0, lvl: 0 },
        },
        Evil: {
            DarkBarn: { cost: 0, lvl: 0 },
            IncubatorGenerator: { cost: 10, lvl: 0 },
            DarkFeed: { cost: 0, lvl: 0 },
            EvilChickenConvertAmount: { cost: 100, lvl: 1 },
            EvilChickenChance: { cost: 1, lvl: 0 },
            EggsPerChicken: { cost: 10000000, lvl: 0 },
            ShadowForge: { cost: 0, lvl: 0 },
            HexPlenty: { cost: 0, lvl: 0 },
            DarkBreeding: { cost: 0, lvl: 0 },
        },
    },
    Breeds: {},           // owned hen breeds (reset on retirement)
    Gens: {},             // generator chain, tier -> { bought, count } (reset on retirement)
    stats: { taps: 0, kills: 0, bossKills: 0, lifetimeEggs: 0, bestArena: 1, expeditions: 0 },
    lastSeen: 0,
    // ---- late game (kept through retirement) ----
    feathers: 0,          // unspent golden feathers: +5% eggs & damage each
    totalFeathers: 0,
    rebirths: 0,
    golden: {},           // golden coop perk levels
    artifacts: {},        // artifact levels from expeditions
    expedition: null,     // { id, start, end, sent }
    // ---- star coop (second prestige, kept through retirement AND ascension) ----
    stars: 0,             // unspent star eggs
    totalStars: 0,
    ascensions: 0,
    starUps: {},
    feathersSinceAscend: 0,
    // ---- Egg Hunt: a manual side game. Never reset by retirement or ascension. ----
    hunt: { unlocked: false, rank: 1, xp: 0, clovers: 0, totalClovers: 0, perks: {}, hunts: 0, cleared: 0, perfect: 0, bestTiles: 0 },
    ver: 2,
};

const farmerData = {
    MasterPaiMei: { name: 'Master Pai Mei', icon: '🥋', cost: 10, baseDmg: 1, Upgrades: {
        Focus: { name: 'Focus', cost: 400, levelReq: 10, buffType: 'Damage', buffAmount: 1 },
        MartialArtist: { name: 'Martial Artist', cost: 4000, levelReq: 25, buffType: 'Damage', buffAmount: 1 },
        Sensei: { name: 'Sensei', cost: 32000, levelReq: 50, buffType: 'Damage', buffAmount: 1 },
        EagleClaw: { name: 'Eagle Claw', cost: 320000, levelReq: 75, buffType: 'Damage', buffAmount: 1.5 },
        ThreeInchPunch: { name: 'Three Inch Punch', cost: 1600000, levelReq: 125, buffType: 'Damage', buffAmount: 2 },
        ExplodingHeartTechnique: { name: 'Exploding Heart Technique', cost: 16000000, levelReq: 150, buffType: 'Damage', buffAmount: 2.5 },
    } },
    Tarzan: { name: 'Tarzan', icon: '🌴', cost: 100, baseDmg: 5, Upgrades: {
        Brute: { name: 'Brute', cost: 2000, levelReq: 10, buffType: 'Damage', buffAmount: 1 },
        Frenzy: { name: 'Frenzy', cost: 5000, levelReq: 25, buffType: 'Damage', buffAmount: 1 },
        Rage: { name: 'Rage', cost: 20000, levelReq: 50, buffType: 'Damage', buffAmount: 1 },
        Brawler: { name: 'Brawler', cost: 160000, levelReq: 75, buffType: 'Damage', buffAmount: 1.5 },
        Strength: { name: 'Strength', cost: 1600000, levelReq: 125, buffType: 'Damage', buffAmount: 2 },
    } },
    Beowulf: { name: 'Beowulf', icon: '🪓', cost: 500, baseDmg: 22, Upgrades: {
        Strength: { name: 'Strength', cost: 10000, levelReq: 10, buffType: 'Damage', buffAmount: 1 },
        Juggernaut: { name: 'Juggernaut', cost: 25000, levelReq: 25, buffType: 'Damage', buffAmount: 1 },
        Might: { name: 'Might', cost: 100000, levelReq: 50, buffType: 'Damage', buffAmount: 1 },
        Inspire: { name: 'Inspire', cost: 8000000, levelReq: 75, buffType: 'Damage', buffAmount: 1.5 },
        DragonKiller: { name: 'Dragon Killer', cost: 40000000, levelReq: 125, buffType: 'Damage', buffAmount: 2 },
    } },
    RobinHood: { name: 'Robin Hood', icon: '🏹', cost: 2000, baseDmg: 74, Upgrades: {
        Dexterity: { name: 'Dexterity', cost: 40000, levelReq: 10, buffType: 'Damage', buffAmount: 1 },
        PoisonArrow: { name: 'Poison Arrow', cost: 100000, levelReq: 25, buffType: 'Damage', buffAmount: 1 },
        SherwoodBlessing: { name: "Sherwood's Blessing", cost: 400000, levelReq: 50, buffType: 'Damage', buffAmount: 1.5 },
        CompositeBow: { name: 'Composite Bow', cost: 3200000, levelReq: 75, buffType: 'Damage', buffAmount: 1.5 },
    } },
    BaconHair: { name: 'Bacon Hair', icon: '🥓', cost: 8000, baseDmg: 245, Upgrades: {
        BaconPower: { name: 'Bacon Power', cost: 160000, levelReq: 10, buffType: 'Damage', buffAmount: 1 },
        BuilderClub: { name: "Builder's Club", cost: 400000, levelReq: 25, buffType: 'Damage', buffAmount: 1 },
        OutrageousBuilderClub: { name: "Outrageous Builder's Club", cost: 1600000, levelReq: 50, buffType: 'Damage', buffAmount: 1 },
        BaconHairArmy: { name: 'Bacon Hair Army', cost: 12800000, levelReq: 75, buffType: 'AllDamage', buffAmount: 0.25 },
        LMaD: { name: 'LMaD', cost: 128000000, levelReq: 100, buffType: 'Damage', buffAmount: 1.5 },
    } },
    Mozart: { name: 'Mozart', icon: '🎻', cost: 40000, baseDmg: 976, Upgrades: {
        Symphony: { name: 'Symphony', cost: 800000, levelReq: 10, buffType: 'AllDamage', buffAmount: 0.25 },
        EineKleineNachtmusick: { name: 'Eine Kleine Nachtmusik', cost: 2000000, levelReq: 25, buffType: 'AllDamage', buffAmount: 0.25 },
        Requiem: { name: 'Requiem', cost: 8000000, levelReq: 50, buffType: 'AllDamage', buffAmount: 0.25 },
        RondoAllaTurca: { name: 'Rondo Alla Turca', cost: 64000000, levelReq: 75, buffType: 'AllDamage', buffAmount: 0.25 },
        Stradivarius: { name: 'Stradivarius', cost: 640000000, levelReq: 100, buffType: 'AllDamage', buffAmount: 0.5 },
    } },
    Spartacus: { name: 'Spartacus', icon: '🛡️', cost: 200000, baseDmg: 3725, Upgrades: {
        SlaveTraining: { name: 'Ludus Training', cost: 1000000, levelReq: 10, buffType: 'Damage', buffAmount: 1 },
        GladiatorTraining: { name: 'Gladiator Training', cost: 4000000, levelReq: 25, buffType: 'Damage', buffAmount: 1 },
        ChampionofCapua: { name: 'Champion of Capua', cost: 12000000, levelReq: 50, buffType: 'Damage', buffAmount: 1 },
        Vengeance: { name: 'Vengeance', cost: 100000000, levelReq: 75, buffType: 'Damage', buffAmount: 1.5 },
    } },
    JuliusCaesar: { name: 'Julius Caesar', icon: '🏛️', cost: 800000, baseDmg: 10859, Upgrades: {
        PoliticalExpertise: { name: 'Political Expertise', cost: 16000000, levelReq: 10, buffType: 'Damage', buffAmount: 1 },
        MilitaryExpertise: { name: 'Military Expertise', cost: 40000000, levelReq: 25, buffType: 'Damage', buffAmount: 1 },
        Rhetoric: { name: 'Rhetoric', cost: 160000000, levelReq: 50, buffType: 'Damage', buffAmount: 1 },
        Leadership: { name: 'Leadership', cost: 1280000000, levelReq: 75, buffType: 'AllDamage', buffAmount: 0.25 },
    } },
    JoanOfArc: { name: 'Joan of Arc', icon: '⚜️', cost: 5000000, baseDmg: 47143, Upgrades: {
        FrenchPride: { name: 'French Pride', cost: 100000000, levelReq: 10, buffType: 'Damage', buffAmount: 1 },
        SaintBlessing: { name: "Saint's Blessing", cost: 250000000, levelReq: 25, buffType: 'Damage', buffAmount: 1 },
        TheMaidofOrleans: { name: 'The Maid of Orleans', cost: 1000000000, levelReq: 50, buffType: 'Damage', buffAmount: 1 },
        DivineGuidance: { name: 'Divine Guidance', cost: 8000000000, levelReq: 75, buffType: 'Damage', buffAmount: 1.5 },
    } },
    NarutoUzumaki: { name: 'Naruto Uzumaki', icon: '🍥', cost: 30000000, baseDmg: 186000, Upgrades: {
        Fuinjutsu: { name: 'Fuinjutsu', cost: 600000000, levelReq: 10, buffType: 'CritChance', buffAmount: 3 },
        Shurikenjutsu: { name: 'Shurikenjutsu', cost: 1500000000, levelReq: 25, buffType: 'Damage', buffAmount: 1.25 },
        ShadowCloneTechnique: { name: 'Shadow Clone Technique', cost: 6000000000, levelReq: 50, buffType: 'Damage', buffAmount: 1.25 },
        Rasengan: { name: 'Rasengan', cost: 48000000000, levelReq: 75, buffType: 'CritDamage', buffAmount: 5 },
    } },
    Merlin: { name: 'Merlin', icon: '🧙', cost: 250000000, baseDmg: 920000, Upgrades: {
        Familiar: { name: 'Owl Familiar', cost: 5e9, levelReq: 10, buffType: 'Damage', buffAmount: 1 },
        Prophecy: { name: 'Prophecy', cost: 2.5e10, levelReq: 25, buffType: 'AllDamage', buffAmount: 0.3 },
        Excalibur: { name: 'Forge Excalibur', cost: 1.5e11, levelReq: 50, buffType: 'Damage', buffAmount: 2 },
        Avalon: { name: 'Avalon', cost: 1e12, levelReq: 75, buffType: 'CritDamage', buffAmount: 3 },
    } },
    Zeus: { name: 'Zeus', icon: '⚡', cost: 3e9, baseDmg: 5.2e6, Upgrades: {
        Thunderbolt: { name: 'Thunderbolt', cost: 6e10, levelReq: 10, buffType: 'Damage', buffAmount: 1 },
        Olympus: { name: 'Throne of Olympus', cost: 3e11, levelReq: 25, buffType: 'AllDamage', buffAmount: 0.35 },
        Aegis: { name: 'Aegis', cost: 2e12, levelReq: 50, buffType: 'CritChance', buffAmount: 4 },
        KingOfGods: { name: 'King of the Gods', cost: 1.5e13, levelReq: 75, buffType: 'Damage', buffAmount: 3 },
    } },
    CosmicRooster: { name: 'The Cosmic Rooster', icon: '🐓', cost: 5e10, baseDmg: 3.4e7, Upgrades: {
        Crow: { name: 'Dawn Crow', cost: 1e12, levelReq: 10, buffType: 'AllDamage', buffAmount: 0.5 },
        Starfeather: { name: 'Starfeather', cost: 6e12, levelReq: 25, buffType: 'Damage', buffAmount: 2 },
        Supernova: { name: 'Supernova Peck', cost: 4e13, levelReq: 50, buffType: 'CritDamage', buffAmount: 5 },
        BigBang: { name: 'Big Bang', cost: 3e14, levelReq: 75, buffType: 'AllDamage', buffAmount: 1 },
    } },
    // ---- late-game farmers ----
    Hercules: { name: 'Hercules', icon: '🦁', cost: 8e11, baseDmg: 2.2e8, Upgrades: {
        Labours: { name: 'Twelve Labours', cost: 1.6e13, levelReq: 10, buffType: 'Damage', buffAmount: 1.5 },
        LionPelt: { name: 'Nemean Pelt', cost: 1e14, levelReq: 25, buffType: 'CritChance', buffAmount: 4 },
        Hydra: { name: 'Hydra Slayer', cost: 7e14, levelReq: 50, buffType: 'Damage', buffAmount: 2.5 },
        Demigod: { name: 'Demigod', cost: 5e15, levelReq: 75, buffType: 'AllDamage', buffAmount: 0.75 },
    } },
    Athena: { name: 'Athena', icon: '🦉', cost: 1.2e13, baseDmg: 1.4e9, Upgrades: {
        Wisdom: { name: 'Wisdom', cost: 2.4e14, levelReq: 10, buffType: 'AllDamage', buffAmount: 0.5 },
        Strategy: { name: 'Battle Strategy', cost: 1.5e15, levelReq: 25, buffType: 'Damage', buffAmount: 2 },
        Parthenon: { name: 'Parthenon', cost: 1e16, levelReq: 50, buffType: 'CritDamage', buffAmount: 6 },
        Aegis: { name: 'Golden Aegis', cost: 8e16, levelReq: 75, buffType: 'AllDamage', buffAmount: 1 },
    } },
    GalacticFarmer: { name: 'Galactic Farmer', icon: '🛸', cost: 2e14, baseDmg: 9e9, Upgrades: {
        Abduction: { name: 'Cow Abduction', cost: 4e15, levelReq: 10, buffType: 'Damage', buffAmount: 2 },
        CropCircles: { name: 'Crop Circles', cost: 2.5e16, levelReq: 25, buffType: 'AllDamage', buffAmount: 0.75 },
        WarpDrive: { name: 'Warp Drive', cost: 1.6e17, levelReq: 50, buffType: 'CritChance', buffAmount: 5 },
        Mothership: { name: 'Mothership', cost: 1.2e18, levelReq: 75, buffType: 'Damage', buffAmount: 4 },
    } },
    ChronoKeeper: { name: 'Chrono Keeper', icon: '⏳', cost: 3e15, baseDmg: 6e10, Upgrades: {
        Rewind: { name: 'Rewind', cost: 6e16, levelReq: 10, buffType: 'AllDamage', buffAmount: 1 },
        Paradox: { name: 'Paradox', cost: 4e17, levelReq: 25, buffType: 'CritDamage', buffAmount: 8 },
        TimeLoop: { name: 'Time Loop', cost: 3e18, levelReq: 50, buffType: 'Damage', buffAmount: 4 },
        EndOfTime: { name: 'End of Time', cost: 2.5e19, levelReq: 75, buffType: 'AllDamage', buffAmount: 1.5 },
    } },
    EggSingularity: { name: 'The Egg Singularity', icon: '🌌', cost: 5e16, baseDmg: 4e11, Upgrades: {
        EventHorizon: { name: 'Event Horizon', cost: 1e18, levelReq: 10, buffType: 'AllDamage', buffAmount: 1.5 },
        Spaghettify: { name: 'Spaghettification', cost: 8e18, levelReq: 25, buffType: 'Damage', buffAmount: 5 },
        HawkingYolk: { name: 'Hawking Yolk', cost: 6e19, levelReq: 50, buffType: 'CritChance', buffAmount: 6 },
        NewUniverse: { name: 'A New Universe', cost: 5e20, levelReq: 75, buffType: 'AllDamage', buffAmount: 3 },
    } },
    // ---- endgame farmers ----
    Odin: { name: 'Odin Allfather', icon: '🧿', cost: 8e17, baseDmg: 3e12, Upgrades: {
        Gungnir: { name: 'Gungnir', cost: 1.6e19, levelReq: 10, buffType: 'Damage', buffAmount: 3 },
        Ravens: { name: 'Huginn & Muninn', cost: 1e20, levelReq: 25, buffType: 'CritChance', buffAmount: 5 },
        Runes: { name: 'Rune of Wisdom', cost: 7e20, levelReq: 50, buffType: 'AllDamage', buffAmount: 1.5 },
        Ragnarok: { name: 'Ragnarok', cost: 5e21, levelReq: 75, buffType: 'Damage', buffAmount: 6 },
    } },
    Anubis: { name: 'Anubis', icon: '🐺', cost: 1.5e19, baseDmg: 2.2e13, Upgrades: {
        Scales: { name: 'Scales of Ma\'at', cost: 3e20, levelReq: 10, buffType: 'AllDamage', buffAmount: 1.5 },
        Embalm: { name: 'Embalming Rites', cost: 2e21, levelReq: 25, buffType: 'Damage', buffAmount: 4 },
        Judgement: { name: 'Judgement', cost: 1.4e22, levelReq: 50, buffType: 'CritDamage', buffAmount: 10 },
        Afterlife: { name: 'Gates of the Afterlife', cost: 1e23, levelReq: 75, buffType: 'AllDamage', buffAmount: 2.5 },
    } },
    DragonEmpress: { name: 'The Dragon Empress', icon: '🐲', cost: 3e20, baseDmg: 1.6e14, Upgrades: {
        Scale: { name: 'Jade Scales', cost: 6e21, levelReq: 10, buffType: 'Damage', buffAmount: 4 },
        Breath: { name: 'Celestial Breath', cost: 4e22, levelReq: 25, buffType: 'CritChance', buffAmount: 6 },
        Mandate: { name: 'Mandate of Heaven', cost: 3e23, levelReq: 50, buffType: 'AllDamage', buffAmount: 3 },
        Ascend: { name: 'Dragon Ascendant', cost: 2e24, levelReq: 75, buffType: 'Damage', buffAmount: 8 },
    } },
    Archivist: { name: 'The Archivist', icon: '📚', cost: 6e21, baseDmg: 1.2e15, Upgrades: {
        Index: { name: 'Perfect Index', cost: 1.2e23, levelReq: 10, buffType: 'AllDamage', buffAmount: 2 },
        Forbidden: { name: 'Forbidden Volume', cost: 8e23, levelReq: 25, buffType: 'Damage', buffAmount: 5 },
        Footnote: { name: 'Fatal Footnote', cost: 6e24, levelReq: 50, buffType: 'CritDamage', buffAmount: 15 },
        Library: { name: 'Library of Everything', cost: 4e25, levelReq: 75, buffType: 'AllDamage', buffAmount: 4 },
    } },
    YolkGod: { name: 'The Yolk God', icon: '🍳', cost: 1.5e23, baseDmg: 1e16, Upgrades: {
        Sunny: { name: 'Sunny Side', cost: 3e24, levelReq: 10, buffType: 'Damage', buffAmount: 6 },
        Benedict: { name: 'Eggs Benedict', cost: 2e25, levelReq: 25, buffType: 'AllDamage', buffAmount: 3 },
        Omelette: { name: 'Divine Omelette', cost: 1.5e26, levelReq: 50, buffType: 'CritChance', buffAmount: 8 },
        Hatch: { name: 'The Final Hatching', cost: 1e27, levelReq: 75, buffType: 'AllDamage', buffAmount: 6 },
    } },
};
// ---- post-game farmers (placeholder prices follow the old curve; they are re-priced below) ----
const gen = (key, name, icon, cost, baseDmg, perks) => {
    const reqs = [10, 25, 50, 75], mults = [20, 125, 800, 5000], Upgrades = {};
    perks.forEach(([n, type, amt], i) => { Upgrades[key + i] = { name: n, cost: cost * mults[i], levelReq: reqs[i], buffType: type, buffAmount: amt }; });
    farmerData[key] = { name, icon, cost, baseDmg, Upgrades };
};
gen('Poseidon', 'Poseidon', '🌊', 3e24, 7e16, [['Tidal Wave', 'Damage', 6], ['Trident Storm', 'AllDamage', 3], ['Kraken Call', 'CritChance', 8], ['Lord of the Seas', 'Damage', 10]]);
gen('SunWukong', 'Sun Wukong', '🐒', 6e25, 5e17, [['Staff of Ages', 'Damage', 6], ['72 Transformations', 'AllDamage', 3], ['Cloud Somersault', 'CritChance', 8], ['Great Sage', 'Damage', 10]]);
gen('Cleopatra', 'Cleopatra', '🐍', 1.2e27, 3.5e18, [['Asp Venom', 'Damage', 7], ['Royal Treasury', 'AllDamage', 3.5], ['Eye of Ra', 'CritDamage', 20], ['Last Pharaoh', 'AllDamage', 5]]);
gen('Genghis', 'Genghis Khan', '🏇', 2.4e28, 2.5e19, [['Horde', 'Damage', 7], ['Steppe Archers', 'AllDamage', 3.5], ['Eternal Blue Sky', 'CritChance', 9], ['Mongol Empire', 'Damage', 12]]);
gen('Leonardo', 'Leonardo da Vinci', '🎨', 5e29, 1.8e20, [['Flying Machine', 'Damage', 8], ['Vitruvian Hen', 'AllDamage', 4], ['Codex', 'CritDamage', 25], ['Renaissance', 'AllDamage', 6]]);
gen('Quetzal', 'Quetzalcoatl', '🪽', 1e31, 1.3e21, [['Feathered Fury', 'Damage', 8], ['Sun Calendar', 'AllDamage', 4], ['Obsidian Talons', 'CritChance', 10], ['Serpent God', 'Damage', 15]]);
gen('Cthulhu', 'Cthulhu Hen', '🐙', 2e32, 9e21, [['Madness', 'Damage', 9], ['R\'lyeh Rising', 'AllDamage', 4.5], ['Eldritch Gaze', 'CritDamage', 30], ['The Great Old One', 'AllDamage', 7]]);
gen('Multiverse', 'The Multiverse Farmer', '🌐', 4e33, 6e22, [['Parallel Coops', 'Damage', 10], ['Infinite Hens', 'AllDamage', 5], ['Branching Timelines', 'CritChance', 12], ['Every Possible Farm', 'Damage', 18]]);
gen('MotherHen', 'Mother Hen Prime', '👑', 8e34, 4.5e23, [['Broody', 'Damage', 10], ['Warm Embrace', 'AllDamage', 5], ['Peck of Doom', 'CritDamage', 40], ['Queen of All Coops', 'AllDamage', 8]]);
gen('FirstEgg', 'The First Egg', '🥚', 2e36, 3e24, [['Cracks', 'Damage', 12], ['Primordial Yolk', 'AllDamage', 6], ['Shell of Creation', 'CritChance', 14], ['Which Came First', 'AllDamage', 10]]);
const FARMER_KEYS = Object.keys(farmerData);
// click-Heroes style pricing: after the first four, every new farmer costs ~16x the previous one, so the next
// farmer really is a long wait. Their perk prices scale by the same factor; damage is untouched.
FARMER_KEYS.forEach((k, i) => {
    if (i < 4) return;
    const f = farmerData[k], newCost = 2.5e4 * Math.pow(16, i - 4), ratio = newCost / f.cost;
    f.cost = newCost;
    for (const u of Object.values(f.Upgrades)) u.cost *= ratio;
});

// `stat: true` upgrades add `increase` to gameData[id] when bought; every other upgrade is read straight from its level.
// maxLevel Infinity = no cap (the cost curve is the brake instead).
const Upgrades = {
    Market: [
        { id: 'EggsPerChicken', stat: true, name: 'Better Laying', icon: '🥚', desc: '+0.1 eggs/sec per chicken · every 25 levels doubles ALL egg output', increase: 0.1, baseCost: 10, costIncrease: 1.2, levelReq: 0, maxLevel: Infinity },
        { id: 'incubators', stat: true, name: 'New Incubator', icon: '🐣', desc: '+1 chicken every 5 seconds · every 20 levels doubles incubator output', increase: 1, baseCost: 20, costIncrease: 1.5, levelReq: 1, maxLevel: Infinity },
        { id: 'feed', name: 'Premium Feed', icon: '🌾', desc: '+5% eggs', baseCost: 100, costIncrease: 1.3, levelReq: 3, maxLevel: Infinity },
        { id: 'cartons', name: 'Egg Cartons', icon: '📦', desc: '+12% eggs per tap', baseCost: 150, costIncrease: 1.3, levelReq: 6, maxLevel: Infinity },
        { id: 'tutor', name: 'Hen Tutors', icon: '🎓', desc: '+4% XP gain (levels up the farm faster)', baseCost: 2000, costIncrease: 1.35, levelReq: 10, maxLevel: 60 },
        { id: 'EvilChickenChance', stat: true, name: 'Evil Chicken Chance', icon: '😈', desc: '+0.5% chance per second a chicken turns evil', increase: 0.5, baseCost: 1000, costIncrease: 1.8, levelReq: 15, maxLevel: 20 },
        { id: 'silo', name: 'Spooky Silo', icon: '🏚️', desc: '+10 evil chicken capacity (paid in normal eggs)', baseCost: 5000, costIncrease: 1.32, levelReq: 15, maxLevel: Infinity },
        { id: 'dummies', name: 'Training Dummies', icon: '🎯', desc: '+5% farmer damage', baseCost: 40000, costIncrease: 1.33, levelReq: 20, maxLevel: Infinity },
        { id: 'beaks', name: 'Hardened Beaks', icon: '🦜', desc: '+0.5% crit chance', baseCost: 300000, costIncrease: 1.4, levelReq: 25, maxLevel: 40 },
        { id: 'haggle', name: 'Bulk Orders', icon: '🏷️', desc: '−2% farmer prices', baseCost: 1500000, costIncrease: 1.5, levelReq: 30, maxLevel: 20 },
    ],
    Evil: [
        { id: 'DarkBarn', name: 'Dark Barn', icon: '🏚️', desc: '+20 evil chicken capacity, the flock can never grow past it', baseCost: 80, costIncrease: 1.35, levelReq: 15, maxLevel: Infinity },
        { id: 'IncubatorGenerator', stat: true, name: 'Incubator Generators', icon: '🏭', desc: '+1 incubator every 5 seconds', increase: 1, baseCost: 10, costIncrease: 2.5, levelReq: 15, maxLevel: Infinity },
        { id: 'DarkFeed', name: 'Dark Feed', icon: '🌑', desc: '+10% evil eggs', baseCost: 300, costIncrease: 1.5, levelReq: 20, maxLevel: Infinity },
        { id: 'EvilChickenConvertAmount', stat: true, name: 'Mass Conversion', icon: '🌀', desc: '+1 chicken converted per evil event', increase: 1, baseCost: 100, costIncrease: 2.2, levelReq: 28, maxLevel: 30 },
        { id: 'EvilChickenChance', stat: true, name: 'Dark Ritual', icon: '🔮', desc: '+1% evil chicken chance', increase: 1, baseCost: 10, costIncrease: 6, levelReq: 35, maxLevel: 8 },
        { id: 'EggsPerChicken', stat: true, name: 'Ultimate Laying', icon: '👑', desc: '+1 egg/sec per chicken', increase: 1, baseCost: 200000, costIncrease: 1.4, levelReq: 45, maxLevel: Infinity },
        { id: 'ShadowForge', name: 'Shadow Forge', icon: '⚒️', desc: '+10% farmer damage', baseCost: 1000000, costIncrease: 1.6, levelReq: 55, maxLevel: Infinity },
        { id: 'HexPlenty', name: 'Hex of Plenty', icon: '🔯', desc: '+8% eggs', baseCost: 5000000, costIncrease: 1.7, levelReq: 65, maxLevel: Infinity },
        { id: 'DarkBreeding', name: 'Dark Breeding', icon: '🧬', desc: 'Evil chickens breed +0.4% faster each second (up to the barn capacity)', baseCost: 10000000, costIncrease: 1.8, levelReq: 70, maxLevel: 60 },
    ],
};

/* ---------- hen breeds: one-off purchases per run, each multiplies egg output ---------- */
const niceNum = (n) => { const e = Math.pow(10, Math.floor(Math.log10(n)) - 1); return Math.round(n / e) * e; };
const BREEDS = [
    { id: 'leghorn', name: 'Leghorn', icon: '🐔', mult: 1.5, lvl: 4 },
    { id: 'rhode', name: 'Rhode Island Red', icon: '🪶', mult: 2, lvl: 10 },
    { id: 'sussex', name: 'Sussex', icon: '🐓', mult: 2, lvl: 18 },
    { id: 'silkie', name: 'Silkie', icon: '☁️', mult: 2.5, lvl: 26 },
    { id: 'brahma', name: 'Brahma', icon: '🦃', mult: 3, lvl: 34 },
    { id: 'ameraucana', name: 'Ameraucana', icon: '🫐', mult: 3, lvl: 42 },
    { id: 'phoenix', name: 'Phoenix Hen', icon: '🔥', mult: 4, lvl: 52 },
    { id: 'thunder', name: 'Thunder Hen', icon: '⚡', mult: 4, lvl: 62 },
    { id: 'frost', name: 'Frost Hen', icon: '❄️', mult: 5, lvl: 72 },
    { id: 'cosmic', name: 'Cosmic Hen', icon: '🌌', mult: 6, lvl: 85 },
    { id: 'voidhen', name: 'Void Hen', icon: '🕳️', mult: 8, lvl: 100 },
    { id: 'primordial', name: 'Primordial Hen', icon: '🦕', mult: 10, lvl: 120 },
    { id: 'chrono', name: 'Chrono Hen', icon: '⏳', mult: 12, lvl: 145 },
    { id: 'yolk', name: 'Yolk Avatar', icon: '🍳', mult: 15, lvl: 170 },
].map(b => ({ ...b, cost: niceNum(60 * Math.pow(1.4, b.lvl)) }));

/* ---------- egg Hunt data ---------- */
const FIELDS = [
    { id: 1, name: 'Backyard', icon: '🌱', w: 7, h: 7, foxes: 6, rank: 1, per: 1 },
    { id: 2, name: 'Meadow', icon: '🌼', w: 8, h: 8, foxes: 10, rank: 2, per: 2 },
    { id: 3, name: 'Orchard', icon: '🍎', w: 9, h: 9, foxes: 14, rank: 4, per: 6 },
    { id: 4, name: 'Pine Woods', icon: '🌲', w: 10, h: 10, foxes: 20, rank: 6, per: 14 },
    { id: 5, name: 'Marsh', icon: '🪷', w: 11, h: 11, foxes: 26, rank: 8, per: 33 },
    { id: 6, name: 'Canyon', icon: '🏜️', w: 12, h: 12, foxes: 34, rank: 11, per: 80 },
    { id: 7, name: 'Glacier', icon: '🧊', w: 13, h: 13, foxes: 42, rank: 14, per: 191 },
    { id: 8, name: 'Volcano Rim', icon: '🌋', w: 14, h: 14, foxes: 52, rank: 18, per: 459 },
    { id: 9, name: 'Haunted Moor', icon: '🌫️', w: 15, h: 14, foxes: 62, rank: 23, per: 1100 },
    { id: 10, name: 'Sky Islands', icon: '☁️', w: 16, h: 15, foxes: 74, rank: 29, per: 2640 },
    { id: 11, name: 'Crystal Caves', icon: '💎', w: 16, h: 16, foxes: 86, rank: 36, per: 6340 },
    { id: 12, name: 'Fox King Court', icon: '👑', w: 18, h: 16, foxes: 100, rank: 45, per: 15200 },
];
// skills help the hunt itself, farm perks help the main game. Costs are in clovers.
const HUNT_PERKS = [
    { id: 'boots', grp: 'skill', name: 'Thick Boots', icon: '🥾', desc: '+1 heart per hunt', base: 90, grow: 4, max: 5 },
    { id: 'hound', grp: 'skill', name: 'Scout Hound', icon: '🐕', desc: 'Starts every hunt with +1 free safe tile revealed', base: 38, grow: 1.45, max: 15 },
    { id: 'basket', grp: 'skill', name: 'Clover Basket', icon: '🧺', desc: '+10% clovers from every hunt', base: 23, grow: 1.2, max: 100 },
    { id: 'nose', grp: 'skill', name: 'Egg Sense', icon: '🥚', desc: '+1 hidden golden egg tile per hunt (worth 15 tiles)', base: 120, grow: 1.4, max: 15 },
    { id: 'sniffer', grp: 'skill', name: 'Fox Sniffer', icon: '👃', desc: 'Auto-flags 1 fox at the start of every hunt', base: 180, grow: 1.5, max: 12 },
    { id: 'pelts', grp: 'farm', name: 'Pelt Trader', icon: '🦊', desc: '+3% eggs', base: 45, grow: 1.19, max: 100 },
    { id: 'bow', grp: 'farm', name: "Hunter's Bow", icon: '🏹', desc: '+3% farmer damage', base: 60, grow: 1.19, max: 100 },
    { id: 'birdcall', grp: 'farm', name: 'Bird Call', icon: '📯', desc: '+4% eggs per tap', base: 38, grow: 1.17, max: 100 },
    { id: 'falcon', grp: 'farm', name: 'Falconry', icon: '🦅', desc: '+0.25% crit chance', base: 225, grow: 1.3, max: 60 },
    { id: 'darkHunter', grp: 'farm', name: 'Dark Hunter', icon: '🌒', desc: '+3% evil eggs', base: 120, grow: 1.2, max: 100 },
    { id: 'bountyNotes', grp: 'farm', name: 'Bounty Notes', icon: '📜', desc: '+3% eggs from arena kills', base: 90, grow: 1.2, max: 100 },
    { id: 'camp', grp: 'farm', name: 'Base Camp', icon: '⛺', desc: 'Every new run starts with +10 hens', base: 150, grow: 1.3, max: 40 },
    { id: 'learner', grp: 'farm', name: 'Quick Study', icon: '🧠', desc: '+2% XP gain', base: 135, grow: 1.25, max: 50 },
    { id: 'pens', grp: 'farm', name: 'Fox Pens', icon: '🪹', desc: '+10 evil chicken capacity', base: 200, grow: 1.25, max: 100 },
    { id: 'traps', grp: 'farm', name: 'Trap Sales', icon: '🪤', desc: '−1% farmer prices', base: 600, grow: 1.45, max: 25 },
    { id: 'nav', grp: 'farm', name: 'Navigator', icon: '🧭', desc: 'Expeditions finish 2% faster', base: 1200, grow: 1.55, max: 20 },
];
const hLvl = (id) => (gameData.hunt && gameData.hunt.perks && gameData.hunt.perks[id]) || 0;
const huntCost = (p) => Math.ceil(p.base * Math.pow(p.grow, hLvl(p.id)));
const rankXp = (r) => Math.floor(14 * r * r);
const xpTile = (id) => 1 + 0.12 * (id - 1);
const uLvl = (shop, id) => (gameData.Upgrades[shop] && gameData.Upgrades[shop][id] && gameData.Upgrades[shop][id].lvl) || 0;
const miles = (lvl, every) => Math.pow(2, Math.floor(lvl / every));

/* ---------- late game: retirement perks, expeditions, artifacts ---------- */
const RETIRE_LEVEL = 40;
const GOLDEN = [
    { id: 'hens', name: 'Golden Hens', icon: '🐔', desc: 'Start every run with +25 chickens', base: 3, grow: 1.4, max: 60 },
    { id: 'magnet', name: 'Egg Magnet', icon: '🧲', desc: '+50% eggs per tap', base: 2, grow: 1.4, max: 60 },
    { id: 'pecker', name: 'Auto-Pecker', icon: '🐦', desc: 'Taps the coop for you once a second', base: 5, grow: 1.6, max: 30 },
    { id: 'keepFarmers', name: 'Farmhand Contracts', icon: '📜', desc: 'Keep the Farmers unlock when you retire', base: 15, grow: 1, max: 1 },
    { id: 'claws', name: 'Sharp Claws', icon: '🦅', desc: '+2% crit chance', base: 4, grow: 1.45, max: 40 },
    { id: 'darkPact', name: 'Dark Pact', icon: '🕯️', desc: '+25% evil eggs', base: 4, grow: 1.45, max: 60 },
    { id: 'nest', name: 'Soft Nest', icon: '🪺', desc: '+10% XP gain', base: 3, grow: 1.5, max: 40 },
    { id: 'scouts', name: 'Scout Hens', icon: '🧭', desc: 'Expeditions finish 10% faster', base: 6, grow: 1.6, max: 8 },
    { id: 'headStart', name: 'Head Start', icon: '🚀', desc: 'Start runs with Better Laying +5 levels', base: 5, grow: 1.45, max: 40 },
    { id: 'tycoon', name: 'Egg Tycoon', icon: '💼', desc: '+20% eggs', base: 8, grow: 1.35, max: 80 },
    { id: 'champion', name: 'Arena Champion', icon: '🏆', desc: '+15% farmer damage', base: 8, grow: 1.35, max: 80 },
    { id: 'bounty', name: 'Bounty Hunter', icon: '💰', desc: '+50% eggs from arena kills', base: 6, grow: 1.4, max: 60 },
    { id: 'luckyTrips', name: 'Treasure Map', icon: '🗺️', desc: '+5% artifact chance on expeditions', base: 12, grow: 1.7, max: 12 },
    { id: 'evilLord', name: 'Evil Overlord', icon: '👿', desc: '+1% chance a hen turns evil', base: 10, grow: 1.6, max: 25 },
    { id: 'darkLedger', name: 'Dark Ledger', icon: '📕', desc: '+25% evil chicken capacity', base: 10, grow: 1.5, max: 30 },
    { id: 'breeder', name: 'Master Breeder', icon: '🥚', desc: 'Hen breeds cost 5% less', base: 12, grow: 1.6, max: 12 },
    { id: 'hunter', name: "Hunter's Pride", icon: '🦊', desc: '+10% clovers from the Egg Hunt', base: 10, grow: 1.5, max: 40 },
];
// second prestige: ascend to the Star Coop. Resets feathers and golden perks too, pays star eggs.
const ASCEND_LEVEL = 75, ASCEND_REBIRTHS = 3;
const STAR_UPS = [
    { id: 'starlight', name: 'Starlight', icon: '🌟', desc: '×2 eggs', base: 1, grow: 1.9, max: 30 },
    { id: 'nova', name: 'Nova Farmers', icon: '💥', desc: '×2 farmer damage', base: 1, grow: 1.9, max: 30 },
    { id: 'stellar', name: 'Stellar Plumage', icon: '🪶', desc: '+50% golden feathers from retiring', base: 2, grow: 1.7, max: 25 },
    { id: 'comet', name: 'Comet Trails', icon: '☄️', desc: 'Expeditions 20% faster', base: 3, grow: 2.3, max: 4 },
    { id: 'celestial', name: 'Celestial Hens', icon: '🐣', desc: 'Start every run with +50 incubators', base: 2, grow: 1.8, max: 25 },
    { id: 'bigbang', name: 'Big Bang', icon: '🌠', desc: 'Start every run at farm level 15', base: 8, grow: 1, max: 1 },
    { id: 'zodiac', name: 'Zodiac Pact', icon: '♈', desc: 'Keep 10% of your golden perk levels when you ascend', base: 6, grow: 2, max: 9 },
    { id: 'breedStar', name: 'Pedigree', icon: '🏅', desc: 'Hen breeds are 25% stronger', base: 4, grow: 1.9, max: 20 },
    { id: 'darkStar', name: 'Black Hole Yolks', icon: '⚫', desc: '×2 evil eggs', base: 3, grow: 1.9, max: 20 },
    { id: 'darkDynasty', name: 'Dark Dynasty', icon: '🏰', desc: '+25% evil chicken capacity', base: 3, grow: 1.8, max: 25 },
    { id: 'stellarHunt', name: 'Star Hunters', icon: '🔭', desc: '×1.5 clovers from the Egg Hunt', base: 5, grow: 1.9, max: 20 },
];
const sLvl = (id) => (gameData.starUps && gameData.starUps[id]) || 0;
const starCost = (p) => Math.ceil(p.base * Math.pow(p.grow, sLvl(p.id)));
const trophies = () => Math.floor((gameData.stats.bestArena || 1) / 25);
const EXPEDITIONS = [
    { id: 'meadow', name: 'Sunny Meadow', icon: '🌼', mins: 2, lvl: 25, send: 0.1, eggs: 180, evil: 0, art: 0.12, pool: ['goldenEgg', 'clover', 'incubator'] },
    { id: 'forest', name: 'Whispering Forest', icon: '🌲', mins: 10, lvl: 30, send: 0.2, eggs: 900, evil: 300, art: 0.28, pool: ['goldenEgg', 'clover', 'pitchfork', 'shadow', 'incubator'] },
    { id: 'volcano', name: 'Molten Volcano', icon: '🌋', mins: 30, lvl: 40, send: 0.3, eggs: 3000, evil: 1500, art: 0.45, pool: ['pitchfork', 'dragon', 'shadow', 'hourglass', 'goldenEgg'] },
    { id: 'moon', name: 'The Moon', icon: '🌙', mins: 120, lvl: 55, send: 0.4, eggs: 14000, evil: 8000, art: 0.75, pool: ['moonRock', 'dragon', 'hourglass', 'pitchfork', 'goldenEgg', 'shadow'] },
    { id: 'sea', name: 'The Deep Sea', icon: '🌊', mins: 240, lvl: 70, send: 0.45, eggs: 40000, evil: 25000, art: 0.85, pool: ['trident', 'pearl', 'moonRock', 'dragon', 'goldenEgg'] },
    { id: 'mars', name: 'Mars Colony', icon: '🪐', mins: 480, lvl: 85, send: 0.5, eggs: 110000, evil: 70000, art: 1, pool: ['marsSeed', 'pearl', 'trident', 'voidShard', 'moonRock'] },
    { id: 'void', name: 'The Void', icon: '🕳️', mins: 720, lvl: 100, send: 0.55, eggs: 300000, evil: 200000, art: 1, pool: ['voidShard', 'marsSeed', 'pearl', 'trident', 'hourglass'] },
    { id: 'rift', name: 'Dimensional Rift', icon: '🌀', mins: 960, lvl: 120, send: 0.55, eggs: 700000, evil: 500000, art: 1, pool: ['sunStone', 'darkMirror', 'voidShard', 'marsSeed', 'hourglass'] },
    { id: 'galaxy', name: 'The Far Galaxy', icon: '🌠', mins: 1200, lvl: 145, send: 0.6, eggs: 1.6e6, evil: 1.2e6, art: 1, pool: ['sunStone', 'thunderQuill', 'hornHunt', 'voidShard', 'darkMirror'] },
    { id: 'eden', name: 'The First Coop', icon: '🌳', mins: 1440, lvl: 170, send: 0.6, eggs: 4e6, evil: 3e6, art: 1, pool: ['sunStone', 'thunderQuill', 'hornHunt', 'darkMirror', 'pearl'] },
];
const ARTIFACTS = {
    goldenEgg: { name: 'Golden Egg', icon: '🥚', desc: '+15% eggs', max: 10 },
    pitchfork: { name: 'Rusty Pitchfork', icon: '🔱', desc: '+15% farmer damage', max: 10 },
    clover: { name: 'Lucky Clover', icon: '🍀', desc: '+1% crit chance', max: 10 },
    dragon: { name: 'Dragon Scale', icon: '🐉', desc: '+0.3× crit damage', max: 10 },
    incubator: { name: 'Ancient Incubator', icon: '🏺', desc: '+15% incubator output', max: 10 },
    shadow: { name: 'Shadow Feather', icon: '🪶', desc: '+15% evil eggs', max: 10 },
    hourglass: { name: 'Sand Hourglass', icon: '⌛', desc: 'Expeditions finish 4% faster', max: 6 },
    moonRock: { name: 'Moon Rock', icon: '🪨', desc: '+10% golden feathers on retirement', max: 10 },
    trident: { name: "Neptune's Trident", icon: '🔱', desc: '+30% eggs per tap', max: 10 },
    pearl: { name: 'Black Pearl', icon: '🦪', desc: '+20% expedition loot', max: 10 },
    marsSeed: { name: 'Martian Seed', icon: '🌱', desc: '+25% incubator output', max: 10 },
    voidShard: { name: 'Void Shard', icon: '🔮', desc: '+25% farmer damage', max: 10 },
    sunStone: { name: 'Sun Stone', icon: '☀️', desc: '+20% eggs', max: 10 },
    thunderQuill: { name: 'Thunder Quill', icon: '🪽', desc: '+20% farmer damage', max: 10 },
    hornHunt: { name: "Hunter's Horn", icon: '📣', desc: '+10% clovers from the Egg Hunt', max: 10 },
    darkMirror: { name: 'Dark Mirror', icon: '🪞', desc: '+20% evil chicken capacity', max: 10 },
};
const STAR_KEYS = ['stars', 'totalStars', 'ascensions', 'starUps', 'feathersSinceAscend'];
const KEEP_ON_RETIRE = ['feathers', 'totalFeathers', 'rebirths', 'golden', 'artifacts', 'stats', 'lastSeen', 'hunt', ...STAR_KEYS];

const gLvl = (id) => (gameData.golden && gameData.golden[id]) || 0;
const aLvl = (id) => (gameData.artifacts && gameData.artifacts[id]) || 0;
const goldenCost = (p) => Math.ceil(p.base * Math.pow(p.grow, gLvl(p.id)));
const featherBonus = () => 1 + gameData.feathers * 0.05;
const breedMult = () => BREEDS.reduce((m, b) => (gameData.Breeds && gameData.Breeds[b.id]) ? m * (1 + (b.mult - 1) * (1 + 0.25 * sLvl('breedStar'))) : m, 1);
const eggMult = () => featherBonus() * (1 + 0.15 * aLvl('goldenEgg')) * (1 + 0.2 * aLvl('sunStone')) * (1 + 0.2 * gLvl('tycoon')) * Math.pow(2, sLvl('starlight'))
    * (1 + 0.05 * uLvl('Normal', 'feed')) * miles(uLvl('Normal', 'EggsPerChicken'), 25) * breedMult()
    * (1 + 0.03 * hLvl('pelts')) * (1 + 0.08 * uLvl('Evil', 'HexPlenty'));
const damageMult = () => featherBonus() * (1 + 0.15 * aLvl('pitchfork')) * (1 + 0.25 * aLvl('voidShard')) * (1 + 0.2 * aLvl('thunderQuill')) * (1 + 0.15 * gLvl('champion')) * Math.pow(2, sLvl('nova')) * (1 + 0.03 * trophies())
    * (1 + 0.05 * uLvl('Normal', 'dummies')) * (1 + 0.1 * uLvl('Evil', 'ShadowForge')) * (1 + 0.03 * hLvl('bow'));
const evilMult = () => (1 + 0.25 * gLvl('darkPact')) * (1 + 0.15 * aLvl('shadow')) * (1 + 0.1 * uLvl('Evil', 'DarkFeed')) * (1 + 0.03 * hLvl('darkHunter')) * Math.pow(2, sLvl('darkStar'));
const xpMult = () => (1 + 0.04 * uLvl('Normal', 'tutor')) * (1 + 0.1 * gLvl('nest')) * (1 + 0.02 * hLvl('learner'));
const huntMult = () => (1 + 0.1 * hLvl('basket')) * (1 + 0.1 * gLvl('hunter')) * (1 + 0.1 * aLvl('hornHunt')) * Math.pow(1.5, sLvl('stellarHunt'));
const farmerDisc = () => Math.max(0.25, 1 - 0.02 * uLvl('Normal', 'haggle') - 0.01 * hLvl('traps'));
const breedCost = (b) => Math.floor(b.cost * (1 - 0.05 * gLvl('breeder')));
// dark Coop: the evil flock can't grow past its barn, and breeds logistically (fast when small, slowing as it fills)
// capacity comes from many places: farm level, both markets, hunt perks, golden perks, artifacts and star upgrades
const evilCap = () => Math.floor((40 + 2 * gameData.Level + 20 * uLvl('Evil', 'DarkBarn') + 10 * uLvl('Normal', 'silo') + 10 * hLvl('pens'))
    * (1 + 0.25 * gLvl('darkLedger')) * (1 + 0.2 * aLvl('darkMirror')) * (1 + 0.25 * sLvl('darkDynasty')));
const evilGrowth = () => 0.02 + Math.max(0, gameData.EvilChickenReproductionRate - 1) + 0.004 * uLvl('Evil', 'DarkBreeding');
const evilChance = () => Math.min(50, gameData.EvilChickenChance + gLvl('evilLord'));
const evilPerSec = () => gameData.EvilChickens * evilMult();
const critChance = () => gameData.CritChance + gLvl('claws') * 2 + aLvl('clover') + 0.5 * uLvl('Normal', 'beaks') + 0.25 * hLvl('falcon');
const critDamage = () => gameData.CritDamage + aLvl('dragon') * 0.3;
function featherGain() {
    if (gameData.Level < RETIRE_LEVEL) return 0;
    const base = Math.pow(gameData.Level / 10, 2.2) + gameData.stats.bestArena / 4;
    return Math.floor(base * (1 + 0.1 * aLvl('moonRock')) * (1 + 0.5 * sLvl('stellar')));
}
function starGain() {
    if (gameData.Level < ASCEND_LEVEL || gameData.rebirths < ASCEND_REBIRTHS) return 0;
    return Math.max(1, Math.floor(Math.pow((gameData.feathersSinceAscend + featherGain()) / 150, 0.6)));
}

/* ---------- save / load with migration ---------- */
function deepMerge(base, saved) {
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return saved === undefined ? structuredClone(base) : saved;
    const out = Array.isArray(base) ? [] : {};
    for (const k of Object.keys(base)) {
        const b = base[k];
        if (saved[k] === undefined || saved[k] === null) out[k] = structuredClone(b);
        else if (b && typeof b === 'object' && !Array.isArray(b)) out[k] = deepMerge(b, saved[k]);
        else out[k] = saved[k];
    }
    for (const k of Object.keys(saved)) if (!(k in out)) out[k] = saved[k];
    return out;
}

let gameData;
function loadGame() {
    gameData = deepMerge(DEFAULTS, Arcade.load(GameSave, null) || {});
    // static unlock info always comes from the definitions, only "Unlocked" is save data
    for (const [k, u] of Object.entries(DEFAULTS.Unlocks)) gameData.Unlocks[k] = { ...u, Unlocked: !!(gameData.Unlocks[k] && gameData.Unlocks[k].Unlocked) };
    // make sure every farmer has a save slot
    for (const k of FARMER_KEYS) {
        const f = gameData.Farmers[k] || {};
        const ups = {};
        for (const u of Object.keys(farmerData[k].Upgrades)) ups[u] = !!(f.UpgradesUnlocked && f.UpgradesUnlocked[u]);
        gameData.Farmers[k] = { level: f.level || 1, damage: f.damage || farmerData[k].baseDmg, damageMultiplier: f.damageMultiplier || 1, UpgradesUnlocked: ups };
    }
    gameData.Unlocks.Hunt.Unlocked = !!gameData.hunt.unlocked;
    migrate();
}
/** one-off fixes for older saves. Safe to run on every load: each step checks the save version. */
function migrate() {
    if ((gameData.ver || 0) >= 2) return;
    // offline progress is gone: refund the Long Nap perk
    const nap = (gameData.golden && gameData.golden.nap) || 0;
    if (nap) { let c = 0; for (let i = 0; i < nap; i++) c += Math.ceil(3 * Math.pow(1.7, i)); gameData.feathers += c; delete gameData.golden.nap; }
    // the old exponential breeding could push the evil flock and evil eggs to absurd sizes
    gameData.EvilChickens = Math.min(gameData.EvilChickens, evilCap());
    if (gameData.EvilEggs > 2e6) gameData.EvilEggs = 2e6;
    gameData.EvilChickenReproductionRate = 1;
    gameData.ver = 2;
}
loadGame();

// only one open tab runs the economy; any others just mirror the save.
const TAB_ID = Math.random().toString(36).slice(2);
function isMasterTab() {
    const lock = Arcade.load(GameSave + '.lock', null), now = Date.now();
    if (!lock || lock.id === TAB_ID || now - lock.t > 2500) { Arcade.save(GameSave + '.lock', { id: TAB_ID, t: now }); return true; }
    return false;
}

function save() {
    gameData.lastSeen = Date.now();
    Arcade.save(GameSave, gameData);
}

/** every player action goes through here: re-read the save first so a stale
 *  copy in memory can never overwrite newer progress, then apply and save. */
function act(fn) {
    loadGame();
    const r = fn();
    save();
    return r;
}

/* ---------- core numbers ---------- */
const eggsPerSec = () => gameData.chickens * gameData.EggsPerChicken * eggMult();

// like Click Heroes: every 25 levels a farmer's damage doubles, and past level 200 it quadruples instead
const levelMilestones = (lv) => Math.pow(2, Math.floor(Math.min(lv, 200) / 25)) * Math.pow(4, Math.floor(Math.max(0, lv - 200) / 25));
function updateFarmerDamage(key) {
    const s = gameData.Farmers[key];
    s.damage = farmerData[key].baseDmg * gameData.DamageMultipliers * s.level * s.damageMultiplier * damageMult() * levelMilestones(s.level);
}

function totalDPS() {
    let d = 0;
    for (let i = 0; i < gameData.AmountOfFarmersUnlocked; i++) {
        const k = FARMER_KEYS[i];
        updateFarmerDamage(k);
        d += gameData.Farmers[k].damage;
    }
    return d;
}

const tapDamage = () => Math.max(1, (1 + gameData.Level * 2) * featherBonus() + totalDPS() * 0.05);
const tapEggs = () => Math.max(1, eggsPerSec() * 0.5 * (1 + 0.5 * gLvl('magnet')) * (1 + 0.3 * aLvl('trident')) * (1 + 0.12 * uLvl('Normal', 'cartons')) * (1 + 0.04 * hLvl('birdcall')));

function farmerCost(key, levels) {
    const b = farmerData[key].cost, r = 1.07, k = gameData.Farmers[key].level;
    // geometric series: cost of buying `levels` levels starting from k
    return Math.floor(farmerDisc() * b * Math.pow(r, k) * (Math.pow(r, levels) - 1) / (r - 1));
}
function maxAffordable(key) {
    const b = farmerData[key].cost, r = 1.07, k = gameData.Farmers[key].level, c = gameData.eggs / farmerDisc();
    const n = Math.log(c * (r - 1) / (b * Math.pow(r, k)) + 1) / Math.log(r);
    return Math.max(0, Math.floor(n));
}

/* ---------- combat ---------- */
function spawnNextChicken() {
    const c = gameData.combatData;
    const level = c.level;
    if (level < 15 || gameData.EvilChickens >= 1) {
        if (level >= 15) gameData.EvilChickens--;
        c.isBoss = level % 5 === 0;
        let hp;
        if (level <= 140) hp = 10 * (level - 1 + Math.pow(1.55, level - 1));
        else if (level <= 500) hp = 2.8583e27 * Math.pow(1.145, level - 140);
        else hp = 4.2275e48 * Math.pow(1.145, level - 500);
        if (c.isBoss) hp *= 10;
        c.maxHp = hp;
        c.currentHp = hp;
    } else {
        c.currentHp = 0;
    }
}

function damageChicken(amount, crit) {
    const c = gameData.combatData;
    if (c.currentHp <= 0) return false;
    c.currentHp = Math.max(0, c.currentHp - amount);
    if (c.currentHp === 0) killChicken();
    return true;
}

function killChicken() {
    const c = gameData.combatData;
    const bonus = (1 + 0.5 * gLvl('bounty')) * (1 + 0.03 * hLvl('bountyNotes'));
    // the arena may never out-earn the coop: a kill is worth at most a few seconds of egg production
    const cap = eggsPerSec() * (8 + 0.4 * c.level) * (c.isBoss ? 4 : 1) * bonus;
    const reward = Math.max(1, Math.floor(Math.min(c.maxHp / 10 * eggMult() * bonus, cap)));
    const trophyBefore = trophies();
    gameData.eggs += reward;
    gameData.stats.lifetimeEggs += reward;
    gameData.stats.kills++;
    if (c.isBoss) { gameData.EvilEggs += Math.floor(2 * Math.pow(1.1, c.level) * evilMult()); gameData.stats.bossKills++; }
    c.chickensKilledOnLevel++;
    if (c.isBoss || c.chickensKilledOnLevel >= 5) { c.level++; c.chickensKilledOnLevel = 0; }
    gameData.stats.bestArena = Math.max(gameData.stats.bestArena || 1, c.level);
    if (trophies() > trophyBefore) Arcade.toast(`🏆 Arena trophy ${trophies()}! Farmers deal +${trophies() * 3}% damage`, 'gold', 3000);
    if (typeof onChickenKilled === 'function') onChickenKilled(reward, c.isBoss);
    spawnNextChicken();
}

function combatTick() {
    const dps = totalDPS();
    if (dps <= 0) return;
    if (gameData.combatData.currentHp <= 0) { spawnNextChicken(); return; }
    const crit = Math.random() * 100 < critChance();
    damageChicken(dps * (crit ? critDamage() : 1), crit);
    if (typeof onFarmerHit === 'function') onFarmerHit(dps * (crit ? critDamage() : 1), crit);
}

/* ---------- buy amounts (x1 / x10 / x100 / Max) ---------- */
let buyAmt = Arcade.load(GameSave + '.buyAmt', 1);
if (![1, 10, 100, 'max'].includes(buyAmt)) buyAmt = 1;
function setBuyAmt(v) { buyAmt = v; Arcade.save(GameSave + '.buyAmt', v); }
/** how many levels can be bought starting at `lvl`, and what they cost in total. costAt(level) is the price of that level. */
function bulkQuote(costAt, lvl, maxLvl, budget, amt) {
    const want = amt === 'max' ? Infinity : amt;
    let n = 0, total = 0;
    while (n < want && lvl + n < maxLvl && n < 5000) {
        const c = costAt(lvl + n);
        if (total + c > budget) break;
        total += c; n++;
    }
    return { n, total };
}
/** quote for the current buy amount; when nothing is affordable it still reports the price of the next level. */
function quoteFor(costAt, lvl, maxLvl, budget) {
    const q = bulkQuote(costAt, lvl, maxLvl, budget, buyAmt);
    return q.n ? q : { n: 0, total: costAt(lvl) };
}
const quoteLabel = (q, icon) => (q.n > 1 ? `×${q.n} · ` : '') + icon + ' ' + fmt(q.total);
const upgCostAt = (upg) => (lvl) => Math.floor(upg.baseCost * Math.pow(upg.costIncrease, lvl));
const goldCostAt = (p) => (lvl) => Math.ceil(p.base * Math.pow(p.grow, lvl));
const huntCostAt = (p) => (lvl) => Math.ceil(p.base * Math.pow(p.grow, lvl));

/* ---------- generator chain: generator of generators of ... incubators, without end ---------- */
const GEN_BASE = 5e4, GEN_STEP = 100, GEN_GROW = 1.6, GEN_LEVEL0 = 45, GEN_LEVEL_STEP = 10;
const genName = (t) => t <= 5 ? 'Incubator ' + 'Generator '.repeat(t).trim() : `Incubator Generator ×${t}`;
const genLevelReq = (t) => GEN_LEVEL0 + GEN_LEVEL_STEP * (t - 2);
const genCostAt = (t) => (bought) => Math.floor(GEN_BASE * Math.pow(GEN_STEP, t - 2) * Math.pow(GEN_GROW, bought));
const genBought = (t) => (gameData.Gens[t] && gameData.Gens[t].bought) || 0;
const genCount = (t) => (gameData.Gens[t] && gameData.Gens[t].count) || 0;
/** tiers that exist for the player: every owned tier plus the next one once the previous tier is owned. */
function genTiersShown() {
    let t = 2;
    while (genBought(t) > 0) t++;
    const out = [];
    for (let k = 2; k <= t; k++) out.push(k);
    return out;
}
function genUnlocked(t) { return gameData.Level >= genLevelReq(t) && (t === 2 ? gameData.Upgrades.Evil.IncubatorGenerator.lvl > 0 : genBought(t - 1) > 0); }

/* ---------- purchases ---------- */
function upgradeCost(upg, shop) {
    const lvl = gameData.Upgrades[shop][upg.id].lvl;
    return Math.floor(upg.baseCost * Math.pow(upg.costIncrease, lvl));
}

function buyUpgrade(shop, id) {
    return act(() => {
        const list = shop === 'Evil' ? Upgrades.Evil : Upgrades.Market;
        const upg = list.find(u => u.id === id);
        const slot = gameData.Upgrades[shop][id];
        const currency = shop === 'Evil' ? 'EvilEggs' : 'eggs';
        if (slot.lvl >= upg.maxLevel || gameData.Level < upg.levelReq) return false;
        const q = bulkQuote(upgCostAt(upg), slot.lvl, upg.maxLevel, gameData[currency], buyAmt);
        if (!q.n) { Arcade.toast('Not enough ' + (shop === 'Evil' ? 'evil eggs' : 'eggs'), 'bad'); Arcade.sfx('bad'); return false; }
        gameData[currency] -= q.total;
        if (upg.stat) gameData[id] = (gameData[id] || 0) + upg.increase * q.n;
        slot.lvl += q.n;
        Arcade.sfx('coin');
        return true;
    });
}
function buyGen(t) {
    return act(() => {
        if (!genUnlocked(t)) return false;
        const q = bulkQuote(genCostAt(t), genBought(t), Infinity, gameData.EvilEggs, buyAmt);
        if (!q.n) { Arcade.toast('Not enough evil eggs', 'bad'); Arcade.sfx('bad'); return false; }
        gameData.EvilEggs -= q.total;
        const g = gameData.Gens[t] || (gameData.Gens[t] = { bought: 0, count: 0 });
        g.bought += q.n; g.count += q.n;
        Arcade.sfx('power');
        return true;
    });
}

function buyUnlock(key) {
    return act(() => {
        const u = gameData.Unlocks[key];
        if (u.Unlocked || gameData.Level < u.lvlReq) return false;
        if (gameData[u.CostType] < u.Cost) { Arcade.toast('Not enough eggs', 'bad'); Arcade.sfx('bad'); return false; }
        gameData[u.CostType] -= u.Cost;
        u.Unlocked = true;
        if (key === 'Hunt') { gameData.hunt.unlocked = true; Arcade.toast('Egg Hunt unlocked! Find it in the tab bar.', 'gold', 3500); }
        else Arcade.toast('Farmers unlocked! Hire them on the Farm tab.', 'gold', 3000);
        Arcade.sfx('win');
        return true;
    });
}

function buyBreed(id) {
    return act(() => {
        const b = BREEDS.find(x => x.id === id), cost = breedCost(b);
        if (!b || gameData.Breeds[id] || gameData.Level < b.lvl) return false;
        if (gameData.eggs < cost) { Arcade.toast('Not enough eggs', 'bad'); Arcade.sfx('bad'); return false; }
        gameData.eggs -= cost;
        gameData.Breeds[id] = true;
        Arcade.sfx('power');
        return true;
    });
}

function buyHuntPerk(id) {
    return act(() => {
        const p = HUNT_PERKS.find(x => x.id === id), lv = hLvl(id);
        if (!p || lv >= p.max) return false;
        const q = bulkQuote(huntCostAt(p), lv, p.max, gameData.hunt.clovers, buyAmt);
        if (!q.n) { Arcade.toast('Not enough clovers', 'bad'); Arcade.sfx('bad'); return false; }
        gameData.hunt.clovers -= q.total;
        gameData.hunt.perks[id] = lv + q.n;
        Arcade.sfx('power');
        return true;
    });
}

function buyNextFarmer() {
    return act(() => {
        if (!gameData.Unlocks.Farmers.Unlocked) return false;
        const key = FARMER_KEYS[gameData.AmountOfFarmersUnlocked];
        if (!key) return false;
        const cost = farmerData[key].cost;
        if (gameData.eggs < cost) { Arcade.toast('Need ' + fmt(cost) + ' eggs', 'bad'); Arcade.sfx('bad'); return false; }
        gameData.eggs -= cost;
        gameData.AmountOfFarmersUnlocked++;
        updateFarmerDamage(key);
        Arcade.toast(farmerData[key].name + ' joined the farm!', 'gold');
        Arcade.sfx('level');
        return true;
    });
}

/** hires every farmer you can currently afford, in order. */
function hireAllFarmers() {
    return act(() => {
        if (!gameData.Unlocks.Farmers.Unlocked) return 0;
        let n = 0;
        for (;;) {
            const key = FARMER_KEYS[gameData.AmountOfFarmersUnlocked];
            if (!key || gameData.eggs < farmerData[key].cost) break;
            gameData.eggs -= farmerData[key].cost;
            gameData.AmountOfFarmersUnlocked++;
            updateFarmerDamage(key);
            n++;
        }
        if (n) { Arcade.toast(n === 1 ? 'A farmer joined the farm!' : n + ' farmers joined the farm!', 'gold'); Arcade.sfx('level'); }
        return n;
    });
}
/** spends eggs on the cheapest farmer levels first, until nothing more is affordable. */
function levelAllFarmers() {
    return act(() => {
        let bought = 0;
        for (let guard = 0; guard < 4000; guard++) {
            let best = null, bc = Infinity;
            for (let i = 0; i < gameData.AmountOfFarmersUnlocked; i++) { const k = FARMER_KEYS[i], c = farmerCost(k, 1); if (c < bc) { bc = c; best = k; } }
            if (!best || bc > gameData.eggs) break;
            // buy in bigger bites once the cheapest farmer is far ahead of its budget share, to keep this fast
            const n = Math.max(1, Math.min(maxAffordable(best), Math.floor(gameData.Farmers[best].level * 0.05)));
            const cost = farmerCost(best, n);
            if (cost > gameData.eggs) break;
            gameData.eggs -= cost; gameData.Farmers[best].level += n; bought += n;
        }
        for (let i = 0; i < gameData.AmountOfFarmersUnlocked; i++) updateFarmerDamage(FARMER_KEYS[i]);
        if (bought) Arcade.sfx('coin'); else Arcade.sfx('bad');
        return bought;
    });
}
/** buys every farmer perk that is unlocked and affordable, cheapest first. */
function buyAllFarmerPerks() {
    return act(() => {
        let n = 0;
        for (;;) {
            let best = null;
            for (let i = 0; i < gameData.AmountOfFarmersUnlocked; i++) {
                const k = FARMER_KEYS[i], s = gameData.Farmers[k];
                for (const [uk, u] of Object.entries(farmerData[k].Upgrades)) {
                    if (s.UpgradesUnlocked[uk] || s.level < u.levelReq || u.cost > gameData.eggs) continue;
                    if (!best || u.cost < best.u.cost) best = { k, uk, u };
                }
            }
            if (!best) break;
            const { k, uk, u } = best, s = gameData.Farmers[k];
            gameData.eggs -= u.cost; s.UpgradesUnlocked[uk] = true;
            if (u.buffType === 'Damage') s.damageMultiplier += u.buffAmount;
            else if (u.buffType === 'AllDamage') gameData.DamageMultipliers += u.buffAmount;
            else if (u.buffType === 'CritChance') gameData.CritChance += u.buffAmount;
            else if (u.buffType === 'CritDamage') gameData.CritDamage += u.buffAmount;
            n++;
        }
        for (let i = 0; i < gameData.AmountOfFarmersUnlocked; i++) updateFarmerDamage(FARMER_KEYS[i]);
        if (n) { Arcade.toast(`Bought ${n} farmer perk${n > 1 ? 's' : ''}`, 'gold'); Arcade.sfx('power'); } else Arcade.sfx('bad');
        return n;
    });
}

function upgradeFarmer(key, levels) {
    return act(() => {
        if (levels <= 0) return false;
        const cost = farmerCost(key, levels);
        if (gameData.eggs < cost) { Arcade.sfx('bad'); return false; }
        gameData.eggs -= cost;
        gameData.Farmers[key].level += levels;
        updateFarmerDamage(key);
        Arcade.sfx('coin');
        return true;
    });
}

function buyFarmerUpgrade(key, upKey) {
    return act(() => {
        const up = farmerData[key].Upgrades[upKey];
        const s = gameData.Farmers[key];
        if (s.UpgradesUnlocked[upKey] || s.level < up.levelReq) return false;
        if (gameData.eggs < up.cost) { Arcade.toast('Not enough eggs', 'bad'); Arcade.sfx('bad'); return false; }
        gameData.eggs -= up.cost;
        s.UpgradesUnlocked[upKey] = true;
        if (up.buffType === 'Damage') s.damageMultiplier += up.buffAmount;
        else if (up.buffType === 'AllDamage') gameData.DamageMultipliers += up.buffAmount;
        else if (up.buffType === 'CritChance') gameData.CritChance += up.buffAmount;
        else if (up.buffType === 'CritDamage') gameData.CritDamage += up.buffAmount;
        updateFarmerDamage(key);
        Arcade.sfx('power');
        return true;
    });
}

function buyGolden(id) {
    return act(() => {
        const p = GOLDEN.find(x => x.id === id);
        if (gLvl(id) >= p.max) return false;
        const q = bulkQuote(goldCostAt(p), gLvl(id), p.max, gameData.feathers, buyAmt);
        if (!q.n) { Arcade.toast('Not enough golden feathers', 'bad'); Arcade.sfx('bad'); return false; }
        gameData.feathers -= q.total;
        gameData.golden[id] = gLvl(id) + q.n;
        Arcade.sfx('power');
        return true;
    });
}

function retire() {
    return act(() => {
        const gain = featherGain();
        if (gain <= 0) return 0;
        const kept = {};
        for (const k of KEEP_ON_RETIRE) kept[k] = gameData[k];
        const keepFarmers = gLvl('keepFarmers') > 0;
        gameData = deepMerge(DEFAULTS, {});
        Object.assign(gameData, kept);
        gameData.feathers += gain;
        gameData.totalFeathers += gain;
        gameData.feathersSinceAscend = (gameData.feathersSinceAscend || 0) + gain;
        gameData.rebirths++;
        Arcade.report('rebirths', gameData.rebirths);
        startingBoosts();
        const hs = gLvl('headStart') * 5;
        gameData.Upgrades.Normal.EggsPerChicken.lvl = hs;
        gameData.EggsPerChicken = 1 + hs * 0.1;
        if (keepFarmers) gameData.Unlocks.Farmers.Unlocked = true;
        for (const k of FARMER_KEYS) gameData.Farmers[k] = { level: 1, damage: farmerData[k].baseDmg, damageMultiplier: 1, UpgradesUnlocked: Object.fromEntries(Object.keys(farmerData[k].Upgrades).map(u => [u, false])) };
        spawnNextChicken();
        Arcade.sfx('win');
        return gain;
    });
}
/** perks that shape the start of every fresh run. */
function startingBoosts() {
    gameData.chickens = 1 + 25 * gLvl('hens') + 10 * hLvl('camp');
    gameData.incubators = 50 * sLvl('celestial');
    if (sLvl('bigbang')) {
        gameData.Level = 15;
        let req = 100;
        for (let i = 0; i < 15; i++) req *= 1.4;
        gameData.expReq = req;
    }
}

function buyStar(id) {
    return act(() => {
        const p = STAR_UPS.find(x => x.id === id);
        if (sLvl(id) >= p.max) return false;
        const q = bulkQuote(goldCostAt(p), sLvl(id), p.max, gameData.stars, buyAmt);
        if (!q.n) { Arcade.toast('Not enough star eggs', 'bad'); Arcade.sfx('bad'); return false; }
        gameData.stars -= q.total;
        gameData.starUps[id] = sLvl(id) + q.n;
        Arcade.sfx('power');
        return true;
    });
}

/** second prestige: wipes the farm, feathers and golden perks; keeps artifacts, stats and star upgrades. */
function ascend() {
    return act(() => {
        const gain = starGain();
        if (gain <= 0) return 0;
        const keep = {};
        for (const k of ['artifacts', 'stats', 'lastSeen', 'totalFeathers', 'rebirths', 'hunt', ...STAR_KEYS]) keep[k] = gameData[k];
        const zodiac = sLvl('zodiac') * 0.1;
        const kept = {};
        for (const [id, lv] of Object.entries(gameData.golden || {})) { const k = Math.floor(lv * zodiac); if (k) kept[id] = k; }
        gameData = deepMerge(DEFAULTS, {});
        Object.assign(gameData, keep);
        gameData.golden = kept;
        gameData.feathers = 0;
        gameData.feathersSinceAscend = 0;
        gameData.stars += gain;
        gameData.totalStars += gain;
        gameData.ascensions++;
        for (const k of FARMER_KEYS) gameData.Farmers[k] = { level: 1, damage: farmerData[k].baseDmg, damageMultiplier: 1, UpgradesUnlocked: Object.fromEntries(Object.keys(farmerData[k].Upgrades).map(u => [u, false])) };
        startingBoosts();
        spawnNextChicken();
        Arcade.sfx('win');
        Arcade.report('ascensions', gameData.ascensions);
        return gain;
    });
}

/* ---------- expeditions ---------- */
const expeditionMs = (e) => e.mins * 60000 * Math.max(0.1, (1 - 0.1 * gLvl('scouts')) * (1 - 0.2 * sLvl('comet')) * (1 - 0.04 * aLvl('hourglass')) * (1 - 0.02 * hLvl('nav')));
const expeditionSend = (e) => Math.max(5, Math.floor(gameData.chickens * e.send));
function startExpedition(id) {
    return act(() => {
        const e = EXPEDITIONS.find(x => x.id === id);
        if (gameData.expedition || gameData.Level < e.lvl) return false;
        const sent = expeditionSend(e);
        if (gameData.chickens < sent + 1) { Arcade.toast('You need more chickens for that trip', 'bad'); Arcade.sfx('bad'); return false; }
        gameData.chickens -= sent;
        const now = Date.now();
        gameData.expedition = { id, start: now, end: now + expeditionMs(e), sent, eps: eggsPerSec() };
        Arcade.sfx('select');
        return true;
    });
}
/** returns the loot summary when an expedition has finished, otherwise null. */
function collectExpedition() {
    return act(() => {
        const x = gameData.expedition;
        if (!x || Date.now() < x.end) return null;
        const e = EXPEDITIONS.find(y => y.id === x.id);
        const loot = 1 + 0.2 * aLvl('pearl');
        const eggs = Math.floor(Math.max(1, x.eps) * e.eggs * eggMult() * loot);
        const evil = Math.floor(e.evil * (1 + gameData.Level / 10) * evilMult() * loot);
        gameData.eggs += eggs; gameData.stats.lifetimeEggs += eggs;
        gameData.EvilEggs += evil;
        gameData.chickens += x.sent;
        gameData.stats.expeditions = (gameData.stats.expeditions || 0) + 1;
        let artifact = null;
        if (Math.random() < Math.min(1, e.art + 0.05 * gLvl('luckyTrips'))) {
            const pool = e.pool.filter(a => aLvl(a) < ARTIFACTS[a].max);
            if (pool.length) {
                artifact = Arcade.pick(pool);
                gameData.artifacts[artifact] = aLvl(artifact) + 1;
            }
        }
        gameData.expedition = null;
        Arcade.sfx(artifact ? 'win' : 'coin');
        return { e, eggs, evil, artifact };
    });
}

function deleteSave() {
    Arcade.remove(GameSave);
    window.removeEventListener('pagehide', unloadSave);
    location.reload();
}

/* ---------- main tick (1s) ---------- */
function levelCheck() {
    let ups = 0;
    while (gameData.exp >= gameData.expReq) {
        gameData.exp -= gameData.expReq;
        gameData.expReq *= 1.4;
        gameData.Level++;
        ups++;
    }
    if (ups) { Arcade.toast('Farm level ' + gameData.Level + '!', 'gold'); Arcade.sfx('level'); }
}

function addExp(n) { gameData.exp += n * xpMult(); }

function tick() {
    const eps = eggsPerSec();
    gameData.eggs += eps;
    addExp(eps);
    gameData.stats.lifetimeEggs += eps;
    gameData.chickens += gameData.incubators * 0.2 * (1 + 0.15 * aLvl('incubator')) * (1 + 0.25 * aLvl('marsSeed')) * miles(uLvl('Normal', 'incubators'), 20);
    // generator chain: each tier makes the tier below it (tier 1 is the Incubator Generator itself)
    const tiers = Object.keys(gameData.Gens).map(Number).sort((a, b) => b - a);
    for (const t of tiers) {
        const made = genCount(t) * 0.2;
        if (t === 2) gameData.IncubatorGenerator += made;
        else if (gameData.Gens[t - 1]) gameData.Gens[t - 1].count += made;
    }
    gameData.incubators += gameData.IncubatorGenerator * 0.2;
    // auto-pecker perk: free coop taps
    const pecks = gLvl('pecker');
    if (pecks) {
        const n = tapEggs() * pecks;
        gameData.eggs += n; addExp(n); gameData.stats.lifetimeEggs += n; gameData.stats.taps += pecks;
        // the pecker also pokes the arena foe, like a tap would
        const dmg = gameData.combatData.currentHp > 0 ? tapDamage() * pecks : 0;
        if (dmg) damageChicken(dmg, false);
        if (typeof onAutoPeck === 'function') onAutoPeck(n, dmg);
    }
    levelCheck();

    // dark Coop: hens turn evil, then the flock breeds towards the barn's capacity
    const cap = evilCap();
    if (Math.random() * 100 < evilChance() && gameData.chickens >= 2 && gameData.EvilChickens < cap) {
        const n = Math.max(0, Math.min(gameData.EvilChickenConvertAmount, cap - gameData.EvilChickens, gameData.chickens - 1));
        gameData.chickens -= n;
        gameData.EvilChickens += n;
    }
    if (gameData.EvilChickens > 0) {
        gameData.EvilEggs += evilPerSec();
        const n = gameData.EvilChickens;
        gameData.EvilChickens = Math.min(cap, n + n * evilGrowth() * Math.max(0, 1 - n / cap));
    }
    combatTick();
    save();
}
// there is no offline progress: the farm only runs while this page is open.

/* ---------- shared header ---------- */
function refreshHeader() {
    Arcade.text('hEggs', fmt(gameData.eggs));
    Arcade.text('hEvil', fmt(gameData.EvilEggs));
    Arcade.text('hLevel', gameData.Level);
    Arcade.text('hFeathers', fmt(gameData.feathers));
    Arcade.text('hStars', fmt(gameData.stars));
    Arcade.text('hClovers', fmt(gameData.hunt.clovers));
    const cChip = document.getElementById('cloverChip');
    if (cChip) cChip.hidden = !gameData.hunt.unlocked;
    const sChip = document.getElementById('starChip');
    if (sChip) sChip.hidden = !gameData.totalStars;
    const evilChip = document.getElementById('evilChip');
    if (evilChip) evilChip.hidden = gameData.Level < 15 && gameData.EvilEggs <= 0;
    const fChip = document.getElementById('featherChip');
    if (fChip) fChip.hidden = !gameData.totalFeathers;
}

if (gameData.combatData.currentHp <= 0) spawnNextChicken();
save();
setInterval(() => {
    loadGame();
    if (isMasterTab()) tick();
    if (typeof refresh === 'function') refresh();
}, 1000);
// only the tab running the economy writes on the way out; others would write a stale copy.
function unloadSave() { if (isMasterTab()) save(); }
window.addEventListener('pagehide', unloadSave);
// coming back through the back/forward cache restores an old copy in memory, reload it.
window.addEventListener('pageshow', (e) => { if (e.persisted) { loadGame(); if (typeof refresh === 'function') refresh(); } });
// another tab changed the save: mirror it straight away.
window.addEventListener('storage', (e) => { if (e.key === GameSave) { loadGame(); if (typeof refresh === 'function') refresh(); } });
