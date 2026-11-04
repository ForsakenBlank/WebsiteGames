/* ==========================================================
   SINGULARITY — simulation.
   window.Eng holds the state (S), derived effects (FX) and every
   action the UI can call. No DOM in here except toasts.
   ========================================================== */
(function () {
    'use strict';
    const { ITEMS, SITES, NODES, MODELS, TECHS, REPEAT, FOCUS, TASKS, TASK_PAY, JOBS, CLIENTS, EVENTS, MAP, ECHO, LAWS, GOALS, DEPTH } = SG;
    const KEY = 'arcade.singularity.save';
    const META_KEY = 'arcade.singularity.meta';
    const DAY = 300;                 // seconds per day/night cycle
    const MONTH = 600;               // seconds per billing period
    const rnd = Math.random;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const pick = (a) => a[(rnd() * a.length) | 0];

    /* ---------- number formatting ---------- */
    const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
    function fmt(n, d) {
        if (n === undefined || n === null || isNaN(n)) return '0';
        if (!isFinite(n)) return '∞';
        const neg = n < 0; n = Math.abs(n);
        let s;
        if (n < 1000) s = n < 10 && n % 1 !== 0 ? n.toFixed(d === undefined ? (n < 1 ? 2 : 1) : d).replace(/\.?0+$/, '') : Math.floor(n).toLocaleString();
        else {
            const tier = Math.floor(Math.log10(n) / 3);
            if (tier < UNITS.length) { const v = n / Math.pow(1000, tier); s = (v < 100 ? v.toFixed(v < 10 ? 2 : 1) : Math.floor(v)) + UNITS[tier]; }
            else s = n.toExponential(2).replace('e+', 'e');
        }
        return (neg ? '-' : '') + s;
    }
    const SI = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y', 'R', 'Q'];
    function fmtW(w) {
        w = Math.abs(w || 0);
        if (w < 1000) return Math.round(w) + ' W';
        const t = Math.min(SI.length - 1, Math.floor(Math.log10(w) / 3)), v = w / Math.pow(1000, t);
        if (v >= 1e4) return w.toExponential(1).replace('e+', 'e') + ' W';
        return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v)) + ' ' + SI[t] + 'W';
    }
    const money = (n) => '$' + fmt(n);

    /* ---------- meta (survives recursion) ---------- */
    const freshMeta = () => ({ echoes: 0, total: 0, perks: {}, runs: 0, law: 'none', best: 0, laws: null, bps: [] });
    let M = Object.assign(freshMeta(), Arcade.load(META_KEY, {}) || {});
    M.bps = (M.bps || []).filter(b => b && b.nodes && b.nodes.length);
    const perk = (id) => M.perks[id] || 0;

    /* ---------- state ---------- */
    function freshState() {
        const shortcut = Math.min(perk('shortcut'), perk('archive'));
        const s = {
            v: 1, created: Date.now(), last: Date.now(), playT: 0,
            cash: 50 * Math.pow(10, perk('seed')), coin: 0, rp: 0, rep: 40 * perk('legend'), infl: 0,
            inv: {}, site: shortcut, nodes: [], links: [], nid: 1,
            techs: {}, rlv: {}, focus: {},
            ai: { ver: 0, c: 0, d: 0, tune: 1, tuned: false },
            cap: { solved: 0, streak: 0, lastT: -99, auto: 0 },
            con: { offers: [], active: [], next: 20, done: 0, failed: 0 },
            ev: { next: 360, cur: null, buffs: [], seen: {} },
            coinPrice: 250, coinHist: [], coinRebound: 0,
            breaker: { tripped: false, overT: 0 },
            batt: 0, day: 0.32, goal: 0,
            bills: { cur: {}, last: null, t: 0 },
            saleCut: 0,
            map: { sol: { got: {}, prog: {}, target: null }, galaxy: { got: {}, prog: {}, target: null }, universe: { got: {}, prog: {}, target: null } },
            stats: { earned: 0, compute: 0, captchas: 0, contracts: 0, minis: 0, broken: 0, built: 0 },
            won: false, wonAt: 0,
            law: M.law || 'none',
            rival: { t: 0, set: 0 },
            hist: [], seenSite: {}, mkt: {}, tutSkip: M.runs > 0,
        };
        if (shortcut > 0) s.cash += SITES[shortcut].req.cash * 0.6;
        const arch = perk('archive');
        TECHS.forEach(t => { if (t.site < arch) s.techs[t.id] = true; });
        return s;
    }
    let S = Object.assign(freshState(), Arcade.load(KEY, {}) || {});
    if (!S.mkt) S.mkt = {};
    if (!S.nodes.length) seedNodes();

    function seedNodes() {
        S.nodes = []; S.links = [];
        place('heap', 160, 220, true);
        place('stall', 520, 220, true);
    }

    /* ---------- effects ---------- */
    const FX = { m: {}, a: {} };
    const fx = (k) => (FX.m[k] === undefined ? 1 : FX.m[k]);
    const fxa = (k) => FX.a[k] || 0;
    const has = (k) => FX.m[k] !== undefined;
    function applyFx(obj, pow) {
        for (const k in obj) {
            const v = obj[k];
            if (k.endsWith('+')) FX.a[k] = (FX.a[k] || 0) + v * (pow || 1);
            else FX.m[k] = (FX.m[k] === undefined ? 1 : FX.m[k]) * Math.pow(v, pow || 1);
        }
    }
    function recomputeFx() {
        FX.m = {}; FX.a = {};
        TECHS.forEach(t => { if (S.techs[t.id] && t.fx) applyFx(t.fx); });
        REPEAT.forEach(r => { const l = S.rlv[r.id] || 0; if (l) applyFx({ [r.fx]: r.step }, l); });
        FOCUS.forEach(tr => tr.perks.forEach(p => { if (S.focus[p.id]) applyFx(p.fx); }));
        ECHO.forEach(e => { const l = perk(e.id); if (l) applyFx(e.fx(l)); });
        const law = LAWS.find(l => l.id === S.law);
        if (law) applyFx(law.fx);
        const v = S.ai.ver;
        if (v >= 7) applyFx({ rp: 1.5 });
        if (v >= 9) applyFx({ nobreaker: 1, infl: 1.25 });
        if (v >= 11) applyFx({ 'speed:@process': 1.5 });
        if (v >= 13) applyFx({ 'speed:probefab': 1.33, 'speed:nest': 1.33 });
        if (v >= 15) applyFx({ 'speed:exoticref': 1.4, 'speed:uniexo': 1.4 });
        if (S.focus.r6) applyFx({ 'speed:*': 1.1 }, v);
        for (const L in MAP) { const n = Object.keys(S.map[L].got).length; if (n) applyFx({ 'speed:*': 1 + MAP[L].bonus, rp: 1 + MAP[L].bonus }, n); }
        S.ev.buffs.forEach(b => applyFx({ [b.k]: b.m }));
        if (has('fragile')) delete FX.m.nobreaker;
        if (rivalAhead()) applyFx({ api: 0.7 });
    }

    /* ---------- helpers ---------- */
    const site = () => SITES[S.site];
    const def = (n) => NODES[n.t];
    const byId = (id) => S.nodes.find(n => n.id === id);
    const owned = (type) => S.nodes.reduce((a, n) => a + (n.t === type ? n.q : 0), 0);
    const slots = () => site().slots + fxa('slots+');
    const sellable = (it) => ITEMS[it] && !ITEMS[it].cur && ITEMS[it].price > 0;
    const isCur = (it) => ITEMS[it] && ITEMS[it].cur;
    function itemPrice(it) { return (ITEMS[it].price || 0) * fx('price:' + it); }
    // Buyers are limited: selling lots of one item pushes its price down; it recovers over a minute or two.
    function depth() {
        let reach = 1;
        for (const n of S.nodes) { const d = NODES[n.t]; if (d.kind === 'sell' && d.reach > reach) reach = d.reach; }
        return DEPTH[S.site] * reach;
    }
    function priceMult(it) { return 1 / (1 + (S.mkt[it] || 0) / (depth() * 60)); }
    function marketSell(it, k) {
        const m = priceMult(it);
        S.mkt[it] = (S.mkt[it] || 0) + k * itemPrice(it);
        return m;
    }
    // shack machines appear step by step as the tutorial goes (S.goal > index of the goal that unlocks them)
    const TUT_GATE = {};
    GOALS.forEach((g, i) => (g.unlock || []).forEach(id => { TUT_GATE[id] = i; }));
    function tutLocked(d) {
        return S.site === 0 && !S.tutSkip && TUT_GATE[d.id] !== undefined && S.goal <= TUT_GATE[d.id];
    }
    function lockReason(d) {
        if (d.site > S.site) return `🔒 at ${SITES[d.site].name}`;
        if (tutLocked(d)) return `🎯 unlocks with tutorial step ${TUT_GATE[d.id] + 1}`;
        if (d.tech && !S.techs[d.tech]) return `🔬 research ${TECHS.find(t => t.id === d.tech).name}`;
        if (d.tech === 'crypto' && S.site < 1) return '🔒 at the Garage';
        if (d.ai && S.ai.ver < d.ai) return `🧠 needs ${MODELS[d.ai - 1].name}`;
        if (d.focus && !S.focus[d.focus]) return '🎯 focus perk';
        return '';
    }
    function unlocked(d) {
        if (tutLocked(d)) return false;
        if (d.site > S.site) return false;
        if (d.tech && !S.techs[d.tech]) return false;
        if (d.ai && S.ai.ver < d.ai) return false;
        if (d.focus && !S.focus[d.focus]) return false;
        if (d.tech === 'crypto' && S.site < 1) return false;
        return true;
    }
    function nodeCost(type, extra) {
        const d = NODES[type], k = owned(type) + (extra || 0);
        const cash = d.cost * Math.pow(d.grow, k) * fx('cost');
        const items = {};
        for (const it in (d.items || {})) items[it] = Math.ceil(d.items[it] * Math.pow(1.12, k));
        return { cash, items };
    }
    function bulkCost(type, n) {
        let cash = 0; const items = {};
        for (let i = 0; i < n; i++) {
            const c = nodeCost(type, i);
            cash += c.cash;
            for (const it in c.items) items[it] = (items[it] || 0) + c.items[it];
        }
        return { cash, items };
    }
    function canAfford(c) {
        if (S.cash < c.cash) return false;
        for (const it in c.items) if ((S.inv[it] || 0) < c.items[it]) return false;
        return true;
    }
    function pay(c) {
        S.cash -= c.cash;
        for (const it in c.items) S.inv[it] -= c.items[it];
    }

    // income per second, smoothed — used to scale contracts, events and desk jobs to your stage of the game
    let incRate = 0, incAcc = 0, incT = 0, rpRate = 0, rpAcc = 0, computeRate = 0, compAcc = 0;
    const incUnit = () => Math.max(incRate, TASK_PAY[S.site] / 4);
    const rpUnit = () => Math.max(rpRate, 0.15 * Math.pow(20, S.site));
    // track=false for manual work, contracts and events, so they don't inflate the income they are scaled by
    function earn(amount, track) {
        S.cash += amount; S.stats.earned += amount;
        if (track !== false) incAcc += amount;
    }
    function bill(kind, amount) {
        S.cash -= amount;
        S.bills.cur[kind] = (S.bills.cur[kind] || 0) + amount;
    }
    function expr(v) {
        if (typeof v === 'number') return v;
        const [k, n] = String(v).split(':');
        if (k === 'inc') return incUnit() * +n;
        if (k === 'rp') return rpUnit() * +n;
        return +v || 0;
    }

    /* ---------- build / edit ---------- */
    function place(type, x, y, free) {
        const d = NODES[type];
        if (!free) {
            if (S.nodes.length >= slots()) return { err: 'No free slots here. Upgrade an existing machine or move somewhere bigger.' };
            if (!unlocked(d)) return { err: 'Locked.' };
            const c = nodeCost(type);
            if (!canAfford(c)) return { err: 'Not enough ' + (S.cash < c.cash ? 'cash' : 'items in storage') + '.' };
            pay(c);
        }
        const n = { id: S.nid++, t: type, x: Math.round(x), y: Math.round(y), q: 1, c: 1, p: 0, ib: {}, ob: {}, on: true, br: false, act: 0, want: 0, st: 'idle' };
        if (d.kind === 'dyson') n.abs = 0;
        S.nodes.push(n);
        S.stats.built++;
        return { node: n };
    }
    function addUnits(n, k) {
        const c = bulkCost(n.t, k);
        if (!canAfford(c)) return false;
        pay(c); n.q += k;
        return true;
    }
    function sellUnit(n) {
        if (n.q <= 1) return removeNode(n);
        n.q--;
        S.cash += nodeCost(n.t).cash * 0.5;
        return true;
    }
    function removeNode(n) {
        let refund = 0;
        const q = n.q;
        n.q = 0;
        for (let i = 0; i < q; i++) refund += nodeCost(n.t, i).cash * 0.5;
        S.cash += refund;
        S.nodes = S.nodes.filter(x => x !== n);
        S.links = S.links.filter(l => l.a !== n.id && l.b !== n.id);
        return true;
    }
    function link(a, b) {
        if (a === b) return { err: 'A machine cannot feed itself.' };
        const A = byId(a), B = byId(b);
        if (!A || !B) return { err: 'Missing machine.' };
        if (S.links.some(l => l.a === a && l.b === b)) return { err: 'Already connected.' };
        const outs = producible(A);
        if (!outs.length) return { err: `${def(A).name} has no outputs.` };
        if (!outs.some(it => accepts(B, it))) return { err: `${def(B).name} can't use anything ${def(A).name} makes.` };
        S.links.push({ a, b, f: null, flow: 0 });
        return { ok: true };
    }
    function unlink(l) { S.links = S.links.filter(x => x !== l); }
    // items a node can put on a cable
    function producible(n) {
        const d = def(n);
        return Object.keys(d.out).filter(it => !isCur(it));
    }
    function accepts(n, it) {
        const d = def(n);
        if (isCur(it)) return false;
        switch (d.kind) {
            case 'sell': return sellable(it);
            case 'store': return true;
            case 'train': return it === 'compute' || it === 'data' || it === 'labels';
            case 'dyson': return it === 'panel';
            default: return d.in[it] !== undefined;
        }
    }

    /* ---------- the tick ---------- */
    let toasts = [];
    const note = (msg, type) => toasts.push([msg, type]);
    function sunlight() {
        if (site().space) return fx('solar');
        const s = Math.sin(S.day * Math.PI * 2);
        return clamp(s * 1.4, 0, 1) * fx('solar');
    }
    function modelNeed() {
        const m = MODELS[S.ai.ver];
        if (!m) return null;
        const t = S.ai.tune || 1;
        return { c: m.compute * fx('need:compute') / t, d: m.data * fx('need:data') / t };
    }
    function condFactor(n) { return n.c >= 0.5 ? 1 : 0.6 + 0.8 * n.c; }
    function speedOf(n, d) {
        return n.q * fx('speed:*') * fx('speed:@' + d.cat) * fx('speed:' + n.t) * condFactor(n);
    }
    function capIn(n, d, it, sp) {
        if (d.kind === 'sell' || d.kind === 'store') return d.rate * n.q * fx('speed:' + n.t) * 3 + 1;
        if (d.kind === 'train') { const r = (d.rate[it === 'labels' ? 'data' : it] || 0) * n.q * fx('train'); return r * 3 + 1; }
        if (d.kind === 'launch') return d.rate * n.q * 3 + 1;
        if (d.kind === 'dyson') return 1e9;
        const need = d.in[it] || 0, cps = (sp || 1) / (d.time || 1);
        return need * Math.max(4, cps * 6);
    }
    function capOut(n, d, it, sp) {
        const k = d.out[it] || 0, cps = (sp || 1) / (d.time || 1);
        return k * Math.max(4, cps * 6);
    }

    const P = { D: 0, sup: 0, free: 0, fuel: 0, grid: 0, gridCap: 0, batt: 0, battCap: 0, short: 0, sat: 1, heat: 0, cool: 0, ratio: 0, temp: 20, thr: 1, fuelCap: 0 };
    function step(dt, offline) {
        S.playT += dt;
        S.day = (S.day + dt / DAY) % 1;
        const st = site();

        // buffs run out
        if (S.ev.buffs.length) {
            let ch = false;
            S.ev.buffs.forEach(b => { b.t -= dt; if (b.t <= 0) ch = true; });
            if (ch) { S.ev.buffs = S.ev.buffs.filter(b => b.t > 0); recomputeFx(); }
        }

        /* ---- power ---- */
        const sun = sunlight();
        let D = 0, free = 0, fuelCap = 0, gridCap = 0, battCap = 0;
        const fuelGens = [];
        const pw = fx('power:*');
        for (const n of S.nodes) {
            const d = def(n);
            const live = n.on && !n.br;
            if (d.kind === 'batt') { if (live) battCap += d.cap * n.q; continue; }
            if (d.kind === 'grid') { if (live && st.grid) gridCap += d.cap * n.q; continue; }
            if (d.kind === 'dyson') { free += n.abs * 5e16; continue; }
            if (d.kind === 'gen') {
                if (!live) continue;
                const out = -d.w * n.q * fx('speed:' + n.t);
                if (d.solar) free += out * sun;
                else if (d.fuel || d.in.deut) { fuelCap += d.in.deut ? (n.ib.deut > 0 ? out : 0) : out; fuelGens.push([n, d, d.in.deut ? (n.ib.deut > 0 ? out : 0) : out]); }
                else free += out;
                continue;
            }
            if (d.w > 0 && live && !S.breaker.tripped) D += d.w * n.q * pw * (d.kind === 'cool' ? 1 : n.want);
        }
        const debtCut = S.cash < -Math.max(200, incUnit() * 120);
        if (debtCut) gridCap = 0;
        battCap *= 1;
        S.batt = Math.min(S.batt, battCap);
        let R = D - free, battUse = 0, fuelUse = 0, gridUse = 0;
        if (R < 0) { S.batt = Math.min(battCap, S.batt - R * dt); R = 0; }
        if (R > 0 && S.batt > 0) { battUse = Math.min(R, S.batt / dt); S.batt -= battUse * dt; R -= battUse; }
        if (R > 0 && fuelCap > 0) { fuelUse = Math.min(R, fuelCap); R -= fuelUse; }
        if (R > 0 && gridCap > 0) { gridUse = Math.min(R, gridCap); R -= gridUse; }
        const sat = D > 0 ? clamp(1 - R / D, 0, 1) : 1;
        // fuel: pay per kW·s actually generated, split across generators by capacity
        if (fuelUse > 0) {
            for (const [n, d, cap] of fuelGens) {
                if (!(cap > 0)) continue;
                const share = fuelUse * cap / fuelCap;
                if (d.fuel) bill('fuel', share / 1000 * d.fuel * fx('fuelcost') * dt);
                if (d.in.deut) { const burn = n.q / d.time * (share / cap) * dt; n.ib.deut = Math.max(0, n.ib.deut - burn); }
                n.act = n.act * 0.9 + 0.1 * (share / Math.max(1, cap));
            }
        }
        if (!(fuelUse > 0)) for (const g of fuelGens) g[0].act *= 0.9;
        if (gridUse > 0) bill('power', gridUse / 1000 * st.gridPrice * fx('grid') * dt);
        // breaker: early sites trip on a heavy overload unless you own Smart Breakers
        const breakerRisk = (S.site <= 1 || has('fragile')) && !has('nobreaker');
        // Only overloading a generator or the grid trips it. Not enough sun just means a brownout.
        if (breakerRisk && !S.breaker.tripped && sat < 0.75 && fuelCap + gridCap > 0 && D > 0 && !offline) {
            S.breaker.overT += dt;
            if (S.breaker.overT > 4) { S.breaker.tripped = true; S.breaker.overT = 0; note('⚡ Breaker tripped! Your machines are off. Fix it in the 💼 Work tab.', 'bad'); }
        } else S.breaker.overT = Math.max(0, S.breaker.overT - dt);
        const live = S.breaker.tripped ? 0 : sat;

        /* ---- heat ---- */
        let heat = 0, cool = st.cooling;
        const ht = fx('heat:*');
        for (const n of S.nodes) {
            const d = def(n);
            if (!n.on || n.br) continue;
            if (d.kind === 'cool') cool += d.cool * n.q * fx('cool') * (d.w > 0 ? live : 1) * condFactor(n);
            else if (d.w > 0 && !d.noHeat) heat += d.w * n.q * pw * n.want * live * ht;
        }
        cool *= fx('cool');
        const ratio = heat / Math.max(1, cool);
        const thr = ratio > 1 ? 1 / ratio : 1;
        const wearHeat = ratio > 1 ? 1 + 2.5 * (ratio - 1) : 1;
        Object.assign(P, { D, free, fuel: fuelUse, fuelCap, grid: gridUse, gridCap, batt: battUse, battCap, short: R, sat: live, heat, cool, ratio, thr, temp: 18 + 24 * Math.min(ratio, 2.5), sun, debtCut });

        /* ---- machines ---- */
        let need = modelNeed();
        const wearMul = fx('wear:*');
        const rateA = 1 - Math.exp(-dt / 3);
        for (const it in S.mkt) { S.mkt[it] *= Math.exp(-dt / 60); if (S.mkt[it] < 1e-6) delete S.mkt[it]; }
        for (const n of S.nodes) {
            const d = def(n);
            if (!n.on) { n.st = 'off'; n.want = 0; n.act *= 0.9; continue; }
            if (n.br) { n.st = 'broken'; n.want = 0; n.act = 0; continue; }
            const sp = speedOf(n, d);
            const usesPower = d.w > 0;
            const pf = usesPower ? live : 1;
            const hf = usesPower && !d.noHeat ? thr : 1;
            let worked = 0, wanted = 0;
            switch (d.kind) {
                case 'gen': case 'grid': case 'batt': case 'cool': {
                    if (d.kind === 'grid' && !st.grid) n.st = 'nogrid';
                    else if (d.kind === 'grid' && debtCut) n.st = 'cut';
                    else n.st = 'ok';
                    if (d.kind === 'gen' && d.in.deut && !(n.ib.deut > 0)) n.st = 'idle';
                    if (d.kind === 'gen' && d.solar && sun < 0.05) n.st = 'night';
                    wanted = 1; worked = d.kind === 'gen' ? (d.solar ? sun : 1) : 1;
                    break;
                }
                case 'sell': {
                    let budget = d.rate * n.q * fx('speed:' + n.t) * dt;
                    const pm = (d.price || 1) * fx('sell');
                    const keep = (1 - st.tax * fx('tax')) * (1 - S.saleCut);
                    let any = false, low = 1;
                    for (const it in n.ib) {
                        const have = n.ib[it];
                        if (have <= 0 || budget <= 0) continue;
                        const k = Math.min(have, budget);
                        n.ib[it] -= k; budget -= k; any = true;
                        const m = marketSell(it, k);
                        low = Math.min(low, m);
                        const gross = k * itemPrice(it) * pm * m;
                        earn(gross * keep);
                        rec(n, 'cash', gross * keep);
                        if (st.tax) S.bills.cur.tax = (S.bills.cur.tax || 0) + gross * st.tax * fx('tax');
                    }
                    wanted = worked = any ? 1 : 0;
                    n.st = any ? (low < 0.5 ? 'flooded' : 'ok') : 'idle';
                    break;
                }
                case 'store': {
                    let any = false;
                    for (const it in n.ib) { const k = n.ib[it]; if (k > 0) { S.inv[it] = (S.inv[it] || 0) + k; n.ib[it] = 0; any = true; rec(n, it, k); } }
                    wanted = worked = any ? 1 : 0; n.st = any ? 'ok' : 'idle';
                    break;
                }
                case 'train': {
                    if (!need) { n.st = 'done'; break; }
                    const f = sp * fx('train') * pf * hf * dt;   // speedOf already includes the unit count
                    const rc = d.rate.compute * f, rd = d.rate.data * f;
                    let tc = 0, td = 0;
                    if (S.ai.c < need.c) { tc = Math.min(n.ib.compute || 0, rc, need.c - S.ai.c); n.ib.compute = (n.ib.compute || 0) - tc; S.ai.c += tc; }
                    if (S.ai.d < need.d) {
                        td = Math.min(n.ib.data || 0, rd, need.d - S.ai.d); n.ib.data = (n.ib.data || 0) - td; S.ai.d += td;
                        const left = Math.min(rd - td, need.d - S.ai.d);
                        if (left > 0 && n.ib.labels > 0) { const tl = Math.min(n.ib.labels, left / 4); n.ib.labels -= tl; S.ai.d += tl * 4; td += tl * 4; }
                    }
                    rec(n, 'compute', tc); rec(n, 'data', td);
                    const any = (n.ib.compute > 0 || n.ib.data > 0 || n.ib.labels > 0 || tc > 0 || td > 0);
                    wanted = any ? 1 : 0;
                    worked = (tc > 0 || td > 0) ? 1 : 0;
                    n.st = worked ? (live < 1 ? 'nopower' : 'ok') : 'idle';
                    if (S.ai.c >= need.c && S.ai.d >= need.d) { finishModel(); need = modelNeed(); }
                    break;
                }
                case 'launch': {
                    const L = S.map[d.layer], it = Object.keys(d.in)[0];
                    if (L.target === null || L.target === undefined || S.site < MAP[d.layer].sites) { n.st = 'notarget'; break; }
                    let k = Math.min(n.ib[it] || 0, d.rate * n.q * dt);
                    if (k > 0) { n.ib[it] -= k; feedMap(d.layer, k); worked = wanted = 1; rec(n, it, k); }
                    n.st = worked ? 'ok' : 'idle';
                    break;
                }
                case 'dyson': {
                    const k = Math.floor(n.ib.panel || 0);
                    if (k > 0) { n.abs += k; n.ib.panel -= k; worked = 1; }
                    n.st = n.abs > 0 ? 'ok' : 'idle';
                    wanted = 1;
                    break;
                }
                case 'repair': {
                    if (live <= 0) { n.st = 'nopower'; break; }
                    n.rt = (n.rt || 0) + dt * n.q * live;
                    for (const m of S.nodes) if (!m.br && m.c < 1) m.c = Math.min(1, m.c + dt * n.q / 300);
                    if (n.rt > 8) {
                        const b = S.nodes.find(m => m.br);
                        if (b) { b.br = false; b.c = 1; n.rt = 0; }
                    }
                    wanted = worked = 1; n.st = 'ok';
                    break;
                }
                default: {   // proc
                    const cps = sp * pf * hf / d.time;
                    let avail = Infinity;
                    for (const it in d.in) avail = Math.min(avail, (n.ib[it] || 0) / d.in[it]);
                    let room = Infinity;
                    for (const it in d.out) if (!isCur(it)) room = Math.min(room, (capOut(n, d, it, sp) - (n.ob[it] || 0)) / d.out[it]);
                    const opex = (d.opex || 0) * fx('opex');
                    const afford = opex > 0 ? Math.max(0, S.cash) / opex : Infinity;
                    wanted = avail >= 1 && room >= 1 && afford >= 1 ? 1 : (avail >= 1 && room >= 1 ? 0.2 : 0);
                    if (wanted >= 1) n.p += cps * dt;
                    let k = Math.min(Math.floor(n.p), Math.floor(avail), Math.floor(room), Math.floor(afford));
                    if (k > 0) {
                        for (const it in d.in) n.ib[it] -= d.in[it] * k;
                        for (const it in d.out) produce(n, d, it, d.out[it] * k);
                        if (opex) bill('stock', opex * k);
                        n.p -= k; worked = 1;
                    }
                    if (n.p > 1 && k === 0) n.p = 1;
                    n.st = avail < 1 ? 'idle' : room < 1 ? 'full' : afford < 1 ? 'broke' : (usesPower && live < 0.98) ? 'nopower' : (hf < 0.98 ? 'hot' : 'ok');
                    if (wanted < 1) worked = 0;
                    else worked = Math.max(worked, 1);
                }
            }
            n.want = n.want * 0.8 + 0.2 * wanted;
            // smoothed per-second rates for the numbers on each card
            if (n.ra || n.pr) {
                n.pr = n.pr || {};
                const ra = n.ra || {};
                for (const k in ra) if (n.pr[k] === undefined) n.pr[k] = 0;
                for (const k in n.pr) {
                    n.pr[k] += ((ra[k] || 0) / dt - n.pr[k]) * rateA;
                    if (n.pr[k] < 1e-9 && !ra[k]) delete n.pr[k];
                }
                n.ra = null;
            }
            if (d.kind !== 'gen') n.act = n.act * 0.9 + 0.1 * worked;
            // wear and tear
            if (d.wear > 0 && n.act > 0.05) {
                n.c -= dt * n.act / d.wear * wearMul * (usesPower && !d.noHeat ? wearHeat : 1);
                if (n.c <= 0) {
                    n.c = 0; n.br = true; S.stats.broken++;
                    note(`🔧 ${d.name} broke down. Repair it (click it).`, 'bad');
                }
            }
            if (S.ai.ver >= 6 && !n.br && n.c < 1) n.c = Math.min(1, n.c + dt / 1500);
        }

        /* ---- cables ---- */
        for (const l of S.links) l.mv = 0;
        const idx = new Map();
        for (const n of S.nodes) idx.set(n.id, n);
        const outLinks = {};
        for (const l of S.links) (outLinks[l.a] = outLinks[l.a] || []).push(l);
        for (const n of S.nodes) {
            const ls = outLinks[n.id];
            if (!ls) continue;
            for (const it in n.ob) {
                const have = n.ob[it];
                if (!(have > 0)) continue;
                const tg = [];
                for (const l of ls) {
                    if (l.f && l.f !== it) continue;
                    const b = idx.get(l.b);
                    if (!b || !accepts(b, it)) continue;
                    const bd = def(b), room = capIn(b, bd, it, speedOf(b, bd)) - (b.ib[it] || 0);
                    if (room > 0) tg.push([l, b, room]);
                }
                if (!tg.length) continue;
                let left = have;
                tg.sort((x, y) => x[2] - y[2]);
                for (let i = 0; i < tg.length; i++) {
                    const share = left / (tg.length - i);
                    const mv = Math.min(share, tg[i][2]);
                    tg[i][1].ib[it] = (tg[i][1].ib[it] || 0) + mv;
                    tg[i][0].mv += mv;
                    if (mv > 0) tg[i][0].it = it;
                    left -= mv;
                }
                n.ob[it] = left;
            }
        }
        for (const l of S.links) l.flow = (l.flow || 0) * 0.92 + 0.08 * (l.mv / dt);

        /* ---- bills ---- */
        const bm = fx('bills');
        if (st.rent) bill('rent', st.rent * bm * dt);
        if (st.net) bill('internet', st.net * bm * dt);
        if (S.cash < 0) bill('interest', -S.cash * 0.0001 * dt);
        S.bills.t += dt;
        if (S.bills.t >= MONTH) { S.bills.last = S.bills.cur; S.bills.cur = {}; S.bills.t = 0; }

        /* ---- desk jobs on autopilot ---- */
        const ar = autoCapRate();
        if (ar > 0) {
            S.cap.auto += ar * dt;
            while (S.cap.auto >= 1) { S.cap.auto -= 1; taskReward(true); }
        }

        /* ---- slow timers ---- */
        incT += dt;
        if (incT >= 1) {
            incRate = incRate ? incRate * 0.85 + 0.15 * (incAcc / incT) : incAcc / incT;
            rpRate = rpRate ? rpRate * 0.85 + 0.15 * (rpAcc / incT) : rpAcc / incT;
            computeRate = computeRate * 0.85 + 0.15 * (compAcc / incT);
            incAcc = 0; rpAcc = 0; compAcc = 0; incT = 0;
            if (!offline) slowTick();
            else coinTick();
        }
        S.rival.t += dt;
    }

    function rec(n, k, v) { if (v > 0) { n.ra = n.ra || {}; n.ra[k] = (n.ra[k] || 0) + v; } }
    function produce(n, d, it, k) {
        if (it === 'cash') {
            let v = k;
            if (d.captchaScale) { v *= TASK_PAY[S.site] * fx('captcha') * 0.6; earn(v, false); rec(n, 'cash', v); return; }
            if (d.aiScale !== undefined) v *= Math.pow(1.7, S.ai.ver - d.aiScale) * fx('api');
            v *= (1 - site().tax * fx('tax')) * (1 - S.saleCut);
            earn(v); rec(n, 'cash', v);
        } else if (it === 'rp') { const v = k * fx('rp'); S.rp += v; rpAcc += v; rec(n, 'rp', v); }
        else if (it === 'coin') { S.coin += k; rec(n, 'coin', k); }
        else if (it === 'infl') { S.infl += k * fx('infl'); rec(n, 'infl', k * fx('infl')); }
        else if (it === 'rep') S.rep += k;
        else {
            n.ob[it] = (n.ob[it] || 0) + k;
            rec(n, it, k);
            if (it === 'compute') { compAcc += k; S.stats.compute += k; }
        }
    }

    let hist10 = 0;
    function slowTick() {
        coinTick();
        // contracts
        if (!has('nocontracts')) {
            S.con.next -= 1;
            const maxOffers = conSlots();
            S.con.offers = S.con.offers.filter(o => (o.exp -= 1) > 0);
            const open = S.site > 0 || S.tutSkip || S.goal >= 4;
            if (S.site === 0 && !S.tutSkip && S.goal === 4 && !S.con.offers.concat(S.con.active).some(c => c.starter)) S.con.offers.unshift(starterContract());
            if (open && (S.con.next <= 0 || S.con.offers.length < Math.min(2, maxOffers))) {
                if (S.con.offers.length < maxOffers) S.con.offers.push(makeContract());
                S.con.next = 90 + rnd() * 60;
            }
            S.con.active.forEach(c => { c.left -= 1; });
            const failed = S.con.active.filter(c => c.left <= 0);
            failed.forEach(c => { S.rep = Math.max(0, S.rep - 2); S.con.failed++; note(`⌛ Contract failed: ${c.title} (−2 ⭐)`, 'bad'); });
            S.con.active = S.con.active.filter(c => c.left > 0);
            if (S.ai.ver >= 5) S.con.active.filter(c => c.kind === 'deliver').forEach(c => { if ((S.inv[c.item] || 0) >= c.qty) completeContract(c, true); });
        }
        // events
        if (!S.ev.cur) {
            S.ev.next -= 1 * fx('eventrate');
            if (S.ev.next <= 0) fireEvent();
        }
        if (S.coinRebound > 0 && --S.coinRebound === 0) { S.coinPrice *= 1.9; note('📈 CrypToken bounced back!', 'good'); }
        // rival
        if (has('rival')) {
            const before = rivalVer._last || 0, now = rivalVer();
            if (now > before && now > 0) note(`👁️ NEXUS trained ${MODELS[now - 1] ? MODELS[now - 1].name.replace(/-\d+$/, '') + ' level ' + now : 'another model'}.`, 'bad');
            rivalVer._last = now;
            if (rivalAhead() !== rivalAhead._was) { rivalAhead._was = rivalAhead(); recomputeFx(); }
        }
        checkGoals();
        hist10++;
        if (hist10 >= 10) { hist10 = 0; S.hist.push([Math.round(S.playT), incRate, computeRate, rpRate]); if (S.hist.length > 360) S.hist.shift(); }
    }

    /* ---------- crypto ---------- */
    function coinBase() { return 250 * Math.pow(6, Math.max(0, S.site - 1)); }
    function coinTick() {
        const base = coinBase();
        const drift = Math.log(base / S.coinPrice) * 0.01;
        const shock = (rnd() + rnd() + rnd() - 1.5) * 0.045 + (rnd() < 0.01 ? (rnd() - 0.45) * 0.5 : 0);
        S.coinPrice = Math.max(base * 0.05, S.coinPrice * Math.exp(drift + shock));
        S.coinHist.push(S.coinPrice);
        if (S.coinHist.length > 180) S.coinHist.shift();
    }
    function trade(amount) {   // + buy coins with cash, - sell coins
        const fee = has('nofee') ? 0 : 0.01;
        if (amount > 0) {
            const cost = amount * S.coinPrice * (1 + fee);
            if (S.cash < cost) return false;
            S.cash -= cost; S.coin += amount;
        } else {
            const k = Math.min(S.coin, -amount);
            if (k <= 0) return false;
            S.coin -= k; earn(k * S.coinPrice * (1 - fee), false);
        }
        return true;
    }

    function sellInv(it) {
        const q = S.inv[it] || 0;
        if (q <= 0 || !sellable(it)) return 0;
        const v = q * itemPrice(it) * 0.8 * fx('sell') * marketSell(it, q) * (1 - site().tax * fx('tax'));
        S.inv[it] = 0; earn(v, false);
        return v;
    }

    /* ---------- AI training ---------- */
    function finishModel() {
        const m = MODELS[S.ai.ver];
        S.ai.ver++; S.ai.c = 0; S.ai.d = 0; S.ai.tune = 1; S.ai.tuned = false;
        recomputeFx();
        note(`🧠 ${m.name} trained! ${m.perk}`, 'gold');
        Arcade.sfx('win');
        Arcade.report('aiver', S.ai.ver);
        Arcade.addXP(20 + S.ai.ver * 10);
        Eng.onModel && Eng.onModel(m);
    }
    function setTune(mult) {
        if (S.ai.tuned) return;
        const mx = 1.5 * fx('tunemax');
        S.ai.tune = clamp(mult, 1, mx);
        S.ai.tuned = true;
    }

    /* ---------- desk jobs ---------- */
    function autoCapRate() {
        const v = S.ai.ver;
        const base = v >= 8 ? 0.33 : v >= 2 ? 1 / 15 : v >= 1 ? 1 / 30 : 0;
        return base + fxa('autocap+');
    }
    function taskPay() { return (TASK_PAY[S.site] + incUnit() * 2) * fx('captcha'); }
    function taskReward(auto) {
        const st = site(), type = st.task;
        const streak = auto ? 1 : 1 + 0.1 * S.cap.streak;
        const pay = taskPay() * streak * (auto ? 0.5 : 1);
        earn(pay, false);
        S.stats.captchas++;
        const side = (auto && S.ai.ver < 8) ? 0 : fx('capbonus') * (auto ? 0.5 : 1);
        let sideTxt = '';
        if (side > 0) {
            if (type === 'label') { const q = Math.max(5, incUnit() * 3 / ITEMS.labels.price) * side; S.inv.labels = (S.inv.labels || 0) + q; sideTxt = ` +${fmt(q)} 🏷️`; }
            else if (type === 'rlhf') { const nd = modelNeed(); if (nd) { S.ai.c = Math.min(nd.c, S.ai.c + nd.c * 0.004 * side); S.ai.d = Math.min(nd.d, S.ai.d + nd.d * 0.004 * side); sideTxt = ' +0.4% training'; } }
            else if (type === 'eval') { const q = rpUnit() * 8 * side; S.rp += q; sideTxt = ` +${fmt(q)} 🔬`; }
            else if (type === 'turing') { const q = 0.5 * side * fx('infl'); S.infl += q; sideTxt = ` +${fmt(q)} 🏛️`; }
            else if (type === 'signal') { const q = rpUnit() * 8 * side; S.rp += q; S.rep += 0.1 * side; sideTxt = ` +${fmt(q)} 🔬`; }
        }
        if (auto) return;
        S.cap.solved++;
        Arcade.count('captcha');
        return { pay, sideTxt };
    }
    function solveTask(ok) {
        if (!ok) { S.cap.streak = 0; return null; }
        S.cap.streak = S.playT - S.cap.lastT < 20 ? Math.min(10, S.cap.streak + 1) : 0;
        S.cap.lastT = S.playT;
        S.con.active.forEach(c => { if (c.kind === 'captchas') c.got = (c.got || 0) + 1; });
        return taskReward(false);
    }

    /* ---------- contracts ---------- */
    function conSlots() { return 3 + fxa('slots_c+') + (S.ai.ver >= 3 ? 1 : 0); }
    function itemsAt(s) {
        // things you can make at this site, weighted toward what's new here
        const set = {};
        for (const id in NODES) {
            const d = NODES[id];
            if (d.site > s || !unlocked(d)) continue;
            for (const it in d.out) if (sellable(it) && it !== 'compute' && it !== 'raw') set[it] = Math.max(set[it] || 0, d.site);
        }
        return Object.keys(set).map(it => [it, set[it]]);
    }
    let conId = 1;
    function starterContract() {
        return { id: conId++, kind: 'deliver', item: 'parts', qty: 6, client: 'Dusty Pete', title: 'Deliver 6 Salvaged Parts', icon: ITEMS.parts.icon,
                 reward: { cash: 45, rep: 2 }, time: 1800, exp: 99999, starter: true };
    }
    function makeContract() {
        conId = Math.max(conId, ...S.con.offers.concat(S.con.active).map(c => c.id + 1), 1);
        const client = CLIENTS[Math.min(CLIENTS.length - 1, S.site * 2 + ((rnd() * 3) | 0))];
        const mult = fx('contract') * Math.min(3, 1 + S.rep / 300);
        const pool = itemsAt(S.site);
        if (rnd() < 0.62 && pool.length) {
            const top = Math.max(...pool.map(p => p[1]));
            const p = rnd() < 0.65 ? pick(pool.filter(x => x[1] >= top - 1)) : pick(pool);
            const it = p[0];
            const value = incUnit() * (60 + rnd() * 120);
            let qty = Math.max(1, value / itemPrice(it));
            const mag = Math.pow(10, Math.floor(Math.log10(qty)));
            qty = Math.max(1, Math.round(qty / mag * 2) / 2 * mag);
            return { id: conId++, kind: 'deliver', item: it, qty, client, title: `Deliver ${fmt(qty)} ${ITEMS[it].name}`, icon: ITEMS[it].icon,
                     reward: { cash: qty * itemPrice(it) * 2 * mult, rep: 1 + Math.floor(S.site / 2) }, time: 420 + Math.round(rnd() * 300), exp: 300 };
        }
        const jobs = JOBS.filter(j => (j.site || 0) <= S.site && (j.kind !== 'hack' || has('rival') || rnd() < 0.3));
        const j = pick(jobs);
        const o = { id: conId++, kind: j.kind, mini: j.mini, client, title: j.name, icon: j.icon, time: 300, exp: 300,
                    reward: { cash: incUnit() * (80 + rnd() * 60) * mult, rep: 2 + Math.floor(S.site / 2) } };
        if (j.kind === 'captchas') { o.n = j.n[0] + ((rnd() * (j.n[1] - j.n[0])) | 0); o.title = `Solve ${o.n} desk jobs for ${client}`; o.got = 0; }
        if (j.kind === 'hack') { o.reward.cash *= 1.5; o.title = has('rival') ? 'Sabotage NEXUS (pushes the rival back)' : j.name; }
        return o;
    }
    function acceptContract(o) {
        if (S.con.active.length >= 3) return false;
        S.con.offers = S.con.offers.filter(x => x !== o);
        o.left = o.time;
        S.con.active.push(o);
        return true;
    }
    function completeContract(c, auto) {
        if (c.kind === 'deliver') {
            if ((S.inv[c.item] || 0) < c.qty) return false;
            S.inv[c.item] -= c.qty;
        }
        if (c.kind === 'captchas' && (c.got || 0) < c.n) return false;
        earn(c.reward.cash, false);
        const rg = c.reward.rep * fx('rep*');
        S.rep += rg;
        if (c.kind === 'hack' && has('rival')) S.rival.set += 1800;
        S.con.active = S.con.active.filter(x => x !== c);
        S.con.done++; S.stats.contracts++;
        note(`${auto ? '🤖 Your agents delivered' : '✅ Contract done'}: ${c.title} — +${money(c.reward.cash)} +${fmt(rg)} ⭐`, 'good');
        Arcade.count('contract');
        return true;
    }
    function abandonContract(c) { S.con.active = S.con.active.filter(x => x !== c); S.rep = Math.max(0, S.rep - 1); }

    /* ---------- events ---------- */
    function fireEvent() {
        const pool = EVENTS.filter(e => e.site.includes(S.site));
        if (!pool.length) { S.ev.next = 400; return; }
        const fresh = pool.filter(e => !S.ev.seen[e.id]);
        const e = pick(fresh.length ? fresh : pool);
        S.ev.seen[e.id] = (S.ev.seen[e.id] || 0) + 1;
        S.ev.cur = { id: e.id, t: S.playT };
        S.ev.next = 360 + rnd() * 360;
        note(`📰 ${e.title}`, 'gold');
        Eng.onEvent && Eng.onEvent(e);
    }
    function eventCost(ch) { return ch.cost ? expr(ch.cost) : 0; }
    // returns {mini, reward, fail} when the choice needs a minigame first
    function chooseEvent(i) {
        const e = EVENTS.find(x => x.id === (S.ev.cur && S.ev.cur.id));
        if (!e) return null;
        const ch = e.choices[i];
        const cost = eventCost(ch);
        if (S.cash < cost) return { err: 'Not enough cash.' };
        S.cash -= cost;
        S.ev.cur = null;
        if (ch.fx.mini) return { mini: ch.fx.mini, reward: ch.fx.reward, fail: ch.fx.fail };
        applyEventFx(ch.fx);
        return { ok: true };
    }
    function applyEventFx(f) {
        if (!f) return;
        const msgs = [];
        if (f.buff) { addBuff(f.buff[0], f.buff[1], f.buff[2]); }
        if (f.loseInv) { for (const it in S.inv) S.inv[it] *= (1 - f.loseInv); msgs.push(`Lost ${Math.round(f.loseInv * 100)}% of your storage.`); }
        if (f.chanceBreak) { if (rnd() < f.chanceBreak[1]) breakRandom(1, f.chanceBreak[0]); else msgs.push('Nothing broke. Lucky.'); }
        if (f.breakRandom) breakRandom(f.breakRandom);
        if (f.item) { const it = f.item[0], q = String(f.item[1]).startsWith('inc') ? expr(f.item[1]) / itemPrice(it) : f.item[1]; S.inv[it] = (S.inv[it] || 0) + q; msgs.push(`+${fmt(q)} ${ITEMS[it].icon} ${ITEMS[it].name} in storage.`); }
        if (f.cash) { const v = expr(f.cash); if (v >= 0) earn(v, false); else S.cash += v; msgs.push(`${v >= 0 ? '+' : ''}${money(v)}`); }
        if (f.rep) { const v = f.rep > 0 ? f.rep * fx('rep*') : f.rep; S.rep = Math.max(0, S.rep + v); msgs.push(`${v > 0 ? '+' : ''}${fmt(v)} ⭐`); }
        if (f.infl) { S.infl = Math.max(0, S.infl + f.infl); msgs.push(`${f.infl > 0 ? '+' : ''}${f.infl} 🏛️`); }
        if (f.rp) { const v = expr(f.rp); S.rp += v; msgs.push(`+${fmt(v)} 🔬`); }
        if (f.sellCoin) { trade(-S.coin); }
        if (f.coinMul) S.coinPrice *= f.coinMul;
        if (f.coinRebound) S.coinRebound = 300;
        if (f.invest) { const v = expr(f.invest) * fx('invest'); earn(v, false); S.saleCut = Math.min(0.3, S.saleCut + (f.saleCut || 0)); msgs.push(`+${money(v)} now, ${Math.round(S.saleCut * 100)}% of sales go to investors.`); }
        if (f.gamble) { applyEventFx(rnd() < f.gamble[0] ? f.gamble[1] : f.gamble[2]); return; }
        if (msgs.length) note(msgs.join(' '), 'gold');
    }
    function addBuff(k, m, t) {
        S.ev.buffs.push({ k, m, t, max: t });
        recomputeFx();
    }
    function breakRandom(k, cat) {
        const pool = S.nodes.filter(n => !n.br && def(n).w !== 0 && (!cat || def(n).cat === cat));
        for (let i = 0; i < k && pool.length; i++) {
            const n = pool.splice((rnd() * pool.length) | 0, 1)[0];
            n.br = true; n.c = 0; S.stats.broken++;
            note(`💥 ${def(n).name} broke!`, 'bad');
        }
    }

    /* ---------- repairs and minigame rewards ---------- */
    function repairCost(n) { return has('fastfix') ? 0 : nodeCost(n.t).cash * 0.3; }
    function repair(n, paid) {
        if (!n.br && n.c >= 1) return false;
        if (paid) { const c = repairCost(n); if (S.cash < c) return false; S.cash -= c; }
        n.br = false; n.c = 1;
        return true;
    }
    function resetBreaker(paid) {
        if (paid) { const c = incUnit() * 30; if (S.cash < c) return false; S.cash -= c; }
        S.breaker.tripped = false; S.breaker.overT = 0;
        return true;
    }
    function miniReward(kind) {
        S.stats.minis++;
        const m = fx('mini');
        if (kind === 'debug') {
            const b = S.ev.buffs.find(x => x.k === 'speed:@compute' && x.debug);
            if (b) { b.t = Math.min(600, b.t + 120); }
            else { S.ev.buffs.push({ k: 'speed:@compute', m: 1 + 0.25 * m, t: 120, max: 600, debug: true }); recomputeFx(); }
            const r = rpUnit() * 10 * m; S.rp += r;
            return `Hotfix shipped: compute +${Math.round(25 * m)}% for 2 min, +${fmt(r)} 🔬`;
        }
        return '';
    }

    /* ---------- research & focus ---------- */
    function techAvail(t) { return t.site <= S.site && !S.techs[t.id] && (t.req || []).every(r => S.techs[r]); }
    function buyTech(id) {
        const t = TECHS.find(x => x.id === id);
        if (!t || !techAvail(t) || S.rp < t.cost) return false;
        S.rp -= t.cost; S.techs[id] = true;
        recomputeFx();
        return true;
    }
    const repeatCost = (r) => r.base * Math.pow(20, S.site) * Math.pow(2.2, S.rlv[r.id] || 0);
    function buyRepeat(id) {
        const r = REPEAT.find(x => x.id === id), c = repeatCost(r);
        if (S.rp < c) return false;
        S.rp -= c; S.rlv[id] = (S.rlv[id] || 0) + 1;
        recomputeFx();
        return true;
    }
    function focusTotal() { return S.ai.ver + S.site + fxa('focus+'); }
    function focusSpent() { let s = 0; FOCUS.forEach(t => t.perks.forEach(p => { if (S.focus[p.id]) s += p.cost; })); return s; }
    function focusAvail(tree, i) {
        const p = tree.perks[i];
        return !S.focus[p.id] && (i === 0 || S.focus[tree.perks[i - 1].id]) && focusTotal() - focusSpent() >= p.cost;
    }
    function buyFocus(treeId, i) {
        const tree = FOCUS.find(t => t.id === treeId);
        if (!tree || !focusAvail(tree, i)) return false;
        S.focus[tree.perks[i].id] = true;
        recomputeFx();
        return true;
    }
    const respecCost = () => Math.max(20, rpUnit() * 600);
    function respec() {
        const c = respecCost();
        if (S.rp < c) return false;
        S.rp -= c; S.focus = {};
        S.nodes.filter(n => NODES[n.t].focus).forEach(removeNode);
        recomputeFx();
        return true;
    }

    /* ---------- moving ---------- */
    function nextSite() { return SITES[S.site + 1] || null; }
    function moveReqs(s) {
        const r = s.req, out = [];
        if (r.ai) out.push({ t: `Train ${MODELS[r.ai - 1].name}`, ok: S.ai.ver >= r.ai });
        if (r.cash) out.push({ t: `${money(r.cash)} for the move`, ok: S.cash >= r.cash });
        if (r.rep) out.push({ t: `${r.rep} ⭐ reputation`, ok: S.rep >= r.rep });
        if (r.infl) out.push({ t: `${r.infl} 🏛️ influence (spent)`, ok: S.infl >= r.infl });
        if (r.map) { const p = mapPct(r.map[0]); out.push({ t: `Control ${Math.round(r.map[1] * 100)}% of the ${MAP[r.map[0]].name} (now ${Math.round(p * 100)}%)`, ok: p >= r.map[1] - 1e-9 }); }
        return out;
    }
    function move() {
        const s = nextSite();
        if (!s || !moveReqs(s).every(r => r.ok)) return false;
        if (s.req.cash) S.cash -= s.req.cash;
        if (s.req.infl) S.infl -= s.req.infl;
        S.site++;
        S.breaker.tripped = false;
        recomputeFx();
        Arcade.report('site', S.site);
        Arcade.addXP(50 + S.site * 20);
        note(`🚚 Welcome to ${s.name}!`, 'gold');
        return true;
    }

    /* ---------- the map ---------- */
    function mapCost(L, i) { return MAP[L].base * Math.pow(MAP[L].step, i); }
    function mapPct(L) { return Object.keys(S.map[L].got).length / MAP[L].list.length; }
    function feedMap(L, k) {
        const m = S.map[L];
        const i = m.target;
        m.prog[i] = (m.prog[i] || 0) + k;
        if (m.prog[i] >= mapCost(L, i)) {
            m.got[i] = true; delete m.prog[i];
            note(`🌍 ${MAP[L].list[i]} is yours.`, 'gold');
            Arcade.sfx('level');
            const next = MAP[L].list.findIndex((_, j) => !m.got[j]);
            m.target = next >= 0 ? next : null;
            recomputeFx();
            checkWin();
        }
    }
    function setTarget(L, i) { if (!S.map[L].got[i]) S.map[L].target = i; }
    function checkWin() {
        if (S.won) return;
        if (S.ai.ver >= MODELS.length && mapPct('universe') >= 1) {
            S.won = true; S.wonAt = S.playT;
            Arcade.report('won', 1);
            Arcade.addXP(1000);
            Eng.onWin && Eng.onWin();
        }
    }

    /* ---------- rival AI (law) ---------- */
    const RIVAL_H = [0.3, 1.2, 2.5, 4, 6, 8.5, 11, 14, 18, 22, 27, 32, 38, 44, 51, 58, 66];
    function rivalVer() {
        if (!has('rival')) return 0;
        const h = Math.max(0, S.rival.t - S.rival.set) / 3600;
        return RIVAL_H.filter(x => h >= x * 0.85).length;
    }
    function rivalAhead() { return has('rival') && rivalVer() > S.ai.ver; }

    /* ---------- recursion (prestige) ---------- */
    function echoGain() {
        const law = LAWS.find(l => l.id === S.law) || LAWS[0];
        const hours = Math.max(1, S.playT / 3600);
        const speed = clamp(80 / hours, 0.6, 3);
        return Math.round(30 * law.mult * speed + Object.keys(S.focus).length);
    }
    function lawChoices() {
        if (!M.laws) { const pool = LAWS.filter(l => l.id !== 'none'); M.laws = [LAWS[0], ...Arcade.shuffle(pool.slice()).slice(0, 3)].map(l => l.id); Arcade.save(META_KEY, M); }
        return M.laws.map(id => LAWS.find(l => l.id === id));
    }
    function recurse(lawId) {
        if (!S.won) return false;
        const g = echoGain();
        M.echoes += g; M.total += g; M.runs++; M.law = lawId || 'none'; M.laws = null;
        M.best = M.best ? Math.min(M.best, S.playT) : S.playT;
        Arcade.save(META_KEY, M);
        S = freshState();
        seedNodes();
        recomputeFx();
        save();
        Eng.S = S;
        return g;
    }
    function buyEcho(id) {
        const e = ECHO.find(x => x.id === id), l = perk(id);
        if (!e || l >= e.max) return false;
        const c = e.cost(l);
        if (M.echoes < c) return false;
        M.echoes -= c; M.perks[id] = l + 1;
        Arcade.save(META_KEY, M);
        recomputeFx();
        return true;
    }

    /* ---------- goals (tutorial) ---------- */
    const linked = (a, b) => S.links.some(l => { const A = byId(l.a), B = byId(l.b); return A && B && A.t === a && B.t === b; });
    const GOAL_TEST = {
        g1: () => S.cap.solved > 0,
        g2: () => linked('heap', 'stall') || linked('heap', 'bench'),
        g3: () => linked('heap', 'bench') && linked('bench', 'stall'),
        g4: () => owned('shed') > 0 && S.links.some(l => { const B = byId(l.b); return B && B.t === 'shed'; }),
        g5: () => S.con.done > 0,
        g6: () => S.nodes.some(n => n.t === 'laptop' && n.act > 0.05),
        g7: () => linked('scraper', 'cleaner') && S.nodes.some(n => n.t === 'cleaner' && n.act > 0.05),
        g8: () => S.nodes.some(n => n.t === 'rig' && n.act > 0.05),
        g9: () => S.ai.ver >= 1,
        g10: () => owned('desk') > 0 && Object.keys(S.techs).length > 0,
        g11: () => Object.keys(S.focus).length > 0,
        g12: () => (S.inv.pc || 0) > 0 || S.nodes.some(n => n.t === 'assembler' && n.act > 0.05),
        g13: () => S.ai.ver >= 2,
        g14: () => S.site >= 1,
        g15: () => owned('gridconn') > 0,
        g16: () => S.nodes.some(n => n.t === 'gpuasm' && n.act > 0.05),
        g17: () => owned('gpurig') > 0,
        g18: () => (M.bps || []).length > 0,
        g19: () => S.ai.ver >= 3,
        g20: () => S.site >= 2,
    };
    function checkGoals() {
        while (S.goal < GOALS.length) {
            const g = GOALS[S.goal];
            if (!GOAL_TEST[g.id]()) break;
            S.goal++;
            const r = g.reward, parts = [];
            if (r.cash) { earn(r.cash, false); parts.push('+' + money(r.cash)); }
            if (r.rp) { S.rp += r.rp; parts.push(`+${r.rp} 🔬`); }
            if (r.rep) { S.rep += r.rep; parts.push(`+${r.rep} ⭐`); }
            note(`🎯 Goal done! ${parts.join(' ')}`, 'good');
        }
    }

    /* ---------- blueprints (kept in meta, so they survive Recursion) ---------- */
    function makeBp(ids, name) {
        const ns = S.nodes.filter(n => ids.includes(n.id));
        if (!ns.length) return null;
        const x0 = Math.min(...ns.map(n => n.x)), y0 = Math.min(...ns.map(n => n.y));
        const idx = new Map(ns.map((n, i) => [n.id, i]));
        const bp = {
            name: name || 'Blueprint ' + ((M.bps || []).length + 1),
            nodes: ns.map(n => ({ t: n.t, x: n.x - x0, y: n.y - y0, q: n.q })),
            links: S.links.filter(l => idx.has(l.a) && idx.has(l.b)).map(l => ({ a: idx.get(l.a), b: idx.get(l.b), f: l.f || null })),
            at: Date.now(),
        };
        return bp;
    }
    function saveBp(bp) { if (!bp) return; M.bps = (M.bps || []).filter(Boolean); M.bps.push(bp); Arcade.save(META_KEY, M); checkGoals(); }
    function delBp(i) { M.bps.splice(i, 1); Arcade.save(META_KEY, M); }
    function renameBp(i, name) { if (M.bps[i] && name) { M.bps[i].name = name.slice(0, 40); Arcade.save(META_KEY, M); } }
    // full = rebuild every unit; otherwise one unit per machine
    function bpCost(bp, full) {
        const extra = {}, out = { cash: 0, items: {} };
        for (const b of bp.nodes) {
            const k = full ? b.q : 1;
            for (let i = 0; i < k; i++) {
                const c = nodeCost(b.t, extra[b.t] || 0);
                extra[b.t] = (extra[b.t] || 0) + 1;
                out.cash += c.cash;
                for (const it in c.items) out.items[it] = (out.items[it] || 0) + c.items[it];
            }
        }
        return out;
    }
    function bpProblem(bp, full) {
        const locked = [...new Set(bp.nodes.filter(b => !unlocked(NODES[b.t])).map(b => NODES[b.t].name))];
        if (locked.length) return 'Locked here: ' + locked.join(', ');
        if (S.nodes.length + bp.nodes.length > slots()) return `Needs ${bp.nodes.length} free slots (you have ${slots() - S.nodes.length}).`;
        if (!canAfford(bpCost(bp, full))) return 'Not enough cash or stored items.';
        return '';
    }
    function placeBp(bp, x, y, full) {
        const err = bpProblem(bp, full);
        if (err) return { err };
        pay(bpCost(bp, full));
        const made = bp.nodes.map(b => {
            const n = place(b.t, x + b.x, y + b.y, true).node;
            n.q = full ? b.q : 1;
            return n;
        });
        for (const l of bp.links) {
            const A = made[l.a], B = made[l.b];
            if (A && B && link(A.id, B.id).ok && l.f) S.links[S.links.length - 1].f = l.f;
        }
        return { nodes: made };
    }
    function skipTut() { S.tutSkip = true; }

    /* ---------- saving & offline ---------- */
    function save() { S.last = Date.now(); Arcade.save(KEY, S); }
    function offline() {
        const capH = 8 + fxa('offline+');
        const away = Math.min(capH * 3600, (Date.now() - (S.last || Date.now())) / 1000);
        if (away < 30) return null;
        const before = { cash: S.cash, compute: S.stats.compute, rp: S.rp, ver: S.ai.ver, c: S.ai.c, broken: S.stats.broken, inv: Object.assign({}, S.inv) };
        const dt = away > 7200 ? 2 : 1;
        let t = 0;
        while (t < away) { step(Math.min(dt, away - t), true); t += dt; }
        toasts = toasts.filter(x => x[1] === 'gold' && x[0].startsWith('🧠'));
        return { away, cash: S.cash - before.cash, compute: S.stats.compute - before.compute, rp: S.rp - before.rp, models: S.ai.ver - before.ver,
                 broken: S.stats.broken - before.broken, capped: away >= capH * 3600 - 1, capH };
    }
    function hardReset() { Arcade.remove(KEY); S = freshState(); seedNodes(); recomputeFx(); Eng.S = S; save(); }

    recomputeFx();
    window.Eng = {
        get S() { return S; }, set S(v) { S = v; }, M, FX, P, fx, fxa, has,
        fmt, fmtW, money, clamp, DAY,
        site, def, byId, owned, slots, unlocked, nodeCost, bulkCost, canAfford, place, addUnits, sellUnit, removeNode,
        link, unlink, accepts, producible, sellable, itemPrice, step, recomputeFx, sunlight, modelNeed, setTune,
        autoCapRate, taskPay, solveTask, sellInv, conSlots, acceptContract, completeContract, abandonContract, makeContract,
        chooseEvent, applyEventFx, eventCost, repair, repairCost, resetBreaker, miniReward, trade, coinBase,
        techAvail, buyTech, repeatCost, buyRepeat, focusTotal, focusSpent, focusAvail, buyFocus, respec, respecCost,
        nextSite, moveReqs, move, mapCost, mapPct, setTarget, rivalVer, rivalAhead, echoGain, lawChoices, recurse, buyEcho, perk,
        save, offline, hardReset, incUnit, rpUnit, expr, checkGoals, lockReason, tutLocked, priceMult, depth,
        makeBp, saveBp, delBp, renameBp, bpCost, bpProblem, placeBp, skipTut,
        get inc() { return incRate; }, get rpRate() { return rpRate; }, get computeRate() { return computeRate; },
        takeToasts() { const t = toasts; toasts = []; return t; },
    };
})();
