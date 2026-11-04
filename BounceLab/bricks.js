/* =====================================================================
   Brick Shorts: auto-played brick-breaker simulations for the scroller.
   ===================================================================== */
(() => {
    'use strict';
    const { TAU, CX, W, H, clamp } = BL;
    const M = BL.MODES;
    const hpCol = (hp, max) => `hsl(${Math.round(200 - 200 * clamp((hp - 1) / Math.max(1, max - 1), 0, 1))},85%,58%)`;
    BL.hpCol = hpCol;
    const brick = (x, y, w, h, hp, c, extra) => Object.assign({ x, y, w, h, hp, max: hp, c, alive: true }, extra || {});
    const left = (S) => S.bricks.filter(k => k.alive && k.hp !== Infinity).length;
    function symmetric(S, R, RI, cols, rows, x0, y0, bw, bh, maxHp, extra) {
        const half = Math.ceil(cols / 2);
        for (let r = 0; r < rows; r++) {
            const rowHp = RI(1, maxHp);
            for (let c = 0; c < half; c++) {
                if (R(0, 1) < 0.16) continue;
                const hp = clamp(rowHp + (R(0, 1) < 0.3 ? 1 : 0), 1, maxHp);
                for (const cc of c === cols - 1 - c ? [c] : [c, cols - 1 - c]) S.bricks.push(brick(x0 + cc * bw, y0 + r * bh, bw - 2, bh - 2, hp, hpCol(hp, maxHp), extra));
            }
        }
    }
    const recolor = (k) => { if (k.alive && k.hp !== Infinity && k.byHp) k.c = hpCol(k.hp, k.byHp); };

    /* ---------- AI plays breakout ---------- */
    M.bauto = {
        label: 'AI breakout', icon: '🤖', name: 'Can the AI clear it?', noSong: false,
        P: (R, RI) => ({ g: 0, rest: 1, rand: 0.02, speed: 520, r: 6 }),
        init(S, R, RI) {
            S.kind = 'box'; S.box = { x0: 6, x1: 354, y0: 80, y1: 640, openBottom: true }; S.trails = true;
            const maxHp = RI(1, 3);
            symmetric(S, R, RI, 9, RI(5, 8), 9, 110, 38, 18, maxHp, { byHp: maxHp });
            S.pad = { x: CX, w: 70, tw: 70, y: 590, wideT: 0 };
            S.drops = []; S.lost = 0; S.respawn = 0;
            for (let i = 0; i < 2; i++) S.addBall(CX + R(-40, 40), 570, -Math.PI / 2 + R(-0.4, 0.4), S.P.speed, S.P.r, i);
            S.title = `${left(S)} bricks. Can the AI clear them all?`;
            S.limit = 90; S.limitMsg = () => left(S) + ' bricks survived';
        },
        brick(S, k, b) { BL.damageBrick(S, k, 1); recolor(k); return 'bounce'; },
        brokeBrick(S, k) { if (Math.random() < 0.2) S.drops.push({ x: k.x + k.w / 2, y: k.y, t: Math.random() < 0.6 ? 'multi' : 'wide' }); if (!left(S)) S.finish(`AI cleared it in ${S.t.toFixed(1)}s!`); },
        pre(S, dt) {
            const p = S.pad;
            // aim under the lowest falling ball, predicting wall bounces
            const falling = S.balls.filter(b => !b.dead && b.vy > 0).sort((a, b) => b.y - a.y)[0];
            let tx = CX;
            if (falling) {
                let x = falling.x + falling.vx * (p.y - falling.y) / falling.vy; const L = S.box.x0 + 6, Rr = S.box.x1 - 6, span = Rr - L; x = ((x - L) % (2 * span) + 2 * span) % (2 * span); tx = L + (x > span ? 2 * span - x : x);
                // steer: hit the ball off-centre so it flies towards the column with the most bricks
                const colsN = {}; for (const k of S.bricks) if (k.alive) { const cx = Math.round(k.x / 38); colsN[cx] = (colsN[cx] || 0) + k.hp; }
                let bestC = null, bv = -1; for (const [cx, v] of Object.entries(colsN)) if (v > bv) { bv = v; bestC = +cx; }
                if (bestC != null) { const goal = bestC * 38 + 19, a = Math.atan2(150 - p.y, goal - tx), off = clamp((a + Math.PI / 2) / 1.05, -0.85, 0.85); tx -= off * p.w / 2; }
            }
            const mv = 900 * dt; p.x += clamp(tx - p.x, -mv, mv);
            p.wideT -= dt; p.tw = p.wideT > 0 ? 110 : 70; p.w += (p.tw - p.w) * Math.min(1, dt * 6);
            p.x = clamp(p.x, p.w / 2 + 6, 354 - p.w / 2);
            for (const d of S.drops) { d.y += 160 * dt; if (d.y > p.y - 6 && d.y < p.y + 12 && Math.abs(d.x - p.x) < p.w / 2 + 10) { d.dead = true; Arcade.sfx('power'); if (d.t === 'wide') p.wideT = 8; else { for (const b of S.balls.filter(x => !x.dead).slice(0, 6)) for (const a of [-0.4, 0.4]) { const ang = Math.atan2(b.vy, b.vx) + a; S.addBall(b.x, b.y, ang, S.P.speed, b.r); } } } if (d.y > H) d.dead = true; }
            S.drops = S.drops.filter(d => !d.dead);
            if (!S.balls.some(b => !b.dead)) { S.respawn -= dt; if (S.respawn <= 0) { S.addBall(p.x, p.y - 12, -Math.PI / 2 + S.R(-0.4, 0.4), S.P.speed, S.P.r); } }
        },
        after(S) {
            const p = S.pad;
            for (const b of S.balls) {
                if (b.dead) continue;
                if (b.vy > 0 && b.y + b.r >= p.y && b.y - b.r <= p.y + 10 && Math.abs(b.x - p.x) <= p.w / 2 + b.r) {
                    const off = clamp((b.x - p.x) / (p.w / 2), -1, 1), a = -Math.PI / 2 + off * 1.05, sp = Math.hypot(b.vx, b.vy);
                    b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.y = p.y - b.r;
                    BL.note(S, b, -12);
                }
                if (b.y > H + 20) { b.dead = true; S.lost++; S.respawn = 0.6; }
            }
        },
        post(S) { S.balls = S.balls.filter(b => !b.dead); for (const b of S.balls) BL.keepSpeed(b, S.P.speed, S.P.speed); },
        drawMid(S, g) {
            const p = S.pad;
            g.fillStyle = '#f43f5e'; g.beginPath(); if (g.roundRect) g.roundRect(p.x - p.w / 2, p.y, p.w, 10, 5); else g.rect(p.x - p.w / 2, p.y, p.w, 10); g.fill();
            for (const d of S.drops) { g.fillStyle = d.t === 'wide' ? '#22c55e' : '#22d3ee'; g.beginPath(); g.arc(d.x, d.y, 8, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.font = '800 9px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d.t === 'wide' ? '⟷' : '×3', d.x, d.y); }
        },
        sub: (S) => `Bricks ${left(S)} · Drops ${S.lost}`, subY: 625,
    };
    /* ---------- every brick broken becomes a ball ---------- */
    M.bhp = {
        label: 'Brick → ball', icon: '🔢', name: 'Every broken brick becomes a ball',
        P: (R, RI) => ({ g: 0, rest: 1, rand: 0.03, speed: 440, r: 5, popMax: 220, genesis: 2 }),
        init(S, R, RI) {
            S.kind = 'box'; S.box = { x0: 10, x1: 350, y0: 100, y1: 620 }; S.trails = false;
            const maxHp = RI(3, 12), cols = 8, bw = 340 / cols, bh = 26;
            for (let r = 0; r < 11; r++) for (let c = 0; c < cols; c++) if (R(0, 1) < 0.55) { const hp = RI(1, maxHp); S.bricks.push(brick(10 + c * bw + 1, 110 + r * bh, bw - 2, bh - 2, hp, hpCol(hp, maxHp), { showHp: true, byHp: maxHp })); }
            for (let i = 0; i < S.P.genesis; i++) S.addBall(CX + R(-60, 60), 600, -Math.PI / 2 + R(-0.5, 0.5), S.P.speed, S.P.r, i);
            S.title = 'Every broken brick becomes a new ball';
            S.limit = 90; S.limitMsg = () => left(S) + ' bricks survived';
        },
        brick(S, k, b) { BL.damageBrick(S, k, 1); recolor(k); return 'bounce'; },
        brokeBrick(S, k) { if (S.balls.length < S.P.popMax) S.addBall(k.x + k.w / 2, k.y + k.h / 2, S.R(0, TAU), S.P.speed, S.P.r); if (!left(S)) S.finish(`Cleared with ${S.balls.length} balls!`); },
        post(S) { for (const b of S.balls) BL.keepSpeed(b, S.P.speed, S.P.speed); },
        sub: (S) => `Bricks ${left(S)} · Balls ${S.balls.length}`, subY: 640 - 18,
    };
    /* ---------- Ballz, played by a bot ---------- */
    const BZ = { cols: 7, cell: 48, x0: 12, top: 100, floor: 600 };
    M.bballz = {
        label: 'Ballz bot', icon: '🎱', name: 'How long can the bot survive?',
        P: () => ({ g: 0, rest: 1, rand: 0, speed: 820, r: 5 }),
        init(S, R, RI) {
            S.kind = 'box'; S.box = { x0: BZ.x0, x1: BZ.x0 + BZ.cols * BZ.cell, y0: BZ.top, y1: BZ.floor + 40, openBottom: true }; S.trails = false;
            S.round = 1; S.nBalls = 1; S.pending = 0; S.lx = CX; S.state = 'aim'; S.aimT = 0.5; S.speedMul = 1.6;
            for (let i = 0; i < 2; i++) bzRow(S, i);
            S.title = 'A bot plays Ballz. How many rounds?';
        },
        brick(S, k, b) { BL.damageBrick(S, k, 1); recolor(k); return 'bounce'; },
        pre(S, dt) {
            if (S.done) return;
            if (S.state === 'aim') {
                S.aimT -= dt;
                if (S.aimT <= 0) {
                    const target = S.bricks.filter(k => k.alive).sort((a, b) => b.y - a.y)[0];
                    let ang = -Math.PI / 2 + S.R(-0.9, 0.9);
                    if (target && S.R(0, 1) < 0.7) ang = Math.atan2(target.y + target.h / 2 - BZ.floor, target.x + target.w / 2 - S.lx) + S.R(-0.12, 0.12);
                    S.ang = clamp(ang, -Math.PI + 0.15, -0.15);
                    S.state = 'fire'; S.fired = 0; S.fireT = 0; S.firstBack = null;
                }
            } else if (S.state === 'fire') {
                S.fireT -= dt;
                while (S.fireT <= 0 && S.fired < S.nBalls) { S.fireT += 0.06; S.fired++; S.addBall(S.lx, BZ.floor - 6, S.ang, S.P.speed, S.P.r, 0, { silent: S.fired > 1 }); }
                if (S.fired >= S.nBalls) S.state = 'roll';
            }
        },
        after(S) {
            for (const b of S.balls) {
                if (b.dead) continue;
                if (b.vy > 0 && b.y >= BZ.floor) { b.dead = true; if (S.firstBack == null) S.firstBack = clamp(b.x, BZ.x0 + 8, BZ.x0 + BZ.cols * BZ.cell - 8); }
                for (const c of S.cells) if (c.alive && Math.hypot(b.x - c.x, b.y - c.y) < 12) { c.alive = false; S.pending++; S.text(c.x, c.y, '+1', '#4ade80'); BL.note(S, b, 12, true); }
            }
        },
        post(S) {
            S.balls = S.balls.filter(b => !b.dead);
            if (S.state === 'roll' && !S.balls.length) {
                S.nBalls += S.pending; S.pending = 0; S.lx = S.firstBack ?? S.lx; S.round++;
                for (const k of S.bricks) k.y += BZ.cell;
                for (const c of S.cells) c.y += BZ.cell;
                S.cells = S.cells.filter(c => c.alive && c.y < BZ.floor - 30);
                if (S.bricks.some(k => k.alive && k.y + k.h > BZ.floor - BZ.cell + 4)) { S.finish(`Survived ${S.round - 1} rounds with ${S.nBalls} balls`); return; }
                bzRow(S, 0);
                S.state = 'aim'; S.aimT = 0.35;
            }
            if (S.t > 150 && !S.done) S.finish(`Still alive after ${S.round} rounds!`);
        },
        drawMid(S, g) {
            g.strokeStyle = 'rgba(239,68,68,0.5)'; g.setLineDash([6, 6]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(BZ.x0, BZ.floor - BZ.cell + 4); g.lineTo(BZ.x0 + BZ.cols * BZ.cell, BZ.floor - BZ.cell + 4); g.stroke(); g.setLineDash([]);
            g.fillStyle = BL.accent(S); g.fillRect(BZ.x0, BZ.floor, BZ.cols * BZ.cell, 2);
            for (const c of S.cells) if (c.alive) { g.strokeStyle = '#4ade80'; g.lineWidth = 3; g.beginPath(); g.arc(c.x, c.y, 9 + Math.sin(S.t * 6) * 1.5, 0, TAU); g.stroke(); g.fillStyle = '#4ade80'; g.beginPath(); g.arc(c.x, c.y, 4, 0, TAU); g.fill(); }
            if (S.state === 'aim' && S.ang != null) { }
            g.fillStyle = '#fff'; g.beginPath(); g.arc(S.lx, BZ.floor - 6, 6, 0, TAU); g.fill();
            g.font = '700 11px system-ui'; g.textAlign = 'center'; g.fillText('×' + (S.nBalls - (S.fired || 0) * (S.state === 'fire' ? 1 : 0)), S.lx, BZ.floor + 16);
        },
        sub: (S) => `Round ${S.round} · ${S.nBalls} balls`, subY: 632,
    };
    function bzRow(S, row) {
        const y = BZ.top + 6 + row * BZ.cell;
        const free = [];
        for (let c = 0; c < BZ.cols; c++) {
            if (S.R(0, 1) < 0.55) { const hp = S.R(0, 1) < 0.2 ? S.round * 2 : S.round; S.bricks.push(brick(BZ.x0 + c * BZ.cell + 2, y, BZ.cell - 4, BZ.cell - 4, hp, hpCol(hp, S.round * 2), { showHp: true, byHp: Math.max(2, S.round * 2) })); }
            else free.push(c);
        }
        if (free.length) { const c = free[Math.floor(S.R(0, free.length))]; S.cells.push({ x: BZ.x0 + c * BZ.cell + BZ.cell / 2, y: y + BZ.cell / 2 - 2, r: 9, ghost: true, alive: true, hidden: true }); }
    }
    /* ---------- pixel art destruction ---------- */
    const PIX = ['🍉', '🍕', '🐸', '🌈', '🦊', '🍄', '👾', '🐙', '🌻', '🚀', '🍩', '🐼', '🦄', '🎃', '🍓', '🐳', '🌮', '🧁', '🐝', '⚽'];
    M.bpixel = {
        label: 'Pixel smash', icon: '🖼️', name: 'Destroyed pixel by pixel',
        P: (R, RI, rng) => ({ g: rng() < 0.5 ? 0 : R(100, 250), rest: 1, rand: 0.04, speed: 420, r: 5, genesis: RI(3, 6) }),
        init(S, R, RI) {
            S.kind = 'box'; S.box = { x0: 10, x1: 350, y0: 80, y1: 630 }; S.trails = false;
            const e = PIX[RI(0, PIX.length - 1)], N = 30, px = 10;
            const cv = document.createElement('canvas'); cv.width = cv.height = N;
            const g = cv.getContext('2d');
            g.font = `${N - 3}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, N / 2, N / 2 + 2);
            const d = g.getImageData(0, 0, N, N).data;
            for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (y * N + x) * 4; if (d[i + 3] > 110) S.bricks.push(brick(30 + x * px, 110 + y * px, px - 0.5, px - 0.5, 1, `rgb(${d[i]},${d[i + 1]},${d[i + 2]})`)); }
            if (!S.bricks.length) for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) S.bricks.push(brick(80 + x * px, 140 + y * px, px - 0.5, px - 0.5, 1, BL.pcol(x + y, 0)));
            S.total = S.bricks.length; S.emoji = e;
            if (S.P.g) S.P.speed = Math.max(S.P.speed, Math.sqrt(2 * S.P.g * 540));
            for (let i = 0; i < S.P.genesis; i++) S.addBall(CX + R(-80, 80), 600, -Math.PI / 2 + R(-0.6, 0.6), S.P.speed, S.P.r, i);
            S.title = 'Destroying a ' + e + ' pixel by pixel';
            S.limit = 100; S.limitMsg = () => Math.round(left(S) / S.total * 100) + '% of the ' + e + ' survived';
        },
        brick(S, k, b) { BL.damageBrick(S, k, 1); if (Math.random() < 0.25) BL.note(S, b, 12); return Math.random() < 0.7 ? 'pass' : 'bounce'; },
        brokeBrick(S) { if (!left(S)) S.finish('Goodbye ' + S.emoji + '!'); },
        post(S) { if (!S.P.g) for (const b of S.balls) BL.keepSpeed(b, S.P.speed * 0.9, S.P.speed * 1.1); },
        sub: (S) => Math.round((1 - left(S) / S.total) * 100) + '% destroyed', subY: 625,
    };
    /* ---------- territory war ---------- */
    M.bterritory = {
        label: 'Territory war', icon: '🟥', name: 'Territory war', noViz: true,
        P: (R, RI, rng) => ({ g: 0, rest: 1, rand: 0, speed: 280, r: 7, genesis: rng() < 0.5 ? 2 : 4 }),
        init(S, R, RI) {
            const cols = 20, rows = 30, ts = 16, x0 = 20, y0 = 100;
            S.grid = { cols, rows, ts, x0, y0, t: new Int8Array(cols * rows) };
            S.kind = 'box'; S.box = { x0, x1: x0 + cols * ts, y0, y1: y0 + rows * ts }; S.trails = false;
            const teams = S.P.genesis >= 4 ? 4 : 2, off = RI(0, 7);
            S.teams = [];
            for (let i = 0; i < teams; i++) S.teams.push(BL.TEAM[(off + i * 2) % BL.TEAM.length]);
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) S.grid.t[r * cols + c] = teams === 2 ? (r < rows / 2 ? 0 : 1) : (r < rows / 2 ? 0 : 2) + (c < cols / 2 ? 0 : 1);
            for (let i = 0; i < teams; i++) {
                const cx = teams === 2 ? x0 + cols * ts / 2 : x0 + (i % 2 ? 0.75 : 0.25) * cols * ts;
                const cy = teams === 2 ? y0 + (i ? 0.75 : 0.25) * rows * ts : y0 + (i < 2 ? 0.25 : 0.75) * rows * ts;
                const per = R(0, 1) < 0.3 ? 2 : 1;
                for (let k = 0; k < per; k++) S.addBall(cx + R(-20, 20), cy + R(-20, 20), R(0, TAU), S.P.speed, S.P.r, i, { team: i, col: lighten(S.teams[i][1]) });
            }
            S.title = S.teams.map(t => t[0]).join(' vs ') + ', who takes the board?';
            S.limit = 45; S.limitMsg = () => { const n = counts(S), i = n.indexOf(Math.max(...n)); return `🏆 ${S.teams[i][0]} wins with ${Math.round(n[i] / S.grid.t.length * 100)}%`; };
        },
        after(S) {
            const G = S.grid;
            const tileAt = (x, y) => { const c = Math.floor((x - G.x0) / G.ts), r = Math.floor((y - G.y0) / G.ts); return c >= 0 && r >= 0 && c < G.cols && r < G.rows ? r * G.cols + c : -1; };
            for (const b of S.balls) {
                const ix = tileAt(b.x + Math.sign(b.vx) * b.r, b.y);
                if (ix >= 0 && G.t[ix] !== b.team) { G.t[ix] = b.team; b.vx = -b.vx; flip(S, b, ix); }
                const iy = tileAt(b.x, b.y + Math.sign(b.vy) * b.r);
                if (iy >= 0 && G.t[iy] !== b.team) { G.t[iy] = b.team; b.vy = -b.vy; flip(S, b, iy); }
                const ic = tileAt(b.x, b.y);
                if (ic >= 0 && G.t[ic] !== b.team) { G.t[ic] = b.team; flip(S, b, ic); }
            }
        },
        post(S) { for (const b of S.balls) BL.keepSpeed(b, S.P.speed, S.P.speed); },
        drawBack(S, g) {
            const G = S.grid;
            for (let i = 0; i < G.t.length; i++) { const c = i % G.cols, r = (i / G.cols) | 0; g.fillStyle = S.teams[G.t[i]][1]; g.fillRect(G.x0 + c * G.ts, G.y0 + r * G.ts, G.ts, G.ts); }
            g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1;
            for (let c = 0; c <= G.cols; c++) { g.beginPath(); g.moveTo(G.x0 + c * G.ts, G.y0); g.lineTo(G.x0 + c * G.ts, G.y0 + G.rows * G.ts); g.stroke(); }
            for (let r = 0; r <= G.rows; r++) { g.beginPath(); g.moveTo(G.x0, G.y0 + r * G.ts); g.lineTo(G.x0 + G.cols * G.ts, G.y0 + r * G.ts); g.stroke(); }
        },
        drawBall(S, g, b) { g.fillStyle = b.col; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill(); g.stroke(); },
        drawHud(S, g) {
            const n = counts(S), tot = S.grid.t.length;
            let x = 20;
            for (let i = 0; i < n.length; i++) { const w = 320 * n[i] / tot; g.fillStyle = S.teams[i][1]; g.fillRect(x, 590, w, 14); x += w; }
            g.font = '800 12px system-ui'; g.textAlign = 'center'; g.fillStyle = '#fff';
            g.fillText(S.teams.map((t, i) => `${t[0]} ${Math.round(n[i] / tot * 100)}%`).join('  ·  '), CX, 620);
        },
        sub: () => '',
    };
    const lighten = (hex) => { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.min(255, Math.round(v + (255 - v) * 0.55)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
    const counts = (S) => { const n = new Array(S.teams.length).fill(0); for (const v of S.grid.t) n[v]++; return n; };
    function flip(S, b, i) { if (Math.random() < 0.35) BL.note(S, b); const G = S.grid, c = i % G.cols, r = (i / G.cols) | 0; if (S.fx.list.length < 300) S.fx.emit(G.x0 + c * G.ts + G.ts / 2, G.y0 + r * G.ts + G.ts / 2, { n: 2, speed: 60, color: b.col, life: 0.3, size: 3 }); }
    /* ---------- colour-match bricks ---------- */
    const CM = ['#ef4444', '#3b82f6', '#22c55e', '#facc15'];
    M.bcolor = {
        label: 'Colour breaker', icon: '🎨', name: 'It only breaks its own colour',
        P: (R, RI) => ({ g: 0, rest: 1, rand: 0.04, speed: 540, r: 7, genesis: 4 }),
        init(S, R, RI) {
            S.kind = 'box'; S.box = { x0: 10, x1: 350, y0: 90, y1: 630 };
            for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) { const cm = RI(0, 3); S.bricks.push(brick(11 + c * 37.6, 110 + r * 20, 35.6, 18, 2, CM[cm], { cm })); }
            for (let i = 0; i < S.P.genesis; i++) { const cm = RI(0, 3); S.addBall(CX + R(-60, 60), 600, -Math.PI / 2 + R(-0.6, 0.6), S.P.speed, S.P.r, i, { cm, col: CM[cm] }); }
            S.swapT = 1.4;
            S.limit = 100; S.limitMsg = () => left(S) + ' bricks left';
        },
        brick(S, k, b) { if (!S.rainbow && left(S) <= 12) { S.rainbow = true; S.text(CX, 120, '🌈 Rainbow balls! They break anything', '#fde68a', true); for (let i = 0; i < 2; i++) S.addBall(CX, 600, -Math.PI / 2 + S.R(-0.6, 0.6), S.P.speed, S.P.r, 9 + i, { cm: 0 }); }
            if (k.cm === b.cm || S.rainbow) BL.damageBrick(S, k, 3); else { BL.damageBrick(S, k, 1); if (Math.random() < 0.3) { b.cm = k.cm; b.col = CM[b.cm]; } } return 'bounce'; },
        brokeBrick(S) { if (!left(S)) S.finish('All colours matched in ' + S.t.toFixed(1) + 's'); },
        pre(S, dt) { if (S.rainbow) for (const b of S.balls) b.col = `hsl(${(S.t * 300) % 360},90%,62%)`; S.swapT -= dt; if (S.swapT <= 0 && !S.rainbow) { S.swapT = 1.4; for (const b of S.balls) { b.cm = (b.cm + 1 + Math.floor(S.rng() * 3)) % 4; b.col = CM[b.cm]; S.wave(b.x, b.y, b.col, b.r); } } },
        post(S) { for (const b of S.balls) BL.keepSpeed(b, S.P.speed, S.P.speed); },
        sub: (S) => 'Bricks left: ' + left(S), subY: 625,
    };
    /* ---------- chain-reaction bombs ---------- */
    M.bchain = {
        label: 'Chain reaction', icon: '💣', name: 'Chain reaction',
        P: (R) => ({ g: 0, rest: 1, rand: 0.04, speed: 420, r: 6 }),
        init(S, R, RI) {
            S.kind = 'box'; S.box = { x0: 10, x1: 350, y0: 90, y1: 630 };
            S.cols = 9; S.rowsN = 16; S.map = {};
            for (let r = 0; r < S.rowsN; r++) for (let c = 0; c < S.cols; c++) { if (R(0, 1) < 0.08) continue; const bomb = R(0, 1) < 0.28, hp = 1; const k = brick(11 + c * 37.6, 110 + r * 18, 35.6, 16, hp, bomb ? '#581c87' : hpCol(hp, 3), { bomb, gc: c, gr: r, byHp: bomb ? 0 : 3 }); S.bricks.push(k); S.map[c + ',' + r] = k; }
            S.queue = [];
            for (let i = 0; i < 2; i++) S.addBall(CX + R(-60, 60), 600, -Math.PI / 2 + R(-0.5, 0.5), S.P.speed, S.P.r, i);
            S.bombs = 0;
            S.title = S.bricks.filter(k => k.bomb).length + ' bombs. Two balls.';
            S.limit = 90; S.limitMsg = () => left(S) + ' bricks survived';
        },
        brick(S, k, b) { BL.damageBrick(S, k, 1); recolor(k); return 'bounce'; },
        brokeBrick(S, k) {
            if (k.bomb) {
                S.bombs++; S.shake = 0.5;
                S.fx.emit(k.x + k.w / 2, k.y + k.h / 2, { n: 24, speed: 240, color: ['#a855f7', '#f0abfc', '#facc15', '#fff'], life: 0.6, size: 4 });
                if (S.audible) BL.noise(0.25, 0.08, 200);
                BL.note(S, null, -12, true);
                for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) { const o = S.map[(k.gc + dc) + ',' + (k.gr + dr)]; if (o && o.alive) S.queue.push({ k: o, t: S.t + 0.09 }); }
            }
            if (!left(S)) S.finish(`Chain reaction! ${S.bombs} bombs went off`);
        },
        pre(S) { const now = S.queue.filter(q => q.t <= S.t); S.queue = S.queue.filter(q => q.t > S.t); for (const q of now) if (q.k.alive) BL.damageBrick(S, q.k, 99); },
        post(S) { for (const b of S.balls) BL.keepSpeed(b, S.P.speed, S.P.speed); },
        sub: (S) => `Bombs ${S.bombs} · Bricks ${left(S)}`, subY: 625,
    };
    BL.BRICKS = ['bauto', 'bhp', 'bballz', 'bpixel', 'bterritory', 'bcolor', 'bchain'];
})();
