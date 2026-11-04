/* The Tower — everything that turns levels, labs, cards, modules, relics and perks into tower stats. */
(() => {
    const G = window.TG, D = G.D, W = window.WIKI;
    const S = () => G.S;

    /* ---------- workshop enhancements (Tier 12 wave 60) ---------- */
    const E = (key, cat, name, need, max, step, stat) => {
        const rows = (W.enh[key] || { rows: [] }).rows.map(r => [r[0], r[2]]);
        return { id: key, cat, name, need, max, step, stat, cost: (L) => Math.round(G.curve(rows, L)) };
    };
    D.ENH = [
        E('Attack_Damage', 'attack', 'Damage', 0, 400, 0.01, 'damage'), E('Attack_Rend_Max', 'attack', 'Rend Armor', 5e10, 400, 0.01, 'rend'),
        E('Attack_Critical_Factor', 'attack', 'Critical Factor', 5e11, 400, 0.01, 'critFactor'), E('Attack_Damage_Per_Meter', 'attack', 'Damage / Meter', 5e12, 400, 0.01, 'dpm'),
        E('Attack_Super_Crit_Mult', 'attack', 'Super Crit Mult', 5e13, 400, 0.01, 'scMult'), E('Attack_Attack_Speed', 'attack', 'Attack Speed', 5e14, 75, 0.01, 'attackSpeed'),
        E('Defense_Health', 'defense', 'Health', 0, 400, 0.01, 'health'), E('Defense_Health_Regen', 'defense', 'Health Regen', 5e10, 400, 0.01, 'regen'),
        E('Defense_Defense_Absolute', 'defense', 'Defense Absolute', 5e11, 400, 0.01, 'defAbs'), E('Defense_Land_Mine_Damage', 'defense', 'Land Mine Damage', 5e12, 400, 0.06, 'lmDamage'),
        E('Defense_Wall_Health', 'defense', 'Wall Health', 5e13, 400, 0.01, 'wallHealth'), E('Defense_Orb_Size', 'defense', 'Orb Size', 5e14, 200, 0.01, 'orbSize'),
        E('Utility_Cash_Bonus', 'utility', 'Cash Bonus', 0, 400, 0.01, 'cash'), E('Utility_Coin_Bonus', 'utility', 'Coin Bonus', 5e10, 200, 0.01, 'coins'),
        E('Utility_Cells_Per_Kill_Bonus', 'utility', 'Cells / Kill Bonus', 5e11, 200, 0.01, 'cells'), E('Utility_Free_Upgrades', 'utility', 'Free Upgrades', 5e12, 100, 0.01, 'free'),
        E('Utility_Packages', 'utility', 'Packages', 5e13, 300, 0.01, 'packages'), E('Utility_Enemy_Level_Skips', 'utility', 'Enemy Level Skips', 5e14, 60, 0.01, 'skips'),
    ];
    const enh = (stat) => { const e = D.ENH.find(x => x.stat === stat); return e ? 1 + (S().enh[e.id] || 0) * e.step : 1; };
    G.enh = enh;

    /* ---------- labs ---------- */
    G.labLv = (id) => S().labs.lv[id] || 0;
    // numeric value of a lab at its current level (0 when not researched)
    G.labV = (id, dflt = 0) => { const L = G.labLv(id), lab = D.LAB_BY[id]; return L && lab ? lab.rows[L - 1].n : dflt; };
    G.labDone = (id) => G.labLv(id) > 0;

    /* ---------- cards ---------- */
    G.cardLevel = (id) => { const n = S().cards.have[id] || 0; let l = 0; for (let i = 1; i <= 7; i++) if (n >= D.CARD_LEVEL_COPIES[i]) l = i; return l; };
    G.cardOn = (id) => S().cards.eq.includes(id) && G.cardLevel(id) > 0;
    G.card = (id, dflt) => G.cardOn(id) ? D.CARD_BY[id].vals[G.cardLevel(id) - 1] : dflt;
    G.mastery = (id, dflt) => {
        const m = S().cards.mastery[id];
        if (m === undefined || !G.cardOn(id)) return dflt;
        return D.MASTERY[id].vals[Math.min(9, m)];
    };

    /* ---------- relics & vault ---------- */
    let relicCache = null, relicKey = '';
    G.relic = (stat) => {
        const k = Object.keys(S().relics).length;
        if (k !== relicKey) { relicKey = k; relicCache = {}; for (const id in S().relics) { const r = D.RELIC_BY[id]; if (r && r.stat) relicCache[r.stat] = (relicCache[r.stat] || 0) + r.val; } }
        return relicCache[stat] || 0;
    };
    G.vaultLv = (id) => S().vault[id] || 0;
    G.vaultStat = (stat) => {
        let v = 0;
        for (const sec of D.VAULT) for (const it of sec.items) if (it.stat === stat) v += (S().vault[it.id] || 0) * it.step;
        return v;
    };

    /* ---------- modules ---------- */
    G.modById = (uid) => S().modules.inv.find(m => m.uid === uid);
    G.modRarity = (m) => D.RAR.find(r => r.id === m.rarity);
    G.modMaxLv = (m) => m.rarity === 'ancestral' ? D.STAR_MAX[m.stars || 0] : G.modRarity(m).max;
    G.modMaxSubs = (m) => m.rarity === 'ancestral' ? D.STAR_SUBS[m.stars || 0] : G.modRarity(m).subs;
    G.equipped = (type) => { const sl = S().modules.slot[type]; return sl && sl.eq ? G.modById(sl.eq) : null; };
    G.modLevel = (type) => { const m = G.equipped(type); return m ? Math.min(S().modules.slot[type].lv, G.modMaxLv(m)) : 0; };
    // how many sub-effects are active: base count, plus one for each slot-level threshold passed, up to the rarity's maximum
    G.modActiveSubs = (m, lv) => {
        const base = m.rarity === 'common' ? 1 : 2;
        return Math.min(G.modMaxSubs(m), base + D.SUB_UNLOCK_LV.filter(x => lv >= x).length, m.subs.length);
    };
    G.modMain = (type) => { const m = G.equipped(type); return m ? D.mainEffect(G.modLevel(type), m.rarity, m.stars) : 0; };
    G.sub = (type, key) => {
        const m = G.equipped(type);
        if (!m) return 0;
        const n = G.modActiveSubs(m, G.modLevel(type));
        let v = 0;
        for (let i = 0; i < n; i++) {
            const s = m.subs[i];
            if (s && s.k === key) { const def = D.SUBS[type].find(d => d[0] === key); if (def) v += def[2][s.r] || 0; }
        }
        return v;
    };
    G.unique = (name) => {
        for (const [type] of D.MOD_TYPES) {
            const m = G.equipped(type);
            if (m && m.natural && m.name === name) { const u = D.UNIQUES.find(x => x.name === name); return u.vals[D.UNIQUE_STEP[m.rarity] || 0]; }
        }
        return 0;
    };

    /* ---------- workshop levels ---------- */
    G.unlocked = (u) => !!S().wsUnl[u.grp] || D.GROUPS[u.grp].cost === 0;
    G.wsLv = (id) => S().ws[id] || 0;
    // value of an upgrade at total level L, with its lab applied to the increments
    G.upgVal = (u, L) => {
        const raw = u.val(L);
        const mult = u.lab ? G.labV(u.lab, 1) || 1 : 1;
        return u.base + (raw - u.base) * mult;
    };
    G.totalLv = (id, run) => {
        const u = D.UPG_BY[id];
        if (!G.unlocked(u)) return 0;
        const ws = G.wsLv(id), r = run && run.lv[id] ? run.lv[id] : 0;
        return Math.min(u.max + ((run && run.extra && run.extra[id]) || 0), ws + r);
    };
    const V = (id, run) => { const u = D.UPG_BY[id]; return G.unlocked(u) ? G.upgVal(u, G.totalLv(id, run)) : (u.id === 'range' ? 30 : u.base); };

    /* ---------- perks ---------- */
    const SPB = () => G.labV('Standard_Perk_Bonus');
    G.perkQ = (run, id) => (run && run.perks[id]) || 0;
    G.perkMult = (run, id) => { const p = D.PERKS.find(x => x.id === id), q = G.perkQ(run, id); return q ? (1 + p.v * q) * (1 + SPB()) : 1; };
    G.perkAdd = (run, id) => { const p = D.PERKS.find(x => x.id === id), q = G.perkQ(run, id); return q ? p.v * q * (1 + SPB()) : 0; };
    G.trade = (run, id) => { const t = D.TRADE_PERKS.find(x => x.id === id); if (!run || !run.perks[id]) return 0; const b = G.labV('Improve_Trade-Off_Perks'); return t.fixed ? 1 : t.half ? t.v * (1 + b / 2) : t.v * (1 + b); };

    /* =====================================================================
       THE TOWER'S STATS
       `run` is the active battle (or null for the numbers shown in menus).
       ===================================================================== */
    G.stats = (run) => {
        const s = {}, R = (st) => 1 + G.relic(st), VS = (st) => G.vaultStat(st);
        const sub = G.sub;
        // ---- attack ----
        s.damage = V('damage', run) * G.card('damage', 1) * R('damage') * (1 + G.modMain('cannon')) * enh('damage') * G.perkMult(run, 'damage')
            * (1 + VS('damage')) * G.mastery('damage', 1);
        if (run && G.trade(run, 't_dmg')) s.damage *= G.trade(run, 't_dmg');
        if (run && run.perks.t_edmg) s.damage *= 0.5;
        s.attackSpeed = (V('attackSpeed', run) * G.card('attackSpeed', 1) + sub('cannon', 'attackSpeed')) * enh('attackSpeed') * R('attackSpeed') * (1 + VS('attackSpeed')) * G.mastery('attackSpeed', 1);
        s.critChance = V('critChance', run) + G.card('critChance', 0) + sub('cannon', 'critChance') / 100 + G.relic('critChance') + VS('critChance') + G.mastery('critChance', 0);
        s.critFactor = (V('critFactor', run) + sub('cannon', 'critFactor')) * enh('critFactor') * R('critFactor') * (1 + VS('critFactor'));
        s.range = V('range', run) * G.card('range', 1) + sub('cannon', 'range');
        s.dpm = (V('dpm', run) + sub('cannon', 'dpm')) * enh('dpm') * R('dpm') * (1 + VS('dpm')) * G.mastery('range', 1);
        s.msChance = Math.min(1, (V('msChance', run) + sub('cannon', 'msChance') / 100) * (1 + VS('msChance')));
        s.msTargets = V('msTargets', run) + sub('cannon', 'msTargets');
        s.rfChance = Math.min(1, (V('rfChance', run) + sub('cannon', 'rfChance') / 100) * (1 + VS('rfChance')));
        s.rfDuration = V('rfDuration', run) + sub('cannon', 'rfDuration');
        s.bsChance = Math.min(1, (V('bsChance', run) + sub('cannon', 'bsChance') / 100) * (1 + VS('bsChance')));
        s.bsTargets = V('bsTargets', run) + sub('cannon', 'bsTargets') + (run ? G.perkQ(run, 'bounce') * 2 : 0);
        s.bsRange = V('bsRange', run) + sub('cannon', 'bsRange') + (G.unique('Astral Deliverance') ? s.range * 0.03 : 0);
        s.scChance = V('scChance', run) + G.labV('Super_Crit_Chance') / 100 + sub('cannon', 'scChance') / 100 + G.relic('scChance') + VS('scChance') + G.mastery('critChance', 0) + G.unique('Being Annihilator') / 100;
        s.scMult = (V('scMult', run) + sub('cannon', 'scMult')) * enh('scMult') * R('scMult') * (1 + VS('scMult')) * (1 + G.mastery('critChance', 0));
        s.rendChance = (V('rendChance', run) + sub('cannon', 'rendChance') / 100) * enh('rend');
        s.rendMult = (V('rendMult', run) + sub('cannon', 'rendMult')) * enh('rend') * R('rendMult');
        s.rendMax = ((G.labV('Rend_Armor_Max') || 8) + sub('cannon', 'rendMax')) * enh('rend');
        // ---- defense ----
        s.health = V('health', run) * G.card('health', 1) * R('health') * (1 + G.modMain('armor')) * enh('health') * G.perkMult(run, 'health') * (1 + VS('health')) * G.mastery('health', 1);
        if (run && run.perks.t_coin) s.health *= 0.3;
        if (run && run.perks.t_regen) s.health *= 0.4;
        if (run && run.dwHealth) s.health *= 1 + run.dwHealth;
        s.regen = V('regen', run) * G.card('regen', 1) * (1 + sub('armor', 'regenPct') / 100) * enh('regen') * G.perkMult(run, 'regen') * R('regen') * (1 + VS('regen')) * G.mastery('regen', 1);
        if (run && G.trade(run, 't_regen')) s.regen *= G.trade(run, 't_regen');
        if (run && run.perks.t_ehp) s.regen *= 0.1;
        s.defPct = Math.min(0.98, V('defPct', run) + G.labV('Defense_Percent') / 100 + G.card('extraDefense', 0) + sub('armor', 'defPct') / 100 + G.perkAdd(run, 'defPct') + G.relic('defPct') + G.mastery('extraDefense', 0));
        s.defAbs = V('defAbs', run) * G.card('fortress', 1) * (1 + sub('armor', 'defAbsPct') / 100) * enh('defAbs') * G.perkMult(run, 'defAbs') * R('defAbs') * (1 + VS('defAbs'));
        s.thorns = (V('thorns', run) + sub('armor', 'thorns') / 100) * R('thorns') * (1 + VS('thorns'));
        s.lifesteal = V('lifesteal', run) + sub('armor', 'lifesteal') / 100;
        if (run && G.trade(run, 't_ls')) s.lifesteal *= G.trade(run, 't_ls');
        if (run && run.perks.t_ehp) s.lifesteal *= 0.1;
        s.kbChance = V('kbChance', run) + sub('armor', 'kbChance') / 100;
        s.kbForce = (V('kbForce', run) + sub('armor', 'kbForce')) * R('kbForce') * (1 + VS('kbForce'));
        if (run && run.perks.t_ls) s.kbForce *= 0.3;
        s.orbSpeed = (V('orbSpeed', run) + G.labV('Orb_Speed') + sub('armor', 'orbSpeed')) * R('orbSpeed') * (1 + VS('orbSpeed'));
        s.orbs = V('orbs', run) + sub('armor', 'orbs') + (run ? G.perkQ(run, 'orbs') : 0);
        s.orbSize = enh('orbSize');
        s.swSize = V('swSize', run) + G.labV('Shockwave_Size') + sub('armor', 'swSize');
        s.swFreq = Math.max(7, V('swFreq', run) + sub('armor', 'swFreq'));
        s.lmChance = V('lmChance', run) + sub('armor', 'lmChance') / 100;
        s.lmDamage = (V('lmDamage', run) + G.labV('Land_Mine_Damage') + sub('armor', 'lmDamage') / 100) * enh('lmDamage') * G.perkMult(run, 'landMine') * (1 + G.card('areaOfEffect', 0));
        s.lmRadius = V('lmRadius', run) + sub('armor', 'lmRadius');
        s.lmDecay = 5 + G.labV('Land_Mine_Decay');
        s.deathDefy = V('deathDefy', run) + sub('armor', 'deathDefy') / 100 + VS('deathDefy');
        s.wallHealth = (V('wallHealth', run) + G.labV('Wall_Health') + sub('armor', 'wallHealth') / 100) * enh('wallHealth') * (1 + VS('wallHealth')) * (G.unique('Sharp Fortitude') || 1);
        s.wallRebuild = Math.max(150, V('wallRebuild', run) + G.labV('Wall_Rebuild') + sub('armor', 'wallRebuild') + G.relic('wallRebuild') * -1 + (G.mastery('fortress', 0) || 0));
        s.wallOn = G.unlocked(D.UPG_BY.wallHealth);
        // ---- utility ----
        s.cashBonus = (V('cashBonus', run) + sub('generator', 'cashBonus')) * G.card('cash', 1) * G.perkMult(run, 'cash') * R('cash') * enh('cash') * (1 + VS('cashBonus'));
        s.cashWave = (V('cashWave', run) + sub('generator', 'cashWave')) * (1 + VS('cashWave')) * enh('cash');
        if (run && G.trade(run, 't_cashwave')) s.cashWave *= G.trade(run, 't_cashwave');
        s.coinKill = (V('coinKill', run) + sub('generator', 'coinKill')) * (1 + VS('coinKill'));
        s.coinWave = (V('coinWave', run) + sub('generator', 'coinWave')) * (1 + VS('coinWave'));
        const free = G.card('freeUpgrades', 0) + G.perkAdd(run, 'free');
        s.freeAtk = (V('freeAtk', run) + sub('generator', 'freeAtk') / 100 + free + G.relic('freeAtk')) * enh('free') * (1 + VS('freeAtk'));
        s.freeDef = (V('freeDef', run) + sub('generator', 'freeDef') / 100 + free + G.relic('freeDef')) * enh('free') * (1 + VS('freeDef'));
        s.freeUtil = (V('freeUtil', run) + sub('generator', 'freeUtil') / 100 + free + G.relic('freeUtil')) * enh('free') * (1 + VS('freeUtil'));
        s.interest = (V('interest', run) + sub('generator', 'interest') / 100) * G.perkMult(run, 'interest') * (1 + VS('interest')) * enh('cash');
        s.maxInterest = (G.labV('Max_Interest') || 50) * enh('cash');
        s.pkgAmount = (V('pkgAmount', run) + G.labV('Recovery_Package_Amount') + sub('generator', 'pkgAmount') / 100) * enh('packages') * R('pkgAmount') * (1 + VS('pkgAmount'));
        s.pkgMax = (V('pkgMax', run) + G.labV('Recovery_Package_Max') + sub('generator', 'pkgMax')) * enh('packages');
        s.pkgChance = Math.min(1, V('pkgChance', run) + G.labV('Recovery_Package_Chance') + G.card('recoveryPackage', 0) + sub('generator', 'pkgChance') / 100);
        s.skipAtk = Math.min(0.9, (V('skipAtk', run) + G.labV('Enemy_Attack_Level_Skip') / 100 + sub('generator', 'skipAtk') / 100 + G.relic('skipAtk')) * enh('skips'));
        s.skipHp = Math.min(0.9, (V('skipHp', run) + G.labV('Enemy_Health_Level_Skip') / 100 + sub('generator', 'skipHp') / 100 + G.relic('skipHp')) * enh('skips'));
        // ---- coins (everything except Coins/Kill) ----
        const tier = run ? run.tier : S().tier;
        s.tierCoin = run && run.tour ? D.tierCoin(D.LEAGUES[run.league].tier) : D.tierCoin(tier);
        s.coinMult = s.tierCoin * G.card('coins', 1) * G.perkMult(run, 'coins') * R('coins') * G.themeBonus() * (1 + G.modMain('generator')) * enh('coins') * G.mastery('coins', 1) * G.dissonanceCoin();
        if (run && G.trade(run, 't_coin')) s.coinMult *= G.trade(run, 't_coin');
        if (G.S.free.coinBoost > 0) s.coinMult *= 1.5;
        // ---- ultimate weapons ----
        s.uwDamage = (1 + G.modMain('core')) * R('uwDamage') * (1 + VS('uwDamage'));
        s.uwCritChance = G.card('ultimateCrit', 0) + G.mastery('ultimateCrit', 0);
        // ---- misc ----
        s.startCash = D.START_CASH + G.labV('Starting_Cash');
        s.maxSpeed = Math.max(1, G.labV('Game_Speed', 1) || 1) + (run ? G.perkAdd(run, 'gameSpeed') : 0);
        s.slow = G.card('slowAura', 0);
        if (!(run && run.tour)) {
            s.damage *= G.diss('attack', tier);
            s.health *= G.diss('defense', tier);
            s.uwDamage *= G.diss('uw', tier);
        }
        // Dissonant runs lock one category for a permanent boost
        if (run && run.diss === 'attack') { s.damage = 1; s.range = 30; s.attackSpeed = 1; }
        if (run && run.diss === 'defense') { s.health = 1; s.regen = 1; s.defPct = s.defAbs = s.thorns = s.lifesteal = s.kbChance = s.orbs = s.lmChance = s.deathDefy = 0; s.wallOn = false; }
        if (run && run.diss === 'utility') { s.cashBonus = 0; s.cashWave = 0; s.interest = 0; s.coinMult = 0; s.pkgChance = 0; s.freeAtk = s.freeDef = s.freeUtil = 0; s.skipAtk = s.skipHp = 0; }
        // UW damage uses the average crit (game formula)
        s.avgCrit = (1 + s.critFactor * Math.min(1, s.critChance)) * (1 + s.scMult * s.scChance * Math.min(1, s.critChance));
        return s;
    };

    G.themeBonus = () => 1 + 0.004 * Object.keys(S().skins.owned).length + 0.006 * Object.keys(S().songs).length + (S().guardian ? 0.006 * Object.keys(S().guardian.skins || {}).length : 0);

    /* ---------- dissonance: best restricted run per tier gives a boost on that tier, and a little echoes to all tiers ---------- */
    G.dissBoostFor = (cat, wave) => { const max = cat === 'utility' ? 3 : 5; return 1 + (max - 1) * Math.pow(Math.min(1, wave / 5000), 1.75); };
    G.diss = (cat, tier) => {
        const d = S().dissonance;
        const own = d[tier + ':' + cat] ? G.dissBoostFor(cat, d[tier + ':' + cat]) : 1;
        const echo = (G.labV('Echo') || 0.005);
        let other = 0;
        if (G.S.maxTier >= 17 || G.labDone('Echo')) for (const k in d) { const [t, c] = k.split(':'); if (c === cat && +t !== tier) other += (G.dissBoostFor(cat, d[k]) - 1) * echo; }
        return own + other;
    };
    G.dissonanceCoin = () => G.diss('utility', G.run() && !G.run().tour ? G.run().tier : S().tier);

    /* ---------- ultimate weapon stat with every bonus ---------- */
    G.uwLv = (id) => S().uw.own[id];
    // returns the value of stat i (0..2) for UW `id`, including labs, module subs and perks
    G.uwStat = (id, i, run) => {
        const u = D.UW_BY[id], own = S().uw.own[id] || (run && run.tempUW && run.tempUW[id]);
        if (!own) return 0;
        let v;
        if (Array.isArray(own)) v = u.t[i][Math.min(own[i], u.t[i].length - 1)].v;
        else v = own.vals[i];
        const sub = (k) => G.sub('core', k), q = (pid) => (run && run.perks[pid]) || 0;
        switch (id + i) {
            case 'cl0': v = (v + sub('cl_dmg')) * (q('uw_cl') ? 2 : 1); break;
            case 'cl1': v += sub('cl_qty'); break;
            case 'cl2': v = (v + sub('cl_chance')) / 100; break;
            case 'sm0': v += sub('sm_dmg'); break;
            case 'sm1': v += sub('sm_qty') + (q('uw_sm') ? 4 : 0); break;
            case 'sm2': v += sub('sm_cd'); break;
            case 'dw0': v += sub('dw_dmg'); break;
            case 'dw1': v += sub('dw_qty') + (q('uw_dw') ? 1 : 0); break;
            case 'dw2': v += sub('dw_cd'); break;
            case 'cf0': v += G.labV('Chrono_Field_Duration') + sub('cf_dur') + (q('uw_cf') ? 5 : 0); break;
            case 'cf1': v = Math.min(0.9, (v + sub('cf_slow')) / 100); break;
            case 'cf2': v += sub('cf_cd'); break;
            case 'ilm0': v += sub('ilm_dmg'); break;
            case 'ilm1': v = (v + sub('ilm_qty')) * (q('uw_ilm') ? 2 : 1); break;
            case 'ilm2': v = Math.max(37, v + sub('ilm_cd')); break;
            case 'gt0': v = (v + G.labV('Golden_Tower_Bonus') + sub('gt_bonus')) * (q('uw_gt') ? 1.5 : 1) * (1 + G.vaultStat('gtBonus')); break;
            case 'gt1': v += G.labV('Golden_Tower_Duration') + sub('gt_dur'); break;
            case 'gt2': v += sub('gt_cd'); break;
            case 'ps0': v += sub('ps_dmg'); break;
            case 'ps1': v += sub('ps_dur'); break;
            case 'ps2': v += sub('ps_cd'); break;
            case 'bh0': v = (v + sub('bh_size')) * (1 + G.vaultStat('bhSize')); break;
            case 'bh1': v += sub('bh_dur') + (q('uw_bh') ? 12 : 0); break;
            case 'bh2': v += sub('bh_cd'); break;
            case 'sl0': v = (v + sub('sl_bonus')) * (q('uw_sl') ? 1.5 : 1); break;
            case 'sl1': v += sub('sl_angle'); break;
        }
        return v;
    };
})();
