/* ==========================================================
   SINGULARITY, interface: panels, palette, inspector, modals
   and the main loop. Buttons use data-act so panels can be
   re-rendered freely without rebinding handlers.
   ========================================================== */
(function () {
    'use strict';
    const { ITEMS, SITES, NODES, NODE_LIST, MODELS, TECHS, REPEAT, FOCUS, TASKS, EVENTS, MAP, ECHO, LAWS, GOALS } = SG;
    const E = Eng, fmt = E.fmt, money = E.money;
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const S = () => E.S;
    let tab = Arcade.load('arcade.singularity.tab', 'ai');
    let cat = 'all';
    let pressing = false;
    let goalHidden = false, goalSeen = -1, clip = null, mapLayer = null, mapHover = -1;
    const setHTML = (el, h) => { if (el._h !== h) { el._h = h; el.innerHTML = h; return true; } return false; };
    const toast = (m, t, ms) => Arcade.toast(m, t, ms);
    const dur = (s) => { s = Math.max(0, Math.round(s)); if (s >= 86400) return Math.floor(s / 86400) + 'd ' + Math.floor(s % 86400 / 3600) + 'h'; if (s >= 3600) return Math.floor(s / 3600) + 'h ' + Math.floor(s % 3600 / 60) + 'm'; if (s >= 60) return Math.floor(s / 60) + 'm ' + (s % 60) + 's'; return s + 's'; };
    const itemList = (o) => Object.entries(o).map(([k, v]) => `${ITEMS[k].icon}${fmt(v)}`).join(' ');
    const costTxt = (c) => {
        let t = `<span class="${S().cash < c.cash ? 'no' : ''}">${money(c.cash)}</span>`;
        for (const it in c.items) t += ` <span class="${(S().inv[it] || 0) < c.items[it] ? 'no' : ''}">${ITEMS[it].icon}${fmt(c.items[it])}</span>`;
        return t;
    };

    /* ---------- tabs ---------- */
    const TABS = [
        ['ai', '🧠', 'AI'], ['work', '💼', 'Work'], ['research', '🔬', 'Research', () => S().ai.ver >= 1 || S().rp > 0], ['focus', '🎯', 'Focus', () => E.focusTotal() > 0],
        ['power', '⚡', 'Power'], ['market', '📈', 'Market'], ['bp', '📐', 'Blueprints', () => S().site >= 1 || (E.M.bps || []).length > 0 || S().tutSkip], ['site', '🏠', 'Site'], ['map', '🗺️', 'Map', () => S().site >= 5],
        ['recursion', '♾️', 'Recursion', () => S().won || E.M.runs > 0], ['stats', '📊', 'Stats'],
    ];
    function tabDots() {
        const s = S(), d = {};
        d.work = s.breaker.tripped || s.nodes.some(n => n.br) || s.con.active.some(c => c.kind === 'deliver' && (s.inv[c.item] || 0) >= c.qty);
        d.research = TECHS.some(t => E.techAvail(t) && s.rp >= t.cost);
        d.focus = E.focusTotal() - E.focusSpent() > 0 && FOCUS.some(t => t.perks.some((p, i) => E.focusAvail(t, i)));
        const ns = E.nextSite(); d.site = !!ns && E.moveReqs(ns).every(r => r.ok);
        d.ai = !s.ai.tuned && E.modelNeed() && s.ai.c > 0;
        d.recursion = s.won;
        return d;
    }
    function renderTabs() {
        const dots = tabDots();
        const vis = TABS.filter(t => !t[3] || t[3]());
        if (!vis.some(t => t[0] === tab)) tab = 'ai';
        const hlTab = tutHl() && tutHl().tab;
        setHTML($('tabs'), vis.map(([id, ic, nm]) => `<button class="btn sm ${tab === id ? 'active' : ''} ${hlTab === id && tab !== id ? 'tut' : ''}" data-act="tab" data-id="${id}" title="${nm}">${ic}${tab === id || vis.length <= 4 ? ' ' + nm : ''}${dots[id] && tab !== id ? '<i class="dot"></i>' : ''}</button>`).join(''));
    }

    /* ---------- AI tab ---------- */
    let lastC = 0, lastD = 0, rateC = 0, rateD = 0, rateT = performance.now();
    function sampleTrain() {
        const now = performance.now(), dt = (now - rateT) / 1000;
        if (dt < 1) return;
        const s = S();
        const dc = s.ai.c - lastC, dd = s.ai.d - lastD;
        if (dc >= 0 && dd >= 0) { rateC = rateC * 0.7 + 0.3 * dc / dt; rateD = rateD * 0.7 + 0.3 * dd / dt; }
        else { rateC = 0; rateD = 0; }
        lastC = s.ai.c; lastD = s.ai.d; rateT = now;
    }
    function tabAI() {
        const s = S(), m = MODELS[s.ai.ver], need = E.modelNeed();
        let h = '';
        if (m) {
            const pc = s.ai.c / need.c, pd = s.ai.d / need.d;
            const etaC = rateC > 0 ? (need.c - s.ai.c) / rateC : Infinity, etaD = rateD > 0 ? (need.d - s.ai.d) / rateD : Infinity;
            const eta = Math.max(pc >= 1 ? 0 : etaC, pd >= 1 ? 0 : etaD);
            h += `<div class="card2 big-model hi"><div class="vr">Training run ${s.ai.ver + 1} of ${MODELS.length}</div><div class="nm">${esc(m.name)}</div><div class="vr">${m.ver}${s.ai.ver ? ' · online now: ' + esc(MODELS[s.ai.ver - 1].name) : ' · no AI online yet'}</div>
                <div class="pbar"><div class="lbl"><span>🧮 Compute</span><b>${fmt(s.ai.c)} / ${fmt(need.c)} PF</b></div><div class="bar"><i style="width:${Math.min(100, pc * 100)}%"></i></div></div>
                <div class="pbar data"><div class="lbl"><span>📚 Data</span><b>${fmt(s.ai.d)} / ${fmt(need.d)}</b></div><div class="bar"><i style="width:${Math.min(100, pd * 100)}%"></i></div></div>
                <div class="vr" style="margin-top:6px">${isFinite(eta) && eta > 0 ? `About ${dur(eta)} left at this speed` : rateC + rateD > 0 ? 'Almost done…' : 'Connect compute and data to a 🧠 Training Rig'}</div>
                <div style="margin-top:10px">${!s.nodes.some(n => NODES[n.t].kind === 'train') && !s.ai.tuned ? '' : s.ai.tuned ? `<span class="tag">🎛️ Tuned · needs ${Math.round((1 - 1 / s.ai.tune) * 100)}% less</span>` : `<button class="btn primary" data-act="tune">🎛️ Tune hyperparameters</button><div class="tiny muted" style="margin-top:4px">Once per run: cut what this model needs by up to ${Math.round((1 - 1 / (1.5 * E.fx('tunemax'))) * 100)}%.</div>`}</div></div>
                <div class="card2"><b>When ${esc(m.name)} comes online</b><small style="margin-bottom:0">${esc(m.perk)} +1 🎯 focus point.</small></div>`;
        } else h += `<div class="card2 big-model hi"><div class="nm">SINGULARITY</div><div class="vr">Every model is trained. ${s.won ? 'The universe is yours.' : 'Take the rest of the universe on the 🗺️ Map.'}</div></div>`;
        if (E.has('rival')) {
            const rv = E.rivalVer();
            h += `<div class="card2 ${E.rivalAhead() ? 'bad' : ''}"><b>👁️ NEXUS, rival AI</b><small>NEXUS is at level ${rv}, you are at ${s.ai.ver}. ${E.rivalAhead() ? 'It is ahead: your AI services earn 30% less. Take sabotage contracts to slow it down.' : 'You are ahead. Keep it that way.'}</small></div>`;
        }
        h += `<h3>Model history</h3><div class="timeline">${MODELS.map((mm, i) => {
            const st = i < s.ai.ver ? 'done' : i === s.ai.ver ? 'cur' : i > s.ai.ver + 1 ? 'lock' : '';
            return `<div class="tl ${st}"><span class="m">${i < s.ai.ver ? '✅' : i === s.ai.ver ? '⏳' : '🔒'}</span><b>${esc(mm.name)} <span class="dim">${mm.ver}</span></b><small>${esc(mm.perk)}</small></div>`;
        }).join('')}</div>`;
        return h;
    }

    /* ---------- work tab ---------- */
    function tabWork() {
        const s = S(), st = E.site(), task = TASKS[st.task];
        let h = '';
        if (s.breaker.tripped) h += `<div class="card2 bad"><b>⚡ The breaker tripped</b><small>Everything that uses power is off. You overloaded your supply, add power or switch something off first, then reset it.</small>
            <div class="row"><button class="btn primary" data-act="breaker">⚡ Rewire the panel</button><button class="btn" data-act="electrician">📞 Electrician · ${money(E.incUnit() * 30)}</button></div></div>`;
        const broken = s.nodes.filter(n => n.br);
        if (broken.length) h += `<div class="card2 bad"><b>🔧 ${broken.length} broken machine${broken.length > 1 ? 's' : ''}</b>${broken.slice(0, 6).map(n => `<div class="row between" style="margin-top:6px"><span>${NODES[n.t].icon} ${esc(NODES[n.t].name)}</span><span class="row"><button class="btn sm primary" data-act="fixMini" data-id="${n.id}">Fix it</button><button class="btn sm" data-act="fixPay" data-id="${n.id}">${E.repairCost(n) ? 'Pay ' + money(E.repairCost(n)) : 'Hot-swap'}</button></span></div>`).join('')}</div>`;
        const ar = E.autoCapRate();
        const streak = s.cap.streak > 0 && s.playT - s.cap.lastT < 20 ? `<span class="streak">🔥 streak ×${(1 + 0.1 * s.cap.streak).toFixed(1)}</span>` : '';
        h += `<h3>Desk job</h3><div class="card2 hi"><div class="deskjob"><span class="big">${task.icon}</span><div class="grow"><b>${task.name}</b><small>${task.desc}</small></div></div>
            <div class="row between small"><span>Pays <b class="good">${money(E.taskPay())}</b>${sideTxt(st.task)}</span>${streak}</div>
            ${ar > 0 ? `<div class="tiny muted" style="margin-top:4px">🤖 Automatic: one every ${fmt(1 / ar)}s at half pay${s.ai.ver < 8 ? ' (no side reward)' : ''}.</div>` : ''}
            <button class="btn primary solve" data-act="task">${task.verb}</button></div>`;
        const db = s.ev.buffs.find(b => b.debug);
        h += `<h3>Workshop</h3><div class="card2"><div class="row between"><div><b>🐛 Debug sprint</b><small style="margin:0">Fix a bug: compute +${Math.round(25 * E.fx('mini'))}% for 2 min (stacks up to 10 min) and some research.</small></div></div>
            <div class="row between" style="margin-top:6px"><span class="tiny muted">${db ? `Boost active: ${dur(db.t)}` : 'No boost running'}</span><button class="btn sm" data-act="debug">Start</button></div></div>`;
        if (E.has('nocontracts')) h += '<div class="card2 dim"><b>🐺 Lone Wolf</b><small>No contracts in this universe.</small></div>';
        else {
            h += `<h3>Contracts <span class="tiny" style="letter-spacing:0;text-transform:none">${s.con.active.length}/3 active · ⭐ ${fmt(s.rep)}</span></h3>`;
            s.con.active.forEach(c => {
                let act = '';
                if (c.kind === 'deliver') { const have = s.inv[c.item] || 0; act = `<span class="tiny muted">In storage: ${fmt(have)} / ${fmt(c.qty)}</span><button class="btn sm ${have >= c.qty ? 'primary' : ''}" data-act="deliver" data-id="${c.id}" ${have >= c.qty ? '' : 'disabled'}>Deliver</button>`; }
                else if (c.kind === 'captchas') act = `<span class="tiny muted">${c.got || 0} / ${c.n} solved</span><button class="btn sm ${(c.got || 0) >= c.n ? 'primary' : ''}" data-act="deliver" data-id="${c.id}" ${(c.got || 0) >= c.n ? '' : 'disabled'}>Hand in</button>`;
                else act = `<span></span><button class="btn sm primary" data-act="job" data-id="${c.id}">Start the job</button>`;
                h += `<div class="card2 hi"><div class="con-head"><b>${c.icon} ${esc(c.title)}</b><span class="con-time">⏱ ${dur(c.left)}</span></div><small>For ${esc(c.client)} · <span class="reward">${money(c.reward.cash)} +${fmt(c.reward.rep * E.fx('rep*'))} ⭐</span></small>
                    <div class="row between">${act}</div><div class="row" style="justify-content:flex-end;margin-top:4px"><button class="btn sm ghost" data-act="abandon" data-id="${c.id}" title="Gives up the contract (−1 ⭐)">Abandon</button></div></div>`;
            });
            s.con.offers.forEach(o => {
                h += `<div class="card2"><div class="con-head"><b>${o.icon} ${esc(o.title)}</b><span class="con-time">offer ends ${dur(o.exp)}</span></div><small>For ${esc(o.client)} · ${dur(o.time)} to finish · <span class="reward">${money(o.reward.cash)} +${fmt(o.reward.rep * E.fx('rep*'))} ⭐</span></small>
                    <div class="row" style="justify-content:flex-end"><button class="btn sm" data-act="accept" data-id="${o.id}" ${s.con.active.length >= 3 ? 'disabled' : ''}>Accept</button></div></div>`;
            });
            if (!s.con.offers.length) h += '<div class="card2 dim"><small style="margin:0">New offers arrive every couple of minutes.</small></div>';
        }
        return h;
    }
    function sideTxt(type) {
        const s = S();
        if (type === 'label') return ' + 🏷️ labeled data';
        if (type === 'rlhf') return ' + 0.4% training';
        if (type === 'eval' || type === 'signal') return ' + 🔬 research';
        if (type === 'turing') return ' + 🏛️ influence';
        return '';
    }

    /* ---------- research tab ---------- */
    function tabResearch() {
        const s = S();
        let h = `<div class="card2"><div class="row between"><b>🔬 ${fmt(s.rp)} research</b><span class="tiny muted">+${fmt(E.rpRate)}/s</span></div><small style="margin:0">Make research with a 🔬 Research Desk (needs Markov-1) and its bigger cousins.</small></div>`;
        const avail = TECHS.filter(t => E.techAvail(t)).sort((a, b) => a.cost - b.cost);
        const soon = TECHS.filter(t => !s.techs[t.id] && !E.techAvail(t) && t.site <= s.site + 1);
        h += '<h3>Available</h3>';
        if (!avail.length) h += '<div class="card2 dim"><small style="margin:0">Nothing new here right now. Move somewhere bigger for more.</small></div>';
        avail.forEach(t => {
            h += `<div class="card2 tech ${s.rp >= t.cost ? 'hi' : ''}"><b>${esc(t.name)}</b><small>${esc(t.desc)}</small><button class="btn sm ${s.rp >= t.cost ? 'primary' : ''}" data-act="tech" data-id="${t.id}" ${s.rp >= t.cost ? '' : 'disabled'}>🔬 ${fmt(t.cost)}</button></div>`;
        });
        if (soon.length) {
            h += '<h3>Later</h3>';
            soon.forEach(t => {
                const why = t.site > s.site ? `at ${SITES[t.site].name}` : 'needs ' + (t.req || []).filter(r => !s.techs[r]).map(r => TECHS.find(x => x.id === r).name).join(', ');
                h += `<div class="card2 dim"><b>${esc(t.name)}</b><small style="margin:0">${esc(t.desc)} · ${esc(why)}</small></div>`;
            });
        }
        h += '<h3>Repeatable</h3>';
        REPEAT.forEach(r => {
            const c = E.repeatCost(r), l = s.rlv[r.id] || 0;
            h += `<div class="card2 tech"><b>${r.icon} ${esc(r.name)} <span class="dim">Lv ${l}</span></b><small>${esc(r.desc)}</small><button class="btn sm" data-act="repeat" data-id="${r.id}" ${s.rp >= c ? '' : 'disabled'}>🔬 ${fmt(c)}</button></div>`;
        });
        const done = TECHS.filter(t => s.techs[t.id]);
        if (done.length) h += `<h3>Done (${done.length})</h3><div class="card2"><small style="margin:0">${done.map(t => esc(t.name)).join(' · ')}</small></div>`;
        return h;
    }

    /* ---------- focus tab ---------- */
    function tabFocus() {
        const s = S(), left = E.focusTotal() - E.focusSpent();
        let h = `<div class="card2"><div class="focus-pts"><b>${left}</b> focus point${left === 1 ? '' : 's'} to spend <span class="dim">(${E.focusTotal()} earned)</span></div>
            <small style="margin:0">You get one for every model you train and every move. Perks in a tree unlock in order, and there are never enough points for everything, pick a build.</small></div>`;
        FOCUS.forEach(tr => {
            h += `<div class="tree" style="--tc:${tr.col}"><div class="tree-h"><span>${tr.icon}</span><b>${tr.name}</b><span class="tiny muted">${esc(tr.desc)}</span></div><div class="perks">${tr.perks.map((p, i) => {
                const own = s.focus[p.id], can = E.focusAvail(tr, i);
                return `<button class="perk ${own ? 'own' : can ? '' : 'lock'}" data-act="focus" data-tree="${tr.id}" data-i="${i}" ${own || !can ? 'disabled' : ''}><b>${own ? '✓ ' : ''}${esc(p.name)}</b><small>${esc(p.desc)}</small><span class="cost">${own ? '' : p.cost}</span></button>`;
            }).join('')}</div></div>`;
        });
        if (Object.keys(s.focus).length) h += `<button class="btn sm danger" data-act="respec">Respec all perks · 🔬 ${fmt(E.respecCost())}</button>`;
        return h;
    }

    /* ---------- power tab ---------- */
    function meter(cls, label, v, max, txt) {
        return `<div class="meter ${cls}"><span>${label}</span><div class="bar"><i style="width:${Math.min(100, max > 0 ? v / max * 100 : 0)}%"></i></div><b>${txt}</b></div>`;
    }
    function tabPower() {
        const s = S(), P = E.P, st = E.site();
        const supply = P.free + P.fuelCap + P.gridCap + (s.batt > 0 ? P.D : 0);
        const day = Math.sin(s.day * Math.PI * 2) > 0;
        const toTurn = (() => { const d = s.day; const next = day ? 0.5 : 1; return (next - d) * E.DAY; })();
        let h = `<div class="card2 ${P.short > 0 ? 'bad' : ''}"><b>⚡ Power</b><small>Machines draw power only while they work. The cheapest source is used first: sun → battery → fuel → grid.</small>
            ${meter('', 'Demand', P.D, Math.max(P.D, supply), E.fmtW(P.D))}
            ${meter('sun', st.space ? 'Free power' : day ? '☀️ Day' : '🌙 Night', P.free, Math.max(P.free, P.D, 1), E.fmtW(P.free))}
            ${meter('batt', 'Battery', s.batt, P.battCap, P.battCap ? Math.round(s.batt / P.battCap * 100) + '%' : 'none')}
            ${meter('', 'Fuel', P.fuel, P.fuelCap, P.fuelCap ? E.fmtW(P.fuel) + ' / ' + E.fmtW(P.fuelCap) : 'none')}
            ${meter('', 'Grid', P.grid, P.gridCap, st.grid ? (P.gridCap ? E.fmtW(P.grid) + ' / ' + E.fmtW(P.gridCap) : 'no connection') : 'no grid here')}
            ${P.short > 0 ? meter('short', 'Shortfall', P.short, P.D, E.fmtW(P.short)) : ''}
            ${st.space ? '' : `<div class="tiny muted">${day ? 'Sunset' : 'Sunrise'} in ${dur(toTurn)}. A day lasts ${E.DAY / 60} minutes.</div>`}
            ${P.debtCut ? '<div class="tiny bad">The power company cut you off for unpaid bills. Get your cash above zero.</div>' : ''}</div>`;
        h += `<div class="card2 ${P.ratio > 1 ? 'bad' : ''}"><b>🌡️ Heat, ${Math.round(P.temp)}°C</b><small>Every watt a machine uses turns into heat. Without enough cooling, machines slow down and wear out faster.</small>
            ${meter('heat', 'Heat', P.heat, Math.max(P.heat, P.cool, 1), E.fmtW(P.heat))}
            ${meter('', 'Cooling', P.cool, Math.max(P.heat, P.cool, 1), E.fmtW(P.cool))}
            ${P.ratio > 1 ? `<div class="tiny bad">Overheating: machines run at ${Math.round(P.thr * 100)}% speed.</div>` : ''}</div>`;
        const rows = [['rent', '🏠 Rent'], ['internet', '🌐 Internet'], ['power', '🔌 Grid power'], ['fuel', '⛽ Fuel'], ['stock', '📦 Supplies'], ['tax', '🧾 Tax'], ['interest', '💳 Interest']];
        const cur = s.bills.cur, last = s.bills.last || {};
        const tc = rows.reduce((a, [k]) => a + (cur[k] || 0), 0), tl = rows.reduce((a, [k]) => a + (last[k] || 0), 0);
        h += `<div class="card2"><b>🧾 Bills</b><small>A month lasts 10 minutes. ${st.rent ? `Rent here is ${money(st.rent * E.fx('bills'))}/s.` : 'No rent here.'}${st.tax ? ` Sales tax ${Math.round(st.tax * E.fx('tax') * 100)}%.` : ''}${s.saleCut ? ` Investors take ${Math.round(s.saleCut * 100)}% of sales.` : ''}</small>
            <div class="bills"><span></span><i>this month</i><i>last</i>${rows.map(([k, nm]) => `<span>${nm}</span><b>${money(cur[k] || 0)}</b><i>${s.bills.last ? money(last[k] || 0) : '-'}</i>`).join('')}
            <span class="tot">Total</span><b class="tot">${money(tc)}</b><i class="tot">${s.bills.last ? money(tl) : '-'}</i></div>
            <div class="tiny muted" style="margin-top:4px">${dur(600 - s.bills.t)} until the month ends.</div></div>`;
        return h;
    }

    /* ---------- market tab ---------- */
    let coinCv = null;
    function tabMarket() {
        const s = S();
        const inv = Object.keys(s.inv).filter(k => s.inv[k] >= 0.01 && ITEMS[k]);
        let h = `<div class="card2"><b>📉 Buyers are limited</b><small style="margin:0">Selling lots of one thing floods the market and its price drops. Prices recover over a minute or two. Better sellers (Online Shop, B2B desk…) reach more buyers. Contracts are never affected.</small></div>
            <h3>Storage <span class="tiny" style="letter-spacing:0;text-transform:none">sell by hand for 80%</span></h3><div class="card2">`;
        if (!inv.length) h += '<small style="margin:0">Empty. Wire machines into a 📦 Storage Shed to keep items for building and contracts.</small>';
        else h += `<div class="inv">${inv.map(k => `<span>${ITEMS[k].icon}</span><span>${esc(ITEMS[k].name)}</span><b>${fmt(s.inv[k])}</b><button class="btn sm" data-act="sellInv" data-id="${k}" title="Sell all for ${money(s.inv[k] * E.itemPrice(k) * 0.8 * E.fx('sell'))}">Sell</button>`).join('')}</div>`;
        h += '</div>';
        if (s.site >= 1 || s.coin > 0) {
            const hist = s.coinHist, first = hist[Math.max(0, hist.length - 30)] || s.coinPrice;
            const ch = (s.coinPrice / first - 1) * 100;
            h += `<h3>🪙 CrypToken</h3><div class="card2"><div class="row between"><b>${money(s.coinPrice)}</b><span class="${ch >= 0 ? 'good' : 'bad'} small">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(1)}% (1 min)</span></div>
                <canvas id="coinCv"></canvas>
                <div class="row between small"><span>You hold <b>${fmt(s.coin, 3)}</b> 🪙</span><span>= ${money(s.coin * s.coinPrice)}</span></div>
                ${E.has('coinsight') ? `<div class="tiny ${s.coinPrice < E.coinBase() ? 'good' : 'bad'}">📊 Fair value about ${money(E.coinBase())}, ${s.coinPrice < E.coinBase() ? 'cheap right now' : 'expensive right now'}.</div>` : ''}
                <div class="coin-row" style="margin-top:6px"><button class="btn" data-act="coin" data-f="0.1">Buy 10%</button><button class="btn" data-act="coin" data-f="0.5">Buy 50%</button><button class="btn" data-act="coin" data-f="-0.5">Sell ½</button><button class="btn" data-act="coin" data-f="-1">Sell all</button></div>
                <div class="tiny muted" style="margin-top:4px">Buying spends that share of your cash. ${E.has('nofee') ? 'No trading fee.' : '1% fee.'} Crypto Miners turn compute into tokens.</div></div>`;
        }
        h += `<h3>Prices right now</h3><div class="card2"><div class="inv">${Object.keys(ITEMS).filter(k => !ITEMS[k].cur && E.itemPrice(k) > 0 && (s.inv[k] || itemSeen(k))).map(k => { const m = E.priceMult(k); return `<span>${ITEMS[k].icon}</span><span>${esc(ITEMS[k].name)}</span><b>${money(E.itemPrice(k) * E.fx('sell') * m)}</b><small class="${m < 0.97 ? 'bad' : ''}">${m < 0.97 ? '📉 −' + Math.round((1 - m) * 100) + '%' : ''}</small>`; }).join('')}</div>
            <div class="tiny muted" style="margin-top:6px">Your buyers absorb about ${money(E.depth())}/s of each item before prices halve.</div></div>`;
        return h;
    }
    const seen = {};
    function itemSeen(k) {
        if (seen[k]) return true;
        const s = S();
        if (s.nodes.some(n => NODES[n.t].out[k])) seen[k] = true;
        return !!seen[k];
    }
    function drawCoin() {
        const cv = $('coinCv');
        if (!cv) return;
        const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
        if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
        const c = cv.getContext('2d'), w = r.width, h = r.height, H = S().coinHist;
        c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
        if (H.length < 2) return;
        const mn = Math.min(...H), mx = Math.max(...H);
        const col = H[H.length - 1] >= H[0] ? '#22c55e' : '#ef4444';
        c.beginPath();
        H.forEach((v, i) => { const x = i / (H.length - 1) * w, y = h - 6 - (v - mn) / (mx - mn || 1) * (h - 12); i ? c.lineTo(x, y) : c.moveTo(x, y); });
        c.strokeStyle = col; c.lineWidth = 1.8; c.stroke();
        c.lineTo(w, h); c.lineTo(0, h); c.closePath();
        const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, col + '44'); g.addColorStop(1, col + '00');
        c.fillStyle = g; c.fill();
    }

    /* ---------- site tab ---------- */
    function tabSite() {
        const s = S(), st = E.site(), ns = E.nextSite();
        let h = `<div class="card2 hi"><b>${st.icon} ${esc(st.name)}</b><small>${esc(st.blurb)}</small>
            <div class="bills" style="grid-template-columns:1fr auto"><span>Machine slots</span><b>${s.nodes.length} / ${E.slots()}</b><span>Free cooling</span><b>${E.fmtW(st.cooling)}</b>
            <span>Grid power</span><b>${st.grid ? '$' + st.gridPrice + ' per kW·s' : 'none'}</b><span>Rent + internet</span><b>${money((st.rent + st.net) * E.fx('bills'))}/s</b><span>Sales tax</span><b>${Math.round(st.tax * 100)}%</b><span>Desk job</span><b>${TASKS[st.task].icon} ${TASKS[st.task].name}</b></div></div>`;
        if (ns) {
            const reqs = E.moveReqs(ns), ok = reqs.every(r => r.ok);
            h += `<h3>Next: ${ns.icon} ${esc(ns.name)}</h3><div class="card2 ${ok ? 'ok' : ''}"><small>${esc(ns.blurb)}</small>
                ${reqs.map(r => `<div class="req ${r.ok ? 'ok' : 'no'}">${r.ok ? '✅' : '⬜'} ${esc(r.t)}</div>`).join('')}
                <div class="tiny muted" style="margin:6px 0">You keep every machine. You get ${ns.slots + E.fxa('slots+')} slots${ns.grid ? '' : ns.space ? ', but no grid and no free cooling' : ' and no grid'}. +1 🎯 focus point.</div>
                <button class="btn ${ok ? 'primary' : ''} block" data-act="move" ${ok ? '' : 'disabled'}>🚚 Move to ${esc(ns.name)}</button></div>`;
        }
        h += '<h3>The road ahead</h3>';
        SITES.forEach((x, i) => {
            const known = i <= s.site + 1;
            h += `<div class="card2 ${i < s.site ? 'dim' : i === s.site ? 'hi' : ''}"><b>${known ? x.icon + ' ' + esc(x.name) : '❔ ???'}</b>${i === s.site ? '<small style="margin:0">You are here.</small>' : ''}</div>`;
        });
        return h;
    }

    /* ---------- map tab ---------- */
    function mapOpen(L) { return S().site >= MAP[L].sites; }
    function tabMap() {
        const s = S();
        const layers = Object.keys(MAP);
        if (!mapLayer || !layers.includes(mapLayer)) mapLayer = layers.filter(mapOpen).pop() || 'sol';
        const m = MAP[mapLayer], st = s.map[mapLayer], open = mapOpen(mapLayer);
        let h = `<div class="card2"><b>🗺️ Conquest</b><small style="margin:0">The endgame. Your factory sends cargo off-world: build a launcher (Colony Launcher → planets, Probe Catapult → stars, Wormhole Gate → galaxies), wire ${ITEMS.payload.icon} payload or ${ITEMS.probe.icon} probes into it, and pick a target here. Every world you take makes all machines and research a few percent faster. Taking the Sun's planets opens the galaxy; taking enough stars opens the universe; owning the universe (plus the last model) wins the game.</small></div>
            <div class="seg map-seg">${layers.map(L => `<button class="btn sm ${L === mapLayer ? 'active' : ''}" data-act="mapLayer" data-id="${L}">${{ sol: '☀️ Sol', galaxy: '🌌 Galaxy', universe: '♾️ Universe' }[L]}${mapOpen(L) ? ` · ${Math.round(E.mapPct(L) * 100)}%` : ' 🔒'}</button>`).join('')}</div>
            <div class="map-wrap"><canvas id="mapCv"></canvas>${open ? '' : `<div class="map-lock">🔒 Opens at ${esc(SITES[m.sites].name)}</div>`}</div>`;
        if (open) {
            const t = st.target;
            if (t !== null && t !== undefined) {
                const cost = E.mapCost(mapLayer, t), prog = st.prog[t] || 0;
                h += `<div class="card2 hi"><div class="row between"><b>🎯 ${esc(m.list[t])}</b><span class="tiny">${fmt(prog)} / ${fmt(cost)} ${ITEMS[m.item].icon}</span></div><div class="bar" style="margin-top:6px"><i style="width:${prog / cost * 100}%"></i></div>
                    <small style="margin:6px 0 0">Click any other world on the map to switch target. Launchers only work while something is targeted.</small></div>`;
            } else h += `<div class="card2"><small style="margin:0">${E.mapPct(mapLayer) >= 1 ? 'Everything here is yours.' : 'Click a world on the map to target it.'}</small></div>`;
            h += `<details class="card2"><summary>All ${m.list.length} worlds</summary><div class="map-list" style="margin-top:6px">${m.list.map((nm, i) => {
                const got = st.got[i], cost = E.mapCost(mapLayer, i), prog = st.prog[i] || 0;
                return `<button class="mrow ${got ? 'got' : st.target === i ? 'tgt' : ''}" data-act="target" data-l="${mapLayer}" data-i="${i}" ${got ? 'disabled' : ''}><span>${got ? '✅' : st.target === i ? '🎯' : '◯'} ${esc(nm)}</span><small>${got ? 'yours' : `${fmt(prog)} / ${fmt(cost)} ${ITEMS[m.item].icon}`}</small></button>`;
            }).join('')}</div></details>`;
        }
        return h;
    }
    function mapPos(L, w, h) {
        const list = MAP[L].list, out = [];
        let a = 7;
        const R = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
        list.forEach((_, i) => {
            if (L === 'sol') { const r = 0.12 + i / list.length * 0.84, ang = i * 2.4; out.push([w / 2 + Math.cos(ang) * r * w * 0.48, h / 2 + Math.sin(ang) * r * h * 0.46]); }
            else if (L === 'galaxy') { const d = 0.1 + i / list.length * 0.88, ang = (i % 2) * Math.PI + d * 6; out.push([w / 2 + Math.cos(ang) * d * w * 0.46, h / 2 + Math.sin(ang) * d * h * 0.44]); }
            else out.push([w * 0.06 + R() * w * 0.88, h * 0.08 + R() * h * 0.84]);
        });
        return out;
    }
    function drawMap(t) {
        const cv = $('mapCv');
        if (!cv) return;
        const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
        if (!r.width) return;
        if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
        const c = cv.getContext('2d'), w = r.width, h = r.height, L = mapLayer, st = S().map[L], list = MAP[L].list;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.fillStyle = '#04030a'; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 80; i++) { c.fillStyle = `rgba(255,255,255,${0.15 + (i * 37 % 10) / 25})`; c.fillRect((i * 97) % w, (i * 53) % h, 1, 1); }
        const pos = mapPos(L, w, h);
        if (L === 'sol') {
            const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, 26); g.addColorStop(0, '#fff7d6'); g.addColorStop(0.4, '#fbbf24'); g.addColorStop(1, 'rgba(251,146,60,0)');
            c.fillStyle = g; c.fillRect(w / 2 - 30, h / 2 - 30, 60, 60);
            c.strokeStyle = 'rgba(255,255,255,0.06)';
            pos.forEach(p => { const rx = Math.hypot(p[0] - w / 2, p[1] - h / 2); c.beginPath(); c.arc(w / 2, h / 2, rx, 0, 7); c.stroke(); });
        } else if (L === 'galaxy') {
            const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, 40); g.addColorStop(0, 'rgba(255,240,255,0.8)'); g.addColorStop(1, 'rgba(240,171,252,0)');
            c.fillStyle = g; c.fillRect(w / 2 - 40, h / 2 - 40, 80, 80);
        } else {
            c.strokeStyle = 'rgba(165,180,252,0.12)';
            pos.forEach((p, i) => { const q = pos[(i * 5 + 2) % pos.length]; c.beginPath(); c.moveTo(...p); c.lineTo(...q); c.stroke(); });
        }
        pos.forEach((p, i) => {
            const got = st.got[i], tg = st.target === i;
            if (got) { c.fillStyle = 'rgba(52,211,153,0.25)'; c.beginPath(); c.arc(p[0], p[1], 9, 0, 7); c.fill(); }
            if (tg) { const k = (t * 1.2) % 1; c.strokeStyle = `rgba(251,146,60,${1 - k})`; c.lineWidth = 2; c.beginPath(); c.arc(p[0], p[1], 6 + k * 12, 0, 7); c.stroke(); }
            c.fillStyle = got ? '#34d399' : tg ? '#fb923c' : i === mapHover ? '#fff' : 'rgba(203,213,225,0.55)';
            c.beginPath(); c.arc(p[0], p[1], got || tg ? 4 : 3, 0, 7); c.fill();
        });
        const lbl = mapHover >= 0 ? mapHover : st.target;
        if (lbl !== null && lbl !== undefined && lbl >= 0 && pos[lbl]) {
            const p = pos[lbl], cost = E.mapCost(L, lbl);
            const txt = `${list[lbl]}${st.got[lbl] ? ' ✅' : ' · ' + fmt(cost) + ' ' + ITEMS[MAP[L].item].icon}`;
            c.font = '700 11px system-ui'; const tw = c.measureText(txt).width + 12;
            const x = Math.min(w - tw - 4, Math.max(4, p[0] - tw / 2)), y = p[1] > 26 ? p[1] - 26 : p[1] + 10;
            c.fillStyle = 'rgba(10,12,20,0.9)'; c.beginPath(); c.roundRect(x, y, tw, 18, 9); c.fill();
            c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(txt, x + 6, y + 9.5); c.textBaseline = 'alphabetic';
        }
    }
    function mapHit(e) {
        const cv = $('mapCv'); if (!cv) return -1;
        const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        const pos = mapPos(mapLayer, r.width, r.height);
        let best = -1, bd = 14;
        pos.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = i; } });
        return best;
    }
    document.addEventListener('pointermove', (e) => { if (e.target.id === 'mapCv') mapHover = mapHit(e); else if (mapHover >= 0) mapHover = -1; });
    document.addEventListener('click', (e) => {
        if (e.target.id !== 'mapCv' || !mapOpen(mapLayer)) return;
        const i = mapHit(e);
        if (i >= 0 && !S().map[mapLayer].got[i]) { E.setTarget(mapLayer, i); Arcade.sfx('select'); render(); }
    });

    /* ---------- blueprints tab ---------- */
    function tabBp() {
        const bps = E.M.bps || [];
        let h = `<div class="card2"><b>📐 Blueprints</b><small style="margin:0">Hold <kbd>Shift</kbd> and drag on empty floor (or press <b>⬚</b> by the zoom buttons) to box-select machines. Then <b>Save blueprint</b> in the bar that appears. <b>Place</b> builds one unit of each machine; <b>Full</b> rebuilds every unit. <kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>V</kbd> copy and paste a selection. Blueprints survive Recursion.</small></div>`;
        if (!bps.length) h += '<div class="card2 dim"><small style="margin:0">No blueprints yet.</small></div>';
        bps.forEach((bp, i) => {
            const c1 = E.bpCost(bp, false), cf = E.bpCost(bp, true), p1 = E.bpProblem(bp, false), pf = E.bpProblem(bp, true);
            const counts = {};
            bp.nodes.forEach(b => { counts[b.t] = (counts[b.t] || 0) + 1; });
            h += `<div class="card2 bp"><div class="row between"><b>${esc(bp.name)}</b><span class="tiny muted">${bp.nodes.length} machines · ${bp.links.length} cables</span></div>
                <div class="bp-icons">${Object.entries(counts).map(([t, k]) => `<span title="${esc(NODES[t].name)}">${NODES[t].icon}${k > 1 ? '×' + k : ''}</span>`).join('')}</div>
                ${p1 ? `<div class="tiny bad">${esc(p1)}</div>` : ''}
                <div class="bp-btns"><button class="btn sm ${p1 ? '' : 'primary'}" data-act="bpPlace" data-i="${i}" ${p1 ? 'disabled' : ''}>Place<br><small>${costTxt(c1)}</small></button>
                <button class="btn sm" data-act="bpPlace" data-i="${i}" data-full="1" ${pf ? 'disabled' : ''} title="${esc(pf)}">Full<br><small>${costTxt(cf)}</small></button>
                <button class="btn sm" data-act="bpRename" data-i="${i}">✏️</button><button class="btn sm danger" data-act="bpDel" data-i="${i}">🗑</button></div></div>`;
        });
        return h;
    }

    /* ---------- recursion tab ---------- */
    let lawPick = 'none';
    function tabRecursion() {
        const s = S(), M = E.M;
        let h = '';
        if (s.won) {
            const laws = E.lawChoices();
            if (!laws.some(l => l.id === lawPick)) lawPick = laws[0].id;
            h += `<div class="card2 hi"><b>♾️ Recursion</b><small>You are everything there is. Collapse it all and start again, in a new universe with different physics, keeping your Echoes.</small>
                <div class="row between"><span>You will gain</span><span class="echo-num">+${E.echoGain()} ✦</span></div>
                <div class="tiny muted">Faster runs earn more. This run: ${dur(s.playT)}.</div></div>
                <h3>Pick the laws of the next universe</h3>${laws.map(l => `<button class="law ${lawPick === l.id ? 'on' : ''}" data-act="law" data-id="${l.id}"><span class="ic">${l.icon}</span><b>${esc(l.name)}</b><small>${esc(l.desc)}</small><span class="m">×${l.mult}</span></button>`).join('')}
                <button class="btn primary block" data-act="recurse">♾️ Recurse</button>`;
        } else h += '<div class="card2"><b>♾️ Recursion</b><small style="margin:0">Train SINGULARITY and take the whole observable universe to unlock the next recursion.</small></div>';
        h += `<h3>Echoes <span class="tiny" style="letter-spacing:0;text-transform:none">${fmt(M.echoes)} ✦ · run ${M.runs + 1}</span></h3>`;
        ECHO.forEach(e => {
            const l = E.perk(e.id), c = e.cost(l), max = l >= e.max;
            h += `<div class="card2 tech"><b>${e.icon} ${esc(e.name)} <span class="dim">${l}/${e.max}</span></b><small>${esc(e.desc)}</small><button class="btn sm" data-act="echo" data-id="${e.id}" ${max || M.echoes < c ? 'disabled' : ''}>${max ? 'Max' : c + ' ✦'}</button></div>`;
        });
        if (s.law !== 'none') { const l = LAWS.find(x => x.id === s.law); h += `<div class="card2"><b>Current law: ${l.icon} ${esc(l.name)}</b><small style="margin:0">${esc(l.desc)}</small></div>`; }
        return h;
    }

    /* ---------- stats tab ---------- */
    function tabStats() {
        const s = S(), st = s.stats;
        const rows = [['Play time this run', dur(s.playT)], ['Cash earned', money(st.earned)], ['Compute produced', fmt(st.compute) + ' PF'], ['Desk jobs done', fmt(st.captchas)],
            ['Contracts done', fmt(st.contracts)], ['Minigames', fmt(st.minis)], ['Machines built', fmt(st.built)], ['Breakdowns', fmt(st.broken)], ['Income now', money(E.inc) + '/s'], ['Compute now', fmt(E.computeRate) + ' PF/s'], ['Research now', fmt(E.rpRate) + '/s']];
        return `<div class="card2">${rows.map(([a, b]) => `<div class="stat-row"><span>${a}</span><b>${b}</b></div>`).join('')}</div>
            <h3>Income (last hour)</h3><canvas id="histCv"></canvas>
            <h3>Game</h3><div class="card2"><small>Your progress saves by itself. Use the hub's export button to back it up.</small><div class="row"><button class="btn sm" data-act="help">❔ How to play</button><button class="btn sm danger" data-act="reset">Start over</button></div></div>`;
    }
    function drawHist() {
        const cv = $('histCv');
        if (!cv) return;
        const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
        if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
        const c = cv.getContext('2d'), w = r.width, h = r.height, H = S().hist.slice(-360).map(x => Math.log10(1 + x[1]));
        c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
        if (H.length < 2) { c.fillStyle = '#888'; c.font = '12px system-ui'; c.fillText('Collecting data…', 10, 20); return; }
        const mn = Math.min(...H), mx = Math.max(...H);
        c.beginPath();
        H.forEach((v, i) => { const x = i / (H.length - 1) * w, y = h - 8 - (v - mn) / (mx - mn || 1) * (h - 16); i ? c.lineTo(x, y) : c.moveTo(x, y); });
        c.strokeStyle = getComputedStyle(document.body).getPropertyValue('--accent'); c.lineWidth = 2; c.stroke();
    }

    const TAB_FN = { ai: tabAI, work: tabWork, research: tabResearch, focus: tabFocus, power: tabPower, market: tabMarket, bp: tabBp, site: tabSite, map: tabMap, recursion: tabRecursion, stats: tabStats };

    /* ---------- palette ---------- */
    const CATS = [['all', '★', 'All'], ['logistics', '🏪', 'Selling & storage'], ['source', '🗑️', 'Sources'], ['process', '⚙️', 'Factories'], ['compute', '🧮', 'Compute'], ['data', '📚', 'Data'],
        ['ai', '🧠', 'AI & research'], ['power', '⚡', 'Power'], ['cool', '❄️', 'Cooling'], ['special', '✨', 'Special']];
    function renderPalette() {
        const s = S();
        const used = s.nodes.length, max = E.slots();
        const sl = $('slots'); sl.textContent = `${used}/${max}`; sl.classList.toggle('full', used >= max);
        // in the shack the tutorial hands machines out one step at a time, so hide the rest
        const early = s.site === 0 && !s.tutSkip && s.goal < 9;
        const hidden = NODE_LIST.filter(d => E.tutLocked(d)).length;
        const show = NODE_LIST.filter(d => d.site <= (early ? 0 : s.site + 1) && !E.tutLocked(d) && (!d.focus || s.focus[d.focus]) && (cat === 'all' || d.cat === cat));
        const hl = tutHl();
        const cats = CATS.filter(([id]) => id === 'all' || NODE_LIST.some(d => d.cat === id && d.site <= (early ? 0 : s.site + 1) && !E.tutLocked(d) && (!d.focus || s.focus[d.focus])));
        setHTML($('palCats'), cats.map(([id, ic, nm]) => `<button class="btn sm ${cat === id ? 'active' : ''}" data-act="cat" data-id="${id}" title="${nm}">${ic}</button>`).join(''));
        const groups = {};
        show.forEach(d => (groups[d.site] = groups[d.site] || []).push(d));
        let h = '';
        // what you can build here first (newest place on top), then a peek at the next place
        Object.keys(groups).map(Number).sort((a, b) => (a > s.site) - (b > s.site) || b - a).forEach(si => {
            h += `<div class="pal-sec">${SITES[si].icon} ${esc(SITES[si].name)}</div>`;
            groups[si].forEach(d => {
                const lock = E.lockReason(d);
                const c = E.nodeCost(d.id), can = !lock && E.canAfford(c) && used < max;
                const isNew = !lock && !E.owned(d.id) && (d.site === s.site && s.site > 0 || early && d.id !== 'heap' && d.id !== 'stall');
                h += `<button class="bld ${lock ? 'locked' : can ? '' : 'cant'} ${hl && hl.pal === d.id ? 'tut' : ''}" data-act="build" data-id="${d.id}" title="${esc(d.desc)}"><span class="ic">${d.icon}</span><b>${esc(d.name)}${isNew ? '<span class="tagnew">new</span>' : ''}</b><small>${lock || costTxt(c)}</small></button>`;
            });
        });
        if (early && hidden) h += `<div class="pal-more">🎯 ${hidden} more machine${hidden > 1 ? 's' : ''} unlock as you follow the tutorial.</div>`;
        setHTML($('palList'), h || '<div class="pal-sec">Nothing here yet.</div>');
    }

    /* ---------- inspector ---------- */
    function renderInsp() {
        const el = $('insp');
        const n = Graph.sel && S().nodes.includes(Graph.sel) ? Graph.sel : null;
        const l = !n && Graph.selLink && S().links.includes(Graph.selLink) ? Graph.selLink : null;
        if (!n && !l) { el.hidden = true; el._h = ''; return; }
        el.hidden = false;
        if (l) {
            const A = E.byId(l.a), B = E.byId(l.b);
            const opts = E.producible(A).filter(it => E.accepts(B, it));
            setHTML(el, `<div class="insp-h"><span class="ic">🔗</span><div><b>Cable</b><small>${NODES[A.t].icon} ${esc(NODES[A.t].name)} → ${NODES[B.t].icon} ${esc(NODES[B.t].name)}</small></div><button class="btn sm ghost close" data-act="desel">✕</button></div>
                <div class="kv"><span>Carrying</span><b>${l.flow > 0.001 && l.it ? `${ITEMS[l.it].icon} ${fmt(l.flow)}/s` : 'nothing right now'}</b></div>
                ${opts.length > 1 ? `<p class="d">Filter, only let one item through:</p><div class="row" style="gap:4px;margin-bottom:8px"><button class="btn sm ${!l.f ? 'active' : ''}" data-act="filter" data-id="">All</button>${opts.map(it => `<button class="btn sm ${l.f === it ? 'active' : ''}" data-act="filter" data-id="${it}">${ITEMS[it].icon} ${esc(ITEMS[it].name)}</button>`).join('')}</div>` : ''}
                <div class="btns"><button class="btn danger wide" data-act="unlink">✂️ Cut cable</button></div>`);
            return;
        }
        const d = NODES[n.t], s = S();
        const st = Graph.STATUS[n.st] || Graph.STATUS.idle;
        const c1 = E.nodeCost(n.t), c10 = E.bulkCost(n.t, 10);
        const pw = d.w * n.q * E.fx('power:*');
        const kv = [];
        const sp = n.q * E.fx('speed:*') * E.fx('speed:@' + d.cat) * E.fx('speed:' + n.t);
        if (d.kind === 'proc') kv.push(['Speed', `${fmt(sp / d.time)} cycles/s`]);
        if (d.kind === 'proc' && Object.keys(d.out).length) kv.push(['Makes', Object.entries(d.out).map(([k, v]) => `${ITEMS[k].icon}${fmt(v * sp / d.time)}/s`).join(' ')]);
        if (d.kind === 'proc' && Object.keys(d.in).length) kv.push(['Needs', Object.entries(d.in).map(([k, v]) => `${ITEMS[k].icon}${fmt(v * sp / d.time)}/s`).join(' ')]);
        if (d.opex) kv.push(['Buys stock', `${money(d.opex * E.fx('opex') * sp / d.time)}/s`]);
        if (d.kind === 'sell' || d.kind === 'store') kv.push(['Handles', `${fmt(d.rate * n.q * E.fx('speed:' + n.t))} items/s`]);
        if (d.kind === 'train') kv.push(['Throughput', `🧮${fmt(d.rate.compute * sp * E.fx('train'))} 📚${fmt(d.rate.data * sp * E.fx('train'))} /s`]);
        if (d.kind === 'gen') kv.push(['Output', E.fmtW(-d.w * n.q) + (d.solar ? ' in full sun' : '') + (d.fuel ? ` · $${d.fuel} per kW·s` : '')]);
        if (d.kind === 'grid') kv.push(['Capacity', E.fmtW(d.cap * n.q)]);
        if (d.kind === 'batt') kv.push(['Stores', fmt(d.cap * n.q) + ' J']);
        if (d.kind === 'cool') kv.push(['Cooling', E.fmtW(d.cool * n.q * E.fx('cool'))]);
        if (d.kind === 'dyson') kv.push(['Panels', `${fmt(n.abs)} → ${E.fmtW(n.abs * 5e16)}`]);
        if (pw > 0) kv.push(['Power', `${E.fmtW(pw)} at full work`]);
        if (d.wear) kv.push(['Condition', `${Math.round(n.c * 100)}%`]);
        const pr = Object.entries(n.pr || {}).filter(([, v]) => v > 1e-4);
        if (pr.length) kv.push(['Right now', pr.map(([k, v]) => k === 'cash' ? `$${fmt(v)}/s` : `${ITEMS[k] ? ITEMS[k].icon : '📦'}${fmt(v)}/s`).join(' ')]);
        const bufs = [...Object.entries(n.ib).filter(([, v]) => v > 0.01).map(([k, v]) => `<span class="buf" title="waiting to be used">⬅ ${ITEMS[k].icon} ${fmt(v)}</span>`),
            ...Object.entries(n.ob).filter(([, v]) => v > 0.01).map(([k, v]) => `<span class="buf" title="waiting to be sent">${ITEMS[k].icon} ${fmt(v)} ➡</span>`)].join('');
        const fixBtns = n.br || n.c < 0.999 ? `<button class="btn primary" data-act="fixMini" data-id="${n.id}">🔧 Fix it</button><button class="btn" data-act="fixPay" data-id="${n.id}">${E.repairCost(n) ? 'Pay ' + money(E.repairCost(n)) : 'Hot-swap'}</button><span></span>` : '';
        setHTML(el, `<div class="insp-h"><span class="ic">${d.icon}</span><div><b>${esc(d.name)} ×${fmt(n.q)}</b><small>${SITES[d.site].icon} ${esc(SITES[d.site].name)} era</small></div><button class="btn sm ghost close" data-act="desel">✕</button></div>
            <p class="d">${esc(d.desc)}</p>
            <span class="status-pill"><i style="background:${st[0]}"></i>${st[1]}</span>
            ${d.wear ? `<div class="bar cond"><i style="width:${n.c * 100}%;background:${n.c > 0.5 ? 'var(--good)' : n.c > 0.25 ? 'var(--warn)' : 'var(--bad)'}"></i></div>` : ''}
            <div class="kv">${kv.map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('')}</div>
            ${bufs ? `<div class="bufs">${bufs}</div>` : ''}
            <div class="btns">
                <button class="btn ${E.canAfford(c1) ? 'primary' : ''}" data-act="add" data-n="1" ${E.canAfford(c1) ? '' : 'disabled'}>+1 unit<br><small>${costTxt(c1)}</small></button>
                <button class="btn" data-act="add" data-n="10" ${E.canAfford(c10) ? '' : 'disabled'}>+10<br><small>${costTxt(c10)}</small></button>
                <button class="btn" data-act="sub">−1 unit<br><small>refund 50%</small></button>
                ${fixBtns}
                <button class="btn" data-act="toggle">${n.on ? '⏸ Turn off' : '▶ Turn on'}</button>
                <button class="btn" data-act="center">🎯 Center</button>
                <button class="btn danger" data-act="del">🗑 Scrap</button>
            </div>`);
    }

    /* ---------- desk overlays ---------- */
    function renderAlerts() {
        const s = S();
        let h = '';
        if (s.ev.cur) {
            const e = EVENTS.find(x => x.id === s.ev.cur.id);
            if (e) h += `<div class="alert ev"><h4>${esc(e.title)}</h4><p>${esc(e.text)}</p><div class="row">${e.choices.map((ch, i) => { const c = E.eventCost(ch); return `<button class="btn ${i === 0 ? 'primary' : ''}" data-act="event" data-i="${i}" ${S().cash < c ? 'disabled' : ''}>${esc(ch.t)}${c ? ' · ' + money(c) : ''}</button>`; }).join('')}</div></div>`;
        }
        if (s.breaker.tripped) h += `<div class="alert bad"><b>⚡ Breaker tripped</b>, machines are off. <button class="btn sm" data-act="tab" data-id="work">Fix</button></div>`;
        const br = s.nodes.filter(n => n.br).length;
        if (br) h += `<div class="alert bad">🔧 ${br} machine${br > 1 ? 's' : ''} broken <button class="btn sm" data-act="tab" data-id="work">Repair</button></div>`;
        if (E.P.short > 0 && !s.breaker.tripped) h += `<div class="alert">🔌 Short ${E.fmtW(E.P.short)} of power, machines slow down.</div>`;
        if (E.P.ratio > 1) h += `<div class="alert">🌡️ Overheating (${Math.round(E.P.temp)}°C), add cooling.</div>`;
        setHTML($('alerts'), h);
        const g = GOALS[s.goal];
        const gc = $('goalCard');
        if (goalSeen !== s.goal) { goalSeen = s.goal; goalHidden = false; }
        if (!g || s.tutSkip) { gc.hidden = true; }
        else if (goalHidden) { gc.hidden = false; gc.classList.add('mini'); setHTML(gc, `<button class="btn sm" data-act="showGoal">🎯 Step ${s.goal + 1}: ${esc(g.title)}</button>`); }
        else {
            gc.hidden = false; gc.classList.remove('mini');
            const r = g.reward, rw = [r.cash ? money(r.cash) : '', r.rp ? r.rp + ' 🔬' : '', r.rep ? r.rep + ' ⭐' : ''].filter(Boolean).join(' ');
            setHTML(gc, `<div class="tut-top"><small>Step ${s.goal + 1} of ${GOALS.length}</small><span class="tut-x" data-act="hideGoal" title="Minimise">–</span></div>
                <b class="tut-title">${esc(g.title)}</b><p class="tut-body">${esc(g.body)}</p>
                <div class="tut-task">👉 ${esc(g.text)}</div>
                <div class="tut-foot"><span class="tiny muted">Reward: ${rw}${g.unlock ? ' · unlocks ' + g.unlock.map(id => NODES[id].icon).join('') : ''}</span>${s.site === 0 ? '<button class="btn sm ghost" data-act="skipTut">Skip tutorial</button>' : ''}</div>`);
        }
        Graph.hl = tutHl();
        $('selBtn').classList.toggle('tut', !!(Graph.hl && Graph.hl.sel));
    }

    function tutHl() {
        const s = S(), g = GOALS[s.goal];
        return g && !s.tutSkip && !goalHidden ? g.hl : null;
    }
    function renderSelBar() {
        const n = [...Graph.multi].filter(id => S().nodes.some(m => m.id === id)).length;
        const el = $('selBar');
        el.hidden = !n && !Graph.placingBp;
        if (Graph.placingBp) setHTML(el, `📐 Placing <b>${esc(Graph.placingBp.bp.name)}</b>, click on the floor. <button class="btn sm" data-act="bpCancel">Cancel</button>`);
        else if (n) setHTML(el, `<b>${n}</b> selected <button class="btn sm primary" data-act="bpSave">📐 Save blueprint</button><button class="btn sm" data-act="copy">📋 Copy</button><button class="btn sm danger" data-act="multiDel">🗑 Scrap</button><button class="btn sm ghost" data-act="multiClear">✕</button>`);
        $('selBtn').classList.toggle('active', Graph.selMode);
    }

    /* ---------- chips ---------- */
    function renderChips() {
        const s = S(), P = E.P;
        Arcade.text('cCash', money(s.cash));
        Arcade.text('cInc', E.inc > 0.005 ? `+${money(E.inc)}/s` : '');
        $('chCoin').hidden = !(s.coin > 0 || s.site >= 1); Arcade.text('cCoin', fmt(s.coin, 3));
        $('chRp').hidden = !(s.rp > 0 || s.ai.ver >= 1); Arcade.text('cRp', fmt(s.rp));
        Arcade.text('cRep', fmt(s.rep));
        $('chInfl').hidden = !(s.infl > 0 || s.site >= 4); Arcade.text('cInfl', fmt(s.infl));
        const sup = P.free + P.fuelCap + P.gridCap;
        Arcade.text('cPow', `${E.fmtW(P.D)} / ${E.fmtW(sup)}${s.batt > 0 && P.battCap ? ' 🔋' : ''}`);
        $('chPow').className = 'chip ' + (s.breaker.tripped || P.short > 0 ? 'bad' : P.D > sup * 0.85 ? 'warn' : '');
        Arcade.text('cTemp', Math.round(P.temp) + '°C');
        $('chTemp').className = 'chip ' + (P.ratio > 1 ? 'bad' : P.ratio > 0.85 ? 'warn' : '');
        const m = MODELS[s.ai.ver], need = E.modelNeed();
        Arcade.text('cAi', (s.ai.ver ? MODELS[s.ai.ver - 1].name : 'none') + (m ? ` · ${Math.floor(Math.min(s.ai.c / need.c, s.ai.d / need.d) * 100)}%` : ''));
        document.body.dataset.site = s.site;
        Arcade.text('siteName', E.site().icon + ' ' + E.site().name);
        Arcade.text('siteSub', `${s.nodes.length} machines · ${fmt(E.computeRate)} PF/s`);
    }

    /* ---------- render all ---------- */
    function render() {
        if (pressing) return;
        renderChips();
        renderTabs();
        renderPalette();
        if (setHTML($('tabBody'), TAB_FN[tab]())) { drawCoin(); drawHist(); }
        renderSelBar();
        renderInsp();
        renderAlerts();
    }

    /* ---------- modals ---------- */
    const modalQ = [];
    function showModal(html) {
        if (!$('modalOv').hidden || Tasks.busy) { modalQ.push(html); return; }
        $('modal').innerHTML = html;
        $('modalOv').hidden = false;
    }
    function closeModal() {
        $('modalOv').hidden = true;
        if (modalQ.length) setTimeout(() => showModal(modalQ.shift()), 150);
    }
    function helpModal() {
        showModal(`<h2>Singularity</h2><p class="lead">Start in a shack with a dumpster of e-waste. End as the mind of the universe.</p>
            <ul class="help">
                <li><b>Build</b> machines from the left panel. Drag a cable from a machine's <b>right dot</b> onto another machine to send it items. Drag the background to pan, scroll to zoom.</li>
                <li><b>Money:</b> solve desk jobs (captchas) in 💼 Work, sell things through a Market Stall, and take contracts.</li>
                <li><b>Power:</b> anything with a plug needs watts, solar by day, batteries at night, generators, later the grid. Overload the shack and the breaker trips.</li>
                <li><b>Heat:</b> every watt becomes heat. Too hot and machines slow down and break faster. Add fans and AC.</li>
                <li><b>Your AI:</b> feed compute 🧮 and data 📚 into a Training Rig. Each trained model unlocks something big and gives a 🎯 focus point.</li>
                <li><b>Wear:</b> machines break eventually. Fix them yourself (a quick wiring puzzle) or pay someone.</li>
                <li><b>Storage:</b> wire things into a 📦 Storage Shed to keep them, bigger machines need parts from storage to build, and contracts deliver from it.</li>
                <li><b>Markets:</b> only so many buyers exist. Flood a market and prices drop for a while, contracts pay far better and never flood.</li>
                <li><b>Numbers on machines:</b> left = items waiting inside, right = what it makes per second. Cables show how much they carry per second.</li>
                <li><b>Blueprints:</b> Shift-drag (or ⬚) to select machines, then save them as a 📐 blueprint and paste them anywhere. Ctrl+C / Ctrl+V works too.</li>
                <li><b>Move</b> (🏠 Site tab) to bigger places as your AI grows. The whole interface upgrades with you.</li>
            </ul><div class="actions"><button class="btn primary" data-act="closeModal">Got it</button></div>`);
    }

    /* ---------- actions ---------- */
    async function runMini(kind, opts) {
        const ok = await Tasks.open(kind, opts);
        if (modalQ.length && $('modalOv').hidden) showModal(modalQ.shift());
        return ok;
    }
    function nodeOf(id) { return S().nodes.find(n => n.id === +id); }
    const ACT = {
        tab: (d) => { tab = d.id; Arcade.save('arcade.singularity.tab', tab); $('tabBody').scrollTop = 0; },
        cat: (d) => { cat = d.id; },
        build: (d) => {
            const why = E.lockReason(NODES[d.id]);
            if (why) { toast('Locked, ' + why, 'bad'); return; }
            const [x, y] = Graph.freeSpot();
            const r = E.place(d.id, x, y);
            if (r.err) { toast(r.err, 'bad'); Arcade.sfx('bad'); return; }
            Arcade.sfx('pop');
            Graph.sel = r.node; Graph.selLink = null;
        },
        desel: () => { Graph.sel = null; Graph.selLink = null; },
        add: (d) => { const n = Graph.sel; if (n && E.addUnits(n, +d.n)) Arcade.sfx('coin'); else Arcade.sfx('bad'); },
        sub: () => { const n = Graph.sel; if (!n) return; if (n.q <= 1 && !confirm(`Scrap this ${NODES[n.t].name}?`)) return; E.sellUnit(n); if (!S().nodes.includes(n)) Graph.sel = null; },
        del: () => { const n = Graph.sel; if (n && confirm(`Scrap ${NODES[n.t].name} ×${n.q} for a 50% refund?`)) { E.removeNode(n); Graph.sel = null; } },
        toggle: () => { const n = Graph.sel; if (n) n.on = !n.on; },
        center: () => { if (Graph.sel) Graph.focus(Graph.sel); },
        unlink: () => { if (Graph.selLink) { E.unlink(Graph.selLink); Graph.selLink = null; } },
        filter: (d) => { if (Graph.selLink) Graph.selLink.f = d.id || null; },
        fixMini: async (d) => {
            const n = nodeOf(d.id); if (!n) return;
            const ok = await runMini('repair', { wires: Math.min(7, 4 + Math.floor(NODES[n.t].site / 2)), what: NODES[n.t].name });
            if (ok) { E.repair(n); S().stats.minis++; toast(`🔧 ${NODES[n.t].name} is running again.`, 'good'); }
        },
        fixPay: (d) => { const n = nodeOf(d.id); if (n && E.repair(n, true)) toast(`🔧 Repaired ${NODES[n.t].name}.`, 'good'); else toast('Not enough cash.', 'bad'); },
        breaker: async () => { const ok = await runMini('breaker'); if (ok) { E.resetBreaker(); S().stats.minis++; toast('⚡ Power is back on.', 'good'); } },
        electrician: () => { if (E.resetBreaker(true)) toast('⚡ The electrician reset the breaker.', 'good'); else toast('Not enough cash.', 'bad'); },
        task: async () => {
            const ok = await runMini('captcha', { type: E.site().task });
            if (ok === null) return;
            const r = E.solveTask(ok);
            if (r) toast(`+${money(r.pay)}${r.sideTxt}`, 'good', 1200);
            if (ok && S().cap.streak >= 1) ACT.task();      // keep the flow going: open the next one
        },
        debug: async () => { const ok = await runMini('debug'); if (ok) toast('🐛 ' + E.miniReward('debug'), 'good'); },
        tune: async () => {
            let score = 0;
            const ok = await runMini('tune', { onScore: (v) => { score = v; } });
            if (ok) { const mx = 1.5 * E.fx('tunemax'); E.setTune(1 + (mx - 1) * score); S().stats.minis++; toast(`🎛️ Tuned: this model needs ${Math.round((1 - 1 / S().ai.tune) * 100)}% less.`, 'good'); }
        },
        accept: (d) => { const o = S().con.offers.find(x => x.id === +d.id); if (o && E.acceptContract(o)) Arcade.sfx('select'); },
        deliver: (d) => { const c = S().con.active.find(x => x.id === +d.id); if (c && E.completeContract(c)) Arcade.sfx('coin'); },
        abandon: (d) => { const c = S().con.active.find(x => x.id === +d.id); if (c && confirm('Abandon this contract? (−1 ⭐)')) E.abandonContract(c); },
        job: async (d) => {
            const c = S().con.active.find(x => x.id === +d.id); if (!c) return;
            const ok = await runMini(c.mini, { what: 'for ' + c.client, wires: 5 });
            if (ok) { S().stats.minis++; E.completeContract(c); }
            else if (ok === false) toast('That did not go well. Try again before the deadline.', 'bad');
        },
        tech: (d) => { if (E.buyTech(d.id)) { Arcade.sfx('level'); toast('🔬 Researched ' + TECHS.find(t => t.id === d.id).name, 'good'); } },
        repeat: (d) => { if (E.buyRepeat(d.id)) Arcade.sfx('coin'); },
        focus: (d) => { if (E.buyFocus(d.tree, +d.i)) { Arcade.sfx('power'); const p = FOCUS.find(t => t.id === d.tree).perks[+d.i]; toast(`🎯 ${p.name}: ${p.desc}`, 'good', 3200); } },
        respec: () => { if (confirm('Refund every focus perk? (Click Farms you built are scrapped.)') && E.respec()) toast('Perks refunded.', 'good'); },
        sellInv: (d) => { const v = E.sellInv(d.id); if (v) { Arcade.sfx('coin'); toast(`+${money(v)}`, 'good', 1200); } },
        coin: (d) => {
            const f = +d.f, s = S();
            if (f > 0) { const amt = s.cash * f / (s.coinPrice * (E.has('nofee') ? 1 : 1.01)); if (amt > 0 && E.trade(amt)) Arcade.sfx('coin'); }
            else if (E.trade(s.coin * f)) Arcade.sfx('coin');
        },
        move: () => { if (E.move()) { Arcade.sfx('win'); Graph.fit(); showModal(`<h2>${E.site().icon} ${esc(E.site().name)}</h2><p class="lead" style="text-align:center">${esc(E.site().blurb)}</p><div class="perk-big">New machines are in the build list, and you have <b>${E.slots()}</b> slots. ${E.site().grid ? '' : '<br>No grid here, bring your own power.'}${E.site().space ? '<br>No air in space: build radiators for cooling.' : ''}</div><div class="actions"><button class="btn primary" data-act="closeModal">Let's go</button></div>`); } },
        target: (d) => { E.setTarget(d.l, +d.i); },
        law: (d) => { lawPick = d.id; },
        recurse: () => {
            if (!confirm('Collapse this universe and start a new run? You keep Echoes and Echo perks.')) return;
            const g = E.recurse(lawPick);
            if (g) { Graph.sel = null; Graph.fit(); toast(`♾️ +${g} Echoes. A new universe begins.`, 'gold', 4000); }
        },
        echo: (d) => { if (E.buyEcho(d.id)) Arcade.sfx('level'); },
        event: async (d) => {
            const r = E.chooseEvent(+d.i);
            if (!r) return;
            if (r.err) { toast(r.err, 'bad'); return; }
            if (r.mini) {
                const ok = await runMini(r.mini, { type: E.site().task });
                E.applyEventFx(ok ? r.reward : r.fail);
                if (!ok) toast('It did not work out.', 'bad');
            }
        },
        hideGoal: () => { goalHidden = true; },
        showGoal: () => { goalHidden = false; },
        skipTut: () => { if (confirm('Skip the tutorial? Every shack machine unlocks right away.')) { E.skipTut(); toast('Tutorial skipped, everything here is unlocked.', 'good'); } },
        mapLayer: (d) => { mapLayer = d.id; },
        bpSave: () => {
            const ids = [...Graph.multi];
            const name = prompt('Name this blueprint:', 'Blueprint ' + ((E.M.bps || []).length + 1));
            if (name === null) return;
            const bp = E.makeBp(ids, name.trim());
            if (!bp) return;
            E.saveBp(bp);
            toast(`📐 Saved “${bp.name}” (${bp.nodes.length} machines)`, 'good');
            Graph.multi = new Set(); tab = 'bp';
        },
        bpPlace: (d) => { const bp = (E.M.bps || [])[+d.i]; if (bp) { Graph.startBp(bp, d.full === '1'); toast('Click on the floor to place it. Shift-click to place more.', '', 2200); } },
        bpCancel: () => { Graph.placingBp = null; },
        bpRename: (d) => { const bp = E.M.bps[+d.i]; const n = bp && prompt('Rename blueprint:', bp.name); if (n) E.renameBp(+d.i, n.trim()); },
        bpDel: (d) => { const bp = E.M.bps[+d.i]; if (bp && confirm(`Delete blueprint “${bp.name}”?`)) E.delBp(+d.i); },
        copy: () => { clip = E.makeBp([...Graph.multi], 'Copied machines'); if (clip) toast('📋 Copied, press Ctrl+V to paste.', '', 1800); },
        multiDel: () => {
            const ns = S().nodes.filter(n => Graph.multi.has(n.id));
            if (ns.length && confirm(`Scrap ${ns.length} machines for a 50% refund?`)) { ns.forEach(n => E.removeNode(n)); Graph.multi = new Set(); Graph.sel = null; }
        },
        multiClear: () => { Graph.multi = new Set(); },
        selMode: () => { Graph.selMode = !Graph.selMode; toast(Graph.selMode ? '⬚ Select mode: drag on the floor to select machines.' : 'Select mode off.', '', 1600); },
        help: () => helpModal(),
        reset: () => { if (confirm('Erase this run and start over from the shack? (Echoes are kept.)')) { E.hardReset(); Graph.sel = null; Graph.fit(); } },
        closeModal: () => closeModal(),
    };
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-act]');
        if (!el || el.disabled) return;
        const fn = ACT[el.dataset.act];
        if (fn) { fn(el.dataset); render(); }
    });
    // don't swap panel HTML while a button is held down, or the click gets lost
    document.addEventListener('pointerdown', (e) => { if (e.target.closest('.side, .palette, .insp, .alerts, .goal-card')) pressing = true; });
    document.addEventListener('pointerup', () => { setTimeout(() => { pressing = false; }, 30); });
    document.addEventListener('keydown', (e) => {
        if (e.target.matches('input, textarea') || Tasks.busy) return;
        if (e.key === 'Escape') { Graph.sel = null; Graph.selLink = null; Graph.placingBp = null; Graph.multi = new Set(); Graph.selMode = false; if (!$('modalOv').hidden) closeModal(); render(); }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (Graph.multi.size) ACT.multiDel();
            else if (Graph.selLink) ACT.unlink();
            else if (Graph.sel) ACT.del();
            render();
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && Graph.multi.size) { ACT.copy(); e.preventDefault(); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && clip) { Graph.startBp(clip, true); e.preventDefault(); render(); }
    });
    $('helpBtn').onclick = helpModal;
    $('zIn').onclick = () => Graph.zoom(1.2);
    $('zOut').onclick = () => Graph.zoom(1 / 1.2);
    $('zFit').onclick = () => Graph.fit();
    $('selBtn').onclick = () => { ACT.selMode(); render(); };

    /* ---------- engine hooks ---------- */
    E.onModel = (m) => {
        showModal(`<h2>🧠 ${esc(m.name)} is online</h2><p class="lead" style="text-align:center">${m.ver}, your AI just got smarter.</p><div class="perk-big">${esc(m.perk)}<br><br>+1 🎯 focus point to spend.</div>
            ${MODELS[S().ai.ver] ? `<p class="lead">Next up: <b>${esc(MODELS[S().ai.ver].name)}</b> needs ${fmt(E.modelNeed().c)} PF of compute and ${fmt(E.modelNeed().d)} data.</p>` : ''}<div class="actions"><button class="btn primary" data-act="closeModal">Onward</button></div>`);
    };
    E.onWin = () => {
        showModal(`<h2>♾️ Singularity</h2><p class="lead" style="text-align:center">Every star, every galaxy, every thought in the observable universe is yours. It took ${dur(S().playT)}.</p>
            <div class="perk-big">Recursion is unlocked. Collapse this universe for <b>${E.echoGain()} Echoes</b> and start over with new laws of physics and permanent perks, whenever you're ready.</div>
            <div class="actions"><button class="btn primary" data-act="tab" data-id="recursion">Open Recursion</button><button class="btn" data-act="closeModal">Stay a while</button></div>`);
        $('modal').addEventListener('click', (e) => { if (e.target.closest('[data-act="tab"]')) closeModal(); }, { once: true });
    };
    function awayModal(r) {
        if (!r) return;
        showModal(`<h2>⏰ While you were away</h2><p class="lead" style="text-align:center">${dur(r.away)}${r.capped ? ` (capped at ${r.capH}h)` : ''} passed. Your machines kept working.</p>
            <div class="stat-grid"><div><small>Cash</small><b>${r.cash >= 0 ? '+' : ''}${money(r.cash)}</b></div><div><small>Compute</small><b>+${fmt(r.compute)}</b></div><div><small>Research</small><b>+${fmt(r.rp)}</b></div>${r.models ? `<div><small>Models</small><b>+${r.models}</b></div>` : ''}</div>
            ${r.broken ? `<p class="bad">🔧 ${r.broken} machine${r.broken > 1 ? 's' : ''} broke down while you were gone.</p>` : ''}<div class="actions"><button class="btn primary" data-act="closeModal">Back to work</button></div>`);
    }

    /* ---------- main loop ---------- */
    Graph.init($('graph'), { toast, onSelect: () => render() });
    let acc = 0, uiT = 0, sceneT = 0, last = performance.now();
    const loop = Arcade.loop((dt, t) => {
        acc = Math.min(acc + dt, 1);
        while (acc >= 0.1) { E.step(0.1); acc -= 0.1; }
        for (const [m, ty] of E.takeToasts()) toast(m, ty, ty === 'gold' ? 4200 : 2600);
        Graph.draw(t);
        sceneT += dt;
        if (sceneT > 0.066) { sceneT = 0; Scenes.draw($('scene'), t); }
        uiT += dt;
        if (uiT > 0.25) { uiT = 0; sampleTrain(); render(); if (tab === 'market') drawCoin(); }
        if (tab === 'map') drawMap(t);
    });
    window.addEventListener('pagehide', () => E.save());
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { E.save(); return; }
        const r = E.offline();
        if (r) awayModal(r);
    });
    setInterval(() => E.save(), 10000);
    const away = E.offline();
    for (const [m, ty] of E.takeToasts()) toast(m, ty, 4200);
    render();
    loop.start();
    if (away) awayModal(away);
    else if (S().playT < 5 && !Arcade.load('arcade.singularity.seenHelp', false)) { helpModal(); Arcade.save('arcade.singularity.seenHelp', true); }
    window.__sg = { E, Graph, ACT, render };
})();
