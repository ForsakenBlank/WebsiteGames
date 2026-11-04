/* The Tower — core helpers shared by every other script: number formatting, dates, RNG and the save. */
(() => {
    const G = window.TG = {};

    /* ---------- numbers ---------- */
    // The game's own suffixes: K M B T q Q s S O N D, then aa, ab, ac ...
    const SUF = ['', 'K', 'M', 'B', 'T', 'q', 'Q', 's', 'S', 'O', 'N', 'D'];
    G.fmt = (n, d = 2) => {
        if (n === undefined || n === null || Number.isNaN(n)) return '0';
        if (!Number.isFinite(n)) return '∞';
        const neg = n < 0;
        n = Math.abs(n);
        let out;
        if (n < 1000) {
            out = n % 1 === 0 ? String(n) : n.toFixed(n < 10 ? d : n < 100 ? Math.min(d, 1) : 0);
            if (out.includes('.')) out = out.replace(/\.?0+$/, '');
        }
        else {
            const e = Math.floor(Math.log10(n) / 3);
            const v = n / Math.pow(1000, e);
            let suf = SUF[e];
            if (!suf) {
                const k = e - SUF.length;
                suf = String.fromCharCode(97 + Math.floor(k / 26)) + String.fromCharCode(97 + (k % 26));
            }
            out = (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + suf;
        }
        return (neg ? '-' : '') + out;
    };
    G.pct = (v, d = 1) => (v * 100).toFixed(d).replace(/\.0+$/, '') + '%';
    G.mult = (v, d = 2) => '×' + (v >= 1000 ? G.fmt(v) : v.toFixed(d));
    G.dur = (sec) => {
        sec = Math.max(0, Math.round(sec));
        const y = Math.floor(sec / 31536000), d = Math.floor(sec % 31536000 / 86400), h = Math.floor(sec % 86400 / 3600),
            m = Math.floor(sec % 3600 / 60), s = sec % 60;
        if (y) return `${y}y ${d}d`;
        if (d) return `${d}d ${h}h`;
        if (h) return `${h}h ${m}m`;
        if (m) return `${m}m ${s}s`;
        return `${s}s`;
    };
    G.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    G.rand = (a, b) => a + Math.random() * (b - a);
    G.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    G.chance = (p) => Math.random() < p;

    // Seeded RNG for things that must be the same every time they are rebuilt (fake players, offers).
    G.hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
    G.seeded = (seed) => { let s = (typeof seed === 'string' ? G.hash(seed) : seed) >>> 0 || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
    G.gauss = (rnd) => { const u = 1 - rnd(), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

    // Interpolate a sampled curve [[x, y], ...]. Positive curves use log-log so polynomial growth stays smooth.
    G.curve = (pts, x) => {
        if (x <= pts[0][0]) return pts[0][1];
        for (let i = 1; i < pts.length; i++) {
            const [x1, y1] = pts[i];
            if (x <= x1) {
                const [x0, y0] = pts[i - 1];
                if (x0 > 0 && y0 > 0 && y1 > 0) {
                    const t = Math.log(x / x0) / Math.log(x1 / x0);
                    return Math.exp(Math.log(y0) + t * (Math.log(y1) - Math.log(y0)));
                }
                return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
            }
        }
        const n = pts.length;
        if (n < 2) return pts[n - 1][1];
        const [xa, ya] = pts[n - 2], [xb, yb] = pts[n - 1];
        return yb + (yb - ya) * (x - xb) / (xb - xa);
    };

    /* ---------- time (the real game runs on UTC) ---------- */
    const DAY = 86400000;
    G.DAY = DAY;
    G.now = () => Date.now();
    G.dayKey = (t = Date.now()) => Math.floor(t / DAY);
    // weeks start Monday 00:00 UTC (1970-01-01 was a Thursday, so shift by 3 days)
    G.weekKey = (t = Date.now()) => Math.floor((t / DAY + 3) / 7);
    G.weekStart = (wk) => (wk * 7 - 3) * DAY;
    G.untilNextDay = () => DAY - (Date.now() % DAY);
    G.untilNextWeek = () => G.weekStart(G.weekKey() + 1) - Date.now();

    /* ---------- events: tiny pub/sub so systems can listen for kills, waves, etc. ---------- */
    const subs = {};
    G.on = (ev, fn) => (subs[ev] || (subs[ev] = [])).push(fn);
    G.emit = (ev, a, b, c) => { const l = subs[ev]; if (l) for (const fn of l) fn(a, b, c); };

    /* ---------- save ---------- */
    const KEY = 'arcade.tower2.save';
    G.KEY = KEY;
    const fresh = () => ({
        v: 1, created: Date.now(), name: 'You',
        coins: 0, gems: 0, stones: 0, medals: 0, keys: 0, bits: 0, tokens: 0, cells: 0,
        shards: { cannon: 0, armor: 0, generator: 0, core: 0, reroll: 0 },
        ws: {}, wsUnl: {}, enh: {}, enhSpent: { attack: 0, defense: 0, utility: 0 },
        tier: 1, maxTier: 1, tierBest: {}, runsOnTier: {},
        ms: {}, premium: {}, feat: {}, cardPool: {}, skins: { owned: { classic: true }, eq: 'classic' },
        labs: { lv: {}, slots: 0, active: [], auto: {}, overclock: 0, boosts: [] },
        cards: { have: {}, slots: 1, eq: [], presets: [[], [], [], [], []], preset: 0, mastery: {}, firstPull: true, opened: false },
        uw: { own: {}, offer: null, freeReroll: true, plus: {}, off: {} },
        modules: { inv: [], slot: { cannon: { lv: 0, eq: null }, armor: { lv: 0, eq: null }, generator: { lv: 0, eq: null }, core: { lv: 0, eq: null } }, tickets: 0, pity: 0, uid: 1 },
        bots: { own: {}, lv: {}, on: {}, plus: {}, plusLv: {} },
        guild: null, guardian: null,
        relics: {}, vault: {}, songs: {},
        perks: { first: null, bans: [], rank: [], auto: true },
        tour: { league: 0, cur: null, hist: [], relicsWon: {} },
        daily: { board: [], lastBatch: 0, week: 0, done: 0, boxes: 0, reroll: 0 },
        event: null, eventShop: {},
        free: { dailyGemDay: 0, adGemAt: 0, adGemsToday: 0, adDay: 0, coinBoost: 0, adTicket: '' },
        offline: { cpm: 0 },
        dissonance: {},
        stats: {
            runs: 0, kills: 0, bosses: 0, waves: 0, coinsTotal: 0, cashTotal: 0, gemsTotal: 0, stonesTotal: 0, timePlayed: 0,
            labsDone: 0, cardsBought: 0, modulesPulled: 0, damage: 0, bestHit: 0, floatGems: 0, wsUpgrades: 0, battleUpgrades: 0,
            killsBy: {}, freeUps: 0, recovery: 0, skips: 0,
        },
        ap: { own: {}, on: {}, cats: { attack: true, defense: true, utility: true }, skip: {}, mode: 'balanced' },
        settings: { buyMult: 1, speed: 1, quality: 'high', confirm: true, numbers: true },
        run: null,
    });

    function merge(base, saved) {
        // fill in any keys added after the save was made, without touching what the player has
        for (const k in base) {
            if (!(k in saved)) saved[k] = base[k];
            else if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && saved[k] && typeof saved[k] === 'object' && !Array.isArray(saved[k])) merge(base[k], saved[k]);
        }
        return saved;
    }
    G.load = () => {
        let s = null;
        try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { s = null; }
        G.S = s && typeof s === 'object' ? merge(fresh(), s) : fresh();
        return G.S;
    };
    let saveTimer = 0;
    G.save = () => {
        G.S.lastSeen = Date.now();
        try { localStorage.setItem(KEY, JSON.stringify(G.S)); } catch (e) { /* storage full or blocked: keep playing */ }
    };
    G.saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(G.save, 400); };
    G.reset = () => { localStorage.removeItem(KEY); location.reload(); };

    /* ---------- currencies ---------- */
    // Not in the real game: all coin income is x5 and elite cells x1.5 to speed up progression
    // (refunds are not; offline coins are already worked out from boosted income).
    G.COIN_BOOST = 5;
    G.CELL_BOOST = 1.5;
    G.add = (cur, n, why) => {
        if (!n) return 0;
        const S = G.S;
        if (cur === 'coins' && n > 0 && why !== 'refund' && why !== 'respec' && why !== 'offline') n *= G.COIN_BOOST;
        if (cur.startsWith('shard:')) S.shards[cur.slice(6)] += n;
        else S[cur] = (S[cur] || 0) + n;
        if (cur === 'coins' && n > 0) S.stats.coinsTotal += n;
        if (cur === 'gems' && n > 0) S.stats.gemsTotal += n;
        if (cur === 'stones' && n > 0) S.stats.stonesTotal += n;
        G.emit('currency', cur, n, why);
        return n;
    };
    G.has = (cur, n) => (cur.startsWith('shard:') ? G.S.shards[cur.slice(6)] : G.S[cur] || 0) >= n;
    G.spend = (cur, n) => {
        if (!G.has(cur, n)) { G.toast(`Not enough ${G.CUR[cur] ? G.CUR[cur].n : cur}`, 'bad'); G.sfx('bad'); return false; }
        if (cur.startsWith('shard:')) G.S.shards[cur.slice(6)] -= n;
        else G.S[cur] -= n;
        G.emit('currency', cur, -n);
        return true;
    };
    G.CUR = {
        cash: { n: 'Cash', ic: '$' }, coins: { n: 'Coins', ic: '🪙' }, gems: { n: 'Gems', ic: '💎' }, stones: { n: 'Power Stones', ic: '💠' },
        medals: { n: 'Medals', ic: '🏅' }, keys: { n: 'Keys', ic: '🗝️' }, bits: { n: 'Bits', ic: '🔹' }, tokens: { n: 'Guild Tokens', ic: '🪙' },
        cells: { n: 'Elite Cells', ic: '🧬' }, 'shard:cannon': { n: 'Cannon Shards', ic: '🔴' }, 'shard:armor': { n: 'Armor Shards', ic: '🟦' },
        'shard:generator': { n: 'Generator Shards', ic: '🔺' }, 'shard:core': { n: 'Core Shards', ic: '🔷' }, 'shard:reroll': { n: 'Reroll Shards', ic: '🎲' },
    };
    G.price = (cur, n) => `${G.CUR[cur].ic} ${G.fmt(n)}`;

    /* ---------- thin wrappers around the shared arcade helpers ---------- */
    G.toast = (msg, type, ms) => window.Arcade ? Arcade.toast(msg, type, ms) : console.log(msg);
    G.sfx = (n) => window.Arcade && Arcade.sfx(n);
    G.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
})();
