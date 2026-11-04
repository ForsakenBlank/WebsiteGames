/* The Tower — daily missions, events, tournaments (with offline rivals), guilds and the guardian. */
(() => {
    const G = window.TG, D = G.D;
    const S = () => G.S;
    const HOUR = 3600000;

    /* ======================================================================
       DAILY MISSIONS & WEEKLY BOXES
       ====================================================================== */
    G.dailyUnlocked = () => (S().runsOnTier[1] || 0) >= 3 || S().maxTier > 1;
    function makeMission(board) {
        const used = new Set(board.map(m => m.stat));
        const pool = D.DAILY.filter(([stat, , , need]) => !used.has(stat) && (!need || need()));
        if (!pool.length) return null;
        const [stat, text, goals] = G.pick(pool);
        const goal = G.pick(goals);
        return { id: Math.random().toString(36).slice(2, 9), stat, text: text.replace('{n}', G.fmt(goal)), goal, p: 0, claimed: false };
    }
    G.ensureDaily = () => {
        const d = S().daily;
        const wk = G.weekKey();
        if (d.week !== wk) { if (d.week && G.apOn('claim')) G.claimAllBoxes(); d.week = wk; d.done = 0; d.boxes = 0; }
        if (!G.dailyUnlocked()) return;
        const batch = Math.floor(Date.now() / (8 * HOUR));
        if (!d.lastBatch) { d.lastBatch = batch; while (d.board.length < 4) { const m = makeMission(d.board); if (!m) break; d.board.push(m); } return; }
        if (batch > d.lastBatch) {
            const missed = batch - d.lastBatch;
            const add = missed > 9 ? 8 : missed * 2;
            for (let i = 0; i < add && d.board.length < 8; i++) { const m = makeMission(d.board); if (m) d.board.push(m); }
            d.lastBatch = batch;
        }
    };
    G.nextMissionIn = () => (8 * HOUR) - (Date.now() % (8 * HOUR));
    G.dailyReward = () => {
        const t = S().maxTier;
        return { gems: 3, coins: D.DAILY_COINS[t - 1], shards: S().feat.modules ? D.REROLL_SHARDS[t - 1] + G.labV('Daily_Mission_Shards') : 0 };
    };
    G.claimDaily = (id) => {
        const d = S().daily, m = d.board.find(x => x.id === id);
        if (!m || m.p < m.goal) return;
        d.board = d.board.filter(x => x !== m);
        const r = G.dailyReward();
        G.add('gems', r.gems); G.add('coins', r.coins, 'mission');
        if (r.shards) G.add('shard:' + (S().daily.shardType || G.pick(['cannon', 'armor', 'generator', 'core'])), r.shards);
        d.done++;
        G.sfx('coin');
        G.saveSoon();
    };
    G.rerollDaily = (id) => {
        const d = S().daily, i = d.board.findIndex(x => x.id === id);
        if (i < 0 || !G.labDone('Reroll_Daily_Missions')) return;
        if (!G.vaultLv('freeMissionReroll') && !G.spend('gems', 5)) return;
        const rest = d.board.filter((x, k) => k !== i);
        const m = makeMission(rest.concat([d.board[i]]));
        if (m) d.board[i] = m;
        G.saveSoon();
    };
    G.boxReady = (k) => S().daily.done >= (k + 1) * 5 && S().daily.boxes <= k;
    G.claimBox = () => {
        const d = S().daily, k = d.boxes;
        if (k >= 7 || d.done < (k + 1) * 5) return;
        const [cm, gems, medals, stones, tokens] = D.WEEKLY_BOX[k];
        G.add('coins', D.DAILY_COINS[S().maxTier - 1] * cm, 'box'); G.add('gems', gems);
        if (S().feat.events) G.add('medals', medals);
        if (S().feat.tournaments) G.add('stones', stones);
        if (S().feat.guilds) { G.add('tokens', tokens); if (S().guild) S().guild.contrib += 5; }
        d.boxes++;
        G.sfx('win');
        G.saveSoon();
    };
    G.claimAllBoxes = () => { let n = 0; while (S().daily.boxes < 7 && S().daily.done >= (S().daily.boxes + 1) * 5 && n < 7) { G.claimBox(); n++; } return n; };

    /* ======================================================================
       EVENTS (two-week cycle, same calendar for everyone)
       ====================================================================== */
    const EV_EPOCH = Date.UTC(2024, 0, 3), EV_LEN = 14 * G.DAY;
    G.eventIndex = () => Math.floor((Date.now() - EV_EPOCH) / EV_LEN);
    G.eventEnds = () => EV_EPOCH + (G.eventIndex() + 1) * EV_LEN;
    G.eventDay = () => Math.floor((Date.now() - (EV_EPOCH + G.eventIndex() * EV_LEN)) / G.DAY);
    G.ensureEvent = () => {
        if (!S().feat.events) return;
        const idx = G.eventIndex();
        const s = S();
        if (s.event && s.event.idx === idx) {
            const day = G.dayKey();
            if (s.event.lastLogin !== day) { s.event.lastLogin = day; s.event.c.login = (s.event.c.login || 0) + 1; }
            return;
        }
        if (s.event) finishEvent(s.event);
        const name = D.EVENTS[((idx % D.EVENTS.length) + D.EVENTS.length) % D.EVENTS.length];
        const rnd = G.seeded('event' + idx);
        const pool = D.EVENT_MISSIONS.filter(m => !m.always).map(m => [m, rnd()]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
        const always = D.EVENT_MISSIONS.filter(m => m.always && (m.stat !== 'tourney' || s.feat.tournaments));
        const list = always.concat(pool).slice(0, 21).map(m => m.text);
        s.event = { idx, name, list, c: { login: 1 }, tiers: {}, medals: 0, boost: false, relics: {}, lastLogin: G.dayKey(), shop: {}, trades: {} };
        G.saveSoon();
    };
    function finishEvent(ev) {
        // unclaimed mission tiers are paid out (they don't count toward relics), earned relics are sent
        let medals = 0;
        for (const text of ev.list) {
            const m = D.EVENT_MISSIONS.find(x => x.text === text);
            for (let i = 0; i < 3; i++) if (!ev.tiers[text + i] && evProgress(m, ev) >= m.goals[i]) medals += D.EVENT_MEDALS[i] * (ev.boost ? 2 : 1);
        }
        if (medals) G.add('medals', medals);
        for (const r of G.eventRelics(ev)) if (G.eventRelicEarned(r, ev)) G.giveRelic(r.id);
    }
    const evProgress = (m, ev) => (ev || S().event).c[m.stat] || 0;
    G.evProgress = evProgress;
    G.eventMissions = () => {
        const ev = S().event;
        if (!ev) return [];
        const n = Math.min(21, 7 + 2 * Math.min(7, G.eventDay()));
        return ev.list.slice(0, n).map(text => D.EVENT_MISSIONS.find(x => x.text === text)).filter(Boolean);
    };
    G.claimEventTier = (m, i) => {
        const ev = S().event, key = m.text + i;
        if (!ev || ev.tiers[key] || evProgress(m) < m.goals[i] || (i > 0 && !ev.tiers[m.text + (i - 1)])) return;
        ev.tiers[key] = true;
        const n = D.EVENT_MEDALS[i] * (ev.boost ? 2 : 1);
        G.add('medals', n); ev.medals += n;
        for (const r of G.eventRelics(ev)) if (G.eventRelicEarned(r, ev)) G.giveRelic(r.id);
        G.sfx('coin');
        G.saveSoon();
    };
    G.eventRelics = (ev) => D.RELICS.filter(r => r.src === 'event' && r.key.name === (ev || S().event || {}).name);
    G.eventRelicEarned = (r, ev) => { ev = ev || S().event; return ev.medals >= r.key.medals && (!r.key.premium || ev.boost); };
    G.buyEventBoost = () => {
        const ev = S().event;
        if (!ev || ev.boost) return;
        if (!G.spend('gems', D.EVENT_BOOST_GEMS)) return;
        ev.boost = true;
        G.add('medals', ev.medals); ev.medals *= 2;
        for (const r of G.eventRelics(ev)) if (G.eventRelicEarned(r, ev)) G.giveRelic(r.id);
        G.saveSoon();
    };
    G.tradePrice = (kind) => D.TRADE_PRICE[Math.min(6, (S().event ? S().event.trades[kind] || 0 : 0))];
    G.eventTrade = (kind, type) => {
        const ev = S().event;
        if (!ev) return;
        if (!G.spend('medals', G.tradePrice(kind))) return;
        ev.trades[kind] = (ev.trades[kind] || 0) + 1;
        if (kind === 'gems') G.add('gems', 150);
        if (kind === 'stones') G.add('stones', 15);
        if (kind === 'shards') G.add('shard:' + type, 250);
        G.sfx('coin');
        G.saveSoon();
    };
    G.eventThemeId = (bg) => (bg ? 'bg:' : 'ev:') + (S().event ? S().event.name : '');
    G.buyEventTheme = (bg) => {
        const id = G.eventThemeId(bg);
        const owned = bg ? S().skins.bg || (S().skins.bg = {}) : S().skins.owned;
        if (owned[id]) return;
        if (!G.spend('medals', bg ? 250 : 150)) return;
        owned[id] = true;
        G.saveSoon();
    };
    G.buySong = (id) => { if (S().songs[id]) return; if (!G.spend('medals', 200)) return; S().songs[id] = true; G.saveSoon(); };
    // old event relics offered for gems, four at a time, changing every event
    G.gemRelicOffers = () => {
        const ev = S().event;
        if (!ev) return [];
        const past = D.RELICS.filter(r => r.src === 'event' && !r.key.premium && r.key.name !== ev.name && !S().relics[r.id]);
        const rnd = G.seeded('relicshop' + ev.idx);
        return past.map(r => [r, rnd()]).sort((a, b) => a[1] - b[1]).slice(0, 4).map(x => x[0]);
    };
    G.buyGemRelic = (id) => {
        const r = D.RELIC_BY[id];
        if (!r || S().relics[id]) return;
        if (!G.spend('gems', r.rarity === 'Epic' || r.key.medals >= 700 ? 1200 : 600)) return;
        G.giveRelic(id);
        G.saveSoon();
    };

    /* ======================================================================
       TOURNAMENTS (every Wednesday and Saturday 00:00 UTC, 24h to enter)
       Rivals are generated offline: names and final waves are seeded per
       tournament and they post their scores at random times during the day.
       ====================================================================== */
    const dow = (day) => (day + 4) % 7; // 1970-01-01 was a Thursday (0 = Sunday)
    G.tourStartFor = (t = Date.now()) => {
        let day = Math.floor(t / G.DAY);
        while (![3, 6].includes(dow(day))) day--;
        return day * G.DAY;
    };
    G.tourNext = (t = Date.now()) => {
        let day = Math.floor(t / G.DAY) + 1;
        while (![3, 6].includes(dow(day))) day++;
        return day * G.DAY;
    };
    G.tourOpen = () => { const c = S().tour.cur; return c && Date.now() < c.key + G.DAY; };
    G.ensureTournament = () => {
        if (!S().feat.tournaments) return;
        const T = S().tour, key = G.tourStartFor();
        if (T.cur && T.cur.key !== key) { finishTournament(T.cur); T.cur = null; }
        if (T.cur && Date.now() >= T.cur.key + G.DAY && !T.cur.done) finishTournament(T.cur);
        if (!T.cur) T.cur = { key, tickets: 1, bought: 0, ad: false, best: 0, entered: false, bracket: null, done: false };
    };
    const RIVAL_A = ['Iron', 'Nova', 'Pixel', 'Orb', 'Crit', 'Void', 'Shadow', 'Turbo', 'Quantum', 'Laser', 'Neon', 'Frost', 'Ember', 'Storm', 'Hyper', 'Mega', 'Ultra', 'Cosmic', 'Astro', 'Zen', 'Omega', 'Alpha', 'Lunar', 'Solar', 'Rogue', 'Silent', 'Dark', 'Bright', 'Golden', 'Tiny'];
    const RIVAL_B = ['Tower', 'Spire', 'Keep', 'Bastion', 'Turret', 'Citadel', 'Wizard', 'Knight', 'Monk', 'Fox', 'Wolf', 'Bear', 'Dragon', 'Bot', 'Pilot', 'Golem', 'Ninja', 'Panda', 'Shark', 'Titan', 'Sage', 'Ranger', 'Viking', 'Pirate', 'Ghost'];
    G.rivalName = (rnd) => {
        const r = rnd();
        if (r < 0.15) return 'Player' + Math.floor(rnd() * 900000 + 100000);
        const a = RIVAL_A[Math.floor(rnd() * RIVAL_A.length)], b = RIVAL_B[Math.floor(rnd() * RIVAL_B.length)];
        return r < 0.55 ? a + b : r < 0.8 ? a + b + Math.floor(rnd() * 99) : (a + '_' + b).toLowerCase();
    };
    // what wave the player can probably reach in this league, from past tournaments or tier records
    G.tourEstimate = (L) => {
        const T = S().tour;
        const past = T.hist.filter(h => h.league === L && h.wave > 0).slice(-3);
        if (past.length) return past.reduce((a, h) => a + h.wave, 0) / past.length;
        const lt = D.LEAGUES[L].tier;
        let best = 0;
        // tournament enemies scale much faster than the tier, so a tier record is only a rough guide
        for (let t = 1; t <= 24; t++) { const b = S().tierBest[t] || 0; if (b) best = Math.max(best, b * Math.pow(0.55, Math.max(0, lt - t)) * Math.pow(1.15, Math.max(0, t - lt))); }
        return Math.max(15, best * 0.25);
    };
    // a typical wave for each league; rivals sit between this and what you usually reach
    const LEAGUE_REF = [100, 250, 450, 700, 1000, 1600, 2500];
    function makeBracket(cur) {
        const L = S().tour.league;
        const rnd = G.seeded('tour' + cur.key + ':' + L + ':' + S().created);
        const median = Math.max(10, 0.5 * G.tourEstimate(L) + 0.5 * LEAGUE_REF[L]);
        const out = [];
        for (let i = 0; i < 29; i++) {
            const name = G.rivalName(rnd);
            let wave = rnd() < 0.08 ? 0 : Math.max(1, Math.round(median * Math.exp(G.gauss(rnd) * 0.45)));
            out.push({ name, wave, at: Math.floor(rnd() * (G.DAY - HOUR)) + HOUR / 2 });
        }
        cur.league = L;
        cur.bracket = out;
    }
    G.tourBoard = () => {
        const cur = S().tour.cur;
        if (!cur || !cur.bracket) return [];
        const now = Date.now(), closed = now >= cur.key + G.DAY;
        const rows = cur.bracket.map(r => ({ name: r.name, wave: closed || now >= cur.key + r.at ? r.wave : 0, me: false }));
        rows.push({ name: S().name || 'You', wave: cur.best, me: true });
        rows.sort((a, b) => b.wave - a.wave || (a.me ? -1 : b.me ? 1 : 0));
        return rows;
    };
    G.tourRank = () => G.tourBoard().findIndex(r => r.me) + 1;
    G.tourReward = (L, rank) => { const rows = D.LEAGUES[L].rewards; const r = rows.find(x => rank <= x[0]) || rows[rows.length - 1]; return { gems: r[1], stones: r[2], keys: r[3] }; };
    G.ticketPrice = () => 10 * (S().tour.cur.bought + 1);
    G.buyTicket = (ad) => {
        const cur = S().tour.cur;
        if (!cur || !G.tourOpen()) return;
        if (ad) { if (cur.ad) return; cur.ad = true; cur.tickets++; G.saveSoon(); return; }
        if (!G.spend('gems', G.ticketPrice())) return;
        cur.bought++; cur.tickets++;
        G.saveSoon();
    };
    G.enterTournament = () => {
        G.ensureTournament();
        const cur = S().tour.cur;
        if (!cur || !G.tourOpen() || cur.tickets < 1 || G.run()) return false;
        cur.tickets--;
        if (!cur.bracket) makeBracket(cur);
        if (!cur.entered) { cur.entered = true; G.count('tourney', 1); }
        return true;
    };
    G.on('runEnd', (run) => {
        if (!run.tour) return;
        const cur = S().tour.cur;
        if (cur && run.wave > cur.best) cur.best = run.wave;
    });
    function finishTournament(cur) {
        if (cur.done) return;
        cur.done = true;
        if (!cur.entered) return;
        const T = S().tour, L = cur.league;
        // freeze the board as it is at the end
        const rows = cur.bracket.map(r => ({ wave: r.wave, me: false })).concat([{ wave: cur.best, me: true }]);
        rows.sort((a, b) => b.wave - a.wave || (a.me ? 1 : b.me ? -1 : 0)); // ties get the lower rank
        const rank = rows.findIndex(r => r.me) + 1;
        const rw = G.tourReward(L, rank);
        G.add('gems', rw.gems); G.add('stones', rw.stones); if (rw.keys) G.add('keys', rw.keys);
        // relics for placements
        const name = D.LEAGUES[L].id.toLowerCase();
        for (const r of D.RELICS.filter(x => x.src === 'tourney')) {
            const k = r.key.toLowerCase();
            if (rank <= 4 && k.includes('top 4') && k.includes(name.slice(0, 5))) G.giveRelic(r.id);
            if (rank === 1 && k.startsWith('win') && k.includes(name.slice(0, 5))) G.giveRelic(r.id);
        }
        const before = L;
        if (rank <= 4 && L < D.LEAGUES.length - 1) T.league++;
        else if (L >= 3 && rank >= 25) T.league = Math.max(2, L - 1);
        T.hist.push({ key: cur.key, league: L, wave: cur.best, rank, ...rw, to: T.league });
        if (T.hist.length > 30) T.hist.shift();
        T.last = { rank, league: before, to: T.league, ...rw, wave: cur.best };
        setTimeout(() => G.toast(`🏆 Tournament finished: rank ${rank}/30 · +${rw.gems} 💎 +${rw.stones} 💠${rw.keys ? ' +' + rw.keys + ' 🗝️' : ''}${T.league > before ? ' · promoted!' : T.league < before ? ' · demoted' : ''}`, 'gold', 6000), 600);
        G.saveSoon();
    }

    /* ======================================================================
       GUILDS (offline: guildmates are simulated)
       ====================================================================== */
    const GUILD_A = ['Iron', 'Crimson', 'Silent', 'Golden', 'Eternal', 'Cosmic', 'Frozen', 'Neon', 'Ancient', 'Wild', 'Storm', 'Lucky'];
    const GUILD_B = ['Spires', 'Keepers', 'Orbits', 'Towers', 'Legion', 'Order', 'Watch', 'Circle', 'Garrison', 'Bastions', 'Sentinels', 'Wardens'];
    G.guildList = () => {
        const rnd = G.seeded('guilds' + G.weekKey());
        const used = new Set();
        return Array.from({ length: 6 }, (_, i) => {
            let name;
            do name = GUILD_A[Math.floor(rnd() * GUILD_A.length)] + ' ' + GUILD_B[Math.floor(rnd() * GUILD_B.length)]; while (used.has(name));
            used.add(name);
            const size = 12 + Math.floor(rnd() * 18), act = 0.35 + rnd() * 0.6;
            return { id: 'g' + i + G.weekKey(), name, size, act, tag: ['Casual', 'Active', 'Competitive'][act > 0.8 ? 2 : act > 0.55 ? 1 : 0] };
        });
    };
    G.joinGuild = (g, create) => {
        if (!S().feat.guilds || S().guild) return;
        if (create && !G.spend('gems', 50)) return;
        const rnd = G.seeded('members' + g.id);
        const members = Array.from({ length: g.size - 1 }, () => ({ name: G.rivalName(rnd), act: Math.min(1, Math.max(0.1, g.act + G.gauss(rnd) * 0.2)) }));
        S().guild = { name: g.name, members, joined: Date.now(), week: G.weekKey(), contrib: 0, chests: {}, season: G.guildSeason(), buys: {} };
        if (!S().guardian) S().guardian = { unlocked: false, chips: { attack: [0, 0, 0], ally: [0, 0, 0] }, own: { attack: true, ally: true }, eq: [], slots: 1, skins: {} };
        G.saveSoon();
    };
    G.leaveGuild = () => { S().guild = null; G.saveSoon(); };
    G.guildSeason = () => Math.floor(G.weekKey() / 8);
    G.guildWeekFrac = () => Math.min(1, (Date.now() - G.weekStart(G.weekKey())) / (7 * G.DAY));
    G.guildTotal = () => {
        const g = S().guild;
        if (!g) return 0;
        return g.contrib + Math.round(g.members.reduce((a, m) => a + 35 * m.act, 0) * G.guildWeekFrac());
    };
    G.GUILD_CHESTS = [[100, 10, 10, 1, 5], [250, 20, 25, 2, 10], [500, 40, 50, 3, 15], [750, 80, 100, 5, 30]]; // need, tokens, bits, coin mult, gems
    G.claimChest = (i) => {
        const g = S().guild;
        if (!g || g.chests[i] || G.guildTotal() < G.GUILD_CHESTS[i][0]) return;
        const [, tok, bits, cm, gems] = G.GUILD_CHESTS[i];
        g.chests[i] = true;
        G.add('tokens', tok); G.add('bits', bits); G.add('gems', gems);
        G.add('coins', D.DAILY_COINS[Math.min(17, S().maxTier - 1)] * cm, 'guild');
        G.sfx('win');
        G.saveSoon();
    };
    G.ensureGuild = () => {
        const g = S().guild;
        if (!g) return;
        if (g.week !== G.weekKey()) {
            // last week's chests that were earned but not claimed arrive by "mail"
            const lastTotal = g.contrib + Math.round(g.members.reduce((a, m) => a + 35 * m.act, 0));
            G.GUILD_CHESTS.forEach(([need, tok, bits, cm, gems], i) => { if (!g.chests[i] && lastTotal >= need) { G.add('tokens', tok); G.add('bits', bits); G.add('gems', gems); } });
            g.week = G.weekKey(); g.contrib = 0; g.chests = {};
        }
        if (g.season !== G.guildSeason()) {
            const gems = Math.ceil(S().tokens / 5);
            if (gems) { G.add('gems', gems); S().tokens = 0; G.toast(`🛡️ Guild season over: leftover tokens became ${gems} gems`, 'gold', 5000); }
            g.season = G.guildSeason(); g.buys = {};
        }
    };
    G.storePrice = (kind) => {
        const n = (S().guild.buys[kind] || 0);
        if (kind === 'bits') return [25, 50, 75][n];
        if (kind === 'gems') return [15, 25, 40][n];
        if (kind.startsWith('shards')) return [5, 10, 15][n];
        return null;
    };
    G.storeBuy = (kind, arg) => {
        const g = S().guild;
        if (!g) return;
        if (kind === 'chip') {
            const gd = S().guardian;
            if (!gd || !gd.unlocked || gd.own[arg]) return;
            if (!G.spend('tokens', 200)) return;
            gd.own[arg] = true; gd.chips[arg] = [0, 0, 0];
        } else if (kind === 'relic') {
            const r = D.RELIC_BY[arg];
            if (S().relics[arg]) return;
            if (!G.spend('tokens', r.key.cost)) return;
            G.giveRelic(arg);
        } else if (kind === 'gskin') {
            const gd = S().guardian; if (!gd || gd.skins[arg]) return;
            if (!G.spend('tokens', 150)) return;
            gd.skins[arg] = true;
        } else {
            const p = G.storePrice(kind);
            if (p === null || p === undefined) return;
            if (!G.spend('tokens', p)) return;
            g.buys[kind] = (g.buys[kind] || 0) + 1;
            if (kind === 'bits') G.add('bits', 25);
            if (kind === 'gems') G.add('gems', 100);
            if (kind.startsWith('shards')) G.add('shard:' + kind.split(':')[1], 250);
        }
        G.sfx('coin');
        G.saveSoon();
    };
    G.seasonRelics = () => {
        const n = (G.guildSeason() % 11) + 1;
        return D.RELICS.filter(r => r.src === 'guild' && r.key.season === n);
    };

    /* ---------- the guardian ---------- */
    G.guardianActive = () => !!(S().guild && S().guardian && S().guardian.unlocked && S().guardian.eq.some(Boolean));
    G.unlockGuardian = () => { const gd = S().guardian; if (!gd || gd.unlocked) return; if (!G.spend('bits', 200)) return; gd.unlocked = true; G.saveSoon(); };
    G.guardianSlotCost = () => [null, 200, 300][S().guardian.slots] || null;
    G.buyGuardianSlot = () => { const c = G.guardianSlotCost(); if (!c) return; if (!G.spend('bits', c)) return; S().guardian.slots++; G.saveSoon(); };
    G.toggleChip = (id) => {
        const gd = S().guardian;
        if (!gd || !gd.own[id] || G.run()) return;
        const i = gd.eq.indexOf(id);
        if (i >= 0) gd.eq.splice(i, 1);
        else if (gd.eq.length < gd.slots) gd.eq.push(id);
        else G.toast('No free chip slots', 'bad');
        G.saveSoon();
    };
    G.chipUpCost = (id, i) => { const c = D.CHIP_BY[id], lv = S().guardian.chips[id][i], col = c.t[i]; return lv + 1 < col.length ? col[lv + 1].c : null; };
    G.chipUp = (id, i) => {
        const gd = S().guardian;
        if (!gd || !gd.own[id] || G.run()) return;
        const c = G.chipUpCost(id, i);
        if (c === null) return;
        if (!G.spend('bits', c)) return;
        gd.chips[id][i]++;
        G.saveSoon();
    };
    // guardian fetch: daily caps on gems (20), medals (10) and modules (5 common, 2 rare)
    G.fetchLoot = (run) => {
        const gd = S().guardian, day = G.dayKey();
        if (gd.fetchDay !== day) { gd.fetchDay = day; gd.fetch = {}; }
        const r = Math.random();
        let acc = 0, pick = 'coins';
        for (const [what, p] of D.FETCH) { acc += p; if (r < acc) { pick = what; break; } }
        const cap = { gems: 20, medals: 10, 'module:common': 5, 'module:rare': 2 }[pick];
        if (cap && (gd.fetch[pick] || 0) >= cap) pick = 'coins';
        gd.fetch[pick] = (gd.fetch[pick] || 0) + 1;
        let txt;
        if (pick === 'coins') { const n = run.s.coinWave * run.s.coinMult * 3; G.add('coins', n, 'fetch'); txt = `🪙 ${G.fmt(n)}`; }
        else if (pick === 'gems') { G.add('gems', 1); txt = '💎 1'; }
        else if (pick === 'medals') { G.add('medals', 1); txt = '🏅 1'; }
        else if (pick === 'shard:reroll') { const n = Math.ceil(D.REROLL_SHARDS[run.tier - 1] / 2); G.add('shard:reroll', n); txt = `🎲 ${n}`; }
        else if (pick.startsWith('shard:')) { G.add(pick, 3); txt = `${G.CUR[pick].ic} 3`; }
        else if (pick.startsWith('module:') && S().feat.modules) { G.giveModule(pick.split(':')[1], 'fetch'); txt = '🧩 module'; }
        if (txt) run.floaters.push({ x: 8, y: -10, t: 0, txt: 'Fetch: ' + txt, col: '#a7f3d0' });
    };
})();
