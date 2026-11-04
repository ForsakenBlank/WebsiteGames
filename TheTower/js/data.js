/* The Tower — game definitions. Numbers come from js/wiki-data.js (copied from the wiki) wherever the wiki has them. */
(() => {
    const G = window.TG, W = window.WIKI;
    const D = G.D = {};

    /* =====================================================================
       WORKSHOP UPGRADES
       Every upgrade has one level count shared by the Workshop (coins, permanent)
       and the battle (cash, this run only); together they can't pass `max`.
       val(L) is the value at total level L before labs. A lab that "increases the
       increments" multiplies the part above the base value.
       ===================================================================== */
    const lin = (base, step) => (L) => base + step * L;
    // Wiki tables list a value every 100 levels; fit a quadratic through level 0, 1 and the first sample, then follow the table.
    function sampled(key, base, v1) {
        const rows = W.costs[key];
        const first = rows.find(r => r[0] > 1) || rows[rows.length - 1];
        const a1 = (v1 !== undefined ? v1 : rows[0][1]) - base, aN = first[1] - base, n = first[0];
        const c = (aN - a1 * n) / (n * n - n), b = a1 - c;
        const pts = rows.filter(r => r[0] >= n).map(r => [r[0], r[1]]);
        return (L) => L <= n ? base + b * L + c * L * L : G.curve(pts, L);
    }
    const tableVal = (key, base) => { const pts = [[0, base], ...W.costs[key].map(r => [r[0], r[1]])]; return (L) => G.curve(pts, L); };

    // [id, category, name, max, unlock group, value fn, how to show, lab that scales it, wiki cost table, short info]
    const U = [
        // ---------- attack ----------
        ['damage', 'attack', 'Damage', 6000, 'a0', sampled('damage', 3), 'num', 'Damage', 'damage', 'Damage of each shot. Also the base for ultimate weapons, mines and bots.'],
        ['attackSpeed', 'attack', 'Attack Speed', 99, 'a0', lin(1, 0.05), 'x2', 'Attack_Speed', 'attackSpeed', 'Shots fired per second.'],
        ['critChance', 'attack', 'Critical Chance', 79, 'a0', lin(0.01, 0.01), 'pct', null, 'critChance', 'Chance for a shot to crit.'],
        ['critFactor', 'attack', 'Critical Factor', 150, 'a0', lin(1.2, 0.1), 'x', 'Critical_Factor', 'critFactor', 'Damage multiplier on critical hits.'],
        ['range', 'attack', 'Range', 79, 'a1', lin(30, 0.5), 'm', 'Range', 'range', 'How far the tower can shoot.'],
        ['dpm', 'attack', 'Damage / Meter', 200, 'a1', tableVal('dpm', 0), 'pct2', 'Damage_Per_Meter', 'dpm', 'Extra damage for every meter between the tower and the target.'],
        ['msChance', 'attack', 'Multishot Chance', 99, 'a2', lin(0, 0.005), 'pct', null, 'msChance', 'Chance to fire at several enemies at once.'],
        ['msTargets', 'attack', 'Multishot Targets', 7, 'a2', lin(2, 1), 'int', null, 'msTargets', 'Shots fired when multishot triggers.'],
        ['rfChance', 'attack', 'Rapid Fire Chance', 85, 'a3', lin(0, 0.004), 'pct', null, 'rfChance', 'Chance to fire 4× faster for a while.'],
        ['rfDuration', 'attack', 'Rapid Fire Duration', 99, 'a3', lin(0.6, 0.05), 's', null, 'rfDuration', 'How long rapid fire lasts.'],
        ['bsChance', 'attack', 'Bounce Shot Chance', 85, 'a4', lin(0, 0.008), 'pct', null, 'bsChance', 'Chance for a shot to bounce to another enemy.'],
        ['bsTargets', 'attack', 'Bounce Shot Targets', 7, 'a4', lin(1, 1), 'int', null, 'bsTargets', 'How many times a shot can bounce.'],
        ['bsRange', 'attack', 'Bounce Shot Range', 60, 'a4', lin(2, 0.1), 'm', null, 'bsRange', 'How far a bounce can jump.'],
        ['scChance', 'attack', 'Super Crit Chance', 100, 'a5', lin(0, 0.002), 'pct', null, 'scChance', 'Chance for a crit to become a super crit.'],
        ['scMult', 'attack', 'Super Crit Mult', 120, 'a5', lin(1.2, 0.1), 'x', 'Super_Crit_Mult', 'scMult', 'Super crits deal Critical Factor × this.'],
        ['rendChance', 'attack', 'Rend Armor Chance', 299, 'a6', lin(0.001, 0.001), 'pct', null, 'rendChance', 'Chance on hit to make the enemy take more projectile damage.'],
        ['rendMult', 'attack', 'Rend Armor Mult', 299, 'a6', lin(0.001, 0.001), 'x4', null, 'rendMult', 'Damage added to the enemy each time rend applies (stacks to the rend max).'],
        // ---------- defense ----------
        ['health', 'defense', 'Health', 6000, 'd0', sampled('health', 5), 'num', 'Health', 'health', 'Maximum tower health.'],
        ['regen', 'defense', 'Health Regen', 6000, 'd0', sampled('regen', 0, 0.04), 'regen', 'Health_Regen', 'regen', 'Health restored every second.'],
        ['defPct', 'defense', 'Defense %', 99, 'd1', lin(0, 0.005), 'pct', null, 'defPct', 'Share of every hit that is ignored (applied first).'],
        ['defAbs', 'defense', 'Defense Absolute', 5000, 'd1', sampled('defAbs', 0), 'num', 'Defense_Absolute', 'defAbs', 'Flat damage removed from every hit (after Defense %).'],
        ['thorns', 'defense', 'Thorn Damage', 99, 'd2', lin(0, 0.01), 'pct', null, 'thorns', 'Enemies that hit the tower take this share of their max health (half for bosses).'],
        ['lifesteal', 'defense', 'Lifesteal', 80, 'd3', (L) => tableVal('lifesteal', 0)(L) / 100, 'pct2', null, 'lifesteal', 'Heals this share of the damage your shots deal.'],
        ['kbChance', 'defense', 'Knockback Chance', 80, 'd4', lin(0, 0.01), 'pct', null, 'kbChance', 'Chance for a shot to push the enemy back.'],
        ['kbForce', 'defense', 'Knockback Force', 40, 'd4', tableVal('kbForce', 0.4), 'dec', null, 'kbForce', 'How hard knockback pushes (heavier enemies move less).'],
        ['orbSpeed', 'defense', 'Orb Speed', 38, 'd5', lin(0.4, 0.15), 'dec', null, 'orbSpeed', 'Rotations per minute of the orbs.'],
        ['orbs', 'defense', 'Orbs', 4, 'd5', lin(0, 1), 'int', null, 'orbs', 'Orbs circle the tower and destroy normal enemies they touch.'],
        ['swSize', 'defense', 'Shockwave Size', 35, 'd6', lin(0.6, 0.05), 'dec', null, 'swSize', 'Size of the shockwave that pushes enemies away.'],
        ['swFreq', 'defense', 'Shockwave Frequency', 40, 'd6', lin(20, -0.15), 's', null, 'swFreq', 'Seconds between shockwaves.'],
        ['lmChance', 'defense', 'Land Mine Chance', 50, 'd7', lin(0, 0.006), 'pct', null, 'lmChance', 'Chance for a kill to leave a land mine behind.'],
        ['lmDamage', 'defense', 'Land Mine Damage', 200, 'd7', lin(1, 0.1), 'pct0', null, 'lmDamage', 'Mine damage as a share of tower damage (crits averaged in).'],
        ['lmRadius', 'defense', 'Land Mine Radius', 50, 'd7', lin(0.5, 0.02), 'dec', null, 'lmRadius', 'Explosion size of land mines.'],
        ['deathDefy', 'defense', 'Death Defy', 75, 'd8', lin(0, 0.004), 'pct', null, 'deathDefy', 'Chance to ignore a hit that would destroy the tower.'],
        ['wallHealth', 'defense', 'Wall Health', 1800, 'd9', lin(0.2, 0.001), 'pct', null, 'wallHealth', 'Wall health as a share of tower health.'],
        ['wallRebuild', 'defense', 'Wall Rebuild', 300, 'd9', lin(1200, -2), 's', null, 'wallRebuild', 'Seconds for a broken wall to rebuild.'],
        // ---------- utility ----------
        ['cashBonus', 'utility', 'Cash Bonus', 149, 'u0', lin(1, 0.01), 'x', 'Cash_Bonus', 'cashBonus', 'Multiplies all cash earned.'],
        ['cashWave', 'utility', 'Cash / Wave', 149, 'u0', lin(0, 4), 'cash', 'Cash_Per_Wave', 'cashWave', 'Cash paid at the end of every wave.'],
        ['coinKill', 'utility', 'Coins / Kill Bonus', 149, 'u1', lin(1, 0.01), 'x', 'Coins_Per_Kill_Bonus', 'coinKill', 'Multiplies coins from kills.'],
        ['coinWave', 'utility', 'Coins / Wave', 149, 'u1', lin(1, 1), 'num', 'Coins_Per_Wave', 'coinWave', 'Coins paid at the start of every wave.'],
        ['freeAtk', 'utility', 'Free Attack Upgrade', 99, 'u2', lin(0, 0.005), 'pct', null, 'freeAtk', 'Chance each wave for a free attack upgrade.'],
        ['freeDef', 'utility', 'Free Defense Upgrade', 99, 'u2', lin(0, 0.005), 'pct', null, 'freeDef', 'Chance each wave for a free defense upgrade.'],
        ['freeUtil', 'utility', 'Free Utility Upgrade', 99, 'u2', lin(0, 0.005), 'pct', null, 'freeUtil', 'Chance each wave for a free utility upgrade.'],
        ['interest', 'utility', 'Interest / Wave', 99, 'u3', lin(0, 0.0006), 'pct2', 'Interest', 'interest', 'Cash kept at the end of a wave earns this much interest (capped).'],
        ['pkgAmount', 'utility', 'Recovery Amount', 300, 'u4', lin(0.14, 0.004), 'pct', null, 'pkgAmount', 'Health each recovery package restores.'],
        ['pkgMax', 'utility', 'Max Recovery', 500, 'u4', lin(1, 0.031), 'x', null, 'pkgMax', 'Packages can heal up to this much of max health.'],
        ['pkgChance', 'utility', 'Package Chance', 60, 'u4', lin(0.06, 0.004), 'pct', null, 'pkgChance', 'Chance for a recovery package each wave.'],
        ['skipAtk', 'utility', 'Enemy Attack Level Skip', 699, 'u5', lin(0.0005, 0.0005), 'pct2', null, 'skipAtk', 'Share of waves where enemy damage does not grow.'],
        ['skipHp', 'utility', 'Enemy Health Level Skip', 699, 'u5', lin(0.0005, 0.0005), 'pct2', null, 'skipHp', 'Share of waves where enemy health does not grow.'],
    ];
    D.UPG = U.map(([id, cat, name, max, grp, val, show, lab, cost, info]) => {
        const rows = W.costs[cost];
        const pts = rows.map(r => [r[0], r[2]]);
        return { id, cat, name, max, grp, val, show, lab, info, base: val(0), cost: (L) => Math.round(G.curve(pts, L)) };
    });
    D.UPG_BY = Object.fromEntries(D.UPG.map(u => [u.id, u]));
    // Workshop sections are bought in order, each unlocks the next. [coins, upgrades]
    D.GROUPS = {
        a0: { cat: 'attack', cost: 0, name: 'Basics' }, a1: { cat: 'attack', cost: 50, name: 'Range' }, a2: { cat: 'attack', cost: 400, name: 'Multishot' },
        a3: { cat: 'attack', cost: 1500, name: 'Rapid Fire' }, a4: { cat: 'attack', cost: 10000, name: 'Bounce Shot' }, a5: { cat: 'attack', cost: 1e8, name: 'Super Critical' },
        a6: { cat: 'attack', cost: 5e11, name: 'Rend Armor' },
        d0: { cat: 'defense', cost: 0, name: 'Basics' }, d1: { cat: 'defense', cost: 75, name: 'Defense' }, d2: { cat: 'defense', cost: 500, name: 'Thorns' },
        d3: { cat: 'defense', cost: 2000, name: 'Lifesteal' }, d4: { cat: 'defense', cost: 5000, name: 'Knockback' }, d5: { cat: 'defense', cost: 15000, name: 'Orbs' },
        d6: { cat: 'defense', cost: 1e5, name: 'Shockwave' }, d7: { cat: 'defense', cost: 4e5, name: 'Land Mines' }, d8: { cat: 'defense', cost: 1.5e6, name: 'Death Defy' },
        d9: { cat: 'defense', cost: 5e8, name: 'Wall' },
        u0: { cat: 'utility', cost: 40, name: 'Cash' }, u1: { cat: 'utility', cost: 100, name: 'Coins' }, u2: { cat: 'utility', cost: 800, name: 'Free Upgrades' },
        u3: { cat: 'utility', cost: 5000, name: 'Interest' }, u4: { cat: 'utility', cost: 1.5e6, name: 'Recovery Packages' }, u5: { cat: 'utility', cost: 1e9, name: 'Enemy Level Skip' },
    };
    D.GROUP_ORDER = { attack: ['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6'], defense: ['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9'], utility: ['u0', 'u1', 'u2', 'u3', 'u4', 'u5'] };
    D.CATS = ['attack', 'defense', 'utility'];
    // Battle (cash) prices. The wiki has no table for these, so they are derived from the Workshop coin price at the
    // upgrade's total level: the cheaper of 4% and 0.5 × coins^0.6 (first levels $1-2, level 50 about $200, level 1000 about $13K).
    D.cashCost = (coins) => Math.max(1, Math.round(Math.min(0.04 * coins, 0.5 * Math.pow(coins, 0.6))));
    // what the auto-buyer prefers (lower = bought sooner at the same price)
    D.AUTO_WEIGHT = { damage: 1, attackSpeed: 1.1, health: 1, regen: 1.3, defAbs: 1.3, defPct: 1.4, critFactor: 1.6, critChance: 1.6, cashWave: 0.9, cashBonus: 1.2, interest: 1.2, range: 2.5, coinKill: 1.5, coinWave: 1.5 };
    D.START_CASH = 80;

    /* =====================================================================
       LABS
       ===================================================================== */
    const LAB_META = {
        // main
        Game_Speed: ['main', 'T1W30'], Starting_Cash: ['main', 'T1W30'], Labs_Coin_Discount: ['main', 'T1W30'], Lab_Speed: ['main', 'T1W150'],
        Workshop_Attack_Discount: ['main', 'T2W40'], Workshop_Defense_Discount: ['main', 'T2W50'], Workshop_Utility_Discount: ['main', 'T2W60'],
        Buy_Multiplier: ['main', 'T2W20'], More_Round_Stats: ['main', 'T1W250'], Target_Priority: ['main', 'T4W150'], Presets: ['main', 'T1W400', 'Presets'],
        Workshop_Respec: ['main', 'T4W30'], Reroll_Daily_Missions: ['main', 'T4W30', 'Reroll Daily Mission'], Workshop_Enhancement: ['main', 'T12W60', 'Workshop Enhancements'],
        Enhancement_Coin_Discount: ['main', 'T21W60'], Echo: ['main', 'T17W60', 'Dissonant Echo'],
        // attack
        Damage: ['attack', 'T1W30'], Attack_Speed: ['attack', 'T1W30'], Critical_Factor: ['attack', 'T1W30'], Range: ['attack', 'T2W30'],
        Damage_Per_Meter: ['attack', 'T3W30', 'Damage / Meter'], Super_Crit_Chance: ['attack', 'T5W200'], Super_Crit_Mult: ['attack', 'T5W200'],
        Rend_Armor_Max: ['attack', 'T13W10'], Light_Speed_Shots: ['attack', 'T7W10'],
        // defense
        Health: ['defense', 'T1W30'], Health_Regen: ['defense', 'T1W30'], Defense_Absolute: ['defense', 'T1W30'], Defense_Percent: ['defense', 'T5W30', 'Defense %'],
        Orb_Speed: ['defense', 'T3W80'], Land_Mine_Damage: ['defense', 'T6W30'], Land_Mine_Decay: ['defense', 'T6W30'], Shockwave_Size: ['defense', 'T3W50'],
        Orb_Boss_Hit: ['defense', 'T6W750'], Wall_Health: ['defense', 'T8W10'], Wall_Rebuild: ['defense', 'T8W10'], Wall_Regen: ['defense', 'T10W70'],
        Wall_Thorns: ['defense', 'T10W70'], Wall_Invincibility: ['defense', 'T12W10'], Wall_Fortification: ['defense', 'T14W40'], Garlic_Thorns: ['defense', 'T2W1000'],
        // utility
        Cash_Bonus: ['utility', 'T1W30'], Cash_Per_Wave: ['utility', 'T1W30', 'Cash / Wave'], Coins_Per_Kill_Bonus: ['utility', 'T1W30', 'Coins / Kill Bonus'],
        Coins_Per_Wave: ['utility', 'T1W30', 'Coins / Wave'], Interest: ['utility', 'T2W80'], Max_Interest: ['utility', 'T2W80'],
        Package_After_Boss: ['utility', 'T3W200'], Recovery_Package_Amount: ['utility', 'T6W150'], Recovery_Package_Max: ['utility', 'T6W150'],
        Recovery_Package_Chance: ['utility', 'T6W150'], Enemy_Attack_Level_Skip: ['utility', 'T11W200'], Enemy_Health_Level_Skip: ['utility', 'T11W200'],
        // ultimate weapons
        Missile_Despawn_Time: ['uw', 'T7W30'], Missiles_Explosion: ['uw', 'T7W30'], Missiles_Radius: ['uw', 'lab:Missiles_Explosion'], Missile_Amplifier: ['uw', 'T7W30'],
        Chrono_Field_Duration: ['uw', 'T7W90'], Chrono_Field_Damage_Reduction: ['uw', 'T7W90'], Chrono_Field_Reduction_Percentage: ['uw', 'lab:Chrono_Field_Damage_Reduction', 'Chrono Field Reduction %'],
        Chrono_Field_Range: ['uw', 'T7W90'], Swamp_Radius: ['uw', 'T7W50'], Poison_Swamp_Stun: ['uw', 'T7W50', 'Swamp Stun'], Swamp_Stun_Chance: ['uw', 'lab:Poison_Swamp_Stun'],
        Swamp_Stun_Time: ['uw', 'lab:Poison_Swamp_Stun'], Golden_Tower_Bonus: ['uw', 'T4W200'], Golden_Tower_Duration: ['uw', 'T4W200'],
        Chain_Lightning_Shock: ['uw', 'T7W60'], Shock_Chance: ['uw', 'lab:Chain_Lightning_Shock'], Shock_Multiplier: ['uw', 'lab:Chain_Lightning_Shock'],
        Death_Wave_Health: ['uw', 'T3W250'], Death_Wave_Coins_Bonus: ['uw', 'T3W250'], Death_Wave_Cell_Bonus: ['uw', 'T3W250'], Death_Wave_Damage_Amplifier: ['uw', 'T3W250'],
        Death_Wave_Armor_Stripping: ['uw', 'T3W250'], Inner_Mine_Blast_Radius: ['uw', 'T7W40'], Inner_Mine_Rotation_Speed: ['uw', 'T7W40'], Inner_Mine_Stun: ['uw', 'T7W40'],
        Missile_Barrage: ['uw', 'T8W50'], Missile_Barrage_Quantity: ['uw', 'lab:Missile_Barrage'], Black_Hole_Damage: ['uw', 'T5W150'], Black_Hole_Coin_Bonus: ['uw', 'T5W150'],
        Extra_Black_Hole: ['uw', 'T5W500'], Spotlight_Coin_Bonus: ['uw', 'T7W80'], Spotlight_Missiles: ['uw', 'T3W400'], Black_Hole_Disable_Range_Enemies: ['uw', 'T14W20'],
        Recharge_Missile_Barrage: ['uw', 'T14W60'], 'Swamp_Rend_-_Basic_Enemies': ['uw', 'T16W50'], 'Swamp_Rend_-_Additional_Enemies': ['uw', 'lab:Swamp_Rend_-_Basic_Enemies'],
        Chain_Thunder: ['uw', 'T16W60'], 'Lightning_Amplifier_-_Scatter': ['uw', 'T16W60'], 'Inner_Land_Mine_-_Chrono_Jump': ['uw', 'T16W60'],
        // cards
        Second_Wind_Blast: ['card', 'T3W150'], Double_Death_Ray: ['card', 'T3W300'], Extra_Orb_Adjuster: ['card', 'T6W50'], Extra_Extra_Orbs: ['card', 'T6W80'],
        Energy_Shield: ['card', 'T4W300', 'Energy Shield Extra Hit'], Super_Tower_Bonus: ['card', 'T8W300'], Recharge_Second_Wind: ['card', 'T14W60'],
        Recharge_Demon_Mode: ['card', 'T14W60'], Recharge_Nuke: ['card', 'T14W60'],
        // perks
        Unlock_Perks: ['perk', 'T2W150'], Waves_Required: ['perk', 'lab:Unlock_Perks'], Standard_Perk_Bonus: ['perk', 'lab:Unlock_Perks'], Auto_Perk_Pick: ['perk', 'T4W50', 'Auto Pick Perks'],
        Perk_Option_Quantity: ['perk', 'T4W80'], First_Perk_Choice: ['perk', 'T2W250'], Ban_Perks: ['perk', 'T5W40'], 'Improve_Trade-Off_Perks': ['perk', 'T2W400'],
        Auto_Pick_Ranking: ['perk', 'T6W10'],
        // bots
        Flame_Bot_Cooldown: ['bot', 'T5W60'], Thunder_Bot_Cooldown: ['bot', 'T5W70'], Golden_Bot_Cooldown: ['bot', 'T5W80'], Amplify_Bot_Cooldown: ['bot', 'T5W90'],
        Bot_Bot_Cooldown: ['bot', 'T6W60'], 'Flame_Bot_-_Burn_Stack': ['bot', 'T10W50'], Thunder_Bot_Linger_Time: ['bot', 'T10W50'], Golden_Bot_Duration: ['bot', 'T10W50'],
        Amplify_Bot_Duration: ['bot', 'T10W50'], Bot_Bot_Duration: ['bot', 'T10W50'],
        // modules
        Common_Drop_Chance: ['module', 'T4W70'], Reroll_Shards: ['module', 'T4W70'], Daily_Mission_Shards: ['module', 'T4W70'], Module_Shard_Cost: ['module', 'T10W40'],
        Module_Coin_Cost: ['module', 'T10W40'], Rare_Drop_Chance: ['module', 'T10W40'], Unmerge_Module: ['module', 'T8W20'], Shatter_Shards: ['module', 'T16W40'],
        Cannon_Effect_Bans: ['module', 'T10W40'], Armor_Effect_Bans: ['module', 'T10W40'], Generator_Effect_Bans: ['module', 'T10W40'], Core_Effect_Bans: ['module', 'T10W40'],
        Assist_Module_Main: ['module', 'T19W50', 'Assist Module Bonus'], Assist_Module_Sub: ['module', 'T19W50', 'Assist Module Substats'],
        // enemies
        Common_Enemy_Health: ['enemy', 'T9W10', 'Basic Enemy Health'], Common_Enemy_Attack: ['enemy', 'T9W10', 'Basic Enemy Attack'], Fast_Enemy_Health: ['enemy', 'T9W20'],
        Fast_Enemy_Attack: ['enemy', 'T9W20'], Fast_Enemy_Speed: ['enemy', 'T9W300'], Tank_Enemy_Health: ['enemy', 'T9W30'], Tank_Enemy_Attack: ['enemy', 'T9W30'],
        Ranged_Enemy_Health: ['enemy', 'T9W40'], Ranged_Enemy_Attack: ['enemy', 'T9W40'], Boss_Health: ['enemy', 'T9W50'], Boss_Attack: ['enemy', 'T9W50'],
        Protector_Health: ['enemy', 'T9W60'], Protector_Radius: ['enemy', 'T9W60'], Protector_Damage_Reduction: ['enemy', 'T9W400'], Ranged_Enemy_Range_Lab: ['enemy', 'T13W80', 'Ranged Enemy Range'],
        Vampire_Enemy_Attack: ['enemy', 'T19W60'], Vampire_Enemy_Defense: ['enemy', 'T19W60', 'Vampire Enemy Health'], Ray_Enemy_Attack: ['enemy', 'T19W60'], Ray_Enemy_Health: ['enemy', 'T19W60'],
        Scatter_Enemy_Attack: ['enemy', 'T19W60'], Scatter_Enemy_Health: ['enemy', 'T19W60'],
        // battle conditions
        Battle_Condition_Reduction: ['bc', 'T18W1000'], Battle_Conditions_Group_1: ['bc', 'T19W100'], Battle_Conditions_Group_2: ['bc', 'T20W60'],
        Battle_Conditions_Group_3: ['bc', 'T19W500'], Battle_Conditions_Group_4: ['bc', 'T21W1000'],
    };
    D.LAB_CATS = [['main', 'Main'], ['attack', 'Attack'], ['defense', 'Defense'], ['utility', 'Utility'], ['uw', 'Ultimate Weapons'], ['card', 'Cards'], ['perk', 'Perks'], ['bot', 'Bots'], ['module', 'Modules'], ['enemy', 'Enemies'], ['bc', 'Battle Conditions']];
    const labNum = (s) => {
        if (s === undefined || s === null) return 0;
        s = String(s);
        if (/unlocked/i.test(s)) return 1;
        const m = s.replace(/,/g, '').match(/[-+]?\d*\.?\d+/);
        if (!m) return 0;
        const v = parseFloat(m[0]);
        return /%/.test(s) ? v / 100 : v;
    };
    D.LABS = [];
    for (const key in LAB_META) {
        const w = W.labs[key];
        if (!w) continue;
        const [cat, unlock, label] = LAB_META[key];
        const rows = w.rows.map(([t, c, v]) => ({ t, c, v, n: labNum(v) }));
        D.LABS.push({ id: key, cat, unlock, name: label || key.replace(/_-_/g, ' — ').replace(/_/g, ' '), desc: w.desc, rows, max: rows.length });
    }
    D.LAB_BY = Object.fromEntries(D.LABS.map(l => [l.id, l]));
    // Mastery labs: one per card, same price and time for every card.
    D.MASTERY_LAB = [[20 * 86400 + 20 * 3600, 1.1e15], [31 * 86400 + 6 * 3600, 1.3e15], [41 * 86400 + 16 * 3600, 2e15], [52 * 86400 + 2 * 3600, 3.4e15],
        [62 * 86400 + 12 * 3600, 5.6e15], [72 * 86400 + 22 * 3600, 7.7e15], [83 * 86400 + 8 * 3600, 9.1e15], [93 * 86400 + 18 * 3600, 9.8e15], [104 * 86400 + 4 * 3600, 1e16]];
    D.LAB_SLOT_GEMS = [0, 100, 400, 1400, 3000];
    // Gem rush prices: [seconds, gems] (base prices from the wiki's Lab Upgrades page)
    D.RUSH = [[0, 0], [60, 1], [3600, 8], [86400, 163], [604800, 1000], [2592000, 3550], [7776000, 8000], [31104000, 25000]];
    // Elite cell lab boosts: [speed, cells per hour]
    D.CELL_BOOSTS = [[1.5, 15], [2, 100], [3, 840], [4, 3360], [5, 11900], [6, 60000], [7, 250000], [8, 1000000]];
    // Not in the real game: the lab speed upgrade asked for in this version. [speed multiplier, coin price]
    D.OVERCLOCK = [1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 65, 80, 100, 125, 150].map((m, i) => ({ m, c: i ? Math.round(1000 * Math.pow(3.2, i - 1)) : 0 }));

    /* =====================================================================
       CARDS
       ===================================================================== */
    const C = (id, r, name, ic, vals, f, desc, extra) => Object.assign({ id, r, name, ic, vals, f, desc }, extra || {});
    D.CARDS = [
        C('damage', 'common', 'Damage', '🗡️', [1.5, 2, 2.4, 2.8, 3.2, 3.6, 4], 'x', 'Multiplies tower damage.'),
        C('attackSpeed', 'common', 'Attack Speed', '🔫', [1.25, 1.4, 1.55, 1.7, 1.85, 2, 2.15], 'x', 'Multiplies tower attack speed.'),
        C('health', 'common', 'Health', '❤️', [1.5, 2, 2.4, 2.8, 3.2, 3.6, 4], 'x', 'Multiplies tower max health.'),
        C('regen', 'common', 'Health Regen', '💗', [1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6], 'x', 'Multiplies tower health regen.'),
        C('range', 'common', 'Range', '🔭', [1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45], 'x', 'Multiplies tower range.'),
        C('cash', 'common', 'Cash', '💵', [1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4], 'x', 'Multiplies all cash earned.'),
        C('coins', 'common', 'Coins', '🪙', [1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45], 'x', 'Multiplies all coins earned.'),
        C('slowAura', 'common', 'Slow Aura', '🐌', [0.13, 0.16, 0.19, 0.22, 0.25, 0.28, 0.31], 'pct', 'Enemies inside tower range move slower by this much.'),
        C('critChance', 'common', 'Critical Chance', '🎯', [0.05, 0.06, 0.07, 0.08, 0.09, 0.10, 0.11], 'pct+', 'Adds to critical hit chance.'),
        C('enemyBalance', 'common', 'Enemy Balance', '⚖️', [1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9], 'x', 'Each basic spawn has an 80% chance to bring a second basic enemy. Cash per kill is multiplied by this value.', { locked: true }),
        C('extraDefense', 'common', 'Extra Defense', '🛡️', [0.05, 0.06, 0.07, 0.08, 0.09, 0.10, 0.11], 'pct+', 'Adds to Defense %.'),
        C('fortress', 'common', 'Fortress', '🏰', [1.3, 1.45, 1.6, 1.75, 1.9, 2.05, 2.2], 'x', 'Multiplies Defense Absolute.'),
        C('freeUpgrades', 'rare', 'Free Upgrades', '✨', [0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10], 'pct+', 'Adds to all three free upgrade chances.'),
        C('extraOrb', 'rare', 'Extra Orb', '🌀', [2.6, 3.0, 3.4, 3.9, 4.3, 4.7, 5.1], 'rpm', 'Adds a second ring of orbs (one orb, more from the Extra Extra Orbs lab) spinning at this speed.'),
        C('plasmaCannon', 'rare', 'Plasma Cannon', '☄️', [0.30, 0.34, 0.38, 0.42, 0.46, 0.50, 0.54], 'pct', 'Fires once at each boss just before it reaches tower range, dealing this share of its max health.', { locked: true }),
        C('criticalCoin', 'rare', 'Critical Coin', '🪙', [0.15, 0.18, 0.21, 0.24, 0.27, 0.30, 0.33], 'pct', 'This share of basic enemies carry 1 extra coin.'),
        C('waveSkip', 'rare', 'Wave Skip', '⏩', [0.09, 0.10, 0.11, 0.13, 0.15, 0.17, 0.19], 'pct', 'Chance at each new wave to skip ahead a wave (and collect its rewards ×1.1).'),
        C('introSprint', 'rare', 'Intro Sprint', '🏃', [20, 30, 40, 50, 60, 80, 100], 'int', 'For the first this-many waves (up to your best), each wave jumps 10 waves. No coins while sprinting.', { locked: true }),
        C('landMineStun', 'rare', 'Land Mine Stun', '💫', [1.4, 1.8, 2.2, 2.6, 3, 3.4, 3.8], 's', 'Land mines have a 40% chance to stun non-boss enemies for this long.', { ms: 'T7W250' }),
        C('recoveryPackage', 'rare', 'Recovery Package Chance', '📦', [0.15, 0.18, 0.21, 0.24, 0.27, 0.30, 0.33], 'pct+', 'Adds to recovery package chance.', { ms: 'T2W750' }),
        C('cells', 'rare', 'Cells', '🧬', [2, 4, 6, 8, 10, 12, 14], 'int+', 'Adds flat cells to every elite kill.', { ms: 'T4W40' }),
        C('deathRay', 'epic', 'Death Ray', '🔆', [2.3, 2.7, 3.1, 3.5, 3.9, 4.4, 4.9], 's', 'Every 11 seconds fires a ray for this long that destroys normal enemies it touches.'),
        C('energyNet', 'epic', 'Energy Net', '🕸️', [2.5, 2.8, 3.1, 3.4, 3.7, 4, 4.3], 's', 'Nets each boss as it enters range, holding it for this long.', { locked: true }),
        C('superTower', 'epic', 'Super Tower', '⚡', [2.5, 2.9, 3.3, 3.7, 4.1, 4.5, 5.0], 'x', 'For 15s (first after 30s, then every 45s) projectile damage is multiplied by this.', { locked: true }),
        C('secondWind', 'epic', 'Second Wind', '🪽', [10, 15, 20, 25, 30, 35, 40], 's', 'Once per run, when the tower would die it revives at 50% health and is invincible for this long.', { locked: true }),
        C('demonMode', 'epic', 'Demon Mode', '😈', [180, 200, 220, 240, 260, 280, 300], 's', 'Button, once per run: ×300 projectile damage and no damage taken for this long.', { locked: true }),
        C('energyShield', 'epic', 'Energy Shield', '🔰', [20, 18, 16, 14, 12, 10, 8], 'min', 'Each charge blocks one hit. Gains a charge every this-many minutes.', { locked: true }),
        C('waveAccelerator', 'epic', 'Wave Accelerator', '⏱️', [0.30, 0.34, 0.38, 0.42, 0.46, 0.50, 0.54], 'pct', 'Reduces the cooldown between waves.', { locked: true }),
        C('berserker', 'epic', 'Berserker', '😡', [0.008, 0.009, 0.010, 0.011, 0.012, 0.013, 0.014], 'pct2', 'Adds this share of all damage taken this run to tower damage (max ×8).'),
        C('ultimateCrit', 'epic', 'Ultimate Crit', '💥', [0.01, 0.0133, 0.0166, 0.02, 0.0233, 0.0266, 0.03], 'pct2', 'Ultimate weapon hits can crit at the tower crit factor.', { ms: 'T14W50' }),
        C('nuke', 'epic', 'Nuke', '☢️', [0.25, 0.35, 0.45, 0.55, 0.65, 0.80, 1], 'pct', 'Button, once per run: destroys this share of enemies, then 15s of invincibility.', { locked: true, ms: 'T11W10' }),
        C('areaOfEffect', 'epic', 'Area of Effect', '🎆', [0.05, 0.08, 0.11, 0.14, 0.17, 0.20, 0.25], 'pct+', 'More damage for missiles, mines, flame bot and poison swamp.', { ms: 'T20W80' }),
    ];
    D.CARD_BY = Object.fromEntries(D.CARDS.map(c => [c.id, c]));
    D.CARD_LEVEL_COPIES = [0, 1, 3, 8, 16, 28, 48, 80]; // total copies for level 1..7
    D.CARD_SLOT_GEMS = [0, 0, 50, 100, 200, 300, 400, 500, 600, 750, 1000, 1200, 1400, 1600, 1800, 2500, 3500, 4500, 5500, 6500, 7500, 8500, 10000];
    D.CARD_RARITY = { common: 0.80, rare: 0.17, epic: 0.03 };
    D.MASTERY = {};
    for (const m of W.masteries) {
        const card = D.CARDS.find(c => c.name.toLowerCase() === m.card.toLowerCase());
        if (card) D.MASTERY[card.id] = { name: m.name, desc: m.desc, stones: m.stones, vals: m.vals.map(labNum) };
    }

    /* =====================================================================
       ULTIMATE WEAPONS
       ===================================================================== */
    const UWT = (wikiKey) => W.uw[wikiKey].map(col => col.map(([v, c]) => ({ v, c })));
    D.UWS = [
        { id: 'cl', name: 'Chain Lightning', ic: '⚡', col: '#facc15', t: UWT('Chain_Lightning'), st: ['Damage', 'Quantity', 'Chance'], f: ['x', 'int', 'pct100'], desc: 'Chance on every hit to spawn chain lightning that jumps between enemies.' },
        { id: 'sm', name: 'Smart Missiles', ic: '🚀', col: '#fb923c', t: UWT('Smart_Missiles'), st: ['Damage', 'Quantity', 'Cooldown'], f: ['x', 'int', 's'], desc: 'Launches homing missiles that explode on impact.' },
        { id: 'dw', name: 'Death Wave', ic: '🌊', col: '#f43f5e', t: UWT('Death_Wave'), st: ['Damage', 'Effect Waves', 'Cooldown'], f: ['x', 'int', 's'], desc: 'Effect waves mark every enemy, then a death wave rolls out with a pool of damage.' },
        { id: 'cf', name: 'Chrono Field', ic: '⏳', col: '#67e8f9', t: UWT('Chrono_Field'), st: ['Duration', 'Speed Reduction', 'Cooldown'], f: ['s', 'pct100', 's'], desc: 'Slows every enemy inside the tower range.' },
        { id: 'ilm', name: 'Inner Land Mines', ic: '💣', col: '#f97316', t: UWT('Inner_Land_Mines'), st: ['Damage', 'Quantity', 'Cooldown'], f: ['x', 'int', 's'], desc: 'Mines circle the tower and explode on contact.' },
        { id: 'gt', name: 'Golden Tower', ic: '👑', col: '#fbbf24', t: UWT('Golden_Tower'), st: ['Bonus', 'Duration', 'Cooldown'], f: ['x', 's', 's'], desc: 'Multiplies cash and coins from kills while active.' },
        { id: 'ps', name: 'Poison Swamp', ic: '☠️', col: '#84cc16', t: UWT('Poison_Swamp'), st: ['Damage', 'Duration', 'Cooldown'], f: ['x', 's', 's'], desc: 'A toxic pool that damages every enemy inside it each second.' },
        { id: 'bh', name: 'Black Hole', ic: '🕳️', col: '#a855f7', t: UWT('Black_Hole'), st: ['Size', 'Duration', 'Cooldown'], f: ['m', 's', 's'], desc: 'Pulls in and holds normal enemies at the edge of your range.' },
        { id: 'sl', name: 'Spotlight', ic: '🔦', col: '#fde68a', t: UWT('Spotlight'), st: ['Bonus', 'Angle', 'Quantity'], f: ['x', 'deg', 'int'], desc: 'Rotating beams; enemies inside take extra damage.' },
    ];
    D.UW_BY = Object.fromEntries(D.UWS.map(u => [u.id, u]));
    D.UW_COST = [5, 50, 150, 300, 800, 1250, 1750, 2400, 3000];
    // Random UW perk gives these values (stat index -> value)
    D.UW_PERK = { cl: [46, 3, 15.5], sm: [43, 11, 110], dw: [46, 2, 210], cf: [22, 40, 120], ilm: [43, 5, 130], gt: [9, 30, 230], ps: [43, 50, 90], bh: [50, 20, 130], sl: [27.6, 45, 1] };
    D.UWP_COST = [500, 625, 750, 975, 1250, 1650, 2200, 2900, 3800];
    const P300 = [300, 375, 475, 600, 725, 925, 1150, 1450, 1800, 2200, 2650, 3150, 3700, 4300];
    const P300b = [300, 360, 430, 510, 620, 750, 900, 1100, 1350, 1650, 2050, 2600, 3300, 4150];
    const P400 = [400, 500, 610, 730, 860, 1000, 1150, 1300, 1500, 1700, 1950, 2200, 2450, 2700];
    D.UW_PLUS = {
        cl: { name: 'Smite', cost: P300, vals: [0.0005, 0.001, 0.0015, 0.002, 0.0025, 0.003, 0.0035, 0.004, 0.0045, 0.005, 0.0055, 0.006], desc: (v) => `Each chain lightning hit can deal ${G.fmt(v * 100, 2)}% of the wave's enemy health` },
        sm: { name: 'Cover Fire', cost: P300, vals: [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2], desc: (v) => `Launch an extra missile every ${v}s` },
        ps: { name: 'Death Creep', cost: P300, vals: [1.2, 1.9, 2.6, 3.3, 4, 4.7, 5.4, 6.1, 6.8, 7.5, 8.2, 8.9, 9.6, 10.3, 11.1], desc: (v) => `Each swamp tick grows by ${Math.round(v * 100)}% of its base damage` },
        gt: { name: 'Golden Combo', cost: P300b, vals: [0.0003, 0.0006, 0.0009, 0.0012, 0.0015, 0.0018, 0.0021, 0.0024, 0.0027, 0.003, 0.0033, 0.0036, 0.0039, 0.0042, 0.0045], desc: (v) => `After Golden Tower ends, +${(v * 100).toFixed(2)}% cash and coins per kill it made` },
        ilm: { name: 'Charged Mines', cost: P300b, vals: [0.5, 1.5, 2.9, 4.7, 6.9, 9.5, 12.5, 15.9, 19.7, 23.9, 28.5, 33.5, 38.9, 44.7, 50.9], desc: (v) => `Inner mine damage grows ×${v} every second they are alive` },
        dw: { name: 'Kill Wall', cost: P400, vals: [3, 4, 6, 9, 13, 18, 24, 31, 39, 48, 58, 69, 81, 94, 108], desc: (v) => `Each effect-wave hit adds ×${v} to the death wave's damage pool` },
        bh: { name: 'Consume', cost: P400, vals: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75], desc: (v) => `At the end, deals ${v}× the wave's enemy health to everything inside` },
        cf: { name: 'Chrono Loop', cost: P400, vals: [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75], desc: (v) => `Slowed enemies spiral around the tower (rate ${v})` },
        sl: { name: 'Light Range', cost: P400, vals: [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.11, 0.12, 0.13, 0.14, 0.15], desc: (v) => `Spotlight bonus grows by ${v}× your damage/meter` },
    };

    /* =====================================================================
       PERKS
       ===================================================================== */
    // kind: m = multiplicative (1 + v·q)(1 + bonus), a = additive v·q·(1 + bonus), s = special
    D.PERKS = [
        { id: 'health', kind: 'm', v: 0.20, q: 5, name: (v) => `×${v} Max Health` },
        { id: 'damage', kind: 'm', v: 0.15, q: 5, name: (v) => `×${v} Damage` },
        { id: 'coins', kind: 'm', v: 0.15, q: 5, name: (v) => `×${v} All Coin Bonuses` },
        { id: 'defAbs', kind: 'm', v: 0.15, q: 5, name: (v) => `×${v} Defense Absolute` },
        { id: 'cash', kind: 'm', v: 0.15, q: 5, name: (v) => `×${v} Cash Bonus` },
        { id: 'regen', kind: 'm', v: 0.75, q: 5, name: (v) => `×${v} Health Regen` },
        { id: 'interest', kind: 'm', v: 0.50, q: 5, name: (v) => `Interest ×${v}` },
        { id: 'landMine', kind: 'm', v: 2.50, q: 5, name: (v) => `Land Mine Damage ×${v}`, req: 'd7' },
        { id: 'free', kind: 'a', v: 0.05, q: 5, name: (v) => `Free Upgrade Chance for All +${(v * 100).toFixed(1)}%` },
        { id: 'defPct', kind: 'a', v: 0.04, q: 5, name: (v) => `Defense Percent +${(v * 100).toFixed(2)}%` },
        { id: 'bounce', kind: 's', v: 2, q: 3, name: () => 'Bounce Shot +2', req: 'a4' },
        { id: 'perkWaves', kind: 'a', v: 0.20, q: 3, name: (v) => `Perk Wave Requirement -${(v * 100).toFixed(1)}%` },
        { id: 'orbs', kind: 's', v: 1, q: 2, name: () => 'Orbs +1', req: 'd5' },
        { id: 'randomUW', kind: 's', v: 1, q: 1, name: () => 'Unlock a Random Ultimate Weapon' },
        { id: 'gameSpeed', kind: 'a', v: 1, q: 1, name: (v) => `Increase Max Game Speed by +${v.toFixed(2)}` },
    ];
    D.UW_PERKS = [
        { id: 'uw_sm', uw: 'sm', name: '4 More Smart Missiles' }, { id: 'uw_ps', uw: 'ps', name: 'Swamp Radius ×1.5' },
        { id: 'uw_dw', uw: 'dw', name: '+1 Wave on Death Wave' }, { id: 'uw_ilm', uw: 'ilm', name: 'Extra Set of Inner Mines' },
        { id: 'uw_gt', uw: 'gt', name: 'Golden Tower Bonus ×1.5' }, { id: 'uw_cl', uw: 'cl', name: 'Chain Lightning Damage ×2' },
        { id: 'uw_cf', uw: 'cf', name: 'Chrono Field Duration +5s' }, { id: 'uw_bh', uw: 'bh', name: 'Black Hole Duration +12.0s' },
        { id: 'uw_sl', uw: 'sl', name: 'Spotlight Damage Bonus ×1.5' },
    ];
    D.TRADE_PERKS = [
        { id: 't_dmg', v: 1.5, name: (v) => `×${v.toFixed(2)} Tower Damage, but Bosses Have 8x Health` },
        { id: 't_coin', v: 1.8, name: (v) => `×${v.toFixed(2)} coins, but Tower Max Health -70%` },
        { id: 't_ehp', v: 0.5, name: (v) => `Enemies Have -${Math.round(v * 100)}% Health, but Tower Health Regen and Lifesteal -90%` },
        { id: 't_edmg', v: 0.5, name: (v) => `Enemies Damage -${Math.round(v * 100)}%, but Tower Damage -50%` },
        { id: 't_ranged', v: 1, fixed: true, name: () => 'Ranged Enemies Attack Distance Reduced, But Ranged Enemies Damage x3' },
        { id: 't_slow', v: 0.4, name: (v) => `Enemies Speed -${Math.round(v * 100)}%, But Enemies Damage x2.5` },
        { id: 't_cashwave', v: 12, name: (v) => `×${v.toFixed(2)} Cash Per Wave, But Enemy Kill Don't Give Cash` },
        { id: 't_regen', v: 8, name: (v) => `Tower Health Regen ×${v.toFixed(2)}, But Tower Max Health -60%` },
        { id: 't_boss', v: 0.7, half: true, name: (v) => `Boss Health -${(v * 100).toFixed(1)}%, But Boss Speed +50%` },
        { id: 't_ls', v: 2.5, name: (v) => `Lifesteal ×${v.toFixed(2)}, But Knockback force -70%` },
    ];

    /* =====================================================================
       MODULES
       ===================================================================== */
    D.MOD_TYPES = [['cannon', 'Cannon', '🔴', 'Damage'], ['armor', 'Armor', '🟦', 'Health'], ['generator', 'Generator', '🔺', 'Coin Bonus'], ['core', 'Core', '🔷', 'Ultimate Weapon Damage']];
    // rarity steps, their max slot level, substat count, colour, and the rarity index used by substat rolls
    D.RAR = [
        { id: 'common', n: 'Common', max: 20, subs: 1, col: '#cbd5e1', sub: 0 },
        { id: 'rare', n: 'Rare', max: 30, subs: 2, col: '#38bdf8', sub: 1 },
        { id: 'rare+', n: 'Rare+', max: 40, subs: 2, col: '#38bdf8', sub: 1 },
        { id: 'epic', n: 'Epic', max: 60, subs: 3, col: '#c084fc', sub: 2 },
        { id: 'epic+', n: 'Epic+', max: 80, subs: 3, col: '#c084fc', sub: 2 },
        { id: 'legendary', n: 'Legendary', max: 100, subs: 3, col: '#fbbf24', sub: 3 },
        { id: 'legendary+', n: 'Legendary+', max: 120, subs: 4, col: '#fbbf24', sub: 3 },
        { id: 'mythic', n: 'Mythic', max: 140, subs: 4, col: '#f87171', sub: 4 },
        { id: 'mythic+', n: 'Mythic+', max: 160, subs: 5, col: '#f87171', sub: 4 },
        { id: 'ancestral', n: 'Ancestral', max: 200, subs: 6, col: '#4ade80', sub: 5 },
    ];
    D.STAR_MAX = [200, 220, 240, 260, 280, 300];
    D.STAR_SUBS = [6, 7, 7, 8, 8, 8];
    D.STAR_MULT = [1, 1.04, 1.08, 1.12, 1.16, 1.20];
    D.SUB_UNLOCK_LV = [41, 101, 141, 161, 201, 241];
    D.SUB_RARITY = [0.612, 0.25, 0.10, 0.025, 0.01, 0.003];
    D.SUB_RAR_NAMES = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Ancestral'];
    D.REROLL_COST = [10, 40, 160, 500, 1000, 1600, 2250, 3000];
    D.SHATTER = { common: 5, rare: 10, 'rare+': 30, epic: 90, natural: 1000 };
    D.PULL = { common: 0.685, rare: 0.29, epic: 0.025, pity: 150, gems: 20 };
    // Main effect: the wiki gives no numbers for it, so this is a stand-in that grows with slot level and rarity.
    D.MAIN_RARITY = { common: 0.6, rare: 0.8, 'rare+': 0.9, epic: 1, 'epic+': 1.1, legendary: 1.25, 'legendary+': 1.35, mythic: 1.5, 'mythic+': 1.65, ancestral: 1.8 };
    D.mainEffect = (lv, rarity, stars) => lv <= 0 ? 0 : (0.03 + 0.012 * lv) * (D.MAIN_RARITY[rarity] || 1) * D.STAR_MULT[stars || 0];
    const na = null;
    // [key, label, values per substat rarity (common..ancestral), how to show]
    D.SUBS = {
        cannon: [['attackSpeed', 'Attack Speed', [0.3, 0.5, 0.7, 1, 3, 5], '+'], ['critChance', 'Critical Chance', [2, 3, 4, 6, 8, 10], '%'], ['critFactor', 'Critical Factor', [2, 4, 6, 8, 12, 15], '+'],
            ['range', 'Attack Range', [2, 4, 8, 12, 20, 30], 'm'], ['dpm', 'Damage / Meter', [0.005, 0.01, 0.025, 0.04, 0.075, 0.15], '+'], ['msChance', 'Multishot Chance', [na, 3, 5, 7, 10, 13], '%'],
            ['msTargets', 'Multishot Targets', [na, na, 1, 2, 3, 4], '+'], ['rfChance', 'Rapid Fire Chance', [na, 2, 4, 6, 9, 12], '%'], ['rfDuration', 'Rapid Fire Duration', [na, 0.4, 0.8, 1.4, 2.5, 3.5], 's'],
            ['bsChance', 'Bounce Shot Chance', [na, 2, 3, 5, 9, 12], '%'], ['bsTargets', 'Bounce Shot Targets', [na, na, 1, 2, 3, 4], '+'], ['bsRange', 'Bounce Shot Range', [na, 0.5, 0.8, 1.2, 1.8, 2], 'm'],
            ['scChance', 'Super Crit Chance', [na, na, 3, 5, 7, 10], '%'], ['scMult', 'Super Crit Mult', [na, na, 2, 3, 5, 7], '+'], ['rendChance', 'Rend Armor Chance', [na, na, na, 2, 5, 8], '%'],
            ['rendMult', 'Rend Armor Mult', [na, na, na, 0.02, 0.05, 0.08], '+'], ['rendMax', 'Max Rend Armor', [na, na, na, 2, 3, 5], '×']],
        armor: [['regenPct', 'Health Regen', [20, 40, 60, 100, 200, 400], '%'], ['defPct', 'Defense %', [1, 2, 3, 5, 6, 8], '%'], ['defAbsPct', 'Defense Absolute', [15, 25, 40, 100, 500, 1000], '%'],
            ['thorns', 'Thorn Damage', [na, na, 2, 4, 7, 10], '%'], ['lifesteal', 'Lifesteal', [na, na, 0.3, 0.5, 1.5, 2], '%'], ['kbChance', 'Knockback Chance', [na, na, 2, 4, 6, 9], '%'],
            ['kbForce', 'Knockback Force', [na, na, 0.1, 0.4, 0.9, 1.5], '+'], ['orbSpeed', 'Orb Speed', [na, na, 1, 1.5, 2, 3], '+'], ['orbs', 'Orbs', [na, na, na, na, 1, 2], '+'],
            ['swSize', 'Shockwave Size', [na, na, 0.1, 0.3, 0.7, 1], '+'], ['swFreq', 'Shockwave Frequency', [na, na, -1, -2, -3, -4], 's'], ['lmDamage', 'Land Mine Damage', [na, 30, 50, 150, 500, 800], '%'],
            ['lmChance', 'Land Mine Chance', [na, 1.5, 3, 6, 9, 12], '%'], ['lmRadius', 'Land Mine Radius', [na, 0.1, 0.15, 0.3, 0.75, 1], '+'], ['deathDefy', 'Death Defy', [na, na, na, 1.5, 3.5, 5], '%'],
            ['wallHealth', 'Wall Health', [na, na, 20, 40, 90, 120], '%'], ['wallRebuild', 'Wall Rebuild', [na, na, -20, -40, -80, -100], 's']],
        generator: [['cashBonus', 'Cash Bonus', [0.1, 0.2, 0.3, 0.5, 1.2, 2.5], '+'], ['cashWave', 'Cash / Wave', [30, 50, 100, 200, 500, 1000], '+'], ['coinKill', 'Coins / Kill Bonus', [0.1, 0.2, 0.3, 0.4, 0.5, 0.6], '+'],
            ['coinWave', 'Coins / Wave', [20, 35, 60, 120, 200, 350], '+'], ['freeAtk', 'Free Attack Upgrade', [2, 4, 6, 8, 10, 12], '%'], ['freeDef', 'Free Defense Upgrade', [2, 4, 6, 8, 10, 12], '%'],
            ['freeUtil', 'Free Utility Upgrade', [2, 4, 6, 8, 10, 12], '%'], ['interest', 'Interest / Wave', [na, na, 2, 4, 6, 8], '%'], ['pkgAmount', 'Recovery Amount', [na, na, 3, 5, 7, 10], '%'],
            ['pkgMax', 'Max Recovery', [na, na, 0.4, 0.7, 1, 1.5], '+'], ['pkgChance', 'Package Chance', [na, na, 5, 8, 11, 15], '%'], ['skipAtk', 'Enemy Attack Level Skip', [na, na, 2, 4, 6, 8], '%'],
            ['skipHp', 'Enemy Health Level Skip', [na, na, 2, 4, 6, 8], '%']],
        core: [['gt_bonus', 'Golden Tower - Bonus', [na, na, 1, 2, 3, 4], '+'], ['gt_dur', 'Golden Tower - Duration', [na, na, na, 2, 4, 7], 's'], ['gt_cd', 'Golden Tower - Cooldown', [na, na, na, -5, -8, -12], 's'],
            ['bh_size', 'Black Hole - Size', [2, 4, 6, 8, 10, 12], 'm'], ['bh_dur', 'Black Hole - Duration', [na, na, na, 2, 3, 4], 's'], ['bh_cd', 'Black Hole - Cooldown', [na, na, na, -2, -3, -4], 's'],
            ['sl_bonus', 'Spotlight - Bonus', [1.2, 2.5, 3.5, 10, 15, 20], '+'], ['sl_angle', 'Spotlight - Angle', [na, na, 3, 6, 11, 15], '°'], ['cf_dur', 'Chrono Field - Duration', [na, na, na, 4, 7, 10], 's'],
            ['cf_slow', 'Chrono Field - Speed Reduction', [na, na, 3, 8, 11, 15], '%'], ['cf_cd', 'Chrono Field - Cooldown', [na, na, na, -4, -7, -10], 's'], ['dw_dmg', 'Death Wave - Damage', [8, 15, 25, 50, 100, 250], '×'],
            ['dw_qty', 'Death Wave - Quantity', [na, na, na, 1, 2, 3], '+'], ['dw_cd', 'Death Wave - Cooldown', [na, na, na, -6, -10, -13], 's'], ['sm_dmg', 'Smart Missiles - Damage', [8, 15, 25, 50, 100, 250], '×'],
            ['sm_qty', 'Smart Missiles - Quantity', [na, na, 1, 2, 4, 5], '+'], ['sm_cd', 'Smart Missiles - Cooldown', [na, na, na, -2, -4, -6], 's'], ['ilm_dmg', 'Inner Land Mines - Damage', [8, 15, 25, 50, 100, 250], '×'],
            ['ilm_qty', 'Inner Land Mines - Quantity', [na, na, na, 1, 2, 3], '+'], ['ilm_cd', 'Inner Land Mines - Cooldown', [na, na, -5, -8, -10, -13], 's'], ['ps_dmg', 'Poison Swamp - Damage', [8, 15, 25, 50, 100, 250], '×'],
            ['ps_dur', 'Poison Swamp - Duration', [na, na, na, 2, 5, 10], 's'], ['ps_cd', 'Poison Swamp - Cooldown', [na, -2, -4, -6, -8, -10], 's'], ['cl_dmg', 'Chain Lightning - Damage', [8, 15, 25, 50, 100, 250], '×'],
            ['cl_qty', 'Chain Lightning - Quantity', [na, na, 1, 2, 3, 4], '+'], ['cl_chance', 'Chain Lightning - Chance', [2, 4, 6, 9, 12, 15], '%']],
    };
    // Natural epics. vals = unique effect at Epic / Legendary / Mythic / Ancestral.
    D.UNIQUES = [
        ['cannon', 'Astral Deliverance', [20, 40, 60, 80], (v) => `Bounce range +3% of tower range. Each bounce adds ${v}% damage`],
        ['cannon', 'Being Annihilator', [5, 7, 10, 14], (v) => `+${v}% super crit chance. A super crit makes the next 5 shots super crits`],
        ['cannon', 'Death Penalty', [5, 8, 11, 15], (v) => `${v}% chance to mark a spawning enemy; its first hit destroys it`],
        ['cannon', 'Havoc Bringer', [10, 13, 15, 20], (v) => `${v}% chance for rend armor to go straight to max`],
        ['cannon', 'Shrink Ray', [10, 20, 30, 40], (v) => `1% chance per hit to cut the enemy's mass by ${v}%`],
        ['cannon', 'Amplifying Strike', [5, 11, 18, 26], (v) => `Killing a boss or elite multiplies tower damage ×5 for ${v}s`],
        ['cannon', 'Gilded Sniper', [10, 20, 30, 40], (v) => `${v}% chance on kill to apply every active coin bonus`],
        ['armor', 'Anti-Cube Portal', [10, 15, 20, 25], (v) => `Enemies hit by a shockwave take ×${v} damage for 7s`],
        ['armor', 'Negative Mass Projector', [1, 1.5, 2, 2.5], (v) => `Orbs that don't kill reduce enemy damage and speed by ${v}% per hit (max 50%)`],
        ['armor', 'Wormhole Redirector', [25, 50, 75, 100], (v) => `Health regen can heal up to ${v}% of package max recovery`],
        ['armor', 'Space Displacer', [15, 20, 25, 30], (v) => `Land mines have a ${v}% chance to spawn as inner land mines`],
        ['armor', 'Sharp Fortitude', [1.25, 1.5, 2, 2.5], (v) => `Wall health and regen ×${v}`],
        ['armor', 'Orbital Augment', [2, 4, 6, 8], (v) => `${v} electrons orbit the tower, each dealing 15% of an enemy's remaining health`],
        ['armor', 'Sentry Protocol', [1, 2, 3, 4], (v) => `Orbs stop spinning and instead fire ${v} mini orbs`],
        ['generator', 'Singularity Harness', [5, 8, 11, 15], (v) => `Bots get +${v}m range. Flame bot targets take double damage`],
        ['generator', 'Galaxy Compressor', [10, 13, 17, 20], (v) => `Recovery packages cut ultimate weapon cooldowns by ${v}s`],
        ['generator', 'Pulsar Harvester', [1, 1.5, 2, 2.5], (v) => `${v}% chance per hit to lower the enemy's health and attack level by 1`],
        ['generator', 'Black Hole Digestor', [3, 5, 7, 10], (v) => `+${v}% coins/kill for each free upgrade this wave`],
        ['generator', 'Project Funding', [12.5, 25, 50, 100], (v) => `Tower damage grows by ${v}% per digit of cash you hold`],
        ['generator', 'Restorative Bonus', [15, 20, 25, 30], (v) => `Packages give +50% attack speed for ${v}s`],
        ['generator', 'Infinity Threshold', [1000, 2000, 3000, 4000], (v) => `Free upgrades to damage, health and regen can pass the limit by ${G.fmt(v)} levels`],
        ['core', 'Om Chip', [2, 4, 7, 15], (v) => `Spotlight tracks bosses; enemies near a lit boss take ×${v} damage`],
        ['core', 'Harmony Conductor', [15, 20, 25, 30], (v) => `Poisoned enemies have a ${v}% chance to miss attacks`],
        ['core', 'Dimension Core', [5, 10, 15, 20], (v) => `Chain lightning shocks stack up to ${v} times; shock chance and multiplier doubled`],
        ['core', 'Multiverse Nexus', [20, 10, 1, -10], (v) => `Death Wave, Golden Tower and Black Hole fire together (cooldown average ${v >= 0 ? '+' : ''}${v}s)`],
        ['core', 'Magnetic Hook', [1, 2, 3, 4], (v) => `Fires ${v} inner land mines at bosses as they enter range`],
        ['core', 'Primordial Collapse', [60, 65, 75, 90], (v) => `One more black hole; enemies inside deal ${v}% less damage`],
        ['core', 'Tactical Barrage', [14, 10, 6, 2], (v) => `Fires a homing missile every ${v}s and doubles missile radius and amplifier`],
    ].map(([type, name, vals, desc]) => ({ type, name, vals, desc }));
    D.UNIQUE_STEP = { epic: 0, 'epic+': 0, legendary: 1, 'legendary+': 1, mythic: 2, 'mythic+': 2, ancestral: 3 };
    // shard + coin cost of each slot level (sampled every few levels in the wiki)
    D.modCost = (lv) => {
        const s = W.moduleCost.map(r => [r[0], r[1]]), c = W.moduleCost.map(r => [r[0], r[2]]);
        return { shards: Math.round(G.curve(s, lv)), coins: Math.round(G.curve(c, lv)) };
    };

    /* =====================================================================
       BOTS
       ===================================================================== */
    const B = (wk) => W.bots[wk];
    D.BOTS = [
        { id: 'flame', name: 'Flame Bot', ic: '🔥', col: '#f97316', st: ['Damage Reduction', 'Cooldown', 'Damage', 'Range'], base: [0.20, 75, 50, 30], t: B('Flame_Bot'), f: ['pct100', 's', 'x', 'm'], desc: 'Burns enemies around it; burned enemies deal less damage.' },
        { id: 'thunder', name: 'Thunder Bot', ic: '🌩️', col: '#a5b4fc', st: ['Duration', 'Cooldown', 'Linger', 'Range'], base: [5, 120, 0.20, 25], t: B('Thunder_Bot'), f: ['s', 's', 'pct100', 'm'], desc: 'Stuns enemies around it, then slows them.' },
        { id: 'golden', name: 'Golden Bot', ic: '🪙', col: '#fbbf24', st: ['Duration', 'Cooldown', 'Bonus', 'Range'], base: [20, 120, 2, 20], t: B('Golden_Bot'), f: ['s', 's', 'x', 'm'], desc: 'Enemies destroyed in its range give more coins.' },
        { id: 'amplify', name: 'Amplify Bot', ic: '📡', col: '#f472b6', st: ['Duration', 'Cooldown', 'Bonus', 'Range'], base: [20, 120, 3.5, 25], t: B('Amplify_Bot'), f: ['s', 's', 'x', 'm'], desc: 'Enemies in its range take more damage.' },
        { id: 'botbot', name: 'Bot Bot', ic: '🤖', col: '#34d399', st: ['Duration', 'Cooldown', 'Bonus', 'Range'], base: [20, 120, 1.05, 25], t: B('Bot_Bot'), f: ['s', 's', 'x', 'm'], desc: 'Boosts the effects of other bots in its range.' },
    ];
    D.BOT_BY = Object.fromEntries(D.BOTS.map(b => [b.id, b]));
    // Bot+ abilities: 1,250 stones each once all five bots are owned, then upgraded with medals (wiki tables)
    const step50 = (n) => [0, 100].concat(Array.from({ length: n - 2 }, (_, i) => 150 + i * 50));
    const range = (a, b, d) => { const o = []; for (let v = a; v <= b + 1e-9; v += d) o.push(+v.toFixed(3)); return o; };
    D.BOT_PLUS = {
        flame: { name: 'Wild Fire', vals: range(1.5, 3.5, 0.1), cost: step50(21), desc: (v) => `Burned enemies take ×${v.toFixed(1)} damage` },
        thunder: { name: 'Titan Shock', vals: range(0.05, 0.25, 0.01), cost: step50(21), desc: (v) => `Struck enemies attack ${Math.round(v * 100)}% slower per digit of their mass` },
        golden: { name: 'Bonus Cells', vals: range(1.25, 2.5, 0.05), cost: step50(26), desc: (v) => `Elites killed in range give ×${v.toFixed(2)} cells` },
        amplify: { name: 'Echoing Shot', vals: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], cost: [0, 100, 300, 500, 700, 900, 1100, 1300, 1500, 1700], desc: (v) => `Tower shots in range count as ${v} shots` },
        botbot: { name: 'Maximum Power', vals: range(1.25, 2.25, 0.05), cost: step50(21), desc: (v) => `Other bots' Bot+ abilities ×${v.toFixed(2)} in range` },
    };
    D.BOT_PLUS_STONES = 1250;
    D.BOT_UNLOCK = [150, 300, 600, 900, 1200];
    D.botUpCost = (lv) => 100 + 40 * lv;
    // flame bot's damage reduction column is stored as whole percents
    for (const b of D.BOTS) b.t = b.t.map((col, i) => col.map(v => (b.f[i] === 'pct100' ? v / 100 : v)));

    /* =====================================================================
       GUARDIAN CHIPS
       ===================================================================== */
    const CH = (wk) => W.chips[wk].map(col => col.map(([v, c]) => ({ v, c })));
    D.CHIPS = [
        { id: 'attack', name: 'Attack', ic: '⚔️', st: ['Percentage', 'Cooldown', 'Targets'], t: CH('Attack'), cdIdx: 1, f: ['pct100', 's', 'int'], base: true, desc: 'Hits the most damaged enemies for a share of the health they have already lost (half against bosses).' },
        { id: 'ally', name: 'Ally', ic: '🤝', st: ['Recovery Amount', 'Cooldown', 'Max Recovery'], t: CH('Ally'), cdIdx: 1, f: ['pct100', 's', 'x'], base: true, desc: 'Turns the nearest enemy into a recovery package that can heal past normal max recovery.' },
        { id: 'bounty', name: 'Bounty', ic: '💰', st: ['Multiplier', 'Cooldown', 'Targets'], t: CH('Steal'), cdIdx: 1, f: ['x', 's', 'int'], desc: 'Marks nearby non-basic enemies to give more coins.' },
        { id: 'fetch', name: 'Fetch', ic: '🦴', st: ['Cooldown', 'Find Chance', 'Double Find'], t: CH('Fetch'), cdIdx: 0, f: ['s', 'pct100', 'pct100'], desc: 'Finds hidden loot: coins, gems, medals, shards and modules.' },
        { id: 'summon', name: 'Summon', ic: '🌀', st: ['Cooldown', 'Duration', 'Cash Bonus'], t: CH('Summon'), cdIdx: 0, f: ['s', 's', 'x'], desc: 'Summons enemies twice a second while active, and multiplies cash from every kill.' },
        { id: 'scout', name: 'Scout', ic: '🔭', st: ['Cooldown', 'Range Bonus', 'Duration'], t: CH('Scout'), cdIdx: 0, f: ['s', 'x', 's'], desc: 'Enemies count as farther away for damage/meter while active.' },
    ];
    D.CHIP_BY = Object.fromEntries(D.CHIPS.map(c => [c.id, c]));
    D.FETCH = [['gems', 0.04, 1], ['medals', 0.02, 1], ['shard:reroll', 0.03, 0], ['shard:cannon', 0.01, 3], ['shard:armor', 0.01, 3], ['shard:generator', 0.01, 3], ['shard:core', 0.01, 3], ['module:common', 0.004, 1], ['module:rare', 0.001, 1], ['coins', 0.865, 0]];

    /* =====================================================================
       ENEMIES
       The health / damage formulas are the community-derived ones used by
       tower-enemy-stats.netlify.app (game version 27.2).
       ===================================================================== */
    const TIER_HP_STEP = [1, 20, 3, 2, 2, 2, 2, 2, 3, 7, 65, 600, 500, 300, 300, 50, 30, 25, 1300, 1200, 1200, 120000, 120000, 120000];
    const tierHp = (t) => TIER_HP_STEP.slice(0, t).reduce((a, b) => a * b, 1);
    const tierDmgDiv = (t) => t >= 24 ? 33691406250000 : t >= 23 ? 6738281250000 : t >= 22 ? 1347656250000 : t >= 21 ? 269531250000 : t >= 20 ? 53906250000
        : t >= 19 ? 10781250000 : t >= 18 ? 2156250000 : t >= 17 ? 431250000 : t >= 16 ? 86250000 : t >= 15 ? 14375000 : t === 14 ? 287500 : t === 13 ? 5750
            : t === 12 ? 115 : t === 11 ? 11.5 : t === 10 ? 2.3 : 1;
    const hpExp = (t) => t >= 15 ? 0.51 : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.01, 0.02, 0.1, 0.22, 0.36][t] || 0;
    const dmgExp = (t) => t >= 15 ? 0.102 : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.002, 0.004, 0.02, 0.046, 0.073][t] || 0;
    D.enemyHp = (tier, wave, tourney) => {
        const w = Math.max(wave, 1), f = (n) => Math.floor(w / n);
        let m = f(5) * 0.04 + f(10) * 0.05 + f(25) * 0.06 + f(50) * 0.08 + f(100) * 0.12 + f(200) * 0.15 + f(900) * 0.35 + f(60) * 0.1 + f(72) * 0.18 + f(83) * 0.2 + f(94) * 0.21 + f(107) * 0.1 + 1;
        m *= Math.pow(1.035, f(30)) * Math.pow(1.02, f(60)) * Math.pow(1.025, f(72)) * Math.pow(1.03, f(83)) * Math.pow(1.03, f(94)) * Math.pow(1.02, f(100)) * Math.pow(1.02, f(107))
            * Math.pow(1.03, f(200)) * Math.pow(1.06, f(400)) * Math.pow(1.15, f(900)) * Math.pow(1.15, f(1024)) * Math.pow(1.11, f(139)) * Math.pow(1.11, f(182)) * Math.pow(1.13, f(241)) * Math.pow(1.13, f(332));
        let ex = 2.13, tm = 1, a = 0.8, b = 0.05, step = 1;
        if (tourney) { ex = 2.408; tm = Math.pow(1.004, w); a *= 7.3; b *= 9.3; step = Math.pow(1.65, Math.max(0, Math.ceil(w / 100) - 1)); }
        ex += hpExp(tier);
        return (b * Math.pow(w, ex) + a * w + 1.5) * m * tm * step * tierHp(tier);
    };
    D.enemyDmg = (tier, wave, tourney) => {
        const w = Math.max(wave, 1), f = (n) => Math.floor(w / n);
        let m = f(5) * 0.02 + f(10) * 0.025 + f(25) * 0.012 + f(50) * 0.017 + f(100) * 0.02 + f(200) * 0.025 + f(900) * 0.02 + 1;
        m *= Math.pow(1.005, f(30)) * Math.pow(1.01, f(72)) * Math.pow(1.01, f(83)) * Math.pow(1.01, f(94)) * Math.pow(1.01, f(107)) * Math.pow(1.02, f(200)) * Math.pow(1.02, f(400))
            * Math.pow(1.035, f(900)) * Math.pow(1.05, f(1024)) * Math.pow(1.03, f(241)) * Math.pow(1.03, f(332));
        if (tier >= 7) m *= Math.pow(1.025, f(139));
        if (tier >= 8) m *= Math.pow(1.025, f(182));
        let ex = 2.007, a = 0.16, b = 0.021, step = 1;
        if (tourney) { ex = 2.375; a *= 7.3; b *= 9.3; step = Math.pow(1.06, Math.max(0, Math.ceil(w / 100) - 1)); }
        ex += dmgExp(tier);
        const k = tier < 4 ? 0.94 : tier < 7 ? 0.9 : 0.86;
        return (b * Math.pow(w, ex) + a * w + 1.07) * m * step * tierHp(tier) * k / tierDmgDiv(tier);
    };
    // hp/spd relative to a basic enemy; coin & cash are base values; mass sets how far knockback pushes.
    D.ENEMY = {
        basic: { n: 'Basic', hp: 1, spd: 1, coin: 0, cash: 1, mass: 1, col: '#f87171', r: 7 },
        fast: { n: 'Fast', hp: 1, spd: 2.1, coin: 2, cash: 1.5, mass: 0.8, col: '#fb923c', r: 6 },
        tank: { n: 'Tank', hp: 5, spd: 0.6, coin: 4, cash: 3, mass: 4, col: '#a78bfa', r: 11 },
        ranged: { n: 'Ranged', hp: 1, spd: 1.2, coin: 2, cash: 1.5, mass: 1, col: '#34d399', r: 7 },
        protector: { n: 'Protector', hp: 0.6, spd: 0.4, coin: 3, cash: 1.5, mass: 2, col: '#60a5fa', r: 9 },
        boss: { n: 'Boss', hp: 20, spd: 0.4, coin: 5, cash: 5, mass: 50, col: '#ef4444', r: 18 },
        vampire: { n: 'Vampire', hp: 2, spd: 0.4, coin: 4, cash: 3, mass: 3, col: '#be123c', r: 10, elite: true },
        ray: { n: 'Ray', hp: 1, spd: 0.4, coin: 4, cash: 3, mass: 3, col: '#facc15', r: 10, elite: true },
        scatter: { n: 'Scatter', hp: 2, spd: 0.6, coin: 4, cash: 3, mass: 2, col: '#e879f9', r: 10, elite: true },
        saboteur: { n: 'Saboteur', hp: 20, spd: 2.1, coin: 4, cash: 3, mass: 30, col: '#94a3b8', r: 13, fleet: true },
        commander: { n: 'Commander', hp: 20, spd: 0.2, coin: 4, cash: 3, mass: 30, col: '#f59e0b', r: 14, fleet: true },
        overcharge: { n: 'Overcharge', hp: 20, spd: 0.2, coin: 4, cash: 3, mass: 30, col: '#22d3ee', r: 14, fleet: true },
    };
    D.ELITES = ['vampire', 'ray', 'scatter'];
    // elite spawn chance per elite type for a wave: largest threshold the wave has passed
    D.eliteChance = (tier, wave) => {
        const pick = (rows) => { let p = 0; for (const r of rows) if (wave >= r[tier]) p = r[0] / 100; return p; };
        const single = pick(W.elites.single), dbl = pick(W.elites.double);
        return { one: Math.min(1, single * 3 + (single >= 0.33 ? 0.01 : 0)), two: Math.min(1, dbl * 3 + (dbl >= 0.33 ? 0.01 : 0)) };
    };
    D.bossEvery = (tier, tourneyLeague) => {
        if (tourneyLeague !== undefined && tourneyLeague !== null) return [10, 9, 8, 7, 6, 5, 5][tourneyLeague];
        return tier >= 18 ? 5 : tier >= 14 ? 10 - (tier - 13) : 10;
    };
    D.protectorEvery = (tier) => tier >= 10 ? 7 : tier >= 7 ? 8 : tier >= 4 ? 9 : 10;
    // The wiki has no spawn tables for the normal enemy mix, so these ramps are a stand-in: later waves and higher tiers bring the other types sooner.
    D.spawnMix = (tier, wave) => {
        const ew = wave * (1 + 0.5 * (tier - 1));
        const r = (start, span, max) => G.clamp((ew - start) / span, 0, 1) * max;
        return { fast: r(8, 300, 0.25), tank: r(18, 400, 0.15), ranged: r(28, 500, 0.15) };
    };
    D.spawnPerSec = (tier, wave) => Math.min(9, (0.4 + 0.012 * wave) * (1 + 0.03 * (tier - 1)));
    D.cashValue = (wave) => wave < 200 ? 1 + Math.floor(wave / 10) : 20 + Math.floor((wave - 200) / 20);
    D.WAVE_LEN = 26;
    D.WAVE_COOL = 9;

    /* =====================================================================
       TIERS, LEAGUES, MILESTONES
       ===================================================================== */
    D.MAX_TIER = 24;
    D.TIER_COINS = [1, 1.8, 2.6, 3.4, 4.2, 5, 5.8, 6.6, 7.5, 8.7, 10.3, 12.2, 14.7, 17.6, 21.3, 25.2, 29.1, 33, 40, 48, 60, 72, 86, 103];
    D.tierCoin = (t) => D.TIER_COINS[t - 1] || 1;
    D.REROLL_SHARDS = [1, 3, 5, 8, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105];
    D.DAILY_COINS = [25, 100, 1e3, 1e4, 25e3, 8e4, 25e4, 5e5, 1e6, 3e6, 5e6, 8e6, 15e6, 30e6, 75e6, 150e6, 300e6, 500e6, 750e6, 1.25e9, 2e9, 10e9, 50e9, 100e9];
    D.LEAGUES = [
        { id: 'Copper', ic: '🥉', tier: 1, col: '#d97706' }, { id: 'Silver', ic: '🥈', tier: 3, col: '#cbd5e1' }, { id: 'Gold', ic: '🥇', tier: 5, col: '#fbbf24' },
        { id: 'Platinum', ic: '💠', tier: 8, col: '#67e8f9' }, { id: 'Champion', ic: '🏆', tier: 12, col: '#c084fc' }, { id: 'Legend', ic: '👑', tier: 17, col: '#f87171' },
        { id: 'Mythic', ic: '🌌', tier: 20, col: '#f0abfc' },
    ];
    for (const L of D.LEAGUES) L.rewards = W.tourney[L.id];
    // Milestones: per tier a list of { wave, std, prem } with parsed rewards
    D.MILESTONES = {};
    for (const t in W.milestones) {
        D.MILESTONES[t] = W.milestones[t].map(([wave, std, prem]) => ({ wave, std, prem }));
    }
    D.PREMIUM_PASS_GEMS = 1500; // the real pass costs money; here it is a one-off gem purchase per 3 tiers

    /* =====================================================================
       MISSIONS & EVENTS
       ===================================================================== */
    // [stat counted, text, goals, needs]
    D.DAILY = [
        ['boss', 'Kill {n} bosses', [1, 2, 3, 4, 5]], ['k_basic', 'Kill {n} basic enemies', [50, 75, 100, 150, 200]],
        ['k_fast', 'Kill {n} fast enemies', [20, 35, 50], () => G.S.maxTier >= 2], ['k_tank', 'Kill {n} tank enemies', [20, 35, 50], () => G.S.maxTier >= 3],
        ['k_ranged', 'Kill {n} ranged enemies', [2, 4, 6], () => G.S.maxTier >= 4], ['gem_tap', 'Tap {n} floating gems', [1, 2, 3]],
        ['waves', 'Advance through a total of {n} waves', [30, 50, 70]], ['battles', 'Start {n} battle', [1]],
        ['crit', 'Hit {n} enemies with critical hits', [100, 150, 200], () => G.S.maxTier >= 4], ['bounce', 'Bounce shots through {n} enemies', [100, 150, 200], () => G.S.wsUnl.a4],
        ['supercrit', 'Hit {n} enemies with super critical hits', [10, 20, 30], () => G.S.wsUnl.a5], ['knock', 'Apply knockback on {n} enemies', [40, 60, 80], () => G.S.wsUnl.d4],
        ['k_orb', 'Kill {n} enemies with orbs', [60, 80, 100, 120], () => G.S.wsUnl.d5], ['k_mine', 'Kill {n} enemies with workshop land mines', [60, 80, 100, 120], () => G.S.wsUnl.d7],
        ['lvlskip', 'Skip enemy level {n} times', [3, 5, 7, 10], () => G.S.wsUnl.u5], ['ws_buy', 'Buy {n} workshop upgrade', [1]], ['battle_buy', 'Buy {n} battle upgrades', [10, 20, 30]],
        ['h_cl', 'Hit {n} enemies with Chain Lightning', [25, 40, 60, 80], () => G.S.uw.own.cl], ['k_dw', 'Kill {n} enemies with Death Wave', [15, 25, 35, 50], () => G.S.uw.own.dw],
        ['poison', 'Poison {n} enemies with Poison Swamp', [60, 100, 150, 200], () => G.S.uw.own.ps], ['k_sm', 'Kill {n} enemies with Smart Missiles', [25, 40, 60, 80], () => G.S.uw.own.sm],
        ['k_gt', 'Kill {n} enemies while Golden Tower is active', [50, 75, 100, 150], () => G.S.uw.own.gt], ['k_cf', 'Kill {n} enemies slowed down by Chrono Field', [50, 75, 100, 150], () => G.S.uw.own.cf],
        ['k_ilm', 'Kill {n} enemies with Inner Land Mines', [15, 25, 35, 50], () => G.S.uw.own.ilm], ['k_sl', 'Kill {n} enemies in spotlight', [15, 25, 35, 50], () => G.S.uw.own.sl],
        ['skip', 'Skip a total of {n} waves', [3, 5, 7, 10], () => G.S.cards.have.waveSkip], ['k_ray', 'Kill {n} enemies with Death Ray', [50, 75, 100, 150], () => G.S.cards.have.deathRay],
        ['net', 'Hit a boss with an energy net {n} times', [1, 2, 3, 4, 5], () => G.S.cards.have.energyNet], ['k_demon', 'Kill {n} enemies while in Demon Mode', [40, 60, 80, 100], () => G.S.cards.have.demonMode],
        ['card_buy', 'Buy {n} card', [1]], ['tourney', 'Participate in {n} tournament', [1], () => G.S.feat.tournaments],
    ];
    D.WEEKLY_BOX = [[3, 10, 0, 0, 5], [4, 15, 10, 0, 5], [5, 20, 15, 0, 5], [7, 25, 20, 0, 5], [10, 30, 25, 10, 5], [15, 35, 30, 15, 5], [20, 50, 35, 20, 5]]; // coin mult, gems, medals, stones, tokens
    // event missions: wiki text -> counted stat. Missions whose stat isn't tracked are left out.
    const EV_STAT = {
        'Log in for X days': 'login', 'Participate in X tournaments': 'tourney', 'Buy X cards': 'card_buy', 'Get the free gem reward in store X times': 'free_gems',
        'Kill X Common Enemies': 'k_basic', 'Kill X fast enemies': 'k_fast', 'Kill X ranged enemies': 'k_ranged', 'Kill X Bosses': 'boss', 'Kill X vampire enemies': 'k_vampire',
        'Kill X Scatter enemies': 'k_scatter', 'Kill X ray enemies': 'k_ray_e', 'Reach wave X on any tier': 'wave_max', 'Tap X Floating Gems': 'gem_tap', 'Buy X Workshop Upgrades': 'ws_buy',
        'Take no damage for X consecutive waves': 'nodmg_max', 'Kill X Bosses outside of Tower range': 'boss_far', 'Obtain X Modules': 'mod_get', 'Obtain X modules by merging': 'mod_merge',
        'Earn X reroll dice': 'reroll_get', 'Hit X enemies with critical hits': 'crit', 'Get X free upgrades': 'free_up', 'Keep X consecutive waves getting max Interest': 'interest_max',
        'Hit X enemies with workshop Land Mines': 'h_mine', 'Kill X enemies with workshop Land Mines': 'k_mine', 'Kill X Enemies with orbs': 'k_orb', 'Obtain X Recovery Packages': 'pkg',
        'Stun X enemies using land mine stun card': 'stun', 'Kill X enemies with Death Ray': 'k_ray', 'Kill X enemies using nuke': 'k_nuke', 'Hit a boss with energy net X times': 'net',
        'Let Energy Shield save you from an attack X times': 'shield', 'Kill X enemies while in Demon Mode': 'k_demon', 'Skip a total of X waves': 'skip',
        'Hit the same enemy with X Smart Missiles': 'sm_same_max', 'Kill X Enemies in Spotlight': 'k_sl', 'Kill X enemies while Golden Tower is active': 'k_gt',
        'Kill X enemies with Inner Land Mines': 'k_ilm', 'Kill X enemies with Death Wave': 'k_dw', 'Kill X enemies slowed down by Chrono Field': 'k_cf',
        'Have X enemies in the same Black Hole': 'bh_max', 'Poison X enemies with Poison Swamp': 'poison', 'Hit X enemies with Inner Land Mines': 'h_ilm',
        'Kill X enemies with Smart Missiles': 'k_sm', 'Hit X enemies with Chain Lightning': 'h_cl', 'Hit X enemies with Death Wave': 'h_dw',
        'Have a total research time of X (rushed labs count)': 'lab_time',
    };
    const evNum = (s) => { const t = G.curve ? null : null; return /d$/.test(s) ? parseFloat(s) * 86400 : (parseFloat(String(s).replace(/,/g, '')) || 0) * (/K$/i.test(s) ? 1e3 : /M$/.test(s) ? 1e6 : 1); };
    const EV_NEEDS = {
        k_fast: () => G.S.maxTier >= 2, k_ranged: () => G.S.maxTier >= 4, k_vampire: () => G.S.maxTier >= 2, k_scatter: () => G.S.maxTier >= 2, k_ray_e: () => G.S.maxTier >= 2,
        mod_get: () => G.S.feat.modules, mod_merge: () => G.S.feat.modules, reroll_get: () => G.S.feat.modules, h_mine: () => G.S.wsUnl.d7, k_mine: () => G.S.wsUnl.d7, k_orb: () => G.S.wsUnl.d5,
        pkg: () => G.S.wsUnl.u4, interest_max: () => G.S.wsUnl.u3, stun: () => G.S.cards.have.landMineStun, k_ray: () => G.S.cards.have.deathRay, k_nuke: () => G.S.cards.have.nuke,
        net: () => G.S.cards.have.energyNet, shield: () => G.S.cards.have.energyShield, k_demon: () => G.S.cards.have.demonMode, skip: () => G.S.cards.have.waveSkip || G.S.cards.have.introSprint,
        sm_same_max: () => G.S.uw.own.sm, k_sl: () => G.S.uw.own.sl, k_gt: () => G.S.uw.own.gt, k_ilm: () => G.S.uw.own.ilm, k_dw: () => G.S.uw.own.dw, k_cf: () => G.S.uw.own.cf,
        bh_max: () => G.S.uw.own.bh, poison: () => G.S.uw.own.ps, h_ilm: () => G.S.uw.own.ilm, k_sm: () => G.S.uw.own.sm, h_cl: () => G.S.uw.own.cl, h_dw: () => G.S.uw.own.dw,
        free_up: () => G.S.wsUnl.u2, crit: () => true, boss_far: () => true, wave_max: () => true,
    };
    D.EVENT_MISSIONS = W.eventMissions.filter(m => EV_STAT[m[0]]).map(([text, a, b, c]) => {
        const stat = EV_STAT[text];
        return { stat, text, goals: [evNum(a), evNum(b), evNum(c)], always: ['login', 'tourney', 'card_buy', 'free_gems', 'lab_time'].includes(stat), need: EV_NEEDS[stat] };
    });
    D.EVENT_MEDALS = [10, 15, 20];
    D.EVENT_RELIC_AT = [350, 700, 550, 1100]; // free, free, premium, premium
    D.TRADE_PRICE = [40, 65, 90, 130, 175, 230, 380];
    D.EVENT_BOOST_GEMS = 1000; // the real Event Boost costs money

    /* =====================================================================
       RELICS
       ===================================================================== */
    const RELIC_STAT = [
        [/lab speed/i, 'labSpeed'], [/bot range/i, 'botRange'], [/ultimate damage|ultimate weapon damage/i, 'uwDamage'], [/super crit(ical)? chance/i, 'scChance'],
        [/super crit(ical)? mult/i, 'scMult'], [/rend armor mult/i, 'rendMult'], [/critical chance|crit chance/i, 'critChance'], [/critical factor|crit factor/i, 'critFactor'],
        [/damage ?\/ ?meter|damage per meter/i, 'dpm'], [/attack speed/i, 'attackSpeed'], [/health regen/i, 'regen'], [/defense percent|defense %/i, 'defPct'],
        [/defense absolute/i, 'defAbs'], [/thorn/i, 'thorns'], [/knockback/i, 'kbForce'], [/orb speed/i, 'orbSpeed'], [/wall rebuild/i, 'wallRebuild'],
        [/cash/i, 'cash'], [/free attack/i, 'freeAtk'], [/free defense/i, 'freeDef'], [/free utility/i, 'freeUtil'], [/recovery amount/i, 'pkgAmount'],
        [/attack level skip/i, 'skipAtk'], [/health level skip/i, 'skipHp'], [/coin/i, 'coins'], [/health/i, 'health'], [/damage/i, 'damage'],
    ];
    D.RELICS = W.relics.map((r, i) => {
        const stat = (RELIC_STAT.find(([re]) => re.test(r.desc)) || [null, null])[1];
        const m = r.desc.match(/(\d+\.?\d*)\s*(%|m|s)?/);
        const raw = m ? parseFloat(m[1]) : 0;
        const val = m && m[2] === '%' ? raw / 100 : raw;
        let src = 'other', key = null;
        let mm;
        if ((mm = r.src.match(/Milestone: Beat wave 4500 in\s+tier (\d+)/i))) { src = 'milestone'; key = +mm[1]; }
        else if ((mm = r.src.match(/Event( Premium)?: Earn (\d+) medals during\s+(?:the\s+)?"(.+?)"/i))) { src = 'event'; key = { name: mm[3], medals: +mm[2], premium: !!mm[1] }; }
        else if ((mm = r.src.match(/Purchase: (\d+) medals during the "(.+?)"/i))) { src = 'eventshop'; key = { name: mm[2], medals: +mm[1] }; }
        else if ((mm = r.src.match(/Guild: Spend (\d+) tokens/i))) { src = 'guild'; key = { cost: +mm[1], season: +((r.src.match(/Season (\d+)/i) || [0, 1])[1]) }; }
        else if (/Anniversary/i.test(r.src)) src = 'gift';
        else if ((mm = r.src.match(/Tournament: (.*)/i))) { src = 'tourney'; key = mm[1]; }
        else if ((mm = r.src.match(/Play for (\d+) years?/i))) { src = 'years'; key = +mm[1]; }
        return { id: 'r' + i, name: r.name, rarity: r.rarity, desc: r.desc, srcText: r.src, stat, val, src, key };
    });
    D.RELIC_BY = Object.fromEntries(D.RELICS.map(r => [r.id, r]));
    // Event names in the order they appear in the relic list; the offline event calendar cycles through them.
    D.EVENTS = [];
    for (const r of D.RELICS) if (r.src === 'event' && !D.EVENTS.includes(r.key.name)) D.EVENTS.push(r.key.name);

    /* =====================================================================
       VAULT (keys from Legend / Mythic tournaments)
       ===================================================================== */
    const VPOW = [10, 20, 40, 70, 110];
    const vp = (id, name, step, unit, stat) => ({ id, name, costs: VPOW, step, unit, stat });
    D.VAULT = [
        { sec: 'Gameplay', unlock: 0, items: [
            { id: 'autoRestart', name: 'Auto Restart Run', costs: [20], desc: 'Automatically restart battles after being defeated' },
            { id: 'adStack', name: 'Ad Gem Stack', costs: [10, 20, 40, 60], desc: 'Free ad gems can stack up to 2×, 3×, 4×, 5×' },
        ] },
        { sec: 'Cards', unlock: 5, items: [
            { id: 'cardSlot', name: 'Additional Card Slot', costs: [5, 10, 20, 40, 60, 80], desc: '+1 card slot' },
            { id: 'demonAuto', name: 'Demon Mode Automation', costs: [10, 25], desc: 'Demon Mode fires when ready; level 2 also fires it to save the tower' },
            { id: 'nukeAuto', name: 'Nuke Automation', costs: [10, 25], desc: 'Nuke fires when ready; level 2 also fires it to save the tower' },
        ] },
        { sec: 'Ultimate Weapons', unlock: 5, items: [{ id: 'barrageAuto', name: 'Missile Barrage Automation', costs: [10, 25], desc: 'Missile Barrage fires when ready; level 2 fires it when the tower is hit' }] },
        { sec: 'Modules', unlock: 5, items: [
            { id: 'rerollDisc', name: 'Module Reroll Discount', costs: [5, 10, 15, 20, 25, 30, 35, 40], desc: '2.5% cheaper module rerolls per level' },
            { id: 'freeMissionReroll', name: 'Free Mission Reroll', costs: [15], desc: 'Rerolling a daily mission costs no gems' },
        ] },
        { sec: 'Bots', unlock: 10, items: [{ id: 'botRange', name: 'Bot Range', costs: [10, 20, 30, 40], desc: '+2m range to bots per level' }] },
        { sec: 'Power · Attack', unlock: 25, items: [vp('v_damage', 'Damage', 0.05, '%', 'damage'), vp('v_as', 'Attack Speed', 0.05, '%', 'attackSpeed'), vp('v_cc', 'Critical Chance', 0.01, '%+', 'critChance'),
            vp('v_cf', 'Critical Factor', 0.05, '%', 'critFactor'), vp('v_dpm', 'Damage / Meter', 0.05, '%', 'dpm'), vp('v_ms', 'Multishot Chance', 0.04, '%', 'msChance'),
            vp('v_rf', 'Rapid Fire Chance', 0.04, '%', 'rfChance'), vp('v_bs', 'Bounce Shot Chance', 0.04, '%', 'bsChance'), vp('v_scc', 'Super Critical Chance', 0.02, '%+', 'scChance'),
            vp('v_scm', 'Super Critical Multiplier', 0.05, '%', 'scMult')] },
        { sec: 'Power · Defense', unlock: 25, items: [vp('v_hp', 'Health', 0.05, '%', 'health'), vp('v_regen', 'Health Regen', 0.05, '%', 'regen'), vp('v_defabs', 'Defense Absolute', 0.05, '%', 'defAbs'),
            vp('v_thorn', 'Thorn Damage', 0.05, '%', 'thorns'), vp('v_kbf', 'Knockback Force', 0.05, '%', 'kbForce'), vp('v_orbspd', 'Orb Speed', 0.05, '%', 'orbSpeed'),
            vp('v_dd', 'Death Defy', 0.02, '%+', 'deathDefy'), vp('v_wall', 'Wall Health', 0.05, '%', 'wallHealth')] },
        { sec: 'Power · Utility', unlock: 25, items: [vp('v_cash', 'Cash Bonus', 0.05, '%', 'cashBonus'), { id: 'v_cw', name: 'Cash / Wave', costs: VPOW, step: 1, unit: '%', stat: 'cashWave' },
            vp('v_ck', 'Coins / Kill', 0.05, '%', 'coinKill'), { id: 'v_cwave', name: 'Coins / Wave', costs: VPOW, step: 1, unit: '%', stat: 'coinWave' },
            vp('v_fa', 'Free Attack Upgrade', 0.05, '%', 'freeAtk'), vp('v_fd', 'Free Defense Upgrade', 0.05, '%', 'freeDef'), vp('v_fu', 'Free Utility Upgrade', 0.05, '%', 'freeUtil'),
            { id: 'v_int', name: 'Interest / Wave', costs: VPOW, step: 1, unit: '%', stat: 'interest' }, vp('v_ra', 'Recovery Amount', 0.05, '%', 'pkgAmount')] },
        { sec: 'Power · Ultimate Weapons', unlock: 25, items: [{ id: 'v_uw', name: 'Ultimate Damage', costs: [5, 10, 20, 35, 55], step: 0.05, unit: '%', stat: 'uwDamage' },
            vp('v_gtb', 'Golden Tower Bonus', 0.01, '%', 'gtBonus'), vp('v_bhs', 'Black Hole Size', 0.05, '%', 'bhSize')] },
    ];

    /* =====================================================================
       COSMETICS (each owned theme adds a little to coins, like the real game)
       ===================================================================== */
    D.SKINS = [
        { id: 'classic', n: 'Classic', fill: '#060a1e', edge: '#4d9bff', glow: '#3d8cff', sides: 6 },
    ];
    // milestone skins (tier -> name) at wave 2,500
    const MS_SKIN_COLS = ['#f43f5e', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
        '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#0ea5e9', '#e11d48', '#65a30d', '#7c3aed', '#0891b2', '#be185d', '#ca8a04', '#4f46e5'];
    for (const t in D.MILESTONES) {
        const m = D.MILESTONES[t].find(x => x.wave === 2500);
        const name = m && (m.std.match(/^(.*?)\s*Skin$/i) || [])[1] || (m && /skin/i.test(m.prem) ? m.prem.replace(/\s*Skin$/i, '') : (m && m.std === 'Eclipse' ? 'Eclipse' : null));
        if (name) D.SKINS.push({ id: 'ms' + t, n: name, fill: '#111827', edge: MS_SKIN_COLS[t - 1], glow: MS_SKIN_COLS[t - 1], sides: 3 + (t % 6), src: 'milestone', tier: +t });
    }
    D.SONGS = [{ id: 'song1', n: 'Synth Sunrise' }, { id: 'song2', n: 'Orbital Lullaby' }, { id: 'song3', n: 'Wave 10,000' }];

    /* =====================================================================
       AUTOPILOT (kept from the earlier version of this game; bought with coins)
       ===================================================================== */
    D.AUTOS = [
        { id: 'buy', ic: '🛒', n: 'Auto-buyer', price: 2500, desc: 'Buys battle upgrades for you, cheapest first. Pick categories and skip upgrades you don\'t want.' },
        { id: 'perk', ic: '🎴', n: 'Perk autopick', price: 1500, desc: 'Picks wave perks for you, even before the Auto Pick Perks lab.' },
        { id: 'restart', ic: '🔁', n: 'Auto-restart', price: 4000, desc: 'When the tower falls, a fresh run starts on the same tier.' },
        { id: 'bg', ic: '🌙', n: 'Night shift', price: 2000, desc: 'Keeps fighting while the tab is hidden, catching up on the time you were away (up to 30s at a time).' },
        { id: 'lab', ic: '🧪', n: 'Lab assistant', price: 6000, desc: 'Starts the cheapest research you can afford whenever a lab is free.' },
        { id: 'claim', ic: '📬', n: 'Mailroom', price: 1000, desc: 'Claims finished missions, milestones and chests automatically.' },
        { id: 'gems', ic: '💎', n: 'Gem magnet', price: 25000, desc: 'Collects floating gems and free ad gems for you.' },
    ];
})();
