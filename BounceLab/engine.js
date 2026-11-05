/* =====================================================================
   Bounce Lab engine: the physics + rendering core shared by every
   simulation in the Physics Shorts and Brick Shorts feeds.
   Exposes window.BL.
   ===================================================================== */
(() => {
    'use strict';
    const BL = window.BL = {};
    const TAU = Math.PI * 2, clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const W = 360, H = 640, CX = 180, CY = 340;
    Object.assign(BL, { TAU, clamp, W, H, CX, CY });

    /* ---------- look & feel (shared by every sim, saved) ---------- */
    BL.PALETTES = {
        neon: ['#ee5a72', '#f2893d', '#f6c445', '#4fc07f', '#3fb3c8', '#4f8ef0', '#9a6de0', '#e5659a'],
        pastel: ['#fda4af', '#fdba74', '#fde68a', '#bbf7d0', '#a8e4ec', '#bfdbfe', '#ddd6fe', '#fbcfe8'],
        fire: ['#fef08a', '#f8d25c', '#f6c445', '#f59a55', '#f2893d', '#ef5b56', '#d9483f', '#f7a8a1'],
        ocean: ['#e0f2fe', '#8ccbee', '#5bb8ea', '#4aa8dd', '#3fb3c8', '#3fb09c', '#54c9b4', '#a8e4ec'],
        candy: ['#f08aa7', '#b58ce8', '#8b8fec', '#6ba6ee', '#5fcda0', '#f5b942', '#f27d8e', '#a18bec'],
        mono: [Arcade.ui.text, Arcade.ui.text, Arcade.ui.muted, Arcade.ui.muted, Arcade.ui.text, Arcade.ui.text, Arcade.ui.muted, '#fafafa'],
        rainbow: null,
    };
    BL.BGS = { midnight: 'Midnight', stars: 'Starfield', grid: 'Neon grid', sunset: 'Sunset', black: 'Pure black', paper: 'Paper' };
    BL.INSTS = { triangle: 'Piano', bell: 'Bells', square: 'Chiptune', sawtooth: 'Synth', marimba: 'Marimba' };
    BL.look = Object.assign({ palette: 'neon', bg: 'midnight', inst: 'triangle', hud: true, viz: true, trails: true, glow: true, shake: true, vol: 0.8 }, Arcade.load('arcade.physics.look', {}) || {});
    BL.saveLook = () => Arcade.save('arcade.physics.look', BL.look);
    BL.pcol = (i, t) => {
        if (BL.look.palette === 'rainbow') return `hsl(${(i * 47 + t * 60) % 360},90%,62%)`;
        const p = BL.PALETTES[BL.look.palette] || BL.PALETTES.neon;
        return p[((i % p.length) + p.length) % p.length];
    };
    BL.TEAM = [['Red', '#ef5b56'], ['Blue', '#4f8ef0'], ['Green', '#4fc07f'], ['Gold', '#f6c445'], ['Purple', '#9a6de0'], ['Pink', '#e5659a'], ['Cyan', '#3fb3c8'], ['Orange', '#f2893d']];

    /* ---------- songs: each bounce plays the next note ---------- */
    BL.SONGS = [
        ['Ode to Joy', 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4 D4 D4 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4 C4 C4'],
        ['Twinkle Twinkle', 'C4 C4 G4 G4 A4 A4 G4 F4 F4 E4 E4 D4 D4 C4 G4 G4 F4 F4 E4 E4 D4 G4 G4 F4 F4 E4 E4 D4 C4 C4 G4 G4 A4 A4 G4 F4 F4 E4 E4 D4 D4 C4'],
        ['Für Elise', 'E5 D#5 E5 D#5 E5 B4 D5 C5 A4 C4 E4 A4 B4 E4 G#4 B4 C5 E4 E5 D#5 E5 D#5 E5 B4 D5 C5 A4 C4 E4 A4 B4 E4 C5 B4 A4'],
        ['Mountain King', 'A3 B3 C4 D4 E4 C4 E4 D#4 B3 D#4 D4 A#3 D4 A3 B3 C4 D4 E4 C4 E4 A4 G4 E4 C4 E4 G4'],
        ['Korobeiniki', 'E5 B4 C5 D5 C5 B4 A4 A4 C5 E5 D5 C5 B4 C5 D5 E5 C5 A4 A4 D5 F5 A5 G5 F5 E5 C5 E5 D5 C5 B4 B4 C5 D5 E5 C5 A4 A4'],
        ['Canon in D', 'F#5 E5 D5 C#5 B4 A4 B4 C#5 D5 C#5 B4 A4 G4 F#4 G4 E4 D4 F#4 A4 G4 F#4 D4 F#4 E4 D4 B3 D4 A4 G4 B4 A4 G4'],
        ['Greensleeves', 'A4 C5 D5 E5 F5 E5 D5 B4 G4 A4 B4 C5 A4 A4 G#4 A4 B4 G#4 E4 A4 C5 D5 E5 F5 E5 D5 B4 G4 A4 B4 C5 B4 A4 G#4 F#4 G#4 A4 A4'],
        ['Jingle Bells', 'E4 E4 E4 E4 E4 E4 E4 G4 C4 D4 E4 F4 F4 F4 F4 F4 E4 E4 E4 E4 D4 D4 E4 D4 G4'],
        ['Frère Jacques', 'C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4 E4 F4 G4 G4 A4 G4 F4 E4 C4 G4 A4 G4 F4 E4 C4 C4 G3 C4 C4 G3 C4'],
        ['Turkish March', 'B4 A4 G#4 A4 C5 D5 C5 B4 C5 E5 F5 E5 D#5 E5 B5 A5 G#5 A5 B5 A5 G#5 A5 C6 A5 C6 B5 A5 G5 A5'],
        ['Minuet in G', 'D5 G4 A4 B4 C5 D5 G4 G4 E5 C5 D5 E5 F#5 G5 G4 G4 C5 D5 C5 B4 A4 B4 C5 B4 A4 G4 F#4 G4 A4 B4 G4 A4'],
        ['Happy Birthday', 'G4 G4 A4 G4 C5 B4 G4 G4 A4 G4 D5 C5 G4 G4 G5 E5 C5 B4 A4 F5 F5 E5 C5 D5 C5'],
        ['Beethoven 5th', 'G4 G4 G4 D#4 F4 F4 F4 D4 G4 G4 G4 D#4 G#4 G#4 G#4 G4 D#5 D#5 D#5 C5'],
        ['Swan Lake', 'F#4 B3 C#4 D4 E4 F#4 D4 F#4 D4 F#4 B3 D4 B3 G3 D4 B3'],
        ['Can-can', 'C4 D4 F4 E4 D4 G4 G4 G4 A4 E4 F4 D4 D4 D4 F4 E4 D4 C4 C5 B4 A4 G4 F4 E4 D4'],
        ['Scarborough Fair', 'D4 D4 A4 A4 E4 F4 E4 D4 A4 C5 D5 C5 A4 B4 G4 A4 D5 D5 D5 C5 A4 A4 G4 F4 E4 D4 C4 D4'],
        ['Pentatonic dream', null],
        ['Arpeggio rain', null],
    ];
    const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    BL.midiFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
    BL.songNotes = (i, rng) => {
        const s = BL.SONGS[i];
        if (s[1]) return s[1].split(' ').map(n => { const m = /^([A-G])(#?)(\d)$/.exec(n); return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] ? 1 : 0); });
        const out = [];
        if (s[0] === 'Arpeggio rain') {
            const roots = [57, 53, 48, 55];
            for (const r of roots) for (let k = 0; k < 3; k++) for (const iv of [0, 4, 7, 12, 16, 12, 7, 4]) out.push(r + iv + (r === 57 || r === 53 ? (iv === 4 || iv === 16 ? -1 : 0) : 0));
            return out;
        }
        const st = [0, 2, 4, 7, 9];
        let n = 7;
        for (let k = 0; k < 48; k++) { n = clamp(n + Math.round((rng() - 0.5) * 4.8), 0, 14); out.push(57 + st[n % 5] + 12 * Math.floor(n / 5)); }
        return out;
    };

    /* ---------- synth: our own audio graph so recordings include sound ---------- */
    let AC = null, master = null;
    BL.recDest = null;
    BL.gestured = false;
    const markGesture = () => { BL.gestured = true; audio(); };
    window.addEventListener('pointerdown', markGesture, { once: false, capture: true });
    window.addEventListener('keydown', markGesture, { once: false, capture: true });
    function audio() {
        if (!BL.gestured) return null;
        if (!AC) {
            const A = window.AudioContext || window.webkitAudioContext;
            if (!A) return null;
            AC = new A();
            master = AC.createGain(); master.gain.value = 0.9;
            const comp = AC.createDynamicsCompressor();
            master.connect(comp); comp.connect(AC.destination);
            if (AC.createMediaStreamDestination) { BL.recDest = AC.createMediaStreamDestination(); comp.connect(BL.recDest); }
        }
        if (AC.state === 'suspended') AC.resume();
        return AC;
    }
    BL.audio = audio;
    BL.synth = (freq, dur = 0.28, vol = 0.07, inst = BL.look.inst) => {
        if (Arcade.muted) return;
        const a = audio(); if (!a) return;
        const t0 = a.currentTime, v = vol * BL.look.vol;
        const voice = (f, type, vv, d) => {
            const o = a.createOscillator(), g = a.createGain();
            o.type = type; o.frequency.value = f;
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vv), t0 + 0.006);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
            o.connect(g).connect(master); o.start(t0); o.stop(t0 + d + 0.03);
        };
        if (inst === 'bell') { voice(freq, 'sine', v, dur * 2.2); voice(freq * 2.76, 'sine', v * 0.25, dur); voice(freq * 5.4, 'sine', v * 0.08, dur * 0.5); }
        else if (inst === 'marimba') { voice(freq, 'sine', v * 1.1, dur * 0.8); voice(freq * 4, 'sine', v * 0.18, dur * 0.25); }
        else if (inst === 'triangle') { voice(freq, 'triangle', v, dur * 1.6); voice(freq * 2, 'sine', v * 0.2, dur); }
        else voice(freq, inst, v * 0.55, dur);
    };
    BL.noise = (dur = 0.12, vol = 0.05, hp = 2000) => {
        if (Arcade.muted) return;
        const a = audio(); if (!a) return;
        const len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
        const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
        f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol * BL.look.vol;
        src.buffer = buf; src.connect(f).connect(g).connect(master); src.start();
    };
    BL.glass = (pitch = 1) => { BL.noise(0.18, 0.06, 3000); BL.synth(1800 * pitch + Math.random() * 600, 0.12, 0.03, 'sine'); };

    /* ---------- parameters (Ball Engine style) ---------- */
    BL.PDEF = { g: 600, rest: 1, rand: 0.05, speed: 260, accel: 0, vmax: 2600, grow: 0, rmax: 140, genesis: 1, spawn: 0, spread: 360, spawnGap: 0.3, popMax: 300, arena: 150, r: 7, collide: false };
    BL.PARAMS = [
        ['g', 'Gravity', 0, 2000, 25], ['rest', 'Bounciness', 0, 2, 0.05], ['rand', 'Bounce randomness', 0, 1, 0.05],
        ['speed', 'Starting speed', 0, 900, 10], ['accel', 'Speed build-up', 0, 0.1, 0.005], ['vmax', 'Max speed', 100, 4000, 50],
        ['grow', 'Growth per bounce', 0, 6, 0.1], ['rmax', 'Max ball size', 5, 170, 1], ['r', 'Ball size', 2, 30, 1],
        ['genesis', 'Starting balls', 1, 20, 1], ['spawn', 'New balls per bounce', 0, 5, 1], ['spread', 'Spread angle', 0, 360, 5], ['spawnGap', 'Spawn gap (s)', 0, 2, 0.05],
        ['popMax', 'Max population', 10, 600, 10], ['arena', 'Arena size', 60, 170, 1],
    ];
    BL.MODES = {};

    /* =====================================================================
       Sim creation
       ===================================================================== */
    BL.newSim = (spec, audible = true) => {
        const M = BL.MODES[spec.type] || BL.MODES.escape;
        const rng = Arcade.seeded((spec.seed >>> 0) || 1);
        const R = (a, b) => a + rng() * (b - a), RI = (a, b) => Math.floor(a + rng() * (b - a + 1));
        const base = Object.assign({}, BL.PDEF, M.P ? M.P(R, RI, rng) : {});
        const P = Object.assign({}, base, spec.o || {});
        const S = {
            spec, M, type: spec.type, rng, R, RI, P, base, t: 0, balls: [], rings: [], poly: null, cells: [], segs: [], bricks: [],
            kind: 'circle', arena: P.arena, done: false, doneT: 0, doneMsg: '', bounces: 0, fx: new Arcade.Particles(900), waves: [], texts: [],
            flash: 0, flashC: '#fff', shake: 0, cam: 0, worldH: H, bars: new Float32Array(28), noteI: 0, lastNote: 0, audible, title: M.name, cellRot: 0, cellSpin: 0, speedMul: 1,
        };
        const si = spec.o && spec.o.song != null && spec.o.song >= 0 ? spec.o.song % BL.SONGS.length : Math.floor(rng() * BL.SONGS.length);
        S.song = BL.songNotes(si, rng); S.songName = BL.SONGS[si][0];
        S.addBall = (x, y, ang, sp, r, ci, extra) => {
            const b = Object.assign({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: r == null ? S.P.r : r, ci: ci == null ? S.balls.length : ci, tr: [], spawnCd: 0 }, extra || {});
            S.balls.push(b); return b;
        };
        S.finish = (msg) => {
            if (S.done) return;
            S.done = true; S.doneMsg = msg; S.doneT = 0; S.doneAt = S.t;
            if (S.audible) { const r = S.song[0] || 60; [0, 4, 7, 12].forEach((iv, i) => setTimeout(() => BL.synth(BL.midiFreq(r + iv), 0.5, 0.05), i * 90)); }
        };
        S.text = (x, y, s, c, big) => { if (S.texts.length < 40) S.texts.push({ x, y, s, c: c || '#fff', t: big ? 1.6 : 0.8, big }); };
        S.wave = (x, y, c, r = 6) => { if (S.waves.length < 40) S.waves.push({ x, y, r, c, t: 0 }); };
        S.ballCol = (b) => b.col || BL.pcol(b.ci, S.t);
        M.init(S, R, RI, rng);
        if (!S.balls.length && M.needsBalls !== false && S.kind !== 'none') {/* modes add their own balls */ }
        return S;
    };
    BL.note = (S, b, extra = 0, force) => {
        const now = performance.now();
        if (!force && now - S.lastNote < 38) return;
        S.lastNote = now;
        const m = S.song[S.noteI % S.song.length] + extra;
        S.noteI++;
        const k = Math.floor(clamp((m - 45) / 40, 0, 0.999) * S.bars.length);
        for (let i = -2; i <= 2; i++) { const j = k + i; if (j >= 0 && j < S.bars.length) S.bars[j] = Math.min(1, S.bars[j] + (1 - Math.abs(i) * 0.3)); }
        if (S.audible) BL.synth(BL.midiFreq(m), 0.28, 0.065);
    };

    /* ---------- the bounce: Ball Engine's settings act here ---------- */
    BL.onHit = (S, b, x, y, kind, obj) => {
        const P = S.P;
        S.bounces++;
        if (P.rand) { const a = (S.rng() - 0.5) * P.rand * 1.2, c = Math.cos(a), s = Math.sin(a); const vx = b.vx * c - b.vy * s; b.vy = b.vx * s + b.vy * c; b.vx = vx; }
        let sp = Math.hypot(b.vx, b.vy);
        if (P.accel) { b.vx *= 1 + P.accel; b.vy *= 1 + P.accel; sp *= 1 + P.accel; }
        if (sp > P.vmax) { const k = P.vmax / sp; b.vx *= k; b.vy *= k; }
        if (P.grow && !b.noGrow) b.r = Math.min(b.r + P.grow, P.rmax);
        if (P.spawn > 0 && S.balls.length < P.popMax && S.t >= b.spawnCd && !b.noSpawn) {
            b.spawnCd = S.t + Math.max(0.02, P.spawnGap);
            const base = Math.atan2(b.vy, b.vx), spd = Math.max(120, Math.hypot(b.vx, b.vy));
            for (let k = 0; k < P.spawn && S.balls.length < P.popMax; k++) {
                const a = base + (S.rng() - 0.5) * P.spread * Math.PI / 180;
                S.addBall(b.x, b.y, a, spd, b.r, S.balls.length, Object.assign({ spawnCd: S.t + Math.max(0.02, P.spawnGap) }, b.col ? { col: b.col } : null));
            }
        }
        if (!b.silent) BL.note(S, b);
        if (S.balls.length < 60) { S.wave(x, y, S.ballCol(b), b.r); S.fx.emit(x, y, { n: 3, speed: 90, color: S.ballCol(b), life: 0.3, size: 3 }); }
        if (S.M.hit) S.M.hit(S, b, kind, obj, x, y);
    };
    // n points INTO the wall; (wvx, wvy) is the wall's own velocity
    BL.reflect = (S, b, nx, ny, wvx = 0, wvy = 0, rest) => {
        const rvx = b.vx - wvx, rvy = b.vy - wvy, vn = rvx * nx + rvy * ny;
        if (vn <= 0) return false;
        const e = rest == null ? S.P.rest : rest;
        b.vx = rvx - (1 + e) * vn * nx + wvx; b.vy = rvy - (1 + e) * vn * ny + wvy;
        return true;
    };

    /* =====================================================================
       Containers
       ===================================================================== */
    const normA = (a) => ((a % TAU) + TAU) % TAU;
    BL.normA = normA;
    function wallCircle(S, b, R0) {
        const dx = b.x - CX, dy = b.y - CY, d = Math.hypot(dx, dy) || 1e-6;
        if (d + b.r <= R0) return;
        const nx = dx / d, ny = dy / d;
        const hit = BL.reflect(S, b, nx, ny);
        const k = Math.max(0, R0 - b.r); b.x = CX + nx * k; b.y = CY + ny * k;
        if (hit) BL.onHit(S, b, CX + nx * R0, CY + ny * R0, 'wall');
    }
    function inGap(ring, dx, dy, br) {
        const a = normA(Math.atan2(dy, dx) - ring.rot), half = Math.asin(Math.min(1, br / ring.r));
        return a > half && a < ring.gap - half;
    }
    function wallRings(S, b) {
        const dx = b.x - CX, dy = b.y - CY, d = Math.hypot(dx, dy) || 1e-6, nx = dx / d, ny = dy / d;
        let cont = null, inner = null;
        for (const R of S.rings) { if (!R.alive) continue; if (R.r >= d) { if (!cont || R.r < cont.r) cont = R; } else if (!inner || R.r > inner.r) inner = R; }
        if (b.cont && b.cont !== cont && b.cont.alive && d > b.cont.r && S.M.passed) S.M.passed(S, b, b.cont);
        b.cont = cont;
        if (!cont && !b.out) { b.out = true; if (S.M.escaped) S.M.escaped(S, b); }
        if (cont && cont.alive && d + b.r > cont.r && !inGap(cont, dx, dy, b.r)) { const h = BL.reflect(S, b, nx, ny); b.x = CX + nx * (cont.r - b.r); b.y = CY + ny * (cont.r - b.r); if (h) BL.onHit(S, b, CX + nx * cont.r, CY + ny * cont.r, 'ring', cont); }
        if (inner && d - b.r < inner.r && !inGap(inner, dx, dy, b.r)) { const h = BL.reflect(S, b, -nx, -ny); b.x = CX + nx * (inner.r + b.r); b.y = CY + ny * (inner.r + b.r); if (h) BL.onHit(S, b, CX + nx * inner.r, CY + ny * inner.r, 'ring', inner); }
    }
    function wallPoly(S, b) {
        const P = S.poly, half = P.a * Math.tan(Math.PI / P.n);
        for (let i = 0; i < P.n; i++) {
            const th = P.rot + (i + 0.5) * TAU / P.n, ex = Math.cos(th), ey = Math.sin(th);
            const ddx = b.x - CX, ddy = b.y - CY, s = ddx * ex + ddy * ey - P.a;
            if (s + b.r <= 0 || s - b.r > 0) continue;
            const tx = -ey, ty = ex, u = ddx * tx + ddy * ty;
            if (Math.abs(u) > half + b.r * 0.5) continue;
            if (i === P.gapEdge && Math.abs(u) < half * P.gapFrac - b.r) continue;
            const px = ex * P.a + tx * u, py = ey * P.a + ty * u;
            const h = BL.reflect(S, b, ex, ey, -P.spin * py, P.spin * px);
            b.x -= (s + b.r) * ex; b.y -= (s + b.r) * ey;
            if (h) BL.onHit(S, b, CX + px, CY + py, 'wall');
        }
        if (P.gapEdge >= 0 && !b.out && Math.hypot(b.x - CX, b.y - CY) > P.a / Math.cos(Math.PI / P.n) + b.r) { b.out = true; if (S.M.escaped) S.M.escaped(S, b); }
    }
    function wallBox(S, b) {
        const B = S.box;
        if (b.x - b.r < B.x0) { b.x = B.x0 + b.r; if (BL.reflect(S, b, -1, 0)) BL.onHit(S, b, B.x0, b.y, 'wall'); }
        if (b.x + b.r > B.x1) { b.x = B.x1 - b.r; if (BL.reflect(S, b, 1, 0)) BL.onHit(S, b, B.x1, b.y, 'wall'); }
        if (b.y - b.r < B.y0) { b.y = B.y0 + b.r; if (BL.reflect(S, b, 0, -1)) BL.onHit(S, b, b.x, B.y0, 'wall'); }
        if (b.y + b.r > B.y1 && !B.openBottom) { b.y = B.y1 - b.r; if (BL.reflect(S, b, 0, 1)) BL.onHit(S, b, b.x, B.y1, 'floor'); }
    }

    /* ---------- obstacles ---------- */
    BL.damageCell = (S, c, n = 1) => {
        if (!c.alive || c.hp === Infinity) return;
        c.hp -= n; c.hitT = 0.15;
        if (c.hp > 0) return;
        c.alive = false;
        S.fx.emit(c.x, c.y, { n: 8, speed: 140, color: [c.c || '#bae6fd', '#fff'], life: 0.5, size: 3, gravity: 300 });
        if (S.audible && Math.random() < 0.7) BL.glass(1 + Math.random() * 0.4);
        if (S.M.broke) S.M.broke(S, c);
    };
    function hitCells(S, b) {
        for (let i = 0; i < S.cells.length; i++) {
            const c = S.cells[i];
            if (!c.alive || c.ghost) continue;
            const dx = b.x - c.x, dy = b.y - c.y, rr = b.r + c.r;
            if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
            const d2 = dx * dx + dy * dy;
            if (d2 >= rr * rr) continue;
            const d = Math.sqrt(d2) || 1e-6, ux = dx / d, uy = dy / d;
            b.x = c.x + ux * rr; b.y = c.y + uy * rr;
            if (BL.reflect(S, b, -ux, -uy, c.vx || 0, c.vy || 0, c.rest)) {
                BL.onHit(S, b, c.x + ux * c.r, c.y + uy * c.r, 'cell', c);
                if (S.M.cell) S.M.cell(S, c, b); else BL.damageCell(S, c, 1);
            }
        }
    }
    // optional spatial grid for maps with hundreds of wall pieces (spirals)
    BL.buildSegGrid = (S, cs = 32) => {
        const G = new Map();
        for (const s of S.segs) for (let gx = Math.floor(s.xmin / cs); gx <= Math.floor(s.xmax / cs); gx++) for (let gy = Math.floor(s.ymin / cs); gy <= Math.floor(s.ymax / cs); gy++) { const k = gx * 10007 + gy; let a = G.get(k); if (!a) G.set(k, a = []); a.push(s); }
        S.segGrid = { G, cs, stamp: 0 };
    };
    function segCandidates(S, b) {
        const SG = S.segGrid, cs = SG.cs, out = [], st = ++SG.stamp;
        for (let gx = Math.floor((b.x - b.r) / cs); gx <= Math.floor((b.x + b.r) / cs); gx++) for (let gy = Math.floor((b.y - b.r) / cs); gy <= Math.floor((b.y + b.r) / cs); gy++) {
            const a = SG.G.get(gx * 10007 + gy); if (!a) continue;
            for (const s of a) if (s._st !== st) { s._st = st; out.push(s); }
        }
        return out;
    }
    function hitSegs(S, b) {
        for (const s of (S.segGrid ? segCandidates(S, b) : S.segs)) {
            if (s.off || b.y + b.r < s.ymin || b.y - b.r > s.ymax || b.x + b.r < s.xmin || b.x - b.r > s.xmax) continue;
            const ex = s.x2 - s.x1, ey = s.y2 - s.y1, L2 = ex * ex + ey * ey || 1;
            let t = ((b.x - s.x1) * ex + (b.y - s.y1) * ey) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
            const px = s.x1 + ex * t, py = s.y1 + ey * t, dx = b.x - px, dy = b.y - py, d2 = dx * dx + dy * dy;
            if (d2 >= b.r * b.r) continue;
            if (s.trigger) { if (S.M.trigger) S.M.trigger(S, s, b); continue; }
            const d = Math.sqrt(d2);
            let nx, ny;
            if (d > 1e-5) { nx = -dx / d; ny = -dy / d; } else { const L = Math.sqrt(L2); nx = ey / L; ny = -ex / L; }
            b.x = px - nx * b.r; b.y = py - ny * b.r;
            if (BL.reflect(S, b, nx, ny, 0, 0, s.rest)) { BL.onHit(S, b, px, py, 'seg', s); if (S.M.seg) S.M.seg(S, s, b); }
        }
    }
    BL.seg = (S, x1, y1, x2, y2, extra) => {
        const s = Object.assign({ x1, y1, x2, y2, xmin: Math.min(x1, x2) - 1, xmax: Math.max(x1, x2) + 1, ymin: Math.min(y1, y2) - 1, ymax: Math.max(y1, y2) + 1 }, extra || {});
        S.segs.push(s); return s;
    };
    function hitBricks(S, b) {
        for (const k of S.bricks) {
            if (!k.alive) continue;
            const cx = clamp(b.x, k.x, k.x + k.w), cy = clamp(b.y, k.y, k.y + k.h), dx = b.x - cx, dy = b.y - cy;
            if (dx * dx + dy * dy > b.r * b.r) continue;
            const act = S.M.brick ? S.M.brick(S, k, b) : 'bounce';
            if (act === 'pass') continue;
            const ox = Math.min(b.x + b.r - k.x, k.x + k.w - (b.x - b.r)), oy = Math.min(b.y + b.r - k.y, k.y + k.h - (b.y - b.r));
            if (ox < oy) { const left = b.x < k.x + k.w / 2; b.x += left ? -ox : ox; BL.reflect(S, b, left ? 1 : -1, 0); }
            else { const up = b.y < k.y + k.h / 2; b.y += up ? -oy : oy; BL.reflect(S, b, 0, up ? 1 : -1); }
            BL.onHit(S, b, cx, cy, 'brick', k);
            break;
        }
    }
    BL.damageBrick = (S, k, n = 1) => {
        if (!k.alive || k.hp === Infinity) return false;
        k.hp -= n; k.hitT = 0.12;
        if (k.hp > 0) return false;
        k.alive = false;
        S.fx.emit(k.x + k.w / 2, k.y + k.h / 2, { n: 6, speed: 130, color: [k.c, '#fff'], life: 0.45, size: 3, gravity: 300 });
        if (S.M.brokeBrick) S.M.brokeBrick(S, k);
        return true;
    };
    function ballBall(S) {
        const L = S.balls, e = Math.min(1, S.P.rest) * 0.92;
        let rmax = 4; for (const b of L) if (b.r > rmax) rmax = b.r;
        const cs = rmax * 2 + 1, grid = new Map();
        for (let i = 0; i < L.length; i++) { const b = L[i]; if (b.dead || b.out || b.ghost) continue; const k = (Math.floor(b.x / cs) + 200) + (Math.floor(b.y / cs) + 200) * 4096; let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(i); }
        for (const [k, list] of grid) {
            const gx = k % 4096, gy = Math.floor(k / 4096);
            for (let ox = 0; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
                if (ox === 0 && oy < 0) continue;
                const other = ox === 0 && oy === 0 ? list : grid.get((gx + ox) + (gy + oy) * 4096);
                if (!other) continue;
                for (let ia = 0; ia < list.length; ia++) for (let ib = (other === list ? ia + 1 : 0); ib < other.length; ib++) {
                    const a = L[list[ia]], b = L[other[ib]];
                    const dx = a.x - b.x, dy = a.y - b.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
                    if (d2 >= rr * rr || d2 === 0) continue;
                    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ma = a.m || a.r * a.r, mb = b.m || b.r * b.r, ov = rr - d;
                    a.x += nx * ov * mb / (ma + mb); a.y += ny * ov * mb / (ma + mb);
                    b.x -= nx * ov * ma / (ma + mb); b.y -= ny * ov * ma / (ma + mb);
                    const vr = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
                    if (vr < 0) {
                        const j = -(1 + e) * vr / (1 / ma + 1 / mb);
                        a.vx += j / ma * nx; a.vy += j / ma * ny; b.vx -= j / mb * nx; b.vy -= j / mb * ny;
                        if (S.M.bump) S.M.bump(S, a, b);
                        else if (S.audible && -vr > 150 && Math.random() < 0.15) BL.note(S, a, 12);
                    }
                }
            }
        }
    }

    /* =====================================================================
       Stepping
       ===================================================================== */
    BL.stepSim = (S, dt) => {
        dt *= S.speedMul;
        S.t += dt;
        if (S.done) S.doneT += dt;
        S.flash = Math.max(0, S.flash - dt * 3);
        S.shake = Math.max(0, S.shake - dt * 2);
        for (let i = 0; i < S.bars.length; i++) S.bars[i] = Math.max(0, S.bars[i] - dt * 2.2);
        for (const w of S.waves) w.t += dt;
        S.waves = S.waves.filter(w => w.t < 0.45);
        for (const t of S.texts) { t.t -= dt; t.y -= 24 * dt; }
        S.texts = S.texts.filter(t => t.t > 0);
        if (S.M.pre) S.M.pre(S, dt);
        let vmax = 0;
        for (const b of S.balls) { const v = Math.hypot(b.vx, b.vy); if (v > vmax) vmax = v; }
        const steps = clamp(Math.ceil(vmax * dt / 3), 1, S.maxSteps || 40), h = dt / steps;
        const P = S.P;
        for (let k = 0; k < steps; k++) {
            for (const R of S.rings) R.rot += R.spin * h;
            if (S.poly) S.poly.rot += S.poly.spin * h;
            if (S.cellSpin) {
                S.cellRot += S.cellSpin * h;
                for (const c of S.cells) if (c.pr != null) { const a = c.pa + S.cellRot; const nx = CX + Math.cos(a) * c.pr, ny = CY + Math.sin(a) * c.pr; c.vx = (nx - c.x) / h; c.vy = (ny - c.y) / h; c.x = nx; c.y = ny; }
            }
            if (S.M.substep) S.M.substep(S, h);
            const L = S.balls;
            for (let i = 0; i < L.length; i++) {
                const b = L[i];
                if (b.dead || b.fixed) continue;
                if (S.attract) { const dx = S.attract.x - b.x, dy = S.attract.y - b.y, d2 = Math.max(dx * dx + dy * dy, 400), f = S.attract.gm / d2 / Math.sqrt(d2); b.vx += dx * f * h; b.vy += dy * f * h; }
                else b.vy += P.g * h * (b.gk == null ? 1 : b.gk);
                b.x += b.vx * h; b.y += b.vy * h;
                if (b.out) continue;
                if (S.kind === 'circle') wallCircle(S, b, S.arena);
                else if (S.kind === 'rings') wallRings(S, b);
                else if (S.kind === 'poly') wallPoly(S, b);
                else if (S.kind === 'box') wallBox(S, b);
                if (S.cells.length) hitCells(S, b);
                if (S.segs.length) hitSegs(S, b);
                if (S.bricks.length) hitBricks(S, b);
            }
            if (P.collide) ballBall(S);
            if (S.M.after) S.M.after(S, h);
        }
        if (BL.look.trails && S.trails !== false && S.balls.length <= 12) for (const b of S.balls) { if (b.dead) continue; b.tr.push(b.x, b.y); if (b.tr.length > (S.trailLen || 36)) b.tr.splice(0, 2); }
        if (S.balls.length > 60) S.balls = S.balls.filter(b => !b.dead);
        if (S.M.post) S.M.post(S, dt);
        if (S.camTarget != null) S.cam += (S.camTarget - S.cam) * Math.min(1, dt * 4);
        S.fx.update(dt);
        if (!S.done && S.limit && S.t > S.limit) S.finish(S.limitMsg ? S.limitMsg(S) : 'Time!');
    };

    /* =====================================================================
       Drawing
       ===================================================================== */
    const starField = Array.from({ length: 70 }, (_, i) => ({ x: (i * 97.3) % W, y: (i * 61.7) % H, s: 0.5 + (i % 5) * 0.35 }));
    BL.drawBg = (S, g) => {
        const bg = BL.look.bg;
        if (bg === 'black') { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
        else if (bg === 'paper') { g.fillStyle = '#f5f0e6'; g.fillRect(0, 0, W, H); }
        else {
            const grd = g.createLinearGradient(0, 0, 0, H);
            if (bg === 'sunset') { grd.addColorStop(0, '#2e1065'); grd.addColorStop(0.6, '#831843'); grd.addColorStop(1, '#f2893d'); }
            else { grd.addColorStop(0, Arcade.ui.bg2); grd.addColorStop(1, Arcade.ui.bg2); }
            g.fillStyle = grd; g.fillRect(0, 0, W, H);
            if (bg === 'stars' || bg === 'sunset') { for (const s of starField) { g.globalAlpha = 0.3 + 0.3 * Math.sin(S.t * 2 + s.x); g.fillStyle = '#fff'; g.fillRect(s.x, (s.y + S.t * s.s * 6) % H, s.s, s.s); } g.globalAlpha = 1; }
            if (bg === 'grid') { g.strokeStyle = 'rgba(236,72,153,0.16)'; g.lineWidth = 1; const off = (S.t * 20) % 32; for (let x = 0; x <= W; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = -32 + off; y <= H; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
        }
        if (S.flash > 0) { g.globalAlpha = S.flash * 0.14; g.fillStyle = S.flashC; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    };
    const light = () => BL.look.bg === 'paper';
    BL.accent = (S) => (light() ? Arcade.ui.surface : Arcade.ui.text);
    BL.drawSim = (S, g) => {
        g.save();
        if (S.shake > 0 && BL.look.shake) g.translate((Math.random() - 0.5) * 10 * S.shake, (Math.random() - 0.5) * 10 * S.shake);
        BL.drawBg(S, g);
        if (S.paint) g.drawImage(S.paint, 0, 0, W, H);
        g.save();
        g.translate(0, -S.cam);
        if (S.M.drawBack) S.M.drawBack(S, g);
        g.lineCap = 'round'; g.lineJoin = 'round';
        const glow = BL.look.glow;
        const acc = BL.accent(S);
        if (S.kind === 'circle' && !S.hideWall) {
            g.strokeStyle = acc; g.lineWidth = 3; if (glow) { }
            g.beginPath(); g.arc(CX, CY, S.arena + 1.5, 0, TAU); g.stroke(); 
        } else if (S.kind === 'rings') {
            g.lineWidth = 3.2;
            for (const R of S.rings) { if (!R.alive) continue; g.strokeStyle = R.col || `hsl(${R.hue},90%,62%)`; g.beginPath(); g.arc(CX, CY, R.r + 1.6, R.rot + R.gap, R.rot + TAU); g.stroke(); }
        } else if (S.kind === 'poly') {
            const P = S.poly, Rv = P.a / Math.cos(Math.PI / P.n);
            const V = (i) => [CX + Math.cos(P.rot + i * TAU / P.n) * (Rv + 2), CY + Math.sin(P.rot + i * TAU / P.n) * (Rv + 2)];
            g.strokeStyle = acc; g.lineWidth = 3.5; if (glow) { }
            g.beginPath();
            for (let i = 0; i < P.n; i++) {
                const [x0, y0] = V(i), [x1, y1] = V(i + 1);
                if (i === P.gapEdge) { const f = (1 - P.gapFrac) / 2; g.moveTo(x0, y0); g.lineTo(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f); g.moveTo(x1 - (x1 - x0) * f, y1 - (y1 - y0) * f); g.lineTo(x1, y1); }
                else { g.moveTo(x0, y0); g.lineTo(x1, y1); }
            }
            g.stroke(); 
        } else if (S.kind === 'box' && !S.hideWall) {
            const B = S.box; g.strokeStyle = acc; g.lineWidth = 3; if (glow) { }
            g.beginPath(); g.moveTo(B.x0, B.openBottom ? B.y1 + 40 : B.y1); g.lineTo(B.x0, B.y0); g.lineTo(B.x1, B.y0); g.lineTo(B.x1, B.openBottom ? B.y1 + 40 : B.y1); if (!B.openBottom) g.closePath(); g.stroke(); 
        }
        // segments
        if (S.segs.length) {
            g.lineWidth = 4;
            for (const s of S.segs) {
                if (s.off || s.hidden) continue;
                if (s.ymax < S.cam - 20 || s.ymin > S.cam + H + 20) continue;
                g.strokeStyle = s.col || acc;
                g.beginPath(); g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2); g.stroke();
            }
        }
        // cells
        for (const c of S.cells) {
            if (!c.alive || c.hidden) continue;
            if (c.y < S.cam - 30 || c.y > S.cam + H + 30) continue;
            if (c.draw) { c.draw(g, c, S); continue; }
            g.fillStyle = c.c || '#bae6fd';
            if (c.glass) { g.globalAlpha = 0.35 + 0.5 * (c.hp / c.max); }
            g.beginPath(); g.arc(c.x, c.y, c.r, 0, TAU); g.fill();
            g.globalAlpha = 1;
            if (c.hitT > 0) { c.hitT -= 1 / 60; g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(c.x, c.y, c.r, 0, TAU); g.fill(); }
            if (c.glass && c.hp < c.max) { g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(c.x - c.r * 0.6, c.y - c.r * 0.2); g.lineTo(c.x + c.r * 0.1, c.y + c.r * 0.1); g.lineTo(c.x + c.r * 0.5, c.y - c.r * 0.5); g.stroke(); }
        }
        // bricks
        for (const k of S.bricks) {
            if (!k.alive) continue;
            BL.drawBrick(g, k, S);
        }
        if (S.M.drawMid) S.M.drawMid(S, g);
        // trails
        if (BL.look.trails) for (const b of S.balls) {
            if (b.dead || !b.tr || b.tr.length < 4) continue;
            g.strokeStyle = S.ballCol(b);
            for (let i = 2; i < b.tr.length; i += 2) {
                g.globalAlpha = (i / b.tr.length) * 0.45; g.lineWidth = b.r * 2 * (i / b.tr.length) * 0.8;
                g.beginPath(); g.moveTo(b.tr[i - 2], b.tr[i - 1]); g.lineTo(b.tr[i], b.tr[i + 1]); g.stroke();
            }
            g.globalAlpha = 1;
        }
        const gl = glow && S.balls.length < 30;
        for (const b of S.balls) {
            if (b.dead || b.hidden) continue;
            if (b.y < S.cam - 40 || b.y > S.cam + H + 40) continue;
            if (S.M.drawBall) { S.M.drawBall(S, g, b); continue; }
            const col = S.ballCol(b);
            g.fillStyle = col;
            if (gl) { }
            g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill();
            if (b.r > 9) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.3, 0, TAU); g.fill(); }
            if (b.label) { g.fillStyle = 'rgba(0,0,0,0.65)'; g.font = `800 ${Math.max(9, Math.min(22, b.r * 0.8))}px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(b.label, b.x, b.y + 1); }
        }
        for (const w of S.waves) { const k = w.t / 0.45; g.strokeStyle = w.c; g.globalAlpha = 1 - k; g.lineWidth = 2; g.beginPath(); g.arc(w.x, w.y, w.r + k * 26, 0, TAU); g.stroke(); }
        g.globalAlpha = 1;
        S.fx.draw(g);
        if (S.M.drawFront) S.M.drawFront(S, g);
        g.textAlign = 'center'; g.textBaseline = 'middle';
        for (const t of S.texts) { g.globalAlpha = Math.min(1, t.t * 2); g.font = (t.big ? '900 22px' : '800 13px') + ' Fredoka, sans-serif'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.strokeText(t.s, t.x, t.y); g.fillStyle = t.c; g.fillText(t.s, t.x, t.y); }
        g.globalAlpha = 1;
        g.restore();
        if (S.M.drawHud) S.M.drawHud(S, g);
        BL.drawHud(S, g);
        g.restore();
    };
    BL.drawBrick = (g, k, S) => {
        const r = Math.min(4, k.w * 0.15);
        g.fillStyle = k.col || k.c;
        g.beginPath(); if (g.roundRect) g.roundRect(k.x + 0.5, k.y + 0.5, k.w - 1, k.h - 1, r); else g.rect(k.x, k.y, k.w, k.h); g.fill();
        if (k.w > 14) { g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(k.x + 2, k.y + 2, k.w - 4, Math.max(1, k.h * 0.18)); }
        if (k.hitT > 0) { k.hitT -= 1 / 60; g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(k.x, k.y, k.w, k.h); }
        if (k.bomb) { g.fillStyle = '#fde68a'; g.font = `900 ${Math.min(k.w, k.h) * 0.8}px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✸', k.x + k.w / 2, k.y + k.h / 2 + 1); }
        else if (k.showHp && k.hp !== Infinity) { g.fillStyle = k.ink || 'rgba(0,0,0,0.7)'; g.font = `800 ${Math.min(16, k.h * 0.55)}px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(k.hp, k.x + k.w / 2, k.y + k.h / 2 + 1); }
    };
    function wrap(g, text, x, y, maxW, lh) {
        const words = text.split(' '); let line = '', yy = y;
        for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t; }
        g.fillText(line, x, yy);
    }
    BL.codeOf = (sp) => sp.type + '-' + (sp.seed >>> 0).toString(36) + (sp.o && Object.keys(sp.o).length ? '~' + btoa(JSON.stringify(sp.o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_') : '');
    BL.parseCode = (str) => {
        const m = /^([a-z0-9]+)-([0-9a-z]+)(?:~([A-Za-z0-9_-]+))?$/i.exec((str || '').trim());
        if (!m || !BL.MODES[m[1]]) return null;
        const sp = { type: m[1], seed: parseInt(m[2], 36) };
        if (m[3]) try { sp.o = JSON.parse(atob(m[3].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { }
        return sp;
    };
    BL.drawHud = (S, g) => {
        const L = BL.look;
        const ink = light() ? Arcade.ui.bg : '#fff';
        if (L.viz && !S.M.noViz) {
            const n = S.bars.length, bw = W / n;
            for (let i = 0; i < n; i++) { const v = S.bars[i]; if (v <= 0.01) continue; g.fillStyle = BL.pcol(i, S.t); g.globalAlpha = 0.55; g.fillRect(i * bw + 1, H - 6 - v * 46, bw - 2, v * 46); }
            g.globalAlpha = 1;
        }
        if (!L.hud) return;
        g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.fillStyle = ink; g.font = '800 21px Fredoka, sans-serif'; 
        wrap(g, S.title, W / 2, 62, 300, 25);
        const sub = S.M.sub ? S.M.sub(S) : '';
        g.font = '700 16px Fredoka, sans-serif'; g.fillStyle = light() ? '#b45309' : '#fde68a';
        if (sub) g.fillText(sub, W / 2, S.subY || S.M.subY || 570);
        if (!S.M.noSong) { g.font = '600 11px Fredoka, sans-serif'; g.fillStyle = light() ? Arcade.ui.dim : 'rgba(255,255,255,0.7)'; g.fillText('🎵 ' + S.songName, W / 2, (S.subY || S.M.subY || 570) + 20); }
        if (S.done) {
            g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 136, W, 58);
            g.fillStyle = '#fff'; g.font = '800 19px Fredoka, sans-serif'; wrap(g, S.doneMsg, W / 2, 171, 330, 22);
            if (S.autoNext) { g.font = '600 12px Fredoka, sans-serif'; g.fillStyle = Arcade.ui.muted; g.fillText('Next in ' + Math.max(0, Math.ceil(S.autoNext - S.doneT)) + '…', W / 2, 212); }
        }
        g.font = '600 11px ui-monospace, monospace'; g.fillStyle = light() ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)'; g.textAlign = 'left';
        g.fillText('@bouncelab · ' + BL.codeOf(S.spec).slice(0, 26), 12, 16);
    };
    BL.wrapText = wrap;
})();
