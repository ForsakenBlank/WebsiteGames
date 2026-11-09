/* The Tower — boot, the game loop, run lifecycle and timers. */
(() => {
    const G = window.TG, D = G.D, B = G.B, UI = G.UI;
    const $ = (id) => document.getElementById(id);
    const S = () => G.S;
    const main = G.main = {};
    let paused = false, lastFrame = performance.now();

    G.load();
    const s0 = S();
    if (!s0.gifted) { s0.gifted = true; for (const r of D.RELICS) if (r.src === 'gift') s0.relics[r.id] = Date.now(); }

    /* ---------- canvas ---------- */
    const canvas = $('c');
    // The field fills the whole space left of the upgrade panel: 720 logical pixels tall, as wide as the box allows
    const view = Arcade.fitCanvas(canvas, 720, 720, { max: 4, pad: 0 });
    const box = canvas.parentElement;
    function reshape() {
        const b = box.getBoundingClientRect();
        if (b.width < 10 || b.height < 10) return;
        const w = G.clamp(Math.round(720 * b.width / b.height), 360, 2400);
        if (w !== view.w) view.setSize(w, 720); else view.refit();
        G.R.init(view.ctx, view.w, view.h);
    }
    new ResizeObserver(reshape).observe(box);
    reshape();
    canvas.addEventListener('pointerdown', (e) => {
        const r = G.run();
        if (!r || !r.gem) return;
        const p = Arcade.pointer(canvas, e, view.w, view.h), w = G.R.toWorld(p.x, p.y);
        if (Math.hypot(w.x - r.gem.x, w.y - r.gem.y) < 9) B.tapGem();
    });

    /* ---------- speed ---------- */
    function speeds() {
        const list = [1];
        const lab = D.LAB_BY.Game_Speed;
        for (let i = 0; i < G.labLv('Game_Speed'); i++) list.push(lab.rows[i].n);
        const r = G.run();
        if (r && r.perks.gameSpeed) list.push(list[list.length - 1] + G.perkAdd(r, 'gameSpeed'));
        return [...new Set(list)];
    }
    function buildSpeeds() {
        // the game's [−] x2.0 [+] control, shown during a battle
        const host = $('speeds'), list = speeds(), cur = gameSpeed(), r = G.run();
        const key = r && !r.over ? list.join(',') + '|' + cur : '';
        if (host.dataset.k === key) return;
        host.dataset.k = key;
        if (!key) { host.innerHTML = ''; return; }
        const i = list.indexOf(cur);
        host.innerHTML = `<button data-speed="${list[Math.max(0, i - 1)]}" ${i <= 0 ? 'disabled' : ''} title="Slower">−</button><span>x${cur.toFixed(1)}</span><button data-speed="${list[Math.min(list.length - 1, i + 1)]}" ${i >= list.length - 1 ? 'disabled' : ''} title="Faster">+</button>`;
        host.title = list.length === 1 ? 'Research Game Speed in the Labs for faster speeds' : '';
    }
    $('speeds').addEventListener('click', (e) => { const b = e.target.closest('[data-speed]'); if (!b) return; S().settings.speed = +b.dataset.speed; G.saveSoon(); buildSpeeds(); });
    const gameSpeed = main.gameSpeed = () => { const l = speeds(); const v = S().settings.speed || 1; return l.includes(v) ? v : l[l.length - 1]; };

    /* ---------- run lifecycle ---------- */
    main.startRun = (opts) => {
        if (G.run() && !G.run().over) return;
        if (S().run && !opts.tour) { main.resumeRun(); return; }
        $('endOv').hidden = true;
        UI.closeMenu();
        B.start(opts);
        paused = false; $('pauseOv').hidden = true;
        Arcade.sfx('level');
        UI.tick(true);
    };
    main.resumeRun = () => {
        const snap = S().run;
        if (!snap) return;
        $('endOv').hidden = true;
        UI.closeMenu();
        B.resume(snap);
        UI.tick(true);
    };
    main.endRun = (why) => B.end(why);
    main.setPaused = (on) => { paused = on && !!G.run() && !G.run().over; $('pauseOv').hidden = !paused; };
    main.afterPerk = () => UI.tick(true);

    G.on('runEnd', (run, why) => {
        $('perkOv').hidden = true; $('pauseOv').hidden = true; paused = false;
        // remember the best coins per real minute (runs of 2+ minutes) for offline earnings
        if (!run.tour && run.stats.realT >= 120) S().offline.cpm = Math.max(S().offline.cpm || 0, run.stats.coins / (run.stats.realT / 60));
        Arcade.sfx('die');
        const auto = why !== 'quit' && !run.tour && (G.apOn('restart') || G.vaultLv('autoRestart'));
        UI.showEnd(run, auto);
        if (auto) setTimeout(() => { if (!G.run() && B.lastRun() === run && !S().run) main.startRun({ tier: run.tier, diss: run.diss }); }, 2500);
        UI.tick(true);
    });

    /* ---------- simulation ---------- */
    const STEP = 1 / 30;
    function simulate(realDt) {
        const r = G.run();
        if (!r || r.over || paused) return;
        // Not in the real game: everything runs three times as fast, so "1×" is the old 3×
        let left = realDt * gameSpeed() * 3;
        r.stats.realT = (r.stats.realT || 0) + realDt;
        // play time at x1 speed, so coin rates can be shown per game minute or scaled to the current speed
        r.stats.gameT = (r.stats.gameT ?? r.stats.realT) + realDt * gameSpeed();
        let n = 0;
        while (left > 0 && n++ < 80 && !r.over) {
            const d = Math.min(STEP, left);
            B.step(d);
            left -= d;
        }
        // perks wait for you unless auto pick is on
        if (r.offers.length && G.labDone('Auto_Perk_Pick') && S().perks.auto) while (r.offers.length) B.autoPick();
        // play-time timers
        S().free.coinBoost = Math.max(0, (S().free.coinBoost || 0) - realDt);
        if (S().free.coinBoost === 0 && r.s.coinMult && r._boostWas) B.recalc();
        r._boostWas = S().free.coinBoost > 0;
        G.adGemTick(realDt);
        r.autoBuyT += realDt;
        if (r.autoBuyT > 0.5) { r.autoBuyT = 0; G.autoBuy(); }
    }

    const loop = Arcade.loop((dt) => {
        lastFrame = performance.now();
        simulate(dt);
        G.R.draw(dt);
        UI.frame();
    });

    // The background play setting: browsers stop animation frames in hidden tabs, so catch up from a timer
    setInterval(() => {
        const r = G.run();
        if (!document.hidden || !r || r.over) return;
        if (!S().settings.bgPlay) return;
        const now = performance.now();
        const away = Math.min(30, (now - lastFrame) / 1000);
        lastFrame = now;
        simulate(away);
    }, 1000);
    document.addEventListener('visibilitychange', () => {
        lastFrame = performance.now();
        if (document.hidden && G.run() && !G.run().over && !S().settings.bgPlay) main.setPaused(true);
    });

    /* ---------- timers ---------- */
    function minute() {
        G.labTick();
        G.ensureDaily();
        G.ensureEvent();
        G.ensureTournament();
        G.ensureGuild();
        G.checkYearRelics();
        if (G.apOn('gems')) { if (S().free.adStack) G.claimAdGems(); if (G.dailyGemsReady()) G.claimDailyGems(); }
    }
    setInterval(minute, 1000);
    setInterval(() => { buildSpeeds(); UI.tick(false); }, 250);
    setInterval(() => G.save(), 10000);
    window.addEventListener('beforeunload', () => G.save());

    /* ---------- keys ---------- */
    window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if (e.code === 'Escape') { if (UI.menuOpen()) { UI.closeMenu(); UI.tick(true); return; } if (!$('perkOv').hidden) { $('perkOv').hidden = true; return; } }
        if (e.code === 'KeyP' || e.code === 'Escape') main.setPaused(!paused);
        if (e.code === 'Digit1') B.demon();
        if (e.code === 'Digit2') B.nuke();
        if (e.code === 'Digit3') B.barrage();
    });
    $('pauseBtn').addEventListener('click', () => main.setPaused(!paused));

    /* ---------- boot ---------- */
    // Not in the real game: offline earnings, 25% of your best coins per minute for up to 12 hours away
    (function offlineEarnings() {
        const away = Math.min(12 * 60, (Date.now() - (s0.lastSeen || Date.now())) / 60000);
        const n = Math.floor(away * (s0.offline.cpm || 0) * 0.25);
        if (away < 1 || n <= 0) return;
        G.add('coins', n, 'offline');
        setTimeout(() => G.toast(`🌙 Offline earnings: +${G.fmt(n)} 🪙 (${Math.floor(away / 60)}h ${Math.floor(away % 60)}m away)`, 'gold', 6000), 600);
    })();
    minute();
    buildSpeeds();
    UI.tick(true);
    loop.start();
    if (!S().stats.runs) setTimeout(() => G.toast('🗼 Welcome to The Tower! Press Battle to start. Coins from runs buy permanent Workshop upgrades.', 'gold', 7000), 400);
    window.__tower = { G, D, B, get S() { return G.S; }, get run() { return G.run(); } }; // for testing
})();
