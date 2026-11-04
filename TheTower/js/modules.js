/* The Tower — modules: pulls, sub-effects, merging, shattering, rerolls and slot levels. */
(() => {
    const G = window.TG, D = G.D;
    const S = () => G.S;
    const M = () => S().modules;

    // common and rare modules have plain names; natural epics come from D.UNIQUES
    const NAMES = {
        cannon: ['Pulse Cannon', 'Ion Cannon', 'Railgun', 'Mass Driver'], armor: ['Reactive Plating', 'Ion Shield', 'Nanoweave', 'Bastion Plate'],
        generator: ['Fusion Cell', 'Dynamo', 'Capacitor Bank', 'Flux Generator'], core: ['Quantum Core', 'Void Core', 'Prism Core', 'Arc Core'],
    };
    const RIDX = (r) => D.RAR.findIndex(x => x.id === r);

    // roll a sub-effect rarity no better than the module allows
    function rollSubRarity(maxIdx) {
        let r = Math.random(), acc = 0;
        for (let i = 0; i < D.SUB_RARITY.length; i++) { acc += D.SUB_RARITY[i]; if (r < acc) return Math.min(i, maxIdx); }
        return Math.min(0, maxIdx);
    }
    function rollSub(m, taken) {
        const defs = D.SUBS[m.type];
        const maxIdx = G.modRarity(m).sub;
        const bans = new Set(M().bans ? M().bans[m.type] || [] : []);
        for (let tries = 0; tries < 60; tries++) {
            const r = rollSubRarity(maxIdx);
            const pool = defs.filter(d => d[2][r] !== null && !taken.has(d[0]) && !bans.has(d[0]));
            if (!pool.length) continue;
            const d = G.pick(pool);
            return { k: d[0], r };
        }
        const d = defs.find(x => !taken.has(x[0]) && x[2][0] !== null) || defs[0];
        return { k: d[0], r: 0 };
    }
    function fillSubs(m) {
        const want = G.modMaxSubs(m);
        const taken = new Set(m.subs.map(s => s.k));
        while (m.subs.length < want) { const s = rollSub(m, taken); taken.add(s.k); m.subs.push(s); m.locks.push(false); }
    }
    G.makeModule = (rarity, type, natural) => {
        type = type || G.pick(D.MOD_TYPES)[0];
        const m = { uid: M().uid++, type, rarity, natural: !!natural, stars: 0, subs: [], locks: [], fav: false, at: Date.now() };
        if (natural) m.name = G.pick(D.UNIQUES.filter(u => u.type === type)).name;
        else m.name = rarity === 'common' ? 'Basic ' + D.MOD_TYPES.find(t => t[0] === type)[1] : G.pick(NAMES[type]);
        fillSubs(m);
        return m;
    };
    G.giveModule = (rarity, why, type) => {
        if (M().inv.length >= 350) return null;
        const m = G.makeModule(rarity, type, rarity === 'epic');
        M().inv.push(m);
        G.count('mod_get', 1);
        if (why === 'drop' || why === 'package' || why === 'fetch') G.toast(`🧩 ${rarity === 'rare' ? 'Rare' : 'Common'} module dropped: ${m.name}`, 'good', 2500);
        return m;
    };

    /* ---------- pulls ---------- */
    G.pullModule = () => {
        const mm = M();
        let rar;
        const r = Math.random();
        mm.pity++;
        if (mm.firstEpic && mm.pullsSinceUnlock >= 9) rar = 'epic';
        else if (mm.pity >= D.PULL.pity) rar = 'epic';
        else rar = r < D.PULL.epic ? 'epic' : r < D.PULL.epic + D.PULL.rare ? 'rare' : 'common';
        mm.pullsSinceUnlock = (mm.pullsSinceUnlock || 0) + 1;
        if (rar === 'epic') { mm.pity = 0; mm.firstEpic = false; }
        S().stats.modulesPulled++;
        return G.giveModule(rar, 'pull');
    };
    G.buyModules = (n) => {
        const mm = M();
        if (mm.inv.length + n > 350) { G.toast('Module inventory is full (350)', 'bad'); return []; }
        let fromTickets = Math.min(mm.tickets, n);
        const gems = (n - fromTickets) * D.PULL.gems;
        if (gems && !G.spend('gems', gems)) return [];
        mm.tickets -= fromTickets;
        const got = [];
        for (let i = 0; i < n; i++) got.push(G.pullModule());
        // every 10-pull has at least one rare
        if (n === 10 && !got.some(m => m.rarity !== 'common')) { const m = got[got.length - 1]; m.rarity = 'rare'; m.subs = []; m.locks = []; m.name = G.pick(NAMES[m.type]); fillSubs(m); }
        G.saveSoon();
        return got;
    };

    /* ---------- equip & slot levels ---------- */
    G.modEquip = (uid) => {
        const m = G.modById(uid);
        if (!m || G.run()) return;
        const slot = M().slot[m.type];
        slot.eq = slot.eq === uid ? null : uid;
        G.saveSoon();
    };
    G.slotCost = (type) => {
        const lv = M().slot[type].lv + 1;
        const c = D.modCost(lv);
        return { shards: Math.ceil(c.shards * (1 + G.labV('Module_Shard_Cost'))), coins: Math.ceil(c.coins * (1 + G.labV('Module_Coin_Cost'))) };
    };
    G.slotUp = (type, n = 1) => {
        const slot = M().slot[type];
        let got = 0;
        while (got < n && slot.lv < 300) {
            const c = G.slotCost(type);
            if (S().coins < c.coins || S().shards[type] < c.shards) break;
            S().coins -= c.coins; S().shards[type] -= c.shards;
            slot.spentC = (slot.spentC || 0) + c.coins; slot.spentS = (slot.spentS || 0) + c.shards;
            slot.lv++; got++;
        }
        if (!got) { G.toast('Not enough shards or coins', 'bad'); G.sfx('bad'); }
        G.saveSoon();
        return got;
    };
    // "restore" a slot: back to level 0, every shard and coin returned
    G.slotRestore = (type) => {
        const slot = M().slot[type];
        if (G.run()) return;
        G.add('coins', slot.spentC || 0, 'refund'); G.add('shard:' + type, slot.spentS || 0);
        slot.lv = 0; slot.spentC = 0; slot.spentS = 0;
        G.saveSoon();
    };

    /* ---------- rerolls ---------- */
    G.rerollCost = (m) => Math.ceil(D.REROLL_COST[m.locks.filter(Boolean).length] * (1 - 0.025 * G.vaultLv('rerollDisc')));
    G.reroll = (uid) => {
        const m = G.modById(uid);
        if (!m || G.run()) return;
        if (m.locks.every(Boolean)) return;
        if (!G.spend('shard:reroll', G.rerollCost(m))) return;
        const keep = new Set(m.subs.filter((s, i) => m.locks[i]).map(s => s.k));
        const taken = new Set(keep);
        m.subs = m.subs.map((s, i) => { if (m.locks[i]) return s; const n = rollSub(m, taken); taken.add(n.k); return n; });
        G.saveSoon();
    };
    G.toggleLock = (uid, i) => { const m = G.modById(uid); if (m) { m.locks[i] = !m.locks[i]; G.saveSoon(); } };

    /* ---------- merging ---------- */
    // returns { needs: [{same:bool, rarity}], to } or null
    G.mergeRecipe = (m) => {
        if (!m.natural && RIDX(m.rarity) >= RIDX('legendary+')) return null;
        switch (m.rarity) {
            case 'rare': return { to: 'rare+', needs: [{ same: true, r: 'rare' }, { same: true, r: 'rare' }] };
            case 'rare+': return { to: 'epic', needs: [{ same: false, r: 'rare+' }, { same: false, r: 'rare+' }] };
            case 'epic': return m.natural ? { to: 'epic+', needs: [{ same: true, r: 'epic' }] } : { to: 'epic+', needs: [{ same: false, r: 'epic' }] };
            case 'epic+': return { to: 'legendary', needs: [{ same: false, r: 'epic+' }, { same: false, r: 'epic+' }] };
            case 'legendary': return { to: 'legendary+', needs: [{ same: !!m.natural, r: 'epic+' }] };
            case 'legendary+': return m.natural ? { to: 'mythic', needs: [{ same: false, r: 'legendary+' }] } : null;
            case 'mythic': return { to: 'mythic+', needs: [{ same: false, r: 'legendary+' }] };
            case 'mythic+': return { to: 'ancestral', needs: [{ same: true, r: 'epic+' }, { same: true, r: 'epic+' }] };
            case 'ancestral': return m.stars < 5 ? { to: 'star', needs: [{ same: true, r: 'epic+' }] } : null;
        }
        return null;
    };
    // pick materials automatically: same name if needed, otherwise any of the type; never equipped or favourited ones
    G.mergeMaterials = (m) => {
        const rec = G.mergeRecipe(m);
        if (!rec) return null;
        const used = new Set([m.uid]);
        const eq = new Set(Object.values(M().slot).map(s => s.eq));
        const mats = [];
        for (const need of rec.needs) {
            const c = M().inv.find(x => !used.has(x.uid) && !eq.has(x.uid) && !x.fav && x.type === m.type && x.rarity === need.r && (!need.same || x.name === m.name) && (need.r !== 'epic' || !m.natural || x.natural));
            if (!c) return null;
            used.add(c.uid); mats.push(c);
        }
        return mats;
    };
    G.merge = (uid) => {
        const m = G.modById(uid);
        if (!m || G.run()) return;
        const rec = G.mergeRecipe(m), mats = G.mergeMaterials(m);
        if (!rec || !mats) { G.toast('Missing merge materials', 'bad'); return; }
        const ids = new Set(mats.map(x => x.uid));
        M().inv = M().inv.filter(x => !ids.has(x.uid));
        if (rec.to === 'star') m.stars = (m.stars || 0) + 1;
        else m.rarity = rec.to;
        fillSubs(m);
        G.count('mod_merge', 1);
        G.toast(`🧩 ${m.name} is now ${G.modRarity(m).n}${m.stars ? ' ' + m.stars + '★' : ''}`, 'gold');
        G.saveSoon();
    };

    /* ---------- shattering ---------- */
    G.shatterValue = (m) => {
        let v;
        if (m.natural) {
            if (m.rarity !== 'epic') return 0;
            const has5 = M().inv.some(x => x.natural && x.name === m.name && x.rarity === 'ancestral' && x.stars >= 5);
            if (!has5) return 0;
            v = D.SHATTER.natural;
        } else v = D.SHATTER[m.rarity] || 0;
        return Math.round(v * (1 + G.labV('Shatter_Shards')));
    };
    G.shatter = (uid) => {
        const m = G.modById(uid);
        if (!m || m.fav || G.run() || Object.values(M().slot).some(s => s.eq === uid)) return;
        const v = G.shatterValue(m);
        if (!v) { G.toast('This module can\'t be shattered yet', 'bad'); return; }
        M().inv = M().inv.filter(x => x !== m);
        G.add('shard:' + m.type, v);
        G.saveSoon();
    };
    G.shatterAll = (rarity) => {
        const eq = new Set(Object.values(M().slot).map(s => s.eq));
        let n = 0, got = {};
        for (const m of M().inv.slice()) {
            if (m.rarity !== rarity || m.natural || m.fav || eq.has(m.uid)) continue;
            const v = G.shatterValue(m);
            if (!v) continue;
            M().inv = M().inv.filter(x => x !== m);
            G.add('shard:' + m.type, v);
            got[m.type] = (got[m.type] || 0) + v; n++;
        }
        G.saveSoon();
        return n;
    };
    G.unmerge = (uid) => {
        const m = G.modById(uid);
        if (!m || !G.labDone('Unmerge_Module') || G.run()) return;
        const back = { 'rare+': ['rare', 2, 0], epic: ['rare+', 0, 60], 'epic+': ['epic', 1, 0], legendary: ['epic+', 0, 360], 'legendary+': ['legendary', 1, 0], mythic: ['legendary+', 0, 360], 'mythic+': ['mythic', 0, 720] }[m.rarity];
        if (!back || (m.natural && m.rarity === 'epic')) return;
        if (!G.spend('gems', 20)) return;
        const [to, copies, shards] = back;
        // copies come back at the rarity used as material (wiki unmerge table)
        const copyRarity = { 'rare+': 'rare', 'epic+': 'epic', 'legendary+': 'epic+' }[m.rarity];
        m.rarity = to;
        m.subs = m.subs.slice(0, G.modMaxSubs(m)); m.locks = m.locks.slice(0, m.subs.length);
        for (let i = 0; i < copies; i++) {
            const c = G.makeModule(copyRarity === 'rare' ? 'rare' : 'epic', m.type, m.natural);
            c.rarity = copyRarity;
            if (m.natural || copyRarity === 'rare') c.name = m.name;
            M().inv.push(c);
        }
        if (shards) G.add('shard:' + m.type, Math.round(shards * (1 + G.labV('Shatter_Shards'))));
        G.saveSoon();
    };
})();
