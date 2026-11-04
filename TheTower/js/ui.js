/* The Tower — everything on screen that isn't the canvas: side panel, battle HUD and the menus. */
(() => {
    const G = window.TG, D = G.D, B = G.B;
    const UI = G.UI = {};
    const $ = (id) => document.getElementById(id);
    const S = () => G.S;
    const esc = G.esc, F = G.fmt;
    let menuTab = null, runTab = 'attack', wsCat = 'attack', labCat = 'main', modView = 'slots', modSel = null, modFilter = 'all', msTier = 1, wsMult = 1, showLockedLabs = false;
    let lastPulls = [], lastMenu = '';
    UI.state = () => ({ menuTab, runTab });

    /* ---------- formatting ---------- */
    const SHOW = {
        num: (v) => F(v), x2: (v) => v.toFixed(2), pct: (v) => G.pct(v, 1), pct2: (v) => G.pct(v, 2), pct0: (v) => G.pct(v, 0), x: (v) => '×' + (v >= 1000 ? F(v) : v.toFixed(2)),
        x4: (v) => '×' + v.toFixed(3), m: (v) => v.toFixed(1) + 'm', s: (v) => v.toFixed(2) + 's', int: (v) => String(Math.round(v)), dec: (v) => v.toFixed(2),
        regen: (v) => F(v) + '/s', cash: (v) => '$' + F(v), pct100: (v) => (v < 1 ? G.pct(v, 1) : v.toFixed(1) + '%'), deg: (v) => Math.round(v) + '°', rpm: (v) => v.toFixed(1) + ' rpm', min: (v) => v + ' min',
        'pct+': (v) => '+' + G.pct(v, 1), 'int+': (v) => '+' + v,
    };
    UI.show = (f, v) => (SHOW[f] || SHOW.num)(v);
    const CUR_COL = { coins: 'var(--coin)', gems: 'var(--gem)', stones: 'var(--stone)', medals: 'var(--medal)', cells: '#7ef0c8', keys: '#f0c75a' };
    const cur = (c, n) => `<span class="cnt" style="--c:${CUR_COL[c] || 'var(--text)'}" title="${G.CUR[c].n}"><i>${G.CUR[c].ic}</i><b>${F(n)}</b></span>`;
    const btn = (label, act, data = {}, cls = '', dis = false, title = '') => `<button class="btn sm ${cls}" data-act="${act}" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')} ${dis ? 'disabled' : ''} ${title ? `title="${esc(title)}"` : ''}>${label}</button>`;
    const prog = (f, cls = '') => `<div class="progress ${cls}"><i style="width:${Math.max(0, Math.min(100, f * 100)).toFixed(1)}%"></i></div>`;
    const timeLeft = (ms) => G.dur(ms / 1000);

    /* ======================================================================
       TOP BAR
       ====================================================================== */
    function topStats() {
        const s = S();
        let h = cur('coins', s.coins) + cur('gems', s.gems);
        if (s.stones || s.feat.tournaments) h += cur('stones', s.stones);
        if (s.feat.events) h += cur('medals', s.medals);
        if (s.cells || s.maxTier > 1) h += cur('cells', s.cells);
        if (s.keys) h += cur('keys', s.keys);
        set('topStats', h);
    }
    function set(id, html) { const el = $(id); if (el && el._h !== html) { el._h = html; el.innerHTML = G.iconize(html); } }

    /* ======================================================================
       LEFT RAIL: the game's bottom navigation bar, stood on its side
       ====================================================================== */
    const NAV = ['workshop', 'uw', 'cards', 'modules', 'labs', 'store'];
    // less-used pages also sit in the top bar
    const TOP_MENUS = ['autopilot', 'stats', 'settings'];
    function rail() {
        const r = G.run();
        let h = `<button class="${menuTab ? '' : 'on'}" data-act="closeMenu" title="${r && !r.over ? 'Back to the battle' : 'Home'}"><span class="ic">${G.ic('swords')}</span>Battle</button>`;
        for (const id of NAV) {
            const m = MENUS.find(x => x[0] === id), open = menuUnlocked(id), n = open ? badge(id) : 0;
            h += `<button class="${menuTab === id ? 'on' : ''}" ${open ? `data-act="openMenu" data-tab="${id}"` : `data-act="lockedMenu" data-tab="${id}"`} title="${m[2]}${open ? '' : ' (locked)'}"><span class="ic">${open ? m[1] : G.ic('lock', '#6a5f9e')}</span>${m[3] || m[2]}${n ? `<span class="dotn">${n}</span>` : ''}</button>`;
        }
        set('rail', h);
        set('topMenus', TOP_MENUS.map(id => { const m = MENUS.find(x => x[0] === id); return `<button class="btn sm icon ${menuTab === id ? 'active' : ''}" data-act="openMenu" data-tab="${id}" title="${m[2]}">${m[1]}</button>`; }).join(''));
    }

    /* ======================================================================
       OVER THE FIELD: battle HUD, ability buttons, home screen
       ====================================================================== */
    function hud() {
        const r = G.run(), el = $('hud');
        if (!r || r.over) { el.hidden = true; set('actbar', ''); homeScreen(); return; }
        el.hidden = false;
        $('homeOv').hidden = true;
        const s = S(), f = s.free;
        // coin rates over the real time this run has been played
        const min = Math.max(1 / 6, (r.stats.realT || 0) / 60);
        const cpm = r.coins / min;
        let h = `<div class="money"><div class="cash">$ ${F(r.cash)}</div>
            <div class="rate">🪙 ${F(cpm)}<small>coins/min</small></div>
            <div class="rate">🪙 ${F(cpm * 60)}<small>coins/hour</small></div>
            <div class="tot first">🪙 ${F(s.coins)}</div><div class="tot">💎 ${F(s.gems)}</div></div>`;
        // the game's outlined square buttons, top right
        const fb = (ic, act, data, title, n, cls = '') => `<button class="fbtn ${cls}" data-act="${act}" ${Object.entries(data).map(([k, v]) => `data-${k}="${v}"`).join(' ')} title="${title}">${ic}${n ? `<span class="dotn">${n}</span>` : ''}</button>`;
        h += '<div class="fbtns">' + fb(G.ic('cart'), 'openMenu', { tab: 'store' }, 'Free gems', badge('store'), 'gold') + fb(G.ic('gear'), 'openMenu', { tab: 'settings' }, 'Settings')
            + (G.cardsUnlocked() ? fb(G.ic('card'), 'runTab', { t: 'cards' }, 'Cards') : '') + (s.feat.labs ? fb(G.ic('flask'), 'openMenu', { tab: 'labs' }, 'Labs', badge('labs')) : '')
            + fb(G.ic('star', '#fff'), 'perkBtn', {}, 'Perks', r.offers.length) + (s.feat.modules ? fb(G.ic('module'), 'openMenu', { tab: 'modules' }, 'Modules') : '')
            + '<button class="fbtn wide" data-act="endRound" title="Pause or end the round">END ROUND</button></div>';
        if (f.adStack > 0 && f.adGemsToday < 60 && !G.apOn('gems')) h += `<button class="gembox" data-act="adGems" title="Claim ad gems">💎 ${6 * f.adStack} <span class="play">▶</span></button>`;
        if (f.coinBoost > 0) h += `<div class="boostpill">🪙 ×1.5 coins · ${G.dur(f.coinBoost)}</div>`;
        set('hud', h);
        let a = '';
        if (G.cardOn('demonMode')) a += ab('😈', r.demon > 0 ? Math.ceil(r.demon) + 's' : 'Demon', 'demon', {}, { c: '#ff4d5a', dis: r.demonUsed || r.sprint > 0, title: 'Demon mode (1)' });
        if (G.cardOn('nuke')) a += ab('☢️', 'Nuke', 'nuke', {}, { c: '#ffe14d', dis: r.nukeUsed || r.sprint > 0, title: 'Nuke (2)' });
        if (G.labDone('Missile_Barrage')) a += ab('🚀', 'Barrage', 'barrage', {}, { c: '#ff9640', dis: r.barrageUsed || r.sprint > 0, title: 'Missile barrage (3)' });
        for (const id in r.uw) {
            const u = D.UW_BY[id], t = r.uw[id].t;
            a += ab(u.ic, u.name.split(' ')[0], 'uwToggle', { id }, { c: 'var(--uwc)', off: r.uwOff[id], cd: t > 0 && id !== 'cl' && id !== 'sl' && !r.uwOff[id] ? Math.ceil(t) : 0, title: u.name + (r.uwOff[id] ? ' (off — click to turn on)' : ' (click to turn off)') });
        }
        set('actbar', a);
    }
    // square ability button on the field
    function ab(ic, label, act, data, o = {}) {
        return `<button class="ab ${o.off ? 'off' : ''}" data-act="${act}" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')} ${o.dis ? 'disabled' : ''} title="${esc(o.title || label)}" ${o.c ? `style="--c:${o.c}"` : ''}><span class="o">${o.cd ? '' : ic}</span>${o.cd ? `<span class="cd">${o.cd}s</span>` : ''}<span class="t">${label}</span></button>`;
    }
    // the game's main menu: title over the hexagon, coin bonus and difficulty panels, the battle button, and side icons
    function homeScreen() {
        const s = S(), el = $('homeOv'), f = s.free;
        el.hidden = false;
        const best = s.tierBest[s.tier] || 0;
        let h = '<div class="home-title">THE TOWER</div>';
        const hi = (id) => {
            const m = MENUS.find(x => x[0] === id), open = menuUnlocked(id), n = open ? badge(id) : 0;
            return `<button class="hicon ${open ? '' : 'locked'}" data-act="${open ? 'openMenu' : 'lockedMenu'}" data-tab="${id}" title="${m[2]}"><span class="ic">${m[1]}</span>${m[3] || m[2]}${open ? '' : '<span class="lk">🔒</span>'}${n ? `<span class="dotn">${n}</span>` : ''}</button>`;
        };
        const gem = f.adStack > 0 && f.adGemsToday < 60 && !G.apOn('gems') ? `<button class="gembox inl" data-act="adGems" title="Claim ad gems">💎 ${6 * f.adStack} <span class="play">▶</span></button>` : '';
        h += `<div class="hcol l">${gem}${['tournament', 'events', 'guild', 'bots', 'relics', 'vault'].map(hi).join('')}</div>`;
        const sq = (id) => { const m = MENUS.find(x => x[0] === id), n = badge(id); return `<button class="hsq" data-act="openMenu" data-tab="${id}" title="${m[2]}">${G.icFor(m[1], '#fff')}${n ? `<span class="dotn">${n}</span>` : ''}</button>`; };
        let right = '';
        if (menuUnlocked('missions')) { const b = s.daily.board, n = badge('missions'); right += `<button class="hmis" data-act="openMenu" data-tab="missions">MISSIONS<br>${b.filter(m => m.p >= m.goal).length}/${b.length}${n ? `<span class="dotn">${n}</span>` : ''}</button>`; }
        right += ['settings', 'stats', 'milestones', 'autopilot'].map(sq).join('');
        h += `<div class="hcol r">${right}</div>`;
        h += `<div class="home-mid"><div class="hpanel"><h3>Total Coin Bonus</h3><div class="big">🪙 ×${G.stats(null).coinMult.toFixed(2)}</div></div>
            <div class="hpanel"><h3>Difficulty</h3><div class="tierrow"><button data-act="tier" data-d="-1" ${s.tier <= 1 ? 'disabled' : ''}>❮</button><span>Tier ${s.tier}</span><button data-act="tier" data-d="1" ${s.tier >= s.maxTier ? 'disabled' : ''}>❯</button></div>
            <div>Highest Wave: ${F(best)}</div><div>🪙 ×${D.tierCoin(s.tier)}</div>${s.tier >= 14 ? '<div class="muted-s">Battle conditions active</div>' : ''}</div>`;
        if (s.run) h += `<button class="battlebtn" data-act="resumeRun">CONTINUE</button><div class="home-sub"><span class="muted-s">${s.run.tour ? 'Tournament' : 'Tier ' + s.run.tier} run saved at wave ${F(s.run.wave)}</span>${btn('Abandon', 'abandonRun', {}, 'danger')}</div>`;
        else h += '<button class="battlebtn" data-act="battle">BATTLE</button>';
        if (s.feat.dissonance) h += `<div class="home-sub"><span class="muted-s">🎭 Dissonant run:</span>${['attack', 'defense', 'utility', 'uw'].map(c => btn(c === 'uw' ? 'UW' : c[0].toUpperCase() + c.slice(1), 'dissRun', { c }, '', !!s.run)).join('')}</div>`;
        h += '</div>';
        set('homeOv', h);
    }

    /* ======================================================================
       RIGHT PANEL
       ====================================================================== */
    UI.renderSide = () => {
        const r = G.run();
        const p = r && !r.over ? runPanel(r) : homePanel();
        set('sideHead', p.head);
        set('side', p.body);
        set('sideFoot', p.foot);
        if (r && !r.over) patchRun(r);
    };

    function homePanel() {
        const s = S(), f = s.free;
        let h = '';
        if (s.feat.labs) {
            h += '<div class="sp-title">Labs</div>';
            for (let i = 0; i < s.labs.slots; i++) {
                const a = s.labs.active.find(x => x.slot === i);
                if (!a) { h += `<div class="labrow idle"><b>Lab ${i + 1} · idle</b>${btn('Research', 'openMenu', { tab: 'labs' })}</div>`; continue; }
                const lab = D.LAB_BY[a.id] || G.masteryLab(a.id);
                h += `<div class="labrow"><b>${s.labs.auto[a.id] ? '🔁 ' : ''}${esc(lab.name)} → ${G.labLv(a.id) + 1}</b><span class="muted-s">${timeLeft(G.labRemainingSec(a) * 1000)}</span>${prog(a.done / a.work, 'lab')}</div>`;
            }
        }
        if (menuUnlocked('missions')) {
            G.ensureDaily();
            h += `<div class="sp-title" style="background:#2fa84f;margin-top:10px">Missions ${s.daily.board.filter(m => m.p >= m.goal).length}/${s.daily.board.length}</div>`;
            for (const m of s.daily.board) h += `<div class="labrow"><b>${esc(m.text)}</b>${m.p >= m.goal ? btn('Claim', 'claimDaily', { id: m.id }, 'primary') : `<span class="muted-s">${F(m.p)}/${F(m.goal)}</span>`}${prog(m.p / m.goal)}</div>`;
        }
        if ((f.adStack > 0 && f.adGemsToday < 60) || G.dailyGemsReady()) h += `<div class="row-s" style="margin-top:8px">${G.dailyGemsReady() ? btn('💎 Claim 20 daily gems', 'dailyGems', {}, 'primary') : ''}${f.adStack > 0 ? btn(`📺 Claim ${6 * f.adStack} gems`, 'adGems', {}, 'primary') : ''}</div>`;
        if (f.coinBoost > 0) h += `<p class="note">🪙 Coin boost ×1.5 banked: ${G.dur(f.coinBoost)} (runs down while you battle)</p>`;
        if (!h) h = '<p class="note">Play battles to earn coins, then spend them in the Workshop. Labs, cards and more unlock as you reach new waves.</p>';
        return { head: '', body: h, foot: '' };
    }

    // [id, icon, name, short name]
    const MENUS = [['workshop', '🔧', 'Workshop'], ['labs', '🧪', 'Labs'], ['cards', '🃏', 'Cards'], ['uw', '💠', 'Ultimate Weapons', 'Ultimates'], ['modules', '🧩', 'Modules'],
        ['missions', '📋', 'Missions'], ['milestones', '🏁', 'Milestones'], ['tournament', '🏆', 'Tournament', 'Tourney'], ['events', '📅', 'Event'], ['bots', '🤖', 'Bots'],
        ['guild', '🏯', 'Guild'], ['relics', '🏺', 'Relics & Themes', 'Relics'], ['vault', '🗝️', 'Vault'], ['store', '🛒', 'Free Gems', 'Store'], ['autopilot', '🛸', 'Autopilot'],
        ['stats', '📊', 'Stats'], ['settings', '⚙️', 'Settings']];
    const UNLOCK_HINT = { labs: 'Reach the milestone that unlocks the Labs.', cards: 'Play two runs on Tier 1.', uw: 'Unlocks with tournaments (power stones).', modules: 'Reach the milestone that unlocks Modules.',
        missions: 'Daily missions unlock after a few runs.', tournament: 'Reach the milestone that unlocks Tournaments.', events: 'Reach Tier 1 wave 70.', bots: 'Unlocks with events.', guild: 'Reach the milestone that unlocks Guilds.',
        vault: 'Earn keys in Legend tournaments.' };
    function menuUnlocked(id) {
        const s = S();
        switch (id) {
            case 'labs': return s.feat.labs;
            case 'cards': return G.cardsUnlocked();
            case 'uw': return s.feat.tournaments || s.stones > 0 || G.uwOwnedCount() > 0;
            case 'modules': return s.feat.modules;
            case 'missions': return G.dailyUnlocked();
            case 'tournament': return s.feat.tournaments;
            case 'events': case 'bots': return s.feat.events;
            case 'guild': return s.feat.guilds;
            case 'vault': return s.tour.league >= 5 || s.keys > 0 || Object.keys(s.vault).length > 0;
            default: return true;
        }
    }
    function badge(id) {
        const s = S();
        switch (id) {
            case 'milestones': return G.msClaimable();
            case 'missions': return s.daily.board.filter(m => m.p >= m.goal).length + (G.boxReady(s.daily.boxes) ? 1 : 0);
            case 'labs': return s.feat.labs ? Math.max(0, s.labs.slots - s.labs.active.length) : 0;
            case 'store': return (G.dailyGemsReady() ? 1 : 0) + (s.free.adStack > 0 ? 1 : 0);
            case 'events': { if (!s.event) return 0; let n = 0; for (const m of G.eventMissions()) for (let i = 0; i < 3; i++) if (!s.event.tiers[m.text + i] && G.evProgress(m) >= m.goals[i] && (i === 0 || s.event.tiers[m.text + (i - 1)])) { n++; break; } return n; }
            case 'guild': { const g = s.guild; if (!g) return 0; return G.GUILD_CHESTS.filter((c, i) => !g.chests[i] && G.guildTotal() >= c[0]).length; }
            case 'tournament': return s.tour.cur && G.tourOpen() && s.tour.cur.tickets > 0 ? s.tour.cur.tickets : 0;
            default: return 0;
        }
    }

    /* ---------- in-battle panel: status boxes, the coloured category banner, upgrade tiles, category tabs ---------- */
    // [id, icon, label, class, colour]
    const CAT_TABS = [['attack', 'sword', 'Attack', 'atk', '#33b5f0'], ['defense', 'shield', 'Defense', 'def', '#ee4c64'], ['utility', 'star', 'Utility', 'util', '#f2c418'], ['uw', 'uw', 'Ultimate', 'uwc', '#2fcf62']];
    const SUB_TABS = [['perks', '⭐ Perks'], ['cards', '🃏 Cards'], ['info', '📈 Wave info']];
    const CAT_CLS = { attack: 'atk', defense: 'def', utility: 'util' };
    function catTabs(list, curId, act, extra = () => 0) {
        return `<div class="cattabs" style="--n:${list.length}">${list.map(([id, ic, n, cls, col]) => { const b = extra(id); return `<button class="cattab ${cls} ${curId === id ? 'on' : ''}" data-act="${act}" data-t="${id}" data-c="${id}"><span class="ic">${G.ic(ic, col)}</span>${n}${b ? `<span class="dotn">${b}</span>` : ''}</button>`; }).join('')}</div>`;
    }
    function multOptions() {
        const L = G.labLv('Buy_Multiplier');
        return [1, 5, 10, 'max', 100].filter((m, i) => i === 0 || i <= L);
    }
    function statusPanels(r) {
        const t = r.tour ? D.LEAGUES[r.league].tier : r.tier;
        const f = r.hp / r.maxHp;
        let left = `<div class="stp"><div class="stp-row"><span>🗡️ ${F(r.s.damage)}</span><span>${G.ic('hp')} ${F(r.s.regen)}/s</span><span>🪙 ×${r.s.coinMult.toFixed(2)}</span></div>
            <div class="hpbar ${f > 1 ? 'over' : ''}"><i style="width:${(Math.min(1, Math.max(0, f)) * 100).toFixed(1)}%"></i><span>${F(Math.max(0, r.hp))} / ${F(r.maxHp)}</span></div>`;
        if (r.wall) left += `<div class="hpbar thin" title="Wall ${r.wall.hp > 0 ? F(r.wall.hp) + ' / ' + F(r.wall.max) : 'rebuilding'}"><i style="width:${(r.wall.max ? Math.min(1, r.wall.hp / r.wall.max) * 100 : 0).toFixed(1)}%"></i></div>`;
        left += '</div>';
        const L = r.tour ? D.LEAGUES[r.league] : null;
        const be = D.bossEvery(r.tier, r.tour ? r.league : null), toBoss = be - (r.wave % be);
        const right = `<div class="stp"><div class="stp-wave"><div><small>${L ? L.id + ' league' : 'Tier ' + r.tier}</small><b>Wave ${F(r.wave)}</b></div>
            <div class="stp-en">${F(D.enemyDmg(t, r.atkWave, r.tour))} 🗡️<br>${F(D.enemyHp(t, r.hpWave, r.tour))} ${G.ic('hp')}</div></div>
            <div class="wbar"><i style="width:${(B.waveProgress() * 100).toFixed(1)}%"></i></div><div class="boss">${toBoss === be ? 'Boss wave!' : 'Boss in ' + toBoss}${r.shield ? ' · 🔰 ' + r.shield : ''}${r.diss ? ' · 🎭 ' + r.diss : ''}</div></div>`;
        return `<div class="status">${left}${right}</div>`;
    }
    function runPanel(r) {
        const s = S();
        const tab = CAT_TABS.find(x => x[0] === runTab), sub = SUB_TABS.find(x => x[0] === runTab);
        let head = statusPanels(r);
        if (CAT_CLS[runTab]) {
            const m = s.settings.buyMult;
            head += `<div class="banner ${tab[3]}"><b>${tab[2]} upgrades</b>${G.apOwn('buy') ? `<button class="mb ${G.apOn('buy') ? 'on' : ''}" data-act="apToggle" data-id="buy" title="Auto-buyer">AUTO</button>` : ''}<button class="mb" data-act="multNext" title="Buy multiplier: click to change">${m === 'max' ? 'Max' : 'x' + m}</button></div>`;
        } else head += `<div class="banner" style="--c:${tab ? tab[4] : '#3a63d8'}"><b>${tab ? 'Ultimate weapons' : sub[1].replace(/^\S+ /, '')}</b></div>`;
        let h = '';
        if (CAT_CLS[runTab]) {
            if (B.catDisabled(runTab)) h += '<p class="note">This category is locked in a dissonant run.</p>';
            h += '<div class="ugrid">';
            for (const u of D.UPG.filter(x => x.cat === runTab)) {
                if (!G.unlocked(u)) continue;
                h += `<button class="ut" data-up="${u.id}" data-act="runBuy" data-id="${u.id}"><span class="un">${u.name}<span class="lv" data-f="lv"></span></span><span class="ub"><span class="uv" data-f="v"></span><span class="uc" data-f="c"></span><span class="ux" data-f="x"></span></span></button>`;
            }
            h += '</div>';
            const locked = D.UPG.filter(x => x.cat === runTab && !G.unlocked(x)).length;
            if (locked) h += `<p class="note">${locked} more upgrades unlock in the Workshop.</p>`;
        } else if (runTab === 'uw') {
            const ids = Object.keys(r.uw);
            if (!ids.length) h += '<p class="note">No ultimate weapons yet. Unlock them with power stones (from tournaments).</p>';
            for (const id of ids) {
                const u = D.UW_BY[id];
                const tmp = !G.uwLv(id);
                const stats = u.st.map((n, i) => `${n}: <b>${UI.show(u.f[i], G.uwStat(id, i, r))}</b>`).join(' · ');
                const cd = r.uw[id].t;
                h += `<div class="up"><b>${u.ic} ${u.name}${tmp ? ' <span class="pill">perk</span>' : ''}</b>${btn(r.uwOff[id] ? 'Off' : 'On', 'uwToggle', { id }, r.uwOff[id] ? '' : 'active')}<small>${stats}${cd > 0 && id !== 'cl' && id !== 'sl' ? ` · next in ${Math.ceil(cd)}s` : ''}</small></div>`;
            }
            if (r.dwPool > 0) h += `<p class="note">🌊 Death wave pool: ${F(r.dwPool)}</p>`;
        } else if (runTab === 'perks') {
            if (r.tour) h += '<p class="note">Perks are not available in tournaments.</p>';
            else if (!G.labDone('Unlock_Perks')) h += '<p class="note">Research <b>Unlock Perks</b> in the Labs (milestone Tier 2 wave 150) to earn perks every 200 waves.</p>';
            else {
                if (r.offers.length) h += btn(`⭐ Choose perk (${r.offers.length})`, 'showPerk', {}, 'primary');
                h += `<p class="muted-s">Next perk at wave ${F(r.perkNext)}</p>`;
                h += r.perkList.map(p => `<div class="up"><b>${esc(p)}</b></div>`).join('') || '<p class="muted-s">No perks yet.</p>';
            }
        } else if (runTab === 'info') {
            h += waveInfo(r);
        } else if (runTab === 'cards') {
            h += `<p class="muted-s">Equipped ${s.cards.eq.length}/${G.cardSlots()} · 🔒 cards can't be swapped mid-run.</p>`;
            h += cardGrid(true);
        }
        const foot = catTabs(CAT_TABS, runTab, 'runTab') + `<div class="subtabs">${SUB_TABS.map(([id, n]) => btn(n + (id === 'perks' && r.offers.length ? '<span class="dotn">!</span>' : ''), 'runTab', { t: id }, runTab === id ? 'active' : '')).join('')}</div>`;
        return { head, body: h, foot };
    }
    // like the game's wave info menu: what the current wave throws at you, and how the run is going
    function waveInfo(r) {
        const t = r.tour ? D.LEAGUES[r.league].tier : r.tier;
        const hp = D.enemyHp(t, r.hpWave, r.tour), dmg = D.enemyDmg(t, r.atkWave, r.tour);
        const mix = D.spawnMix(t, r.wave), el = D.eliteChance(t, r.wave);
        const basic = Math.max(0, 1 - mix.fast - mix.tank - mix.ranged);
        const min = Math.max(1 / 60, r.t / 60);
        let h = `<div class="sum"><div><small>Enemy health</small><b>${F(hp)}</b></div><div><small>Enemy damage</small><b>${F(dmg)}</b></div>
            <div><small>Health level</small><b>${F(r.hpWave)}</b></div><div><small>Attack level</small><b>${F(r.atkWave)}</b></div></div>`;
        h += '<table class="t"><tr><th>Enemy</th><th>Spawn</th><th>Health</th></tr>';
        const row = (type, share) => `<tr><td>${D.ENEMY[type].n}</td><td>${share}</td><td>${F(hp * D.ENEMY[type].hp)}</td></tr>`;
        h += row('basic', G.pct(basic)) + row('fast', G.pct(mix.fast)) + row('tank', G.pct(mix.tank)) + row('ranged', G.pct(mix.ranged));
        if (r.tier >= 2 || r.tour) h += row('protector', `1 per ${D.protectorEvery(t)} waves`);
        h += row('boss', `every ${D.bossEvery(r.tier, r.tour ? r.league : null)} waves`);
        h += `<tr><td>Elites</td><td>${G.pct(Math.min(1, el.one), 1)}${el.two ? ' + ' + G.pct(el.two, 1) : ''}</td><td>${F(hp * 2)}</td></tr></table>`;
        h += `<div class="sum"><div><small>Coins / min</small><b>${F(r.coins / min)}</b></div><div><small>Cash / min</small><b>$${F(r.stats.cash / min)}</b></div><div><small>Cells / hour</small><b>${F(r.cells / min * 60)}</b></div>
            <div><small>Kills</small><b>${F(r.stats.kills)}</b></div><div><small>Damage dealt</small><b>${F(r.stats.damage)}</b></div><div><small>Best hit</small><b>${F(r.stats.bestHit)}</b></div>
            <div><small>Damage taken</small><b>${F(r.dmgTaken)}</b></div><div><small>Packages</small><b>${r.stats.pkg}</b></div><div><small>Waves skipped</small><b>${r.stats.skips}</b></div></div>`;
        if (G.labDone('More_Round_Stats')) h += `<p class="muted-s">Kills by source: ${Object.entries(r.stats.killsBy).map(([k, v]) => `${k} ${F(v)}`).join(' · ')}</p>`;
        else h += '<p class="note">The More Round Stats lab (milestone Tier 1 wave 250) adds a breakdown of kills by source.</p>';
        h += '<p class="note">Wave info stats use game time; the coins/min on the field uses real time.</p>';
        return h;
    }
    function patchRun(r) {
        if (!CAT_CLS[runTab]) return;
        const mult = S().settings.buyMult;
        const put = (el, html) => { if (el._h !== html) { el._h = html; el.innerHTML = html; } };
        for (const el of $('side').querySelectorAll('[data-up]')) {
            const id = el.dataset.up, u = D.UPG_BY[id];
            const L = G.totalLv(id, r), left = B.runMax(id);
            const n = mult === 'max' ? Math.max(1, maxAffordable(r, id)) : Math.min(+mult, Math.max(1, left));
            const cost = B.runCost(id, n);
            // show the boosted stat now and after buying, scaling the base change by the same bonuses
            const now = r.s[id] !== undefined ? r.s[id] : G.upgVal(u, L), b0 = G.upgVal(u, L), b1 = G.upgVal(u, L + n);
            const next = MULT_STATS.has(id) && b0 > 0 ? now * b1 / b0 : now + (b1 - b0);
            put(el.querySelector('[data-f="lv"]'), `Lv ${L}`);
            put(el.querySelector('[data-f="v"]'), esc(UI.show(u.show, now)));
            put(el.querySelector('[data-f="c"]'), left ? `$ ${F(cost)}` : 'Max');
            put(el.querySelector('[data-f="x"]'), left && n > 1 ? 'x' + n : '');
            const tip = left ? `${u.name}: ${UI.show(u.show, now)} → ${UI.show(u.show, next)}` : `${u.name}: maxed`;
            if (el.title !== tip) el.title = tip;
            el.classList.toggle('max', !left);
            const dis = !left || r.cash < cost || B.catDisabled(u.cat);
            if (el.disabled !== dis) el.disabled = dis;
        }
    }
    const MULT_STATS = new Set(['damage', 'health', 'regen', 'defAbs', 'attackSpeed', 'critFactor', 'scMult', 'cashBonus', 'coinKill', 'cashWave', 'coinWave', 'range', 'dpm', 'interest']);
    function maxAffordable(r, id) {
        let n = 0;
        const left = B.runMax(id);
        while (n < left && n < 500) { const next = B.runCost(id, n + 1); if (next > r.cash) break; n++; }
        return n;
    }

    /* ======================================================================
       MENU PAGES (cover the field and the side panel; the rail stays)
       ====================================================================== */
    UI.openMenu = (tab) => {
        if (menuTab !== tab) lastMenu = '';
        menuTab = tab;
        $('menuOv').hidden = false;
        if (tab === 'milestones') msTier = Math.min(S().maxTier, Math.max(1, S().tier));
        $('menuBody').scrollTop = 0;
        UI.renderMenu(true);
    };
    UI.closeMenu = () => { menuTab = null; $('menuOv').hidden = true; lastMenu = ''; rail(); };
    UI.menuOpen = () => !!menuTab;
    UI.renderMenu = (force) => {
        if (!menuTab) return;
        const s = S();
        const m = MENUS.find(x => x[0] === menuTab);
        set('menuTitle', m[2]);
        set('menuCur', cur('coins', s.coins) + cur('gems', s.gems) + (s.feat.tournaments || s.stones ? cur('stones', s.stones) : '') + (s.feat.events ? cur('medals', s.medals) : ''));
        const fn = TABS[menuTab];
        const html = fn ? fn() : '';
        if (force || html !== lastMenu) {
            const body = $('menuBody'), st = body.scrollTop;
            lastMenu = html; body.innerHTML = G.iconize(html); body.scrollTop = st;
        }
    };

    const TABS = {};

    /* ---------- workshop: the same tiles as in battle, with coin prices; the green tab is the ultimate weapons ---------- */
    const WS_TABS = [['attack', 'sword', 'Attack', 'atk', '#33b5f0'], ['defense', 'shield', 'Defense', 'def', '#ee4c64'], ['utility', 'star', 'Utility', 'util', '#f2c418']];
    const wsTabs = (curId) => {
        const tabs = WS_TABS.concat(G.labDone('Workshop_Enhancement') ? [['enh', 'sparkle', 'Enhance', 'uwc', '#c49bff']] : []).concat(menuUnlocked('uw') ? [['uw', 'uw', 'Ultimate', 'uwc', '#2fcf62']] : []);
        return `<div style="max-width:760px">${catTabs(tabs, curId, 'wsCat')}</div>`;
    };
    TABS.workshop = () => {
        const s = S(), r = G.run();
        let h = wsTabs(wsCat) + `<div class="row between" style="margin:10px 0 0"><span class="muted-s">Permanent upgrades bought with coins. They set your starting level in every battle.</span><div class="seg">${[1, 10, 100, 'max'].map(m => btn(m === 'max' ? 'Max' : 'x' + m, 'wsMult', { m }, String(wsMult) === String(m) ? 'active' : '')).join('')}</div></div>`;
        if (r) h += '<p class="note">The Workshop can\'t be changed during a run. Buy battle upgrades with cash instead.</p>';
        if (wsCat === 'enh') return h + enhTab();
        const disc = G.labV({ attack: 'Workshop_Attack_Discount', defense: 'Workshop_Defense_Discount', utility: 'Workshop_Utility_Discount' }[wsCat]);
        if (disc) h += `<p class="muted-s">Discount lab: −${G.pct(disc)}.</p>`;
        h += '<div class="ugrid">';
        for (const g of D.GROUP_ORDER[wsCat]) {
            const grp = D.GROUPS[g];
            if (!G.groupOn(g)) {
                const names = D.UPG.filter(u => u.grp === g).map(u => u.name).join(', ');
                if (G.groupUnlockable(g)) h += `<button class="ut wide" data-act="unlockGroup" data-g="${g}" ${r || s.coins < grp.cost ? 'disabled' : ''}><span class="un">🔓 Unlock ${grp.name}<span class="lv">${names}</span></span><span class="ub"><span class="uv">Unlock</span><span class="uc">${F(grp.cost)} 🪙</span></span></button>`;
                else h += `<button class="ut wide lock" disabled><span class="un">🔒 ${grp.name}<span class="lv">Unlock the section above first</span></span><span class="ub"><span class="uv">Locked</span><span class="uc">${F(grp.cost)} 🪙</span></span></button>`;
                continue;
            }
            for (const u of D.UPG.filter(x => x.grp === g)) {
                const L = G.wsLv(u.id);
                const max = L >= u.max;
                let n = wsMult === 'max' ? 0 : Math.min(+wsMult, u.max - L), cost = 0;
                if (wsMult === 'max') { let c = 0; while (L + n < u.max && n < 1000) { const x = G.wsCost(u, L + n + 1); if (c + x > s.coins) break; c += x; n++; } cost = c; n = Math.max(1, n); if (cost === 0) cost = G.wsCost(u, L + 1); }
                else for (let i = 1; i <= n; i++) cost += G.wsCost(u, L + i);
                h += `<button class="ut ${max ? 'max' : ''}" data-act="wsBuy" data-id="${u.id}" data-n="${n}" title="${esc(u.info)}${max ? '' : ` · next ${esc(UI.show(u.show, G.upgVal(u, L + n)))}`}" ${max || r || s.coins < cost ? 'disabled' : ''}><span class="un">${u.name}<span class="lv">Lv ${L}/${u.max}</span></span><span class="ub"><span class="uv">${UI.show(u.show, G.upgVal(u, L))}</span><span class="uc">${max ? 'Max' : F(cost)} 🪙</span>${!max && n > 1 ? `<span class="ux">x${n}</span>` : ''}</span></button>`;
            }
        }
        h += '</div>';
        if (G.labDone('Workshop_Respec')) h += `<h4 class="sec">Respec</h4><div class="up"><b>♻️ Workshop respec</b>${btn('💎 150', 'respec', {}, 'danger', !!r)}<small>Refunds every coin spent on workshop levels (full price).</small></div>`;
        return h;
    };
    function enhTab() {
        const s = S();
        let h = '<p class="muted-s">Enhancements multiply workshop stats. Spending coins on a category unlocks more of them.</p>';
        for (const cat of D.CATS) {
            h += `<h4 class="sec">${cat} · spent 🪙 ${F(s.enhSpent[cat])}</h4>`;
            for (const e of D.ENH.filter(x => x.cat === cat)) {
                const L = s.enh[e.id] || 0, ok = G.enhUnlocked(e);
                const c = G.enhCost(e);
                h += `<div class="up ${ok ? '' : 'dim'}"><b>${e.name} <span class="muted-s">Lv ${L}/${e.max}</span></b>${ok ? btn(L >= e.max ? 'MAX' : '🪙 ' + F(c), 'enhBuy', { id: e.id }, '', L >= e.max || s.coins < c || !!G.run()) : `<span class="muted-s">spend 🪙 ${F(e.need)}</span>`}<small>×${(1 + L * e.step).toFixed(2)}</small></div>`;
            }
        }
        return h;
    }

    /* ---------- labs ---------- */
    TABS.labs = () => {
        const s = S();
        let h = `<div class="row-s"><span class="pill">Lab speed ×${G.labSpeed(false).toFixed(2)}</span><span class="pill">Coin discount ${G.pct(G.labV('Labs_Coin_Discount'))}</span>${s.labs.slots < 5 ? btn(`➕ Lab slot ${s.labs.slots + 1} · 💎 ${F(D.LAB_SLOT_GEMS[s.labs.slots])}`, 'labSlot') : ''}</div>`;
        // overclock
        const oc = s.labs.overclock || 0, nx = D.OVERCLOCK[oc + 1];
        h += `<div class="tile hl" style="margin:8px 0"><div class="h"><span class="ic">⚙️</span><b>Lab Overclock ×${D.OVERCLOCK[oc].m}</b>${nx ? btn(`×${nx.m} · 🪙 ${F(nx.c)}`, 'overclock', {}, 'primary', s.coins < nx.c) : '<span class="pill gold">MAX</span>'}</div><small>Multiplies every lab's speed. Not part of the original game; added so research doesn't have to take months.</small></div>`;
        // slots
        h += '<h4 class="sec">Research</h4><div class="grid">';
        for (let i = 0; i < s.labs.slots; i++) {
            const a = s.labs.active.find(x => x.slot === i);
            const boost = G.slotBoost(i);
            if (!a) { h += `<div class="tile dim"><b>Lab ${i + 1}</b><small>Idle — pick a research below.</small></div>`; continue; }
            const lab = D.LAB_BY[a.id] || G.masteryLab(a.id);
            h += `<div class="tile hl"><div class="h"><b>${esc(lab.name)} → Lv ${G.labLv(a.id) + 1}</b><span class="muted-s">${timeLeft(G.labRemainingSec(a) * 1000)}</span></div>${prog(a.done / a.work, 'lab')}
                <div class="row-s">${btn('💎 Rush ' + F(G.rushCost(a)), 'labRush', { id: a.id }, '', s.gems < G.rushCost(a))}${btn('Cancel', 'labCancel', { id: a.id })}${btn(s.labs.auto[a.id] ? '🔁 Auto: on' : '🔁 Auto: off', 'labAuto', { id: a.id }, s.labs.auto[a.id] ? 'active' : '')}</div>
                <small>${boost > 1 ? `⚡ ×${boost} boost · ${timeLeft(s.labs.boosts[i].until - Date.now())}` : ''}</small>
                <div class="row-s">${D.CELL_BOOSTS.slice(0, 4).map(([m, per], k) => btn(`🧬×${m} 1h (${F(per)})`, 'cellBoost', { slot: i, k, h: 1 }, '', s.cells < per)).join('')}</div></div>`;
        }
        h += '</div>';
        h += `<div class="row between" style="margin-top:10px"><div class="tabs2">${D.LAB_CATS.map(([id, n]) => btn(n, 'labCat', { c: id }, labCat === id ? 'active' : '')).join('')}</div>${btn(showLockedLabs ? 'Hide locked' : 'Show locked', 'labLocked')}</div>`;
        let labs = D.LABS.filter(l => l.cat === labCat);
        if (labCat === 'card') for (const id in s.cards.mastery) labs = labs.concat([G.masteryLab('M_' + id)]);
        const free = G.freeSlot() >= 0;
        for (const lab of labs) {
            const avail = G.labAvailable(lab) || lab.id.startsWith('M_');
            if (!avail && !showLockedLabs) continue;
            const L = G.labLv(lab.id), max = L >= lab.max, busy = G.labBusy(lab.id);
            if (!avail) { h += `<div class="up dim"><b>🔒 ${esc(lab.name)}</b><span></span><small>${lab.unlock.startsWith('lab:') ? 'Needs ' + lab.unlock.slice(4).replace(/_/g, ' ') : 'Milestone ' + lab.unlock.replace('T', 'Tier ').replace('W', ' wave ')}</small></div>`; continue; }
            const cost = max ? 0 : G.labCost(lab, L), time = max ? 0 : G.labTime(lab, L) / G.labSpeed(lab.id === 'Lab_Speed');
            const cur = L ? lab.rows[L - 1].v : '—', next = max ? '' : lab.rows[L].v;
            h += `<div class="up ${max ? 'max' : ''}" title="${esc(lab.desc || '')}"><b>${esc(lab.name)} <span class="muted-s">Lv ${L}/${lab.max}</span></b>${max ? '<span class="pill gold">MAX</span>' : busy ? '<span class="pill">researching</span>' : btn(`🪙 ${F(cost)}`, 'labStart', { id: lab.id }, '', !free || s.coins < cost)}<small>${esc(String(cur))}${max ? '' : ' → ' + esc(String(next)) + ' · ⏱ ' + G.dur(time)}</small></div>`;
        }
        return h;
    };

    /* ---------- cards: the game's card faces (name strip, white art on a coloured panel, stars; magenta stars when maxed) ---------- */
    const CARD_COL = ['', 'c1', 'c2'];
    function cardGrid(inRun) {
        const s = S();
        let h = '<div class="cgrid">';
        D.CARDS.forEach((c, i) => {
            const lv = G.cardLevel(c.id), n = s.cards.have[c.id] || 0, col = CARD_COL[i % 3];
            const stars = (k) => `<div class="gs">${'★'.repeat(k)}<i>${'★'.repeat(7 - k)}</i></div>`;
            if (!G.cardInPool(c) && !n) { h += `<div class="gcard unknown miss"><div class="gn">???</div><div class="ga">?</div>${stars(0)}<div class="gf">Milestone ${c.ms.replace('T', 'T').replace('W', ' W')}</div></div>`; return; }
            if (!lv) { h += `<div class="gcard miss ${col}" title="${esc(c.desc)}"><div class="gn">${c.name}</div><div class="ga">${G.icFor(c.ic, '#ffffff')}</div>${stars(0)}<div class="gf">not found yet</div></div>`; return; }
            const eq = s.cards.eq.includes(c.id), max = lv >= 7;
            const nextAt = D.CARD_LEVEL_COPIES[lv + 1];
            h += `<button class="gcard ${col} ${max ? 'lv7' : ''} ${eq ? 'eq' : ''}" data-act="toggleCard" data-id="${c.id}" title="${esc(c.desc)}${eq ? ' (equipped)' : ''}">
                <div class="gn">${c.name}</div><div class="ga">${G.icFor(c.ic, '#ffffff')}</div>${stars(lv)}
                <div class="gf">${max ? '<b>Max</b> · ' : ''}${UI.show(c.f, c.vals[lv - 1])}${s.cards.mastery[c.id] !== undefined ? ' · 🌟' : ''}${!inRun && nextAt ? ` · ${n}/${nextAt}` : ''}</div>
                ${eq ? '<span class="eqk">✅</span>' : ''}${c.locked ? '<span class="lk">🔒</span>' : ''}</button>`;
        });
        return h + '</div>';
    }
    TABS.cards = () => {
        const s = S();
        if (!s.cards.opened) { s.cards.opened = true; G.add('gems', 40, 'cards'); G.toast('🃏 Cards unlocked: +40 gems to get you started', 'gold'); }
        let h = `<div class="row-s">${btn('Buy 1 card · 20 💎', 'buyCards', { n: 1 }, 'primary', s.gems < 20)}${btn('Buy 10 · 200 💎', 'buyCards', { n: 10 }, 'primary', s.gems < 200)}
            <span class="pill">Common 80% · Rare 17% · Epic 3%</span><span class="pill">Slots ${s.cards.eq.length}/${G.cardSlots()}</span>${s.cards.slots < 22 ? btn(`➕ Slot · ${F(D.CARD_SLOT_GEMS[s.cards.slots + 1])} 💎`, 'cardSlot', {}, '', s.gems < D.CARD_SLOT_GEMS[s.cards.slots + 1]) : ''}</div>`;
        if (lastPulls.length) h += `<div class="note">You got: ${lastPulls.map(c => `${c.ic} ${c.name}`).join(', ')}</div>`;
        if (G.labDone('Presets')) h += `<div class="row-s" style="margin:6px 0"><span class="muted-s">Presets:</span>${[0, 1, 2, 3, 4].map(i => btn('P' + (i + 1), 'preset', { i }, s.cards.preset === i ? 'active' : '')).join('')}</div>`;
        h += '<p class="muted-s">Click a card to equip or unequip it. ✅ = equipped. 🔒 cards can\'t be changed during a run.</p>';
        h += cardGrid(false);
        if (s.feat.mastery) {
            h += `<h4 class="sec">Card Mastery ${G.masteryUnlocked() ? '' : '· needs 30 cards at level 7'}</h4><div class="grid">`;
            for (const c of D.CARDS) {
                const m = D.MASTERY[c.id];
                if (!m) continue;
                const have = s.cards.mastery[c.id];
                h += `<div class="tile ${have !== undefined ? 'gold' : ''}"><div class="h"><span class="ic">${c.ic}</span><b>${m.name}</b>${have !== undefined ? `<span class="pill gold">Lv ${have}</span>` : btn(F(m.stones) + ' 💠', 'mastery', { id: c.id }, '', !G.masteryUnlocked() || G.cardLevel(c.id) < 7 || s.stones < m.stones)}</div><small>${esc(m.desc)} · ${m.vals[0]} → ${m.vals[9]}</small></div>`;
            }
            h += '</div>';
        }
        return h;
    };

    /* ---------- ultimate weapons: a row per weapon with its art and three stat boxes, like the game ---------- */
    TABS.uw = () => {
        const s = S(), r = G.run();
        let h = wsTabs('uw') + '<p class="muted-s">Ultimate weapons are unlocked and upgraded with 💠 power stones, mostly from tournaments. Click a stat box to upgrade it.</p>';
        const n = G.uwOwnedCount();
        if (n < 9) {
            const cost = D.UW_COST[n];
            const offer = G.uwOffer();
            h += `<div class="tile hl" style="margin-bottom:10px"><div class="h"><b>Unlock ultimate weapon #${n + 1} · ${F(cost)} 💠</b>${btn(s.uw.freeReroll ? '🎲 Free reroll' : '🎲 Reroll used', 'uwReroll', {}, '', !s.uw.freeReroll || !!r, 'One free reroll for each offer. Unlocking a weapon rolls three new options.')}</div><div class="uwoffer">`;
            for (const id of offer) { const u = D.UW_BY[id]; h += `<div class="tile"><span class="big">${G.icFor(u.ic, '#ffffff')}</span><b>${u.name}</b><small>${u.desc}</small>${btn(`Unlock · ${F(cost)} 💠`, 'uwBuy', { id }, 'primary', s.stones < cost || !!r)}</div>`; }
            h += '</div></div>';
        }
        for (const u of D.UWS) {
            const own = s.uw.own[u.id];
            const art = `<div class="uwa">${G.icFor(u.ic, '#ffffff')}</div>`;
            if (!own) { h += `<div class="uwrow locked"><div class="uwt">🔒 ${u.name}</div><div class="uwb">${art}<div class="muted-s" style="align-self:center">${u.desc}</div></div></div>`; continue; }
            h += `<div class="uwrow" title="${esc(u.desc)}"><div class="uwt">${u.name}</div><div class="uwb">${art}`;
            u.st.forEach((st, i) => {
                const c = G.uwUpCost(u.id, i), col = u.t[i], max = c === null;
                const tip = `${st} · Lv ${own[i]}/${col.length - 1}${max ? '' : ' · next ' + UI.show(u.f[i], col[own[i] + 1].v)}`;
                h += `<button class="uwstat ${max ? 'max' : ''}" data-act="uwUp" data-id="${u.id}" data-i="${i}" title="${esc(tip)}" ${max || s.stones < c || r ? 'disabled' : ''}><small>${st}</small><b>${UI.show(u.f[i], G.uwStat(u.id, i, null))}</b><span class="c">${max ? 'Max' : F(c)} 💠</span></button>`;
            });
            h += '</div></div>';
        }
        if (n >= 9) {
            h += `<h4 class="sec">Ultimate Weapon+</h4><div class="grid">`;
            const bought = Object.keys(s.uw.plus).length;
            for (const u of D.UWS) {
                const p = D.UW_PLUS[u.id], L = s.uw.plus[u.id];
                if (L === undefined) h += `<div class="tile"><b>${u.ic} ${p.name}</b><small>${p.desc(p.vals[0])}</small>${btn(F(D.UWP_COST[bought]) + ' 💠', 'uwPlusBuy', { id: u.id }, '', s.stones < D.UWP_COST[bought])}</div>`;
                else h += `<div class="tile gold"><b>${u.ic} ${p.name} · Lv ${L}</b><small>${p.desc(p.vals[L])}</small>${L + 1 < p.vals.length ? btn(F(p.cost[L + 1] || p.cost[p.cost.length - 1]) + ' 💠', 'uwPlusUp', { id: u.id }) : '<span class="pill gold">Max</span>'}</div>`;
            }
            h += '</div>';
        }
        return h;
    };

    /* ---------- modules ---------- */
    const typeName = (t) => D.MOD_TYPES.find(x => x[0] === t);
    function modLabel(m) {
        const rr = G.modRarity(m);
        return `<b style="color:${rr.col}">${esc(m.name)}</b> <span class="muted-s">${rr.n}${m.stars ? ' ' + '★'.repeat(m.stars) : ''}${m.natural ? ' · unique' : ''}</span>`;
    }
    function subsHtml(m, lv) {
        const n = lv === undefined ? m.subs.length : G.modActiveSubs(m, lv);
        return m.subs.map((s, i) => {
            const def = D.SUBS[m.type].find(d => d[0] === s.k);
            const v = def[2][s.r];
            const shown = def[3] === '%' ? v + '%' : def[3] === 's' ? v + 's' : def[3] === 'm' ? '+' + v + 'm' : def[3] === '×' ? '×' + v : def[3] === '°' ? '+' + v + '°' : (v > 0 ? '+' : '') + v;
            return `<div class="sub-l ${i >= n ? 'off' : ''}"><span>${m.locks[i] ? '🔒 ' : ''}${def[1]}</span><span style="color:${D.RAR[[0, 1, 3, 5, 7, 9][s.r]].col}">${shown}</span></div>`;
        }).join('');
    }
    TABS.modules = () => {
        const s = S(), mm = s.modules;
        let h = `<div class="row-s"><div class="tabs2">${[['slots', 'Equipped'], ['inv', `Inventory (${mm.inv.length})`], ['pull', 'Get modules']].map(([v, n]) => btn(n, 'modView', { v }, modView === v ? 'active' : '')).join('')}</div>
            ${D.MOD_TYPES.map(([t, n, ic]) => `<span class="chip">${ic} <b>${F(s.shards[t])}</b></span>`).join('')}<span class="chip">🎲 <b>${F(s.shards.reroll)}</b></span></div>`;
        if (modView === 'pull') {
            h += `<div class="tile hl"><b>Module pulls</b><small>Common 68.5% · Rare 29% · Epic 2.5% · an epic is guaranteed within ${D.PULL.pity - mm.pity} pulls${mm.firstEpic ? ' (first epic within your first 10)' : ''}. Every 10-pull has at least one rare.</small>
                <div class="row-s">${btn(`Pull 1 · ${mm.tickets ? '🎟️ 1' : '💎 20'}`, 'pullMod', { n: 1 }, 'primary', !mm.tickets && s.gems < 20)}${btn(`Pull 10 · ${mm.tickets >= 10 ? '🎟️ 10' : '💎 ' + (10 - Math.min(10, mm.tickets)) * 20}`, 'pullMod', { n: 10 }, 'primary', s.gems < (10 - Math.min(10, mm.tickets)) * 20)}<span class="pill">🎟️ tickets: ${mm.tickets}</span></div></div>`;
            if (lastPulls.length && lastPulls[0].uid) h += `<div class="grid sm" style="margin-top:8px">${lastPulls.map(m => `<div class="mod" style="border-color:${G.modRarity(m).col}">${typeName(m.type)[2]} ${modLabel(m)}${subsHtml(m)}</div>`).join('')}</div>`;
            h += `<h4 class="sec">Shatter</h4><div class="row-s">${btn('Shatter all commons', 'shatterAll', { r: 'common' })}${btn('Shatter all rares', 'shatterAll', { r: 'rare' })}</div>`;
            return h;
        }
        if (modView === 'slots') {
            h += '<p class="muted-s">Levels belong to the slot, so you can swap modules freely. Higher slot levels raise the main effect and unlock more sub-effects (levels 41, 101, 141, 161, 201, 241).</p><div class="grid">';
            for (const [t, n, ic, main] of D.MOD_TYPES) {
                const slot = mm.slot[t], m = G.equipped(t), c = G.slotCost(t);
                h += `<div class="tile hl"><div class="h"><span class="ic">${ic}</span><b>${n} slot · Lv ${slot.lv}</b></div>`;
                if (m) h += `<div>${modLabel(m)}</div><small>${main} +${G.pct(G.modMain(t), 1)} ${G.modLevel(t) < slot.lv ? '(capped by rarity at ' + G.modMaxLv(m) + ')' : ''}</small>${subsHtml(m, G.modLevel(t))}`;
                else h += '<small>No module equipped. Pick one in the inventory.</small>';
                h += `<div class="row-s">${btn(`Level up · ${G.CUR['shard:' + t].ic} ${F(c.shards)} + 🪙 ${F(c.coins)}`, 'slotUp', { t, n: 1 }, '', slot.lv >= 300 || s.coins < c.coins || s.shards[t] < c.shards)}${btn('×10', 'slotUp', { t, n: 10 })}${slot.lv ? btn('Restore', 'slotRestore', { t }) : ''}</div></div>`;
            }
            return h + '</div>';
        }
        // inventory
        h += `<div class="tabs2">${[['all', 'All']].concat(D.MOD_TYPES.map(x => [x[0], x[2] + ' ' + x[1]])).map(([v, n]) => btn(n, 'modFilter', { v }, modFilter === v ? 'active' : '')).join('')}</div>`;
        const sel = modSel && G.modById(modSel);
        if (sel) {
            const rec = G.mergeRecipe(sel), mats = rec ? G.mergeMaterials(sel) : null;
            const eq = mm.slot[sel.type].eq === sel.uid;
            h += `<div class="tile gold"><div class="h"><span class="ic">${typeName(sel.type)[2]}</span><div style="flex:1">${modLabel(sel)}</div>${btn('✕', 'modSel', { uid: '' })}</div>`;
            if (sel.natural) { const u = D.UNIQUES.find(x => x.name === sel.name); h += `<small>✨ ${u.desc(u.vals[D.UNIQUE_STEP[sel.rarity] || 0])}</small>`; }
            h += `<small>Main effect at slot level: ${typeName(sel.type)[3]} +${G.pct(D.mainEffect(Math.min(mm.slot[sel.type].lv, G.modMaxLv(sel)), sel.rarity, sel.stars), 1)} · max level ${G.modMaxLv(sel)}</small>`;
            h += sel.subs.map((x, i) => `<div class="row-s">${btn(sel.locks[i] ? '🔒' : '🔓', 'modLock', { uid: sel.uid, i })}<div style="flex:1">${subsHtml({ ...sel, subs: [x], locks: [false] })}</div></div>`).join('');
            h += `<div class="row-s">${btn(eq ? 'Unequip' : 'Equip', 'modEquip', { uid: sel.uid }, 'primary')}${btn(`🎲 Reroll (${G.rerollCost(sel)})`, 'modReroll', { uid: sel.uid }, '', s.shards.reroll < G.rerollCost(sel))}
                ${rec ? btn(`Merge → ${rec.to === 'star' ? '★' : D.RAR.find(x => x.id === rec.to).n}`, 'modMerge', { uid: sel.uid }, 'primary', !mats) : ''}${btn(sel.fav ? '★ Favourite' : '☆ Favourite', 'modFav', { uid: sel.uid })}
                ${btn(`Shatter (+${G.shatterValue(sel)})`, 'modShatter', { uid: sel.uid }, 'danger', !G.shatterValue(sel) || eq || sel.fav)}${G.labDone('Unmerge_Module') ? btn('Unmerge · 💎20', 'modUnmerge', { uid: sel.uid }) : ''}</div>`;
            if (rec) h += `<small>Merge needs: ${rec.needs.map(n => `${n.same ? 'same module' : 'any ' + sel.type} at ${D.RAR.find(x => x.id === n.r).n}`).join(' + ')}${mats ? ' ✓' : ' (missing)'}</small>`;
            h += '</div>';
        }
        const list = mm.inv.filter(m => modFilter === 'all' || m.type === modFilter).sort((a, b) => D.RAR.findIndex(x => x.id === b.rarity) - D.RAR.findIndex(x => x.id === a.rarity) || (b.stars || 0) - (a.stars || 0) || a.name.localeCompare(b.name));
        h += `<div class="grid sm" style="margin-top:8px">${list.slice(0, 200).map(m => {
            const eq = mm.slot[m.type].eq === m.uid;
            return `<button class="mod ${modSel === m.uid ? 'sel' : ''}" style="border-color:${G.modRarity(m).col}" data-act="modSel" data-uid="${m.uid}">${typeName(m.type)[2]} ${modLabel(m)}${eq ? ' <span class="pill good">equipped</span>' : ''}${m.fav ? ' ★' : ''}${subsHtml(m)}</button>`;
        }).join('') || '<p class="muted-s">No modules yet. Pull some, or beat bosses for drops.</p>'}</div>`;
        return h;
    };

    /* ---------- bots ---------- */
    TABS.bots = () => {
        const s = S(), r = G.run();
        const owned = Object.keys(s.bots.own).length;
        let h = `<p class="muted-s">Bots are bought and upgraded with 🏅 medals from events. Next bot: 🏅 ${owned < 5 ? F(D.BOT_UNLOCK[owned]) : '—'}</p><div class="grid">`;
        for (const b of D.BOTS) {
            if (!s.bots.own[b.id]) { h += `<div class="tile"><div class="h"><span class="ic">${b.ic}</span><b>${b.name}</b></div><small>${b.desc}</small>${btn('🏅 ' + F(D.BOT_UNLOCK[owned]), 'botBuy', { id: b.id }, 'primary', s.medals < D.BOT_UNLOCK[owned])}</div>`; continue; }
            const lv = s.bots.lv[b.id];
            h += `<div class="tile hl"><div class="h"><span class="ic">${b.ic}</span><b>${b.name}</b>${btn(s.bots.on[b.id] !== false ? 'On' : 'Off', 'botToggle', { id: b.id }, s.bots.on[b.id] !== false ? 'active' : '', !!r)}</div><small>${b.desc}</small>`;
            b.st.forEach((st, i) => {
                const max = lv[i] >= b.t[i].length;
                h += `<div class="up" style="margin:0"><b class="small">${st}: ${UI.show(b.f[i], B.botStat(b.id, i))} <span class="muted-s">Lv ${lv[i]}/${b.t[i].length}</span></b>${max ? '<span class="pill gold">MAX</span>' : btn('🏅 ' + D.botUpCost(lv[i]), 'botUp', { id: b.id, i }, '', s.medals < D.botUpCost(lv[i]) || !!r)}<small></small></div>`;
            });
            h += '</div>';
        }
        h += '</div>';
        // Bot+
        h += `<h4 class="sec">Bot+ ${G.botPlusReady() ? '' : '· unlock all five bots first'}</h4><div class="grid">`;
        for (const b of D.BOTS) {
            const p = D.BOT_PLUS[b.id], own = s.bots.plus[b.id], L = s.bots.plusLv[b.id] || 0;
            if (!own) { h += `<div class="tile ${G.botPlusReady() ? '' : 'dim'}"><b>${b.ic} ${p.name}</b><small>${p.desc(p.vals[0])}</small>${btn('💠 ' + F(D.BOT_PLUS_STONES), 'botPlusBuy', { id: b.id }, '', !G.botPlusReady() || s.stones < D.BOT_PLUS_STONES || !!r)}</div>`; continue; }
            const next = L + 1 < p.vals.length;
            h += `<div class="tile gold"><b>${b.ic} ${p.name} · Lv ${L}</b><small>${p.desc(p.vals[L])}</small>${next ? btn('🏅 ' + p.cost[L + 1], 'botPlusUp', { id: b.id }, '', s.medals < p.cost[L + 1] || !!r) : '<span class="pill gold">MAX</span>'}</div>`;
        }
        return h + '</div>';
    };

    /* ---------- guild & guardian ---------- */
    TABS.guild = () => {
        const s = S();
        G.ensureGuild();
        if (!s.guild) {
            let h = '<p class="muted-s">Join a guild to earn weekly chests (tokens, bits, gems, coins) and unlock the Guardian. Your guildmates are simulated offline.</p><div class="grid">';
            for (const g of G.guildList()) h += `<div class="tile"><div class="h"><span class="ic">🛡️</span><b>${esc(g.name)}</b><span class="pill">${g.tag}</span></div><small>${g.size}/30 members · activity ${Math.round(g.act * 100)}%</small>${btn('Join', 'joinGuild', { id: g.id }, 'primary')}</div>`;
            return h + `</div><div class="row-s" style="margin-top:8px">${btn('Create your own guild · 💎 50', 'createGuild', {}, '', s.gems < 50)}</div>`;
        }
        const g = s.guild, total = G.guildTotal();
        let h = `<div class="row between"><div><b>🛡️ ${esc(g.name)}</b> <span class="muted-s">${g.members.length + 1} members · season ${G.guildSeason() % 100}</span></div>${btn('Leave guild', 'leaveGuild', {}, 'danger')}</div>
            <h4 class="sec">Weekly contribution · ${F(total)} (you: ${g.contrib}) · resets in ${timeLeft(G.untilNextWeek())}</h4>${prog(total / 750)}
            <div class="grid sm" style="margin-top:6px">${G.GUILD_CHESTS.map(([need, tok, bits, cm, gems], i) => `<div class="tile ${g.chests[i] ? 'dim' : total >= need ? 'gold' : ''}"><b>Chest ${i + 1} · ${need}</b><small>🪙 ${tok} tokens · 🔹 ${bits} bits · 💎 ${gems} · coins ×${cm}</small>${g.chests[i] ? '<span class="pill good">claimed</span>' : btn('Claim', 'claimChest', { i }, 'primary', total < need)}</div>`).join('')}</div>
            <p class="note">Each weekly mission box you claim adds 5 to the guild total.</p>`;
        // guardian
        const gd = s.guardian;
        h += `<h4 class="sec">Guardian · 🔹 ${F(s.bits)} bits</h4>`;
        if (!gd.unlocked) h += `<div class="tile hl"><b>Unlock the Guardian</b><small>A companion that fights next to the tower with the chips you equip.</small>${btn('🔹 200', 'unlockGuardian', {}, 'primary', s.bits < 200)}</div>`;
        else {
            h += `<div class="row-s"><span class="pill">Chip slots ${gd.eq.length}/${gd.slots}</span>${G.guardianSlotCost() ? btn(`➕ Slot · 🔹 ${G.guardianSlotCost()}`, 'guardianSlot', {}, '', s.bits < G.guardianSlotCost()) : ''}</div><div class="grid" style="margin-top:6px">`;
            for (const c of D.CHIPS) {
                if (!gd.own[c.id]) { h += `<div class="tile dim"><b>${c.ic} ${c.name}</b><small>${c.desc}</small><small>Buy in the guild store</small></div>`; continue; }
                const on = gd.eq.includes(c.id), lv = gd.chips[c.id];
                h += `<div class="tile ${on ? 'gold' : ''}"><div class="h"><b>${c.ic} ${c.name}</b>${btn(on ? 'Equipped' : 'Equip', 'toggleChip', { id: c.id }, on ? 'active' : '')}</div><small>${c.desc}</small>`;
                c.st.forEach((st, i) => { const cost = G.chipUpCost(c.id, i); h += `<div class="up" style="margin:0"><b class="small">${st}: ${UI.show(c.f[i], c.t[i][lv[i]].v)}</b>${cost === null ? '<span class="pill gold">MAX</span>' : btn('🔹 ' + cost, 'chipUp', { id: c.id, i }, '', s.bits < cost)}<small></small></div>`; });
                h += '</div>';
            }
            h += '</div>';
        }
        // store
        h += `<h4 class="sec">Guild store · 🪙 ${F(s.tokens)} tokens · leftover tokens turn into gems at season end</h4><div class="grid sm">`;
        for (const [kind, label] of [['bits', '25 bits'], ['gems', '100 gems'], ['shards:cannon', '250 cannon shards'], ['shards:armor', '250 armor shards'], ['shards:generator', '250 generator shards'], ['shards:core', '250 core shards']]) {
            const p = G.storePrice(kind);
            h += `<div class="tile"><b>${label}</b>${p ? btn('🪙 ' + p, 'storeBuy', { k: kind }, '', s.tokens < p) : '<span class="pill">sold out this season</span>'}</div>`;
        }
        if (gd.unlocked) for (const c of D.CHIPS.filter(x => !x.base && !gd.own[x.id])) h += `<div class="tile"><b>${c.ic} ${c.name} chip</b>${btn('🪙 200', 'storeBuy', { k: 'chip', a: c.id }, '', s.tokens < 200)}</div>`;
        for (const r of G.seasonRelics()) h += `<div class="tile ${s.relics[r.id] ? 'dim' : ''}"><b>${G.relicIc(r)} ${esc(r.name)}</b><small>${esc(r.desc)}</small>${s.relics[r.id] ? '<span class="pill good">owned</span>' : btn('🪙 ' + r.key.cost, 'storeBuy', { k: 'relic', a: r.id }, '', s.tokens < r.key.cost)}</div>`;
        const skin = 'Season ' + (G.guildSeason() % 100) + ' Guardian';
        h += `<div class="tile ${gd.skins[skin] ? 'dim' : ''}"><b>🎨 ${skin} skin</b><small>+0.6% coins forever</small>${gd.skins[skin] ? '<span class="pill good">owned</span>' : btn('🪙 150', 'storeBuy', { k: 'gskin', a: skin }, '', s.tokens < 150)}</div>`;
        h += '</div><h4 class="sec">Members</h4><div class="board">';
        h += g.members.slice().sort((a, b) => b.act - a.act).map((m, i) => `<div><span>${i + 1}</span><span>${esc(m.name)}</span><span>${Math.round(35 * m.act * G.guildWeekFrac())}</span></div>`).join('');
        return h + '</div>';
    };

    /* ---------- missions ---------- */
    TABS.missions = () => {
        const s = S();
        G.ensureDaily();
        const r = G.dailyReward();
        let h = `<p class="muted-s">Up to 8 missions; 2 new ones arrive every 8 hours (next in ${timeLeft(G.nextMissionIn())}). Each pays 💎 ${r.gems} + 🪙 ${F(r.coins)}${r.shards ? ` + ${r.shards} module shards` : ''}.</p><div class="grid">`;
        for (const m of s.daily.board) {
            const done = m.p >= m.goal;
            h += `<div class="tile ${done ? 'gold' : ''}"><b>${esc(m.text)}</b>${prog(m.p / m.goal)}<small>${F(m.p)} / ${F(m.goal)}</small><div class="row-s">${btn('Claim', 'claimDaily', { id: m.id }, 'primary', !done)}${G.labDone('Reroll_Daily_Missions') && !done ? btn(G.vaultLv('freeMissionReroll') ? '🎲 Reroll' : '🎲 💎5', 'rerollDaily', { id: m.id }) : ''}</div></div>`;
        }
        if (!s.daily.board.length) h += '<p class="muted-s">No missions right now.</p>';
        h += `</div><h4 class="sec">Weekly rewards · ${s.daily.done} missions done · resets in ${timeLeft(G.untilNextWeek())}</h4><div class="grid sm">`;
        D.WEEKLY_BOX.forEach(([cm, gems, medals, stones, tokens], k) => {
            const claimed = s.daily.boxes > k, ready = G.boxReady(k) && s.daily.boxes === k;
            h += `<div class="tile ${claimed ? 'dim' : ready ? 'gold' : ''}"><b>Box ${k + 1} · ${(k + 1) * 5} missions</b><small>🪙 ×${cm} · 💎 ${gems}${medals && s.feat.events ? ` · 🏅 ${medals}` : ''}${stones && s.feat.tournaments ? ` · 💠 ${stones}` : ''}${s.feat.guilds ? ` · tokens ${tokens}` : ''}</small>${claimed ? '<span class="pill good">claimed</span>' : btn('Claim', 'claimBox', {}, 'primary', !ready)}</div>`;
        });
        return h + '</div>';
    };

    /* ---------- milestones ---------- */
    TABS.milestones = () => {
        const s = S();
        let h = `<div class="row between"><div class="tiersel">${btn('◀', 'msTier', { d: -1 }, '', msTier <= 1)}<b>Tier ${msTier}</b>${btn('▶', 'msTier', { d: 1 }, '', msTier >= Math.min(24, s.maxTier))}</div>${btn('Claim all', 'claimAllMs', {}, 'primary', !G.msClaimable())}</div>`;
        const p = G.passOf(msTier);
        h += `<p class="muted-s">Best wave on this tier: <b>${F(s.tierBest[msTier] || 0)}</b>. ${s.premium[p] ? 'Premium pass owned for tiers ' + (p * 3 + 1) + '–' + (p * 3 + 3) + '.' : ''}</p>`;
        if (!s.premium[p]) h += `<div class="row-s">${btn(`🎫 Premium pass tiers ${p * 3 + 1}–${p * 3 + 3} · 💎 ${F(D.PREMIUM_PASS_GEMS)}`, 'buyPass', { p }, '', s.gems < D.PREMIUM_PASS_GEMS)}<span class="muted-s">(the real pass costs money)</span></div>`;
        h += '<table class="t"><tr><th>Wave</th><th>Standard</th><th></th><th>Premium</th><th></th></tr>';
        for (const m of D.MILESTONES[msTier] || []) {
            const reached = G.msReached(msTier, m.wave), got = G.msClaimed(msTier, m.wave), gotP = s.ms['p' + G.msKey(msTier, m.wave)];
            h += `<tr style="${reached ? '' : 'opacity:.5'}"><td><b>${F(m.wave)}</b></td><td>${esc(m.std)}</td><td>${got ? '✅' : btn('Claim', 'claimMs', { t: msTier, w: m.wave }, 'primary', !reached)}</td>
                <td class="muted-s">${esc(m.prem)}</td><td>${s.premium[p] ? (gotP ? '✅' : btn('Claim', 'claimMs', { t: msTier, w: m.wave, p: 1 }, '', !reached)) : '🔒'}</td></tr>`;
        }
        return h + '</table>';
    };

    /* ---------- events ---------- */
    TABS.events = () => {
        const s = S();
        G.ensureEvent();
        const ev = s.event;
        if (!ev) return '<p class="muted-s">Events unlock at the Tier 1 wave 70 milestone.</p>';
        let h = `<div class="row between"><div><b>🎉 ${esc(ev.name)}</b> <span class="muted-s">ends in ${timeLeft(G.eventEnds() - Date.now())} · day ${G.eventDay() + 1}/14</span></div><span class="pill gold">🏅 earned this event: ${ev.medals}</span></div>`;
        // relic track
        h += '<h4 class="sec">Event relics</h4><div class="grid sm">';
        for (const r of G.eventRelics()) {
            const own = s.relics[r.id];
            h += `<div class="tile ${own ? 'gold' : ''}"><b>${G.relicIc(r)} ${esc(r.name)}${r.key.premium ? ' <span class="pill">boost</span>' : ''}</b><small>${esc(r.desc)}</small>${prog(ev.medals / r.key.medals)}<small>${own ? 'owned' : `${ev.medals}/${r.key.medals} medals`}</small></div>`;
        }
        h += `</div><div class="row-s" style="margin-top:6px">${ev.boost ? '<span class="pill gold">Event boost active: medals ×2</span>' : btn(`⚡ Event boost (double medals, premium relics) · 💎 ${F(D.EVENT_BOOST_GEMS)}`, 'eventBoost', {}, '', s.gems < D.EVENT_BOOST_GEMS)}</div>`;
        h += `<h4 class="sec">Missions (${G.eventMissions().length}/21 · 2 more each day)</h4><div class="grid">`;
        for (const m of G.eventMissions()) {
            const p = G.evProgress(m);
            const fmt = (v) => m.stat === 'lab_time' ? G.dur(v) : F(v);
            h += `<div class="tile"><b>${esc(m.text.replace('X', 'X'))}</b><small>${fmt(p)}</small><div class="row-s">${m.goals.map((g, i) => {
                const got = ev.tiers[m.text + i];
                return got ? `<span class="pill good">✅ ${fmt(g)}</span>` : btn(`${fmt(g)} · 🏅${D.EVENT_MEDALS[i] * (ev.boost ? 2 : 1)}`, 'claimEv', { t: m.text, i }, p >= g ? 'primary' : '', p < g || (i > 0 && !ev.tiers[m.text + (i - 1)]));
            }).join('')}</div></div>`;
        }
        h += '</div><h4 class="sec">Event shop · 🏅 ' + F(s.medals) + '</h4><div class="grid sm">';
        h += `<div class="tile"><b>150 gems</b>${btn('🏅 ' + G.tradePrice('gems'), 'trade', { k: 'gems' }, '', s.medals < G.tradePrice('gems'))}</div><div class="tile"><b>15 power stones</b>${btn('🏅 ' + G.tradePrice('stones'), 'trade', { k: 'stones' }, '', s.medals < G.tradePrice('stones'))}</div>`;
        for (const [t, n, ic] of D.MOD_TYPES) h += `<div class="tile"><b>${ic} 250 ${n} shards</b>${btn('🏅 ' + G.tradePrice('shards'), 'trade', { k: 'shards', t }, '', s.medals < G.tradePrice('shards'))}</div>`;
        const tid = G.eventThemeId(false), bid = G.eventThemeId(true);
        h += `<div class="tile"><b>🗼 ${esc(ev.name)} tower</b><small>+0.4% coins</small>${s.skins.owned[tid] ? '<span class="pill good">owned</span>' : btn('🏅 150', 'evTheme', { bg: 0 }, '', s.medals < 150)}</div>`;
        h += `<div class="tile"><b>🖼️ ${esc(ev.name)} background</b><small>+0.8% coins</small>${(s.skins.bg || {})[bid] ? '<span class="pill good">owned</span>' : btn('🏅 250', 'evTheme', { bg: 1 }, '', s.medals < 250)}</div>`;
        for (const so of D.SONGS) h += `<div class="tile"><b>🎵 ${so.n}</b><small>+0.6% coins</small>${s.songs[so.id] ? '<span class="pill good">owned</span>' : btn('🏅 200', 'song', { id: so.id }, '', s.medals < 200)}</div>`;
        h += '</div><h4 class="sec">Past relics for gems (changes every event)</h4><div class="grid sm">';
        for (const r of G.gemRelicOffers()) { const price = r.key.medals >= 700 ? 1200 : 600; h += `<div class="tile"><b>${G.relicIc(r)} ${esc(r.name)}</b><small>${esc(r.desc)} · from ${esc(r.key.name)}</small>${btn('💎 ' + price, 'gemRelic', { id: r.id }, '', s.gems < price)}</div>`; }
        h += '</div><p class="note">Bots are in the 🤖 Bots menu and also cost medals.</p>';
        return h;
    };

    /* ---------- tournament ---------- */
    TABS.tournament = () => {
        const s = S();
        G.ensureTournament();
        const T = s.tour, c = T.cur, L = D.LEAGUES[T.league];
        let h = `<div class="row between"><div><b style="color:${L.col}">${L.ic} ${L.id} league</b> <span class="muted-s">enemies scale like tier ${L.tier}+, perks are off, wave cooldown is halved</span></div>`;
        if (G.tourOpen()) h += `<span class="pill gold">open · ${timeLeft(c.key + G.DAY - Date.now())} left</span></div>`;
        else h += `<span class="pill">next tournament in ${timeLeft(G.tourNext() - Date.now())}</span></div>`;
        if (G.tourOpen()) {
            h += `<div class="row-s" style="margin:8px 0"><button class="btn primary" data-act="enterTour" ${c.tickets < 1 || G.run() || s.run ? 'disabled' : ''}>⚔ Play (${c.tickets} ticket${c.tickets === 1 ? '' : 's'})</button>${btn(`🎟️ Ticket · 💎 ${G.ticketPrice()}`, 'buyTicket', {}, '', s.gems < G.ticketPrice())}${c.ad ? '' : btn('📺 Free ticket', 'buyTicket', { ad: 1 })}<span class="muted-s">Your best: <b>${F(c.best)}</b></span></div>`;
        }
        if (c && c.bracket) {
            const rows = G.tourBoard();
            h += '<h4 class="sec">Bracket</h4><div class="board">';
            rows.forEach((r, i) => {
                const rank = i + 1, rw = G.tourReward(T.league, rank);
                const cls = [r.me ? 'me' : '', rank <= 4 && T.league < 6 ? 'promo' : '', rank >= 25 && T.league >= 3 ? 'demo' : ''].join(' ');
                h += `<div class="${cls}"><span>${rank}</span><span>${esc(r.name)}</span><span>${r.wave ? 'wave ' + F(r.wave) : '<span class="muted-s">—</span>'} · 💎${rw.gems} 💠${rw.stones}${rw.keys ? ' 🗝️' + rw.keys : ''}</span></div>`;
            });
            h += '</div><p class="note">Top 4 are promoted. From Platinum up, the bottom 6 are demoted. Rivals post their scores during the day.</p>';
        } else if (G.tourOpen()) h += '<p class="muted-s">Play a run to join a bracket of 30 players.</p>';
        h += `<h4 class="sec">${L.id} rewards</h4><table class="t"><tr><th>Rank</th><th>Gems</th><th>Stones</th><th>Keys</th></tr>${L.rewards.map((r, i) => `<tr><td>${i ? L.rewards[i - 1][0] + 1 : 1}${r[0] > (i ? L.rewards[i - 1][0] + 1 : 1) ? '–' + r[0] : ''}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3] || ''}</td></tr>`).join('')}</table>`;
        if (T.hist.length) h += `<h4 class="sec">History</h4><table class="t"><tr><th>League</th><th>Wave</th><th>Rank</th><th>Reward</th></tr>${T.hist.slice().reverse().slice(0, 12).map(x => `<tr><td>${D.LEAGUES[x.league].ic} ${D.LEAGUES[x.league].id}</td><td>${F(x.wave)}</td><td>${x.rank}</td><td>💎${x.gems} 💠${x.stones}${x.keys ? ' 🗝️' + x.keys : ''}${x.to > x.league ? ' ⬆' : x.to < x.league ? ' ⬇' : ''}</td></tr>`).join('')}</table>`;
        return h;
    };

    /* ---------- relics & themes ---------- */
    const RELIC_STAT_NAME = { coins: 'Coins', labSpeed: 'Lab speed', critFactor: 'Crit factor', critChance: 'Crit chance', damage: 'Damage', rendMult: 'Rend armor', health: 'Health', regen: 'Health regen',
        attackSpeed: 'Attack speed', defPct: 'Defense %', defAbs: 'Defense absolute', thorns: 'Thorns', cash: 'Cash', uwDamage: 'UW damage', scChance: 'Super crit chance', scMult: 'Super crit multiplier',
        dpm: 'Damage / meter', botRange: 'Bot range', kbForce: 'Knockback', orbSpeed: 'Orb speed', wallRebuild: 'Wall rebuild', freeAtk: 'Free attack upgrades', freeDef: 'Free defense upgrades',
        freeUtil: 'Free utility upgrades', pkgAmount: 'Recovery amount', skipAtk: 'Attack level skip', skipHp: 'Health level skip' };
    let relicShow = 'all';
    TABS.relics = () => {
        const s = S();
        const owned = D.RELICS.filter(r => s.relics[r.id]);
        const totals = {};
        for (const r of owned) totals[r.stat] = (totals[r.stat] || 0) + r.val;
        let h = `<h4 class="sec">Relic bonuses · ${owned.length}/${D.RELICS.length} owned</h4><div class="row-s">${Object.entries(totals).map(([k, v]) => `<span class="pill gold">${RELIC_STAT_NAME[k] || k} +${k === 'botRange' || k === 'wallRebuild' ? v : G.pct(v, 1)}</span>`).join('') || '<span class="muted-s">No relics yet. They come from events, tournaments, the guild store and wave 4,500 milestones.</span>'}</div>`;
        h += '<h4 class="sec">Tower themes · each owned theme adds coins</h4><div class="grid sm">';
        const ids = Object.keys(s.skins.owned);
        for (const id of ids) { const sk = G.skinById(id); h += `<div class="tile ${s.skins.eq === id ? 'gold' : ''}"><b>🗼 ${esc(sk.n)}</b>${btn(s.skins.eq === id ? 'Equipped' : 'Equip', 'equipSkin', { id }, s.skins.eq === id ? 'active' : '')}</div>`; }
        h += `</div><p class="muted-s">Theme coin bonus: ×${G.themeBonus().toFixed(3)}</p>`;
        h += `<div class="row between"><h4 class="sec" style="flex:1">All relics</h4><div class="seg mult">${[['all', 'All'], ['own', 'Owned'], ['Rare', 'Rare'], ['Epic', 'Epic'], ['Legendary', 'Legendary']].map(([v, n]) => btn(n, 'relicShow', { v }, relicShow === v ? 'active' : '')).join('')}</div></div><div class="relics">`;
        for (const r of D.RELICS) {
            const own = !!s.relics[r.id];
            if ((relicShow === 'own' && !own) || (relicShow !== 'all' && relicShow !== 'own' && r.rarity !== relicShow)) continue;
            h += `<div class="relic ${r.rarity} ${own ? 'own' : ''}" title="${esc(r.srcText)}">${G.relicIc(r)}<b>${esc(r.name)}</b><small>${esc(r.desc)}</small><small class="src">${own ? '✅ Owned' : esc(r.srcText)}</small></div>`;
        }
        return h + '</div>';
    };

    /* ---------- vault ---------- */
    TABS.vault = () => {
        const s = S();
        let h = `<p class="muted-s">The Vault is bought with 🗝️ keys from Legend and Mythic tournaments. You have <b>${F(s.keys)}</b>.</p>`;
        for (const sec of D.VAULT) {
            const open = G.vaultSecOpen(sec);
            h += `<h4 class="sec">${sec.sec} ${open ? '' : '· ' + btn('Unlock 🗝️ ' + sec.unlock, 'vaultSec', { s: sec.sec }, '', s.keys < sec.unlock)}</h4><div class="grid sm">`;
            for (const it of sec.items) {
                const L = G.vaultLv(it.id), max = L >= it.costs.length;
                const val = it.step ? `${it.unit === '%+' ? '+' + G.pct(it.step * L, 1) : it.step >= 1 ? '+' + (it.step * L * 100) + '%' : '+' + G.pct(it.step * L, 0)}` : '';
                h += `<div class="tile ${open ? '' : 'dim'}"><b>${it.name} <span class="muted-s">${L}/${it.costs.length}</span></b><small>${esc(it.desc || '')} ${val}</small>${max ? '<span class="pill gold">MAX</span>' : btn('🗝️ ' + it.costs[L], 'vaultBuy', { id: it.id }, '', !open || s.keys < it.costs[L])}</div>`;
            }
            h += '</div>';
        }
        return h;
    };

    /* ---------- free gems (store) ---------- */
    TABS.store = () => {
        const s = S(), f = s.free;
        let h = '<p class="muted-s">The real game sells gems and shows ads. Here those are free rewards on the same timers, so gem income stays close to a free-to-play player\'s.</p><div class="grid">';
        h += `<div class="tile ${G.dailyGemsReady() ? 'gold' : ''}"><b>💎 Free daily gems</b><small>20 gems once per day (resets 00:00 UTC, in ${timeLeft(G.untilNextDay())})</small>${btn('Claim 20', 'dailyGems', {}, 'primary', !G.dailyGemsReady())}</div>`;
        h += `<div class="tile ${f.adStack ? 'gold' : ''}"><b>📺 Ad gems</b><small>6 gems each, one every 10 minutes of play, stack up to ${G.adGemMax()}. ${f.adGemsToday || 0}/60 today.</small>${btn(`Claim ${6 * (f.adStack || 0)}`, 'adGems', {}, 'primary', !f.adStack)}</div>`;
        h += `<div class="tile"><b>🪙 Coin boost ×1.5</b><small>Each "ad" adds 20 minutes of ×1.5 coins while you play, up to 2 hours banked. Banked: ${G.dur(f.coinBoost || 0)}</small>${btn('+20 minutes', 'coinBoost', {}, '', (f.coinBoost || 0) >= 7200 - 1)}</div>`;
        return h + '</div>';
    };

    /* ---------- autopilot ---------- */
    TABS.autopilot = () => {
        const s = S(), ap = s.ap;
        let h = '<p class="muted-s">Autopilot modules from the earlier version of this game. Bought once with coins, each can be switched on or off.</p><div class="grid">';
        for (const a of D.AUTOS) {
            const own = G.apOwn(a.id);
            h += `<div class="tile ${own ? 'hl' : ''}"><div class="h"><span class="ic">${a.ic}</span><b>${a.n}</b>${own ? btn(G.apOn(a.id) ? 'On' : 'Off', 'apToggle', { id: a.id }, G.apOn(a.id) ? 'active' : '') : btn('🪙 ' + F(a.price), 'apBuy', { id: a.id }, 'primary', s.coins < a.price)}</div><small>${a.desc}</small></div>`;
        }
        h += '</div>';
        if (G.apOwn('buy')) {
            h += `<h4 class="sec">Auto-buyer</h4><div class="row-s">${D.CATS.map(c => btn((ap.cats[c] ? '✅ ' : '⬜ ') + c, 'apCat', { c }, ap.cats[c] ? 'active' : '')).join('')}</div><p class="muted-s">Tap an upgrade to stop the auto-buyer from buying it:</p><div class="row-s">`;
            for (const u of D.UPG) if (G.unlocked(u)) h += btn((ap.skip[u.id] ? '⛔ ' : '') + u.name, 'apSkip', { id: u.id }, ap.skip[u.id] ? '' : 'active');
            h += '</div>';
        }
        if (G.labDone('Unlock_Perks')) {
            h += `<h4 class="sec">Perks</h4><div class="row-s">${G.labDone('Auto_Perk_Pick') ? btn(s.perks.auto ? 'Auto pick perks: on' : 'Auto pick perks: off', 'perkAuto', {}, s.perks.auto ? 'active' : '') : '<span class="muted-s">Auto Pick Perks lab not researched.</span>'}</div>`;
            if (G.labDone('First_Perk_Choice')) h += `<p class="muted-s">First perk choice:</p><div class="row-s">${D.PERKS.filter(p => p.id !== 'randomUW').map(p => btn(p.name(p.kind === 'm' ? (1 + p.v).toFixed(2) : p.v), 'firstPerk', { id: p.id }, s.perks.first === p.id ? 'active' : '')).join('')}</div>`;
            const rankN = G.labV('Auto_Pick_Ranking');
            if (rankN) h += `<p class="muted-s">Auto-pick ranking (${s.perks.rank.length}/${rankN}): tap to add/remove in order.</p><div class="row-s">${D.PERKS.concat(D.UW_PERKS).concat(D.TRADE_PERKS).map(p => { const i = s.perks.rank.indexOf(p.id); return btn((i >= 0 ? (i + 1) + '. ' : '') + (typeof p.name === 'function' ? p.name(p.v || 1) : p.name), 'rankPerk', { id: p.id }, i >= 0 ? 'active' : ''); }).join('')}</div>`;
            const bans = G.labV('Ban_Perks');
            if (bans) h += `<p class="muted-s">Banned perks (${s.perks.bans.length}/${bans}):</p><div class="row-s">${D.PERKS.concat(D.TRADE_PERKS).map(p => btn((s.perks.bans.includes(p.id) ? '⛔ ' : '') + (typeof p.name === 'function' ? p.name(p.v || 1) : p.name), 'banPerk', { id: p.id }, s.perks.bans.includes(p.id) ? 'active' : '')).join('')}</div>`;
        }
        return h;
    };

    /* ---------- stats ---------- */
    TABS.stats = () => {
        const s = S(), st = s.stats, t = G.stats(null);
        let h = '<h4 class="sec">Tower (outside battle)</h4><div class="sum">';
        const show = [['Damage', F(t.damage)], ['Attack speed', t.attackSpeed.toFixed(2)], ['Crit chance', G.pct(t.critChance)], ['Crit factor', '×' + t.critFactor.toFixed(2)], ['Range', t.range.toFixed(1) + 'm'],
            ['Damage/meter', G.pct(t.dpm, 2)], ['Health', F(t.health)], ['Regen', F(t.regen) + '/s'], ['Defense %', G.pct(t.defPct)], ['Defense abs', F(t.defAbs)], ['Thorns', G.pct(t.thorns)],
            ['Cash bonus', '×' + t.cashBonus.toFixed(2)], ['Coins/kill', '×' + t.coinKill.toFixed(2)], ['All coin bonuses', '×' + t.coinMult.toFixed(2)], ['UW damage', '×' + t.uwDamage.toFixed(2)]];
        h += show.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
        h += '</div><h4 class="sec">Lifetime</h4><div class="sum">';
        const life = [['Runs', st.runs], ['Waves', st.waves], ['Enemies destroyed', st.kills], ['Bosses', st.bosses], ['Coins earned', st.coinsTotal], ['Gems earned', st.gemsTotal], ['Stones earned', st.stonesTotal],
            ['Labs finished', st.labsDone], ['Cards bought', st.cardsBought], ['Modules pulled', st.modulesPulled], ['Free upgrades', st.freeUps], ['Floating gems', st.floatGems], ['Time in battle', G.dur(st.timePlayed)]];
        h += life.map(([k, v]) => `<div><small>${k}</small><b>${typeof v === 'number' ? F(v) : v}</b></div>`).join('');
        h += '</div><h4 class="sec">Best wave per tier</h4><div class="sum">';
        for (let tt = 1; tt <= s.maxTier; tt++) h += `<div><small>Tier ${tt}</small><b>${F(s.tierBest[tt] || 0)}</b></div>`;
        h += '</div>';
        if (s.feat.dissonance) {
            h += '<h4 class="sec">Dissonance boosts</h4><div class="sum">';
            for (const k in s.dissonance) { const [tt, c] = k.split(':'); h += `<div><small>T${tt} ${c}</small><b>×${G.dissBoostFor(c, s.dissonance[k]).toFixed(2)}</b></div>`; }
            h += '</div>';
        }
        return h;
    };

    /* ---------- settings ---------- */
    TABS.settings = () => {
        const s = S();
        let h = `<div class="grid"><div class="tile"><b>Player name</b><small>Shown on tournament boards.</small><div class="row-s"><input id="nameIn" value="${esc(s.name)}" maxlength="16" style="flex:1;padding:6px;border-radius:8px;border:1px solid var(--line-2);background:var(--bg-2);color:var(--text)">${btn('Save', 'saveName')}</div></div>
            <div class="tile"><b>Damage numbers</b>${btn(s.settings.numbers ? 'On' : 'Off', 'toggleSet', { k: 'numbers' }, s.settings.numbers ? 'active' : '')}</div>`;
        if (G.labDone('Target_Priority')) h += `<div class="tile"><b>Target priority</b><div class="row-s">${['closest', 'boss', 'fast', 'tank', 'ranged', 'protector', 'vampire', 'ray', 'scatter'].map(t => btn(t, 'target', { t }, (s.settings.target || 'closest') === t ? 'active' : '')).join('')}</div></div>`;
        h += `<div class="tile"><b>Save</b><small>Your progress is saved in this browser.</small><div class="row-s">${btn('Export', 'exportSave')}${btn('Import', 'importSave')}${btn('Reset everything', 'resetSave', {}, 'danger')}</div></div></div>
            <h4 class="sec">About this version</h4><p class="note">Workshop, labs, cards, ultimate weapons, perks, milestones, tournaments, events, bots, the guardian and relics use the numbers from the fan wiki (the-tower-idle-tower-defense.fandom.com) and the community enemy formulas. The wiki doesn't list battle (cash) prices, the enemy type mix per wave or module main effects; those are close stand-ins. Lab timers are the real ones; use Lab Overclock to speed them up.</p>`;
        return h;
    };

    /* ======================================================================
       PERK OVERLAY & RUN END
       ====================================================================== */
    UI.showPerk = () => {
        const r = G.run();
        if (!r || !r.offers.length) { $('perkOv').hidden = true; return; }
        const o = r.offers[0];
        $('perkSub').textContent = `Perk ${r.perkCount - r.offers.length + 1} · ${r.offers.length > 1 ? r.offers.length + ' waiting · ' : ''}the battle keeps going while you choose`;
        $('perks').innerHTML = G.iconize(o.map((p, i) => `<button class="perk ${p.kind}" data-act="pickPerk" data-i="${i}">${esc(B.perkText(p))}<small>${p.kind === 'uw' ? 'Ultimate weapon perk' : p.kind === 'trade' ? 'Trade-off' : 'Standard'}</small></button>`).join(''));
        $('perkOv').hidden = false;
    };
    UI.showEnd = (r, auto) => {
        const L = r.tour ? D.LEAGUES[r.league] : null;
        const best = r.tour ? S().tour.cur && S().tour.cur.best : S().tierBest[r.tier];
        $('endBody').innerHTML = G.iconize(`<h2 class="bad">${r.tour ? 'Tournament run over' : 'Tower destroyed'}</h2><p>${L ? L.ic + ' ' + L.id : 'Tier ' + r.tier}${r.diss ? ' · dissonant (' + r.diss + ')' : ''} · reached <b>wave ${F(r.wave)}</b>${best === r.wave ? ' <span class="gold">· new best!</span>' : ''}</p>
            <div class="sum"><div><small>Coins</small><b>🪙 ${F(r.coins)}</b></div><div><small>Elite cells</small><b>🧬 ${F(r.cells)}</b></div><div><small>Kills</small><b>${F(r.stats.kills)}</b></div><div><small>Bosses</small><b>${r.stats.bosses}</b></div>
            <div><small>Damage dealt</small><b>${F(r.stats.damage)}</b></div><div><small>Cash earned</small><b>$${F(r.stats.cash)}</b></div><div><small>Free upgrades</small><b>${r.stats.freeUps}</b></div><div><small>Time</small><b>${G.dur(r.t)}</b></div>
            ${r.rerolls ? `<div><small>Reroll shards</small><b>🎲 ${F(r.rerolls)}</b></div>` : ''}</div>
            ${auto ? '<p class="muted-s">Auto-restart: a new run starts in a moment…</p>' : ''}
            <div class="actions">${r.tour ? btn('🏆 Tournament', 'endTour', {}, 'primary') : btn('⚔️ Play again', 'again', {}, 'primary')}${btn('🏠 Home', 'endHome')}</div>`);
        $('endOv').hidden = false;
        if (G.msClaimable()) G.toast(`🏁 ${G.msClaimable()} milestone reward${G.msClaimable() > 1 ? 's' : ''} to claim`, 'gold', 3500);
    };

    /* ======================================================================
       ACTIONS (every button has data-act)
       ====================================================================== */
    const A = UI.actions = {
        openMenu: (d) => UI.openMenu(d.tab), closeMenu: () => UI.closeMenu(),
        tier: (d) => { const s = S(); s.tier = G.clamp(s.tier + +d.d, 1, s.maxTier); G.saveSoon(); },
        battle: () => G.main.startRun({}),
        dissRun: (d) => G.main.startRun({ diss: d.c }),
        resumeRun: () => G.main.resumeRun(), abandonRun: () => { if (confirm('Abandon the saved run? Its coins are already yours.')) { S().run = null; G.save(); } },
        runTab: (d) => { runTab = d.t; UI.renderSide(true); },
        multNext: () => { const o = multOptions(), i = o.findIndex(m => String(m) === String(S().settings.buyMult)); S().settings.buyMult = o[(i + 1) % o.length]; UI.renderSide(true); },
        perkBtn: () => { const r = G.run(); if (r && r.offers.length) UI.showPerk(); else { runTab = 'perks'; UI.renderSide(true); } },
        endRound: () => G.main.setPaused(true),
        lockedMenu: (d) => G.toast(`🔒 ${MENUS.find(x => x[0] === d.tab)[2]} is locked. ${UNLOCK_HINT[d.tab] || ''}`, 'bad', 2600),
        mult: (d) => { S().settings.buyMult = d.m === 'max' ? 'max' : +d.m; UI.renderSide(true); },
        runBuy: (d) => { const m = S().settings.buyMult; const n = m === 'max' ? 'max' : m; if (B.buy(d.id, n)) G.sfx('click'); else G.sfx('bad'); },
        uwToggle: (d) => { const r = G.run(); if (!r) return; r.uwOff[d.id] = !r.uwOff[d.id]; r.uwToggles = (r.uwToggles || 0) + 1; if (!r.uwOff[d.id] && r.uw[d.id]) r.uw[d.id].t = Math.max(r.uw[d.id].t, 1); },
        demon: () => B.demon(), nuke: () => B.nuke(), barrage: () => B.barrage(),
        showPerk: () => UI.showPerk(),
        pickPerk: (d) => { B.pickPerk(+d.i); $('perkOv').hidden = true; if (G.run() && G.run().offers.length) UI.showPerk(); G.main.afterPerk(); },
        resume: () => G.main.setPaused(false), quitRun: () => { $('pauseOv').hidden = true; G.main.endRun('quit'); },
        again: () => { $('endOv').hidden = true; G.main.startRun({ tier: S().tier }); },
        endHome: () => { $('endOv').hidden = true; UI.renderSide(true); },
        endTour: () => { $('endOv').hidden = true; UI.openMenu('tournament'); },
        // workshop
        wsCat: (d) => { if (d.c === 'uw') { UI.openMenu('uw'); return; } wsCat = d.c; if (menuTab !== 'workshop') UI.openMenu('workshop'); }, wsMult: (d) => { wsMult = d.m === 'max' ? 'max' : +d.m; },
        wsBuy: (d) => { if (G.wsBuy(d.id, +d.n || 1)) G.sfx('click'); else G.sfx('bad'); },
        unlockGroup: (d) => G.unlockGroup(d.g), respec: () => { if (confirm('Reset the workshop for 150 gems? All coins come back.')) G.respec(); },
        enhBuy: (d) => G.enhBuy(d.id),
        // labs
        labCat: (d) => { labCat = d.c; }, labLocked: () => { showLockedLabs = !showLockedLabs; },
        labStart: (d) => G.labStart(d.id), labRush: (d) => G.labRush(d.id), labCancel: (d) => G.labCancel(d.id),
        labAuto: (d) => { S().labs.auto[d.id] = !S().labs.auto[d.id]; G.saveSoon(); }, labSlot: () => G.buyLabSlot(), overclock: () => G.buyOverclock(),
        cellBoost: (d) => G.buyCellBoost(+d.slot, +d.k, +d.h),
        // cards
        buyCards: (d) => { lastPulls = G.buyCards(+d.n); if (lastPulls.length) G.sfx('win'); }, cardSlot: () => G.buyCardSlot(),
        toggleCard: (d) => G.toggleCard(d.id), preset: (d) => G.usePreset(+d.i), mastery: (d) => G.buyMastery(d.id),
        // uw
        uwBuy: (d) => G.uwBuy(d.id), uwReroll: () => G.uwReroll(), uwUp: (d) => G.uwUp(d.id, +d.i), uwPlusBuy: (d) => G.uwPlusBuy(d.id), uwPlusUp: (d) => G.uwPlusUp(d.id),
        // modules
        modView: (d) => { modView = d.v; }, modFilter: (d) => { modFilter = d.v; }, modSel: (d) => { modSel = d.uid ? +d.uid : null; },
        pullMod: (d) => { lastPulls = G.buyModules(+d.n); if (lastPulls.length) G.sfx('win'); },
        slotUp: (d) => G.slotUp(d.t, +d.n), slotRestore: (d) => { if (confirm('Restore this slot to level 0? All shards and coins come back.')) G.slotRestore(d.t); },
        modEquip: (d) => G.modEquip(+d.uid), modReroll: (d) => G.reroll(+d.uid), modLock: (d) => G.toggleLock(+d.uid, +d.i), modMerge: (d) => G.merge(+d.uid),
        modFav: (d) => { const m = G.modById(+d.uid); if (m) { m.fav = !m.fav; G.saveSoon(); } }, modShatter: (d) => { G.shatter(+d.uid); modSel = null; },
        modUnmerge: (d) => G.unmerge(+d.uid), shatterAll: (d) => { const n = G.shatterAll(d.r); G.toast(`Shattered ${n} modules`, 'good'); },
        // bots
        botBuy: (d) => G.botBuy(d.id), botPlusBuy: (d) => G.botPlusBuy(d.id), botPlusUp: (d) => G.botPlusUp(d.id), botUp: (d) => G.botUp(d.id, +d.i), botToggle: (d) => { S().bots.on[d.id] = S().bots.on[d.id] === false; G.saveSoon(); },
        // guild
        joinGuild: (d) => { const g = G.guildList().find(x => x.id === d.id); if (g) G.joinGuild(g, false); },
        createGuild: () => { const name = prompt('Guild name (3-20 characters)', 'My Guild'); if (name && name.length >= 3) G.joinGuild({ id: 'own' + Date.now(), name: name.slice(0, 20), size: 12, act: 0.7 }, true); },
        leaveGuild: () => { if (confirm('Leave your guild? You keep the guardian but it won\'t fight until you join another.')) G.leaveGuild(); },
        claimChest: (d) => G.claimChest(+d.i), unlockGuardian: () => G.unlockGuardian(), guardianSlot: () => G.buyGuardianSlot(),
        toggleChip: (d) => G.toggleChip(d.id), chipUp: (d) => G.chipUp(d.id, +d.i), storeBuy: (d) => G.storeBuy(d.k, d.a),
        // missions & milestones
        claimDaily: (d) => G.claimDaily(d.id), rerollDaily: (d) => G.rerollDaily(d.id), claimBox: () => G.claimBox(),
        msTier: (d) => { msTier = G.clamp(msTier + +d.d, 1, Math.min(24, S().maxTier)); },
        claimMs: (d) => G.claimMilestone(+d.t, +d.w, !!d.p), claimAllMs: () => G.claimAllMilestones(), buyPass: (d) => G.buyPass(+d.p),
        // events
        claimEv: (d) => { const m = D.EVENT_MISSIONS.find(x => x.text === d.t); if (m) G.claimEventTier(m, +d.i); }, eventBoost: () => G.buyEventBoost(),
        trade: (d) => G.eventTrade(d.k, d.t), evTheme: (d) => G.buyEventTheme(d.bg === '1'), song: (d) => G.buySong(d.id), gemRelic: (d) => G.buyGemRelic(d.id),
        // tournament
        enterTour: () => { if (G.enterTournament()) { UI.closeMenu(); G.main.startRun({ tour: true }); } }, buyTicket: (d) => G.buyTicket(!!d.ad),
        // relics & vault
        relicShow: (d) => { relicShow = d.v; },
        equipSkin: (d) => { S().skins.eq = d.id; G.saveSoon(); }, vaultSec: (d) => { const sec = D.VAULT.find(x => x.sec === d.s); if (sec) G.vaultOpenSec(sec); }, vaultBuy: (d) => G.vaultBuy(d.id),
        // free gems
        dailyGems: () => G.claimDailyGems(), adGems: () => G.claimAdGems(), coinBoost: () => G.addCoinBoost(),
        // autopilot & perks
        apBuy: (d) => G.apBuy(d.id), apToggle: (d) => { S().ap.on[d.id] = !G.apOn(d.id); G.saveSoon(); UI.renderSide(true); },
        apCat: (d) => { S().ap.cats[d.c] = !S().ap.cats[d.c]; }, apSkip: (d) => { S().ap.skip[d.id] = !S().ap.skip[d.id]; },
        perkAuto: () => { S().perks.auto = !S().perks.auto; }, firstPerk: (d) => { S().perks.first = d.id; },
        rankPerk: (d) => { const r = S().perks.rank, i = r.indexOf(d.id); if (i >= 0) r.splice(i, 1); else if (r.length < G.labV('Auto_Pick_Ranking')) r.push(d.id); },
        banPerk: (d) => { if (G.run()) { G.toast('Bans can\'t change during a run', 'bad'); return; } const b = S().perks.bans, i = b.indexOf(d.id); if (i >= 0) b.splice(i, 1); else if (b.length < G.labV('Ban_Perks')) b.push(d.id); },
        // settings
        saveName: () => { const v = $('nameIn').value.trim().slice(0, 16); if (v) { S().name = v; G.saveSoon(); G.toast('Saved', 'good'); } },
        toggleSet: (d) => { S().settings[d.k] = !S().settings[d.k]; G.saveSoon(); }, target: (d) => { S().settings.target = d.t; G.saveSoon(); },
        exportSave: () => { const txt = btoa(unescape(encodeURIComponent(JSON.stringify(S())))); navigator.clipboard && navigator.clipboard.writeText(txt); prompt('Your save (copied to the clipboard if allowed):', txt); },
        importSave: () => { const txt = prompt('Paste a save:'); if (!txt) return; try { const o = JSON.parse(decodeURIComponent(escape(atob(txt.trim())))); localStorage.setItem(G.KEY, JSON.stringify(o)); location.reload(); } catch (e) { G.toast('That save could not be read', 'bad'); } },
        resetSave: () => { if (confirm('Delete ALL progress in The Tower? This cannot be undone.')) G.reset(); },
    };
    function fire(act, data, el) {
        const fn = A[act];
        if (!fn) return;
        fn(data, el);
        G.saveSoon();
        UI.tick(true);
    }
    // Panels with timers re-render every second. A button replaced between press and release would lose its
    // click, so remember what was pressed and fire on release (unless the pointer moved, e.g. to scroll).
    let pressed = null, skipClick = false;
    document.addEventListener('pointerdown', (e) => {
        const el = e.target.closest('[data-act]');
        pressed = el && !el.disabled && e.button === 0 ? { act: el.dataset.act, data: Object.assign({}, el.dataset), x: e.clientX, y: e.clientY, t: performance.now(), el } : null;
    });
    document.addEventListener('pointerup', (e) => {
        const p = pressed;
        pressed = null;
        if (!p || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 12 || performance.now() - p.t > 900) return;
        const el = e.target.closest('[data-act]');
        if (el && el !== p.el && (el.dataset.act !== p.act || el.disabled)) return;
        if (!el && p.el.isConnected) return;
        skipClick = true;
        setTimeout(() => { skipClick = false; }, 400);
        fire(p.act, p.data, el || p.el);
    });
    // keyboard activation (Enter / Space) still arrives as a plain click
    document.addEventListener('click', (e) => {
        if (skipClick) { skipClick = false; return; }
        const el = e.target.closest('[data-act]');
        if (!el || el.disabled) return;
        fire(el.dataset.act, el.dataset, el);
    });

    /* ======================================================================
       TICK
       ====================================================================== */
    let lastMenuT = 0;
    UI.tick = (force) => {
        topStats();
        rail();
        hud();
        UI.renderSide(force);
        const now = performance.now();
        if (menuTab && (force || now - lastMenuT > 1000)) { lastMenuT = now; UI.renderMenu(force); }
    };
})();
