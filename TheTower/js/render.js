/* The Tower — drawing the battlefield on the canvas, in the mobile game's neon style:
   a hollow hexagon tower, hollow neon enemies, cyan shots with trails, pink kill bursts and "$" pop-ups. */
(() => {
    const G = window.TG, D = G.D, B = G.B;
    const R = G.R = {};
    let ctx, W = 720, H = 720, CY = 360, scale = 3, t = 0;
    R.init = (context, w, h) => { ctx = context; W = w; H = h; };
    R.scale = () => scale;
    // meters -> pixels (on the home screen the tower sits higher, under the title)
    const X = (x) => W / 2 + x * scale, Y = (y) => CY + y * scale;
    R.toWorld = (px, py) => ({ x: (px - W / 2) / scale, y: (py - CY) / scale });

    const TAU = Math.PI * 2;
    function poly(x, y, r, n, rot = 0) {
        ctx.beginPath();
        for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.closePath();
    }
    function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); }
    function spikes(x, y, r1, r2, n, rot) {
        ctx.beginPath();
        for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? r1 : r2; i ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
        ctx.closePath();
    }
    // neon line: a wide faint stroke under a thin bright one (much cheaper than shadowBlur with hundreds of enemies)
    function neon(col, w = 1.8, glow = 3.5, a = 1) {
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.22 * a; ctx.lineWidth = w + glow; ctx.stroke();
        ctx.globalAlpha = a; ctx.lineWidth = w; ctx.stroke();
    }
    // a jagged lightning path from one point to another
    function bolt(x0, y0, x1, y1, n, jag) {
        const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, pts = [[x0, y0]];
        for (let i = 1; i < n; i++) { const f = i / n, off = (Math.random() - 0.5) * Math.min(22, len * jag); pts.push([x0 + dx * f + nx * off, y0 + dy * f + ny * off]); }
        pts.push([x1, y1]);
        return pts;
    }
    function path(pts) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); }
    const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

    /* ---------- effects that outlive the enemy: kill bursts and cash pop-ups ---------- */
    const parts = [], pops = [], booms = [];
    let lastMissiles = [], fdtNow = 0;
    const ENC = {
        basic: '#ff4d7e', fast: '#f2e14c', tank: '#e14dff', ranged: '#3fe3d2', protector: '#4aa3ff', boss: '#ff3355',
        vampire: '#ff2f4f', ray: '#ffd23d', scatter: '#7dff6a', saboteur: '#c8d0ea', commander: '#ffb020', overcharge: '#3ec5ff',
    };
    G.on('kill', (e) => {
        if (!G.run()) return;
        const col = ENC[e.type] || '#ff4d7e';
        const n = parts.length > 900 ? 3 : e.boss ? 40 : e.elite || e.fleet ? 22 : 12;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU, v = (e.boss ? 9 : 4) * (0.3 + Math.random());
            parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.6 + Math.random() * 0.6, col, r: 0.7 + Math.random() * 0.9 });
        }
        if (e.cashGot > 0 && pops.length < 45) pops.push({ x: e.x + G.rand(-1.5, 1.5), y: e.y, t: 0, txt: '$' + G.fmt(e.cashGot) });
    });
    G.on('runStart', () => { parts.length = 0; pops.length = 0; orbTrail.length = 0; booms.length = 0; lastMissiles = []; });

    /* ---------- the frame ---------- */
    const orbTrail = [];
    R.draw = (dt) => {
        t += dt;
        const run = G.run();
        if (!run) { drawHome(); return; }
        const s = run.s;
        const view = B.spawnDist() + 4;
        CY = H / 2;
        scale = (Math.min(W, H) / 2 - 6) / view;
        const fdt = fdtNow = dt * (G.S.settings.speed || 1);
        // background: deep navy-black with a faint purple nebula round the tower
        ctx.fillStyle = '#06061a';
        ctx.fillRect(0, 0, W, H);
        const g = ctx.createRadialGradient(X(0), Y(0), 20, X(0), Y(0), Math.max(W, H) * 0.65);
        g.addColorStop(0, 'rgba(70,30,130,0.22)'); g.addColorStop(0.5, 'rgba(35,15,80,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // range
        circle(X(0), Y(0), s.range * scale);
        ctx.fillStyle = 'rgba(20,70,90,0.07)'; ctx.fill();
        ctx.strokeStyle = '#1f5f6e'; ctx.lineWidth = 2; ctx.stroke();

        drawFields(run, s);
        drawMines(run);
        for (const e of run.enemies) drawEnemy(e, run.enemies.length);
        drawBursts(fdt);
        drawTower(run, s);
        drawOrbs(run, s);
        drawShots(run);
        drawBeams(run, s);
        drawWaves(run);
        drawBots(run, s);
        drawPickups(run);
        drawText(run, fdt);
    };

    /* ---------- home screen: purple, with the big hexagon like the game's main menu ---------- */
    function drawHome() {
        CY = H * 0.36;
        scale = 3;
        const g = ctx.createRadialGradient(W / 2, H * 0.4, 30, W / 2, H * 0.5, Math.max(W, H) * 0.75);
        g.addColorStop(0, '#231e40'); g.addColorStop(1, '#0f0d1f');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // faint circuit grid
        ctx.strokeStyle = 'rgba(160,150,255,0.035)'; ctx.lineWidth = 1;
        for (let x = (W / 2) % 40; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        const skin = G.skin();
        const r = 62 + Math.sin(t * 1.6) * 1.5;
        ctx.shadowColor = skin.glow; ctx.shadowBlur = 24;
        poly(W / 2, CY, r, skin.sides || 6, 0);
        ctx.fillStyle = 'rgba(10,14,40,0.35)'; ctx.fill();
        ctx.strokeStyle = skin.edge; ctx.lineWidth = 4; ctx.stroke();
        ctx.shadowBlur = 0;
    }

    /* ---------- ultimate weapon areas under the enemies ---------- */
    function drawFields(run, s) {
        const ox = X(0), oy = Y(0);
        // chrono field: a blue-violet time bubble with ripples drifting inward, a turning dial and two clock hands running backwards
        if (run.cfOn > 0) {
            const R0 = (s.range + G.labV('Chrono_Field_Range')) * scale, k = Math.min(1, run.cfOn * 2);
            const gr = ctx.createRadialGradient(ox, oy, R0 * 0.1, ox, oy, R0);
            gr.addColorStop(0, 'rgba(110,120,255,0.02)'); gr.addColorStop(0.7, 'rgba(110,130,255,0.08)'); gr.addColorStop(1, 'rgba(140,160,255,0.24)');
            ctx.globalAlpha = k; ctx.fillStyle = gr; circle(ox, oy, R0); ctx.fill();
            ctx.lineWidth = 1.2;
            for (let i = 0; i < 4; i++) {
                const f = 1 - ((t * 0.35 + i / 4) % 1);
                circle(ox, oy, R0 * f); ctx.strokeStyle = `rgba(170,185,255,${(0.3 * f).toFixed(3)})`; ctx.stroke();
            }
            ctx.lineCap = 'round';
            for (let i = 0; i < 60; i++) {
                const a = -t * 0.3 + i * TAU / 60, big = i % 5 === 0, l = big ? 12 : 5;
                ctx.strokeStyle = big ? 'rgba(205,215,255,0.85)' : 'rgba(150,170,255,0.4)'; ctx.lineWidth = big ? 2.2 : 1;
                ctx.beginPath(); ctx.moveTo(ox + Math.cos(a) * (R0 - l), oy + Math.sin(a) * (R0 - l)); ctx.lineTo(ox + Math.cos(a) * R0, oy + Math.sin(a) * R0); ctx.stroke();
            }
            for (const [len, sp, w] of [[0.5, -1.6, 2.4], [0.78, -0.3, 1.6]]) {
                const a = t * sp;
                ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(a) * R0 * len, oy + Math.sin(a) * R0 * len);
                neon('#c3ceff', w, 5, 0.55 * k);
            }
            ctx.lineCap = 'butt';
            circle(ox, oy, R0); neon('#a9b8ff', 1.6, 6, k);
            ctx.globalAlpha = 1;
        }
        // spotlight: soft cones with a bright core and edges, dust drifting along the light
        if (run.uw.sl && !run.uwOff.sl) {
            const n = Math.round(G.uwStat('sl', 2, run)), ang = G.uwStat('sl', 1, run) * Math.PI / 180, L = s.range * 1.15 * scale;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < n; i++) {
                const a = run.spotA + i * TAU / n;
                const gr = ctx.createRadialGradient(ox, oy, 0, ox, oy, L);
                gr.addColorStop(0, 'rgba(255,250,225,0.30)'); gr.addColorStop(0.6, 'rgba(255,240,190,0.11)'); gr.addColorStop(1, 'rgba(255,235,170,0)');
                ctx.fillStyle = gr;
                ctx.beginPath(); ctx.moveTo(ox, oy); ctx.arc(ox, oy, L, a - ang / 2, a + ang / 2); ctx.closePath(); ctx.fill();
                ctx.beginPath(); ctx.moveTo(ox, oy); ctx.arc(ox, oy, L * 0.9, a - ang * 0.15, a + ang * 0.15); ctx.closePath(); ctx.fill();
                for (const side of [-1, 1]) {
                    const ea = a + side * ang / 2, eg = ctx.createLinearGradient(ox, oy, ox + Math.cos(ea) * L, oy + Math.sin(ea) * L);
                    eg.addColorStop(0, 'rgba(255,245,200,0.5)'); eg.addColorStop(1, 'rgba(255,245,200,0)');
                    ctx.strokeStyle = eg; ctx.lineWidth = 1.2;
                    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(ea) * L, oy + Math.sin(ea) * L); ctx.stroke();
                }
                ctx.fillStyle = '#fff6d0';
                for (let j = 0; j < 7; j++) {
                    const f = (t * 0.22 + j / 7 + i * 0.13) % 1, da = Math.sin(j * 7.3 + i * 2.1) * ang * 0.42, d = (0.15 + 0.85 * f) * L;
                    ctx.globalAlpha = Math.sin(f * Math.PI) * 0.7;
                    circle(ox + Math.cos(a + da) * d, oy + Math.sin(a + da) * d, 1.3); ctx.fill();
                }
                ctx.globalAlpha = 1;
            }
            ctx.restore();
        }
        // poison swamps: a wobbling toxic pool with bubbles that rise and pop and fumes drifting off
        for (const p of run.swamps) {
            const x = X(p.x), y = Y(p.y), r = p.r * scale, k = Math.min(1, p.t * 1.5), seed = Math.abs(p.x * 3.7 + p.y * 1.3);
            const blob = (rr) => {
                ctx.beginPath();
                for (let i = 0; i <= 32; i++) {
                    const a = i * TAU / 32, w = rr * (1 + 0.06 * Math.sin(a * 3 + t * 1.3 + seed) + 0.04 * Math.sin(a * 5 - t * 0.9 + seed));
                    i ? ctx.lineTo(x + Math.cos(a) * w, y + Math.sin(a) * w) : ctx.moveTo(x + Math.cos(a) * w, y + Math.sin(a) * w);
                }
                ctx.closePath();
            };
            const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
            gr.addColorStop(0, 'rgba(170,255,90,0.34)'); gr.addColorStop(0.6, 'rgba(90,210,40,0.2)'); gr.addColorStop(1, 'rgba(40,150,20,0.1)');
            ctx.globalAlpha = k; blob(r); ctx.fillStyle = gr; ctx.fill();
            blob(r); neon('#7dff4a', 1.4, 5, k);
            blob(r * 0.68); ctx.globalAlpha = 0.3 * k; ctx.strokeStyle = '#c8ff9a'; ctx.lineWidth = 1; ctx.stroke();
            for (let i = 0; i < 10; i++) {
                const ph = t * 0.8 + i * 0.29 + seed, f = ph % 1, cyc = Math.floor(ph);
                const a = i * 2.4 + cyc * 1.3, d = r * (0.1 + 0.65 * ((i * 0.37 + cyc * 0.61) % 1));
                const bx = x + Math.cos(a) * d, by = y + Math.sin(a) * d;
                if (f < 0.8) { ctx.globalAlpha = k * (0.4 + f * 0.6); circle(bx, by, 1.2 + f * 3); ctx.fillStyle = 'rgba(190,255,130,0.25)'; ctx.fill(); ctx.strokeStyle = '#c8ff9a'; ctx.lineWidth = 1; ctx.stroke(); }
                else { ctx.globalAlpha = k * (1 - f) * 5; circle(bx, by, 4 + (f - 0.8) * 30); ctx.strokeStyle = '#e2ffc8'; ctx.lineWidth = 1; ctx.stroke(); }
            }
            ctx.fillStyle = '#9dff5a';
            for (let i = 0; i < 5; i++) {
                const f = (t * 0.3 + i / 5 + seed) % 1;
                ctx.globalAlpha = 0.12 * (1 - f) * k;
                circle(x + Math.sin(i * 1.7 + t * 0.8) * r * 0.5, y - f * r * 0.9, r * 0.18 * (0.5 + f)); ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
        // black holes: the pull radius drawn to scale, spiral arms and debris falling into a glowing photon ring round a black core
        for (const h of run.holes) {
            const x = X(h.x), y = Y(h.y), r = h.r * scale, k = Math.min(1, h.t * 2, ((h.max || h.t) - h.t) * 4 + 0.15);
            ctx.globalAlpha = k;
            const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
            gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.2, 'rgba(0,0,0,1)'); gr.addColorStop(0.32, 'rgba(45,12,90,0.85)'); gr.addColorStop(0.65, 'rgba(110,40,200,0.25)'); gr.addColorStop(1, 'rgba(150,80,255,0.04)');
            ctx.fillStyle = gr; circle(x, y, r); ctx.fill();
            ctx.setLineDash([6, 8]); ctx.lineDashOffset = -t * 20;
            circle(x, y, r); ctx.strokeStyle = 'rgba(205,165,255,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();
            ctx.setLineDash([]); ctx.lineDashOffset = 0;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (let arm = 0; arm < 5; arm++) {
                const a0 = t * 1.6 + arm * TAU / 5;
                ctx.beginPath();
                for (let j = 0; j <= 18; j++) { const f = j / 18, a = a0 + f * 3.2, rr = r * (0.95 - f * 0.72); j ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
                ctx.strokeStyle = arm % 2 ? 'rgba(200,140,255,0.4)' : 'rgba(120,80,255,0.35)'; ctx.lineWidth = 2.2; ctx.stroke();
            }
            for (let i = 0; i < 30; i++) {
                const f = (t * 0.45 + i * 0.618) % 1, rr = r * (0.95 - f * 0.72), a = i * 2.4 + f * 5.5 + t * 0.8;
                ctx.globalAlpha = k * f * 0.9;
                ctx.fillStyle = f > 0.75 ? '#ffffff' : f > 0.45 ? '#f0c8ff' : '#b884ff';
                circle(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0.8 + f * 1.4); ctx.fill();
            }
            ctx.globalAlpha = k;
            circle(x, y, r * 0.24); neon('#e9d5ff', 1.6, 7, k);
            ctx.beginPath(); ctx.arc(x, y, r * 0.24, t * 3, t * 3 + 2.2); neon('#ffffff', 2, 4, k);
            ctx.restore();
            ctx.globalAlpha = k; circle(x, y, r * 0.21); ctx.fillStyle = '#000'; ctx.fill();
            ctx.globalAlpha = 1;
        }
        // wall
        if (run.wall) {
            const up = run.wall.hp > 0;
            circle(X(0), Y(0), B.WALL_R * scale);
            if (up) neon(rgba('#d8def0', 0.4 + 0.6 * run.wall.hp / run.wall.max), 3, 4);
            else { ctx.setLineDash([3, 6]); ctx.strokeStyle = 'rgba(200,210,235,0.2)'; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); }
        }
    }

    function drawMines(run) {
        // land mines: little white circles with an X
        for (const m of run.mines) {
            const x = X(m.x), y = Y(m.y);
            circle(x, y, 4); neon('#e8ecff', 1.3, 3);
            ctx.beginPath(); ctx.moveTo(x - 2.4, y - 2.4); ctx.lineTo(x + 2.4, y + 2.4); ctx.moveTo(x + 2.4, y - 2.4); ctx.lineTo(x - 2.4, y + 2.4); ctx.stroke();
        }
        // inner land mines: glowing red spiky balls on a dotted orbit, their cores blinking like a fuse
        if (run.ilms.length) {
            circle(X(0), Y(0), run.ilms[0].r * scale);
            ctx.setLineDash([2, 9]); ctx.lineDashOffset = -t * 10; ctx.strokeStyle = 'rgba(255,90,70,0.3)'; ctx.lineWidth = 1.2; ctx.stroke();
            ctx.setLineDash([]); ctx.lineDashOffset = 0;
        }
        for (const m of run.ilms) {
            const x = X(Math.cos(m.a) * m.r), y = Y(Math.sin(m.a) * m.r), pulse = 0.5 + 0.5 * Math.sin(t * 6 + m.a * 3);
            const gr = ctx.createRadialGradient(x, y, 0, x, y, 15);
            gr.addColorStop(0, `rgba(255,70,60,${(0.25 + pulse * 0.25).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,40,40,0)');
            ctx.fillStyle = gr; circle(x, y, 15); ctx.fill();
            spikes(x, y, 4.2, 7.6, 8, t * 1.5);
            ctx.fillStyle = 'rgba(255,50,70,0.3)'; ctx.fill(); neon('#ff3b4a', 1.4, 3);
            spikes(x, y, 2.4, 4.4, 8, -t * 2.2); neon('#ff9a7a', 0.8, 0);
            circle(x, y, 2.1); ctx.fillStyle = pulse > 0.6 ? '#ffffff' : '#ff8a8a'; ctx.fill();
        }
    }

    /* ---------- enemies: hollow neon shapes, squares tilted like the game ---------- */
    function drawEnemy(e, count) {
        const def = D.ENEMY[e.type], col = ENC[e.type] || def.col;
        const x = X(e.x), y = Y(e.y);
        const r = Math.max(3, def.r * scale / 3.2 * (e.gen ? Math.max(0.45, 1 - e.gen * 0.15) : 1));
        if (e._rot === undefined) e._rot = Math.random() * TAU;
        const rot = e._rot + t * (e.boss ? 0.25 : 0.4);
        const glow = count < 260 ? 3.5 : 0;
        ctx.fillStyle = rgba(col, 0.1);
        switch (e.type) {
            case 'protector':
                poly(x, y, r, 6, rot); ctx.fill(); neon(col, 1.8, glow);
                circle(x, y, 15 * (1 + G.labV('Protector_Radius')) * scale); ctx.setLineDash([4, 5]); ctx.strokeStyle = rgba(col, 0.35); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
                break;
            case 'boss':
                poly(x, y, r, 4, rot); ctx.fill(); neon(col, 3, 5);
                poly(x, y, r * 0.55, 4, -rot); neon(col, 2, 0);
                break;
            case 'vampire': poly(x, y, r, 4, Math.PI / 4 + rot * 0.3); ctx.fill(); neon(col, 2, glow); poly(x, y, r * 0.45, 4, Math.PI / 4); neon(col, 1.2, 0); break;
            case 'ray':
                poly(x, y, r, 3, rot); ctx.fill(); neon(col, 2, glow);
                if (e.charge > 0) { ctx.beginPath(); ctx.arc(x, y, r + 4, -Math.PI / 2, -Math.PI / 2 + TAU * e.charge / 30); neon('#ffe680', 1.5, 2); }
                break;
            case 'scatter': poly(x, y, r, 5, rot); ctx.fill(); neon(col, 2, glow); break;
            case 'saboteur': case 'commander': case 'overcharge':
                poly(x, y, r, 6, rot); ctx.fill(); neon(col, 2.4, 4); poly(x, y, r * 0.6, 6, -rot); neon(col, 1.4, 0); break;
            default:
                poly(x, y, r, 4, rot); ctx.fill(); neon(col, e.type === 'tank' ? 2.4 : 1.8, glow);
                if (e.elite) { poly(x, y, r * 0.5, 4, rot); neon(col, 1.2, 0); }
        }
        ctx.lineWidth = 1;
        if (e.mark) { circle(x, y, r + 4); ctx.strokeStyle = '#ff4d6d'; ctx.stroke(); }
        if (e.protected) { circle(x, y, r + 3); ctx.strokeStyle = 'rgba(90,170,255,0.8)'; ctx.stroke(); }
        if (e.stun > 0 || e.netted > 0) { ctx.strokeStyle = e.netted > 0 ? '#a5f3fc' : '#fde047'; ctx.setLineDash([2, 3]); circle(x, y, r + 5); ctx.stroke(); ctx.setLineDash([]); }
        if (e.burn > 0) { ctx.fillStyle = 'rgba(255,130,40,0.7)'; circle(x, y - r - 3, 1.8); ctx.fill(); }
        if (e.armor > 0) { ctx.fillStyle = '#cbd5e1'; ctx.font = '9px "Exo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('⛨' + e.armor, x, y - r - 5); }
        if (e.boss || e.fleet) {
            const w = Math.max(24, r * 2.6), f = Math.max(0, e.hp / e.maxHp);
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - w / 2, y + r + 6, w, 3);
            ctx.fillStyle = col; ctx.fillRect(x - w / 2, y + r + 6, w * f, 3);
        }
    }

    function drawBursts(fdt) {
        for (let i = parts.length - 1; i >= 0; i--) {
            const p = parts[i];
            p.t += fdt;
            if (p.t >= p.life) { parts.splice(i, 1); continue; }
            p.x += p.vx * fdt; p.y += p.vy * fdt; p.vx *= 0.94; p.vy *= 0.94;
            ctx.globalAlpha = 1 - p.t / p.life;
            ctx.fillStyle = p.col;
            circle(X(p.x), Y(p.y), p.r * 1.6); ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    /* ---------- the tower: a hollow neon hexagon ---------- */
    function drawTower(run, s) {
        const skin = G.skin();
        const r = Math.max(14, B.TOWER_R * scale * 2.5);
        const x = X(0), y = Y(0);
        const gold = run.gtOn > 0;
        const col = run.demon > 0 ? '#ff3b4a' : run.superOn > 0 ? '#ffe14d' : gold ? '#ffc23d' : skin.edge;
        // golden tower: a warm halo, turning golden rays, two counter-rotating rings and sparkles drifting outward
        if (gold) {
            const L = s.range * 0.9 * scale, k = Math.min(1, run.gtOn * 2);
            ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k;
            const halo = ctx.createRadialGradient(x, y, r * 0.5, x, y, L * 0.65);
            halo.addColorStop(0, 'rgba(255,215,90,0.35)'); halo.addColorStop(0.4, 'rgba(255,180,40,0.12)'); halo.addColorStop(1, 'rgba(255,160,0,0)');
            ctx.fillStyle = halo; circle(x, y, L * 0.65); ctx.fill();
            for (let i = 0; i < 16; i++) {
                const a = t * 0.5 + i * TAU / 16, l = L * (i % 2 ? 0.75 : 1) * (0.92 + 0.08 * Math.sin(t * 3 + i));
                const gr = ctx.createLinearGradient(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l);
                gr.addColorStop(0, 'rgba(255,205,70,0.5)'); gr.addColorStop(1, 'rgba(255,200,60,0)');
                ctx.strokeStyle = gr; ctx.lineWidth = i % 2 ? 2 : 5;
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
            }
            ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 25;
            circle(x, y, r * 2.1); ctx.strokeStyle = 'rgba(255,215,100,0.7)'; ctx.lineWidth = 2; ctx.stroke();
            ctx.setLineDash([3, 7]); ctx.lineDashOffset = t * 18;
            circle(x, y, r * 2.6); ctx.strokeStyle = 'rgba(255,190,60,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.setLineDash([]); ctx.lineDashOffset = 0;
            ctx.fillStyle = '#ffeaa0';
            for (let i = 0; i < 16; i++) {
                const f = (t * 0.4 + i / 16) % 1, a = i * 2.4 + Math.floor(t * 0.4 + i / 16) * 1.7, d = r * 1.3 + f * L * 0.55, sz = 3 * (1 - f) + 0.6;
                const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
                ctx.globalAlpha = k * (1 - f);
                ctx.beginPath(); ctx.moveTo(px, py - sz * 1.6); ctx.lineTo(px + sz * 0.4, py); ctx.lineTo(px, py + sz * 1.6); ctx.lineTo(px - sz * 0.4, py); ctx.closePath();
                ctx.moveTo(px - sz * 1.6, py); ctx.lineTo(px, py + sz * 0.4); ctx.lineTo(px + sz * 1.6, py); ctx.lineTo(px, py - sz * 0.4); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
        }
        const sides = skin.sides || 6;
        ctx.shadowColor = col; ctx.shadowBlur = 16;
        poly(x, y, r, sides, sides === 6 ? 0 : -Math.PI / 2 + t * (skin.spin || 0));
        ctx.fillStyle = gold ? 'rgba(120,80,0,0.45)' : skin.fill; ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 2.6; ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1;
        if (run.shield > 0) { circle(x, y, r + 7); neon('#5ef0ff', 1.5, 3); }
        if (run.inv > 0) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.setLineDash([3, 3]); circle(x, y, r + 11); ctx.stroke(); ctx.setLineDash([]); }
        // death ray
        if (run.ray && run.ray.t > 0) {
            for (let k = 0; k < (run.ray.two ? 2 : 1); k++) {
                const a = run.ray.a + k * Math.PI;
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(X(Math.cos(a) * s.range * 1.2), Y(Math.sin(a) * s.range * 1.2));
                neon('#ffe14d', 4, 8);
            }
        }
    }

    // orbs: pink balls on the edge of the range, each with a dotted trail
    function drawOrbs(run, s) {
        const list = run.orbPos || [];
        orbTrail.length = list.length;
        list.forEach((o, i) => {
            const tr = orbTrail[i] || (orbTrail[i] = []);
            tr.unshift({ x: o.x, y: o.y });
            if (tr.length > 9) tr.length = 9;
            for (let k = 1; k < tr.length; k++) { ctx.globalAlpha = 0.6 * (1 - k / tr.length); ctx.fillStyle = o.extra ? '#c9a3ff' : '#ff5fae'; circle(X(tr[k].x), Y(tr[k].y), 1.6); ctx.fill(); }
            ctx.globalAlpha = 1;
            const r = Math.max(3.5, 2.2 * s.orbSize * scale * 0.8);
            circle(X(o.x), Y(o.y), r); ctx.fillStyle = o.extra ? '#c9a3ff' : '#ff5fae'; ctx.fill();
            circle(X(o.x), Y(o.y), r); neon(o.extra ? '#e6d4ff' : '#ffc0de', 1, 3);
        });
        for (const el of run.electrons) { circle(X(el.x), Y(el.y), 2.6); ctx.fillStyle = '#fff38a'; ctx.fill(); }
    }

    // tower shots: bright cyan dots with short trails
    function drawShots(run) {
        const skin = G.skin();
        const col = run.demon > 0 ? '#ff6b6b' : skin.id === 'classic' ? '#7ff6ff' : skin.edge;
        ctx.lineCap = 'round';
        for (const sh of run.shots) {
            if (sh.instant) continue;
            const x = X(sh.x), y = Y(sh.y);
            if (sh._lx !== undefined) {
                const gr = ctx.createLinearGradient(sh._lx, sh._ly, x, y);
                gr.addColorStop(0, 'rgba(127,246,255,0)'); gr.addColorStop(1, rgba(col.length === 7 ? col : '#7ff6ff', 0.75));
                ctx.strokeStyle = gr; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(sh._lx, sh._ly); ctx.lineTo(x, y); ctx.stroke();
            }
            // keep the trail a fixed length behind the shot
            const dx = x - (sh._lx === undefined ? x : sh._lx), dy = y - (sh._ly === undefined ? y : sh._ly), d = Math.hypot(dx, dy);
            if (d > 14 || sh._lx === undefined) { sh._lx = d > 0 ? x - dx / d * 14 : x; sh._ly = d > 0 ? y - dy / d * 14 : y; }
            circle(x, y, 2.2); ctx.fillStyle = '#eaffff'; ctx.fill();
        }
        ctx.lineCap = 'butt';
        for (const p of run.eshots) { circle(X(p.x), Y(p.y), 2.4); ctx.fillStyle = p.kind === 'over' ? '#3ec5ff' : '#ff6b8f'; ctx.fill(); }
        // smart missiles: white darts with a flickering flame and a fading smoke trail, and a fireball where each one ends
        const live = new Set(run.missiles);
        for (const m of lastMissiles) if (!live.has(m)) booms.push({ x: m.x, y: m.y, t: 0 });
        lastMissiles = run.missiles.slice();
        for (const m of run.missiles) {
            const tr = m._tr || (m._tr = []);
            tr.unshift(m.x, m.y);
            if (tr.length > 28) tr.length = 28;
            for (let k = 2; k < tr.length; k += 2) {
                const f = k / tr.length;
                ctx.globalAlpha = 0.4 * (1 - f); ctx.fillStyle = k < 8 ? '#ffb46a' : '#8f96b0';
                circle(X(tr[k]), Y(tr[k + 1]), 1 + f * 3.2); ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.save(); ctx.translate(X(m.x), Y(m.y)); ctx.rotate(m.a || 0);
            const fl = 7 + Math.random() * 6, gr = ctx.createLinearGradient(-3, 0, -3 - fl, 0);
            gr.addColorStop(0, 'rgba(255,245,200,1)'); gr.addColorStop(0.4, 'rgba(255,150,40,0.9)'); gr.addColorStop(1, 'rgba(255,80,20,0)');
            ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(-3, -2.2); ctx.lineTo(-3 - fl, 0); ctx.lineTo(-3, 2.2); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(255,190,110,0.35)'; circle(1, 0, 6); ctx.fill();
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -2.2); ctx.lineTo(-4, 2.2); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#ff9a40'; ctx.beginPath(); ctx.moveTo(-1, -2); ctx.lineTo(-5, -4.2); ctx.lineTo(-4, -1.5); ctx.moveTo(-1, 2); ctx.lineTo(-5, 4.2); ctx.lineTo(-4, 1.5); ctx.fill();
            ctx.restore();
        }
        for (let i = booms.length - 1; i >= 0; i--) {
            const b = booms[i];
            b.t += fdtNow;
            if (b.t > 0.4 || booms.length > 60) { booms.splice(i, 1); continue; }
            const f = b.t / 0.4, x = X(b.x), y = Y(b.y), rr = 4 + f * 14;
            const gr = ctx.createRadialGradient(x, y, 0, x, y, rr);
            gr.addColorStop(0, `rgba(255,250,220,${(1 - f).toFixed(3)})`); gr.addColorStop(0.5, `rgba(255,150,40,${(0.7 * (1 - f)).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,80,20,0)');
            ctx.fillStyle = gr; circle(x, y, rr); ctx.fill();
            circle(x, y, rr * 1.1); neon('#ffb060', 1.2, 2, 1 - f);
            ctx.globalAlpha = 1;
        }
    }

    function drawBeams(run, s) {
        ctx.lineCap = 'round';
        for (const b of run.beams) {
            ctx.globalAlpha = Math.min(1, b.t * 7);
            const x0 = X(b.x0), y0 = Y(b.y0), x1 = X(b.x1), y1 = Y(b.y1);
            if (b.col === 'cl') {
                // chain lightning: a flickering jagged bolt with a blue glow, a side fork and a flash on the struck enemy
                const a = ctx.globalAlpha, len = Math.hypot(x1 - x0, y1 - y0), pts = bolt(x0, y0, x1, y1, 7, 0.3);
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                path(pts);
                ctx.strokeStyle = 'rgba(90,150,255,0.3)'; ctx.lineWidth = 8; ctx.stroke();
                ctx.strokeStyle = 'rgba(150,205,255,0.7)'; ctx.lineWidth = 3; ctx.stroke();
                ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke();
                if (len > 24) {
                    const [fx, fy] = pts[2 + Math.floor(Math.random() * 3)], fa = Math.atan2(y1 - y0, x1 - x0) + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6), fl = len * 0.3;
                    path(bolt(fx, fy, fx + Math.cos(fa) * fl, fy + Math.sin(fa) * fl, 3, 0.4));
                    ctx.strokeStyle = 'rgba(170,215,255,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
                }
                const gr = ctx.createRadialGradient(x1, y1, 0, x1, y1, 12);
                gr.addColorStop(0, 'rgba(230,245,255,0.9)'); gr.addColorStop(1, 'rgba(120,180,255,0)');
                ctx.globalAlpha = a; ctx.fillStyle = gr; circle(x1, y1, 12); ctx.fill();
                ctx.restore();
                continue;
            }
            const col = { ray: '#ffd23d', plasma: '#ff7ae0', guard: '#7dff9a', shot: '#7ff6ff' }[b.col] || '#fff';
            ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
            neon(col, b.col === 'shot' ? 1 : 2.5, b.col === 'shot' ? 2 : 5);
        }
        ctx.globalAlpha = 1; ctx.lineCap = 'butt'; ctx.lineWidth = 1;
    }

    // rings: shockwaves, mine blasts, and the death wave's burst of light streaks
    function drawWaves(run) {
        for (const w of run.waves) {
            if (w.t < 0) continue;
            const cx = X(w.x || 0), cy = Y(w.y || 0), r = w.r * scale;
            if (w.kind === 'death' || w.kind === 'effect') {
                const death = w.kind === 'death';
                if (!w._sp) {
                    const rnd = G.seeded(Math.floor(Math.random() * 1e9)), n = death ? 150 : 70;
                    w._sp = Array.from({ length: n }, () => [rnd() * TAU, 6 + rnd() * (death ? 28 : 14), rnd()]);
                }
                const band = ctx.createRadialGradient(cx, cy, Math.max(0, r - (death ? 34 : 18)), cx, cy, r + 4);
                band.addColorStop(0, 'rgba(0,0,0,0)');
                band.addColorStop(0.75, death ? 'rgba(110,160,255,0.16)' : 'rgba(255,80,120,0.1)');
                band.addColorStop(1, death ? 'rgba(225,238,255,0.45)' : 'rgba(255,140,170,0.3)');
                ctx.fillStyle = band; circle(cx, cy, r + 4); ctx.fill();
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                ctx.lineCap = 'round';
                for (const [a, l, k] of w._sp) {
                    const c = Math.cos(a), sn = Math.sin(a), rr = r - l * 0.5 + (k - 0.5) * 6;
                    ctx.strokeStyle = death ? (k < 0.25 ? 'rgba(255,255,255,0.9)' : k < 0.7 ? 'rgba(150,200,255,0.75)' : 'rgba(90,140,255,0.6)') : 'rgba(255,90,120,0.55)';
                    ctx.lineWidth = death ? 1.2 + k * 1.6 : 1;
                    ctx.beginPath(); ctx.moveTo(cx + c * rr, cy + sn * rr); ctx.lineTo(cx + c * (rr + l), cy + sn * (rr + l)); ctx.stroke();
                }
                ctx.lineCap = 'butt';
                circle(cx, cy, r); ctx.strokeStyle = death ? 'rgba(170,210,255,0.45)' : 'rgba(255,90,120,0.3)'; ctx.lineWidth = death ? 3 : 1.2; ctx.stroke();
                ctx.restore();
                continue;
            }
            const col = { sw: '#e8ecff', mine: '#ffb020', ilm: '#ff5a3d' }[w.kind] || '#ffffff';
            const fade = Math.max(0, 1 - w.r / (w.max || 1));
            if (w.kind !== 'sw') {
                const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, r));
                gr.addColorStop(0, rgba('#fff2d0', 0.5 * fade)); gr.addColorStop(0.6, rgba(col, 0.25 * fade)); gr.addColorStop(1, rgba(col, 0));
                ctx.fillStyle = gr; circle(cx, cy, r); ctx.fill();
            }
            ctx.globalAlpha = fade;
            circle(cx, cy, r); neon(col, w.kind === 'sw' ? 2 : 2.5, 4, fade);
            ctx.globalAlpha = 1;
        }
        ctx.lineWidth = 1;
    }

    // bots: their icon inside dashed rings while they're working (the golden bot's orange rings and coin)
    function drawBots(run, s) {
        const BOT_COL = { flame: '#ff7a2e', thunder: '#8fa8ff', golden: '#ffc23d', amplify: '#ff6fd0', botbot: '#3ee08f' };
        for (const id in run.bots) {
            const b = run.bots[id], def = D.BOT_BY[id], col = BOT_COL[id] || def.col;
            const x = X(b.x), y = Y(b.y);
            if (b.on > 0) {
                const R2 = B.botStat(id, 3) / 2 * (1 + s.range / 200) * scale;
                ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 12;
                for (const f of [1, 0.66, 0.36]) { circle(x, y, R2 * f); ctx.strokeStyle = rgba(col, 0.75 * f + 0.15); ctx.lineWidth = 2; ctx.stroke(); }
                ctx.setLineDash([]); ctx.lineDashOffset = 0;
                ctx.fillStyle = rgba(col, 0.06); circle(x, y, R2); ctx.fill();
            }
            ctx.globalAlpha = b.on > 0 ? 1 : 0.55;
            circle(x, y, 9); ctx.fillStyle = '#0b0b22'; ctx.fill(); neon(col, 1.6, 4);
            icon(def.ic, x, y, 13);
            ctx.globalAlpha = 1;
        }
        // guardian
        if (Object.keys(run.chips).length) {
            const gx = X(Math.cos(t * 0.8) * 9), gy = Y(Math.sin(t * 0.8) * 9 - 2);
            poly(gx, gy, 5, 4, t); ctx.fillStyle = 'rgba(62,224,143,0.25)'; ctx.fill(); neon('#3ee08f', 1.4, 3);
        }
    }

    function drawPickups(run) {
        // recovery packages: small green crosses drifting to the tower
        for (const p of run.packages) {
            ctx.globalAlpha = 1 - p.t / 1.2;
            const x = X(p.x * (1 - p.t)), y = Y(p.y * (1 - p.t));
            ctx.beginPath(); ctx.rect(x - 5, y - 5, 10, 10); neon('#5bff9a', 1.4, 3);
            ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3); ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y); neon('#5bff9a', 1.4, 0);
        }
        ctx.globalAlpha = 1;
        // floating gem: a glowing pink diamond outline
        if (run.gem) {
            const x = X(run.gem.x), y = Y(run.gem.y), s2 = 11 + Math.sin(t * 4) * 1.2;
            ctx.beginPath(); ctx.moveTo(x - s2, y - s2 * 0.35); ctx.lineTo(x - s2 * 0.5, y - s2 * 0.8); ctx.lineTo(x + s2 * 0.5, y - s2 * 0.8); ctx.lineTo(x + s2, y - s2 * 0.35); ctx.lineTo(x, y + s2); ctx.closePath();
            ctx.fillStyle = 'rgba(227,123,255,0.18)'; ctx.fill();
            ctx.shadowColor = '#e37bff'; ctx.shadowBlur = 14; neon('#f0a8ff', 2, 4); ctx.shadowBlur = 0;
        }
    }

    function drawText(run, fdt) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        // "$2" pop-ups over kills
        ctx.font = '600 11px "Exo 2", sans-serif';
        for (let i = pops.length - 1; i >= 0; i--) {
            const p = pops[i];
            p.t += fdt;
            if (p.t > 1.1) { pops.splice(i, 1); continue; }
            ctx.globalAlpha = Math.min(1, (1.1 - p.t) * 2.5);
            ctx.fillStyle = '#5dff7e';
            ctx.fillText(p.txt, X(p.x), Y(p.y) - 10 - p.t * 16);
        }
        // damage numbers and other floaters from the battle
        ctx.font = '600 11px "Exo 2", sans-serif';
        for (const f of run.floaters) { ctx.globalAlpha = 1 - f.t / 0.9; ctx.fillStyle = f.col === '#fff' || !f.col ? '#ffffff' : f.col; ctx.fillText(f.txt, X(f.x), Y(f.y)); }
        ctx.globalAlpha = 1;
    }

    // the UI's vector icons (js/icons.js), falling back to the emoji until the image has loaded
    function icon(e, x, y, size) {
        const img = G.icImg && G.icImg(e);
        if (img && img.complete && img.naturalWidth) { ctx.drawImage(img, x - size / 2, y - size / 2, size, size); return; }
        ctx.font = (size - 2) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(e, x, y);
    }

    G.skin = () => {
        const id = G.S.skins.eq;
        return D.SKINS.find(s => s.id === id) || (id && id.startsWith('ev:') ? eventSkin(id) : D.SKINS[0]);
    };
    function eventSkin(id) {
        const h = G.hash(id);
        const hue = h % 360;
        return { id, n: id.slice(3), fill: `hsla(${hue},55%,12%,0.6)`, edge: `hsl(${hue},90%,68%)`, glow: `hsl(${hue},90%,55%)`, sides: 3 + (h % 6), spin: 0.3 };
    }
    G.skinById = (id) => D.SKINS.find(s => s.id === id) || eventSkin(id);
})();
