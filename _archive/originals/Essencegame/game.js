// game.js
const BASE_STATE = { 
    essence: 50, crystals: 0, hireCost: 15, farmers: [], 
    dust: 0, autoDust: 0, siphon: 0, grease: 0, 
    voidFocus: 0, harvestChain: 0, orbLvl: 0,
    researchUnlocked: false, dm: 0, dmTier: 0,
    expUnlocked: false, expMult: 1, 
    dustMultClick: 1, dustMultSec: 1, milestoneMod: 1,
    diamonds: 0, rubies: 0, autoCondense: false,
    d_up1: 0, d_up2: 0, r_up1: 0, r_up2: 0,
    dustUpLvl: 0, mileUpLvl: 0,
    ghUnlocked: false, plots: 1, ghCrops: [],
    selectedCrop: 'wheat',
    unlockedCrops: ['wheat'],
    cropInventory: { wheat: 0, corn: 0, soy: 0, potato: 0, pumpkin: 0 },
    goldenCrops: 0, diamondCrops: 0,
    upgrades: {
        wheat: [0, 0, 0], corn: [0, 0, 0], soy: [0, 0, 0], 
        potato: [0, 0, 0], pumpkin: [0, 0, 0]
    },
    lastUpdate: Date.now()
};

// INITIALIZE STATE
let state = JSON.parse(localStorage.getItem('df_v5_save')) || BASE_STATE;

// Migration: Ensure all keys exist (Crucial for adding new features to old saves)
function migrateState() {
    for (let key in BASE_STATE) {
        if (state[key] === undefined) state[key] = BASE_STATE[key];
    }
    // Deep check for nested objects like upgrades
    for (let crop in BASE_STATE.upgrades) {
        if (!state.upgrades[crop]) state.upgrades[crop] = [0,0,0];
    }
}
migrateState();

// Master Tab Logic: Defaults to true so the game starts immediately
let isMaster = true;
window.onfocus = () => { isMaster = true; };

function format(n) {
    if (n === undefined || isNaN(n) || n === null) return "0";
    if (n < 100000) return Math.floor(n).toLocaleString();
    const units = ["", "K", "M", "B", "T", "q", "Q", "s", "S", "O"];
    let unitIndex = Math.floor((Math.log10(n) - 2) / 3);
    unitIndex = Math.max(0, Math.min(unitIndex, units.length - 1));
    let value = n / Math.pow(10, unitIndex * 3);
    return Math.floor(value).toLocaleString() + " " + units[unitIndex];
}

function save() { 
    state.lastUpdate = Date.now();
    localStorage.setItem('df_v5_save', JSON.stringify(state)); 
}

// MAIN HEARTBEAT
setInterval(() => {
    if (!isMaster) return;

    // 1. MULTIPLIERS
    let vBoost = Math.pow(1.15, state.crystals || 0);
    if (state.d_up1 > 0) vBoost *= (1 + (state.d_up1 * 0.05));
    
    let globalRubyBoost = 1 + ((state.r_up2 || 0) * 0.25);
    let milestonePower = (1 + ((state.voidFocus || 0) * 0.12)) * (state.milestoneMod || 1);
    
    let ghEssenceMult = 1;
    // Check wheat upgrade at index 2 (The 3rd upgrade)
    if (state.upgrades.wheat[2] > 0) ghEssenceMult += (state.upgrades.wheat[2] * 0.1);

    let totalGain = 0;

    // 2. FARMERS
    state.farmers.forEach(f => {
        let expBonus = Math.pow(2, f.m_lvl || 0); 
        if (state.r_up1 > 0) expBonus *= (1 + (state.r_up1 * 0.2));

        let y = (f.level * (f.mult * milestonePower * expBonus) * vBoost * globalRubyBoost * ghEssenceMult);
        totalGain += y;

        if (state.expUnlocked) {
            f.exp = (f.exp || 0) + (f.level * 0.01 * (state.expMult || 1));
            let req = 10 * Math.pow(2, f.m_lvl || 0);
            
            if (Math.random() < 0.001) state.diamonds++;
            if (Math.random() < 0.0001) state.rubies++;

            if (f.exp >= req) {
                f.exp = 0;
                f.m_lvl = (f.m_lvl || 0) + 1;
            }
        }
    });

    state.totalGain = totalGain;
    state.essence += (totalGain / 10);
    
    // 3. DUST
    if (state.autoDust > 0) {
        let pDust = (Math.pow(state.autoDust, 2.5) * 0.1) * (state.dustMultSec || 1);
        state.dust += (pDust / 10);
    }

    // 4. AUTO-CONDENSER
    if (state.autoCondense && state.researchUnlocked) {
        if (!window.cTick) window.cTick = 0;
        window.cTick++;
        if (window.cTick >= 30) {
            let condCost = 1e6 * Math.pow(10, state.dmTier || 0);
            if (state.essence >= condCost) {
                state.essence -= condCost;
                state.dm += Math.pow(10, state.dmTier || 0);
            }
            window.cTick = 0;
        }
    }

    // 5. GREENHOUSE
    if (state.ghUnlocked && state.ghCrops) {
        state.ghCrops.forEach(crop => {
            if (crop && crop.status === 'growing') {
                crop.progress += 1;
                if (crop.progress >= crop.time) {
                    crop.status = 'ready';
                    crop.progress = crop.time;
                }
            }
        });
    }

    // 6. UI SYNC
    const el = (id) => document.getElementById(id);
    if (el('ess-display')) el('ess-display').innerText = format(state.essence) + " Essence";
    if (el('eps')) el('eps').innerText = format(totalGain);
    if (el('dust-stat')) el('dust-stat').innerText = format(state.dust);
    if (el('v-mult')) el('v-mult').innerText = vBoost.toFixed(2);

    save();
}, 100);

function hire() {
    if (state.essence >= state.hireCost) {
        state.essence -= state.hireCost;
        state.farmers.push({ level: 1, cost: 10, mult: 1, exp: 0, m_lvl: 0 });
        let count = state.farmers.length;
        state.hireCost *= (count < 10 ? 1.8 : (count < 15 ? 2.5 : 8.0));
        save();
        if (typeof renderGrid === 'function') renderGrid();
    }
}

function upgradeFarmer(i) {
    let f = state.farmers[i];
    let costReduction = 1 - ((state.d_up2 || 0) * 0.01);
    let currentCost = f.cost * costReduction;

    if (state.essence >= currentCost) {
        state.essence -= currentCost;
        f.level++;
        f.cost *= (f.level > 100 ? 1.4 : 1.22);
        if (f.level % 10 === 0) f.mult *= 2.0;
        if (f.level % 25 === 0) f.mult *= 2.5;

        if (state.harvestChain > 0) {
            let vBoost = Math.pow(1.15, state.crystals || 0);
            let milestonePower = (1 + ((state.voidFocus || 0) * 0.12)) * (state.milestoneMod || 1);
            state.essence += (f.level * f.mult * milestonePower * vBoost * 3); 
        }
        save();
    }
}

function buyAllUpgrades() {
    let costReduction = 1 - ((state.d_up2 || 0) * 0.01);
    state.farmers.forEach((f, i) => {
        while (state.essence >= (f.cost * costReduction)) {
            upgradeFarmer(i);
        }
    });
    save();
    if (typeof renderGrid === 'function') renderGrid();
}

window.addEventListener('storage', (e) => {
    if (e.key === 'df_v5_save') state = JSON.parse(e.newValue);
});