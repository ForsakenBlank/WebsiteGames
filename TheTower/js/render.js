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
    function neon(col, w = 1.8, glow = 3.5) {
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.22; ctx.lineWidth = w + glow; ctx.stroke();
        ctx.globalAlpha = 1; ctx.lineWidth = w; ctx.stroke();
    }
    const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

    /* ---------- effects that outlive the enemy: kill bursts and cash pop-ups ---------- */
    const parts = [], pops = [];
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
    G.on('runStart', () => { parts.length = 0; pops.length = 0; orbTrail.length = 0; });

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
        const fdt = dt * (G.S.settings.speed || 1);
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
        // chrono field: a blue-violet haze over the range with a turning clock ring
        if (run.cfOn > 0) {
            const R0 = (s.range + G.labV('Chrono_Field_Range')) * scale;
            const gr = ctx.createRadialGradient(X(0), Y(0), R0 * 0.2, X(0), Y(0), R0);
            gr.addColorStop(0, 'rgba(110,120,255,0.04)'); gr.addColorStop(1, 'rgba(120,140,255,0.16)');
            ctx.fillStyle = gr; circle(X(0), Y(0), R0); ctx.fill();
            ctx.strokeStyle = 'rgba(150,170,255,0.55)'; ctx.lineWidth = 1.5;
            for (let i = 0; i < 24; i++) {
                const a = -t * 0.6 + i * TAU / 24, l = i % 6 ? 5 : 11;
                ctx.beginPath(); ctx.moveTo(X(0) + Math.cos(a) * (R0 - l), Y(0) + Math.sin(a) * (R0 - l)); ctx.lineTo(X(0) + Math.cos(a) * R0, Y(0) + Math.sin(a) * R0); ctx.stroke();
            }
            circle(X(0), Y(0), R0); ctx.stroke();
        }
        // spotlight: soft cones of light sweeping round the tower
        if (run.uw.sl && !run.uwOff.sl) {
            const n = Math.round(G.uwStat('sl', 2, run)), ang = G.uwStat('sl', 1, run) * Math.PI / 180, L = s.range * 1.15 * scale;
            for (let i = 0; i < n; i++) {
                const a = run.spotA + i * TAU / n;
                const gr = ctx.createRadialGradient(X(0), Y(0), 0, X(0), Y(0), L);
                gr.addColorStop(0, 'rgba(255,250,220,0.32)'); gr.addColorStop(1, 'rgba(255,240,180,0.02)');
                ctx.fillStyle = gr;
                ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.arc(X(0), Y(0), L, a - ang / 2, a + ang / 2); ctx.closePath(); ctx.fill();
            }
        }
        // poison swamps: green pools with bubbles
        for (const p of run.swamps) {
            const x = X(p.x), y = Y(p.y), r = p.r * scale;
            const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
            gr.addColorStop(0, 'rgba(120,255,60,0.22)'); gr.addColorStop(1, 'rgba(60,200,40,0.08)');
            ctx.fillStyle = gr; circle(x, y, r); ctx.fill();
            circle(x, y, r); neon('#7dff4a', 1.2, 3);
            for (let i = 0; i < 7; i++) {
                const k = (t * 0.7 + i * 0.37) % 1, a = i * 2.4 + Math.floor(t * 0.7 + i * 0.37) * 1.3;
                ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#b5ff8a'; ctx.lineWidth = 1;
                circle(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6 - k * 6, 1.5 + k * 2.5); ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
        // black holes: a dark core with swirling purple arms
        for (const h of run.holes) {
            const x = X(h.x), y = Y(h.y), r = h.r * scale;
            const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
            gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(10,0,25,0.95)'); gr.addColorStop(0.75, 'rgba(90,30,160,0.35)'); gr.addColorStop(1, 'rgba(150,80,255,0)');
            ctx.fillStyle = gr; circle(x, y, r); ctx.fill();
            ctx.lineWidth = 2;
            for (let k = 0; k < 4; k++) {
                const a0 = t * 2.2 + k * TAU / 4;
                ctx.strokeStyle = k % 2 ? 'rgba(200,150,255,0.7)' : 'rgba(140,90,255,0.55)';
                ctx.beginPath();
                for (let j = 0; j <= 14; j++) { const f = j / 14, a = a0 + f * 2.2, rr = r * (0.95 - f * 0.6); j ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
                ctx.stroke();
            }
            circle(x, y, r * 0.3); ctx.fillStyle = '#000'; ctx.fill();
            circle(x, y, r * 0.3); neon('#d9b8ff', 1, 3);
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
        // inner land mines: red spiky balls circling the tower
        for (const m of run.ilms) {
            const x = X(Math.cos(m.a) * m.r), y = Y(Math.sin(m.a) * m.r);
            spikes(x, y, 4.2, 7.2, 8, t * 1.5);
            ctx.fillStyle = 'rgba(255,50,70,0.25)'; ctx.fill(); neon('#ff3b4a', 1.4, 3);
            circle(x, y, 2); ctx.fillStyle = '#ff8a8a'; ctx.fill();
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
        // golden tower: turning golden rays
        if (gold) {
            const L = s.range * 0.9 * scale;
            for (let i = 0; i < 16; i++) {
                const a = t * 0.5 + i * TAU / 16;
                const gr = ctx.createLinearGradient(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L);
                gr.addColorStop(0, 'rgba(255,200,60,0.45)'); gr.addColorStop(1, 'rgba(255,200,60,0)');
                ctx.strokeStyle = gr; ctx.lineWidth = i % 2 ? 2 : 5;
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.stroke();
            }
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
        // smart missiles: small white darts with an orange exhaust
        for (const m of run.missiles) {
            ctx.save(); ctx.translate(X(m.x), Y(m.y)); ctx.rotate(m.a || 0);
            const gr = ctx.createLinearGradient(-16, 0, -3, 0);
            gr.addColorStop(0, 'rgba(255,140,40,0)'); gr.addColorStop(1, 'rgba(255,170,60,0.9)');
            ctx.strokeStyle = gr; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-3, 0); ctx.stroke();
            ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(-4, -2.4); ctx.lineTo(-4, 2.4); ctx.closePath(); ctx.fill();
            ctx.restore();
        }
    }

    function drawBeams(run, s) {
        ctx.lineCap = 'round';
        for (const b of run.beams) {
            ctx.globalAlpha = Math.min(1, b.t * 7);
            const x0 = X(b.x0), y0 = Y(b.y0), x1 = X(b.x1), y1 = Y(b.y1);
            if (b.col === 'cl') {
                // chain lightning: a jagged electric arc that flickers every frame
                ctx.beginPath(); ctx.moveTo(x0, y0);
                const n = 5, dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
                for (let i = 1; i < n; i++) { const f = i / n, off = (Math.random() - 0.5) * Math.min(18, len * 0.35); ctx.lineTo(x0 + dx * f + nx * off, y0 + dy * f + ny * off); }
                ctx.lineTo(x1, y1);
                neon('#d6f0ff', 1.6, 5);
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
                ctx.lineCap = 'round';
                for (const [a, l, k] of w._sp) {
                    const c = Math.cos(a), sn = Math.sin(a), rr = r - l * 0.5 + (k - 0.5) * 6;
                    ctx.strokeStyle = death ? (k < 0.25 ? 'rgba(255,255,255,0.9)' : k < 0.7 ? 'rgba(150,200,255,0.75)' : 'rgba(90,140,255,0.6)') : 'rgba(255,90,120,0.55)';
                    ctx.lineWidth = death ? 1.2 + k * 1.6 : 1;
                    ctx.beginPath(); ctx.moveTo(cx + c * rr, cy + sn * rr); ctx.lineTo(cx + c * (rr + l), cy + sn * (rr + l)); ctx.stroke();
                }
                ctx.lineCap = 'butt';
                circle(cx, cy, r); ctx.strokeStyle = death ? 'rgba(170,210,255,0.35)' : 'rgba(255,90,120,0.25)'; ctx.lineWidth = death ? 3 : 1; ctx.stroke();
                continue;
            }
            const col = { sw: '#e8ecff', mine: '#ffb020', ilm: '#ff5a3d' }[w.kind] || '#ffffff';
            ctx.globalAlpha = Math.max(0, 1 - w.r / (w.max || 1));
            circle(cx, cy, r); neon(col, w.kind === 'sw' ? 2 : 2.5, 4);
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
