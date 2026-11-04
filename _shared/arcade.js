/* ==========================================================
   ARCADE — small helper library shared by every game.
   Exposes a single global: window.Arcade
   ========================================================== */
(function () {
    'use strict';

    const Arcade = {};

    /* ---------- Storage (never throws) ---------- */
    Arcade.load = function (key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null || raw === undefined) return fallback;
            return JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    };

    Arcade.save = function (key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ }
    };

    Arcade.remove = function (key) {
        try { localStorage.removeItem(key); } catch (e) { }
    };

    /** Records a score. Returns { best, isNew }. */
    Arcade.best = function (key, score, lowerIsBetter) {
        const prev = Number(Arcade.load(key, lowerIsBetter ? 0 : 0)) || 0;
        const better = lowerIsBetter ? (prev === 0 || score < prev) : score > prev;
        if (better && score > 0) {
            Arcade.save(key, score);
            return { best: score, isNew: true };
        }
        return { best: prev, isNew: false };
    };

    /* ---------- Number formatting ---------- */
    const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
    Arcade.fmt = function (n, digits) {
        if (n === undefined || n === null || isNaN(n)) return '0';
        if (!isFinite(n)) return '∞';
        const neg = n < 0;
        n = Math.abs(n);
        let out;
        if (n < 1000) {
            out = n < 10 && n % 1 !== 0 ? n.toFixed(digits === undefined ? 1 : digits).replace(/\.0+$/, '') : Math.floor(n).toLocaleString();
        } else {
            const tier = Math.floor(Math.log10(n) / 3);
            if (tier < UNITS.length) {
                const v = n / Math.pow(1000, tier);
                out = (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + UNITS[tier];
            } else {
                out = n.toExponential(2).replace('+', '');
            }
        }
        return (neg ? '-' : '') + out;
    };

    Arcade.time = function (sec) {
        sec = Math.max(0, Math.floor(sec));
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
        const pad = (x) => String(x).padStart(2, '0');
        return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
    };

    /* ---------- DOM helpers ---------- */
    Arcade.$ = (sel, root) => (root || document).querySelector(sel);
    Arcade.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
    const el = (x) => (typeof x === 'string' ? document.getElementById(x) : x);
    Arcade.show = (x) => { const e = el(x); if (e) e.hidden = false; };
    Arcade.hide = (x) => { const e = el(x); if (e) e.hidden = true; };
    Arcade.text = (x, v) => { const e = el(x); if (e && e.textContent !== String(v)) e.textContent = v; };

    /* ---------- Toasts ---------- */
    Arcade.toast = function (msg, type, ms) {
        let host = document.getElementById('toasts');
        if (!host) {
            host = document.createElement('div');
            host.id = 'toasts';
            document.body.appendChild(host);
        }
        const t = document.createElement('div');
        t.className = 'toast' + (type ? ' ' + type : '');
        t.textContent = msg;
        host.appendChild(t);
        while (host.children.length > 4) host.firstChild.remove();
        setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms || 2200);
    };

    /* ---------- Sound (tiny synth, no files) ---------- */
    let audio = null;
    Arcade.muted = !!Arcade.load('arcade.muted', false);

    function ctx() {
        if (!audio) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            audio = new AC();
        }
        if (audio.state === 'suspended') audio.resume();
        return audio;
    }

    function tone(freq, dur, type, vol, slideTo, delay) {
        const a = ctx();
        if (!a) return;
        const t0 = a.currentTime + (delay || 0);
        const o = a.createOscillator();
        const g = a.createGain();
        o.type = type || 'square';
        o.frequency.setValueAtTime(freq, t0);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol || 0.08, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g).connect(a.destination);
        o.start(t0);
        o.stop(t0 + dur + 0.02);
    }

    function noise(dur, vol) {
        const a = ctx();
        if (!a) return;
        const len = Math.floor(a.sampleRate * dur);
        const buf = a.createBuffer(1, len, a.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = a.createBufferSource();
        const g = a.createGain();
        g.gain.value = vol || 0.08;
        src.buffer = buf;
        src.connect(g).connect(a.destination);
        src.start();
    }

    const SFX = {
        click: () => tone(520, 0.05, 'square', 0.04),
        select: () => tone(660, 0.06, 'triangle', 0.06),
        pop: () => tone(300, 0.08, 'sine', 0.09, 900),
        coin: () => { tone(988, 0.07, 'square', 0.05); tone(1319, 0.12, 'square', 0.05, null, 0.07); },
        score: () => tone(740, 0.09, 'triangle', 0.07, 1100),
        shoot: () => tone(880, 0.07, 'square', 0.025, 220),
        hit: () => { noise(0.08, 0.06); tone(180, 0.08, 'sawtooth', 0.04, 80); },
        boom: () => { noise(0.35, 0.12); tone(120, 0.3, 'sawtooth', 0.06, 40); },
        power: () => { tone(440, 0.08, 'square', 0.05, 880); tone(660, 0.12, 'square', 0.05, 1320, 0.08); },
        bad: () => tone(200, 0.18, 'sawtooth', 0.06, 110),
        die: () => { tone(440, 0.15, 'square', 0.06, 220); tone(330, 0.2, 'square', 0.06, 110, 0.14); tone(220, 0.35, 'square', 0.06, 55, 0.32); },
        win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.07, null, i * 0.1)),
        level: () => [392, 523, 659].forEach((f, i) => tone(f, 0.12, 'square', 0.05, null, i * 0.08)),
        tick: () => tone(1200, 0.02, 'square', 0.02),
    };

    Arcade.sfx = function (name) {
        if (Arcade.muted) return;
        try { (SFX[name] || SFX.click)(); } catch (e) { }
    };

    /** Plays a single synth note (respects mute). For pitched feedback like rising combos. */
    Arcade.tone = function (freq, dur, type, vol, slideTo, delay) {
        if (Arcade.muted) return;
        try { tone(freq, dur, type, vol, slideTo, delay); } catch (e) { }
    };

    Arcade.setMuted = function (m) {
        Arcade.muted = !!m;
        Arcade.save('arcade.muted', Arcade.muted);
        Arcade.$$('[data-mute]').forEach(b => {
            b.textContent = Arcade.muted ? '🔇' : '🔊';
            b.title = Arcade.muted ? 'Unmute' : 'Mute';
        });
    };

    /* ---------- Canvas fitting ---------- */
    /**
     * Scales a canvas to fit inside its parent while keeping a fixed logical
     * resolution (w x h). Drawing code always uses logical coordinates.
     */
    Arcade.fitCanvas = function (canvas, w, h, opts) {
        opts = opts || {};
        const c2d = canvas.getContext('2d');
        const view = { ctx: c2d, w, h, scale: 1 };
        function fit() {
            const parent = opts.parent || canvas.parentElement;
            const r = parent.getBoundingClientRect();
            const pad = opts.pad === undefined ? 4 : opts.pad;
            w = view.w; h = view.h;
            const s = Math.max(0.2, Math.min((r.width - pad * 2) / w, (r.height - pad * 2) / h, opts.max || 3));
            canvas.style.width = Math.floor(w * s) + 'px';
            canvas.style.height = Math.floor(h * s) + 'px';
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(w * s * dpr);
            canvas.height = Math.round(h * s * dpr);
            c2d.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
            view.scale = s;
            if (opts.onResize) opts.onResize(view);
        }
        view.refit = fit;
        /** Changes the logical resolution (e.g. a different level size) and refits. */
        view.setSize = function (nw, nh) { view.w = nw; view.h = nh; fit(); };
        window.addEventListener('resize', fit);
        fit();
        return view;
    };

    /** Converts a pointer/mouse event into logical canvas coordinates. */
    Arcade.pointer = function (canvas, e, logicalW, logicalH) {
        const r = canvas.getBoundingClientRect();
        const p = e.touches && e.touches[0] ? e.touches[0] : (e.changedTouches && e.changedTouches[0]) || e;
        return {
            x: (p.clientX - r.left) * (logicalW / r.width),
            y: (p.clientY - r.top) * ((logicalH || logicalW * r.height / r.width) / r.height),
        };
    };

    /* ---------- Swipe detection ---------- */
    Arcade.swipe = function (target, cb, min) {
        let sx = 0, sy = 0, active = false;
        min = min || 24;
        target.addEventListener('touchstart', (e) => {
            const t = e.touches[0]; sx = t.clientX; sy = t.clientY; active = true;
        }, { passive: true });
        target.addEventListener('touchmove', (e) => {
            if (!active) return;
            const t = e.touches[0];
            const dx = t.clientX - sx, dy = t.clientY - sy;
            if (Math.abs(dx) < min && Math.abs(dy) < min) return;
            active = false;
            if (Math.abs(dx) > Math.abs(dy)) cb(dx > 0 ? 'right' : 'left');
            else cb(dy > 0 ? 'down' : 'up');
        }, { passive: true });
        target.addEventListener('touchend', () => { active = false; }, { passive: true });
    };

    /* ---------- Game loop ---------- */
    Arcade.loop = function (step) {
        let last = 0, id = 0, running = false;
        function frame(t) {
            if (!running) return;
            const dt = Math.min(0.05, last ? (t - last) / 1000 : 1 / 60);
            last = t;
            step(dt, t / 1000);
            id = requestAnimationFrame(frame);
        }
        return {
            start() { if (running) return; running = true; last = 0; id = requestAnimationFrame(frame); },
            stop() { running = false; cancelAnimationFrame(id); },
            get running() { return running; },
        };
    };

    /* ---------- Particles ---------- */
    Arcade.Particles = class {
        constructor(max) { this.list = []; this.max = max || 400; }
        emit(x, y, o) {
            o = o || {};
            const n = o.n || 12;
            for (let i = 0; i < n && this.list.length < this.max; i++) {
                const a = o.angle !== undefined ? o.angle + (Math.random() - 0.5) * (o.spread || Math.PI * 2) : Math.random() * Math.PI * 2;
                const sp = (o.speed || 120) * (0.35 + Math.random() * 0.8);
                this.list.push({
                    x, y,
                    vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                    life: (o.life || 0.6) * (0.6 + Math.random() * 0.6),
                    max: o.life || 0.6,
                    size: (o.size || 3) * (0.6 + Math.random() * 0.8),
                    color: Array.isArray(o.color) ? o.color[(Math.random() * o.color.length) | 0] : (o.color || '#fff'),
                    g: o.gravity || 0,
                    drag: o.drag === undefined ? 0.92 : o.drag,
                    shape: o.shape || 'square',
                });
            }
        }
        update(dt) {
            const L = this.list;
            for (let i = L.length - 1; i >= 0; i--) {
                const p = L[i];
                p.life -= dt;
                if (p.life <= 0) { L[i] = L[L.length - 1]; L.pop(); continue; }
                p.vy += p.g * dt;
                const d = Math.pow(p.drag, dt * 60);
                p.vx *= d; p.vy *= d;
                p.x += p.vx * dt; p.y += p.vy * dt;
            }
        }
        draw(c) {
            for (const p of this.list) {
                c.globalAlpha = Math.max(0, Math.min(1, p.life / p.max * 1.4));
                c.fillStyle = p.color;
                if (p.shape === 'circle') { c.beginPath(); c.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2); c.fill(); }
                else c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            }
            c.globalAlpha = 1;
        }
        clear() { this.list.length = 0; }
    };

    /* ---------- Misc math ---------- */
    Arcade.rand = (a, b) => a + Math.random() * (b - a);
    Arcade.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
    Arcade.pick = (arr) => arr[(Math.random() * arr.length) | 0];
    Arcade.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    Arcade.lerp = (a, b, t) => a + (b - a) * t;
    Arcade.shuffle = (arr) => {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    };

    /* ==========================================================
       META — profile, arcade XP, coins, achievements, daily and
       weekly challenges, play time. Shared by every game and the hub.
       Games only need to call Arcade.report() / Arcade.count().
       ========================================================== */
    const META_KEY = 'arcade.meta';

    /** Folder name → hub game id. New games use their lowercase folder name. */
    const FOLDER_IDS = {
        Snake: 'snake', PacMan: 'pacman', GravityRunner: 'gravity', StarShooter: 'starshooter', SuperShot: 'supershot',
        TowerStacker: 'stacker', Encrypter: 'encrypter', ShapeMatch: 'shapematch', Minesweeper: 'minesweeper',
        ColourSort: 'coloursort', TapMatch: 'tapmatch', Petdoku: 'petdoku', PetSudoku: 'petsudoku', WoodBlocks: 'woodblocks',
        '2048': '2048', Wordle: 'wordle', Ludo: 'ludo', TheTower: 'thetower', ChickenFarming: 'chicken',
        EssenceFarming: 'essence', Automato: 'automato', UploadLabs: 'uploadlabs', InfiniteInk: 'infiniteink',
        BounceLab: 'physics', SnakesLadders: 'snakesladders', TicTacToe: 'tictactoe', IdleMiner: 'idleminer',
        TowerDefense: 'towerdefense', AimTrainer: 'aimtrainer',
    };
    Arcade.gameId = (function () {
        try {
            const parts = decodeURIComponent(location.pathname).split(/[\\/]/).filter(Boolean);
            const last = parts[parts.length - 1] || '';
            const folder = !last.includes('.') ? last : parts.length > 1 ? parts[parts.length - 2] : '';
            if (!folder || /everygame/i.test(folder)) return null;
            return FOLDER_IDS[folder] || folder.toLowerCase();
        } catch (e) { return null; }
    })();

    function freshMeta() {
        return {
            v: 1, xp: 0, coins: 0, coinFrac: 0,
            profile: { name: '', avatar: '🙂' },
            playtime: {}, sessions: {}, lastSeen: {},
            stats: {}, ach: {},
            owned: { theme: ['dark'], 'snake.skin': ['classic'], 'pacman.color': ['yellow'] },
            equip: { theme: 'dark', 'snake.skin': 'classic', 'pacman.color': 'yellow' },
            daily: null, weekly: null, dailyDone: 0, weeklyDone: 0, streak: 0, lastDaily: '',
            started: Date.now(),
        };
    }
    function readMeta() {
        const m = Object.assign(freshMeta(), Arcade.load(META_KEY, {}) || {});
        for (const k of ['owned', 'equip', 'profile']) m[k] = Object.assign(freshMeta()[k], m[k] || {});
        return m;
    }
    /** Re-reads storage before every change so several open tabs don't overwrite each other. */
    function mutate(fn) {
        const m = readMeta();
        const out = fn(m);
        Arcade.save(META_KEY, m);
        checkMetaAchievements(m);
        return out;
    }
    Arcade.meta = readMeta;

    /* ---------- Levels ---------- */
    const needFor = (lvl) => 50 * lvl + 50;
    Arcade.levelInfo = function (xp) {
        let lvl = 1, left = Math.floor(xp || 0);
        while (left >= needFor(lvl)) { left -= needFor(lvl); lvl++; }
        return { level: lvl, into: left, need: needFor(lvl), pct: left / needFor(lvl) };
    };

    Arcade.addCoins = function (n) {
        if (!n) return;
        mutate(m => { m.coins = Math.max(0, Math.floor(m.coins + n)); });
    };
    Arcade.spendCoins = function (n) {
        return mutate(m => { if (m.coins < n) return false; m.coins -= n; return true; });
    };

    /** Every 5 XP also earns 1 arcade coin. */
    Arcade.addXP = function (n, quiet) {
        if (!(n > 0)) return;
        let up = 0;
        mutate(m => {
            const before = Arcade.levelInfo(m.xp).level;
            m.xp += n;
            m.coinFrac = (m.coinFrac || 0) + n / 5;
            const whole = Math.floor(m.coinFrac);
            m.coins += whole; m.coinFrac -= whole;
            const after = Arcade.levelInfo(m.xp).level;
            if (after > before) { up = after; m.coins += 25 * (after - before); }
        });
        if (up) { Arcade.toast(`⭐ Arcade level ${up}! +${25} coins`, 'gold', 3200); Arcade.sfx('level'); }
        else if (!quiet && n >= 10) Arcade.toast(`+${Math.round(n)} XP`, 'good', 1400);
    };

    /* ---------- Achievements ---------- */
    // `g` + `stat` + `min`: unlocks when that game's stat (best or running count) reaches min.
    // `test(meta)`: arcade-wide conditions.
    const gamesOpened = (m) => Object.keys(m.sessions).length;
    const totalTime = (m) => Object.values(m.playtime).reduce((a, b) => a + b, 0);
    Arcade.ACHIEVEMENTS = [
        { id: 'hello', icon: '👋', title: 'Welcome', desc: 'Open your first game.', test: m => gamesOpened(m) >= 1, xp: 10 },
        { id: 'explorer5', icon: '🧭', title: 'Explorer', desc: 'Open 5 different games.', test: m => gamesOpened(m) >= 5, xp: 30 },
        { id: 'explorer15', icon: '🗺️', title: 'Globetrotter', desc: 'Open 15 different games.', test: m => gamesOpened(m) >= 15, xp: 80 },
        { id: 'explorer30', icon: '🌍', title: 'Completionist', desc: 'Open 30 different games.', test: m => gamesOpened(m) >= 30, xp: 200 },
        { id: 'time1', icon: '⏱️', title: 'Warmed Up', desc: 'Play for 1 hour in total.', test: m => totalTime(m) >= 3600, xp: 40 },
        { id: 'time10', icon: '⌛', title: 'Regular', desc: 'Play for 10 hours in total.', test: m => totalTime(m) >= 36000, xp: 150 },
        { id: 'time50', icon: '🕰️', title: 'Arcade Rat', desc: 'Play for 50 hours in total.', test: m => totalTime(m) >= 180000, xp: 500 },
        { id: 'lvl5', icon: '🥉', title: 'Level 5', desc: 'Reach arcade level 5.', test: m => Arcade.levelInfo(m.xp).level >= 5, xp: 0 },
        { id: 'lvl10', icon: '🥈', title: 'Level 10', desc: 'Reach arcade level 10.', test: m => Arcade.levelInfo(m.xp).level >= 10, xp: 0 },
        { id: 'lvl25', icon: '🥇', title: 'Level 25', desc: 'Reach arcade level 25.', test: m => Arcade.levelInfo(m.xp).level >= 25, xp: 0 },
        { id: 'daily1', icon: '📅', title: 'Daily Grind', desc: 'Complete a daily challenge.', test: m => m.dailyDone >= 1, xp: 20 },
        { id: 'daily7', icon: '🗓️', title: 'Habit Forming', desc: 'Complete 7 daily challenges.', test: m => m.dailyDone >= 7, xp: 100 },
        { id: 'streak3', icon: '🔥', title: 'On Fire', desc: 'Complete daily challenges 3 days in a row.', test: m => m.streak >= 3, xp: 60 },
        { id: 'weekly1', icon: '🏅', title: 'Weekly Warrior', desc: 'Complete a weekly challenge.', test: m => m.weeklyDone >= 1, xp: 60 },
        { id: 'shopper', icon: '🛍️', title: 'Shopper', desc: 'Buy something from the arcade shop.', test: m => Object.values(m.owned).reduce((a, l) => a + l.length, 0) > 3, xp: 20 },
        { id: 'named', icon: '🪪', title: 'Who Am I?', desc: 'Set a profile name.', test: m => !!(m.profile.name || '').trim(), xp: 10 },
        { id: 'rich', icon: '💰', title: 'Coin Hoarder', desc: 'Hold 1,000 arcade coins at once.', test: m => m.coins >= 1000, xp: 50 },
        // per-game
        { id: 'snake50', g: 'snake', stat: 'score', min: 50, icon: '🐍', title: 'Long Boi', desc: 'Score 50 in Snake.', xp: 30 },
        { id: 'snakecamp', g: 'snake', stat: 'campaign', min: 10, icon: '🗺️', title: 'Snake Trail', desc: 'Clear 10 Snake campaign levels.', xp: 50 },
        { id: 'pac10k', g: 'pacman', stat: 'score', min: 10000, icon: '🟡', title: 'Waka Waka', desc: 'Score 10,000 in Pac-Man.', xp: 40 },
        { id: 'pacghost', g: 'pacman', stat: 'ghostwin', min: 1, icon: '👻', title: 'Role Reversal', desc: 'Catch Pac-Man as a ghost.', xp: 40 },
        { id: 'grav1k', g: 'gravity', stat: 'distance', min: 1000, icon: '🔄', title: 'Gravity Defier', desc: 'Run 1,000m in Gravity Runner.', xp: 40 },
        { id: 'star10', g: 'starshooter', stat: 'wave', min: 10, icon: '🚀', title: 'Station Keeper', desc: 'Reach wave 10 in Star Shooter.', xp: 40 },
        { id: 'starboss', g: 'starshooter', stat: 'bossrush', min: 3, icon: '👾', title: 'Boss Hunter', desc: 'Beat 3 bosses in Boss Rush.', xp: 50 },
        { id: 'super3', g: 'supershot', stat: 'stars', min: 15, icon: '⏱️', title: 'Time Bender', desc: 'Earn 15 stars in SUPERSHOT.', xp: 50 },
        { id: 'stack30', g: 'stacker', stat: 'floors', min: 30, icon: '🏗️', title: 'Skyscraper', desc: 'Stack 30 floors.', xp: 30 },
        { id: 'enc10', g: 'encrypter', stat: 'level', min: 10, icon: '🧬', title: 'Firewall', desc: 'Reach level 10 in Encrypter.', xp: 40 },
        { id: 'shape10', g: 'shapematch', stat: 'level', min: 10, icon: '🔺', title: 'Sorted', desc: 'Reach level 10 in Shape Match.', xp: 40 },
        { id: 'mineswin', g: 'minesweeper', stat: 'win', min: 1, icon: '💣', title: 'Sweeper', desc: 'Win a game of Minesweeper.', xp: 20 },
        { id: 'mineshard', g: 'minesweeper', stat: 'win.hard', min: 1, icon: '🎖️', title: 'Bomb Squad', desc: 'Win Minesweeper on Hard.', xp: 60 },
        { id: 'sort25', g: 'coloursort', stat: 'win', min: 25, icon: '🧪', title: 'Mixologist', desc: 'Solve 25 Colour Sort levels.', xp: 50 },
        { id: 'tap10', g: 'tapmatch', stat: 'win', min: 10, icon: '🍓', title: 'Tile Tamer', desc: 'Win 10 Tap Match boards.', xp: 40 },
        { id: 'pet10', g: 'petdoku', stat: 'win', min: 10, icon: '🐾', title: 'Pet Whisperer', desc: 'Solve 10 Petdoku puzzles.', xp: 40 },
        { id: 'sudoku5', g: 'petsudoku', stat: 'win', min: 5, icon: '🐶', title: 'Good Boy', desc: 'Solve 5 Pet Sudokus.', xp: 40 },
        { id: 'wood5k', g: 'woodblocks', stat: 'score', min: 5000, icon: '🪵', title: 'Lumberjack', desc: 'Score 5,000 in Wood Blocks.', xp: 40 },
        { id: 't2048', g: '2048', stat: 'tile', min: 2048, icon: '🔢', title: '2048!', desc: 'Make the 2048 tile.', xp: 80 },
        { id: 'wordle10', g: 'wordle', stat: 'win', min: 10, icon: '🟩', title: 'Wordsmith', desc: 'Win 10 Wordles.', xp: 50 },
        { id: 'ludowin', g: 'ludo', stat: 'win', min: 1, icon: '🎲', title: 'Home Run', desc: 'Win a game of Ludo.', xp: 20 },
        { id: 'tetris40', g: 'blocks', stat: 'lines', min: 40, icon: '🧱', title: 'Line Clearer', desc: 'Clear 40 lines in one Falling Blocks game.', xp: 40 },
        { id: 'flappy25', g: 'flappy', stat: 'score', min: 25, icon: '🐤', title: 'Frequent Flyer', desc: 'Pass 25 gaps in Flappy.', xp: 40 },
        { id: 'slice100', g: 'slicer', stat: 'score', min: 100, icon: '🍉', title: 'Sushi Chef', desc: 'Score 100 in Fruit Slicer.', xp: 40 },
        { id: 'surv10', g: 'survivors', stat: 'minutes', min: 10, icon: '🧛', title: 'Survivor', desc: 'Survive 10 minutes in Night Survivors.', xp: 80 },
        { id: 'type80', g: 'typing', stat: 'wpm', min: 80, icon: '⌨️', title: 'Speed Typist', desc: 'Type at 80 WPM.', xp: 50 },
        { id: 'react200', g: 'aimtrainer', stat: 'reactionFast', min: 1, icon: '⚡', title: 'Lightning', desc: 'Get a reaction time under 200ms.', xp: 40 },
        { id: 'uno', g: 'cards', stat: 'win', min: 1, icon: '🃏', title: 'Last Card', desc: 'Win a game of Crazy Cards.', xp: 20 },
        { id: 'yahtzee', g: 'dice', stat: 'yahtzee', min: 1, icon: '🎲', title: 'Five of a Kind', desc: 'Roll five of a kind in Dice Poker.', xp: 30 },
        { id: 'fleet', g: 'battleship', stat: 'win', min: 1, icon: '🚢', title: 'Admiral', desc: 'Sink the enemy fleet.', xp: 20 },
        { id: 'flow', g: 'flow', stat: 'win', min: 20, icon: '🔗', title: 'Go With the Flow', desc: 'Solve 20 Flow puzzles.', xp: 40 },
        { id: 'fish', g: 'fishing', stat: 'legendary', min: 1, icon: '🐋', title: 'The Big One', desc: 'Catch a legendary fish.', xp: 60 },
        { id: 'td', g: 'towerdefense', stat: 'wave', min: 20, icon: '🏰', title: 'Hold the Line', desc: 'Survive 20 waves in Tower Defense.', xp: 50 },
    ];

    function unlockAch(m, a) {
        if (m.ach[a.id]) return false;
        m.ach[a.id] = Date.now();
        m.xp += a.xp || 0;
        m.coins += Math.round(10 + (a.xp || 0) / 2);
        return true;
    }
    function announce(list) {
        list.forEach((a, i) => setTimeout(() => {
            Arcade.toast(`🏆 Achievement: ${a.icon} ${a.title}`, 'gold', 3600);
            Arcade.sfx('win');
        }, i * 700));
    }
    function checkMetaAchievements(m) {
        const got = [];
        for (const a of Arcade.ACHIEVEMENTS) if (a.test && !m.ach[a.id] && a.test(m)) { if (unlockAch(m, a)) got.push(a); }
        if (got.length) { Arcade.save(META_KEY, m); announce(got); }
    }

    /* ---------- Daily & weekly challenges ---------- */
    // kind 'max': reach n in a single run. kind 'count': add up n over the day/week.
    Arcade.CHALLENGES = [
        { g: 'snake', stat: 'score', kind: 'max', d: 30, w: 80, text: 'Score {n} in Snake' },
        { g: 'pacman', stat: 'score', kind: 'max', d: 3000, w: 15000, text: 'Score {n} in Pac-Man' },
        { g: 'gravity', stat: 'distance', kind: 'max', d: 400, w: 1500, text: 'Run {n}m in Gravity Runner' },
        { g: 'starshooter', stat: 'wave', kind: 'max', d: 5, w: 12, text: 'Reach wave {n} in Star Shooter' },
        { g: 'stacker', stat: 'floors', kind: 'max', d: 15, w: 40, text: 'Stack {n} floors in Tower Stacker' },
        { g: 'encrypter', stat: 'score', kind: 'max', d: 400, w: 2000, text: 'Score {n} in Encrypter' },
        { g: 'shapematch', stat: 'score', kind: 'max', d: 300, w: 1500, text: 'Score {n} in Shape Match' },
        { g: 'minesweeper', stat: 'win', kind: 'count', d: 2, w: 10, text: 'Win {n} games of Minesweeper' },
        { g: 'coloursort', stat: 'win', kind: 'count', d: 3, w: 20, text: 'Solve {n} Colour Sort levels' },
        { g: 'tapmatch', stat: 'win', kind: 'count', d: 2, w: 10, text: 'Win {n} Tap Match boards' },
        { g: 'petdoku', stat: 'win', kind: 'count', d: 2, w: 10, text: 'Solve {n} Petdoku puzzles' },
        { g: 'petsudoku', stat: 'win', kind: 'count', d: 1, w: 6, text: 'Solve {n} Pet Sudokus' },
        { g: 'woodblocks', stat: 'score', kind: 'max', d: 1500, w: 6000, text: 'Score {n} in Wood Blocks' },
        { g: '2048', stat: 'tile', kind: 'max', d: 256, w: 2048, text: 'Make the {n} tile in 2048' },
        { g: 'wordle', stat: 'win', kind: 'count', d: 2, w: 10, text: 'Win {n} Wordles' },
        { g: 'ludo', stat: 'win', kind: 'count', d: 1, w: 4, text: 'Win {n} games of Ludo' },
        { g: 'blocks', stat: 'lines', kind: 'max', d: 20, w: 80, text: 'Clear {n} lines in Falling Blocks' },
        { g: 'flappy', stat: 'score', kind: 'max', d: 10, w: 40, text: 'Pass {n} gaps in Flappy' },
        { g: 'slicer', stat: 'score', kind: 'max', d: 50, w: 200, text: 'Score {n} in Fruit Slicer' },
        { g: 'pong', stat: 'win', kind: 'count', d: 1, w: 5, text: 'Beat the AI in Pong {n}×' },
        { g: 'survivors', stat: 'minutes', kind: 'max', d: 5, w: 15, text: 'Survive {n} minutes in Night Survivors' },
        { g: 'typing', stat: 'wpm', kind: 'max', d: 40, w: 70, text: 'Type at {n} WPM' },
        { g: 'flow', stat: 'win', kind: 'count', d: 3, w: 20, text: 'Solve {n} Flow puzzles' },
        { g: 'pipes', stat: 'win', kind: 'count', d: 3, w: 20, text: 'Solve {n} Pipe puzzles' },
        { g: 'tictactoe', stat: 'win', kind: 'count', d: 2, w: 10, text: 'Win {n} games of Tic-Tac-Toe' },
        { g: 'battleship', stat: 'win', kind: 'count', d: 1, w: 5, text: 'Win {n} games of Battleship' },
        { g: 'dice', stat: 'score', kind: 'max', d: 180, w: 280, text: 'Score {n} in Dice Poker' },
        { g: 'cards', stat: 'win', kind: 'count', d: 1, w: 5, text: 'Win {n} games of Crazy Cards' },
        { g: 'physics', stat: 'score', kind: 'max', d: 500, w: 3000, text: 'Score {n} in Bounce Lab' },
        { g: 'towerdefense', stat: 'wave', kind: 'max', d: 10, w: 25, text: 'Reach wave {n} in Tower Defense' },
    ];
    const dayKey = (d) => { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const weekKey = (d) => { d = new Date(d || Date.now()); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return 'W' + dayKey(d); };
    const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
    Arcade.dayKey = dayKey;
    Arcade.hash = hashStr;
    /** A seeded random generator (mulberry32). Same seed → same numbers. */
    Arcade.seeded = function (seed) {
        let a = typeof seed === 'string' ? hashStr(seed) : seed >>> 0;
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    };
    function challengeFor(kind, key) {
        const list = Arcade.CHALLENGES;
        const c = list[hashStr(key + kind) % list.length];
        const n = kind === 'daily' ? c.d : c.w;
        return { key, g: c.g, stat: c.stat, kind: c.kind, n, text: c.text.replace('{n}', Arcade.fmt(n)), prog: 0, done: false,
                 xp: kind === 'daily' ? 150 : 500, coins: kind === 'daily' ? 50 : 200 };
    }
    /** Returns today's daily and this week's weekly challenge (with progress). */
    Arcade.challenges = function () {
        return mutate(m => {
            const dk = dayKey(), wk = weekKey();
            if (!m.daily || m.daily.key !== dk) m.daily = challengeFor('daily', dk);
            if (!m.weekly || m.weekly.key !== wk) m.weekly = challengeFor('weekly', wk);
            return { daily: m.daily, weekly: m.weekly };
        });
    };
    function progressChallenges(m, gid, stat, value, isCount) {
        const done = [];
        for (const slot of ['daily', 'weekly']) {
            const c = m[slot];
            if (!c || c.done || c.g !== gid || c.stat !== stat) continue;
            if (slot === 'daily' && c.key !== dayKey()) continue;
            if (slot === 'weekly' && c.key !== weekKey()) continue;
            if (c.kind === 'count') c.prog += isCount ? value : 0;
            else c.prog = Math.max(c.prog, isCount ? 0 : value);
            if (c.prog >= c.n) {
                c.done = true;
                m.xp += c.xp; m.coins += c.coins;
                if (slot === 'daily') {
                    m.dailyDone++;
                    const y = new Date(); y.setDate(y.getDate() - 1);
                    m.streak = m.lastDaily === dayKey(y) ? m.streak + 1 : 1;
                    m.lastDaily = dayKey();
                } else m.weeklyDone++;
                done.push([slot, c]);
            }
        }
        return done;
    }

    function recordStat(stat, value, isCount) {
        const gid = Arcade.gameId;
        if (!gid || typeof value !== 'number' || !isFinite(value)) return;
        // make sure today's challenges exist before checking progress
        Arcade.challenges();
        let got = [], fin = [], xp = 0;
        mutate(m => {
            const s = m.stats[gid] = m.stats[gid] || {};
            const prev = s[stat] || 0;
            s[stat] = isCount ? prev + value : Math.max(prev, value);
            if (isCount && (stat === 'win' || stat.startsWith('win'))) xp += stat === 'win' ? 15 : 0;
            else if (!isCount && value > prev && prev > 0 && stat !== 'minutes') xp += 10; // beat your own best
            if (stat === 'score' || stat === 'run') { s.runs = (s.runs || 0) + 1; xp += 5; }
            for (const a of Arcade.ACHIEVEMENTS) if (a.g === gid && a.stat === stat && s[stat] >= a.min && unlockAch(m, a)) got.push(a);
            fin = progressChallenges(m, gid, stat, value, isCount);
        });
        announce(got);
        fin.forEach(([slot, c], i) => setTimeout(() => {
            Arcade.toast(`${slot === 'daily' ? '📅 Daily' : '🏅 Weekly'} challenge done! +${c.xp} XP · +${c.coins} 🪙`, 'gold', 4200);
            Arcade.sfx('win');
        }, 400 + i * 800));
        if (xp) Arcade.addXP(xp, true);
    }
    /** Report the result of one run, e.g. Arcade.report('score', 120). Keeps the best value. */
    Arcade.report = (stat, value) => recordStat(stat, Number(value), false);
    /** Add to a running total, e.g. Arcade.count('win'). */
    Arcade.count = (stat, n) => recordStat(stat, n === undefined ? 1 : Number(n), true);

    /* ---------- Cosmetics shop ---------- */
    Arcade.COSMETICS = {
        theme: [
            { id: 'dark', name: 'Midnight', price: 0, swatch: ['#0b1020', '#38bdf8'] },
            { id: 'light', name: 'Daylight', price: 150, swatch: ['#f4f6fb', '#2563eb'] },
            { id: 'neon', name: 'Neon', price: 300, swatch: ['#0a0014', '#ff2bd6'] },
            { id: 'crt', name: 'Retro CRT', price: 450, swatch: ['#020a02', '#33ff66'] },
        ],
        'snake.skin': [
            { id: 'classic', name: 'Classic', price: 0, swatch: ['#34d399', '#059669'] },
            { id: 'fire', name: 'Fire', price: 120, swatch: ['#f97316', '#dc2626'] },
            { id: 'ice', name: 'Ice', price: 120, swatch: ['#a5f3fc', '#0ea5e9'] },
            { id: 'gold', name: 'Gold', price: 250, swatch: ['#fde047', '#ca8a04'] },
            { id: 'candy', name: 'Candy Stripe', price: 250, swatch: ['#f472b6', '#ffffff'] },
            { id: 'void', name: 'Void', price: 350, swatch: ['#a855f7', '#1e1b4b'] },
            { id: 'rainbow', name: 'Rainbow', price: 500, swatch: ['#ef4444', '#3b82f6'] },
        ],
        'pacman.color': [
            { id: 'yellow', name: 'Classic Yellow', price: 0, swatch: ['#facc15', '#facc15'] },
            { id: 'pink', name: 'Ms. Pink', price: 100, swatch: ['#f9a8d4', '#ec4899'] },
            { id: 'cyan', name: 'Cyan', price: 100, swatch: ['#67e8f9', '#06b6d4'] },
            { id: 'lime', name: 'Lime', price: 100, swatch: ['#a3e635', '#65a30d'] },
            { id: 'white', name: 'Ghost White', price: 200, swatch: ['#ffffff', '#cbd5e1'] },
            { id: 'rainbow', name: 'Rainbow', price: 400, swatch: ['#ef4444', '#3b82f6'] },
        ],
    };
    Arcade.cosmetic = (slot) => readMeta().equip[slot] || (Arcade.COSMETICS[slot] || [{}])[0].id;
    Arcade.owns = (slot, id) => (readMeta().owned[slot] || []).includes(id);
    Arcade.buy = function (slot, id) {
        const item = (Arcade.COSMETICS[slot] || []).find(x => x.id === id);
        if (!item) return false;
        return mutate(m => {
            m.owned[slot] = m.owned[slot] || [];
            if (m.owned[slot].includes(id)) return true;
            if (m.coins < item.price) return false;
            m.coins -= item.price;
            m.owned[slot].push(id);
            m.equip[slot] = id;
            return true;
        });
    };
    Arcade.equip = (slot, id) => mutate(m => { if ((m.owned[slot] || []).includes(id)) m.equip[slot] = id; });
    Arcade.setProfile = (p) => mutate(m => { Object.assign(m.profile, p); });

    /* ---------- Save export / import ---------- */
    Arcade.exportSave = function () {
        const data = {};
        try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); data[k] = localStorage.getItem(k); } } catch (e) { }
        return { app: 'everygame-arcade', version: 1, exported: new Date().toISOString(), data };
    };
    Arcade.importSave = function (obj) {
        if (!obj || obj.app !== 'everygame-arcade' || !obj.data) throw new Error('Not an arcade save file');
        for (const [k, v] of Object.entries(obj.data)) { try { localStorage.setItem(k, v); } catch (e) { } }
        return Object.keys(obj.data).length;
    };
    /** Triggers a download of a text file. */
    Arcade.download = function (name, text, type) {
        const url = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    };

    /* ---------- Play-time tracking (only while the tab is visible) ---------- */
    const TICK = 15;
    function startTracking() {
        const gid = Arcade.gameId;
        if (!gid) return;
        mutate(m => { m.sessions[gid] = (m.sessions[gid] || 0) + 1; m.lastSeen[gid] = Date.now(); });
        let xpSec = 0;
        setInterval(() => {
            if (document.hidden) return;
            mutate(m => { m.playtime[gid] = (m.playtime[gid] || 0) + TICK; m.lastSeen[gid] = Date.now(); });
            xpSec += TICK;
            if (xpSec >= 60) { xpSec -= 60; Arcade.addXP(2, true); }
        }, TICK * 1000);
        window.addEventListener('pagehide', () => mutate(m => { m.lastSeen[gid] = Date.now(); }));
    }

    /* ---------- Auto wiring on load ---------- */
    document.addEventListener('DOMContentLoaded', () => {
        Arcade.setMuted(Arcade.muted);
        Arcade.$$('[data-mute]').forEach(b => b.addEventListener('click', () => {
            Arcade.setMuted(!Arcade.muted);
            if (!Arcade.muted) Arcade.sfx('select');
        }));
        startTracking();
    });

    window.Arcade = Arcade;
})();
