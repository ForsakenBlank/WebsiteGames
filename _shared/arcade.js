/* arcade helper library shared by every game.
   exposes a single global: window.Arcade */
(function () {
    'use strict';

    const Arcade = {};

    /* ---------- colours for canvas games ---------- */
    // the current theme's colours as plain strings. canvases draw light text and bright pieces,
    // so on the light themes they stay charcoal, which reads as a game screen on a cream page
    const UI_VARS = { bg: '--bg', bg2: '--bg-2', surface: '--surface', surface2: '--surface-2', surface3: '--surface-3', line: '--line-2', text: '--text', muted: '--muted', dim: '--dim', accent: '--accent' };
    const UI_CHARCOAL = { bg: '#1c1c1f', bg2: '#151517', surface: '#28282c', surface2: '#323237', surface3: '#3e3e44', line: 'rgba(255,255,255,0.13)', text: '#f7f4ee', muted: '#a9a59e', dim: '#6e6b67' };
    let uiCache = null;
    Object.defineProperty(Arcade, 'ui', {
        get() {
            if (uiCache) return uiCache;
            const root = document.documentElement, css = getComputedStyle(root), out = {};
            const light = root.dataset.theme === 'light' || root.dataset.theme === 'sand';
            for (const k in UI_VARS) out[k] = (light && UI_CHARCOAL[k]) || css.getPropertyValue(UI_VARS[k]).trim() || UI_CHARCOAL[k];
            return (uiCache = out);
        },
    });

    /* ---------- storage (never throws) ---------- */
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

    // records a score and returns { best, isNew }
    Arcade.best = function (key, score, lowerIsBetter) {
        const prev = Number(Arcade.load(key, 0)) || 0;
        const better = lowerIsBetter ? (prev === 0 || score < prev) : score > prev;
        if (better && score > 0) {
            Arcade.save(key, score);
            return { best: score, isNew: true };
        }
        return { best: prev, isNew: false };
    };

    /* ---------- number formatting ---------- */
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

    /* ---------- dom helpers ---------- */
    Arcade.$ = (sel, root) => (root || document).querySelector(sel);
    Arcade.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
    const el = (x) => (typeof x === 'string' ? document.getElementById(x) : x);
    Arcade.show = (x) => { const e = el(x); if (e) e.hidden = false; };
    Arcade.hide = (x) => { const e = el(x); if (e) e.hidden = true; };
    Arcade.text = (x, v) => { const e = el(x); if (e && e.textContent !== String(v)) e.textContent = v; };
    Arcade.esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    /* ---------- icons (simple line svgs so buttons don't need emoji) ---------- */
    const ICONS = {
        back: '<path d="M15 5l-7 7 7 7"/>',
        close: '<path d="M6 6l12 12M18 6L6 18"/>',
        restart: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/>',
        sound: '<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
        mute: '<path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>',
        star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
        trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>',
        coin: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5c0-1.5 5-1.5 5 0s-5 1.5-5 3 5 1.5 5 0"/>',
        bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
        play: '<path d="M8 5.5v13l10-6.5z"/>',
        pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
        help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01"/>',
        menu: '<path d="M4 7h16M4 12h11M4 17h13"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
        users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2 .8 3.5 2.8 3.5 5.7"/>',
        gift: '<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V20h14v-7.5M12 8.5V20M12 8.5C10 4 6.5 5 7.5 7.5c.5 1 4.5 1 4.5 1zM12 8.5c2-4.5 5.5-3.5 4.5-1-.5 1-4.5 1-4.5 1z"/>',
        check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
        lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
        calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
        chart: '<path d="M5 20V11M12 20V5M19 20v-6"/>',
        bag: '<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
        save: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M4.5 16.5V20h15v-3.5"/>',
        dice: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r=".9" fill="currentColor"/><circle cx="15" cy="15" r=".9" fill="currentColor"/><circle cx="15" cy="9" r=".9" fill="currentColor"/><circle cx="9" cy="15" r=".9" fill="currentColor"/>',
        home: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.5V20h12V9.5"/>',
        party: '<path d="M4 20l5-14 9 9z"/><path d="M14 4.5c.8.8.8 2 0 2.8M18.5 8c1-.3 2 .2 2.3 1.2M16 3l.5 1.5M20 5.5l1-.5"/>',
        grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
        user: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5"/>',
        search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
        flag: '<path d="M6 21V4M6 4.5h11l-2 4 2 4H6"/>',
        undo: '<path d="M9 14L4.5 9.5 9 5"/><path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3"/>',
        bulb: '<path d="M9 17.5h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
        refresh: '<path d="M20 12a8 8 0 0 1-14.3 4.9M4 12A8 8 0 0 1 18.3 7.1"/><path d="M18.5 3v4.3h-4.3M5.5 21v-4.3h4.3"/>',
        fire: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-4 3.5-5.5 3.5-9.5 2.5 1.5 4 3.5 4.5 6 .6-1 1-2 1-3.5 2.2 1.8 4 4.4 4 7 0 3.4-2.6 6-6.5 6z"/>',
    };
    Arcade.icon = function (name, cls) {
        return `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.star}</svg>`;
    };

    /* ---------- toasts ---------- */
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

    /* ---------- sound (tiny synth, no files) ---------- */
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

    // softer default palette: mostly sine/triangle so it doesn't sound like a 90s alarm
    const SFX = {
        click: () => tone(520, 0.05, 'triangle', 0.05),
        select: () => tone(660, 0.07, 'sine', 0.08),
        pop: () => tone(300, 0.08, 'sine', 0.1, 900),
        coin: () => { tone(988, 0.07, 'triangle', 0.06); tone(1319, 0.14, 'triangle', 0.06, null, 0.07); },
        score: () => tone(740, 0.09, 'triangle', 0.08, 1100),
        shoot: () => tone(880, 0.07, 'square', 0.025, 220),
        hit: () => { noise(0.08, 0.06); tone(180, 0.08, 'sawtooth', 0.04, 80); },
        boom: () => { noise(0.35, 0.12); tone(120, 0.3, 'sawtooth', 0.06, 40); },
        power: () => { tone(440, 0.08, 'triangle', 0.07, 880); tone(660, 0.12, 'triangle', 0.07, 1320, 0.08); },
        bad: () => tone(200, 0.18, 'triangle', 0.09, 110),
        die: () => { tone(440, 0.15, 'triangle', 0.08, 220); tone(330, 0.2, 'triangle', 0.08, 110, 0.14); tone(220, 0.35, 'triangle', 0.08, 55, 0.32); },
        win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.08, null, i * 0.1)),
        level: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.14, 'sine', 0.09, null, i * 0.08)),
        tick: () => tone(1200, 0.02, 'square', 0.02),
    };

    Arcade.sfx = function (name) {
        if (Arcade.muted) return;
        try { (SFX[name] || SFX.click)(); } catch (e) { }
    };

    // plays a single synth note (respects mute), handy for rising combo sounds
    Arcade.tone = function (freq, dur, type, vol, slideTo, delay) {
        if (Arcade.muted) return;
        try { tone(freq, dur, type, vol, slideTo, delay); } catch (e) { }
    };

    Arcade.setMuted = function (m) {
        Arcade.muted = !!m;
        Arcade.save('arcade.muted', Arcade.muted);
        Arcade.$$('[data-mute]').forEach(b => {
            b.innerHTML = Arcade.icon(Arcade.muted ? 'mute' : 'sound');
            b.title = Arcade.muted ? 'Unmute' : 'Mute';
            b.setAttribute('aria-label', b.title);
        });
    };

    /* ---------- vibration (phones only, respects mute) ---------- */
    Arcade.buzz = function (ms) {
        if (Arcade.muted || !navigator.vibrate) return;
        try { navigator.vibrate(ms || 15); } catch (e) { }
    };

    /* ---------- canvas fitting ---------- */
    // scales a canvas to fit its parent while keeping a fixed logical size (w x h)
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
        // changes the logical resolution (like a different level size) and refits
        view.setSize = function (nw, nh) { view.w = nw; view.h = nh; fit(); };
        window.addEventListener('resize', fit);
        fit();
        return view;
    };

    // converts a pointer/mouse event into logical canvas coordinates
    Arcade.pointer = function (canvas, e, logicalW, logicalH) {
        const r = canvas.getBoundingClientRect();
        const p = e.touches && e.touches[0] ? e.touches[0] : (e.changedTouches && e.changedTouches[0]) || e;
        return {
            x: (p.clientX - r.left) * (logicalW / r.width),
            y: (p.clientY - r.top) * ((logicalH || logicalW * r.height / r.width) / r.height),
        };
    };

    /* ---------- swipe detection ---------- */
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

    /* ---------- game loop ---------- */
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

    /* ---------- particles ---------- */
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

    /* ---------- misc math ---------- */
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
    // rounded rectangle path helper for canvas games
    Arcade.rrect = function (c, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
    };

    const dayKey = (d) => { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const weekKey = (d) => { d = new Date(d || Date.now()); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return 'W' + dayKey(d); };
    const yesterday = () => { const y = new Date(); y.setDate(y.getDate() - 1); return dayKey(y); };
    const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
    Arcade.dayKey = dayKey;
    Arcade.weekKey = weekKey;
    Arcade.hash = hashStr;
    // seeded random generator (mulberry32), same seed gives the same numbers
    Arcade.seeded = function (seed) {
        let a = typeof seed === 'string' ? hashStr(seed) : seed >>> 0;
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    };

    /* ==========================================================
       meta: profile, xp + levels, coins, quests, login rewards,
       achievements, unlocks and play time. shared by every game
       and the hub. games only need Arcade.report() / Arcade.count()
       ========================================================== */
    const META_KEY = 'arcade.meta';

    // folder name -> game id. anything not listed here (like the hub) is not a game
    const FOLDER_IDS = {
        Snake: 'snake', PacMan: 'pacman', GravityRunner: 'gravity', StarShooter: 'starshooter', SuperShot: 'supershot',
        TowerStacker: 'stacker', Encrypter: 'encrypter', ShapeMatch: 'shapematch', Minesweeper: 'minesweeper',
        ColourSort: 'coloursort', TapMatch: 'tapmatch', Petdoku: 'petdoku', PetSudoku: 'petsudoku', WoodBlocks: 'woodblocks',
        '2048': '2048', Wordle: 'wordle', Ludo: 'ludo', TheTower: 'thetower', ChickenFarming: 'chicken',
        EssenceFarming: 'essence', Automato: 'automato', UploadLabs: 'uploadlabs', InfiniteInk: 'infiniteink',
        BounceLab: 'physics', SnakesLadders: 'snakesladders', TicTacToe: 'tictactoe', IdleMiner: 'idleminer',
        TowerDefense: 'towerdefense', AimTrainer: 'aimtrainer', Flappy: 'flappy', Blocks: 'blocks', Slicer: 'slicer',
        Survivors: 'survivors', Pong: 'pong', Flow: 'flow', Pipes: 'pipes', Battleship: 'battleship', Dice: 'dice',
        Cards: 'cards', Typing: 'typing', Fishing: 'fishing', Singularity: 'singularity',
        ConnectFour: 'connect4', DotsBoxes: 'dots', Solitaire: 'solitaire', Nonogram: 'nonogram',
        Imposter: 'imposter', Charades: 'charades', WordBomb: 'wordbomb', PartyCards: 'partycards', Duel: 'duel',
        Checkers: 'checkers', Memory: 'memory',
    };
    Arcade.FOLDER_IDS = FOLDER_IDS;
    const GAME_COUNT = Object.keys(FOLDER_IDS).length;
    // games that count as party / pass-and-play for quests
    const PARTY_IDS = ['imposter', 'charades', 'wordbomb', 'partycards', 'duel'];
    Arcade.PARTY_IDS = PARTY_IDS;

    Arcade.gameId = (function () {
        try {
            const parts = decodeURIComponent(location.pathname).split(/[\\/]/).filter(Boolean);
            const last = parts[parts.length - 1] || '';
            const folder = !last.includes('.') ? last : parts.length > 1 ? parts[parts.length - 2] : '';
            return FOLDER_IDS[folder] || null;
        } catch (e) { return null; }
    })();

    function freshMeta() {
        return {
            v: 2, xp: 0, coins: 0, coinFrac: 0,
            profile: { name: '', avatar: '🙂' },
            playtime: {}, sessions: {}, lastSeen: {},
            stats: {}, ach: {},
            owned: { theme: ['dark'], 'snake.skin': ['classic'], 'pacman.color': ['yellow'] },
            equip: { theme: 'dark', 'snake.skin': 'classic', 'pacman.color': 'yellow', frame: 'none', title: 'rookie' },
            dailyDone: 0, weeklyDone: 0, questsDone: 0, sweeps: 0, streak: 0, bestStreak: 0, lastDaily: '',
            quests: null, wquests: null, rerolls: { day: '', used: 0 },
            login: { last: '', streak: 0, best: 0, claims: 0 },
            today: null,
            totals: { wins: 0, runs: 0, bests: 0, xp: 0, coins: 0, spent: 0 },
            lvlPaid: 1, flags: {},
            started: Date.now(),
        };
    }
    function readMeta() {
        const fresh = freshMeta();
        const m = Object.assign(fresh, Arcade.load(META_KEY, {}) || {});
        const base = freshMeta();
        for (const k of ['owned', 'equip', 'profile', 'login', 'totals', 'flags', 'rerolls']) m[k] = Object.assign(base[k], m[k] || {});
        if (!m.v || m.v < 2) {
            // migrate from the first version: keep progress, drop the old single challenges
            m.v = 2;
            m.lvlPaid = Arcade.levelInfo(m.xp).level;
            m.totals.xp = m.xp;
            m.bestStreak = m.streak || 0;
            delete m.daily; delete m.weekly;
        }
        return m;
    }

    // notifications created while changing meta, shown after the save
    let pending = [];
    let flushTimer = 0;

    // re-reads storage before every change so several open tabs don't overwrite each other
    function mutate(fn) {
        const m = readMeta();
        const out = fn(m);
        checkMetaAchievements(m);
        Arcade.save(META_KEY, m);
        if (pending.length) { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 120); }
        return out;
    }
    Arcade.meta = readMeta;

    /* ---------- levels ---------- */
    const needFor = (lvl) => 100 + 30 * (lvl - 1);
    Arcade.levelInfo = function (xp) {
        let lvl = 1, left = Math.floor(xp || 0);
        while (left >= needFor(lvl) && lvl < 999) { left -= needFor(lvl); lvl++; }
        return { level: lvl, into: left, need: needFor(lvl), pct: left / needFor(lvl) };
    };
    Arcade.levelCoins = (lvl) => 20 + 5 * lvl;

    function today(m) {
        const d = dayKey();
        if (!m.today || m.today.day !== d) m.today = { day: d, xp: 0, games: [], wins: 0, runs: 0, bests: 0, mins: 0, playXP: 0, xpByGame: {}, runsByGame: {} };
        return m.today;
    }

    function grantCoins(m, n) {
        n = Math.floor(n);
        if (!n) return;
        m.coins = Math.max(0, m.coins + n);
        if (n > 0) m.totals.coins += n;
    }

    function grantXP(m, n) {
        n = Math.round(n);
        if (!(n > 0)) return;
        const before = Arcade.levelInfo(m.xp).level;
        m.xp += n;
        m.totals.xp += n;
        m.coinFrac = (m.coinFrac || 0) + n / 10;
        const whole = Math.floor(m.coinFrac);
        m.coinFrac -= whole;
        grantCoins(m, whole);
        today(m).xp += n;
        pending.push({ t: 'xp', n, before });
        questEvent(m, 'xp', n);
        const after = Arcade.levelInfo(m.xp).level;
        // pay every level reward exactly once, even when xp jumps several levels
        while ((m.lvlPaid || 1) < after) {
            m.lvlPaid = (m.lvlPaid || 1) + 1;
            const coins = Arcade.levelCoins(m.lvlPaid);
            grantCoins(m, coins);
            pending.push({ t: 'level', lvl: m.lvlPaid, coins, unlocks: Arcade.unlocksAt(m.lvlPaid) });
        }
    }

    Arcade.addCoins = function (n) {
        if (!n) return;
        mutate(m => grantCoins(m, n));
    };
    Arcade.spendCoins = function (n) {
        return mutate(m => { if (m.coins < n) return false; m.coins -= n; m.totals.spent += n; return true; });
    };
    // adds xp from a game. quiet is kept for old callers, the small popup always shows
    Arcade.addXP = function (n) {
        if (!(n > 0)) return;
        mutate(m => {
            const gid = Arcade.gameId;
            if (gid) {
                // soft daily cap per game so farming one quick game doesn't break the curve
                const t = today(m);
                const used = t.xpByGame[gid] || 0;
                n = Math.max(0, Math.min(n, 600 - used));
                t.xpByGame[gid] = used + n;
            }
            grantXP(m, n);
        });
    };

    /* ---------- cosmetics + unlocks ---------- */
    // price: buy with coins. lvl: free once you reach that level. ach: id or count of achievements
    Arcade.COSMETICS = {
        theme: [
            { id: 'dark', name: 'Charcoal', price: 0, swatch: ['#1c1c1f', '#f2a541'] },
            { id: 'light', name: 'Cream', lvl: 3, swatch: ['#f3eee5', '#e8833a'] },
            { id: 'ocean', name: 'Ocean', lvl: 8, swatch: ['#15202d', '#4fa3e0'] },
            { id: 'neon', name: 'Grape', price: 300, swatch: ['#211a30', '#a98bf0'] },
            { id: 'crt', name: 'Forest', price: 300, swatch: ['#18221d', '#6cc58f'] },
            { id: 'rose', name: 'Rose', lvl: 15, swatch: ['#2a1d22', '#ef8aa0'] },
            { id: 'sand', name: 'Sand', price: 500, swatch: ['#efe3cf', '#c8812e'] },
            { id: 'mono', name: 'Mono', ach: 30, swatch: ['#111111', '#fafafa'] },
        ],
        avatar: [
            // only the smiley is free, everything else is earned with levels or bought with coins
            { id: '🙂', name: '🙂', price: 0 },
            { id: '😎', name: '😎', lvl: 2 }, { id: '🐱', name: '🐱', lvl: 3 }, { id: '🐶', name: '🐶', lvl: 4 },
            { id: '🦊', name: '🦊', lvl: 5 }, { id: '🤖', name: '🤖', lvl: 6 }, { id: '👾', name: '👾', lvl: 7 },
            { id: '🔥', name: '🔥', lvl: 8 }, { id: '🦄', name: '🦄', lvl: 9 }, { id: '🌈', name: '🌈', lvl: 11 },
            { id: '🐲', name: '🐲', lvl: 12 }, { id: '⚡', name: '⚡', lvl: 13 }, { id: '🦖', name: '🦖', lvl: 14 },
            { id: '🚀', name: '🚀', lvl: 16 }, { id: '🧙', name: '🧙', lvl: 18 }, { id: '🥷', name: '🥷', lvl: 22 },
            { id: '👑', name: '👑', lvl: 25 }, { id: '💎', name: '💎', lvl: 35 }, { id: '🐉', name: '🐉', lvl: 50 },
            { id: '🍩', name: '🍩', price: 40 }, { id: '🐸', name: '🐸', price: 50 }, { id: '🐝', name: '🐝', price: 50 },
            { id: '🐼', name: '🐼', price: 60 }, { id: '🐧', name: '🐧', price: 60 }, { id: '🍕', name: '🍕', price: 60 },
            { id: '🌮', name: '🌮', price: 60 }, { id: '🐙', name: '🐙', price: 80 }, { id: '🦉', name: '🦉', price: 80 },
            { id: '🎸', name: '🎸', price: 90 }, { id: '🏀', name: '🏀', price: 90 }, { id: '⚽', name: '⚽', price: 90 },
            { id: '🎃', name: '🎃', price: 120 }, { id: '👻', name: '👻', price: 120 }, { id: '💀', name: '💀', price: 150 },
            { id: '🧛', name: '🧛', price: 150 }, { id: '🧜', name: '🧜', price: 150 }, { id: '🐳', name: '🐳', price: 200 },
            { id: '🏆', name: '🏆', ach: 20 }, { id: '🌍', name: '🌍', ach: 'explorer30' }, { id: '🦥', name: '🦥', ach: 'time10' },
        ],
        frame: [
            { id: 'none', name: 'Plain', price: 0, swatch: ['#3e3e44', '#3e3e44'] },
            { id: 'mint', name: 'Mint', lvl: 5, swatch: ['#6cd4a4', '#6cd4a4'] },
            { id: 'sky', name: 'Sky', price: 200, swatch: ['#6cb8f0', '#6cb8f0'] },
            { id: 'berry', name: 'Berry', price: 200, swatch: ['#e56b9a', '#e56b9a'] },
            { id: 'gold', name: 'Gold', lvl: 10, swatch: ['#f5c04e', '#d8941a'] },
            { id: 'fire', name: 'Streak', ach: 'streak7', swatch: ['#f7904a', '#e2463a'] },
            { id: 'violet', name: 'Violet', lvl: 20, swatch: ['#a98bf0', '#7c6cf0'] },
            { id: 'rainbow', name: 'Rainbow', lvl: 30, swatch: ['#ef4444', '#3b82f6'] },
        ],
        title: [
            { id: 'rookie', name: 'Rookie', price: 0 },
            { id: 'casual', name: 'Casual', lvl: 3 },
            { id: 'regular', name: 'Regular', lvl: 8 },
            { id: 'puzzler', name: 'Puzzle Brain', ach: 'pet10' },
            { id: 'party', name: 'Party Animal', ach: 'party3' },
            { id: 'owl', name: 'Night Owl', ach: 'owl' },
            { id: 'bird', name: 'Early Bird', ach: 'bird' },
            { id: 'daily', name: 'Daily Devotee', ach: 'streak7' },
            { id: 'strategist', name: 'Strategist', ach: 'c4hard' },
            { id: 'collector', name: 'Collector', ach: 40 },
            { id: 'veteran', name: 'Veteran', lvl: 20 },
            { id: 'spender', name: 'Big Spender', price: 400 },
            { id: 'legend', name: 'Legend', lvl: 40 },
            { id: 'showoff', name: 'Show-off', price: 1000 },
            { id: 'royal', name: 'Arcade Royalty', lvl: 60 },
        ],
        'snake.skin': [
            { id: 'classic', name: 'Classic', price: 0, swatch: ['#34d399', '#059669'] },
            { id: 'fire', name: 'Fire', price: 120, swatch: ['#f97316', '#dc2626'] },
            { id: 'ice', name: 'Ice', price: 120, swatch: ['#a5f3fc', '#0ea5e9'] },
            { id: 'gold', name: 'Gold', lvl: 12, swatch: ['#fde047', '#ca8a04'] },
            { id: 'candy', name: 'Candy Stripe', price: 250, swatch: ['#f472b6', '#ffffff'] },
            { id: 'void', name: 'Void', price: 350, swatch: ['#a855f7', '#1e1b4b'] },
            { id: 'rainbow', name: 'Rainbow', price: 500, swatch: ['#ef4444', '#3b82f6'] },
        ],
        'pacman.color': [
            { id: 'yellow', name: 'Classic Yellow', price: 0, swatch: ['#facc15', '#facc15'] },
            { id: 'pink', name: 'Ms. Pink', price: 100, swatch: ['#f9a8d4', '#ec4899'] },
            { id: 'cyan', name: 'Cyan', price: 100, swatch: ['#67e8f9', '#06b6d4'] },
            { id: 'lime', name: 'Lime', lvl: 6, swatch: ['#a3e635', '#65a30d'] },
            { id: 'white', name: 'Ghost White', price: 200, swatch: ['#ffffff', '#cbd5e1'] },
            { id: 'rainbow', name: 'Rainbow', price: 400, swatch: ['#ef4444', '#3b82f6'] },
        ],
    };
    const DEFAULT_EQUIP = { theme: 'dark', avatar: '🙂', frame: 'none', title: 'rookie', 'snake.skin': 'classic', 'pacman.color': 'yellow' };

    // every cosmetic that unlocks for free at a level
    Arcade.unlocksAt = function (lvl) {
        const out = [];
        for (const [slot, list] of Object.entries(Arcade.COSMETICS)) for (const it of list) if (it.lvl === lvl) out.push({ slot, item: it });
        return out;
    };
    function isUnlocked(m, slot, item) {
        if (!item) return false;
        if ((m.owned[slot] || []).includes(item.id)) return true;
        if (item.price === 0) return true;
        if (item.lvl && Arcade.levelInfo(m.xp).level >= item.lvl) return true;
        if (item.ach !== undefined) {
            if (typeof item.ach === 'number') return Object.keys(m.ach).length >= item.ach;
            return !!m.ach[item.ach];
        }
        return false;
    }
    // explains how to get an item that is still locked
    Arcade.unlockHint = function (item) {
        if (item.lvl) return 'Reach level ' + item.lvl;
        if (typeof item.ach === 'number') return 'Unlock ' + item.ach + ' achievements';
        if (item.ach) { const a = Arcade.ACHIEVEMENTS.find(x => x.id === item.ach); return a ? 'Achievement: ' + a.title : 'Secret'; }
        return item.price + ' coins';
    };
    const findItem = (slot, id) => (Arcade.COSMETICS[slot] || []).find(x => x.id === id);
    Arcade.isUnlocked = (slot, id) => isUnlocked(readMeta(), slot, findItem(slot, id));
    Arcade.cosmetic = function (slot) {
        const m = readMeta();
        const id = slot === 'avatar' ? m.profile.avatar : m.equip[slot];
        if (id && isUnlocked(m, slot, findItem(slot, id))) return id;
        if (slot === 'avatar' && id) return id; // avatars picked under the old system stay
        return DEFAULT_EQUIP[slot] || ((Arcade.COSMETICS[slot] || [{}])[0].id);
    };
    Arcade.owns = Arcade.isUnlocked;
    Arcade.buy = function (slot, id) {
        const item = findItem(slot, id);
        if (!item) return false;
        return mutate(m => {
            m.owned[slot] = m.owned[slot] || [];
            if (isUnlocked(m, slot, item)) return true;
            if (!item.price || m.coins < item.price) return false;
            m.coins -= item.price;
            m.totals.spent += item.price;
            m.owned[slot].push(id);
            if (slot === 'avatar') m.profile.avatar = id; else m.equip[slot] = id;
            return true;
        });
    };
    Arcade.equip = (slot, id) => mutate(m => {
        if (!isUnlocked(m, slot, findItem(slot, id))) return false;
        if (slot === 'avatar') m.profile.avatar = id; else m.equip[slot] = id;
        return true;
    });
    Arcade.setProfile = (p) => mutate(m => { Object.assign(m.profile, p); });

    /* ---------- achievements ---------- */
    const gamesOpened = (m) => Object.keys(m.sessions).filter(k => Object.values(FOLDER_IDS).includes(k)).length;
    const totalTime = (m) => Object.values(m.playtime).reduce((a, b) => a + b, 0);
    const lvl = (m) => Arcade.levelInfo(m.xp).level;
    const achCount = (m) => Object.keys(m.ach).length;
    const owned = (m, slot) => (Arcade.COSMETICS[slot] || []).filter(it => isUnlocked(m, slot, it)).length;
    // per-game: [id, game, stat, min, icon, title, description, xp]
    const PER_GAME = [
        ['snake50', 'snake', 'score', 50, '🐍', 'Long Boi', 'Score 50 in Snake.', 30],
        ['snake150', 'snake', 'score', 150, '🐉', 'Danger Noodle', 'Score 150 in Snake.', 80],
        ['snakecamp', 'snake', 'campaign', 10, '🗺️', 'Snake Trail', 'Clear 10 Snake campaign levels.', 50],
        ['snakecamp30', 'snake', 'campaign', 30, '🏁', 'Trail Blazer', 'Clear all 30 Snake campaign levels.', 150],
        ['pac10k', 'pacman', 'score', 10000, '🟡', 'Waka Waka', 'Score 10,000 in Pac-Man.', 40],
        ['pac50k', 'pacman', 'score', 50000, '🍒', 'Fruit Bowl', 'Score 50,000 in Pac-Man.', 100],
        ['pacghost', 'pacman', 'ghostwin', 1, '👻', 'Role Reversal', 'Catch Pac-Man as a ghost.', 40],
        ['grav1k', 'gravity', 'distance', 1000, '🔄', 'Gravity Defier', 'Run 1,000m in Gravity Runner.', 40],
        ['grav5k', 'gravity', 'distance', 5000, '🌌', 'Upside Down', 'Run 5,000m in Gravity Runner.', 120],
        ['star10', 'starshooter', 'wave', 10, '🚀', 'Station Keeper', 'Reach wave 10 in Star Shooter.', 40],
        ['star25', 'starshooter', 'wave', 25, '🛰️', 'Deep Space', 'Reach wave 25 in Star Shooter.', 100],
        ['starboss', 'starshooter', 'bossrush', 3, '👾', 'Boss Hunter', 'Beat 3 bosses in Boss Rush.', 50],
        ['super3', 'supershot', 'stars', 15, '⏱️', 'Time Bender', 'Earn 15 stars in SUPERSHOT.', 50],
        ['superarena', 'supershot', 'arenawave', 10, '🔫', 'Arena Regular', 'Reach wave 10 in the SUPERSHOT arena.', 60],
        ['stack30', 'stacker', 'floors', 30, '🏗️', 'Skyscraper', 'Stack 30 floors.', 30],
        ['stack80', 'stacker', 'floors', 80, '🌤️', 'Cloud Scraper', 'Stack 80 floors.', 100],
        ['enc10', 'encrypter', 'level', 10, '🧬', 'Firewall', 'Reach level 10 in Encrypter.', 40],
        ['shape10', 'shapematch', 'level', 10, '🔺', 'Sorted', 'Reach level 10 in Shape Match.', 40],
        ['mineswin', 'minesweeper', 'win', 1, '💣', 'Sweeper', 'Win a game of Minesweeper.', 20],
        ['mines25', 'minesweeper', 'win', 25, '🧹', 'Clean Sweep', 'Win 25 games of Minesweeper.', 80],
        ['mineshard', 'minesweeper', 'win.hard', 1, '🎖️', 'Bomb Squad', 'Win Minesweeper on Hard.', 60],
        ['sort25', 'coloursort', 'win', 25, '🧪', 'Mixologist', 'Solve 25 Colour Sort levels.', 50],
        ['sort100', 'coloursort', 'win', 100, '⚗️', 'Alchemist', 'Solve 100 Colour Sort levels.', 120],
        ['tap10', 'tapmatch', 'win', 10, '🍓', 'Tile Tamer', 'Win 10 Tap Match boards.', 40],
        ['tap50', 'tapmatch', 'win', 50, '🍉', 'Fruit Salad', 'Win 50 Tap Match boards.', 100],
        ['pet10', 'petdoku', 'win', 10, '🐾', 'Pet Whisperer', 'Solve 10 Petdoku puzzles.', 40],
        ['pet50', 'petdoku', 'win', 50, '🐈', 'Cat Herder', 'Solve 50 Petdoku puzzles.', 120],
        ['sudoku5', 'petsudoku', 'win', 5, '🐶', 'Good Boy', 'Solve 5 Pet Sudokus.', 40],
        ['sudoku25', 'petsudoku', 'win', 25, '🦮', 'Best in Show', 'Solve 25 Pet Sudokus.', 100],
        ['wood5k', 'woodblocks', 'score', 5000, '🪵', 'Lumberjack', 'Score 5,000 in Wood Blocks.', 40],
        ['wood20k', 'woodblocks', 'score', 20000, '🌲', 'Carpenter', 'Score 20,000 in Wood Blocks.', 100],
        ['t512', '2048', 'tile', 512, '🔢', 'Halfway', 'Make the 512 tile in 2048.', 30],
        ['t2048', '2048', 'tile', 2048, '🏅', '2048!', 'Make the 2048 tile.', 100],
        ['wordle10', 'wordle', 'win', 10, '🟩', 'Wordsmith', 'Win 10 Wordles.', 50],
        ['wordle50', 'wordle', 'win', 50, '📚', 'Walking Dictionary', 'Win 50 Wordles.', 120],
        ['ludowin', 'ludo', 'win', 1, '🎲', 'Home Run', 'Win a game of Ludo.', 20],
        ['ludo10', 'ludo', 'win', 10, '🏠', 'Board Boss', 'Win 10 games of Ludo.', 80],
        ['snlwin', 'snakesladders', 'win', 1, '🪜', 'Up We Go', 'Win Snakes & Ladders.', 20],
        ['tetris40', 'blocks', 'lines', 40, '🧱', 'Line Clearer', 'Clear 40 lines in one Falling Blocks game.', 40],
        ['tetris150', 'blocks', 'lines', 150, '🏢', 'Block Party', 'Clear 150 lines in one Falling Blocks game.', 120],
        ['flappy25', 'flappy', 'score', 25, '🐤', 'Frequent Flyer', 'Pass 25 gaps in Flappy.', 40],
        ['flappy75', 'flappy', 'score', 75, '🦅', 'Sky High', 'Pass 75 gaps in Flappy.', 120],
        ['slice100', 'slicer', 'score', 100, '🍉', 'Sushi Chef', 'Score 100 in Fruit Slicer.', 40],
        ['surv10', 'survivors', 'minutes', 10, '🧛', 'Survivor', 'Survive 10 minutes in Night Survivors.', 80],
        ['surv1k', 'survivors', 'kills', 1000, '⚔️', 'Horde Breaker', 'Defeat 1,000 enemies in one Night Survivors run.', 80],
        ['type80', 'typing', 'wpm', 80, '⌨️', 'Speed Typist', 'Type at 80 WPM.', 50],
        ['type50', 'typing', 'wpm', 50, '📝', 'Touch Typist', 'Type at 50 WPM.', 25],
        ['react200', 'aimtrainer', 'reactionFast', 1, '⚡', 'Lightning', 'Get a reaction time under 200ms.', 40],
        ['uno', 'cards', 'win', 1, '🃏', 'Last Card', 'Win a game of Crazy Cards.', 20],
        ['uno10', 'cards', 'win', 10, '🎴', 'Card Shark', 'Win 10 games of Crazy Cards.', 80],
        ['yahtzee', 'dice', 'yahtzee', 1, '🎲', 'Five of a Kind', 'Roll five of a kind in Dice Poker.', 30],
        ['dice250', 'dice', 'score', 250, '🎯', 'High Roller', 'Score 250 in Dice Poker.', 60],
        ['fleet', 'battleship', 'win', 1, '🚢', 'Admiral', 'Sink the enemy fleet.', 20],
        ['fleethard', 'battleship', 'win.hard', 1, '⚓', 'Sea Wolf', 'Beat the Hard Battleship AI.', 80],
        ['fleet2p', 'battleship', 'pvp', 1, '🤝', 'Naval Duel', 'Finish a 2-player Battleship match.', 30],
        ['flow', 'flow', 'win', 20, '🔗', 'Go With the Flow', 'Solve 20 Flow puzzles.', 40],
        ['pipes', 'pipes', 'win', 20, '🚰', 'Plumber', 'Solve 20 Pipe puzzles.', 40],
        ['fish', 'fishing', 'legendary', 1, '🐋', 'The Big One', 'Catch a legendary fish.', 60],
        ['fish100', 'fishing', 'fish', 100, '🎣', 'Angler', 'Catch 100 fish.', 50],
        ['td', 'towerdefense', 'wave', 20, '🏰', 'Hold the Line', 'Survive 20 waves in Tower Defense.', 50],
        ['tttwin', 'tictactoe', 'win', 1, '❌', 'Three in a Row', 'Win a game of Tic-Tac-Toe.', 15],
        ['tttult', 'tictactoe', 'win.ultimate', 1, '🧠', 'Ultimate', 'Win a game of Ultimate Tic-Tac-Toe.', 60],
        ['pongwin', 'pong', 'win', 1, '🏓', 'Rally', 'Beat the Pong AI.', 20],
        ['physics', 'physics', 'score', 5000, '🔴', 'Bouncy', 'Score 5,000 in Bounce Lab.', 40],
        ['tower50', 'thetower', 'wave', 50, '🗼', 'Tower Up', 'Reach wave 50 in The Tower.', 40],
        ['tower500', 'thetower', 'wave', 500, '🏯', 'Unbreakable', 'Reach wave 500 in The Tower.', 150],
        ['chickreb', 'chicken', 'rebirths', 1, '🐔', 'Born Again', 'Rebirth your chicken farm.', 50],
        ['essasc', 'essence', 'ascensions', 1, '🌿', 'Ascended', 'Ascend in Essence Farming.', 50],
        ['miner10', 'idleminer', 'shafts', 10, '⛏️', 'Deep Digger', 'Open 10 shafts in Idle Miner.', 50],
        ['auto5', 'automato', 'contracts', 5, '🏭', 'Contractor', 'Finish 5 Automato contracts.', 50],
        ['upload3', 'uploadlabs', 'challenges', 3, '💾', 'Lab Rat', 'Beat 3 Upload Labs challenges.', 60],
        ['sing3', 'singularity', 'site', 3, '🧠', 'Moving Up', 'Move Singularity past the loft.', 80],
        ['singwin', 'singularity', 'won', 1, '🌌', 'Singularity', 'Take over the universe.', 500],
        ['c4win', 'connect4', 'win', 1, '🔴', 'Four in a Row', 'Win a game of Connect Four.', 20],
        ['c4hard', 'connect4', 'win.hard', 1, '♟️', 'Outplayed', 'Beat the Hard Connect Four AI.', 80],
        ['dotswin', 'dots', 'win', 1, '🔲', 'Boxed In', 'Win a game of Dots and Boxes.', 20],
        ['dots10', 'dots', 'win', 10, '📦', 'Box Office', 'Win 10 games of Dots and Boxes.', 70],
        ['sol1', 'solitaire', 'win', 1, '♠️', 'Patience', 'Win a game of Solitaire.', 30],
        ['sol10', 'solitaire', 'win', 10, '♥️', 'Saint of Patience', 'Win 10 games of Solitaire.', 100],
        ['nono5', 'nonogram', 'win', 5, '🖼️', 'Pixel Painter', 'Solve 5 Nonograms.', 40],
        ['nono30', 'nonogram', 'win', 30, '🎨', 'Picture Perfect', 'Solve 30 Nonograms.', 120],
        ['checkwin', 'checkers', 'win', 1, '⚫', 'King Me', 'Win a game of Checkers.', 20],
        ['memwin', 'memory', 'win', 10, '🃏', 'Total Recall', 'Clear 10 Memory boards.', 40],
        ['imp1', 'imposter', 'round', 1, '🕵️', 'Sus', 'Play a round of Imposter.', 20],
        ['imp10', 'imposter', 'round', 10, '🔎', 'Detective', 'Play 10 rounds of Imposter.', 60],
        ['char1', 'charades', 'round', 1, '🎭', 'Showtime', 'Play a round of Charades.', 20],
        ['bomb1', 'wordbomb', 'round', 1, '💥', 'Tick Tock', 'Play a round of Word Bomb.', 20],
        ['cards50', 'partycards', 'cards', 50, '🎉', 'Life of the Party', 'Flip 50 party cards.', 40],
        ['duel10', 'duel', 'round', 10, '🤺', 'Duelist', 'Play 10 rounds of Reaction Duel.', 40],
    ];
    Arcade.ACHIEVEMENTS = [
        { id: 'hello', icon: '👋', title: 'Welcome', desc: 'Open your first game.', test: m => gamesOpened(m) >= 1, xp: 10 },
        { id: 'explorer5', icon: '🧭', title: 'Explorer', desc: 'Open 5 different games.', test: m => gamesOpened(m) >= 5, xp: 30 },
        { id: 'explorer15', icon: '🗺️', title: 'Globetrotter', desc: 'Open 15 different games.', test: m => gamesOpened(m) >= 15, xp: 80 },
        { id: 'explorer30', icon: '🌍', title: 'Tourist', desc: 'Open 30 different games.', test: m => gamesOpened(m) >= 30, xp: 200 },
        { id: 'explorerAll', icon: '🧳', title: 'Seen It All', desc: 'Open every game in the arcade.', test: m => gamesOpened(m) >= GAME_COUNT, xp: 400 },
        { id: 'time1', icon: '⏱️', title: 'Warmed Up', desc: 'Play for 1 hour in total.', test: m => totalTime(m) >= 3600, xp: 40 },
        { id: 'time10', icon: '⌛', title: 'Regular', desc: 'Play for 10 hours in total.', test: m => totalTime(m) >= 36000, xp: 150 },
        { id: 'time50', icon: '🕰️', title: 'Arcade Rat', desc: 'Play for 50 hours in total.', test: m => totalTime(m) >= 180000, xp: 500 },
        { id: 'lvl5', icon: '🥉', title: 'Level 5', desc: 'Reach level 5.', test: m => lvl(m) >= 5, xp: 0 },
        { id: 'lvl10', icon: '🥈', title: 'Level 10', desc: 'Reach level 10.', test: m => lvl(m) >= 10, xp: 0 },
        { id: 'lvl20', icon: '🥇', title: 'Level 20', desc: 'Reach level 20.', test: m => lvl(m) >= 20, xp: 0 },
        { id: 'lvl35', icon: '🎖️', title: 'Level 35', desc: 'Reach level 35.', test: m => lvl(m) >= 35, xp: 0 },
        { id: 'lvl50', icon: '👑', title: 'Level 50', desc: 'Reach level 50.', test: m => lvl(m) >= 50, xp: 0 },
        { id: 'daily1', icon: '📅', title: 'Daily Grind', desc: 'Finish a daily quest.', test: m => m.dailyDone >= 1, xp: 20 },
        { id: 'daily25', icon: '🗓️', title: 'Habit Forming', desc: 'Finish 25 daily quests.', test: m => m.dailyDone >= 25, xp: 120 },
        { id: 'daily100', icon: '📆', title: 'Clockwork', desc: 'Finish 100 daily quests.', test: m => m.dailyDone >= 100, xp: 300 },
        { id: 'sweep1', icon: '🧹', title: 'Clean Slate', desc: 'Finish all 3 daily quests in one day.', test: m => m.sweeps >= 1, xp: 40 },
        { id: 'sweep10', icon: '✨', title: 'Overachiever', desc: 'Finish every daily quest on 10 different days.', test: m => m.sweeps >= 10, xp: 150 },
        { id: 'streak3', icon: '🔥', title: 'On Fire', desc: 'Finish a quest 3 days in a row.', test: m => m.streak >= 3 || m.bestStreak >= 3, xp: 60 },
        { id: 'streak7', icon: '🌋', title: 'Unstoppable', desc: 'Finish a quest 7 days in a row.', test: m => m.streak >= 7 || m.bestStreak >= 7, xp: 150 },
        { id: 'weekly1', icon: '🏅', title: 'Weekly Warrior', desc: 'Finish a weekly quest.', test: m => m.weeklyDone >= 1, xp: 60 },
        { id: 'weekly10', icon: '🏵️', title: 'Week In, Week Out', desc: 'Finish 10 weekly quests.', test: m => m.weeklyDone >= 10, xp: 200 },
        { id: 'login7', icon: '🎁', title: 'Showing Up', desc: 'Claim the day 7 login reward.', test: m => m.login.best >= 7, xp: 80 },
        { id: 'login30', icon: '💝', title: 'Loyal', desc: 'Claim login rewards 30 days in a row.', test: m => m.login.best >= 30, xp: 300 },
        { id: 'win1', icon: '✌️', title: 'First Win', desc: 'Win any game.', test: m => m.totals.wins >= 1, xp: 10 },
        { id: 'win50', icon: '💪', title: 'Winner', desc: 'Win 50 games in total.', test: m => m.totals.wins >= 50, xp: 100 },
        { id: 'win250', icon: '🦾', title: 'Champion', desc: 'Win 250 games in total.', test: m => m.totals.wins >= 250, xp: 300 },
        { id: 'runs100', icon: '🔁', title: 'One More Go', desc: 'Finish 100 rounds of anything.', test: m => m.totals.runs >= 100, xp: 80 },
        { id: 'runs1000', icon: '♾️', title: 'Just One More', desc: 'Finish 1,000 rounds of anything.', test: m => m.totals.runs >= 1000, xp: 300 },
        { id: 'best10', icon: '📈', title: 'Improving', desc: 'Beat 10 personal bests.', test: m => m.totals.bests >= 10, xp: 50 },
        { id: 'best100', icon: '🚀', title: 'Always Better', desc: 'Beat 100 personal bests.', test: m => m.totals.bests >= 100, xp: 200 },
        { id: 'shopper', icon: '🛍️', title: 'Shopper', desc: 'Buy something in the shop.', test: m => m.totals.spent > 0, xp: 20 },
        { id: 'spender', icon: '💸', title: 'Splurge', desc: 'Spend 2,000 coins.', test: m => m.totals.spent >= 2000, xp: 100 },
        { id: 'themes4', icon: '🎨', title: 'Interior Designer', desc: 'Unlock 4 themes.', test: m => owned(m, 'theme') >= 4, xp: 60 },
        { id: 'named', icon: '🪪', title: 'Who Am I?', desc: 'Set a profile name.', test: m => !!(m.profile.name || '').trim(), xp: 10 },
        { id: 'rich', icon: '💰', title: 'Coin Hoarder', desc: 'Hold 1,000 coins at once.', test: m => m.coins >= 1000, xp: 50 },
        { id: 'earned10k', icon: '🏦', title: 'Savings Account', desc: 'Earn 10,000 coins in total.', test: m => m.totals.coins >= 10000, xp: 200 },
        { id: 'ach25', icon: '🏆', title: 'Trophy Shelf', desc: 'Unlock 25 achievements.', test: m => achCount(m) >= 25, xp: 100 },
        { id: 'ach60', icon: '🏛️', title: 'Trophy Room', desc: 'Unlock 60 achievements.', test: m => achCount(m) >= 60, xp: 300 },
        { id: 'party3', icon: '🥳', title: 'Party Starter', desc: 'Play 3 different party games.', test: m => PARTY_IDS.filter(id => m.sessions[id]).length >= 3, xp: 60 },
        { id: 'owl', icon: '🦉', title: 'Night Owl', desc: 'Play between midnight and 4am.', test: m => !!m.flags.owl, xp: 25 },
        { id: 'bird', icon: '🐓', title: 'Early Bird', desc: 'Play between 5am and 7am.', test: m => !!m.flags.bird, xp: 25 },
        { id: 'weekend', icon: '🛋️', title: 'Weekender', desc: 'Play on a Saturday and a Sunday.', test: m => !!(m.flags.sat && m.flags.sun), xp: 25 },
        ...PER_GAME.map(([id, g, stat, min, icon, title, desc, xp]) => ({ id, g, stat, min, icon, title, desc, xp })),
    ];

    function unlockAch(m, a) {
        if (m.ach[a.id]) return false;
        m.ach[a.id] = Date.now();
        grantCoins(m, Math.round(10 + (a.xp || 0) / 2));
        grantXP(m, a.xp || 0);
        pending.push({ t: 'ach', a });
        return true;
    }
    function checkMetaAchievements(m) {
        // loop because one unlock can satisfy another (like "unlock 25 achievements")
        for (let pass = 0; pass < 3; pass++) {
            let any = false;
            for (const a of Arcade.ACHIEVEMENTS) if (a.test && !m.ach[a.id] && a.test(m)) { unlockAch(m, a); any = true; }
            if (!any) break;
        }
    }

    /* ---------- quests ---------- */
    // game quests. kind 'max': reach n in one run. kind 'count': add up to n. d = daily target, w = weekly
    Arcade.CHALLENGES = [
        { g: 'snake', stat: 'score', kind: 'max', d: 25, w: 80, text: 'Score {n} in Snake' },
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
        { g: 'petsudoku', stat: 'win', kind: 'count', d: 1, w: 6, text: 'Solve {n} Pet Sudoku puzzles' },
        { g: 'woodblocks', stat: 'score', kind: 'max', d: 1500, w: 6000, text: 'Score {n} in Wood Blocks' },
        { g: '2048', stat: 'tile', kind: 'max', d: 256, w: 1024, text: 'Make the {n} tile in 2048' },
        { g: 'wordle', stat: 'win', kind: 'count', d: 2, w: 10, text: 'Win {n} Wordles' },
        { g: 'ludo', stat: 'win', kind: 'count', d: 1, w: 4, text: 'Win {n} games of Ludo' },
        { g: 'blocks', stat: 'lines', kind: 'max', d: 20, w: 80, text: 'Clear {n} lines in Falling Blocks' },
        { g: 'flappy', stat: 'score', kind: 'max', d: 10, w: 40, text: 'Pass {n} gaps in Flappy' },
        { g: 'slicer', stat: 'score', kind: 'max', d: 50, w: 200, text: 'Score {n} in Fruit Slicer' },
        { g: 'pong', stat: 'win', kind: 'count', d: 1, w: 5, text: 'Beat the AI in Pong {n} times' },
        { g: 'survivors', stat: 'minutes', kind: 'max', d: 5, w: 15, text: 'Survive {n} minutes in Night Survivors' },
        { g: 'typing', stat: 'wpm', kind: 'max', d: 40, w: 70, text: 'Type at {n} WPM' },
        { g: 'flow', stat: 'win', kind: 'count', d: 3, w: 20, text: 'Solve {n} Flow puzzles' },
        { g: 'pipes', stat: 'win', kind: 'count', d: 3, w: 20, text: 'Solve {n} Pipe puzzles' },
        { g: 'tictactoe', stat: 'win', kind: 'count', d: 2, w: 10, text: 'Win {n} games of Tic-Tac-Toe' },
        { g: 'battleship', stat: 'win', kind: 'count', d: 1, w: 5, text: 'Win {n} games of Battleship' },
        { g: 'dice', stat: 'score', kind: 'max', d: 180, w: 260, text: 'Score {n} in Dice Poker' },
        { g: 'cards', stat: 'win', kind: 'count', d: 1, w: 5, text: 'Win {n} games of Crazy Cards' },
        { g: 'physics', stat: 'score', kind: 'max', d: 500, w: 3000, text: 'Score {n} in Bounce Lab' },
        { g: 'towerdefense', stat: 'wave', kind: 'max', d: 10, w: 25, text: 'Reach wave {n} in Tower Defense' },
        { g: 'connect4', stat: 'win', kind: 'count', d: 2, w: 8, text: 'Win {n} games of Connect Four' },
        { g: 'dots', stat: 'win', kind: 'count', d: 1, w: 6, text: 'Win {n} games of Dots and Boxes' },
        { g: 'solitaire', stat: 'win', kind: 'count', d: 1, w: 4, text: 'Win {n} games of Solitaire' },
        { g: 'nonogram', stat: 'win', kind: 'count', d: 2, w: 10, text: 'Solve {n} Nonograms' },
        { g: 'memory', stat: 'win', kind: 'count', d: 2, w: 10, text: 'Clear {n} Memory boards' },
        { g: 'checkers', stat: 'win', kind: 'count', d: 1, w: 4, text: 'Win {n} games of Checkers' },
        { g: 'fishing', stat: 'fish', kind: 'count', d: 15, w: 80, text: 'Catch {n} fish' },
        { g: 'aimtrainer', stat: 'targets', kind: 'max', d: 30, w: 45, text: 'Hit {n} targets in one Aim Trainer round' },
    ];
    const GENERAL_DAILY = [
        { id: 'games', type: 'games', n: 3, text: 'Play 3 different games' },
        { id: 'xp', type: 'xp', n: 150, text: 'Earn 150 XP' },
        { id: 'mins', type: 'mins', n: 15, text: 'Play for 15 minutes' },
        { id: 'wins', type: 'wins', n: 2, text: 'Win 2 games' },
        { id: 'runs', type: 'runs', n: 5, text: 'Finish 5 rounds of anything' },
        { id: 'bests', type: 'bests', n: 1, text: 'Beat one of your personal bests' },
        { id: 'party', type: 'party', n: 1, text: 'Play a party game with friends' },
    ];
    const GENERAL_WEEKLY = [
        { id: 'wgames', type: 'games', n: 10, text: 'Play 10 different games' },
        { id: 'wxp', type: 'xp', n: 1500, text: 'Earn 1,500 XP' },
        { id: 'wmins', type: 'mins', n: 120, text: 'Play for 2 hours' },
        { id: 'wwins', type: 'wins', n: 15, text: 'Win 15 games' },
        { id: 'wquests', type: 'quests', n: 12, text: 'Finish 12 daily quests' },
        { id: 'wbests', type: 'bests', n: 5, text: 'Beat 5 personal bests' },
    ];
    const REWARD = { dGeneral: [60, 25], dGame: [90, 35], wGeneral: [300, 120], wGame: [400, 150], sweep: [100, 60] };

    const plural = (t, n) => n === 1 ? t.replace(/\b1 (\w+?)s\b/, '1 $1') : t;
    function makeQuest(tpl, slot, isGame, rnd) {
        const [xp, coins] = REWARD[(slot === 'daily' ? 'd' : 'w') + (isGame ? 'Game' : 'General')];
        if (isGame) {
            const n = slot === 'daily' ? tpl.d : tpl.w;
            return { qid: tpl.g + '.' + tpl.stat, g: tpl.g, stat: tpl.stat, type: 'stat', kind: tpl.kind, n, prog: 0, done: false,
                     text: plural(tpl.text.replace('{n}', Arcade.fmt(n)), n), xp, coins };
        }
        return { qid: tpl.id, type: tpl.type, n: tpl.n, prog: 0, done: false, seen: [], text: tpl.text, xp, coins };
    }
    function pickGameTpl(m, rnd, avoid) {
        const played = Arcade.CHALLENGES.filter(c => m.sessions[c.g] && !avoid.includes(c.g + '.' + c.stat));
        // mostly games you actually play, sometimes something new
        const pool = played.length >= 3 && rnd() < 0.75 ? played : Arcade.CHALLENGES.filter(c => !avoid.includes(c.g + '.' + c.stat));
        return pool[Math.floor(rnd() * pool.length)];
    }
    function pickGeneralTpl(list, rnd, avoid) {
        const pool = list.filter(t => !avoid.includes(t.id));
        return pool[Math.floor(rnd() * pool.length)];
    }
    function ensureQuests(m) {
        const dk = dayKey(), wk = weekKey();
        if (!m.quests || m.quests.day !== dk) {
            const rnd = Arcade.seeded('d' + dk + (m.started || 0));
            const a = pickGeneralTpl(GENERAL_DAILY, rnd, []);
            const b = pickGameTpl(m, rnd, []);
            const third = rnd() < 0.5 ? makeQuest(pickGeneralTpl(GENERAL_DAILY, rnd, [a.id]), 'daily', false, rnd)
                                      : makeQuest(pickGameTpl(m, rnd, [b.g + '.' + b.stat]), 'daily', true, rnd);
            m.quests = { day: dk, swept: false, list: [makeQuest(a, 'daily', false, rnd), makeQuest(b, 'daily', true, rnd), third] };
        }
        if (!m.wquests || m.wquests.week !== wk) {
            const rnd = Arcade.seeded('w' + wk + (m.started || 0));
            const a = pickGeneralTpl(GENERAL_WEEKLY, rnd, []);
            const b = pickGeneralTpl(GENERAL_WEEKLY, rnd, [a.id]);
            const c = pickGameTpl(m, rnd, []);
            m.wquests = { week: wk, list: [makeQuest(a, 'weekly', false, rnd), makeQuest(b, 'weekly', false, rnd), makeQuest(c, 'weekly', true, rnd)] };
        }
    }
    function completeQuest(m, q, slot) {
        q.done = true;
        q.prog = q.n;
        grantCoins(m, q.coins);
        pending.push({ t: 'quest', q, slot });
        if (slot === 'daily') {
            m.dailyDone++; m.questsDone++;
            if (m.lastDaily !== dayKey()) {
                m.streak = m.lastDaily === yesterday() ? m.streak + 1 : 1;
                m.bestStreak = Math.max(m.bestStreak || 0, m.streak);
                m.lastDaily = dayKey();
            }
            if (!m.quests.swept && m.quests.list.every(x => x.done)) {
                m.quests.swept = true;
                m.sweeps++;
                grantCoins(m, REWARD.sweep[1]);
                pending.push({ t: 'sweep' });
                grantXP(m, REWARD.sweep[0]);
            }
            grantXP(m, q.xp);
            questEvent(m, 'quests', 1);
        } else {
            m.weeklyDone++; m.questsDone++;
            grantXP(m, q.xp);
        }
    }
    function questEvent(m, type, val, extra) {
        if (!m.quests || !m.wquests) return;
        for (const [slot, box] of [['daily', m.quests], ['weekly', m.wquests]]) {
            if (slot === 'daily' && box.day !== dayKey()) continue;
            if (slot === 'weekly' && box.week !== weekKey()) continue;
            for (const q of box.list) {
                if (q.done) continue;
                if (type === 'stat') {
                    if (q.type !== 'stat' || q.g !== extra.gid || q.stat !== extra.stat) continue;
                    if (q.kind === 'count') { if (!extra.isCount) continue; q.prog += val; }
                    else { if (extra.isCount) continue; q.prog = Math.max(q.prog, val); }
                } else if (type === 'games') {
                    if (q.type !== 'games') continue;
                    q.seen = q.seen || [];
                    if (q.seen.includes(val)) continue;
                    q.seen.push(val);
                    q.prog = q.seen.length;
                } else if (type === 'party') {
                    if (q.type !== 'party') continue;
                    q.prog += 1;
                } else {
                    if (q.type !== type) continue;
                    q.prog += val;
                }
                if (q.prog >= q.n) completeQuest(m, q, slot);
            }
        }
    }

    // today's 3 daily quests and this week's 3 weekly quests
    Arcade.quests = function () {
        return mutate(m => { ensureQuests(m); return { daily: m.quests, weekly: m.wquests, rerolls: m.rerolls.day === dayKey() ? m.rerolls.used : 0 }; });
    };
    // kept for older callers: first daily and first weekly
    Arcade.challenges = function () {
        const q = Arcade.quests();
        return { daily: q.daily.list[0], weekly: q.weekly.list[0] };
    };
    Arcade.rerollCost = (used) => used < 1 ? 0 : 40 * used;
    // swaps an unfinished daily quest for a new one. the first one each day is free
    Arcade.rerollQuest = function (i) {
        return mutate(m => {
            ensureQuests(m);
            const q = m.quests.list[i];
            if (!q || q.done) return false;
            if (m.rerolls.day !== dayKey()) m.rerolls = { day: dayKey(), used: 0 };
            const cost = Arcade.rerollCost(m.rerolls.used);
            if (m.coins < cost) return false;
            m.coins -= cost;
            m.totals.spent += cost;
            m.rerolls.used++;
            const rnd = Math.random;
            const avoid = m.quests.list.map(x => x.qid);
            const nq = q.type === 'stat'
                ? makeQuest(pickGameTpl(m, rnd, avoid), 'daily', true, rnd)
                : makeQuest(pickGeneralTpl(GENERAL_DAILY, rnd, avoid), 'daily', false, rnd);
            m.quests.list[i] = nq;
            return true;
        });
    };

    /* ---------- daily login rewards (7 day cycle) ---------- */
    Arcade.LOGIN_REWARDS = [
        { coins: 30 }, { coins: 45 }, { coins: 60, xp: 40 }, { coins: 80 }, { coins: 100, xp: 80 }, { coins: 130 }, { coins: 250, xp: 200 },
    ];
    Arcade.loginStatus = function () {
        const m = readMeta();
        const d = dayKey();
        const claimed = m.login.last === d;
        const alive = claimed || m.login.last === yesterday();
        const streak = alive ? m.login.streak : 0;
        // which slot of the 7-day strip is next (or was just claimed)
        const idx = claimed ? (streak - 1) % 7 : streak % 7;
        return { claimed, streak, idx, best: m.login.best };
    };
    Arcade.claimLogin = function () {
        return mutate(m => {
            const d = dayKey();
            if (m.login.last === d) return null;
            m.login.streak = m.login.last === yesterday() ? m.login.streak + 1 : 1;
            m.login.last = d;
            m.login.claims++;
            m.login.best = Math.max(m.login.best, m.login.streak);
            const r = Arcade.LOGIN_REWARDS[(m.login.streak - 1) % 7];
            grantCoins(m, r.coins);
            if (r.xp) grantXP(m, r.xp);
            return r;
        });
    };

    /* ---------- reporting results from games ---------- */
    // stats that mean a run/round just ended (used for "rounds played" and run xp)
    const RUN_STATS = new Set(['score', 'distance', 'wave', 'floors', 'wpm', 'minutes', 'level', 'tile', 'lines', 'arenawave', 'bossrush', 'kills', 'ballz', 'targets', 'time']);
    let lastRunAt = 0;

    function recordStat(stat, value, isCount) {
        const gid = Arcade.gameId;
        if (!gid || typeof value !== 'number' || !isFinite(value)) return;
        mutate(m => {
            ensureQuests(m);
            const t = today(m);
            const s = m.stats[gid] = m.stats[gid] || {};
            const prev = s[stat] || 0;
            s[stat] = isCount ? prev + value : Math.max(prev, value);
            let xp = 0;
            if (isCount && stat === 'win') {
                xp += 25;
                m.totals.wins++; t.wins++;
                questEvent(m, 'wins', 1);
            } else if (isCount && (stat === 'round' || stat === 'pvp')) {
                xp += 15;
            } else if (isCount) {
                xp += Math.min(6, 2 * value);
            }
            const now = Date.now();
            if ((RUN_STATS.has(stat) || (isCount && (stat === 'win' || stat === 'round'))) && now - lastRunAt > 3000) {
                lastRunAt = now;
                s.runs = (s.runs || 0) + 1;
                m.totals.runs++; t.runs++;
                t.runsByGame[gid] = (t.runsByGame[gid] || 0) + 1;
                // the first 25 rounds of each game per day pay a little xp
                if (t.runsByGame[gid] <= 25 && !(isCount && stat === 'win')) xp += 8;
                questEvent(m, 'runs', 1);
            }
            if (!isCount && value > prev && prev > 0 && stat !== 'minutes') {
                xp += 15;
                m.totals.bests++; t.bests++;
                questEvent(m, 'bests', 1);
            }
            for (const a of Arcade.ACHIEVEMENTS) if (a.g === gid && a.stat === stat && s[stat] >= a.min) unlockAch(m, a);
            questEvent(m, 'stat', value, { gid, stat, isCount });
            const used = t.xpByGame[gid] || 0;
            xp = Math.max(0, Math.min(xp, 600 - used));
            t.xpByGame[gid] = used + xp;
            grantXP(m, xp);
        });
    }
    // report the result of one run, like Arcade.report('score', 120). keeps the best value
    Arcade.report = (stat, value) => recordStat(stat, Number(value), false);
    // add to a running total, like Arcade.count('win')
    Arcade.count = (stat, n) => recordStat(stat, n === undefined ? 1 : Number(n), true);

    /* ---------- notifications ---------- */
    let xpPop = null, xpPopTimer = 0;
    function showXpPop(gain, before) {
        if (!document.body) return;
        const m = readMeta();
        const li = Arcade.levelInfo(m.xp);
        const startPct = li.level > before ? 0 : Math.max(0, (li.into - gain) / li.need);
        if (!xpPop) {
            xpPop = document.createElement('div');
            xpPop.className = 'xp-pop';
            xpPop.innerHTML = '<span class="lv"></span><div><span class="t"></span><small></small><div class="xb"><i></i></div></div>';
        }
        clearTimeout(xpPopTimer);
        xpPop.classList.remove('out');
        if (!xpPop.isConnected) document.body.appendChild(xpPop);
        xpPop.querySelector('.lv').textContent = li.level;
        xpPop.querySelector('.t').textContent = '+' + gain + ' XP';
        xpPop.querySelector('small').textContent = li.into + ' / ' + li.need + ' to level ' + (li.level + 1);
        const bar = xpPop.querySelector('i');
        bar.style.transition = 'none';
        bar.style.width = (startPct * 100) + '%';
        void bar.offsetWidth;
        bar.style.transition = '';
        bar.style.width = (li.pct * 100) + '%';
        xpPopTimer = setTimeout(() => { xpPop.classList.add('out'); setTimeout(() => xpPop && xpPop.remove(), 380); }, 2600);
    }
    function flush() {
        const list = pending;
        pending = [];
        let gain = 0, before = Infinity;
        let delay = 0;
        const later = (fn) => { setTimeout(fn, delay); delay += 750; };
        for (const p of list) {
            if (p.t === 'xp') { gain += p.n; before = Math.min(before, p.before); }
            else if (p.t === 'level') later(() => {
                const extra = p.unlocks.length ? ' · new: ' + p.unlocks.map(u => u.slot === 'avatar' ? u.item.name : u.item.name).join(', ') : '';
                Arcade.toast(`Level ${p.lvl}! +${p.coins} coins${extra}`, 'gold', 3600);
                Arcade.sfx('level');
            });
            else if (p.t === 'ach') later(() => { Arcade.toast(`Achievement: ${p.a.icon} ${p.a.title}`, 'gold', 3400); Arcade.sfx('win'); });
            else if (p.t === 'quest') later(() => { Arcade.toast(`${p.slot === 'daily' ? 'Daily' : 'Weekly'} quest done: ${p.q.text}`, 'good', 3600); Arcade.sfx('coin'); });
            else if (p.t === 'sweep') later(() => Arcade.toast('All daily quests done! Bonus +' + REWARD.sweep[0] + ' XP', 'gold', 3600));
        }
        if (gain > 0 && Arcade.gameId) showXpPop(gain, before === Infinity ? 1 : before);
    }

    /* ---------- save export / import ---------- */
    Arcade.exportSave = function () {
        const data = {};
        try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); data[k] = localStorage.getItem(k); } } catch (e) { }
        return { app: 'everygame-arcade', version: 2, exported: new Date().toISOString(), data };
    };
    Arcade.importSave = function (obj) {
        if (!obj || obj.app !== 'everygame-arcade' || !obj.data) throw new Error('Not an arcade save file');
        for (const [k, v] of Object.entries(obj.data)) { try { localStorage.setItem(k, v); } catch (e) { } }
        return Object.keys(obj.data).length;
    };
    // triggers a download of a text file
    Arcade.download = function (name, text, type) {
        const url = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    };

    /* ---------- play-time tracking (only while the tab is visible) ---------- */
    const TICK = 15;
    function stampFlags(m) {
        const d = new Date(), h = d.getHours(), wd = d.getDay();
        if (h < 4) m.flags.owl = true;
        if (h >= 5 && h < 7) m.flags.bird = true;
        if (wd === 6) m.flags.sat = true;
        if (wd === 0) m.flags.sun = true;
    }
    function startTracking() {
        const gid = Arcade.gameId;
        if (!gid) return;
        mutate(m => {
            ensureQuests(m);
            m.sessions[gid] = (m.sessions[gid] || 0) + 1;
            m.lastSeen[gid] = Date.now();
            const t = today(m);
            if (!t.games.includes(gid)) t.games.push(gid);
            questEvent(m, 'games', gid);
            if (PARTY_IDS.includes(gid)) questEvent(m, 'party', 1);
            stampFlags(m);
        });
        let secs = 0;
        setInterval(() => {
            if (document.hidden) return;
            secs += TICK;
            const minute = secs % 60 === 0;
            mutate(m => {
                m.playtime[gid] = (m.playtime[gid] || 0) + TICK;
                m.lastSeen[gid] = Date.now();
                if (!minute) return;
                ensureQuests(m);
                const t = today(m);
                t.mins++;
                questEvent(m, 'mins', 1);
                stampFlags(m);
                // 2 xp per active minute, up to 200 a day
                if (t.playXP < 200) { t.playXP += 2; grantXP(m, 2); pending = pending.filter(p => p.t !== 'xp'); }
            });
        }, TICK * 1000);
        window.addEventListener('pagehide', () => mutate(m => { m.lastSeen[gid] = Date.now(); }));
    }

    /* ---------- icon buttons: swap old glyphs for svg icons ---------- */
    const GLYPHS = { '⏸': 'pause', '⏸️': 'pause', '▶': 'play', '▶️': 'play', '⏯': 'play', '⚙': 'settings', '⚙️': 'settings', '⟲': 'restart', '↻': 'restart', '⟳': 'restart', '☰': 'menu', '❔': 'help', '↶': 'undo' };
    function iconize(b) {
        const t = (b.textContent || '').trim();
        if (GLYPHS[t] && !b.querySelector('svg')) { b.innerHTML = Arcade.icon(GLYPHS[t]); if (!b.title) b.title = GLYPHS[t]; }
    }
    function wireIcons() {
        Arcade.$$('.btn.icon, #pauseBtn, .rbtn').forEach(b => {
            iconize(b);
            if (b._iconObs || !window.MutationObserver) return;
            b._iconObs = new MutationObserver(() => iconize(b));
            b._iconObs.observe(b, { childList: true, characterData: true, subtree: true });
        });
    }

    /* ---------- auto wiring on load ---------- */
    document.addEventListener('DOMContentLoaded', () => {
        // the top bar wraps on narrow phones, menus need its real height to sit below it
        const bar = document.querySelector('.topbar');
        if (bar) {
            const measure = () => document.documentElement.style.setProperty('--topbar-real', bar.offsetHeight + 'px');
            measure();
            window.addEventListener('resize', measure);
        }
        wireIcons();
        Arcade.setMuted(Arcade.muted);
        Arcade.$$('[data-mute]').forEach(b => b.addEventListener('click', () => {
            Arcade.setMuted(!Arcade.muted);
            if (!Arcade.muted) Arcade.sfx('select');
        }));
        startTracking();
    });

    // apply the chosen theme straight away (games can still override)
    try { if (!document.documentElement.dataset.theme) document.documentElement.dataset.theme = Arcade.cosmetic('theme'); } catch (e) { }

    document.addEventListener('DOMContentLoaded', () => {
        // wide canvas games suggest turning the phone
        if (document.body.dataset.wide !== undefined) {
            const stage = document.querySelector('.stage');
            if (stage) stage.insertAdjacentHTML('afterbegin', '<div class="rotate-hint">Turn your phone sideways for a bigger view</div>');
        }
    });
    // going back to the hub steps back through history when that's where we came from, so the
    // phone's own back button leaves the app from the hub instead of walking through old games
    document.addEventListener('click', (e) => {
        const a = e.target.closest && e.target.closest('a[href$="GameIndex.html"]');
        if (!a || history.length < 2) return;
        let ref = '';
        try { ref = new URL(document.referrer).pathname; } catch (err) { return; }
        if (ref.endsWith('/GameIndex.html')) { e.preventDefault(); history.back(); }
    });

    window.Arcade = Arcade;
})();
