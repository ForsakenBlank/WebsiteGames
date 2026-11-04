/* The Tower — the battle: waves, enemies, the tower's attacks, ultimate weapons, cards, bots and the guardian.
   Distances are in meters with the tower at (0, 0). Time is game time (scaled by game speed). */
(() => {
    const G = window.TG, D = G.D;
    const B = G.B = {};
    const TOWER_R = 3, WALL_R = 9, BASE_SPEED = 5, SPAWN_D = 105;
    let run = null, uid = 1;
    // the active battle (null once it has ended); B.lastRun() keeps the finished one for the summary
    G.run = () => (run && !run.over ? run : null);
    B.lastRun = () => run;
    B.TOWER_R = TOWER_R; B.WALL_R = WALL_R;

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const dist0 = (e) => Math.hypot(e.x, e.y);
    const S = () => G.S;
    // per-run caches: module uniques and UW stats only change when stats are recalculated
    const U = (name) => { if (!run || run.over) return G.unique(name); const c = run.uq || (run.uq = {}); return name in c ? c[name] : (c[name] = G.unique(name)); };
    const UWS = (id, i, r) => { if (!run || run.over) return G.uwStat(id, i, r); const c = run.uwc || (run.uwc = {}); const k = id + i; return k in c ? c[k] : (c[k] = G.uwStat(id, i, r || run)); };

    /* ======================================================================
       START / END
       ====================================================================== */
    B.start = (opts = {}) => {
        const s0 = S();
        const tour = !!opts.tour;
        run = {
            id: Date.now(), tier: tour ? D.LEAGUES[s0.tour.league].tier : (opts.tier || s0.tier), tour, league: tour ? s0.tour.league : null, diss: opts.diss || null,
            t: 0, wave: 1, waveT: 0, hpWave: 1, atkWave: 1, accH: 0, accA: 0, spawnAcc: 0, sched: [],
            cash: 0, coins: 0, cells: 0, rerolls: 0, lv: {}, extra: {}, perks: {}, perkList: [], perkNext: 0, offers: [], perkCount: 0,
            hp: 1, maxHp: 1, shield: 0, shieldT: 0, wall: null, inv: 0, dmgTaken: 0, berserk: 0,
            enemies: [], shots: [], eshots: [], mines: [], missiles: [], swamps: [], holes: [], ilms: [], waves: [], beams: [], floaters: [], packages: [], electrons: [],
            uw: {}, bots: {}, chips: {}, cards: {}, tempUW: {}, uwOff: Object.assign({}, s0.uw.off),
            fireT: 0, rapid: 0, swT: 0, rayT: 11, superT: 30, superOn: 0, demon: 0, demonUsed: false, demonRecharge: 0, nukeUsed: false, nukeRecharge: 0, sw: false, swRecharge: 0,
            barrageUsed: false, barrageRecharge: 0, spotA: 0, gtOn: 0, gtKills: 0, gtCombo: 0, gtComboT: 0, cfOn: 0, dwPool: 0,
            sprint: 0, gemT: 0, gem: null, gemsThisRun: 0, noDmgWaves: 0, maxIntStreak: 0, freeThisWave: 0, pfCash: 0, amp: 0, restore: 0,
            stats: { kills: 0, bosses: 0, elites: 0, killsBy: {}, damage: 0, coins: 0, cash: 0, perks: 0, freeUps: 0, skips: 0, pkg: 0, crits: 0, bestHit: 0 },
            speed: Math.min(s0.settings.speed || 1, G.stats(null).maxSpeed), paused: false, over: false, autoBuyT: 0,
        };
        // starting state
        recalc();
        run.cash = run.s.startCash;
        run.maxHp = run.hp = run.s.health;
        run.shield = G.cardOn('energyShield') ? 1 + G.labV('Energy_Shield') : 0;
        if (run.s.wallOn) run.wall = { hp: run.s.wallHealth * run.maxHp, max: run.s.wallHealth * run.maxHp, rebuild: 0 };
        if (run.diss !== 'uw') for (const u of D.UWS) if (G.uwLv(u.id)) run.uw[u.id] = { t: uwCooldown(u.id) };
        for (const b of D.BOTS) if (s0.bots.own[b.id] && s0.bots.on[b.id] !== false) run.bots[b.id] = { t: botStat(b.id, 1) * 0.5, on: 0, x: 0, y: -20, tx: 0, ty: -20 };
        if (G.guardianActive()) for (const id of s0.guardian.eq) if (id) run.chips[id] = { t: chipStat(id, 'cd'), on: 0 };
        run.perkNext = tour ? Infinity : perkWaveReq(0);
        if (G.cardOn('introSprint') && !tour) run.sprint = Math.min(G.card('introSprint') * (G.mastery('introSprint', 1) || 1), s0.tierBest[run.tier] || 0);
        if (!opts.resume) {
            s0.stats.runs++;
            s0.runsOnTier[run.tier] = (s0.runsOnTier[run.tier] || 0) + 1;
            G.count('battles', 1);
            G.emit('runStart', run);
            startWave(true);
        }
        return run;
    };

    B.resume = (snap) => {
        B.start({ tour: snap.tour, tier: snap.tier, diss: snap.diss, resume: true });
        Object.assign(run, { wave: snap.wave, hpWave: snap.hpWave, atkWave: snap.atkWave, cash: snap.cash, lv: snap.lv, extra: snap.extra || {}, perks: snap.perks,
            perkList: snap.perkList, perkNext: snap.perkNext, perkCount: snap.perkCount || 0, t: snap.t, tempUW: snap.tempUW || {}, coins: snap.coins || 0, cells: snap.cells || 0,
            stats: Object.assign(run.stats, snap.stats || {}), demonUsed: snap.demonUsed, nukeUsed: snap.nukeUsed, sw: snap.sw, id: snap.id || run.id });
        recalc();
        run.hp = run.maxHp * (snap.hpFrac || 1);
        run.sched = [];
        startWave(false, true);
    };

    function snapshot() {
        if (!run || run.over) return;
        S().run = {
            id: run.id, tour: run.tour, tier: run.tier, diss: run.diss, wave: run.wave, hpWave: run.hpWave, atkWave: run.atkWave, cash: run.cash, lv: run.lv, extra: run.extra,
            perks: run.perks, perkList: run.perkList, perkNext: run.perkNext, perkCount: run.perkCount, t: run.t, tempUW: run.tempUW, coins: run.coins, cells: run.cells,
            stats: run.stats, hpFrac: run.hp / run.maxHp, demonUsed: run.demonUsed, nukeUsed: run.nukeUsed, sw: run.sw,
        };
        G.saveSoon();
    }

    B.end = (reason) => {
        if (!run || run.over) return;
        run.over = true;
        const r = run, s0 = S();
        s0.run = null;
        s0.stats.timePlayed += r.t;
        if (!r.tour) {
            const best = s0.tierBest[r.tier] || 0;
            if (r.wave > best) s0.tierBest[r.tier] = r.wave;
        }
        G.emit('runEnd', r, reason);
        G.save();
        if (window.Arcade && Arcade.report) Arcade.report('wave', r.wave);
    };

    /* ======================================================================
       STATS, COSTS AND BUYING IN BATTLE
       ====================================================================== */
    function recalc() {
        run.uq = {}; run.uwc = {};
        // Bot+ abilities (Maximum Power from Bot Bot boosts the others)
        const mp = G.botPlus('botbot') || 1;
        run.bp = { flame: (G.botPlus('flame') || 0) * mp, thunder: (G.botPlus('thunder') || 0) * mp, golden: (G.botPlus('golden') || 0) * mp, amplify: G.botPlus('amplify') || 0 };
        const old = run.maxHp;
        run.s = G.stats(run);
        run.maxHp = run.s.health;
        if (old > 0 && run.maxHp !== old) run.hp = run.hp * run.maxHp / old;
        if (run.wall) { const m = run.s.wallHealth * run.maxHp; run.wall.hp = run.wall.max ? run.wall.hp * m / run.wall.max : m; run.wall.max = m; }
        else if (run.s.wallOn) run.wall = { hp: run.s.wallHealth * run.maxHp, max: run.s.wallHealth * run.maxHp, rebuild: 0 };
    }
    B.recalc = () => run && recalc();
    const wsDiscount = (cat) => G.labV({ attack: 'Workshop_Attack_Discount', defense: 'Workshop_Defense_Discount', utility: 'Workshop_Utility_Discount' }[cat]);
    B.runCost = (id, n = 1) => {
        const u = D.UPG_BY[id];
        // battle prices follow the upgrade's total level (workshop + battle)
        let c = 0, L = G.totalLv(id, run);
        for (let i = 0; i < n; i++) c += D.cashCost(u.cost(L + i + 1));
        return c;
    };
    B.runMax = (id) => { const u = D.UPG_BY[id]; return Math.max(0, u.max - G.wsLv(id) - (run.lv[id] || 0)); };
    B.canBuy = (id) => G.unlocked(D.UPG_BY[id]) && B.runMax(id) > 0 && !catDisabled(D.UPG_BY[id].cat);
    const catDisabled = (cat) => run && run.diss === cat;
    B.catDisabled = catDisabled;
    B.buy = (id, mult) => {
        if (!run || !B.canBuy(id)) return 0;
        let n = mult === 'max' ? Infinity : mult;
        let bought = 0;
        n = Math.min(n, B.runMax(id));
        while (bought < n) {
            const c = B.runCost(id, 1);
            if (run.cash < c) break;
            run.cash -= c;
            run.lv[id] = (run.lv[id] || 0) + 1;
            bought++;
        }
        if (bought) { recalc(); G.count('battle_buy', bought); S().stats.battleUpgrades += bought; }
        return bought;
    };

    /* ======================================================================
       WAVES
       ====================================================================== */
    const coolLen = () => D.WAVE_COOL * (run.tour ? 0.5 : 1) * (1 - G.card('waveAccelerator', 0));
    const bossEvery = () => {
        let n = D.bossEvery(run.tier, run.tour ? run.league : null);
        return run.sprint > 0 ? 1 : n;
    };
    const isBossWave = (w) => w % bossEvery() === 0;

    function startWave(first, resumed) {
        const w = run.wave, s = run.s;
        run.waveT = 0;
        run.spawnAcc = 0;
        run.sched = [];
        // bosses come at the start of their wave
        if (isBossWave(w)) run.sched.push([0.5, 'boss']);
        // one protector every few waves from tier 2
        if (run.tier >= 2 && w >= 10 && w % D.protectorEvery(run.tier) === 0) run.sched.push([G.rand(2, 20), 'protector']);
        // elites
        const ec = D.eliteChance(run.tour ? D.LEAGUES[run.league].tier : run.tier, w);
        let ne = (Math.random() < ec.one ? 1 : 0) + (Math.random() < ec.two ? 1 : 0);
        for (let i = 0; i < ne; i++) {
            run.sched.push([G.rand(1, D.WAVE_LEN - 2), G.pick(D.ELITES)]);
            if (Math.random() < G.mastery('enemyBalance', 0)) run.sched.push([G.rand(1, D.WAVE_LEN - 2), 'elite_same']);
        }
        // fleets on high tiers (simplified from the wiki's fleet table)
        const ft = D.FLEET[run.tier];
        if (ft && w >= ft[0] && (w - ft[0]) % ft[1] === 0) run.sched.push([G.rand(2, 18), 'fleet']);
        run.sched.sort((a, b) => a[0] - b[0]);
        if (!first && !resumed) {
            // coins / wave are paid at the start of every wave from wave 2 (none while sprinting)
            if (run.sprint <= 0 && run.diss !== 'utility') giveCoins(s.coinWave * s.coinMult, null, 'wave');
            // recovery packages
            if (Math.random() < s.pkgChance || (run.lastWasBoss && G.labDone('Package_After_Boss'))) givePackage();
        }
        run.lastWasBoss = isBossWave(w);
        // perks
        if (!run.tour && G.labDone('Unlock_Perks') && w >= run.perkNext) {
            run.perkCount++;
            run.perkNext = w + perkWaveReq(run.perkCount);
            run.offers.push(makeOffer());
            G.emit('perkReady');
        }
        // floating gem
        maybeGem();
        // Not in the real game: +1 gem every 200 waves of a run, up to wave 1000
        if (!first && !resumed && !run.tour && w % 200 === 0 && w <= 1000) { G.add('gems', 1, 'wave'); G.toast(`💎 +1 gem for reaching wave ${w}`, 'good', 1500); }
        if (!resumed) snapshot();
        G.emit('wave', w);
    }

    function endWave() {
        const s = run.s;
        // cash / wave and interest (cash bonus applies to wave cash)
        if (run.diss !== 'utility') {
            const cw = s.cashWave * s.cashBonus;
            addCash(cw);
            const inter = Math.min(s.maxInterest, run.cash * s.interest);
            addCash(inter);
            if (inter >= s.maxInterest - 0.01 && s.interest > 0) { run.maxIntStreak++; G.countMax('interest_max', run.maxIntStreak); } else run.maxIntStreak = 0;
        }
        // free upgrades, once per category per completed wave
        freeUpgrades();
        // deterministic enemy level skips
        levelSkips();
        if (run.wave > 0) G.count('waves', 1);
        S().stats.waves++;
        run.noDmgWaves = run.tookDmg ? 0 : run.noDmgWaves + 1;
        run.tookDmg = false;
        G.countMax('nodmg_max', run.noDmgWaves);
        // advance
        let jump = 1;
        if (run.sprint > 0 && run.wave < run.sprint) jump = 10;
        else {
            run.sprint = 0;
            // wave skip card: each success rolls again
            const ws = G.card('waveSkip', 0);
            if (ws && run.wave > 1) while (Math.random() < ws && jump < 50) { jump++; if (Math.random() < G.mastery('waveSkip', 0)) jump++; }
        }
        for (let i = 1; i < jump; i++) {
            // skipped waves pay their wave rewards and repeat this wave's kill income ×1.1
            freeUpgrades(); levelSkips();
            if (run.diss !== 'utility') {
                addCash(s.cashWave * s.cashBonus + (run.waveCash || 0) * 1.1);
                if (run.sprint <= 0) giveCoins(s.coinWave * s.coinMult + (run.waveCoins || 0) * 1.1, null, 'skip');
            }
            run.stats.skips++; S().stats.skips++; G.count('skip', 1);
        }
        run.waveCash = 0; run.waveCoins = 0;
        run.wave += jump;
        G.countMax('wave_max', run.wave);
        startWave(false);
    }
    B.waveProgress = () => run ? Math.min(1, run.waveT / (D.WAVE_LEN + coolLen())) : 0;

    function levelSkips() {
        const s = run.s;
        run.accH += s.skipHp; run.accA += s.skipAtk;
        if (run.accH >= 1) { run.accH -= 1; G.count('lvlskip', 1); } else run.hpWave++;
        if (run.accA >= 1) { run.accA -= 1; G.count('lvlskip', 1); } else run.atkWave++;
    }

    function freeUpgrades() {
        const s = run.s;
        let got = 0;
        for (const [cat, p0] of [['attack', s.freeAtk], ['defense', s.freeDef], ['utility', s.freeUtil]]) {
            let p = p0;
            while (p > 0) {
                if (p >= 1 || Math.random() < p) {
                    // Infinity Threshold lets free upgrades push damage, health and regen past their max
                    const it = U('Infinity Threshold');
                    const past = (u) => it && ['damage', 'health', 'regen'].includes(u.id) && (run.extra[u.id] || 0) < it;
                    const pool = D.UPG.filter(u => u.cat === cat && G.unlocked(u) && (B.runMax(u.id) > 0 || past(u)));
                    if (pool.length) {
                        const u = G.pick(pool);
                        if (B.runMax(u.id) <= 0) run.extra[u.id] = (run.extra[u.id] || 0) + 1;
                        run.lv[u.id] = (run.lv[u.id] || 0) + 1;
                        got++;
                    }
                }
                p -= 1;
            }
        }
        if (got) { run.stats.freeUps += got; S().stats.freeUps += got; G.count('free_up', got); run.freeThisWave = got; recalc(); }
        else run.freeThisWave = 0;
    }

    /* ======================================================================
       PERKS
       ====================================================================== */
    function perkWaveReq(n) {
        const base = n >= 40 ? 350 : n >= 30 ? 300 : n >= 20 ? 250 : 200;
        const red = run ? G.perkAdd(run, 'perkWaves') : 0;
        return Math.max(1, Math.floor((base + G.labV('Waves_Required')) * (1 - red)));
    }
    B.perkWaveReq = (n) => perkWaveReq(n);

    function perkAvailable(p) {
        if ((run.perks[p.id] || 0) >= p.q) return false;
        if (S().perks.bans.includes(p.id)) return false;
        if (p.req && !S().wsUnl[p.req]) return false;
        if (p.id === 'randomUW' && D.UWS.every(u => G.uwLv(u.id) || run.tempUW[u.id])) return false;
        return true;
    }
    function makeOffer() {
        const n = 2 + (G.labV('Perk_Option_Quantity') || 0);
        const offer = [];
        const stdPool = D.PERKS.filter(perkAvailable);
        const uwPool = D.UW_PERKS.filter(p => (G.uwLv(p.uw) || run.tempUW[p.uw]) && !run.perks[p.id] && !S().perks.bans.includes(p.id));
        const tradePool = D.TRADE_PERKS.filter(p => !run.perks[p.id] && !S().perks.bans.includes(p.id));
        const used = new Set();
        // first perk choice is guaranteed in the first offer
        if (run.perkCount === 1 && S().perks.first && G.labDone('First_Perk_Choice')) {
            const p = stdPool.find(x => x.id === S().perks.first);
            if (p) { offer.push({ kind: 'std', id: p.id }); used.add(p.id); }
        }
        let guard = 0;
        while (offer.length < n && guard++ < 50) {
            const r = Math.random();
            const uwOk = uwPool.some(p => !used.has(p.id));
            let kind = uwOk ? (r < 0.2 ? 'uw' : r < 0.32 ? 'trade' : 'std') : (r < 0.15 ? 'trade' : 'std');
            const pool = kind === 'uw' ? uwPool : kind === 'trade' ? tradePool : stdPool;
            const left = pool.filter(p => !used.has(p.id));
            if (!left.length) continue;
            const p = G.pick(left);
            used.add(p.id);
            const o = { kind, id: p.id };
            if (p.id === 'randomUW') o.uw = G.pick(D.UWS.filter(u => !G.uwLv(u.id) && !run.tempUW[u.id])).id;
            offer.push(o);
        }
        return offer;
    }
    B.perkText = (o) => {
        const spb = G.labV('Standard_Perk_Bonus');
        if (o.kind === 'std') {
            const p = D.PERKS.find(x => x.id === o.id);
            if (p.id === 'randomUW') return `Unlock ${D.UW_BY[o.uw].name}`;
            const v = p.kind === 'm' ? +(1 + p.v * (1 + spb)).toFixed(2) : p.v * (p.kind === 'a' && p.id !== 'bounce' && p.id !== 'orbs' ? 1 + spb : 1);
            return p.name(v);
        }
        if (o.kind === 'uw') return D.UW_PERKS.find(x => x.id === o.id).name;
        const t = D.TRADE_PERKS.find(x => x.id === o.id), b = G.labV('Improve_Trade-Off_Perks');
        return t.name(t.fixed ? t.v : t.half ? t.v * (1 + b / 2) : t.v * (1 + b));
    };
    B.pickPerk = (i) => {
        const offer = run.offers[0];
        if (!offer || !offer[i]) return;
        const o = offer[i];
        run.perks[o.id] = (run.perks[o.id] || 0) + 1;
        run.perkList.push(B.perkText(o));
        if (o.id === 'randomUW') { run.tempUW[o.uw] = { vals: D.UW_PERK[o.uw].slice() }; run.uw[o.uw] = { t: 5 }; }
        if (o.id === 'gameSpeed') run.speedBonus = true;
        run.offers.shift();
        run.stats.perks++;
        recalc();
        G.emit('perkPicked', o);
    };
    B.autoPick = () => {
        const offer = run.offers[0];
        if (!offer) return;
        const rank = S().perks.rank;
        let best = 0, bestR = Infinity;
        offer.forEach((o, i) => { const r = rank.indexOf(o.id); if (r >= 0 && r < bestR) { bestR = r; best = i; } });
        if (bestR === Infinity) {
            // no ranking: prefer standard perks in a sensible order
            const pref = ['damage', 'health', 'coins', 'regen', 'defAbs', 'cash', 'free', 'defPct', 'perkWaves', 'gameSpeed', 'randomUW', 'bounce', 'orbs', 'interest', 'landMine'];
            let bi = Infinity;
            offer.forEach((o, i) => { const r = o.kind === 'std' ? pref.indexOf(o.id) : o.kind === 'uw' ? 5.5 : 99; if (r >= 0 && r < bi) { bi = r; best = i; } });
        }
        B.pickPerk(best);
    };

    /* ======================================================================
       SPAWNING
       ====================================================================== */
    const enemyLab = (type) => {
        const L = (id) => 1 + G.labV(id);
        switch (type) {
            case 'basic': return [L('Common_Enemy_Health'), L('Common_Enemy_Attack')];
            case 'fast': return [L('Fast_Enemy_Health'), L('Fast_Enemy_Attack')];
            case 'tank': return [L('Tank_Enemy_Health'), L('Tank_Enemy_Attack')];
            case 'ranged': return [L('Ranged_Enemy_Health'), L('Ranged_Enemy_Attack')];
            case 'boss': return [L('Boss_Health'), L('Boss_Attack')];
            case 'protector': return [L('Protector_Health'), 1];
            case 'vampire': return [L('Vampire_Enemy_Defense'), L('Vampire_Enemy_Attack')];
            case 'ray': return [L('Ray_Enemy_Health'), L('Ray_Enemy_Attack')];
            case 'scatter': return [L('Scatter_Enemy_Health'), L('Scatter_Enemy_Attack')];
            default: return [1, 1];
        }
    };
    const DMG_TYPE = { basic: 1, fast: 0.8, tank: 1.5, ranged: 1, protector: 0.5, boss: 2.5, vampire: 1, ray: 2, scatter: 1, saboteur: 0, commander: 0, overcharge: 1 };
    function spawn(type, at, hpScale = 1) {
        if (!run) return null;
        const def = D.ENEMY[type];
        const counts = run.counts || (run.counts = {});
        // on-screen limits
        if (def.elite && run.enemies.filter(e => e.type === type).length >= 8 && hpScale === 1) return null;
        if (type === 'boss' && run.enemies.filter(e => e.type === 'boss').length >= 10) return null;
        if (!def.elite && type !== 'boss' && !def.fleet && run.enemies.length >= 150) return null;
        const statTier = run.tour ? D.LEAGUES[run.league].tier : run.tier;
        const [lh, la] = enemyLab(type);
        let hp = D.enemyHp(statTier, run.hpWave, run.tour) * def.hp * lh * hpScale * bc('hp', type);
        let dmg = D.enemyDmg(statTier, run.atkWave, run.tour) * DMG_TYPE[type] * la;
        let spd = BASE_SPEED * def.spd * bc('speed');
        if (type === 'fast' && run.wave > 750) spd *= Math.min(3.9 / 2.1, 1 + (run.wave - 750) / 4000);
        if (type === 'fast') spd *= 1 + G.labV('Fast_Enemy_Speed');
        if (run.perks.t_ehp) hp *= 1 - G.trade(run, 't_ehp');
        if (run.perks.t_edmg) dmg *= 1 - G.trade(run, 't_edmg');
        if (run.perks.t_slow) { spd *= 1 - G.trade(run, 't_slow'); dmg *= 2.5; }
        if (type === 'boss') {
            if (run.perks.t_dmg) hp *= 8;
            if (run.perks.t_boss) { hp *= 1 - G.trade(run, 't_boss'); spd *= 1.5; }
        }
        if (type === 'ranged' && run.perks.t_ranged) dmg *= 3;
        if (type === 'overcharge') dmg = D.enemyDmg(statTier, 1, run.tour);
        const pos = at ? { x: at.x + G.rand(-1.5, 1.5), y: at.y + G.rand(-1.5, 1.5) } : spawnPoint();
        const e = {
            id: uid++, type, x: pos.x, y: pos.y, hp, maxHp: hp, dmg, spd, mass: def.mass, r: def.r, wave: run.wave, atkT: G.rand(0, 1), heat: 1,
            rend: 0, stun: 0, slow: 0, burn: 0, burnT: 0, shock: 0, dwHits: 0, marked: false, elite: !!def.elite, boss: type === 'boss', fleet: !!def.fleet,
            armor: bc('armor'), netted: false, plasma: false, sm: 0, bounty: 1, kbx: 0, kby: 0, charge: 0, gen: 0, dead: false, nmp: 0, acp: 0, mark: false,
        };
        if (U('Death Penalty') && !e.boss && !e.fleet && Math.random() < U('Death Penalty') / 100) e.mark = true;
        if (type === 'basic' && G.cardOn('criticalCoin') && Math.random() < G.card('criticalCoin')) e.critCoin = true;
        run.enemies.push(e);
        counts[type] = (counts[type] || 0) + 1;
        return e;
    }
    B.spawn = spawn;
    function spawnPoint() {
        const a = Math.random() * Math.PI * 2, d = spawnDist();
        return { x: Math.cos(a) * d, y: Math.sin(a) * d };
    }
    const spawnDist = () => Math.max(SPAWN_D, (run ? run.s.range : 30) + 12);
    B.spawnDist = () => run ? spawnDist() : SPAWN_D;

    function spawnNormal() {
        const mix = D.spawnMix(run.tour ? D.LEAGUES[run.league].tier : run.tier, run.wave);
        const r = Math.random();
        let type = 'basic';
        if (r < mix.fast) type = 'fast';
        else if (r < mix.fast + mix.tank) type = 'tank';
        else if (r < mix.fast + mix.tank + mix.ranged) type = 'ranged';
        spawn(type);
        if (type === 'basic' && G.cardOn('enemyBalance') && Math.random() < 0.8) spawn('basic');
    }

    /* ---------- battle conditions (tiers 14+ and tournaments) ---------- */
    // returns a multiplier/amount for the condition, growing with the wave up to its full strength at wave 1000
    function bc(kind, type) {
        if (!run) return kind === 'armor' ? 0 : 1;
        const lv = run.tour ? run.league : run.tier >= 14 ? run.tier - 13 : 0;
        if (!lv) return kind === 'armor' ? 0 : 1;
        const ramp = Math.min(1, run.wave / 1000) * (1 - G.labV('Battle_Condition_Reduction') / 100);
        switch (kind) {
            case 'hp': return 1;
            case 'speed': return 1 + 0.08 * lv * ramp;
            case 'armor': return run.tier >= 15 || run.league >= 3 ? Math.round(10 * Math.max(1, lv - 1) * ramp) : 0;
            case 'orb': return lv >= 1 ? 1 - 0.1 * Math.min(9, lv) * ramp : 1; // share of normal orb effect
            case 'thorn': return 1 - 0.1 * Math.min(9, lv) * ramp;
            case 'kb': return 1 - 0.1 * Math.min(9, lv) * ramp;
            case 'more': return 1 + 0.05 * lv * ramp;
            case 'atkspd': return 1 + 0.05 * lv * ramp;
            default: return 1;
        }
    }
    B.bc = bc;

    /* ======================================================================
       MAIN STEP
       ====================================================================== */
    B.step = (dt) => {
        if (!run || run.over || run.paused) return;
        const s = run.s;
        run.t += dt;
        run.waveT += dt;
        // spawns
        if (run.waveT <= D.WAVE_LEN) {
            run.spawnAcc += dt * D.spawnPerSec(run.tour ? D.LEAGUES[run.league].tier : run.tier, run.wave) * bc('more');
            while (run.spawnAcc >= 1) { run.spawnAcc -= 1; spawnNormal(); }
            while (run.sched.length && run.sched[0][0] <= run.waveT) {
                const [, what] = run.sched.shift();
                if (what === 'fleet') spawnFleet();
                else if (what === 'elite_same') spawn(G.pick(D.ELITES));
                else {
                    const e = spawn(what);
                    if (e && e.boss && run.sprint > 0) e.sprint = true;
                }
            }
        }
        if (run.waveT >= D.WAVE_LEN + coolLen()) endWave();
        // tower
        towerUpdate(dt);
        enemiesUpdate(dt);
        shotsUpdate(dt);
        orbsUpdate(dt);
        minesUpdate(dt);
        uwUpdate(dt);
        cardsUpdate(dt);
        botsUpdate(dt);
        chipsUpdate(dt);
        floatersUpdate(dt);
        if (run.gem) { run.gem.t += dt; run.gem.x += run.gem.vx * dt; run.gem.y += run.gem.vy * dt; if (Math.abs(run.gem.x) > 40) run.gem.vx *= -1; if (Math.abs(run.gem.y) > 40) run.gem.vy *= -1; if (G.apOn('gems')) B.tapGem(); }
        // remove dead
        if (run.deadCount) { run.enemies = run.enemies.filter(e => !e.dead); run.deadCount = 0; }
        if (run.hp <= 0 && !run.over) die();
    };

    function towerUpdate(dt) {
        const s = run.s;
        if (run.inv > 0) run.inv -= dt;
        // regen (vampires block it while draining)
        if (!run.vampDrain) heal(s.regen * dt, false);
        run.vampDrain = false;
        // wormhole redirector lets regen fill packages' overheal
        // energy shield charges
        if (G.cardOn('energyShield')) {
            const max = 1 + G.labV('Energy_Shield');
            if (run.shield < max) {
                run.shieldT += dt;
                if (run.shieldT >= G.card('energyShield') * 60 * bc('esdown')) { run.shield++; run.shieldT = 0; }
            }
        }
        // wall rebuild
        if (run.wall && run.wall.hp <= 0) {
            run.wall.rebuild -= dt;
            if (run.wall.rebuild <= 0) { run.wall.hp = run.wall.max; run.wall.inv = G.labV('Wall_Invincibility'); pushOut(WALL_R + 2); }
        } else if (run.wall && G.labV('Wall_Regen')) run.wall.hp = Math.min(run.wall.max * (1 + G.labV('Wall_Fortification')), run.wall.hp + s.regen * G.labV('Wall_Regen') * dt);
        if (run.wall && run.wall.inv > 0) run.wall.inv -= dt;
        // shockwave
        if (G.unlocked(D.UPG_BY.swSize) && run.diss !== 'defense') {
            run.swT += dt;
            if (run.swT >= s.swFreq) {
                run.swT = 0;
                const rad = s.swSize * 15;
                run.waves.push({ kind: 'sw', r: 0, max: rad, t: 0 });
                for (const e of run.enemies) if (!e.boss && !e.elite && !e.fleet && dist0(e) < rad) {
                    knock(e, 6 * s.swSize * bc('kb'));
                    if (U('Anti-Cube Portal')) e.acp = 7;
                }
            }
        }
        // berserker cap
        // attacking
        if (run.rapid > 0) run.rapid -= dt;
        if (run.disabled > 0) { run.disabled -= dt; return; }
        const rate = s.attackSpeed * (run.rapid > 0 ? 4 : 1) * (run.restore > 0 ? 1 + 0.5 * run.restore / 60 : 1);
        if (run.restore > 0) run.restore -= dt;
        run.fireT += dt;
        const interval = 1 / Math.max(0.05, rate);
        let guard = 0;
        while (run.fireT >= interval && guard++ < 40) {
            run.fireT -= interval;
            fire();
        }
        if (run.fireT > interval * 2) run.fireT = 0;
    }

    function targets(n, from = null, maxD = null, exclude = null) {
        const s = run.s, R = maxD || s.range, origin = from || { x: 0, y: 0 };
        const list = [];
        const pr = S().settings.target;
        for (const e of run.enemies) {
            if (e.dead || (exclude && exclude.has(e.id))) continue;
            const d = dist(e, origin);
            if (d <= R + e.r / 4) list.push([e, d]);
        }
        if (!list.length) return [];
        if (pr && pr !== 'closest' && G.labDone('Target_Priority')) list.sort((a, b) => ((b[0].type === pr) - (a[0].type === pr)) || a[1] - b[1]);
        else list.sort((a, b) => a[1] - b[1]);
        return list.slice(0, n).map(x => x[0]);
    }
    B.targets = targets;

    function fire() {
        const s = run.s;
        let n = 1;
        if (Math.random() < s.msChance) n = s.msTargets;
        const ts = targets(n);
        if (!ts.length) return;
        if (Math.random() < s.rfChance && run.rapid <= 0) run.rapid = s.rfDuration;
        for (const t of ts) shoot(t, 0, null, 0);
    }

    function shoot(target, bounces, from, hitsSoFar) {
        const s = run.s;
        const o = from || { x: 0, y: 0 };
        const shot = { x: o.x, y: o.y, tid: target.id, b: bounces, hits: hitsSoFar, spd: Math.min(400, 45 + 12 * s.attackSpeed), t: 0 };
        if (G.labDone('Light_Speed_Shots')) { shot.instant = true; shot.tx = target.x; shot.ty = target.y; }
        run.shots.push(shot);
    }

    function shotsUpdate(dt) {
        const keep = [];
        for (const sh of run.shots) {
            const t = run.enemies.find(e => e.id === sh.tid && !e.dead);
            if (!t) continue;
            if (sh.instant) { sh.fx = { x0: sh.x, y0: sh.y, x1: t.x, y1: t.y }; run.beams.push({ x0: sh.x, y0: sh.y, x1: t.x, y1: t.y, t: 0.08, col: 'shot' }); hit(t, sh); continue; }
            const d = dist(sh, t), step = sh.spd * dt;
            if (d <= step + t.r * 0.15) { hit(t, sh); continue; }
            sh.x += (t.x - sh.x) / d * step; sh.y += (t.y - sh.y) / d * step; sh.t += dt;
            if (sh.t < 4) keep.push(sh);
        }
        run.shots = keep;
        // enemy shots
        const keepE = [];
        for (const p of run.eshots) {
            const d = Math.hypot(p.x, p.y), step = p.spd * dt;
            if (d <= TOWER_R + step) { towerHit(p.dmg, p.src, 'ranged'); if (p.kind === 'over' && p.src && !p.src.dead) { p.src.dmg *= 1.4; } continue; }
            p.x -= p.x / d * step; p.y -= p.y / d * step;
            keepE.push(p);
        }
        run.eshots = keepE;
    }

    /* ---------- damage ---------- */
    function towerDamage(e, fromProjectile) {
        const s = run.s;
        let d = s.damage + berserkBonus();
        if (fromProjectile) {
            if (run.superOn > 0) d *= G.card('superTower', 1) * (G.labV('Super_Tower_Bonus') || 1);
            if (run.demon > 0) d *= 300;
            if (run.amp > 0) d *= 5;
            const pf = U('Project Funding');
            if (pf) d *= Math.max(1, 1 + Math.log10(Math.max(1, run.cash)) * pf / 100);
            d *= 1 + e.rend;
        }
        return d;
    }
    function berserkBonus() {
        if (!G.cardOn('berserker')) return 0;
        return Math.min(run.s.damage * 7, run.dmgTaken * G.card('berserker'));
    }
    function takenMult(e) {
        let m = 1;
        if (e.protected) m *= 0.6 - G.labV('Protector_Damage_Reduction');
        if (e.amped) m *= e.amped;
        if (e.spot) m *= e.spot;
        if (e.acp > 0) m *= U('Anti-Cube Portal');
        if (e.shock > 0) m *= e.shockM || 1;
        if (e.netBoost > 0) m *= G.mastery('energyNet', 1);
        if (e.burn > 0 && run.bp && run.bp.flame) m *= run.bp.flame;
        return m;
    }

    function hit(e, sh) {
        const s = run.s;
        if (e.dead) return;
        if (e.armor > 0) { e.armor--; return; }
        if (e.mark) { kill(e, 'tower'); return; }
        let d = towerDamage(e, true);
        const far = Math.floor(dist0(e) * (run.scout > 0 ? run.scoutM : 1));
        d *= 1 + s.dpm * far;
        let crit = false, sc = false;
        if (Math.random() < s.critChance) {
            crit = true; d *= s.critFactor; run.stats.crits++; G.count('crit', 1);
            if (run.forceSC > 0 || Math.random() < s.scChance) {
                sc = true; d *= s.scMult; G.count('supercrit', 1);
                if (run.forceSC > 0) run.forceSC--;
                else if (U('Being Annihilator')) run.forceSC = 5;
            }
        }
        if (sh && sh.b > 0 && U('Astral Deliverance')) d *= 1 + U('Astral Deliverance') / 100 * sh.b;
        d *= takenMult(e);
        if (e.amped && run.bp && run.bp.amplify) d *= run.bp.amplify; // Echoing Shot: each shot counts as several
        dealDamage(e, d, 'tower', crit);
        // lifesteal
        if (s.lifesteal > 0) heal(d * s.lifesteal, false);
        // rend armor
        if (s.rendChance > 0 && Math.random() < s.rendChance) {
            if (U('Havoc Bringer') && Math.random() < U('Havoc Bringer') / 100) e.rend = s.rendMax;
            else e.rend = Math.min(s.rendMax, e.rend + s.rendMult);
        }
        // knockback (bounced shots never push enemies toward the tower)
        if (!e.dead && !e.boss && !e.fleet && Math.random() < s.kbChance) { knock(e, s.kbForce * 2.2 * bc('kb')); G.count('knock', 1); }
        // pulsar harvester
        if (U('Pulsar Harvester') && Math.random() < U('Pulsar Harvester') / 100 && e.lvDown < 400) { e.lvDown = (e.lvDown || 0) + 1; e.maxHp *= 0.99; e.hp = Math.min(e.hp, e.maxHp); e.dmg *= 0.99; }
        // shrink ray
        if (U('Shrink Ray') && Math.random() < 0.01 && !e.shrunk) { e.shrunk = true; e.mass *= 1 - U('Shrink Ray') / 100; }
        // chain lightning
        if (run.uw.cl && !run.uwOff.cl && Math.random() < UWS('cl', 2, run)) chain(e);
        // bounce shot
        if (sh && Math.random() < s.bsChance && sh.b < s.bsTargets) {
            const exclude = new Set([e.id]);
            const next = targets(1, e, s.bsRange, exclude)[0];
            if (next) { shoot(next, sh.b + 1, { x: e.x, y: e.y }, sh.hits + 1); G.count('bounce', 1); }
        }
    }

    function uwDmg(id, statIdx = 0) {
        const s = run.s;
        let d = UWS(id, statIdx, run) * s.damage * s.avgCrit * s.uwDamage;
        if (run.superOn > 0 && G.mastery('superTower', null) !== null) d *= 1 + 0.35 * (G.card('superTower', 1) - 1);
        if (s.uwCritChance && Math.random() < s.uwCritChance) d *= s.critFactor;
        return d;
    }

    // all damage goes through here
    function dealDamage(e, d, cause, crit) {
        if (e.dead || d <= 0) return;
        e.hp -= d;
        run.stats.damage += d;
        if (d > run.stats.bestHit) run.stats.bestHit = d;
        if (S().settings.numbers && (crit || d > e.maxHp * 0.25) && run.floaters.length < 60) run.floaters.push({ x: e.x, y: e.y, t: 0, txt: G.fmt(d), col: crit ? '#fbbf24' : '#e2e8f0' });
        if (e.hp <= 0) kill(e, cause);
    }
    B.dealDamage = (e, d, c) => dealDamage(e, d, c);

    function knock(e, force) {
        const d = dist0(e) || 1;
        const push = force / Math.max(0.3, e.mass * Math.pow(1.04, run.wave - e.wave));
        e.x += e.x / d * push; e.y += e.y / d * push;
        const lim = spawnDist() + 5;
        const nd = dist0(e);
        if (nd > lim) { e.x *= lim / nd; e.y *= lim / nd; }
    }
    function pushOut(r) { for (const e of run.enemies) { const d = dist0(e); if (d < r) { const k = r / (d || 1); e.x *= k; e.y *= k; } } }

    /* ---------- killing ---------- */
    function kill(e, cause) {
        if (e.dead) return;
        e.dead = true;
        run.deadCount = (run.deadCount || 0) + 1;
        const s = run.s;
        run.stats.kills++;
        run.stats.killsBy[cause] = (run.stats.killsBy[cause] || 0) + 1;
        S().stats.kills++;
        const def = D.ENEMY[e.type];
        // rewards
        if (run.diss !== 'utility') {
            let cash = run.perks.t_cashwave ? 0 : D.cashValue(run.wave) * def.cash * s.cashBonus * G.card('enemyBalance', 1);
            let coins = def.coin * s.coinKill;
            if (e.critCoin) coins += 1 * s.coinKill * (Math.random() < G.mastery('criticalCoin', 0) ? 2 : 1);
            let cm = s.coinMult;
            if (run.gtOn > 0) { const b = UWS('gt', 0, run); cash *= b; cm *= b; run.gtKills++; }
            if (run.gtComboT > 0) { cash *= 1 + run.gtCombo; cm *= 1 + run.gtCombo; }
            if (e.golden) cm *= e.golden;
            if (e.inHole && G.labDone('Black_Hole_Coin_Bonus')) cm *= G.labV('Black_Hole_Coin_Bonus');
            if (e.spot && G.labDone('Spotlight_Coin_Bonus')) cm *= G.labV('Spotlight_Coin_Bonus');
            if (e.dwHits > 0) cm *= G.labV('Death_Wave_Coins_Bonus') || 1.5;
            if (e.bounty > 1) cm *= e.bounty;
            if (e.orbMark && G.mastery('extraOrb', null) !== null) cm *= G.mastery('extraOrb', 1);
            if (U('Black Hole Digestor') && run.freeThisWave) cm *= 1 + U('Black Hole Digestor') / 100 * run.freeThisWave;
            if (run.wave - e.wave >= 3) cm *= 0.5;
            if (run.summonOn > 0) cash *= run.summonCash;
            if (run.sprint > 0) coins = 0;
            addCash(cash);
            e.cashGot = cash; // the battlefield shows it as a '$' pop-up
            run.waveCash = (run.waveCash || 0) + cash;
            if (coins > 0) { const got = coins * cm; giveCoins(got, e, 'kill'); run.waveCoins = (run.waveCoins || 0) + got; }
        }
        // elite cells
        if (e.elite && e.gen === 0) {
            run.stats.elites++;
            const t = run.tour ? D.LEAGUES[run.league].tier : run.tier;
            let c = t <= 13 ? 1 + Math.floor(Math.random() * t) : 7 + Math.floor(Math.random() * 8);
            c *= (e.dwHits > 0 ? G.labV('Death_Wave_Cell_Bonus') || 1 : 1) * G.enh('cells') * (G.mastery('cells', 1) || 1);
            if (e.golden && run.bp && run.bp.golden) c *= run.bp.golden;
            if (run.sprint > 0) c *= 0.2;
            c = Math.round((c + G.card('cells', 0)) * G.CELL_BOOST);
            run.cells += c;
            G.add('cells', c);
            if (Math.random() < G.mastery('cash', 0)) giveReroll();
        }
        // boss drops
        if (e.boss) {
            run.stats.bosses++; S().stats.bosses++;
            G.count('boss', 1);
            if (dist0(e) > run.s.range) G.count('boss_far', 1);
            if (!e.sprint) bossDrops();
            // Not in the real game: bosses have a small chance to drop a power stone (max 3 per run)
            if (!run.tour && (run.stats.bossStones || 0) < 3 && Math.random() < 0.02 + 0.002 * run.tier) {
                run.stats.bossStones = (run.stats.bossStones || 0) + 1;
                G.add('stones', 1, 'boss');
                G.toast('🪨 Boss dropped a power stone', 'good', 1500);
            }
        }
        if (e.boss || e.elite || e.fleet) { const a = U('Amplifying Strike'); if (a) run.amp = a; }
        if (e.fleet) fleetDrops();
        // stat counters for missions/events
        // 'k_ray' is the Death Ray card's counter, so Ray elites count as 'k_ray_e'
        G.count(e.type === 'ray' ? 'k_ray_e' : 'k_' + e.type, 1);
        if (cause === 'orb') G.count('k_orb', 1);
        if (cause === 'mine') G.count('k_mine', 1);
        if (cause === 'deathray') G.count('k_ray', 1);
        if (cause === 'nuke') G.count('k_nuke', 1);
        if (cause === 'sm') G.count('k_sm', 1);
        if (cause === 'dw') G.count('k_dw', 1);
        if (cause === 'ilm') G.count('k_ilm', 1);
        if (run.demon > 0) G.count('k_demon', 1);
        if (run.gtOn > 0) G.count('k_gt', 1);
        if (e.slowCF) G.count('k_cf', 1);
        if (e.spot) G.count('k_sl', 1);
        // death wave health bonus
        if (e.dwHits > 0 && run.uw.dw) {
            const cap = G.labV('Death_Wave_Health') || 5;
            if ((run.dwHealth || 0) < cap) { run.dwHealth = Math.min(cap, (run.dwHealth || 0) + 0.0005); run.dwDirty = true; }
        }
        // land mines
        if (run.s.lmChance > 0 && Math.random() < run.s.lmChance && run.diss !== 'defense') {
            if (U('Space Displacer') && Math.random() < U('Space Displacer') / 100 && run.ilms.length < 20) run.ilms.push({ a: Math.atan2(e.y, e.x), r: dist0(e), t: 0, mult: G.uwLv('ilm') ? null : 30 });
            else run.mines.push({ x: e.x, y: e.y, t: 0 });
        }
        // scatter splits
        if (e.type === 'scatter' && e.gen < 4) {
            const hpScale = [1, 0.25, 1 / 9, 1 / 16][e.gen] / 2;
            for (let i = 0; i < 2; i++) { const c = spawn('scatter', e, hpScale); if (c) c.gen = e.gen + 1; }
        }
        G.emit('kill', e, cause);
    }

    function bossDrops() {
        const t = run.tier;
        if (S().feat.modules) {
            run.rerollCd = run.rerollCd || -99;
            if (run.wave - run.rerollCd >= 5 && Math.random() < 0.15) { run.rerollCd = run.wave; giveReroll(); }
            run.modCd = run.modCd || -99;
            const common = 0.02 + G.labV('Common_Drop_Chance'), rare = 0.005 + G.labV('Rare_Drop_Chance');
            if (Math.random() < rare) G.giveModule('rare', 'drop');
            else if (run.wave - run.modCd >= 5 && Math.random() < common) { run.modCd = run.wave; G.giveModule('common', 'drop'); }
        }
    }
    function giveReroll() {
        const n = D.REROLL_SHARDS[run.tier - 1] + (G.labV('Reroll_Shards') || 0);
        G.add('shard:reroll', n);
        run.rerolls += n;
        G.count('reroll_get', n);
    }
    function fleetDrops() {
        if (!S().feat.modules) return;
        if (Math.random() < 0.8) { const n = run.tier >= 15 ? [1200, 1350, 1500, 1650, 1800, 1950, 2100, 2300, 2500, 2750][Math.min(9, run.tier - 15)] : 1080; G.add('shard:reroll', n); run.rerolls += n; }
        else G.add('shard:' + G.pick(['cannon', 'armor', 'generator', 'core']), 5 + Math.min(20, Math.floor(run.wave / 250)));
    }
    function spawnFleet() {
        const type = G.pick(['saboteur', 'commander', 'overcharge']);
        const f = spawn(type);
        if (!f) return;
        const esc = { saboteur: 'fast', commander: 'tank', overcharge: 'ranged' }[type];
        const n = 10 + Math.floor(Math.random() * 6);
        for (let i = 0; i < n; i++) spawn(esc, f);
    }

    function addCash(n) { if (n > 0) { run.cash += n; run.stats.cash += n; S().stats.cashTotal += n; } }
    function giveCoins(n, e, why) {
        if (!(n > 0)) return;
        const got = G.add('coins', n, why);
        run.coins += got;
        run.stats.coins += got;
    }

    /* ---------- the tower taking damage ---------- */
    function towerHit(raw, src, kind) {
        const s = run.s;
        if (run.inv > 0 || run.demon > 0) return;
        // enemies stopped at a standing wall hit the wall instead
        if (kind === 'melee' && run.wall && run.wall.hp > 0) {
            if (!(run.wall.inv > 0)) { run.wall.hp -= raw; if (run.wall.hp <= 0) { run.wall.hp = 0; run.wall.rebuild = s.wallRebuild; } }
            if (src && G.labV('Wall_Thorns')) dealDamage(src, src.maxHp * s.thorns * G.labV('Wall_Thorns') * bc('thorn'), 'thorns');
            return;
        }
        let d = raw * (1 - s.defPct) - s.defAbs;
        if (run.cfOn > 0 && G.labDone('Chrono_Field_Damage_Reduction')) d *= 1 - (G.labV('Chrono_Field_Reduction_Percentage') || 0.10);
        if (src && src.burn > 0) d *= 1 - botStat('flame', 0);
        if (src && src.inHole && U('Primordial Collapse')) d *= 1 - U('Primordial Collapse') / 100;
        if (src && src.poisoned && U('Harmony Conductor') && Math.random() < U('Harmony Conductor') / 100 * (src.boss ? 0.5 : 1)) d = 0;
        if (src && src.nmp) d *= 1 - src.nmp;
        // thorns happen on every attack
        if (src && !src.dead && s.thorns > 0) {
            let th = src.maxHp * s.thorns * bc('thorn') * (src.boss ? 0.5 : 1);
            if (src.fleet) th = src.hp * s.thorns * 0.15;
            dealDamage(src, th, 'thorns');
        }
        if (d <= 0) return;
        // death saves: energy shield on any hit, death defy / second wind on killing hits
        if (run.shield > 0) { run.shield--; G.count('shield', 1); run.floaters.push({ x: 0, y: -6, t: 0, txt: '🔰 blocked', col: '#67e8f9' }); return; }
        run.tookDmg = true;
        run.dmgTaken += d;
        if (run.hp - d <= 0) {
            if (Math.random() < s.deathDefy) { run.floaters.push({ x: 0, y: -6, t: 0, txt: 'Death Defy!', col: '#fbbf24' }); return; }
            if (G.cardOn('secondWind') && !run.sw) {
                run.sw = true; run.swRecharge = G.labV('Recharge_Second_Wind') || 0;
                run.hp = run.maxHp * 0.5; run.inv = G.card('secondWind');
                if (run.wall) { run.wall.hp = run.wall.max; }
                const blast = G.labV('Second_Wind_Blast');
                if (blast) for (const e of run.enemies) if (!e.boss && Math.random() < blast) kill(e, 'secondwind');
                return;
            }
            if (G.cardOn('demonMode') && !run.demonUsed && G.vaultLv('demonAuto') >= 2) { B.demon(); run.hp = 1; return; }
            if (G.cardOn('nuke') && !run.nukeUsed && G.vaultLv('nukeAuto') >= 2) { B.nuke(); run.hp = 1; return; }
        }
        run.hp -= d;
        if (G.labDone('Missile_Barrage') && !run.barrageUsed && G.vaultLv('barrageAuto') >= 2) B.barrage();
    }
    B.towerHit = towerHit;

    function heal(n, over) {
        if (n <= 0) return;
        const cap = over ? run.maxHp * run.s.pkgMax : run.maxHp;
        const wr = U('Wormhole Redirector');
        const cap2 = !over && wr ? Math.max(run.maxHp, run.maxHp * run.s.pkgMax * wr / 100) : cap;
        if (run.hp < cap2) run.hp = Math.min(cap2, run.hp + n);
    }
    function givePackage() {
        const s = run.s;
        heal(run.maxHp * s.pkgAmount, true);
        run.packages.push({ x: G.rand(-20, 20), y: G.rand(-20, 20), t: 0 });
        run.stats.pkg++; G.count('pkg', 1); S().stats.recovery++;
        const gc = U('Galaxy Compressor');
        if (gc) for (const id in run.uw) if (id !== 'ps') run.uw[id].t = Math.max(0, run.uw[id].t - gc);
        const rb = U('Restorative Bonus');
        if (rb) run.restore = rb;
        if (Math.random() < G.mastery('recoveryPackage', 0)) G.giveModule('common', 'package');
    }

    function die() {
        run.hp = 0;
        B.end('died');
    }
    B.quit = () => B.end('quit');

    /* ---------- enemies ---------- */
    function enemiesUpdate(dt) {
        const s = run.s, range = s.range;
        const wallUp = run.wall && run.wall.hp > 0;
        // protector auras first
        const prots = run.enemies.filter(e => e.type === 'protector' && !e.dead);
        const pr = 15 * (1 + G.labV('Protector_Radius'));
        for (const e of run.enemies) e.protected = false;
        if (prots.length) for (const p of prots) for (const e of run.enemies) if (e !== p && !e.boss && dist(e, p) < pr) e.protected = true;
        const slowAura = s.slow;
        for (const e of run.enemies) {
            if (e.dead) continue;
            const d = dist0(e);
            if (e.acp > 0) e.acp -= dt;
            if (e.shock > 0) e.shock -= dt;
            if (e.netBoost > 0) e.netBoost -= dt;
            // burn
            if (e.burn > 0) { e.burn -= dt; e.burnT += dt; const ticks = 1 + (e.burnStack || 0); if (e.burnT >= 1 / ticks) { e.burnT = 0; dealDamage(e, run.flameDmg || 0, 'flame'); } }
            if (e.dead) continue;
            if (e.stun > 0) { e.stun -= dt; continue; }
            if (e.netted > 0) { e.netted -= dt; continue; }
            // energy net and plasma cannon on bosses as they near the range
            if (e.boss && !e.plasma && d < range + 6) {
                e.plasma = true;
                if (G.cardOn('plasmaCannon')) { dealDamage(e, e.maxHp * G.card('plasmaCannon') * bc('plasma'), 'plasma'); run.beams.push({ x0: 0, y0: 0, x1: e.x, y1: e.y, t: 0.4, col: 'plasma' }); }
                if (G.cardOn('energyNet')) { e.netted = G.card('energyNet'); e.netBoost = G.card('energyNet') + 10; G.count('net', 1); }
            }
            if (e.elite && !e.plasmaE && d < range + 6 && G.cardOn('plasmaCannon') && G.mastery('plasmaCannon', null) !== null) { e.plasmaE = true; dealDamage(e, e.maxHp * G.card('plasmaCannon') * G.mastery('plasmaCannon', 0), 'plasma'); }
            // speed
            let spd = e.spd;
            if (e.inHole) continue;
            if (slowAura && d <= range) spd *= 1 - slowAura;
            if (run.cfOn > 0 && d <= range + G.labV('Chrono_Field_Range') && !e.fleet) { spd *= 1 - UWS('cf', 1, run); e.slowCF = true; } else e.slowCF = false;
            if (run.cfOn > 0 && e.fleet && d <= range) spd *= 1 - UWS('cf', 1, run) / 2;
            if (e.poisonedIn) spd *= 0.75;
            if (e.linger > 0) { e.linger -= dt; spd *= 1 - botStat('thunder', 2); }
            if (e.nmp) spd *= 1 - e.nmp;
            // where to stop
            let stop = TOWER_R + e.r * 0.25;
            const melee = !(e.type === 'ranged' || e.type === 'vampire' || e.type === 'ray' || e.type === 'commander' || e.type === 'overcharge');
            if (e.type === 'ranged') stop = Math.min(range * 0.85, 85) * (run.perks.t_ranged ? 0.5 : 1) * (1 + G.labV('Ranged_Enemy_Range_Lab'));
            else if (e.type === 'vampire') stop = Math.max(16, Math.min(range * 0.6, 40));
            else if (e.type === 'ray') stop = Math.max(18, Math.min(range * 0.75, 55));
            else if (e.type === 'commander' || e.type === 'overcharge') stop = range * 0.9;
            else if (wallUp && e.type !== 'saboteur') stop = WALL_R + e.r * 0.25;
            if (d > stop) {
                const step = Math.min(d - stop, spd * dt);
                e.x -= e.x / d * step; e.y -= e.y / d * step;
                // chrono loop (CF+) spirals slowed enemies
                if (e.slowCF && S().uw.plus.cf !== undefined) { const a = D.UW_PLUS.cf.vals[S().uw.plus.cf] * dt / 2; const c = Math.cos(a), sn = Math.sin(a); const nx = e.x * c - e.y * sn; e.y = e.x * sn + e.y * c; e.x = nx; }
                continue;
            }
            // attacking
            e.atkT += dt * bc('atkspd') * (d <= range ? 1 - G.mastery('slowAura', 0) : 1) * (1 - (e.titan || 0));
            if (e.type === 'vampire') { run.vampDrain = true; towerDrain(e, dt); continue; }
            if (e.type === 'ray') {
                e.charge += dt;
                if (e.charge >= 30) { e.charge = 0; run.beams.push({ x0: e.x, y0: e.y, x1: 0, y1: 0, t: 0.5, col: 'ray' }); towerHit(e.dmg, e, 'ray'); }
                continue;
            }
            if (e.type === 'commander') {
                if (e.atkT >= 5) { e.atkT = 0; for (const o of run.enemies) if (!o.boss && o !== e && dist(o, e) < 20 && (o.cmd || 0) < 8) { o.cmd = (o.cmd || 0) + 1; o.maxHp *= 1.15; o.hp *= 1.15; o.spd *= 1.15; o.mass *= 1.15; } }
                continue;
            }
            const interval = e.type === 'ranged' || e.type === 'overcharge' ? 2 : 1;
            if (e.atkT >= interval) {
                e.atkT = 0;
                if (!melee) run.eshots.push({ x: e.x, y: e.y, spd: 45, dmg: e.dmg, src: e, kind: e.type === 'overcharge' ? 'over' : 'shot' });
                else if (e.type === 'saboteur') { saboteurHit(e); towerHit(0.0001, e, 'melee'); }
                else { towerHit(e.dmg * e.heat, e, wallUp ? 'melee' : 'melee'); e.heat *= 1.04; }
            }
        }
    }
    function towerDrain(e, dt) {
        if (run.inv > 0 || run.demon > 0) return;
        const d = run.maxHp * 0.02 * dt * (1 + G.labV('Vampire_Enemy_Attack'));
        run.hp -= d;
        run.dmgTaken += d;
        run.tookDmg = true;
        if (G.labV('Garlic_Thorns')) dealDamage(e, e.maxHp * run.s.thorns * G.labV('Garlic_Thorns') / 100 * dt, 'thorns');
    }
    function saboteurHit(e) {
        const owned = Object.keys(run.uw);
        if (!owned.length) return;
        const id = G.pick(owned);
        run.sabotaged = run.sabotaged || {};
        run.sabotaged[id] = (run.sabotaged[id] || 0) + 1;
    }

    /* ---------- orbs ---------- */
    function orbRadius() { const s = run.s; return Math.max(15, s.range * 0.55 + 8) * 0.8; }
    B.orbRadius = () => run ? orbRadius() : 20;
    function orbsUpdate(dt) {
        const s = run.s;
        run.orbA = (run.orbA || 0) + dt * s.orbSpeed * 2 * Math.PI / 60 * 6;
        const orbs = [];
        const n = Math.floor(s.orbs);
        const R = orbRadius();
        for (let i = 0; i < n; i++) { const a = run.orbA + i * 2 * Math.PI / n; orbs.push({ x: Math.cos(a) * R, y: Math.sin(a) * R, extra: false }); }
        if (G.cardOn('extraOrb')) {
            const m = 1 + (G.labV('Extra_Extra_Orbs') || 0);
            run.orbB = (run.orbB || 0) - dt * (G.card('extraOrb') + s.orbSpeed) * 2 * Math.PI / 60 * 6;
            const R2 = Math.min(s.range * 1.1, Math.max(12, s.range * 0.35));
            for (let i = 0; i < m; i++) { const a = run.orbB + i * 2 * Math.PI / m; orbs.push({ x: Math.cos(a) * R2, y: Math.sin(a) * R2, extra: true }); }
        }
        run.orbPos = orbs;
        if (!orbs.length) return;
        const or = 2.2 * s.orbSize;
        const orbEff = bc('orb');
        for (const o of orbs) for (const e of run.enemies) {
            if (e.dead || Math.abs(e.x - o.x) > 6 || Math.abs(e.y - o.y) > 6) continue;
            if (dist(e, o) > or + e.r * 0.2) continue;
            if (o.extra) e.orbMark = true;
            if (e.boss) { if (G.labDone('Orb_Boss_Hit') && !(e.orbCd > run.t)) { e.orbCd = run.t + 0.5; dealDamage(e, e.maxHp * G.labV('Orb_Boss_Hit'), 'orb'); } continue; }
            if (e.elite || e.fleet || e.protected) {
                if (U('Negative Mass Projector') && !(e.orbCd > run.t)) { e.orbCd = run.t + 0.5; e.nmp = Math.min(0.5, (e.nmp || 0) + U('Negative Mass Projector') / 100); }
                continue;
            }
            if (orbEff < 1) { if (!(e.orbCd > run.t)) { e.orbCd = run.t + 0.3; dealDamage(e, e.maxHp * orbEff, 'orb'); } }
            else kill(e, 'orb');
        }
    }

    /* ---------- land mines ---------- */
    function minesUpdate(dt) {
        const s = run.s;
        const keep = [];
        const rad = s.lmRadius * 8 * (1 + G.mastery('areaOfEffect', 0));
        for (const m of run.mines) {
            m.t += dt;
            let boom = m.t >= s.lmDecay;
            if (!boom) for (const e of run.enemies) if (!e.dead && Math.abs(e.x - m.x) < 3 && Math.abs(e.y - m.y) < 3) { boom = true; break; }
            if (!boom) { keep.push(m); continue; }
            const d = s.damage * s.lmDamage * s.avgCrit;
            run.waves.push({ kind: 'mine', x: m.x, y: m.y, r: 0, max: rad, t: 0 });
            for (const e of run.enemies) if (!e.dead && dist(e, m) < rad) {
                G.count('h_mine', 1);
                dealDamage(e, d * takenMult(e), 'mine');
                if (!e.dead && !e.boss && G.cardOn('landMineStun') && Math.random() < 0.4) { e.stun = G.card('landMineStun') * (e.fleet ? 0.5 : 1); G.count('stun', 1); }
            }
        }
        run.mines = keep.length > 40 ? keep.slice(-40) : keep;
    }

    /* ======================================================================
       ULTIMATE WEAPONS
       ====================================================================== */
    function uwCooldown(id) {
        const i = { cl: -1, sm: 2, dw: 2, cf: 2, ilm: 2, gt: 2, ps: 2, bh: 2, sl: -1 }[id];
        if (i < 0) return 0;
        return Math.max(1, UWS(id, i, run));
    }
    function uwUpdate(dt) {
        const s = run.s;
        // multiverse nexus: DW, GT and BH share one timer
        const nexus = U('Multiverse Nexus') !== 0 && G.equipped('core') && G.equipped('core').name === 'Multiverse Nexus';
        for (const id in run.uw) {
            if (run.uwOff[id] || (run.sabotaged && run.sabotaged[id] && run.enemies.some(e => e.type === 'saboteur'))) continue;
            const u = run.uw[id];
            if (id === 'cl' || id === 'sl') continue;
            u.t -= dt;
            if (u.t <= 0) {
                let cd = uwCooldown(id);
                if (nexus && ['dw', 'gt', 'bh'].includes(id)) {
                    const ids = ['dw', 'gt', 'bh'].filter(x => run.uw[x]);
                    cd = ids.reduce((a, x) => a + uwCooldown(x), 0) / ids.length + U('Multiverse Nexus');
                    for (const x of ids) { run.uw[x].t = cd; activate(x); }
                    continue;
                }
                u.t = cd;
                activate(id);
            }
        }
        // spotlight beams
        if (run.uw.sl && !run.uwOff.sl) {
            run.spotA += dt * Math.PI / 6;
            const n = Math.round(UWS('sl', 2, run)), ang = UWS('sl', 1, run) * Math.PI / 180, bonus = UWS('sl', 0, run) * (1 + (S().uw.plus.sl !== undefined ? D.UW_PLUS.sl.vals[S().uw.plus.sl] * s.dpm * 100 : 0));
            const boss = U('Om Chip') ? run.enemies.find(e => e.boss && !e.dead) : null;
            if (boss) run.spotA = Math.atan2(boss.y, boss.x);
            for (const e of run.enemies) {
                e.spot = 0;
                const a = Math.atan2(e.y, e.x);
                for (let i = 0; i < n; i++) {
                    let da = Math.abs(((a - run.spotA - i * 2 * Math.PI / n) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
                    if (da < ang / 2 && dist0(e) <= s.range * 1.15) { e.spot = bonus; break; }
                }
                if (boss && e !== boss && dist(e, boss) < 12) e.spot = (e.spot || 1) * U('Om Chip');
            }
        }
        if (run.gtOn > 0) { run.gtOn -= dt; if (run.gtOn <= 0 && S().uw.plus.gt !== undefined) { run.gtCombo = Math.pow(1 + D.UW_PLUS.gt.vals[S().uw.plus.gt], run.gtKills) - 1; run.gtComboT = 10; } }
        if (run.gtComboT > 0) run.gtComboT -= dt;
        if (run.cfOn > 0) run.cfOn -= dt;
        if (run.amp > 0) run.amp -= dt;
        // smart missiles
        const keepM = [];
        for (const m of run.missiles) {
            m.t += dt;
            let tgt = run.enemies.find(e => e.id === m.tid && !e.dead);
            if (!tgt) { const pool = run.enemies.filter(e => !e.dead); if (pool.length) { tgt = pool.reduce((a, b) => (b.hp > a.hp ? b : a)); m.tid = tgt.id; } }
            if (!tgt) { if (m.t < 2 + G.labV('Missile_Despawn_Time')) keepM.push(m); continue; }
            const d = dist(m, tgt), step = 55 * dt;
            m.a = Math.atan2(tgt.y - m.y, tgt.x - m.x);
            if (d <= step + 1) {
                let dmg = m.dmg * (1 + (tgt.sm || 0) * (G.labV('Missile_Amplifier') || 0) / 100) * takenMult(tgt) * (1 + G.card('areaOfEffect', 0));
                tgt.sm = (tgt.sm || 0) + 1;
                G.countMax('sm_same_max', tgt.sm);
                dealDamage(tgt, dmg, 'sm');
                if (G.labDone('Missiles_Explosion')) {
                    const r = (0.3 + G.labV('Missiles_Radius')) * 10 * (1 + G.mastery('areaOfEffect', 0));
                    run.waves.push({ kind: 'mine', x: tgt.x, y: tgt.y, r: 0, max: r, t: 0 });
                    for (const e of run.enemies) if (e !== tgt && !e.dead && dist(e, tgt) < r) dealDamage(e, dmg * 0.5, 'sm');
                }
                continue;
            }
            m.x += Math.cos(m.a) * step; m.y += Math.sin(m.a) * step;
            if (m.t < 12) keepM.push(m);
        }
        run.missiles = keepM;
        // poison swamps
        const keepS = [];
        for (const p of run.swamps) {
            p.t -= dt; p.tick += dt;
            const tick = p.tick >= 1;
            if (tick) { p.tick = 0; p.n++; }
            for (const e of run.enemies) {
                if (e.dead) continue;
                const inside = dist(e, p) < p.r;
                e.poisonedIn = inside;
                if (!inside) continue;
                if (!e.poisoned) { e.poisoned = true; G.count('poison', 1); if (G.labDone('Poison_Swamp_Stun') && !e.boss && Math.random() < (G.labV('Swamp_Stun_Chance') || 0.05)) e.stun = G.labV('Swamp_Stun_Time') || 1; }
                if (tick) dealDamage(e, p.dmg * (1 + (S().uw.plus.ps !== undefined ? D.UW_PLUS.ps.vals[S().uw.plus.ps] * p.n : 0.5 * p.n)) * (1 + G.card('areaOfEffect', 0)) * takenMult(e), 'ps');
            }
            if (p.t > 0) keepS.push(p);
        }
        run.swamps = keepS;
        // black holes
        const keepH = [];
        for (const h of run.holes) {
            h.t -= dt;
            let inside = 0;
            for (const e of run.enemies) {
                if (e.dead) continue;
                const d = dist(e, h);
                if (d < h.r && !e.boss && !e.elite && !e.fleet) {
                    inside++;
                    e.inHole = h.t > 0;
                    const pull = Math.min(d, 20 * dt);
                    if (d > 0.5) { e.x += (h.x - e.x) / d * pull; e.y += (h.y - e.y) / d * pull; }
                    if (G.labDone('Black_Hole_Damage')) dealDamage(e, e.maxHp * G.labV('Black_Hole_Damage') * dt, 'bh');
                }
            }
            G.countMax('bh_max', inside);
            if (h.t > 0) keepH.push(h);
            else {
                for (const e of run.enemies) if (e.inHole && dist(e, h) < h.r) { e.inHole = false; if (S().uw.plus.bh !== undefined) dealDamage(e, D.enemyHp(run.tier, run.hpWave, run.tour) * D.UW_PLUS.bh.vals[S().uw.plus.bh], 'bh'); }
            }
        }
        run.holes = keepH;
        if (!keepH.length) for (const e of run.enemies) e.inHole = false;
        // inner land mines circle the tower
        const keepI = [];
        const rot = (0.4 + G.labV('Inner_Mine_Rotation_Speed')) * dt * 0.5;
        for (const m of run.ilms) {
            m.a += rot; m.t += dt;
            const x = Math.cos(m.a) * m.r, y = Math.sin(m.a) * m.r;
            let boom = false;
            for (const e of run.enemies) if (!e.dead && Math.abs(e.x - x) < 3 && Math.abs(e.y - y) < 3) { boom = true; break; }
            if (!boom) { keepI.push(m); continue; }
            const r = (5 + G.labV('Inner_Mine_Blast_Radius') * 5) * (1 + G.mastery('areaOfEffect', 0));
            let dmg = (m.mult ? m.mult * run.s.damage * run.s.avgCrit : uwDmg('ilm')) * (1 + G.card('areaOfEffect', 0));
            if (S().uw.plus.ilm !== undefined) dmg *= 1 + D.UW_PLUS.ilm.vals[S().uw.plus.ilm] * m.t;
            run.waves.push({ kind: 'ilm', x, y, r: 0, max: r, t: 0 });
            for (const e of run.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) < r) {
                G.count('h_ilm', 1);
                dealDamage(e, dmg * takenMult(e), 'ilm');
                if (!e.dead && G.labDone('Inner_Mine_Stun') && !e.boss) e.stun = 2.4 * (e.fleet ? 0.5 : 1);
            }
        }
        run.ilms = keepI;
        // death wave
        dwUpdate(dt);
    }

    function activate(id) {
        const s = run.s;
        switch (id) {
            case 'sm': {
                const n = Math.round(UWS('sm', 1, run));
                const dmg = uwDmg('sm');
                for (let i = 0; i < n; i++) run.missiles.push({ x: 0, y: 0, a: Math.random() * 6.28, t: 0, tid: null, dmg });
                break;
            }
            case 'dw': {
                const n = Math.round(UWS('dw', 1, run));
                run.dwPool += uwDmg('dw');
                for (let i = 0; i < n; i++) run.waves.push({ kind: 'effect', r: 0, max: spawnDist(), t: -i * 1.2, hit: new Set() });
                run.waves.push({ kind: 'death', r: 0, max: s.range, t: -n * 1.2 - 0.6, hit: new Set(), life: 0 });
                break;
            }
            case 'cf': run.cfOn = UWS('cf', 0, run) * bcUw(); break;
            case 'gt': run.gtOn = UWS('gt', 1, run) * bcUw(); run.gtKills = 0; break;
            case 'ilm': {
                const n = Math.round(UWS('ilm', 1, run));
                for (let i = 0; i < n; i++) run.ilms.push({ a: i * 2 * Math.PI / n, r: Math.max(8, s.range * 0.45), t: 0 });
                break;
            }
            case 'ps': {
                const a = Math.random() * 6.28, d = G.rand(0.3, 0.9) * s.range;
                const r = 9 * (1 + G.labV('Swamp_Radius')) * (run.perks.uw_ps ? 1.5 : 1) * (1 + G.mastery('areaOfEffect', 0));
                run.swamps.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r, t: UWS('ps', 1, run) * bcUw(), dmg: uwDmg('ps'), tick: 0, n: 0 });
                break;
            }
            case 'bh': {
                const a = Math.random() * 6.28, d = s.range * 0.95, r = UWS('bh', 0, run) / 2, dur = UWS('bh', 1, run) * bcUw();
                run.holes.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r, t: dur, max: dur });
                if (G.labDone('Extra_Black_Hole') || U('Primordial Collapse')) run.holes.push({ x: -Math.cos(a) * d, y: -Math.sin(a) * d, r, t: dur, max: dur });
                break;
            }
        }
    }
    const bcUw = () => 1;

    function dwUpdate(dt) {
        const keep = [];
        const amp = G.labV('Death_Wave_Damage_Amplifier') || 5;
        for (const w of run.waves) {
            w.t += dt;
            if (w.t < 0) { keep.push(w); continue; }
            if (w.kind === 'effect') {
                w.r += 70 * dt;
                for (const e of run.enemies) if (!e.dead && !w.hit.has(e.id) && dist0(e) <= w.r) {
                    w.hit.add(e.id); e.dwHits++; G.count('h_dw', 1);
                }
                if (w.r < w.max) keep.push(w);
                continue;
            }
            if (w.kind === 'death') {
                w.r += 40 * dt; w.life += dt;
                if (w.r > w.max) { w.r = 0; w.hit.clear(); }
                for (const e of run.enemies) {
                    if (e.dead || w.hit.has(e.id) || dist0(e) > w.r || run.dwPool <= 0) continue;
                    w.hit.add(e.id);
                    const mult = (1 + e.dwHits * amp) * (S().uw.plus.dw !== undefined ? 1 + D.UW_PLUS.dw.vals[S().uw.plus.dw] * e.dwHits / 10 : 1);
                    const need = e.hp / mult;
                    if (run.dwPool >= need) { run.dwPool -= need; kill(e, 'dw'); }
                    else { dealDamage(e, run.dwPool * mult, 'dw'); run.dwPool = 0; }
                }
                if (run.dwPool > 0 && w.life < 12) keep.push(w);
                continue;
            }
            // visual-only rings (shockwave, mines)
            w.r += (w.kind === 'sw' ? 60 : 50) * dt;
            if (w.r < w.max) keep.push(w);
        }
        run.waves = keep.length > 80 ? keep.slice(-80) : keep;
        if (run.dwDirty) { run.dwDirty = false; recalc(); }
    }

    function chain(src) {
        const s = run.s;
        const n = Math.round(UWS('cl', 1, run));
        const hitSet = new Set([src.id]);
        let from = src;
        const dmg = uwDmg('cl');
        for (let i = 0; i < n; i++) {
            const t = targets(1, from, 20, hitSet)[0];
            if (!t) break;
            hitSet.add(t.id);
            run.beams.push({ x0: from.x, y0: from.y, x1: t.x, y1: t.y, t: 0.15, col: 'cl' });
            G.count('h_cl', 1);
            let d = dmg * takenMult(t);
            if (S().uw.plus.cl !== undefined && Math.random() < UWS('cl', 2, run) && (t.smite || 0) < 100) { t.smite = (t.smite || 0) + 1; d += D.enemyHp(run.tier, run.hpWave, run.tour) * D.UW_PLUS.cl.vals[S().uw.plus.cl]; }
            dealDamage(t, d, 'cl');
            if (!t.dead && G.labDone('Chain_Lightning_Shock')) {
                const dc = U('Dimension Core') ? 2 : 1;
                if (Math.random() < (G.labV('Shock_Chance') || 0.025) * dc) { t.shock = 5; t.shockM = 1 + ((G.labV('Shock_Multiplier') || 1.1) - 1) * dc * (U('Dimension Core') ? Math.min(U('Dimension Core'), (t.shockN = (t.shockN || 0) + 1)) : 1); }
            }
            from = t;
        }
    }

    /* ======================================================================
       CARDS WITH TIMERS AND BUTTONS
       ====================================================================== */
    function cardsUpdate(dt) {
        const s = run.s;
        // super tower
        if (G.cardOn('superTower')) {
            if (run.superOn > 0) run.superOn -= dt;
            run.superT -= dt;
            if (run.superT <= 0) { run.superOn = 15; run.superT = 45 + (G.mastery('superTower', 0) || 0); }
        }
        // death ray sweeps every 11 seconds
        if (G.cardOn('deathRay')) {
            run.rayT -= dt;
            if (run.rayT <= 0) {
                run.rayT = 11;
                run.ray = { t: G.card('deathRay'), a: Math.random() * 6.28, two: Math.random() < G.labV('Double_Death_Ray') };
            }
            if (run.ray && run.ray.t > 0) {
                run.ray.t -= dt; run.ray.a += dt * 1.6;
                for (let k = 0; k < (run.ray.two ? 2 : 1); k++) {
                    const a = run.ray.a + k * Math.PI;
                    const cx = Math.cos(a), cy = Math.sin(a);
                    for (const e of run.enemies) {
                        if (e.dead) continue;
                        const along = e.x * cx + e.y * cy, perp = Math.abs(-e.x * cy + e.y * cx);
                        if (along < 0 || along > s.range * 1.2 || perp > 2.2) continue;
                        if (e.boss || e.elite || e.fleet || e.type === 'protector') { if (e.protected && G.mastery('deathRay', null) !== null && !(e.rayCd > run.t)) { e.rayCd = run.t + 1; dealDamage(e, e.maxHp * G.mastery('deathRay', 0), 'deathray'); } continue; }
                        if (e.protected) { if (G.mastery('deathRay', null) !== null && !(e.rayCd > run.t)) { e.rayCd = run.t + 1; dealDamage(e, e.maxHp * G.mastery('deathRay', 0), 'deathray'); } continue; }
                        if (bc('ray') < 1) dealDamage(e, e.maxHp * bc('ray'), 'deathray');
                        else kill(e, 'deathray');
                    }
                }
            }
        }
        if (run.demon > 0) run.demon -= dt;
        // recharging buttons (labs)
        for (const [used, rech, lab] of [['demonUsed', 'demonRecharge', 'Recharge_Demon_Mode'], ['nukeUsed', 'nukeRecharge', 'Recharge_Nuke'], ['barrageUsed', 'barrageRecharge', 'Recharge_Missile_Barrage']]) {
            if (run[used] && G.labDone(lab)) { run[rech] = (run[rech] || 0) + dt / (D.WAVE_LEN + coolLen()); if (run[rech] >= G.labV(lab)) { run[used] = false; run[rech] = 0; } }
        }
        if (G.cardOn('demonMode') && !run.demonUsed && G.vaultLv('demonAuto') >= 1) B.demon();
        if (G.cardOn('nuke') && !run.nukeUsed && G.vaultLv('nukeAuto') >= 1 && run.enemies.length > 60) B.nuke();
        if (G.labDone('Missile_Barrage') && !run.barrageUsed && G.vaultLv('barrageAuto') >= 1 && run.enemies.length > 30) B.barrage();
        if (run.sw && run.swRecharge && G.labDone('Recharge_Second_Wind')) { run.swWaves = (run.swWaves || 0) + dt / (D.WAVE_LEN + coolLen()); if (run.swWaves >= run.swRecharge) { run.sw = false; run.swWaves = 0; } }
        // spotlight missiles lab: the tower fires missiles on a timer
        if (G.labDone('Spotlight_Missiles')) {
            run.slmT = (run.slmT || 0) + dt;
            if (run.slmT >= G.labV('Spotlight_Missiles')) { run.slmT = 0; const dmg = (G.uwLv('sm') ? uwDmg('sm') : 14 * s.damage * s.avgCrit); run.missiles.push({ x: 0, y: 0, a: 0, t: 0, tid: null, dmg }); }
        }
        // tactical barrage & cover fire
        const tb = U('Tactical Barrage'); const cover = S().uw.plus.sm !== undefined && run.uw.sm ? D.UW_PLUS.sm.vals[S().uw.plus.sm] : 0;
        if (tb || cover) { run.cfT = (run.cfT || 0) + dt; const every = Math.min(tb || 99, cover || 99); if (run.cfT >= every) { run.cfT = 0; run.missiles.push({ x: 0, y: 0, a: 0, t: 0, tid: null, dmg: run.uw.sm ? uwDmg('sm') : 14 * s.damage }); } }
        // orbital augment electrons
        const oa = U('Orbital Augment');
        if (oa) {
            run.elA = (run.elA || 0) + dt * 2.2;
            run.electrons = [];
            for (let i = 0; i < oa; i++) { const a = run.elA + i * 2 * Math.PI / oa, R = Math.max(10, s.range * 0.3); run.electrons.push({ x: Math.cos(a) * R, y: Math.sin(a) * R }); }
            for (const el of run.electrons) for (const e of run.enemies) if (!e.dead && dist(e, el) < 2.5 && !(e.elCd > run.t)) { e.elCd = run.t + 1; dealDamage(e, e.hp * 0.15 * (e.boss || e.fleet ? 0.25 : 1), 'electron'); }
        }
    }
    B.demon = () => { if (!run || !G.cardOn('demonMode') || run.demonUsed || run.sprint > 0) return; run.demonUsed = true; run.demon = G.card('demonMode') * (run.tour ? Math.min(1, 10 * (D.WAVE_LEN + coolLen()) / G.card('demonMode')) : 1); };
    B.nuke = () => {
        if (!run || !G.cardOn('nuke') || run.nukeUsed || run.sprint > 0) return;
        run.nukeUsed = true;
        const p = G.card('nuke');
        for (const e of run.enemies.slice()) if (!e.dead && Math.random() < p) kill(e, 'nuke');
        run.inv = Math.max(run.inv, 15);
        run.waves.push({ kind: 'sw', r: 0, max: spawnDist(), t: 0 });
    };
    B.barrage = () => {
        if (!run || !G.labDone('Missile_Barrage') || run.barrageUsed || run.sprint > 0) return;
        run.barrageUsed = true;
        const n = G.labV('Missile_Barrage_Quantity') || 20;
        const dmg = G.uwLv('sm') ? uwDmg('sm') : 14 * run.s.damage * run.s.avgCrit;
        for (let i = 0; i < n; i++) run.missiles.push({ x: 0, y: 0, a: i / n * 6.28, t: 0, tid: null, dmg });
    };

    /* ======================================================================
       BOTS
       ====================================================================== */
    // bot stat i at its current level: 0 = duration / damage reduction, 1 = cooldown, 2 = damage/bonus/linger, 3 = range
    function botStat(id, i) {
        const b = D.BOT_BY[id], lv = (S().bots.lv[id] || [0, 0, 0, 0])[i];
        let v = lv ? b.t[i][Math.min(lv, b.t[i].length) - 1] : b.base[i];
        if (i === 1) v += G.labV({ flame: 'Flame_Bot_Cooldown', thunder: 'Thunder_Bot_Cooldown', golden: 'Golden_Bot_Cooldown', amplify: 'Amplify_Bot_Cooldown', botbot: 'Bot_Bot_Cooldown' }[id]);
        if (i === 0 && id !== 'flame') v += G.labV({ thunder: 'Thunder_Bot_Linger_Time', golden: 'Golden_Bot_Duration', amplify: 'Amplify_Bot_Duration', botbot: 'Bot_Bot_Duration' }[id]) * (id === 'thunder' ? 0 : 1);
        if (i === 3) v += G.vaultLv('botRange') * 2 + G.relic('botRange') + (U('Singularity Harness') || 0);
        return v;
    }
    B.botStat = botStat;
    function botsUpdate(dt) {
        const s = run.s;
        let bb = run.bots.botbot && run.bots.botbot.on > 0 ? run.bots.botbot : null;
        for (const id in run.bots) {
            const b = run.bots[id];
            // move toward target spot
            const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy);
            if (d > 0.5) { const st = Math.min(d, 18 * dt); b.x += dx / d * st; b.y += dy / d * st; }
            const boost = bb && id !== 'botbot' && Math.hypot(b.x - bb.x, b.y - bb.y) < botStat('botbot', 3) / 2 ? botStat('botbot', 2) : 1;
            const R = botStat(id, 3) / 2 * (1 + s.range / 200);
            if (b.on > 0) {
                b.on -= dt;
                for (const e of run.enemies) {
                    if (e.dead || Math.hypot(e.x - b.x, e.y - b.y) > R) continue;
                    if (id === 'flame') { e.burn = 1.2; e.burnStack = G.labV('Flame_Bot_-_Burn_Stack'); }
                    if (id === 'golden') e.golden = botStat('golden', 2) * boost;
                    if (id === 'amplify') e.amped = botStat('amplify', 2) * boost;
                    if (id === 'thunder' && b.fresh) {
                        e.stun = botStat('thunder', 0) * (e.boss || e.elite ? 0.5 : 1); e.linger = 3.5 + G.labV('Thunder_Bot_Linger_Time'); if (e.fleet) e.stun = 0;
                        if (run.bp.thunder) e.titan = Math.min(0.9, run.bp.thunder * String(Math.floor(e.mass)).length);
                    }
                }
                if (id === 'flame') run.flameDmg = botStat('flame', 2) * s.damage * s.avgCrit * boost * (1 + G.card('areaOfEffect', 0)) * (U('Singularity Harness') ? 2 : 1);
                b.fresh = false;
                if (b.on <= 0) for (const e of run.enemies) { if (id === 'golden') e.golden = 0; if (id === 'amplify') e.amped = 0; }
                continue;
            }
            b.t -= dt;
            if (b.t <= 0) {
                b.t = botStat(id, 1);
                b.on = id === 'flame' ? 10 : id === 'thunder' ? Math.max(1, botStat('thunder', 0)) : botStat(id, 0);
                b.fresh = true;
                // go where the enemies are
                const tgt = run.enemies.filter(e => !e.dead && dist0(e) < s.range);
                const pick = tgt.length ? G.pick(tgt) : { x: G.rand(-15, 15), y: G.rand(-15, 15) };
                b.tx = pick.x; b.ty = pick.y;
            } else if (Math.random() < dt * 0.3) { b.tx = G.rand(-12, 12); b.ty = G.rand(-12, 12); }
        }
    }

    /* ======================================================================
       GUARDIAN CHIPS
       ====================================================================== */
    function chipStat(id, which) {
        const c = D.CHIP_BY[id], lv = (S().guardian.chips[id] || [0, 0, 0]);
        const idx = which === 'cd' ? c.cdIdx : which;
        const col = c.t[idx];
        return col[Math.min(lv[idx] || 0, col.length - 1)].v;
    }
    B.chipStat = chipStat;
    function chipsUpdate(dt) {
        const s = run.s;
        if (run.summonOn > 0) {
            run.summonOn -= dt; run.summonT = (run.summonT || 0) + dt;
            while (run.summonT >= 0.5) { run.summonT -= 0.5; spawn(G.pick(['basic', 'fast', 'tank', 'ranged'])); }
        }
        if (run.scout > 0) run.scout -= dt;
        for (const id in run.chips) {
            const c = run.chips[id];
            c.t -= dt;
            if (c.t > 0) continue;
            c.t = chipStat(id, 'cd');
            c.fx = 1;
            const near = run.enemies.filter(e => !e.dead && dist0(e) < s.range * 1.5);
            switch (id) {
                case 'attack': {
                    const n = chipStat('attack', 2);
                    near.sort((a, b) => (b.maxHp - b.hp) - (a.maxHp - a.hp));
                    for (const e of near.slice(0, n)) { dealDamage(e, (e.maxHp - e.hp) * chipStat('attack', 0) / 100 * (e.boss ? 0.5 : 1), 'guardian'); run.beams.push({ x0: 6, y0: -6, x1: e.x, y1: e.y, t: 0.25, col: 'guard' }); }
                    break;
                }
                case 'ally': {
                    const e = near.sort((a, b) => dist0(a) - dist0(b))[0];
                    if (e && !e.boss && !e.fleet) { kill(e, 'ally'); const amt = chipStat('ally', 0) / 100, mx = chipStat('ally', 2); run.hp = Math.min(run.maxHp * Math.max(mx, run.s.pkgMax), run.hp + run.maxHp * amt); }
                    break;
                }
                case 'bounty': {
                    const n = chipStat('bounty', 2);
                    near.filter(e => e.type !== 'basic').sort((a, b) => dist0(a) - dist0(b)).slice(0, n).forEach(e => { e.bounty = chipStat('bounty', 0); });
                    break;
                }
                case 'fetch': {
                    const finds = (Math.random() < chipStat('fetch', 1) / 100 ? 1 : 0) * (Math.random() < chipStat('fetch', 2) / 100 ? 2 : 1);
                    for (let i = 0; i < finds; i++) G.fetchLoot(run);
                    break;
                }
                case 'summon': run.summonOn = chipStat('summon', 1); run.summonCash = chipStat('summon', 2); break;
                case 'scout': run.scout = chipStat('scout', 2); run.scoutM = chipStat('scout', 1); break;
            }
        }
    }

    /* ======================================================================
       FLOATING GEM ("Bob") AND FLOATING TEXT
       ====================================================================== */
    function maybeGem() {
        if (run.gem || run.gemsThisRun >= 10 || run.wave < 10) return;
        const fr = S().free, now = Date.now();
        const first = !run.gemsThisRun;
        const since = (now - (fr.gemTap || 0)) / 60000;
        if (first ? since >= 11 : since >= 30 && run.wave - (run.lastGemWave || 0) >= 400) {
            run.gem = { x: G.rand(-30, 30), y: G.rand(-30, 30), vx: G.rand(-6, 6), vy: G.rand(-6, 6), t: 0 };
        }
    }
    B.tapGem = () => {
        if (!run || !run.gem) return false;
        run.gem = null;
        run.gemsThisRun++;
        run.lastGemWave = run.wave;
        S().free.gemTap = Date.now();
        G.add('gems', 2, 'gem');
        G.count('gem_tap', 1);
        S().stats.floatGems++;
        G.toast('💎 +2 gems', 'good', 1200);
        G.sfx('coin');
        return true;
    };
    function floatersUpdate(dt) {
        for (const f of run.floaters) { f.t += dt; f.y -= dt * 4; }
        run.floaters = run.floaters.filter(f => f.t < 0.9);
        for (const b of run.beams) b.t -= dt;
        run.beams = run.beams.filter(b => b.t > 0);
        for (const p of run.packages) p.t += dt;
        run.packages = run.packages.filter(p => p.t < 1.2);
    }

    // fleet first wave / every N waves per tier (from the wiki's fleet table)
    D.FLEET = { 14: [2495, 1000], 15: [1495, 750], 16: [995, 500], 17: [495, 250], 18: [95, 100], 19: [45, 50], 20: [5, 10], 21: [5, 10], 22: [5, 10], 23: [5, 10], 24: [5, 10] };
    for (let t = 1; t <= 13; t++) D.FLEET[t] = [15000 - (t - 1) * 250, 100];
})();
