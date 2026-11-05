/* =====================================================================
   Physics Shorts: every simulation type in the endless feed.
   Each mode: name (title), label (menu), icon, P() default params,
   init(S), optional hooks (hit, cell, seg, after, pre, post, draw*…)
   ===================================================================== */
(() => {
    'use strict';
    const { TAU, CX, CY, W, H, clamp } = BL;
    const M = BL.MODES;
    const team = (i) => BL.TEAM[i % BL.TEAM.length];
    const spreadBalls = (S, n, R, sp, r, extra) => { for (let i = 0; i < n; i++) S.addBall(CX + R(-30, 30), CY - 40 + R(-20, 20), R(0, TAU), sp, r, i, extra); };
    const distSeg = (px, py, x1, y1, x2, y2) => { const ex = x2 - x1, ey = y2 - y1, L2 = ex * ex + ey * ey || 1; let t = ((px - x1) * ex + (py - y1) * ey) / L2; t = clamp(t, 0, 1); return Math.hypot(px - x1 - ex * t, py - y1 - ey * t); };
    BL.distSeg = distSeg;
    const keepSpeed = (b, lo, hi) => { const s = Math.hypot(b.vx, b.vy) || 1; if (s < lo) { b.vx *= lo / s; b.vy *= lo / s; } else if (s > hi) { b.vx *= hi / s; b.vy *= hi / s; } };
    BL.keepSpeed = keepSpeed;

    /* ---------- 1. Grow on bounce ---------- */
    M.grow = {
        label: 'Grow on bounce', icon: '🎈', name: 'Every bounce, it grows',
        P: (R) => ({ g: R(500, 800), grow: R(1.1, 2.2), r: 7, speed: R(200, 320) }),
        init(S, R) { spreadBalls(S, S.P.genesis, R, S.P.speed, S.P.r); S.limit = 90; S.limitMsg = () => 'Grew to ' + Math.round(Math.max(...S.balls.map(b => b.r))) + ' px'; },
        hit(S, b) { b.label = S.bounces; if (b.r >= Math.min(S.P.rmax, S.arena * 0.88) - 0.01) S.finish(`Filled the circle in ${S.bounces} bounces!`); },
        sub: (S) => 'Bounces: ' + S.bounces,
    };
    /* ---------- 2. Escape the rings ---------- */
    M.escape = {
        label: 'Escape the rings', icon: '⭕', name: 'Can it escape?',
        P: (R, RI, rng) => ({ g: rng() < 0.3 ? 0 : R(300, 600), r: 5, speed: R(220, 300), genesis: rng() < 0.6 ? 1 : 2 }),
        init(S, R, RI) {
            S.kind = 'rings';
            const k = RI(8, 21), outer = Math.min(166, S.arena + 16);
            for (let i = 0; i < k; i++) S.rings.push({ r: 36 + i * ((outer - 36) / (k - 1)), gap: R(0.55, 0.95), rot: R(0, TAU), spin: (R(0, 1) < 0.5 ? -1 : 1) * R(0.5, 1.8), alive: true, hue: (i * 360 / k + R(0, 40)) % 360 });
            S.total = k; S.title = `Can it escape all ${k} rings?`;
            for (let i = 0; i < S.P.genesis; i++) S.addBall(CX + R(-8, 8), CY + R(-8, 8), R(0, TAU), S.P.speed, S.P.r, i * 2 + 1);
            S.limit = 75; S.limitMsg = () => 'Still trapped after 75s!';
        },
        passed(S, b, ring) {
            ring.alive = false;
            const col = `hsl(${ring.hue},90%,62%)`;
            for (let i = 0; i < 26; i++) { const a = Math.random() * TAU; S.fx.emit(CX + Math.cos(a) * ring.r, CY + Math.sin(a) * ring.r, { n: 1, speed: 160, color: col, life: 0.9, size: 4 }); }
            S.flash = 1; S.flashC = col;
            if (S.audible) BL.glass(1 + S.rings.filter(r => !r.alive).length * 0.05);
            if (!S.rings.some(r => r.alive)) S.finish('Escaped all ' + S.total + ' rings!');
        },
        sub: (S) => 'Rings left: ' + S.rings.filter(r => r.alive).length,
    };
    /* ---------- 3. Accumulate ---------- */
    M.accumulate = {
        label: 'Accumulate', icon: '🫧', name: 'Every bounce = a new ball',
        P: (R, RI) => ({ g: 650, spawn: 1, popMax: RI(200, 400), r: 5, speed: 240, spawnGap: R(1.6, 2.4) }),
        init(S, R) { S.arena = Math.max(S.arena, 160); S.trails = false; spreadBalls(S, S.P.genesis, R, S.P.speed, S.P.r); S.limit = 60; S.limitMsg = () => S.balls.length + ' balls!'; },
        post(S) { if (S.balls.length >= S.P.popMax) S.finish(S.balls.length + ' balls!'); },
        sub: (S) => 'Balls: ' + S.balls.length,
    };
    /* ---------- 4. Fill up (accumulate with real collisions) ---------- */
    M.fill = {
        label: 'Fill the arena', icon: '🫙', name: 'Will it fill the circle?',
        P: (R) => ({ g: 700, spawn: 1, popMax: 260, r: R(5, 8), collide: true, rest: 0.88, speed: 250, rand: 0.15, spawnGap: R(1.6, 2.4) }),
        init(S, R) { S.trails = false; spreadBalls(S, S.P.genesis, R, S.P.speed, S.P.r); S.limit = 70; S.limitMsg = () => S.balls.length + ' balls in the pile'; },
        post(S) { const area = S.balls.reduce((a, b) => a + b.r * b.r, 0) / (S.arena * S.arena); S.fillK = area; if (area >= 0.62 || S.balls.length >= S.P.popMax) S.finish(`Full! ${S.balls.length} balls`); },
        sub: (S) => 'Filled: ' + Math.round(Math.min(1, (S.fillK || 0) / 0.62) * 100) + '%',
    };
    /* ---------- 5. Colour race through rings ---------- */
    M.race = {
        label: 'Colour race', icon: '🏁', name: 'Which colour escapes first?',
        P: (R, RI, rng) => ({ g: rng() < 0.4 ? 0 : R(200, 400), r: 6, speed: R(230, 300), genesis: RI(2, 5) }),
        init(S, R, RI) {
            S.kind = 'rings';
            const k = RI(4, 7);
            for (let i = 0; i < k; i++) S.rings.push({ r: 50 + i * ((Math.min(166, S.arena + 10) - 50) / (k - 1)), gap: R(0.45, 0.7), rot: R(0, TAU), spin: (i % 2 ? -1 : 1) * R(0.4, 1.3), alive: true, hue: 210 + i * 18 });
            const m = clamp(S.P.genesis, 2, 8), off = RI(0, 7);
            for (let i = 0; i < m; i++) { const [nm, col] = team(off + i * 3); S.addBall(CX + Math.cos(i * TAU / m) * 14, CY + Math.sin(i * TAU / m) * 14, R(0, TAU), S.P.speed, S.P.r, i, { col, name: nm }); }
            S.limit = 75; S.limitMsg = () => 'Nobody escaped!';
        },
        escaped(S, b) { if (!S.winner) { S.winner = b; Arcade.sfx('win'); S.finish('🏆 ' + b.name + ' wins!'); } },
        sub: (S) => S.t.toFixed(1) + 's',
        drawHud(S, g) { g.font = '700 12px Fredoka, sans-serif'; g.textAlign = 'center'; let x = W / 2 - (S.balls.length - 1) * 28; for (const b of S.balls) { g.fillStyle = b.col; g.fillText(b.name, x, 548); x += 56; } },
    };
    /* ---------- 6. Faster every bounce ---------- */
    M.speed = {
        label: 'Faster every bounce', icon: '⚡', name: 'Faster every bounce',
        P: (R) => ({ accel: 0.045, vmax: 2400, g: R(300, 600), r: 8, speed: 200 }),
        init(S, R, RI) { S.kind = 'poly'; S.poly = { n: RI(5, 8), a: Math.min(140, S.arena - 5), rot: R(0, TAU), spin: (R(0, 1) < 0.5 ? -1 : 1) * R(0.4, 1.1), gapEdge: -1, gapFrac: 0 }; spreadBalls(S, S.P.genesis, R, S.P.speed, S.P.r); S.limit = 60; S.limitMsg = () => 'Reached ' + Math.round(Math.hypot(S.balls[0].vx, S.balls[0].vy)) + ' px/s'; },
        hit(S, b) { if (Math.hypot(b.vx, b.vy) > S.P.vmax * 0.96) S.finish('Top speed after ' + S.bounces + ' bounces!'); },
        sub: (S) => 'Speed: ' + Math.round(Math.hypot(S.balls[0].vx, S.balls[0].vy)) + ' px/s',
    };
    /* ---------- 7. Find the gap ---------- */
    M.gap = {
        label: 'Find the gap', icon: '🔷', name: 'Will it find the gap?',
        P: (R) => ({ g: R(350, 650), r: 9, speed: 250 }),
        init(S, R, RI) { const n = RI(4, 8); S.kind = 'poly'; S.poly = { n, a: Math.min(130, 168 * Math.cos(Math.PI / n)), rot: R(0, TAU), spin: (R(0, 1) < 0.5 ? -1 : 1) * R(0.6, 1.6), gapEdge: RI(0, 3), gapFrac: R(0.32, 0.55) }; spreadBalls(S, S.P.genesis, R, S.P.speed, S.P.r); S.limit = 75; S.limitMsg = () => 'Still trapped after 75s!'; },
        escaped(S) { Arcade.sfx('win'); S.finish('Escaped in ' + S.t.toFixed(1) + 's'); },
        sub: (S) => S.t.toFixed(1) + 's',
    };
    /* ---------- 8. Drawer ---------- */
    M.drawer = {
        label: 'Drawer', icon: '🎨', name: 'Painting with physics',
        P: (R, RI, rng) => ({ g: rng() < 0.5 ? 0 : R(200, 500), genesis: RI(3, 6), r: 4, speed: R(260, 380), rand: 0.02 }),
        init(S, R, RI) {
            const shape = RI(0, 2);
            if (shape === 1) { const n = RI(3, 7); S.kind = 'poly'; S.poly = { n, a: 150 * Math.cos(Math.PI / n), rot: R(0, TAU), spin: R(-0.4, 0.4), gapEdge: -1, gapFrac: 0 }; }
            else if (shape === 2) { S.kind = 'box'; S.box = { x0: 24, x1: 336, y0: 160, y1: 520 }; }
            else S.arena = Math.max(S.arena, 160);
            S.trails = false;
            S.paint = document.createElement('canvas'); S.paint.width = 720; S.paint.height = 1280;
            S.pc = S.paint.getContext('2d'); S.pc.lineCap = 'round';
            const h0 = R(0, 360);
            for (let i = 0; i < S.P.genesis; i++) { const b = S.addBall(CX + R(-50, 50), CY + R(-50, 50), R(0, TAU), S.P.speed, S.P.r, i); b.h = (h0 + i * 360 / S.P.genesis) % 360; b.lx = b.x; b.ly = b.y; }
            S.limit = 22; S.limitMsg = () => 'Masterpiece complete';
        },
        after(S) {
            const pc = S.pc;
            for (const b of S.balls) { pc.strokeStyle = `hsla(${(b.h + S.t * 25) % 360},90%,62%,0.85)`; pc.lineWidth = b.r * 1.4; pc.beginPath(); pc.moveTo(b.lx * 2, b.ly * 2); pc.lineTo(b.x * 2, b.y * 2); pc.stroke(); b.lx = b.x; b.ly = b.y; }
        },
        drawBall(S, g, b) { g.fillStyle = '#fff'; g.beginPath(); g.arc(b.x, b.y, b.r + 1, 0, TAU); g.fill(); },
        sub: (S) => Math.max(0, 22 - S.t).toFixed(0) + 's left',
    };
    /* ---------- 9. Walls close in ---------- */
    M.shrink = {
        label: 'Walls close in', icon: '🫸', name: 'The walls close in every bounce',
        P: (R) => ({ g: R(450, 700), r: 11, speed: 260, arena: 170 }),
        init(S, R) { S.shrinkBy = R(1.6, 3); spreadBalls(S, S.P.genesis, R, S.P.speed, S.P.r); S.limit = 90; S.limitMsg = () => 'Survived 90s!'; },
        hit(S, b, kind) { if (kind !== 'wall') return; const big = Math.max(...S.balls.map(x => x.r)); S.arena = Math.max(big * 1.12, S.arena - S.shrinkBy); if (S.arena < big * 1.6) S.finish('Trapped after ' + S.bounces + ' bounces'); },
        sub: (S) => 'Bounces: ' + S.bounces,
    };
    /* ---------- 10. Rhythmic ---------- */
    M.rhythm = {
        label: 'Rhythmic', icon: '🎼', name: 'Rhythm', noSong: true,
        P: (R) => ({ g: R(400, 700), r: 9, speed: 240, rand: 0.08 }),
        init(S, R) { S.title = '🎵 ' + S.songName; S.marks = []; spreadBalls(S, S.P.genesis, R, S.P.speed, S.P.r, { silent: true }); S.limit = 80; S.limitMsg = () => '♪ Fin'; },
        hit(S, b, kind, obj, x, y) {
            BL.note(S, b, 0, true);
            S.marks.push({ x, y, t: 1, c: BL.pcol(S.noteI, S.t), n: S.noteI });
            if (S.marks.length > 60) S.marks.shift();
            if (S.noteI >= S.song.length * 2) S.finish('♪ Fin, ' + S.songName);
        },
        post(S, dt) { for (const m of S.marks) m.t = Math.max(0.15, m.t - dt * 0.25); },
        drawMid(S, g) { for (const m of S.marks) { g.globalAlpha = m.t; g.fillStyle = m.c; if (BL.look.glow) { } g.beginPath(); g.arc(m.x, m.y, 4 + m.t * 3, 0, TAU); g.fill(); } g.globalAlpha = 1; },
        sub: (S) => `Note ${Math.min(S.noteI, S.song.length * 2)} / ${S.song.length * 2}`,
    };
    /* ---------- 11. Ghost Escape: every bounce leaves a spike ---------- */
    M.ghost = {
        label: 'Ghost escape', icon: '👻', name: 'Every bounce leaves a spike',
        P: (R) => ({ g: R(0, 120), r: 8, speed: R(170, 230), rand: 0.3 }),
        init(S, R) {
            S.kind = 'ghostring';
            S.ghost = { rot: R(0, TAU), spin: (R(0, 1) < 0.5 ? -1 : 1) * R(0.5, 1.1), gap: R(0.45, 0.6), spikes: [], sw: 0.05 };
            spreadBalls(S, S.P.genesis, R, S.P.speed, S.P.r);
            S.title = 'Every bounce leaves a spike. Can it escape?';
            S.limit = 75; S.limitMsg = () => 'Still dodging after 75s!';
        },
        after(S, h) {
            const G = S.ghost; G.rot += G.spin * h;
            for (const b of S.balls) {
                if (b.out || b.dead) continue;
                const dx = b.x - CX, dy = b.y - CY, d = Math.hypot(dx, dy) || 1e-6;
                if (d + b.r <= S.arena) continue;
                const a = BL.normA(Math.atan2(dy, dx) - G.rot), half = Math.asin(Math.min(1, b.r / S.arena));
                for (const sp of G.spikes) {
                    const da = Math.abs(((a - sp + Math.PI) % TAU + TAU) % TAU - Math.PI);
                    if (da < half + G.sw * 0.8) {
                        b.dead = true; S.shake = 1;
                        S.fx.emit(b.x, b.y, { n: 40, speed: 260, color: [S.ballCol(b), '#fff'], life: 0.8, size: 4 });
                        if (S.audible) { BL.noise(0.3, 0.1, 400); }
                        if (!S.balls.some(x => !x.dead && !x.out)) S.finish(`💥 Popped after ${S.bounces} bounces (${G.spikes.length} spikes)`);
                        break;
                    }
                }
                if (b.dead) continue;
                if (a > half && a < G.gap - half) { if (d - b.r > S.arena) { b.out = true; Arcade.sfx('win'); S.finish(`🎉 Escaped after ${S.bounces} bounces!`); } continue; }
                const nx = dx / d, ny = dy / d, hit = BL.reflect(S, b, nx, ny);
                b.x = CX + nx * (S.arena - b.r); b.y = CY + ny * (S.arena - b.r);
                if (hit) {
                    BL.onHit(S, b, CX + nx * S.arena, CY + ny * S.arena, 'wall');
                    if (a > G.gap + 0.2 && a < TAU - 0.2 && !G.spikes.some(s => Math.abs(((a - s + Math.PI) % TAU + TAU) % TAU - Math.PI) < G.sw * 2.2)) G.spikes.push(a);
                }
            }
        },
        drawBack(S, g) {
            const G = S.ghost, R0 = S.arena + 1.5;
            g.strokeStyle = BL.accent(S); g.lineWidth = 3; if (BL.look.glow) { }
            g.beginPath(); g.arc(CX, CY, R0, G.rot + G.gap, G.rot + TAU); g.stroke(); 
            g.fillStyle = '#ee5a72';
            for (const s of G.spikes) {
                const a = s + G.rot, a0 = a - G.sw, a1 = a + G.sw;
                g.beginPath(); g.moveTo(CX + Math.cos(a0) * R0, CY + Math.sin(a0) * R0); g.lineTo(CX + Math.cos(a) * (R0 - 16), CY + Math.sin(a) * (R0 - 16)); g.lineTo(CX + Math.cos(a1) * R0, CY + Math.sin(a1) * R0); g.fill();
            }
        },
        sub: (S) => 'Spikes: ' + S.ghost.spikes.length,
    };
    /* ---------- spike freeze: touch a spike and you're stuck there forever ---------- */
    const FROZEN_MAPS = ['circle', 'square', 'hexagon', 'octagon', 'mines', 'double'];
    const MAP_NAMES = { circle: 'Circle', square: 'Square', hexagon: 'Hexagon', octagon: 'Octagon', mines: 'Spike mines', double: 'Double ring' };
    BL.FROZEN_MAPS = FROZEN_MAPS; BL.MAP_NAMES = MAP_NAMES;
    // a closed outline (a circle is just many sides) with one opening; returns the wall pieces for placing spikes
    function outline(S, sides, R, rot, gapW, gapAt, col) {
        const pts = [];
        for (let i = 0; i < sides; i++) { const a = rot + i * TAU / sides; pts.push([CX + Math.cos(a) * R, CY + Math.sin(a) * R]); }
        const walls = [];
        for (let i = 0; i < sides; i++) {
            const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % sides];
            const L = Math.hypot(x2 - x1, y2 - y1);
            const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, ma = Math.atan2(my - CY, mx - CX);
            if (sides > 12 && Math.abs(((ma - gapAt + Math.PI) % TAU + TAU) % TAU - Math.PI) < gapW / R / 2) continue;
            if (sides <= 12 && i === S.gapEdge) {
                const f = gapW / L / 2, ux = x2 - x1, uy = y2 - y1;
                const a = { x1, y1, x2: x1 + ux * (0.5 - f), y2: y1 + uy * (0.5 - f) }, b = { x1: x1 + ux * (0.5 + f), y1: y1 + uy * (0.5 + f), x2, y2 };
                for (const w of [a, b]) { BL.seg(S, w.x1, w.y1, w.x2, w.y2, { col }); walls.push(w); }
                continue;
            }
            BL.seg(S, x1, y1, x2, y2, { col });
            walls.push({ x1, y1, x2, y2 });
        }
        return walls;
    }
    M.frozen = {
        label: 'Spike freeze', icon: '🧊', name: 'Touch a spike = frozen forever. Can it escape?',
        P: (R) => ({ g: R(220, 400), r: R(13, 16), speed: R(380, 460), rand: 0 }),
        init(S, R, RI) {
            S.kind = 'none'; S.trails = false;
            const map = S.spec.o && FROZEN_MAPS.includes(S.spec.o.map) ? S.spec.o.map : FROZEN_MAPS[RI(0, FROZEN_MAPS.length - 1)];
            S.map = map;
            const gapW = S.P.r * 2 * R(1.7, 2.3) * (map === 'double' ? 1.5 : map === 'circle' || map === 'mines' ? 1 : 1.15), gapAt = R(0, TAU);
            if (map === 'double') S.P.g *= 0.5;
            const sides = map === 'square' ? 4 : map === 'hexagon' ? 6 : map === 'octagon' ? 8 : 72;
            const Rr = map === 'square' ? 150 * Math.SQRT2 * 0.98 : map === 'hexagon' ? 165 : 160;
            S.gapEdge = RI(0, sides - 1);
            const rot = map === 'square' ? Math.PI / 4 : map === 'octagon' ? Math.PI / 8 : 0;
            const walls = outline(S, sides, Rr, rot, gapW, gapAt, BL.accent(S));
            S.outR = Rr + S.P.r + 8;
            S.spikes = []; S.mines = [];
            const addSpikes = (wallList, n, inward) => {
                let tries = 0, made = 0;
                while (made < n && tries++ < 800) {
                    const w = wallList[RI(0, wallList.length - 1)];
                    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (L < 6) continue;
                    const t = L > 22 ? R(11 / L, 1 - 11 / L) : R(0.3, 0.7), bx = w.x1 + (w.x2 - w.x1) * t, by = w.y1 + (w.y2 - w.y1) * t;
                    if (S.spikes.some(s => Math.hypot(s.bx - bx, s.by - by) < 42)) continue;
                    let nx = -(w.y2 - w.y1) / L, ny = (w.x2 - w.x1) / L;
                    const towards = (CX - bx) * nx + (CY - by) * ny > 0;
                    if (towards !== inward) { nx = -nx; ny = -ny; }
                    const tx = (w.x2 - w.x1) / L, ty = (w.y2 - w.y1) / L, hw = 10, len = 20;
                    S.spikes.push({ bx, by, x0: bx - tx * hw, y0: by - ty * hw, x1: bx + tx * hw, y1: by + ty * hw, tipX: bx + nx * len, tipY: by + ny * len });
                    made++;
                }
            };
            addSpikes(walls, map === 'double' ? RI(5, 8) : RI(7, 12), true);
            if (map === 'double') {
                const inner = [], IR = 66, igap = gapAt + Math.PI + R(-0.6, 0.6);
                for (let i = 0; i < 48; i++) {
                    const a1 = i * TAU / 48, a2 = (i + 1) * TAU / 48, ma = (a1 + a2) / 2;
                    if (Math.abs(((ma - igap + Math.PI) % TAU + TAU) % TAU - Math.PI) < gapW / IR / 2) continue;
                    const w = { x1: CX + Math.cos(a1) * IR, y1: CY + Math.sin(a1) * IR, x2: CX + Math.cos(a2) * IR, y2: CY + Math.sin(a2) * IR };
                    BL.seg(S, w.x1, w.y1, w.x2, w.y2, { col: BL.accent(S) }); inner.push(w);
                }
            }
            if (map === 'mines') {
                let tries = 0;
                const n = RI(2, 3);
                while (S.mines.length < n && tries++ < 400) {
                    const a = R(0, TAU), d = R(75, 120), x = CX + Math.cos(a) * d, y = CY + Math.sin(a) * d;
                    if (S.mines.some(m => Math.hypot(m.x - x, m.y - y) < 60) || Math.hypot(x - CX, y - (CY - 30)) < 55) continue;
                    S.mines.push({ x, y, r: 11 });
                    S.cells.push({ x, y, r: 11, hp: Infinity, alive: true, hidden: true });
                }
            }
            S.spawnX = CX + R(-10, 10); S.spawnY = CY + (map === 'double' ? R(-10, 10) : -30 + R(-10, 10));
            S.spawnAng = R(0.35, Math.PI - 0.35);   // every ball launches exactly the same way
            S.ballNo = 0; S.frozenN = 0; S.respawn = 0;
            this.spawn(S);
            S.limit = 110; S.limitMsg = () => `Still trapped after ${S.ballNo} balls!`;
        },
        spawn(S) {
            S.ballNo++;
            const b = S.addBall(S.spawnX, S.spawnY, S.spawnAng, S.P.speed, S.P.r, S.ballNo - 1, { label: S.ballNo, born: S.t });
            S.wave(b.x, b.y, S.ballCol(b), 14);
        },
        after(S) {
            for (const b of S.balls) {
                if (b.out || b.dead || b.fixed) continue;
                let hit = false;
                for (const sp of S.spikes) {
                    if (Math.abs(b.x - sp.bx) > 40 || Math.abs(b.y - sp.by) > 40) continue;
                    if (distSeg(b.x, b.y, sp.x0, sp.y0, sp.tipX, sp.tipY) < b.r || distSeg(b.x, b.y, sp.x1, sp.y1, sp.tipX, sp.tipY) < b.r) { hit = true; break; }
                }
                if (!hit) for (const m of S.mines) if (Math.hypot(b.x - m.x, b.y - m.y) < m.r + 4 + b.r) { hit = true; break; }
                if (hit) {
                    b.fixed = true; b.vx = b.vy = 0; b.tr = [];
                    S.cells.push({ x: b.x, y: b.y, r: b.r, hp: Infinity, alive: true, hidden: true, rest: 1 });
                    S.frozenN++; S.shake = 0.4;
                    S.fx.emit(b.x, b.y, { n: 18, speed: 120, color: ['#bae6fd', '#e0f2fe', S.ballCol(b)], life: 0.5, size: 3 });
                    if (S.audible) { BL.synth(1700, 0.2, 0.04, 'sine'); BL.noise(0.1, 0.04, 2500); }
                    S.text(b.x, b.y - b.r - 8, '🧊', '#bae6fd');
                    S.respawn = 0.35;
                    continue;
                }
                if (Math.hypot(b.x - CX, b.y - CY) > S.outR) { b.out = true; Arcade.sfx('win'); S.finish(`🎉 Ball #${S.ballNo} escaped! (${S.frozenN} frozen)`); }
            }
        },
        // safety: a ball stuck in a perfect loop for 20s gets a tiny nudge on each bounce
        hit(S, b) { if (S.t - (b.born || 0) > 20) { const a = (S.rng() - 0.5) * 0.08, c = Math.cos(a), sn = Math.sin(a), vx = b.vx * c - b.vy * sn; b.vy = b.vx * sn + b.vy * c; b.vx = vx; } },
        pre(S, dt) {
            if (S.done || S.respawn <= 0) return;
            S.respawn -= dt;
            if (S.respawn <= 0 && !S.balls.some(b => !b.fixed && !b.out)) this.spawn(S);
        },
        drawMid(S, g) {
            g.fillStyle = Arcade.ui.text;
            for (const sp of S.spikes) { g.beginPath(); g.moveTo(sp.x0, sp.y0); g.lineTo(sp.tipX, sp.tipY); g.lineTo(sp.x1, sp.y1); g.closePath(); g.fill(); }
            for (const m of S.mines) {
                g.fillStyle = Arcade.ui.text;
                g.beginPath();
                for (let i = 0; i < 16; i++) { const a = i * TAU / 16, rr = i % 2 ? m.r : m.r + 8; g.lineTo(m.x + Math.cos(a) * rr, m.y + Math.sin(a) * rr); }
                g.closePath(); g.fill();
                g.fillStyle = Arcade.ui.surface2; g.beginPath(); g.arc(m.x, m.y, m.r * 0.7, 0, TAU); g.fill();
            }
        },
        drawBall(S, g, b) {
            const col = S.ballCol(b);
            if (b.fixed) {
                g.fillStyle = col; g.globalAlpha = 0.55; g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill(); g.globalAlpha = 1;
                g.strokeStyle = '#bae6fd'; g.lineWidth = 2.5; g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.stroke();
                g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(b.x - b.r * 0.5, b.y - b.r * 0.2); g.lineTo(b.x, b.y + b.r * 0.1); g.lineTo(b.x + b.r * 0.4, b.y - b.r * 0.4); g.stroke();
            } else {
                g.fillStyle = col; if (BL.look.glow) { }
                g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill(); 
                g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.3, 0, TAU); g.fill();
            }
            g.fillStyle = 'rgba(0,0,0,0.7)'; g.font = `800 ${Math.round(b.r * 0.85)}px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(b.label, b.x, b.y + 1);
        },
        sub: (S) => `${MAP_NAMES[S.map]} · Ball #${S.ballNo} · ${S.frozenN} frozen`,
    };

    /* ---------- spirals: one long corridor that winds into the centre ---------- */
    function buildSpiral(S, r0, pitch, rmax) {
        const b = pitch / TAU, Th = (rmax - r0) / b;
        S.sp = { r0, b, Th, pitch };
        S.spPts = [];
        let prev = null;
        for (let th = 0; th <= Th + 1e-6; th += 0.06) {
            const r = r0 + b * th, p = [CX + Math.cos(th) * r, CY + Math.sin(th) * r];
            S.spPts.push(p);
            if (prev) BL.seg(S, prev[0], prev[1], p[0], p[1], { hidden: true });
            prev = p;
        }
        // start point: in the outermost corridor, near the open end
        const th = Th - 0.35, rs = r0 + b * th - pitch / 2;
        S.spawnX = CX + Math.cos(th) * rs; S.spawnY = CY + Math.sin(th) * rs; S.spawnA = th - Math.PI / 2;
    }
    const spAt = (S, th, k) => { const r = S.sp.r0 + S.sp.b * th - S.sp.pitch * k; return [CX + Math.cos(th) * r, CY + Math.sin(th) * r]; };
    function pullIn(S, h) {
        for (const b of S.balls) {
            if (b.dead || b.fixed) continue;
            const dx = CX - b.x, dy = CY - b.y, d = Math.hypot(dx, dy) || 1;
            b.vx += dx / d * S.pull * h; b.vy += dy / d * S.pull * h;
            // push along the corridor, around the spiral towards the centre
            if (S.drive) { b.vx += -dy / d * S.drive * h; b.vy += dx / d * S.drive * h; }
        }
    }
    function drawSpiral(S, g, col) {
        g.strokeStyle = col; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
        if (BL.look.glow) { }
        g.beginPath(); S.spPts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
        const gr = g.createRadialGradient(CX, CY, 2, CX, CY, 20);
        gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, '#f6c445'); gr.addColorStop(1, 'rgba(250,204,21,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(CX, CY, 20 + Math.sin(S.t * 5) * 2, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.arc(S.spawnX, S.spawnY, 12, 0, TAU); g.stroke(); g.setLineDash([]);
    }
    M.spiralmult = {
        label: 'Spiral multiplier', icon: '🌀', name: 'Multiply on the way to the centre',
        P: (R, RI) => ({ g: 0, r: 6, rest: 0.55, rand: 0.1, speed: 120, popMax: RI(250, 600) }),
        init(S, R, RI) {
            S.kind = 'none'; S.trails = false;
            buildSpiral(S, 22, 40, 172);
            BL.buildSegGrid(S);
            S.pull = 650;
            const pads = RI(5, 8), mults = [2, 2, 2, 3, 3, 5];
            S.pads = [];
            for (let i = 0; i < pads; i++) {
                const th = S.sp.Th - 1.4 - (i + R(0.2, 0.8)) * (S.sp.Th - 8) / pads;
                const [x, y] = spAt(S, th, 0.72);
                S.pads.push({ x, y, r: 11, m: mults[RI(0, mults.length - 1)], i });
            }
            S.home = 0; S.total = 0; S.queue = 0; S.queueT = 0;
            this.spawn(S, 1);
            S.title = 'Every pad sends new balls from the start. How many reach the centre?';
            S.limit = 45; S.limitMsg = () => `${S.home} balls reached the centre!`;
        },
        spawn(S, n) { S.queue += n; },
        pre(S, dt) {
            S.queueT -= dt;
            while (S.queue > 0 && S.queueT <= 0 && S.total < S.P.popMax) {
                S.queue--; S.total++; S.queueT += 0.05;
                S.addBall(S.spawnX + S.R(-4, 4), S.spawnY + S.R(-4, 4), S.spawnA + S.R(-0.3, 0.3), S.P.speed, S.P.r, S.total, { pads: [] });
            }
            if (S.total >= S.P.popMax) S.queue = 0;
        },
        substep(S, h) { pullIn(S, h); },
        after(S) {
            for (const b of S.balls) {
                if (b.dead) continue;
                for (const p of S.pads) if (!b.pads.includes(p.i) && Math.hypot(b.x - p.x, b.y - p.y) < p.r + b.r) {
                    b.pads.push(p.i); p.flash = 0.3; this.spawn(S, p.m - 1);
                    if (S.audible) BL.note(S, b, 12, true);
                    S.text(p.x, p.y - 16, '+' + (p.m - 1), '#6fd29a');
                }
                if (Math.hypot(b.x - CX, b.y - CY) < 14) { b.dead = true; S.home++; BL.note(S, b, 0, S.balls.length < 20); S.fx.emit(CX, CY, { n: 4, speed: 80, color: [S.ballCol(b), '#fde68a'], life: 0.4, size: 3 }); }
            }
        },
        post(S, dt) {
            S.balls = S.balls.filter(b => !b.dead);
            for (const p of S.pads) if (p.flash) p.flash = Math.max(0, p.flash - dt);
            if (S.total >= S.P.popMax && !S.queue && !S.balls.length) S.finish(`All ${S.home} balls made it home!`);
            if (!S.queue && !S.balls.length && S.total > 0) S.finish(`${S.home} balls reached the centre!`);
        },
        drawBack(S, g) { drawSpiral(S, g, BL.accent(S)); },
        drawMid(S, g) {
            for (const p of S.pads) {
                g.fillStyle = p.m >= 5 ? '#f6c445' : p.m === 3 ? '#9a6de0' : '#4fc07f';
                g.globalAlpha = Math.min(1, 0.85 + (p.flash || 0)); g.beginPath(); g.arc(p.x, p.y, p.r + (p.flash || 0) * 12, 0, TAU); g.fill(); g.globalAlpha = 1;
                g.fillStyle = '#fff'; g.font = '900 10px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('×' + p.m, p.x, p.y + 1);
            }
        },
        sub: (S) => `🏠 ${S.home} home · ${S.balls.length} rolling`,
    };
    M.spiralglass = {
        label: 'Spiral glass race', icon: '⏳', name: 'Reach the centre before time runs out',
        P: () => ({ g: 0, r: 7, rest: 0.9, rand: 0.15, speed: 170, collide: true }),
        init(S, R, RI) {
            S.kind = 'none'; S.trails = false;
            buildSpiral(S, 22, 42, 172);
            S.pull = 160; S.drive = 520;
            S.timeLimit = Math.round(R(55, 80));
            const n = RI(4, 7), base = R(45, 70);
            S.panes = [];
            for (let i = 0; i < n; i++) {
                const th = S.sp.Th - 2.2 - (i + 0.5) * (S.sp.Th - TAU - 2.6) / n;
                const [x1, y1] = spAt(S, th, 0), [x2, y2] = spAt(S, th, 1);
                const hp = Math.round(base + i * R(6, 15));
                S.panes.push(BL.seg(S, x1, y1, x2, y2, { pane: true, hp, max: hp, hidden: true, rest: 1 }));
            }
            BL.buildSegGrid(S);
            S.ballNo = 0; S.spawnT = 0; S.every = R(1.6, 2.4);
            S.title = `${n} glass walls. ${S.timeLimit} seconds. Every new ball is faster.`;
            S.limit = S.timeLimit; S.limitMsg = () => `⏰ Time's up! ${S.panes.filter(p => !p.off).length} glass walls held.`;
        },
        pre(S, dt) {
            S.spawnT -= dt;
            if (S.spawnT <= 0 && !S.done && S.balls.length < 40) {
                S.spawnT = S.every; S.ballNo++;
                const sp = Math.min(1000, S.P.speed * Math.pow(1.2, S.ballNo - 1));
                S.addBall(S.spawnX, S.spawnY, S.spawnA, sp, S.P.r, S.ballNo - 1, { sp, label: S.ballNo });
                S.text(S.spawnX, S.spawnY - 18, 'Ball ' + S.ballNo + ' · speed ' + Math.round(sp), '#fde68a');
            }
        },
        substep(S, h) { pullIn(S, h); },
        seg(S, s, b) {
            if (!s.pane || s.off) return;
            s.hp -= 1 + Math.floor((b.sp || 0) / 260); s.hitT = 0.12;
            if (S.audible && Math.random() < 0.5) BL.synth(1500 + (s.max - s.hp) * 25, 0.06, 0.03, 'sine');
            if (s.hp <= 0) {
                s.off = true; S.shake = 0.6; S.flash = 0.5; S.flashC = '#bae6fd';
                for (let k = 0; k <= 8; k++) S.fx.emit(s.x1 + (s.x2 - s.x1) * k / 8, s.y1 + (s.y2 - s.y1) * k / 8, { n: 3, speed: 160, color: ['#bae6fd', '#fff'], life: 0.7, size: 4 });
                if (S.audible) BL.glass(0.9);
                S.text((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, 'CRASH!', '#bae6fd', true);
            }
        },
        after(S) {
            for (const b of S.balls) if (!b.dead && Math.hypot(b.x - CX, b.y - CY) < 14) {
                b.dead = true; S.flash = 1; S.flashC = '#f6c445';
                S.finish(`🎉 Ball #${b.label} reached the centre with ${Math.max(0, S.timeLimit - S.t).toFixed(1)}s left!`);
            }
        },
        post(S) { S.balls = S.balls.filter(b => !b.dead); for (const b of S.balls) BL.keepSpeed(b, b.sp * 0.5, b.sp * 1.3); },
        drawBack(S, g) { drawSpiral(S, g, BL.accent(S)); },
        drawMid(S, g) {
            for (const s of S.panes) {
                if (s.off) continue;
                const k = s.hp / s.max;
                g.strokeStyle = `rgba(186,230,253,${0.35 + 0.6 * k})`; g.lineWidth = 6;
                g.beginPath(); g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2); g.stroke();
                if (s.hitT > 0) { s.hitT -= 1 / 60; g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); }
                g.fillStyle = '#e0f2fe'; g.font = '800 9px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.hp, (s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2);
            }
        },
        drawBall(S, g, b) {
            const col = S.ballCol(b); g.fillStyle = col; if (BL.look.glow) { }
            g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill(); 
            g.fillStyle = 'rgba(0,0,0,0.7)'; g.font = '800 8px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(b.label, b.x, b.y + 0.5);
        },
        drawHud(S, g) {
            const left = Math.max(0, S.timeLimit - S.t);
            g.font = '900 34px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillStyle = left < 10 ? '#f27a73' : '#fff'; g.fillText(left.toFixed(1), W / 2, 128);
        },
        sub: (S) => `Glass left ${S.panes.filter(p => !p.off).length}/${S.panes.length} · ${S.balls.length} balls`,
    };

    /* ---------- 12. Breaker: glass spiral ---------- */
    M.breaker = {
        label: 'Glass spiral breaker', icon: '🌀', name: 'Smash the glass spiral',
        P: (R, RI) => ({ g: R(250, 550), r: 6, speed: 300, genesis: RI(2, 3), arena: 160 }),
        init(S, R, RI) {
            const arms = RI(1, 2), spacing = arms === 1 ? 58 : 110, b = spacing / TAU, maxR = S.arena - 12;
            for (let arm = 0; arm < arms; arm++) {
                let th = 0.9;
                while (true) {
                    const r = 16 + b * th;
                    if (r > maxR) break;
                    S.cells.push({ pr: r, pa: th + arm * Math.PI, x: 0, y: 0, r: 5.5, hp: 1, max: 1, alive: true, glass: true, c: BL.pcol(S.cells.length >> 3, 0) });
                    th += 12.5 / Math.sqrt(r * r + b * b);
                }
            }
            S.cellSpin = (R(0, 1) < 0.5 ? -1 : 1) * R(0.25, 0.6);
            for (const c of S.cells) { c.x = CX + Math.cos(c.pa) * c.pr; c.y = CY + Math.sin(c.pa) * c.pr; }
            S.total = S.cells.length;
            for (let i = 0; i < S.P.genesis; i++) S.addBall(CX + R(-4, 4), CY + R(-4, 4), R(0, TAU), S.P.speed, S.P.r, i);
            S.limit = 90; S.limitMsg = () => S.cells.filter(c => c.alive).length + ' panes survived';
        },
        broke(S) { if (!S.cells.some(c => c.alive)) S.finish('Spiral shattered! ' + S.total + ' panes'); },
        sub: (S) => 'Glass left: ' + S.cells.filter(c => c.alive).length + ' / ' + S.total,
    };
    /* ---------- 13. Target hit ---------- */
    M.targets = {
        label: 'Target hit', icon: '🎯', name: 'Light up every target',
        P: (R) => ({ g: R(0, 250), r: 7, speed: 330, rand: 0.25, arena: 160 }),
        init(S, R, RI) {
            const n = RI(14, 24);
            let tries = 0;
            while (S.cells.length < n && tries++ < 2000) {
                const a = R(0, TAU), d = Math.sqrt(R(0, 1)) * (S.arena - 18), x = CX + Math.cos(a) * d, y = CY + Math.sin(a) * d;
                if (S.cells.some(c => Math.hypot(c.x - x, c.y - y) < 26)) continue;
                S.cells.push({ x, y, r: 9, ghost: true, alive: true, lit: false, i: S.cells.length, draw: (g, c, S2) => { const col = BL.pcol(c.i, S2.t); if (c.lit) { g.fillStyle = col; if (BL.look.glow) { } g.beginPath(); g.arc(c.x, c.y, c.r, 0, TAU); g.fill(); } else { g.strokeStyle = col; g.globalAlpha = 0.6; g.lineWidth = 2; g.beginPath(); g.arc(c.x, c.y, c.r, 0, TAU); g.stroke(); g.globalAlpha = 1; } } });
            }
            S.total = S.cells.length;
            spreadBalls(S, S.P.genesis, R, S.P.speed, S.P.r);
            S.limit = 80; S.limitMsg = () => S.cells.filter(c => c.lit).length + ' / ' + S.total + ' lit';
        },
        after(S) {
            for (const b of S.balls) for (const c of S.cells) if (!c.lit && Math.hypot(b.x - c.x, b.y - c.y) < b.r + c.r) {
                c.lit = true; BL.note(S, b, 12, true); S.wave(c.x, c.y, BL.pcol(c.i, S.t), 9);
                if (S.cells.every(x => x.lit)) S.finish(`All ${S.total} targets in ${S.t.toFixed(1)}s!`);
            }
        },
        sub: (S) => 'Targets: ' + S.cells.filter(c => c.lit).length + ' / ' + S.total,
    };
    /* ---------- 14. Glass tower ---------- */
    M.glass = {
        label: 'Glass tower', icon: '🏢', name: 'Each bounce breaks twice as many',
        P: (R) => ({ g: 1100, r: 10 }),
        init(S, R, RI) {
            S.kind = 'none';
            const n = RI(30, 72), top = 170, bottom = 600, sp = (bottom - top) / n;
            S.plates = Array.from({ length: n }, (_, i) => ({ y: top + i * sp, h: Math.max(2.5, sp * 0.5), alive: true }));
            S.total = n; S.breakN = 1;
            S.addBall(CX, 110, Math.PI / 2, 0, S.P.r, 0, { fixed: true });
            S.title = `${n} glass plates. Each bounce breaks twice as many.`;
        },
        pre(S, dt) {
            const b = S.balls[0], P = S.P;
            b.vy += P.g * dt; b.y += b.vy * dt; b.x = CX + Math.sin(S.t * 2.5) * 3;
            const alive = S.plates.filter(p => p.alive);
            if (alive.length && b.y + b.r >= alive[0].y && b.vy > 0) {
                const n = Math.min(S.breakN, alive.length);
                for (let i = 0; i < n; i++) {
                    const p = alive[i]; p.alive = false;
                    for (let k = 0; k < 4; k++) S.fx.emit(CX - 70 + Math.random() * 140, p.y, { n: 1, speed: 200, color: ['#bae6fd', '#e0f2fe', '#fff'], life: 0.8, size: 4, gravity: 600, angle: -Math.PI / 2, spread: 2.6 });
                }
                S.bounces++; S.shake = Math.min(1, 0.15 + n * 0.02);
                BL.note(S, b, 0, true); if (S.audible) BL.glass(1 + Math.log2(S.breakN) * 0.1);
                S.text(CX + 95, alive[0].y, '×' + n, '#fde68a', true);
                S.breakN *= 2;
                b.y = alive[0].y - b.r;
                b.vy = -Math.sqrt(2 * P.g * Math.max(50, b.y - 115));
            }
            if (!S.plates.some(p => p.alive) && b.y + b.r >= 616) { b.y = 616 - b.r; if (b.vy > 0) b.vy = -b.vy * 0.45; S.finish(`Shattered ${S.total} plates in ${S.bounces} bounces`); }
        },
        drawMid(S, g) {
            for (const p of S.plates) {
                if (!p.alive) continue;
                g.fillStyle = 'rgba(186,230,253,0.35)'; g.fillRect(CX - 75, p.y, 150, p.h);
                g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(CX - 75, p.y, 150, 1);
            }
            g.strokeStyle = 'rgba(148,163,184,0.5)'; g.lineWidth = 3;
            g.beginPath(); g.moveTo(CX - 80, 160); g.lineTo(CX - 80, 620); g.moveTo(CX + 80, 160); g.lineTo(CX + 80, 620); g.moveTo(40, 620); g.lineTo(320, 620); g.stroke();
        },
        sub: (S) => S.plates.some(p => p.alive) ? `Next bounce breaks ×${Math.min(S.breakN, S.plates.filter(p => p.alive).length)}` : 'All broken!',
    };
    /* ---------- 15. String battle (flag-battle style) ---------- */
    M.strings = {
        label: 'String battle', icon: '🪢', name: 'Cut their strings',
        P: (R) => ({ g: R(0, 100), r: 10, speed: 160, collide: true, rest: 1, rand: 0.05, arena: 165, genesis: 4 }),
        init(S, R, RI) {
            const m = clamp(S.P.genesis, 2, 8), off = RI(0, 7);
            S.strings = [];
            for (let i = 0; i < m; i++) {
                const [nm, col] = team(off + i), a = i * TAU / m;
                const b = S.addBall(CX + Math.cos(a) * 70, CY + Math.sin(a) * 70, R(0, TAU), S.P.speed, S.P.r, i, { col, name: nm, team: i, label: nm[0] });
                const k = RI(14, 22);
                for (let s = 0; s < k; s++) S.strings.push({ b, a: R(0, TAU), alive: true });
            }
            S.title = m + ' teams. Touch a string to cut it. Last one with strings wins!';
            S.limit = 90; S.limitMsg = () => { const best = S.balls.filter(b => !b.dead).sort((a, b) => S.strings.filter(s => s.alive && s.b === b).length - S.strings.filter(s => s.alive && s.b === a).length)[0]; return best ? '⏱ ' + best.name + ' wins on strings!' : 'Draw'; };
        },
        after(S) {
            for (const s of S.strings) {
                if (!s.alive || s.b.dead) continue;
                const ax = CX + Math.cos(s.a) * S.arena, ay = CY + Math.sin(s.a) * S.arena;
                for (const o of S.balls) {
                    if (o.dead || o === s.b || (o.cutCd || 0) > S.t) continue;
                    if (distSeg(o.x, o.y, ax, ay, s.b.x, s.b.y) < o.r) {
                        s.alive = false; o.cutCd = S.t + 0.6;
                        S.fx.emit((ax + s.b.x) / 2, (ay + s.b.y) / 2, { n: 8, speed: 120, color: s.b.col, life: 0.5, size: 3 });
                        BL.note(S, o, 12, true);
                        if (!S.strings.some(x => x.alive && x.b === s.b)) {
                            s.b.dead = true; S.shake = 0.6;
                            S.fx.emit(s.b.x, s.b.y, { n: 40, speed: 260, color: [s.b.col, '#fff'], life: 0.8, size: 4 });
                            S.text(s.b.x, s.b.y, s.b.name + ' is out!', s.b.col, true);
                            if (S.audible) BL.noise(0.3, 0.08, 500);
                            const left = S.balls.filter(b => !b.dead);
                            if (left.length === 1) S.finish('🏆 ' + left[0].name + ' wins!');
                        }
                        break;
                    }
                }
            }
        },
        post(S) { for (const b of S.balls) if (!b.dead) keepSpeed(b, 150, 420); },
        drawBack(S, g) {
            g.lineWidth = 1.5;
            for (const s of S.strings) { if (!s.alive || s.b.dead) continue; g.strokeStyle = s.b.col; g.globalAlpha = 0.75; g.beginPath(); g.moveTo(CX + Math.cos(s.a) * S.arena, CY + Math.sin(s.a) * S.arena); g.lineTo(s.b.x, s.b.y); g.stroke(); }
            g.globalAlpha = 1;
        },
        drawHud(S, g) {
            g.font = '700 11px Fredoka, sans-serif'; g.textAlign = 'center';
            const alive = S.balls; let x = W / 2 - (alive.length - 1) * 30;
            for (const b of alive) { g.fillStyle = b.dead ? Arcade.ui.surface3 : b.col; g.fillText(b.name + ' ' + S.strings.filter(s => s.alive && s.b === b).length, x, 552); x += 60; }
        },
        sub: () => '',
    };
    /* ---------- 16. Plinko / Galton board ---------- */
    M.plinko = {
        label: 'Plinko rain', icon: '📍', name: 'Where will they land?',
        P: (R, RI) => ({ g: 900, r: 4, rest: 0.45, rand: 0.15, speed: 20, popMax: RI(150, 400) }),
        init(S, R) {
            S.kind = 'none'; S.trails = false;
            const rows = 12, dy = 27, dx = 26, top = 150;
            for (let r = 0; r < rows; r++) { const n = r + 3; for (let i = 0; i < n; i++) S.cells.push({ x: CX + (i - (n - 1) / 2) * dx, y: top + r * dy, r: 3.5, hp: Infinity, alive: true, c: BL.accent(S), rest: 0.5 }); }
            S.binTop = top + rows * dy + 6; S.nb = 13; S.bins = new Array(S.nb).fill(0);
            const x0 = CX - S.nb * 13, bw = 26;
            S.bx0 = x0; S.bw = bw;
            for (let i = 0; i <= S.nb; i++) BL.seg(S, x0 + i * bw, S.binTop, x0 + i * bw, 615, { col: 'rgba(148,163,184,0.5)' });
            BL.seg(S, 30, 90, CX - 40, 130); BL.seg(S, 330, 90, CX + 40, 130);
            BL.seg(S, 20, 130, x0, S.binTop); BL.seg(S, 340, 130, x0 + S.nb * bw, S.binTop);
            S.spawned = 0; S.spawnT = 0; S.N = S.P.popMax;
            S.title = `${S.N} balls fall through ${rows} rows of pegs`;
            S.limit = 90; S.limitMsg = () => 'Bell curve!';
        },
        pre(S, dt) {
            S.spawnT -= dt;
            while (S.spawnT <= 0 && S.spawned < S.N) { S.spawnT += 0.07; S.spawned++; S.addBall(CX + S.R(-5, 5), 100, Math.PI / 2 + S.R(-0.3, 0.3), S.P.speed, S.P.r, S.spawned); }
        },
        after(S) {
            for (const b of S.balls) if (!b.dead && b.y > S.binTop + 6) { const i = clamp(Math.floor((b.x - S.bx0) / S.bw), 0, S.nb - 1); S.bins[i]++; b.dead = true; }
        },
        post(S) { S.balls = S.balls.filter(b => !b.dead); if (S.spawned >= S.N && !S.balls.length) S.finish('A bell curve from ' + S.N + ' balls!'); },
        cell(S, c, b) { },
        drawMid(S, g) {
            const max = Math.max(8, ...S.bins);
            for (let i = 0; i < S.nb; i++) {
                const h = (615 - S.binTop - 6) * S.bins[i] / max;
                g.fillStyle = BL.pcol(i, S.t); g.globalAlpha = 0.85;
                g.fillRect(S.bx0 + i * S.bw + 2, 615 - h, S.bw - 4, h);
                g.globalAlpha = 1;
                if (S.bins[i]) { g.fillStyle = BL.accent(S); g.font = '700 9px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText(S.bins[i], S.bx0 + i * S.bw + S.bw / 2, 615 - h - 6); }
            }
        },
        sub: (S) => 'Balls: ' + S.spawned + ' / ' + S.N, subY: 630,
    };
    /* ---------- tall obstacle courses (race + lava) ---------- */
    function genTrack(S, R, RI, slow) {
        S.kind = 'none';
        const WH = S.worldH;
        BL.seg(S, 10, 0, 10, WH); BL.seg(S, 350, 0, 350, WH);
        BL.seg(S, 10, 90, 150, 140); BL.seg(S, 350, 90, 210, 140);
        let y = 200;
        const kinds = slow ? ['ramps', 'ramps', 'pegs', 'ramps', 'bumpers'] : ['ramps', 'pegs', 'funnel', 'bumpers', 'ramps', 'spinners'];
        while (y < WH - 260) {
            const k = kinds[RI(0, kinds.length - 1)];
            if (k === 'ramps') {
                const n = RI(2, slow ? 6 : 4);
                for (let i = 0; i < n; i++) { const side = (i + RI(0, 1)) % 2; if (side === 0) BL.seg(S, 10, y, R(230, 270), y + R(40, 70)); else BL.seg(S, 350, y, R(90, 130), y + R(40, 70)); y += R(85, 115); }
            } else if (k === 'pegs') {
                const rows = RI(3, 5);
                for (let r = 0; r < rows; r++) { for (let x = 40 + (r % 2) * 20; x < 330; x += 40) S.cells.push({ x, y, r: 5, hp: Infinity, alive: true, c: BL.accent(S) }); y += 34; }
                y += 30;
            } else if (k === 'funnel') { BL.seg(S, 10, y, 155, y + 70); BL.seg(S, 350, y, 205, y + 70); y += 120; }
            else if (k === 'bumpers') { const n = RI(2, 4); for (let i = 0; i < n; i++) S.cells.push({ x: R(60, 300), y: y + R(0, 60), r: R(13, 20), hp: Infinity, alive: true, c: '#f08aa7', rest: 1.25 }); y += 120; }
            else { const n = RI(2, 3); for (let i = 0; i < n; i++) { const s = BL.seg(S, 0, 0, 0, 0, { col: '#f6c445' }); s.cx = R(70, 290); s.cy = y + 30; s.len = R(45, 70); s.spin = R(1.5, 3) * (R(0, 1) < 0.5 ? -1 : 1); s.ang = R(0, TAU); S.spinners = S.spinners || []; S.spinners.push(s); } y += 110; }
        }
        BL.seg(S, 10, WH - 10, 350, WH - 10);
        S.finishY = WH - 60;
    }
    function updSpinners(S, h) {
        if (!S.spinners) return;
        for (const s of S.spinners) {
            s.ang += s.spin * h;
            const dx = Math.cos(s.ang) * s.len, dy = Math.sin(s.ang) * s.len;
            s.x1 = s.cx - dx; s.y1 = s.cy - dy; s.x2 = s.cx + dx; s.y2 = s.cy + dy;
            s.xmin = s.cx - s.len - 1; s.xmax = s.cx + s.len + 1; s.ymin = s.cy - s.len - 1; s.ymax = s.cy + s.len + 1;
        }
    }
    const RACERS = ['Comet', 'Blaze', 'Pixel', 'Nova', 'Turbo', 'Mochi', 'Zippy', 'Bolt', 'Luna', 'Rocket', 'Pebble', 'Ziggy'];
    function racers(S, R, RI, n) {
        const off = RI(0, 7), names = Arcade.shuffle(RACERS.slice());
        for (let i = 0; i < n; i++) { const [, col] = team(off + i); S.addBall(60 + (i + 0.5) * (240 / n), 50 + R(-8, 8), Math.PI / 2, 40, S.P.r, i, { col, name: names[i], silent: true, label: names[i][0] }); }
    }
    function drawBoard(S, g, list, title) {
        const x = W - 112, y = 84;
        g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, y, 104, 14 + list.length * 15);
        g.font = '700 10px Fredoka, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillStyle = '#fde68a'; g.fillText(title, x + 6, y + 8);
        list.forEach((b, i) => { g.fillStyle = b.dead ? Arcade.ui.dim : b.col; g.fillText(`${i + 1}. ${b.name}${b.fin ? ' 🏁' : b.dead ? ' ✖' : ''}`, x + 6, y + 22 + i * 15); });
    }
    M.track = {
        label: 'Ball race', icon: '🏎️', name: 'Marble race to the bottom',
        P: (R, RI) => ({ g: 800, r: 8, rest: 0.55, rand: 0.05, collide: true, genesis: RI(4, 8) }),
        init(S, R, RI) {
            S.worldH = RI(2200, 3200); genTrack(S, R, RI, false); S.trails = false;
            racers(S, R, RI, clamp(S.P.genesis, 2, 10));
            S.order = []; S.camTarget = 0; S.maxSteps = 60;
            S.title = S.balls.length + ' marbles. One winner.';
            S.limit = 90; S.limitMsg = () => S.order.length ? '🏆 ' + S.order[0].name + ' wins!' : 'Time!';
        },
        substep(S, h) { updSpinners(S, h); },
        after(S) { for (const b of S.balls) if (!b.fin && b.y > S.finishY) { b.fin = true; S.order.push(b); S.text(b.x, b.y - 20, '#' + S.order.length + ' ' + b.name, b.col, true); if (S.order.length === 1) Arcade.sfx('win'); if (S.order.length === S.balls.length) S.finish('🏆 ' + S.order[0].name + ' wins!'); } },
        hit(S, b) { if (b === S.leader) BL.note(S, b, 0); },
        post(S) {
            const racing = S.balls.filter(b => !b.fin);
            S.leader = racing.sort((a, b) => b.y - a.y)[0] || S.order[0];
            if (S.leader) S.camTarget = clamp(S.leader.y - 280, 0, S.worldH - H);
        },
        drawBack(S, g) { const y = S.finishY; for (let x = 10; x < 350; x += 12) for (let k = 0; k < 2; k++) { g.fillStyle = ((x / 12 + k) | 0) % 2 ? '#fff' : '#111'; g.fillRect(x, y + k * 6, 12, 6); } },
        drawHud(S, g) { drawBoard(S, g, [...S.order, ...S.balls.filter(b => !b.fin).sort((a, b) => b.y - a.y)], 'LEADERBOARD'); },
        sub: (S) => S.leader && !S.done ? '🥇 ' + S.leader.name + ' · ' + Math.round(S.leader.y / S.worldH * 100) + '%' : '',
    };
    M.lava = {
        label: 'Lava survival', icon: '🌋', name: 'Outrun the lava!',
        P: (R, RI) => ({ g: 700, r: 8, rest: 0.5, rand: 0.05, collide: true, genesis: RI(5, 8) }),
        init(S, R, RI) {
            S.worldH = RI(2000, 2800); genTrack(S, R, RI, true); S.trails = false;
            racers(S, R, RI, clamp(S.P.genesis, 2, 10));
            S.lavaY = -160; S.order = []; S.camTarget = 0; S.maxSteps = 60;
            S.title = 'The lava is coming. Reach the bottom!';
            S.limit = 100; S.limitMsg = () => S.order.length + ' made it';
        },
        substep(S, h) { updSpinners(S, h); S.lavaY += (26 + S.t * 2.6) * h; },
        after(S) {
            for (const b of S.balls) {
                if (b.dead || b.fin) continue;
                if (b.y > S.finishY) { b.fin = true; b.fixed = true; S.order.push(b); S.text(b.x, b.y - 20, b.name + ' is safe!', b.col, true); }
                else if (b.y - b.r < S.lavaY) { b.dead = true; S.fx.emit(b.x, b.y, { n: 30, speed: 200, color: ['#f2893d', '#f6c445', b.col], life: 0.8, size: 4 }); S.text(b.x, b.y + 20, b.name + ' melted', '#f2893d', true); if (S.audible) BL.noise(0.25, 0.08, 300); }
            }
            if (!S.balls.some(b => !b.dead && !b.fin)) S.finish(S.order.length ? `🏁 ${S.order.length} survived, ${S.order[0].name} first!` : '🔥 The lava got everyone!');
        },
        hit(S, b) { if (b === S.leader) BL.note(S, b, 0); },
        post(S) {
            const live = S.balls.filter(b => !b.dead && !b.fin).sort((a, b) => a.y - b.y);
            S.leader = live[live.length - 1];
            const focus = live.length ? live[0].y : S.finishY;
            S.camTarget = clamp(Math.min(focus - 260, Math.max(S.lavaY - 60, focus - 420)), 0, S.worldH - H);
        },
        drawBack(S, g) {
            const y = S.finishY; for (let x = 10; x < 350; x += 12) for (let k = 0; k < 2; k++) { g.fillStyle = ((x / 12 + k) | 0) % 2 ? '#fff' : '#111'; g.fillRect(x, y + k * 6, 12, 6); }
        },
        drawFront(S, g) {
            const ly = S.lavaY;
            if (ly < S.cam - 20) return;
            const grd = g.createLinearGradient(0, ly - 200, 0, ly);
            grd.addColorStop(0, '#7f1d1d'); grd.addColorStop(1, '#f2893d');
            g.fillStyle = grd;
            g.beginPath(); g.moveTo(0, S.cam - 50); g.lineTo(W, S.cam - 50);
            for (let x = W; x >= 0; x -= 12) g.lineTo(x, ly + Math.sin(x * 0.08 + S.t * 4) * 6);
            g.fill();
        },
        drawHud(S, g) { drawBoard(S, g, [...S.order, ...S.balls.filter(b => !b.fin).sort((a, b) => (a.dead - b.dead) || (b.y - a.y))], 'SURVIVORS'); },
        sub: (S) => S.balls.filter(b => !b.dead).length + ' still alive',
    };
    /* ---------- 19. Colour match ---------- */
    const CM = ['#ef5b56', '#4f8ef0', '#4fc07f', '#f6c445'];
    M.colormatch = {
        label: 'Colour match', icon: '🌈', name: 'It only breaks its own colour',
        P: (R) => ({ g: R(0, 200), r: 7, speed: 380, arena: 160, rand: 0.2, genesis: 2 }),
        init(S, R, RI) {
            for (const off of [10, 42]) { const rr = S.arena - off, n = Math.floor(TAU * rr / 14); for (let i = 0; i < n; i++) { const a = i * TAU / n; const cm = RI(0, 3); S.cells.push({ x: CX + Math.cos(a) * rr, y: CY + Math.sin(a) * rr, r: 6, hp: 2, max: 2, alive: true, cm, c: CM[cm] }); } }
            S.total = S.cells.length;
            for (let i = 0; i < S.P.genesis; i++) { const cm = RI(0, 3); S.addBall(CX + R(-20, 20), CY + R(-20, 20), R(0, TAU), S.P.speed, S.P.r, i, { cm, col: CM[cm] }); }
            S.swapT = 2.5;
            S.limit = 75; S.limitMsg = () => S.cells.filter(c => c.alive).length + ' bricks left';
        },
        cell(S, c, b) { if (!S.rainbow && S.cells.filter(x => x.alive).length <= 12) { S.rainbow = true; S.text(BL.CX, 120, '🌈 Rainbow balls! They break anything', '#fde68a', true); for (let i = 0; i < 2; i++) S.addBall(CX, CY, S.R(0, TAU), S.P.speed, S.P.r, 9 + i, { cm: 0 }); }
            if (c.cm === b.cm || S.rainbow) BL.damageCell(S, c, 9); else { BL.damageCell(S, c, 1); if (Math.random() < 0.3) { b.cm = c.cm; b.col = CM[b.cm]; S.wave(b.x, b.y, b.col, b.r); } } },
        pre(S, dt) { if (S.rainbow) for (const b of S.balls) b.col = `hsl(${(S.t * 300) % 360},90%,62%)`; S.swapT -= dt; if (S.swapT <= 0 && !S.rainbow) { S.swapT = 2.5; for (const b of S.balls) { b.cm = (b.cm + 1 + Math.floor(S.rng() * 3)) % 4; b.col = CM[b.cm]; S.wave(b.x, b.y, b.col, b.r); } } },
        broke(S) { if (!S.cells.some(c => c.alive)) S.finish('Every brick matched in ' + S.t.toFixed(1) + 's!'); },
        sub: (S) => 'Bricks: ' + S.cells.filter(c => c.alive).length + ' / ' + S.total,
    };
    /* ---------- 20. Glass rush: multiplier gates ---------- */
    M.gates = {
        label: 'Glass rush', icon: '✖️', name: 'Multiply, then smash the glass',
        P: (R, RI) => ({ g: 800, r: 4, rest: 0.6, rand: 0.25, speed: 0, popMax: 700 }),
        init(S, R, RI) {
            S.kind = 'box'; S.box = { x0: 30, x1: 330, y0: 90, y1: 630 }; S.trails = false;
            S.gates = [];
            const ys = [170, 270, 370, 460];
            for (const y of ys) {
                if (R(0, 1) < 0.5) { const m1 = RI(2, 3), m2 = RI(2, 5); S.gates.push({ y, x0: 30, x1: 180, m: m1 }, { y, x0: 180, x1: 330, m: m2 }); BL.seg(S, 180, y - 18, 180, y + 18); }
                else S.gates.push({ y, x0: 30, x1: 330, m: RI(2, 3) });
                for (let x = 50 + (y % 40); x < 320; x += 44) S.cells.push({ x, y: y + 48, r: 4, hp: Infinity, alive: true, c: BL.accent(S), rest: 0.6 });
            }
            S.paneHp = S.paneMax = RI(300, 900);
            S.pane = BL.seg(S, 30, 590, 330, 590, { pane: true, col: '#bae6fd', rest: 1 });
            S.addBall(CX, 110, Math.PI / 2, 0, S.P.r, 0, { gates: [] });
            S.title = `${S.paneMax} hits to break the glass`;
            S.limit = 70; S.limitMsg = () => 'The glass held!';
        },
        after(S) {
            const add = [];
            for (const b of S.balls) {
                const py = b.py == null ? b.y : b.py;
                for (let gi = 0; gi < S.gates.length; gi++) {
                    const G = S.gates[gi];
                    if (py < G.y && b.y >= G.y && b.x >= G.x0 && b.x <= G.x1 && !b.gates.includes(gi)) {
                        b.gates.push(gi);
                        for (let k = 1; k < G.m && S.balls.length + add.length < S.P.popMax; k++) add.push({ x: b.x + S.R(-4, 4), y: b.y, vx: b.vx + S.R(-80, 80), vy: b.vy, r: b.r, ci: S.balls.length + add.length, tr: [], gates: b.gates.slice(), spawnCd: 0 });
                        if (S.audible && Math.random() < 0.3) BL.note(S, b, 12);
                    }
                }
                b.py = b.y;
            }
            S.balls.push(...add);
        },
        seg(S, s, b) {
            if (!s.pane) return;
            S.paneHp--; b.vy = -S.R(450, 750);
            if (S.paneHp % 25 === 0 && S.audible) BL.glass(1.2);
            if (S.paneHp <= 0) {
                s.off = true; S.shake = 1; S.flash = 1; S.flashC = '#bae6fd';
                for (let x = 30; x < 330; x += 6) S.fx.emit(x, 590, { n: 2, speed: 220, color: ['#bae6fd', '#fff'], life: 1, size: 4, gravity: 700 });
                if (S.audible) { BL.noise(0.6, 0.14, 1500); BL.glass(0.8); }
                S.finish(`💥 Smashed by ${S.balls.length} balls!`);
            }
        },
        drawMid(S, g) {
            for (const G of S.gates) {
                g.fillStyle = G.m >= 4 ? 'rgba(250,204,21,0.25)' : G.m === 3 ? 'rgba(168,85,247,0.25)' : 'rgba(34,197,94,0.25)';
                g.fillRect(G.x0 + 2, G.y - 14, G.x1 - G.x0 - 4, 28);
                g.fillStyle = '#fff'; g.font = '900 16px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('×' + G.m, (G.x0 + G.x1) / 2, G.y);
            }
            if (!S.pane.off) { const k = S.paneHp / S.paneMax; g.fillStyle = `rgba(186,230,253,${0.25 + k * 0.4})`; g.fillRect(30, 586, 300, 10); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1; for (let i = 0; i < (1 - k) * 12; i++) { const x = 40 + ((i * 97) % 280); g.beginPath(); g.moveTo(x, 586); g.lineTo(x + 12, 596); g.stroke(); } }
        },
        sub: (S) => `Balls ${S.balls.length} · Glass ${Math.max(0, S.paneHp)}`, subY: 618,
    };
    /* ---------- 21. Phase bloom ---------- */
    M.bloom = {
        label: 'Phase bloom', icon: '🌸', name: 'Phase bloom', noViz: false,
        P: () => ({}),
        init(S, R, RI) { S.kind = 'none'; S.n = RI(36, 60); S.T = R(24, 36); S.w0 = R(0.25, 0.6); S.d = TAU / S.T; S.prev = new Float64Array(S.n); S.limit = S.T; S.limitMsg = () => 'Full bloom ✿'; S.title = S.n + ' rods, each a little faster than the last'; },
        drawMid(S, g) {
            g.lineCap = 'round';
            for (let i = 0; i < S.n; i++) {
                const a = S.t * (S.w0 + i * S.d) - Math.PI / 2, L = 30 + (i / S.n) * 135;
                const col = `hsl(${(i * 360 / S.n + S.t * 20) % 360},90%,62%)`;
                g.strokeStyle = col; g.lineWidth = 3; g.globalAlpha = 0.9;
                g.beginPath(); g.moveTo(CX, CY); g.lineTo(CX + Math.cos(a) * L, CY + Math.sin(a) * L); g.stroke();
                g.fillStyle = col; g.beginPath(); g.arc(CX + Math.cos(a) * L, CY + Math.sin(a) * L, 3.5, 0, TAU); g.fill();
            }
            g.globalAlpha = 1;
            g.fillStyle = '#fff'; g.beginPath(); g.arc(CX, CY, 5, 0, TAU); g.fill();
        },
        sub: (S) => 'Phase ' + Math.round((S.t / S.T) * 100) + '%',
    };
    // the rods' speeds: rod i turns at w0 + i·d, so they realign exactly after T seconds
    M.bloom.pre = function (S) {
        for (let i = 0; i < S.n; i++) {
            const a = S.t * (S.w0 + i * S.d);
            const cyc = Math.floor(a / TAU);
            if (cyc !== S.prev[i]) { S.prev[i] = cyc; if (S.t > 0.3) BL.note(S, null, i % 12); }
        }
    };
    /* ---------- 22. Gravity well ---------- */
    M.well = {
        label: 'Gravity well', icon: '🪐', name: 'Orbits around a hungry star',
        P: (R, RI) => ({ g: 0, r: 4, genesis: RI(6, 14), arena: 165 }),
        init(S, R) {
            S.attract = { x: CX, y: CY, gm: R(2.2e6, 4e6) }; S.sun = 14; S.trails = false;
            S.paint = document.createElement('canvas'); S.paint.width = 720; S.paint.height = 1280; S.pc = S.paint.getContext('2d'); S.pc.lineCap = 'round';
            const dir = R(0, 1) < 0.5 ? 1 : -1;
            for (let i = 0; i < S.P.genesis; i++) {
                const rho = R(50, 140), a = R(0, TAU), v = Math.sqrt(S.attract.gm / rho) * R(0.75, 1.15);
                const b = S.addBall(CX + Math.cos(a) * rho, CY + Math.sin(a) * rho, a + dir * Math.PI / 2, v, S.P.r, i); b.lx = b.x; b.ly = b.y;
            }
            S.limit = 30; S.limitMsg = () => S.balls.filter(b => !b.dead).length + ' planets survived';
        },
        after(S) {
            const pc = S.pc;
            for (const b of S.balls) {
                if (b.dead) continue;
                pc.strokeStyle = S.ballCol(b); pc.globalAlpha = 0.5; pc.lineWidth = 2; pc.beginPath(); pc.moveTo(b.lx * 2, b.ly * 2); pc.lineTo(b.x * 2, b.y * 2); pc.stroke(); pc.globalAlpha = 1;
                b.lx = b.x; b.ly = b.y;
                if (Math.hypot(b.x - CX, b.y - CY) < S.sun + b.r) {
                    b.dead = true; S.sun += 2; S.flash = 0.6; S.flashC = '#f6c445';
                    S.fx.emit(b.x, b.y, { n: 20, speed: 150, color: [S.ballCol(b), '#fde68a'], life: 0.6, size: 3 });
                    BL.note(S, b, -12, true);
                    if (!S.balls.some(x => !x.dead)) S.finish('The star ate every planet');
                }
            }
        },
        post(S, dt) { const pc = S.pc; pc.globalCompositeOperation = 'destination-out'; pc.fillStyle = `rgba(0,0,0,${dt * 0.35})`; pc.fillRect(0, 0, 720, 1280); pc.globalCompositeOperation = 'source-over'; },
        drawMid(S, g) { const gr = g.createRadialGradient(CX, CY, 2, CX, CY, S.sun * 2.2); gr.addColorStop(0, '#fff7ed'); gr.addColorStop(0.4, '#f6c445'); gr.addColorStop(1, 'rgba(249,115,22,0)'); g.fillStyle = gr; g.beginPath(); g.arc(CX, CY, S.sun * 2.2, 0, TAU); g.fill(); },
        sub: (S) => 'Planets: ' + S.balls.filter(b => !b.dead).length,
    };
    /* ---------- 23. Weapon ball battle ---------- */
    const WEAPONS = {
        sword: { len: 44, spin: 3.2, dmg: 9, col: Arcade.ui.text, grow: (w) => { w.len = Math.min(130, w.len + 5); }, tip: 'grows each hit' },
        dagger: { len: 24, spin: 7, dmg: 4, col: Arcade.ui.muted, grow: (w) => { w.spin += 0.8; }, tip: 'spins faster each hit' },
        spear: { len: 66, spin: 1.7, dmg: 12, col: '#d6a46b', grow: (w) => { w.dmg += 2; }, tip: 'hits harder each hit' },
        hammer: { len: 34, spin: 2.4, dmg: 17, col: Arcade.ui.muted, grow: (w) => { w.spin += 0.35; }, tip: 'heavy and slow' },
        scythe: { len: 50, spin: 2.8, dmg: 8, col: '#b9dc6e', grow: (w) => { w.len = Math.min(110, w.len + 2); w.dmg += 1; }, tip: 'grows and sharpens' },
        twin: { len: 32, spin: 3.6, dmg: 6, col: '#e8a8dc', twin: true, grow: (w) => { w.spin += 0.45; }, tip: 'two blades' },
    };
    const WNAMES = Object.keys(WEAPONS);
    M.battle = {
        label: 'Weapon battle', icon: '⚔️', name: 'Weapon battle',
        P: (R, RI) => ({ g: 0, collide: true, rest: 1, speed: 230, r: 20, rand: 0.1, genesis: RI(2, 4) }),
        init(S, R, RI) {
            S.kind = 'box'; S.box = { x0: 16, x1: 344, y0: 120, y1: 600 }; S.trails = false;
            const m = clamp(S.P.genesis, 2, 6), picks = Arcade.shuffle(WNAMES.slice()), off = RI(0, 7);
            for (let i = 0; i < m; i++) {
                const wn = picks[i % picks.length], Wd = WEAPONS[wn], [, col] = team(off + i);
                S.addBall(70 + (i % 2) * 220 + R(-20, 20), 200 + Math.floor(i / 2) * 200 + R(-20, 20), R(0, TAU), S.P.speed, S.P.r, i, { col, name: wn[0].toUpperCase() + wn.slice(1), hp: 100, id: i, hitCd: {}, w: { type: wn, len: Wd.len, spin: Wd.spin, dmg: Wd.dmg, ang: R(0, TAU), dir: 1 } });
            }
            S.title = m === 2 ? `${S.balls[0].name} vs ${S.balls[1].name}, who wins?` : `${m}-way weapon battle!`;
            S.clashCd = 0;
            S.limit = 90; S.limitMsg = () => { const b = S.balls.filter(x => !x.dead).sort((a, c) => c.hp - a.hp)[0]; return b ? '⏱ ' + b.name + ' wins on HP' : 'Draw'; };
        },
        after(S, h) {
            const L = S.balls.filter(b => !b.dead);
            const blades = (f) => { const w = f.w, out = []; const angs = WEAPONS[w.type].twin ? [w.ang, w.ang + Math.PI] : [w.ang]; for (const a of angs) { const c = Math.cos(a), s = Math.sin(a); out.push([f.x + c * f.r * 0.7, f.y + s * f.r * 0.7, f.x + c * (f.r + w.len), f.y + s * (f.r + w.len)]); } return out; };
            for (const f of L) f.w.ang += f.w.spin * f.w.dir * h;
            S.clashCd -= h;
            for (const f of L) {
                const bl = blades(f);
                for (const o of L) {
                    if (o === f || o.dead) continue;
                    for (const [x1, y1, x2, y2] of bl) {
                        if (distSeg(o.x, o.y, x1, y1, x2, y2) < o.r && S.t > (o.hitCd[f.id] || 0)) {
                            o.hitCd[f.id] = S.t + 0.45;
                            const dmg = Math.round(f.w.dmg);
                            o.hp -= dmg;
                            const dx = o.x - f.x, dy = o.y - f.y, d = Math.hypot(dx, dy) || 1;
                            o.vx += dx / d * 260; o.vy += dy / d * 260;
                            S.text(o.x, o.y - o.r - 10, '-' + dmg, '#f7a8a1');
                            S.fx.emit(o.x, o.y, { n: 10, speed: 160, color: [o.col, '#fff'], life: 0.4, size: 3 });
                            S.shake = 0.25; BL.note(S, f, 0, true);
                            if (S.audible) BL.noise(0.06, 0.05, 1200);
                            WEAPONS[f.w.type].grow(f.w);
                            if (o.hp <= 0) {
                                o.dead = true; S.shake = 1;
                                S.fx.emit(o.x, o.y, { n: 50, speed: 280, color: [o.col, '#fff', '#f6c445'], life: 0.9, size: 5 });
                                S.text(o.x, o.y, 'K.O.!', '#f6c445', true);
                                const left = S.balls.filter(b => !b.dead);
                                if (left.length === 1) S.finish(`🏆 ${left[0].name} wins with ${left[0].hp} HP!`);
                            }
                        }
                    }
                }
            }
            // blade-on-blade clash: both weapons bounce back
            if (S.clashCd <= 0) for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
                for (const a of blades(L[i])) for (const b of blades(L[j])) {
                    if (segInter(a, b)) {
                        L[i].w.dir *= -1; L[j].w.dir *= -1; S.clashCd = 0.18;
                        const mx = (a[2] + b[2]) / 2, my = (a[3] + b[3]) / 2;
                        S.fx.emit(mx, my, { n: 14, speed: 200, color: ['#fde68a', '#fff'], life: 0.3, size: 3 });
                        if (S.audible) BL.synth(1400, 0.08, 0.04, 'square');
                        return;
                    }
                }
            }
        },
        post(S) { for (const b of S.balls) if (!b.dead) BL.keepSpeed(b, 170, 560); },
        drawBall(S, g, f) {
            const w = f.w, Wd = WEAPONS[w.type];
            const angs = Wd.twin ? [w.ang, w.ang + Math.PI] : [w.ang];
            for (const a of angs) {
                const c = Math.cos(a), s = Math.sin(a);
                g.strokeStyle = Wd.col; g.lineWidth = w.type === 'hammer' ? 5 : 4;
                g.beginPath(); g.moveTo(f.x + c * f.r * 0.7, f.y + s * f.r * 0.7); g.lineTo(f.x + c * (f.r + w.len), f.y + s * (f.r + w.len)); g.stroke();
                const tx = f.x + c * (f.r + w.len), ty = f.y + s * (f.r + w.len);
                g.fillStyle = Wd.col;
                if (w.type === 'hammer') { g.save(); g.translate(tx, ty); g.rotate(a); g.fillRect(-6, -10, 12, 20); g.restore(); }
                else if (w.type === 'spear') { g.beginPath(); g.moveTo(tx + c * 10, ty + s * 10); g.lineTo(tx - s * 5, ty + c * 5); g.lineTo(tx + s * 5, ty - c * 5); g.fill(); }
                else if (w.type === 'scythe') { g.beginPath(); g.arc(tx, ty, 9, a, a + Math.PI * 0.9); g.stroke(); }
            }
            g.fillStyle = f.col; if (BL.look.glow) { }
            g.beginPath(); g.arc(f.x, f.y, f.r, 0, TAU); g.fill(); 
            g.fillStyle = '#fff'; g.font = '800 10px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f.name, f.x, f.y);
            g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(f.x - 20, f.y - f.r - 9, 40, 5);
            g.fillStyle = f.hp > 50 ? '#6fd29a' : f.hp > 25 ? '#f6c445' : '#ef5b56'; g.fillRect(f.x - 20, f.y - f.r - 9, 40 * Math.max(0, f.hp) / 100, 5);
        },
        drawHud(S, g) { g.font = '600 10px Fredoka, sans-serif'; g.textAlign = 'center'; let x = W / 2 - (S.balls.length - 1) * 42; for (const b of S.balls) { g.fillStyle = b.dead ? Arcade.ui.dim : b.col; g.fillText(`${b.name}: ${WEAPONS[b.w.type].tip}`, x, 628); x += 84; } },
        sub: (S) => S.balls.filter(b => !b.dead).map(b => b.name + ' ' + Math.max(0, b.hp)).join(' · '), subY: 590,
    };
    function segInter(a, b) {
        const d = (p, q, r, s) => (q - p) * (s - r);
        const [x1, y1, x2, y2] = a, [x3, y3, x4, y4] = b;
        const den = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
        if (Math.abs(den) < 1e-9) return false;
        const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / den, u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / den;
        return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    }

    BL.SHORTS = ['frozen', 'spiralmult', 'spiralglass', 'grow', 'escape', 'accumulate', 'fill', 'race', 'speed', 'gap', 'drawer', 'shrink', 'rhythm', 'ghost', 'breaker', 'targets', 'glass', 'strings', 'plinko', 'track', 'lava', 'colormatch', 'gates', 'bloom', 'well', 'battle'];
})();
