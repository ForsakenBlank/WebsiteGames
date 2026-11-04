/* The Tower — progression outside of battle: workshop, labs, cards, ultimate weapons, bots, milestones, vault, free gems and autopilot. */
(() => {
    const G = window.TG, D = G.D;
    const S = () => G.S;

    /* ======================================================================
       COUNTERS (feed daily missions and event missions)
       ====================================================================== */
    G.count = (stat, n = 1) => {
        const s = S();
        for (const m of s.daily.board) if (m.stat === stat && !m.claimed) m.p = Math.min(m.goal, m.p + n);
        if (s.event && s.event.c) s.event.c[stat] = (s.event.c[stat] || 0) + n;
    };
    G.countMax = (stat, v) => {
        const s = S();
        if (s.event && s.event.c && v > (s.event.c[stat] || 0)) s.event.c[stat] = v;
    };

    /* ======================================================================
       MILESTONES
       ====================================================================== */
    const SUFX = { k: 1e3, m: 1e6, b: 1e9, t: 1e12, q: 1e15 };
    // turn "1.5k Coins + Labs" into reward objects
    G.parseReward = (str) => {
        const out = [];
        for (const part of String(str).split(' + ')) {
            const p = part.trim();
            let m;
            if (!p) continue;
            if ((m = p.match(/^([\d.,]+)\s*([kmbtq]?)\s*(coins)?$/i)) && (m[3] || /^\d/.test(p))) {
                const v = parseFloat(m[1].replace(/,/g, '')) * (SUFX[m[2].toLowerCase()] || 1);
                if (/gem|stone/i.test(p)) continue;
                out.push({ cur: 'coins', n: v });
            } else if ((m = p.match(/^([\d,]+)\s*gems?$/i))) out.push({ cur: 'gems', n: +m[1].replace(/,/g, '') });
            else if ((m = p.match(/^([\d,]+)\s*stones?$/i))) out.push({ cur: 'stones', n: +m[1].replace(/,/g, '') });
            else if ((m = p.match(/^(?:unlock )?tier (\d+)$/i))) out.push({ tier: +m[1] });
            else out.push({ text: p });
        }
        return out;
    };
    const FEATS = { 'Labs': 'labs', 'Tournaments': 'tournaments', 'Events': 'events', 'Modules': 'modules', 'Guilds': 'guilds', 'Unlock Dissonance': 'dissonance',
        'Card Mastery Unlock': 'mastery', 'Assist Module': 'assist', 'Global Presets': 'globalPresets' };
    G.msKey = (t, w) => t + ':' + w;
    G.msClaimed = (t, w) => !!S().ms[G.msKey(t, w)];
    // a "T5W200" style requirement has been claimed
    G.msHas = (code) => { if (!code) return true; const m = code.match(/^T(\d+)W(\d+)$/); return m ? G.msClaimed(+m[1], +m[2]) : true; };
    G.msReached = (t, w) => (S().tierBest[t] || 0) >= w;
    G.msClaimable = () => {
        let n = 0;
        for (const t in D.MILESTONES) for (const m of D.MILESTONES[t]) {
            if (!G.msReached(+t, m.wave)) break;
            if (!G.msClaimed(+t, m.wave)) n++;
            if (S().premium[passOf(+t)] && !S().ms['p' + G.msKey(t, m.wave)]) n++;
        }
        return n;
    };
    const passOf = (t) => Math.floor((t - 1) / 3);
    G.passOf = passOf;
    function grant(rew, t, w, label) {
        for (const r of G.parseReward(rew)) {
            if (r.cur) G.add(r.cur, r.n, 'milestone');
            else if (r.tier) { if (r.tier > S().maxTier) { S().maxTier = r.tier; G.toast(`🗼 Tier ${r.tier} unlocked!`, 'gold', 3500); } }
            else if (r.text) {
                const f = FEATS[r.text];
                if (f) {
                    S().feat[f] = true;
                    if (f === 'labs' && S().labs.slots < 1) S().labs.slots = 1;
                    if (f === 'modules') { S().modules.tickets += 10; S().modules.firstEpic = true; }
                    if (f === 'tournaments') G.ensureTournament();
                    if (f === 'events') G.ensureEvent();
                }
                const card = r.text.match(/^Card:\s*(.+)$/i) || r.text.match(/^(Area of Effect) Card$/i);
                if (card) { const c = D.CARDS.find(x => x.ms === `T${t}W${w}`); if (c) S().cardPool[c.id] = true; }
                if (/Recovery Package Chance/.test(r.text) && t === 2) S().cardPool.recoveryPackage = true;
                if (/skin$/i.test(r.text) || r.text === 'Eclipse') S().skins.owned['ms' + t] = true;
            }
        }
        // the wave 4,500 relic
        if (w === 4500 && label === 'std') { const rel = D.RELICS.find(x => x.src === 'milestone' && x.key === t); if (rel) G.giveRelic(rel.id); }
    }
    G.claimMilestone = (t, w, prem) => {
        const m = D.MILESTONES[t].find(x => x.wave === w);
        if (!m || !G.msReached(t, w)) return;
        const key = (prem ? 'p' : '') + G.msKey(t, w);
        if (S().ms[key]) return;
        if (prem && !S().premium[passOf(t)]) return;
        S().ms[key] = true;
        grant(prem ? m.prem : m.std, t, w, prem ? 'prem' : 'std');
        G.sfx('coin');
        G.saveSoon();
    };
    G.claimAllMilestones = () => {
        let n = 0;
        for (const t in D.MILESTONES) for (const m of D.MILESTONES[t]) {
            if (!G.msReached(+t, m.wave)) break;
            if (!G.msClaimed(+t, m.wave)) { G.claimMilestone(+t, m.wave, false); n++; }
            if (S().premium[passOf(+t)] && !S().ms['p' + G.msKey(t, m.wave)]) { G.claimMilestone(+t, m.wave, true); n++; }
        }
        return n;
    };
    G.buyPass = (p) => {
        if (S().premium[p]) return;
        if (!G.spend('gems', D.PREMIUM_PASS_GEMS)) return;
        S().premium[p] = true;
        G.toast(`🎫 Premium pass for tiers ${p * 3 + 1}–${p * 3 + 3} unlocked`, 'gold');
        G.saveSoon();
    };

    /* ======================================================================
       WORKSHOP
       ====================================================================== */
    const discCat = (cat) => G.labV({ attack: 'Workshop_Attack_Discount', defense: 'Workshop_Defense_Discount', utility: 'Workshop_Utility_Discount' }[cat]);
    G.wsCost = (u, L) => Math.ceil(u.cost(L) * (1 - discCat(u.cat)));
    G.wsBuy = (id, n = 1) => {
        const u = D.UPG_BY[id];
        if (!G.unlocked(u) || G.run()) return 0;
        let got = 0;
        while (got < n && G.wsLv(id) < u.max) {
            const c = G.wsCost(u, G.wsLv(id) + 1);
            if (S().coins < c) break;
            S().coins -= c;
            S().ws[id] = G.wsLv(id) + 1;
            got++;
        }
        if (got) { S().stats.wsUpgrades += got; G.count('ws_buy', got); G.saveSoon(); }
        return got;
    };
    G.groupUnlockable = (g) => {
        const cat = D.GROUPS[g].cat, order = D.GROUP_ORDER[cat], i = order.indexOf(g);
        return i === 0 || G.groupOn(order[i - 1]);
    };
    G.groupOn = (g) => D.GROUPS[g].cost === 0 || !!S().wsUnl[g];
    G.unlockGroup = (g) => {
        if (G.groupOn(g) || !G.groupUnlockable(g) || G.run()) return;
        if (!G.spend('coins', D.GROUPS[g].cost)) return;
        S().wsUnl[g] = true;
        G.sfx('power');
        G.saveSoon();
    };
    // Workshop Respec (lab): refunds the undiscounted price of every level
    G.respec = () => {
        if (!G.labDone('Workshop_Respec') || G.run()) return;
        if (!G.spend('gems', 150)) return;
        let refund = 0;
        for (const u of D.UPG) { for (let L = 1; L <= G.wsLv(u.id); L++) refund += u.cost(L); S().ws[u.id] = 0; }
        G.add('coins', refund, 'respec');
        G.toast(`♻️ Workshop reset, ${G.fmt(refund)} coins refunded`, 'gold');
        G.saveSoon();
    };

    /* ---------- enhancements ---------- */
    G.enhCost = (e) => Math.ceil(e.cost((S().enh[e.id] || 0) + 1) * (1 - G.labV('Enhancement_Coin_Discount')));
    G.enhUnlocked = (e) => G.labDone('Workshop_Enhancement') && S().enhSpent[e.cat] >= e.need;
    G.enhBuy = (id) => {
        const e = D.ENH.find(x => x.id === id);
        if (!e || !G.enhUnlocked(e) || (S().enh[id] || 0) >= e.max || G.run()) return;
        const c = G.enhCost(e);
        if (!G.spend('coins', c)) return;
        S().enh[id] = (S().enh[id] || 0) + 1;
        S().enhSpent[e.cat] += c;
        G.saveSoon();
    };

    /* ======================================================================
       LABS
       Research stores the work left in "base seconds"; every real second it
       advances by the lab speed, so speed changes and boosts apply at once.
       ====================================================================== */
    G.labAvailable = (lab) => {
        if (!S().feat.labs) return false;
        const u = lab.unlock;
        if (u.startsWith('lab:')) return G.labDone(u.slice(4));
        return G.msHas(u);
    };
    G.labCost = (lab, L) => Math.ceil(lab.rows[L].c * (1 - G.labV('Labs_Coin_Discount')));
    G.labTime = (lab, L) => lab.rows[L].t;
    G.labSpeed = (forLabSpeed) => (forLabSpeed ? 1 : G.labV('Lab_Speed', 1) || 1) * (1 + G.relic('labSpeed')) * D.OVERCLOCK[S().labs.overclock || 0].m;
    G.slotBoost = (slot) => { const b = S().labs.boosts[slot]; return b && b.until > Date.now() ? b.m : 1; };
    G.labRate = (a) => G.labSpeed(a.id === 'Lab_Speed') * G.slotBoost(a.slot);
    G.labRemainingSec = (a) => Math.max(0, (a.work - a.done) / G.labRate(a));
    G.freeSlot = () => { for (let i = 0; i < S().labs.slots; i++) if (!S().labs.active.some(a => a.slot === i)) return i; return -1; };
    G.labBusy = (id) => S().labs.active.some(a => a.id === id);
    // slot and start time are given when the lab tick restarts a research at the moment the last one finished
    G.labStart = (id, quiet, slot, at) => {
        const lab = D.LAB_BY[id] || G.masteryLab(id);
        if (!lab || !G.labAvailable(lab) && !id.startsWith('M_')) return false;
        const L = G.labLv(id);
        if (L >= lab.max || G.labBusy(id)) return false;
        if (slot === undefined || S().labs.active.some(a => a.slot === slot)) slot = G.freeSlot();
        if (slot < 0) { if (!quiet) G.toast('All labs are busy', 'bad'); return false; }
        const c = G.labCost(lab, L);
        if (S().coins < c) { if (!quiet) { G.toast('Not enough coins', 'bad'); G.sfx('bad'); } return false; }
        S().coins -= c;
        const work = G.labTime(lab, L), partial = S().labs.partial || {};
        S().labs.active.push({ id, slot, work, done: Math.min(work, partial[id] || 0), last: at || Date.now(), paid: c });
        delete partial[id];
        if (!quiet) G.sfx('power');
        G.saveSoon();
        return true;
    };
    G.labCancel = (id) => {
        const a = S().labs.active.find(x => x.id === id);
        if (!a) return;
        // like the game: coins come back, the progress is kept for next time
        S().labs.active = S().labs.active.filter(x => x !== a);
        G.add('coins', a.paid, 'refund');
        S().labs.partial = S().labs.partial || {};
        S().labs.partial[id] = a.done;
        G.saveSoon();
    };
    G.rushCost = (a) => Math.max(1, Math.ceil(G.curve(D.RUSH, G.labRemainingSec(a))));
    G.labRush = (id) => {
        const a = S().labs.active.find(x => x.id === id);
        if (!a) return;
        if (!G.spend('gems', G.rushCost(a))) return;
        G.count('lab_time', G.labRemainingSec(a)); // rushed time counts for the event mission
        a.done = a.work;
        G.labTick();
    };
    // A cell boost only speeds up the part of the research before it runs out, so progress is worked out in two pieces.
    function labFinishAt(a) {
        const base = G.labSpeed(a.id === 'Lab_Speed'), b = S().labs.boosts[a.slot];
        let need = a.work - a.done;
        if (b && b.until > a.last) {
            const fast = base * b.m, span = (b.until - a.last) / 1000;
            if (need <= fast * span) return a.last + need / fast * 1000;
            need -= fast * span;
            return b.until + need / base * 1000;
        }
        return a.last + need / base * 1000;
    }
    function labAdvance(a, to) {
        if (to <= a.last) return;
        const base = G.labSpeed(a.id === 'Lab_Speed'), b = S().labs.boosts[a.slot];
        const fastEnd = b && b.until > a.last ? Math.min(b.until, to) : a.last;
        a.done = Math.min(a.work, a.done + ((fastEnd - a.last) * (b ? b.m : 1) + (to - fastEnd)) / 1000 * base);
        G.count('lab_time', (to - a.last) / 1000);
        a.last = to;
    }
    function assistantPick() {
        const s = S();
        return D.LABS.filter(l => G.labAvailable(l) && G.labLv(l.id) < l.max && !G.labBusy(l.id) && G.labCost(l, G.labLv(l.id)) <= s.coins)
            .sort((a, b) => G.labCost(a, G.labLv(a.id)) - G.labCost(b, G.labLv(b.id)))[0];
    }
    // Labs finish in the order they would have in real time, so after a long time away an auto lab keeps
    // researching level after level, and the lab assistant keeps refilling slots that aren't on auto.
    G.labTick = () => {
        const now = Date.now();
        const s = S();
        const gained = {};
        for (let guard = 0; guard < 5000; guard++) {
            let first = null, firstT = now;
            for (const a of s.labs.active) { const t = labFinishAt(a); if (t <= firstT) { first = a; firstT = t; } }
            if (!first) break;
            for (const a of s.labs.active) labAdvance(a, firstT);
            first.done = first.work;
            s.labs.active = s.labs.active.filter(a => a !== first);
            s.labs.lv[first.id] = (s.labs.lv[first.id] || 0) + 1;
            s.stats.labsDone++;
            if (first.id.startsWith('M_')) s.cards.mastery[first.id.slice(2)] = s.labs.lv[first.id];
            gained[first.id] = (gained[first.id] || 0) + 1;
            const lab = D.LAB_BY[first.id] || G.masteryLab(first.id);
            // auto research the next level in the same slot, starting the moment this one finished
            if (s.labs.auto[first.id] && s.labs.lv[first.id] < lab.max && G.labStart(first.id, true, first.slot, firstT)) continue;
            if (G.apOn('lab')) { const pick = assistantPick(); if (pick) G.labStart(pick.id, true, first.slot, firstT); }
        }
        for (const a of s.labs.active) labAdvance(a, now);
        // autopilot: lab assistant fills any other idle slots
        if (G.apOn('lab')) while (G.freeSlot() >= 0) {
            const pick = assistantPick();
            if (!pick || !G.labStart(pick.id, true)) break;
            G.toast(`🧪 Lab assistant started ${pick.name}`, 'good', 2000);
        }
        const ids = Object.keys(gained);
        const name = (id) => (D.LAB_BY[id] || G.masteryLab(id)).name;
        if (ids.length > 3) G.toast(`🧪 ${ids.reduce((n, id) => n + gained[id], 0)} researches finished: ${ids.map(id => `${name(id)} → ${s.labs.lv[id]}`).join(', ')}`, 'gold', 7000);
        else for (const id of ids) G.toast(`🧪 ${name(id)} → level ${s.labs.lv[id]}${gained[id] > 1 ? ` (+${gained[id]} levels)` : ''}`, 'gold', gained[id] > 1 ? 5000 : 3000);
        if (ids.length && G.B && G.run()) G.B.recalc();
        // expired cell boosts
        s.labs.boosts = s.labs.boosts.map(b => (b && b.until > now ? b : null));
        return ids.length > 0;
    };
    G.buyLabSlot = () => {
        const n = S().labs.slots;
        if (n >= 5 || n < 1) return;
        if (!G.spend('gems', D.LAB_SLOT_GEMS[n])) return;
        S().labs.slots++;
        G.saveSoon();
    };
    G.buyOverclock = () => {
        const L = S().labs.overclock || 0;
        if (L >= D.OVERCLOCK.length - 1) return;
        if (!G.spend('coins', D.OVERCLOCK[L + 1].c)) return;
        S().labs.overclock = L + 1;
        G.sfx('power');
        G.saveSoon();
    };
    G.buyCellBoost = (slot, idx, hours) => {
        const [m, per] = D.CELL_BOOSTS[idx];
        if (!G.spend('cells', per * hours)) return;
        const cur = S().labs.boosts[slot];
        const start = cur && cur.until > Date.now() && cur.m === m ? cur.until : Date.now();
        S().labs.boosts[slot] = { m, until: start + hours * 3600000 };
        G.saveSoon();
    };
    // card mastery labs are generated per card
    G.masteryLab = (id) => {
        if (!id || !id.startsWith('M_')) return null;
        const card = D.CARD_BY[id.slice(2)];
        return { id, cat: 'card', unlock: 'mastery', name: card.name + ' Mastery', max: 9, rows: D.MASTERY_LAB.map(([t, c], i) => ({ t, c, v: D.MASTERY[card.id].vals[i + 1], n: i + 1 })) };
    };

    /* ======================================================================
       CARDS
       ====================================================================== */
    G.cardsUnlocked = () => (S().runsOnTier[1] || 0) >= 2 || S().maxTier > 1;
    G.cardInPool = (c) => !c.ms || S().cardPool[c.id];
    G.cardSlots = () => S().cards.slots + G.vaultLv('cardSlot');
    G.pullCard = () => {
        const s = S();
        let rar;
        const r = Math.random();
        rar = r < D.CARD_RARITY.epic ? 'epic' : r < D.CARD_RARITY.epic + D.CARD_RARITY.rare ? 'rare' : 'common';
        const avail = (x) => D.CARDS.filter(c => c.r === x && G.cardInPool(c) && G.cardLevel(c.id) < 7);
        let pool = avail(rar);
        if (!pool.length) pool = ['common', 'rare', 'epic'].flatMap(avail);
        if (!pool.length) return null;
        let card = G.pick(pool);
        if (s.cards.firstPull) { card = D.CARD_BY[G.pick(['damage', 'attackSpeed'])]; s.cards.firstPull = false; }
        s.cards.have[card.id] = (s.cards.have[card.id] || 0) + 1;
        s.stats.cardsBought++;
        G.count('card_buy', 1);
        return card;
    };
    G.buyCards = (n) => {
        const cost = n === 10 ? 200 : 20 * n;
        if (!G.spend('gems', cost)) return [];
        const got = [];
        for (let i = 0; i < n; i++) { const c = G.pullCard(); if (c) got.push(c); }
        G.saveSoon();
        return got;
    };
    G.buyCardSlot = () => {
        const n = S().cards.slots;
        if (n >= 22) return;
        if (!G.spend('gems', D.CARD_SLOT_GEMS[n + 1])) return;
        S().cards.slots++;
        G.saveSoon();
    };
    G.toggleCard = (id) => {
        const s = S(), eq = s.cards.eq, card = D.CARD_BY[id], r = G.run();
        if (r && card.locked) { G.toast('🔒 This card can\'t be changed during a run', 'bad'); return; }
        if (r && r.enemies.some(e => e.boss || e.fleet)) { G.toast('Cards can\'t be changed while a boss is alive', 'bad'); return; }
        const i = eq.indexOf(id);
        if (i >= 0) eq.splice(i, 1);
        else {
            if (!G.cardLevel(id)) return;
            if (eq.length >= G.cardSlots()) { G.toast('No free card slots', 'bad'); return; }
            eq.push(id);
        }
        if (G.labDone('Presets')) s.cards.presets[s.cards.preset] = eq.slice();
        if (r) G.B.recalc();
        G.saveSoon();
    };
    G.usePreset = (i) => {
        const s = S();
        if (!G.labDone('Presets')) return;
        const next = (s.cards.presets[i] || []).filter(id => G.cardLevel(id));
        const r = G.run();
        if (r) {
            const lockedNow = s.cards.eq.filter(id => D.CARD_BY[id].locked).sort().join(), lockedNext = next.filter(id => D.CARD_BY[id].locked).sort().join();
            if (lockedNow !== lockedNext) { G.toast('That preset has different 🔒 cards', 'bad'); return; }
        }
        s.cards.preset = i;
        s.cards.eq = next.slice(0, G.cardSlots());
        if (r) G.B.recalc();
        G.saveSoon();
    };
    G.masteryUnlocked = () => S().feat.mastery && D.CARDS.filter(c => G.cardLevel(c.id) >= 7).length >= 30;
    G.buyMastery = (id) => {
        if (!G.masteryUnlocked() || G.cardLevel(id) < 7 || S().cards.mastery[id] !== undefined || G.run()) return;
        if (!G.spend('stones', D.MASTERY[id].stones)) return;
        S().cards.mastery[id] = 0;
        G.saveSoon();
    };

    /* ======================================================================
       ULTIMATE WEAPONS
       ====================================================================== */
    G.uwOwnedCount = () => Object.keys(S().uw.own).length;
    // three weapons you don't own, avoiding the ones offered last time whenever enough others are left
    function rollUwOffer(avoid) {
        const s = S();
        const left = D.UWS.filter(u => !s.uw.own[u.id]).map(u => u.id);
        const fresh = left.filter(id => !avoid.includes(id)), old = left.filter(id => avoid.includes(id));
        const offer = [];
        for (const pool of [fresh, old]) while (pool.length && offer.length < 3) offer.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
        s.uw.offer = offer;
        s.uw.freeReroll = true;
    }
    G.uwOffer = () => {
        const s = S();
        if (G.uwOwnedCount() >= D.UWS.length) return [];
        if (!s.uw.offer || s.uw.offer.some(id => s.uw.own[id])) rollUwOffer(s.uw.offer || []);
        return s.uw.offer;
    };
    // one free reroll per offer; a new offer (after an unlock) gets a new one
    G.uwReroll = () => {
        const s = S();
        if (!s.uw.freeReroll || G.run()) return;
        rollUwOffer(G.uwOffer());
        s.uw.freeReroll = false;
        G.saveSoon();
    };
    G.uwBuy = (id) => {
        const s = S();
        if (s.uw.own[id] || G.run() || !G.uwOffer().includes(id)) return;
        if (!G.spend('stones', D.UW_COST[G.uwOwnedCount()])) return;
        s.uw.own[id] = [0, 0, 0];
        // every option is rerolled for the next weapon
        rollUwOffer(s.uw.offer);
        G.toast(`${D.UW_BY[id].ic} ${D.UW_BY[id].name} unlocked!`, 'gold');
        G.saveSoon();
    };
    G.uwUpCost = (id, i) => { const lv = S().uw.own[id][i], col = D.UW_BY[id].t[i]; return lv + 1 < col.length ? col[lv + 1].c : null; };
    G.uwUp = (id, i) => {
        const s = S();
        if (!s.uw.own[id] || G.run()) return;
        const c = G.uwUpCost(id, i);
        if (c === null) return;
        if (!G.spend('stones', c)) return;
        s.uw.own[id][i]++;
        G.saveSoon();
    };
    G.uwPlusBuy = (id) => {
        const s = S();
        if (G.uwOwnedCount() < 9 || s.uw.plus[id] !== undefined || G.run()) return;
        if (!G.spend('stones', D.UWP_COST[Object.keys(s.uw.plus).length])) return;
        s.uw.plus[id] = 0;
        G.saveSoon();
    };
    G.uwPlusUp = (id) => {
        const s = S(), p = D.UW_PLUS[id], L = s.uw.plus[id];
        if (L === undefined || L + 1 >= p.vals.length || G.run()) return;
        if (!G.spend('stones', p.cost[L + 1] || p.cost[p.cost.length - 1])) return;
        s.uw.plus[id] = L + 1;
        G.saveSoon();
    };

    /* ======================================================================
       BOTS (medals, from the event shop)
       ====================================================================== */
    G.botBuy = (id) => {
        const s = S();
        if (s.bots.own[id]) return;
        if (!G.spend('medals', D.BOT_UNLOCK[Object.keys(s.bots.own).length])) return;
        s.bots.own[id] = true; s.bots.lv[id] = [0, 0, 0, 0]; s.bots.on[id] = true;
        G.saveSoon();
    };
    G.botUp = (id, i) => {
        const s = S(), b = D.BOT_BY[id], lv = s.bots.lv[id];
        if (!lv || lv[i] >= b.t[i].length || G.run()) return;
        if (!G.spend('medals', D.botUpCost(lv[i]))) return;
        lv[i]++;
        G.saveSoon();
    };

    G.botPlusReady = () => D.BOTS.every(b => S().bots.own[b.id]);
    G.botPlusBuy = (id) => {
        const s = S();
        if (!G.botPlusReady() || s.bots.plus[id] || G.run()) return;
        if (!G.spend('stones', D.BOT_PLUS_STONES)) return;
        s.bots.plus[id] = true; s.bots.plusLv[id] = 0;
        G.saveSoon();
    };
    G.botPlusUp = (id) => {
        const s = S(), p = D.BOT_PLUS[id], L = s.bots.plusLv[id] || 0;
        if (!s.bots.plus[id] || L + 1 >= p.vals.length || G.run()) return;
        if (!G.spend('medals', p.cost[L + 1])) return;
        s.bots.plusLv[id] = L + 1;
        G.saveSoon();
    };
    // a Bot+ value, or 0 when it isn't active (needs all five bots unlocked)
    G.botPlus = (id) => (G.botPlusReady() && S().bots.plus[id] ? D.BOT_PLUS[id].vals[S().bots.plusLv[id] || 0] : 0);

    /* ======================================================================
       RELICS
       ====================================================================== */
    G.giveRelic = (id) => {
        if (S().relics[id]) return false;
        S().relics[id] = Date.now();
        const r = D.RELIC_BY[id];
        G.toast(`🏺 Relic: ${r.name} — ${r.desc}`, 'gold', 4500);
        return true;
    };
    G.checkYearRelics = () => {
        const yrs = (Date.now() - S().created) / (365 * G.DAY);
        for (const r of D.RELICS) if (r.src === 'years' && yrs >= r.key) G.giveRelic(r.id);
    };

    /* ======================================================================
       VAULT
       ====================================================================== */
    G.vaultSecOpen = (sec) => sec.unlock === 0 || !!S().vault['sec:' + sec.sec];
    G.vaultOpenSec = (sec) => { if (G.vaultSecOpen(sec)) return; if (!G.spend('keys', sec.unlock)) return; S().vault['sec:' + sec.sec] = 1; G.saveSoon(); };
    G.vaultBuy = (id) => {
        for (const sec of D.VAULT) for (const it of sec.items) if (it.id === id) {
            if (!G.vaultSecOpen(sec)) return;
            const L = G.vaultLv(id);
            if (L >= it.costs.length) return;
            if (!G.spend('keys', it.costs[L])) return;
            S().vault[id] = L + 1;
            G.saveSoon();
        }
    };

    /* ======================================================================
       FREE GEMS (stand-ins for ads and the store)
       ====================================================================== */
    G.dailyGemsReady = () => S().free.dailyGemDay !== G.dayKey();
    G.claimDailyGems = () => {
        if (!G.dailyGemsReady()) return;
        S().free.dailyGemDay = G.dayKey();
        G.add('gems', 20, 'daily');
        G.count('free_gems', 1);
        G.toast('💎 +20 free daily gems', 'good');
        G.saveSoon();
    };
    G.adGemMax = () => 1 + G.vaultLv('adStack');
    // ad gems become available every ~10 minutes of play
    G.adGemTick = (realSec) => {
        const f = S().free;
        if (f.adDay !== G.dayKey()) { f.adDay = G.dayKey(); f.adGemsToday = 0; }
        f.adStack = f.adStack || 0;
        if (f.adStack >= G.adGemMax()) return;
        f.adPlay = (f.adPlay || 0) + realSec;
        if (f.adPlay >= 600) { f.adPlay = 0; f.adStack++; }
    };
    G.claimAdGems = () => {
        const f = S().free;
        if (!f.adStack || f.adGemsToday >= 60) return;
        const n = Math.min(f.adStack, 60 - f.adGemsToday);
        f.adStack -= n; f.adGemsToday += n;
        G.add('gems', 6 * n, 'ad');
        G.toast(`💎 +${6 * n} gems`, 'good');
        G.saveSoon();
    };
    G.addCoinBoost = () => {
        const f = S().free;
        if (f.coinBoost >= 7200 - 1) return;
        f.coinBoost = Math.min(7200, f.coinBoost + 1200);
        G.toast('🪙 ×1.5 coins for 20 more minutes of play', 'good');
        if (G.B && G.run()) G.B.recalc();
        G.saveSoon();
    };

    /* ======================================================================
       AUTOPILOT (from the earlier version of this game)
       ====================================================================== */
    G.apOwn = (id) => !!S().ap.own[id];
    G.apOn = (id) => G.apOwn(id) && S().ap.on[id] !== false;
    G.apBuy = (id) => {
        const a = D.AUTOS.find(x => x.id === id);
        if (G.apOwn(id)) return;
        if (!G.spend('coins', a.price)) return;
        S().ap.own[id] = true; S().ap.on[id] = true;
        G.saveSoon();
    };
    // auto-buyer: cheapest affordable battle upgrade in the chosen categories
    G.autoBuy = () => {
        const r = G.run();
        if (!r || !G.apOn('buy')) return;
        const ap = S().ap;
        let guard = 0;
        while (guard++ < 30) {
            let best = null, bw = Infinity;
            for (const u of D.UPG) {
                if (!ap.cats[u.cat] || ap.skip[u.id] || !G.B.canBuy(u.id)) continue;
                const c = G.B.runCost(u.id, 1);
                if (c > r.cash) continue;
                const w = c * (D.AUTO_WEIGHT[u.id] || 2);
                if (w < bw) { bw = w; best = u; }
            }
            if (!best) break;
            G.B.buy(best.id, 1);
        }
    };

    /* ======================================================================
       DISSONANCE
       ====================================================================== */
    G.recordDissonance = (run) => {
        if (!run.diss || run.tour) return;
        const k = run.tier + ':' + run.diss;
        if (run.wave > (S().dissonance[k] || 0)) S().dissonance[k] = run.wave;
    };
    G.on('runEnd', (run) => G.recordDissonance(run));
})();
