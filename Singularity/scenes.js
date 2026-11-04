/* ==========================================================
   SINGULARITY, the little picture of where you are.
   It reacts to your setup: day/night, solar panels, generator
   smoke, lit windows, conquered planets and stars.
   ========================================================== */
(function () {
    'use strict';
    let c, W, H;
    const seeded = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const rr = (x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
    const count = (types) => Eng.S.nodes.reduce((a, n) => a + (types.includes(n.t) ? n.q : 0), 0);

    function sky(day) {
        // day: 0..1 where sin(2πd) > 0 is daytime
        const s = Math.sin(day * Math.PI * 2);
        const k = Math.max(0, Math.min(1, s * 1.6 + 0.3));
        const g = c.createLinearGradient(0, 0, 0, H);
        const dusk = Math.max(0, 1 - Math.abs(s) * 4);
        g.addColorStop(0, `rgb(${10 + 70 * k},${16 + 120 * k},${40 + 180 * k})`);
        g.addColorStop(1, `rgb(${30 + 170 * k + 60 * dusk},${30 + 160 * k + 20 * dusk},${60 + 160 * k - 30 * dusk})`);
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        if (k < 0.6) {
            const R = seeded(3);
            c.fillStyle = '#fff';
            for (let i = 0; i < 40; i++) { c.globalAlpha = (0.6 - k) * (0.4 + R() * 0.6); c.fillRect(R() * W, R() * H * 0.6, 1.2, 1.2); }
            c.globalAlpha = 1;
        }
        // sun or moon travels across
        const a = day * Math.PI * 2, bx = W * 0.5 - Math.cos(a) * W * 0.42, by = H * 0.85 - Math.sin(a) * H * 0.7;
        if (s > -0.1) {
            const sg = c.createRadialGradient(bx, by, 2, bx, by, 34);
            sg.addColorStop(0, 'rgba(255,245,200,1)'); sg.addColorStop(0.3, 'rgba(255,220,140,0.5)'); sg.addColorStop(1, 'rgba(255,220,140,0)');
            c.fillStyle = sg; c.fillRect(bx - 40, by - 40, 80, 80);
        } else {
            const mx = W * 0.5 + Math.cos(a) * W * 0.42, my = H * 0.85 + Math.sin(a) * H * 0.7;
            c.fillStyle = '#e5e7eb'; c.beginPath(); c.arc(mx, my, 7, 0, 7); c.fill();
            c.fillStyle = 'rgba(20,24,40,0.9)'; c.beginPath(); c.arc(mx + 3, my - 2, 6, 0, 7); c.fill();
        }
        return k;
    }

    function shack(t, info) {
        const k = sky(Eng.S.day);
        c.fillStyle = '#2f3b25'; c.beginPath(); c.moveTo(0, H * 0.72);
        for (let x = 0; x <= W; x += 20) c.lineTo(x, H * 0.7 - Math.sin(x * 0.02) * 8 - Math.sin(x * 0.05) * 3);
        c.lineTo(W, H); c.lineTo(0, H); c.fill();
        c.fillStyle = `rgba(0,0,0,${0.5 - k * 0.45})`; c.fillRect(0, 0, W, H);
        const sx = W * 0.38, gy = H * 0.8;
        // scrap pile
        const R = seeded(9);
        for (let i = 0; i < 14; i++) { c.fillStyle = ['#57534e', '#78716c', '#44403c', '#a8a29e'][i % 4]; c.save(); c.translate(sx - 70 + R() * 40, gy - 4 - R() * 14); c.rotate(R() * 3); c.fillRect(-5, -3, 10 + R() * 6, 6); c.restore(); }
        // shack
        c.fillStyle = '#6b4a2b'; c.fillRect(sx, gy - 46, 92, 46);
        c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1;
        for (let x = sx + 8; x < sx + 92; x += 9) { c.beginPath(); c.moveTo(x, gy - 46); c.lineTo(x, gy); c.stroke(); }
        c.fillStyle = '#4b3621'; c.beginPath(); c.moveTo(sx - 8, gy - 44); c.lineTo(sx + 46, gy - 70); c.lineTo(sx + 100, gy - 44); c.fill();
        c.fillStyle = '#7c8794'; c.fillRect(sx + 52, gy - 62, 22, 10);  // tin patch
        // panels on the roof
        const solar = Math.min(3, info.solar);
        for (let i = 0; i < solar; i++) { c.save(); c.translate(sx + 8 + i * 22, gy - 50 - i * 9); c.rotate(-0.45); c.fillStyle = '#1e3a8a'; c.fillRect(0, -6, 20, 9); c.strokeStyle = '#93c5fd'; c.strokeRect(0, -6, 20, 9); c.restore(); }
        // window: glows with laptops
        const glow = Math.min(1, info.compute / 6);
        c.fillStyle = glow > 0 ? `rgba(255,${180 + glow * 40},${90 + glow * 60},${0.5 + glow * 0.5})` : '#1f160d';
        c.fillRect(sx + 14, gy - 34, 22, 16);
        if (glow > 0) { const g = c.createRadialGradient(sx + 25, gy - 26, 2, sx + 25, gy - 26, 40); g.addColorStop(0, `rgba(255,200,120,${0.25 * glow})`); g.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = g; c.fillRect(sx - 20, gy - 70, 90, 80); }
        c.fillStyle = '#3b2a1a'; c.fillRect(sx + 56, gy - 30, 16, 30);
        // generator + smoke
        if (info.gens > 0) {
            c.fillStyle = '#b91c1c'; rr(sx + 104, gy - 14, 22, 14, 2); c.fill();
            if (Eng.P.fuel > 0) for (let i = 0; i < 4; i++) { const p = (t * 0.4 + i / 4) % 1; c.fillStyle = `rgba(160,160,160,${0.35 * (1 - p)})`; c.beginPath(); c.arc(sx + 120 + p * 10, gy - 18 - p * 40, 3 + p * 7, 0, 7); c.fill(); }
        }
        // hotspot mast
        c.strokeStyle = '#94a3b8'; c.lineWidth = 2; c.beginPath(); c.moveTo(sx + 150, gy); c.lineTo(sx + 150, gy - 58); c.stroke();
        c.fillStyle = Math.sin(t * 3) > 0 ? '#ef4444' : '#7f1d1d'; c.beginPath(); c.arc(sx + 150, gy - 60, 2.5, 0, 7); c.fill();
    }

    function garage(t, info) {
        const k = sky(Eng.S.day);
        c.fillStyle = '#3f5e2f'; c.fillRect(0, H * 0.78, W, H);
        c.fillStyle = '#6b7280'; c.fillRect(0, H * 0.86, W, H * 0.14);
        c.fillStyle = `rgba(0,0,0,${0.45 - k * 0.4})`; c.fillRect(0, 0, W, H);
        const gy = H * 0.82, hx = W * 0.22;
        // house
        c.fillStyle = '#d6c7a8'; c.fillRect(hx, gy - 50, 80, 50);
        c.fillStyle = '#7c2d12'; c.beginPath(); c.moveTo(hx - 8, gy - 48); c.lineTo(hx + 40, gy - 78); c.lineTo(hx + 88, gy - 48); c.fill();
        c.fillStyle = k > 0.4 ? '#93c5fd' : '#fde68a'; c.fillRect(hx + 12, gy - 38, 16, 12); c.fillRect(hx + 52, gy - 38, 16, 12);
        // garage with open door and racks
        const gx = hx + 84;
        c.fillStyle = '#cbbd9f'; c.fillRect(gx, gy - 42, 74, 42);
        c.fillStyle = '#57534e'; c.beginPath(); c.moveTo(gx - 4, gy - 40); c.lineTo(gx + 37, gy - 58); c.lineTo(gx + 78, gy - 40); c.fill();
        c.fillStyle = '#111827'; c.fillRect(gx + 8, gy - 32, 58, 32);
        c.fillStyle = '#9ca3af'; c.fillRect(gx + 8, gy - 34, 58, 6);  // door rolled up
        const racks = Math.min(5, Math.ceil(info.compute / 3));
        for (let i = 0; i < racks; i++) {
            c.fillStyle = '#1f2937'; c.fillRect(gx + 12 + i * 11, gy - 26, 9, 26);
            for (let j = 0; j < 4; j++) { c.fillStyle = Math.sin(t * 6 + i * 3 + j * 1.7) > 0.2 ? '#22c55e' : '#14532d'; c.fillRect(gx + 14 + i * 11, gy - 22 + j * 6, 2, 2); }
        }
        const solar = Math.min(3, info.solar);
        for (let i = 0; i < solar; i++) { c.save(); c.translate(hx + 6 + i * 22, gy - 52 - i * 12); c.rotate(-0.55); c.fillStyle = '#1e3a8a'; c.fillRect(0, -5, 22, 8); c.restore(); }
        // power poles
        for (const px of [W * 0.72, W * 0.95]) { c.fillStyle = '#5b3a1e'; c.fillRect(px, gy - 70, 4, 70); c.fillRect(px - 10, gy - 66, 24, 3); }
        c.strokeStyle = 'rgba(30,30,30,0.8)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(gx + 74, gy - 38); c.quadraticCurveTo(W * 0.66, gy - 50, W * 0.72, gy - 66); c.quadraticCurveTo(W * 0.84, gy - 54, W * 0.95, gy - 66); c.stroke();
        // car
        c.fillStyle = '#2563eb'; rr(gx + 90, gy - 4, 40, 12, 4); c.fill(); rr(gx + 98, gy - 12, 22, 9, 3); c.fill();
    }

    function loft(t, info) {
        const k = sky(Eng.S.day);
        // skyline
        const R = seeded(21);
        c.fillStyle = `rgb(${30 + k * 40},${36 + k * 50},${56 + k * 60})`;
        for (let x = 0; x < W; x += 26) { const h = 30 + R() * 50; c.fillRect(x, H * 0.85 - h, 24, h); }
        c.fillStyle = '#374151'; c.fillRect(0, H * 0.85, W, H);
        const bx = W * 0.32, by = H * 0.85, bw = 140, bh = 96;
        c.fillStyle = '#9a3412'; c.fillRect(bx, by - bh, bw, bh);
        c.strokeStyle = 'rgba(0,0,0,0.18)';
        for (let y = by - bh + 6; y < by; y += 6) { c.beginPath(); c.moveTo(bx, y); c.lineTo(bx + bw, y); c.stroke(); }
        const lit = Math.min(12, Math.ceil(info.nodes / 2));
        let w = 0;
        for (let fl = 0; fl < 3; fl++) for (let i = 0; i < 4; i++) {
            const on = w++ < lit;
            c.fillStyle = on ? (k > 0.5 ? '#bfdbfe' : '#fde68a') : '#1e293b';
            c.fillRect(bx + 10 + i * 33, by - bh + 10 + fl * 30, 26, 20);
            if (on && k < 0.5) { c.fillStyle = 'rgba(253,230,138,0.15)'; c.fillRect(bx + 6 + i * 33, by - bh + 6 + fl * 30, 34, 28); }
        }
        c.fillStyle = '#4b5563'; c.fillRect(bx + 14, by - bh - 10, 24, 10); c.fillRect(bx + 100, by - bh - 8, 20, 8);
        c.fillStyle = '#0f172a'; rr(bx + 34, by - bh - 24, 72, 14, 3); c.fill();
        c.fillStyle = '#2dd4bf'; c.font = '700 9px system-ui'; c.textAlign = 'center'; c.fillText('◆ SINGULAR LABS', bx + 70, by - bh - 14);
    }

    function datacenter(t, info) {
        const k = sky(Eng.S.day);
        c.fillStyle = '#2d3a2a'; c.fillRect(0, H * 0.8, W, H);
        const by = H * 0.8, bx = W * 0.12, bw = W * 0.55;
        c.fillStyle = '#cbd5e1'; c.fillRect(bx, by - 46, bw, 46);
        c.fillStyle = '#94a3b8'; c.fillRect(bx, by - 46, bw, 5);
        for (let i = 0; i < 8; i++) {           // rooftop coolers with spinning fans
            const fx = bx + 14 + i * (bw - 28) / 7;
            c.fillStyle = '#64748b'; c.fillRect(fx - 9, by - 58, 18, 12);
            c.save(); c.translate(fx, by - 52); c.rotate(t * 8 + i); c.strokeStyle = '#e2e8f0'; c.lineWidth = 1.5;
            for (let b = 0; b < 3; b++) { c.rotate(2.09); c.beginPath(); c.moveTo(0, 0); c.lineTo(5, 0); c.stroke(); } c.restore();
        }
        for (let i = 0; i < 18; i++) { c.fillStyle = Math.sin(t * 5 + i * 2.3) > 0.4 ? '#38bdf8' : '#0c4a6e'; c.fillRect(bx + 8 + i * (bw - 16) / 18, by - 26, 3, 3); }
        c.fillStyle = '#0f172a'; c.fillRect(bx + bw / 2 - 10, by - 20, 20, 20);
        // substation
        const sx = bx + bw + 30;
        c.strokeStyle = '#94a3b8'; c.lineWidth = 2;
        for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(sx + i * 16, by); c.lineTo(sx + i * 16, by - 40); c.moveTo(sx + i * 16 - 6, by - 34); c.lineTo(sx + i * 16 + 6, by - 34); c.stroke(); }
        c.strokeStyle = 'rgba(148,163,184,0.6)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(sx + 32, by - 38); c.lineTo(W, by - 70); c.moveTo(sx + 32, by - 34); c.lineTo(W, by - 64); c.stroke();
        // fence
        c.strokeStyle = 'rgba(148,163,184,0.35)';
        for (let x = 0; x < W; x += 6) { c.beginPath(); c.moveTo(x, by + 4); c.lineTo(x + 6, by + 14); c.stroke(); }
        const sol = Math.min(10, info.solar);
        for (let i = 0; i < sol; i++) { c.fillStyle = '#1e3a8a'; c.fillRect(8 + i * 22, by + 18, 18, 6); }
        c.fillStyle = `rgba(0,0,10,${0.4 - k * 0.38})`; c.fillRect(0, 0, W, H);
    }

    function campus(t, info) {
        const k = sky(Eng.S.day);
        c.fillStyle = '#1f2937'; c.fillRect(0, H * 0.84, W, H);
        const by = H * 0.84;
        const towers = [[W * 0.18, 34, 100], [W * 0.32, 42, 130], [W * 0.5, 30, 84], [W * 0.62, 38, 112]];
        towers.forEach(([x, w, h], i) => {
            const g = c.createLinearGradient(x, by - h, x + w, by);
            g.addColorStop(0, `rgba(${120 + k * 80},${140 + k * 70},${200},0.95)`); g.addColorStop(1, 'rgba(40,50,90,0.95)');
            c.fillStyle = g; c.fillRect(x, by - h, w, h);
            c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.moveTo(x, by - h); c.lineTo(x + w * 0.4, by - h); c.lineTo(x, by - h + w * 0.8); c.fill();
            for (let y = by - h + 8; y < by - 4; y += 8) { c.fillStyle = (Math.sin(y * 3 + i) > 0.2 && k < 0.5) ? 'rgba(253,230,138,0.6)' : 'rgba(15,23,42,0.35)'; c.fillRect(x + 3, y, w - 6, 3); }
        });
        // fusion dome
        if (info.fusion) { c.fillStyle = '#e2e8f0'; c.beginPath(); c.arc(W * 0.85, by, 26, Math.PI, 0); c.fill(); const g = c.createRadialGradient(W * 0.85, by - 10, 2, W * 0.85, by - 10, 30); g.addColorStop(0, `rgba(167,139,250,${0.5 + Math.sin(t * 3) * 0.2})`); g.addColorStop(1, 'rgba(167,139,250,0)'); c.fillStyle = g; c.fillRect(W * 0.85 - 40, by - 50, 80, 50); }
        // drones
        for (let i = 0; i < Math.min(6, 1 + Math.floor(info.robots / 2)); i++) {
            const x = (t * 25 + i * 70) % (W + 40) - 20, y = 20 + i * 9 + Math.sin(t * 2 + i) * 4;
            c.fillStyle = '#e2e8f0'; c.fillRect(x - 4, y, 8, 2); c.fillStyle = Math.sin(t * 9 + i) > 0 ? '#ef4444' : '#22c55e'; c.fillRect(x - 1, y + 2, 2, 2);
        }
        c.fillStyle = `rgba(0,0,15,${0.35 - k * 0.33})`; c.fillRect(0, 0, W, H);
    }

    function orbit(t, info) {
        c.fillStyle = '#02040b'; c.fillRect(0, 0, W, H);
        stars(t, 1);
        const g = c.createRadialGradient(W * 0.5, H * 2.6, H * 1.9, W * 0.5, H * 2.6, H * 2.15);
        g.addColorStop(0, '#1e3a8a'); g.addColorStop(0.85, '#2563eb'); g.addColorStop(0.95, 'rgba(147,197,253,0.6)'); g.addColorStop(1, 'rgba(147,197,253,0)');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        c.strokeStyle = 'rgba(226,232,240,0.7)'; c.lineWidth = 2;
        c.beginPath(); c.ellipse(W * 0.5, H * 0.95, W * 0.48, H * 0.32, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
        const mods = Math.min(14, 3 + info.nodes / 4);
        for (let i = 0; i < mods; i++) {
            const a = Math.PI * 1.08 + (i / mods) * Math.PI * 0.84, x = W * 0.5 + Math.cos(a) * W * 0.48, y = H * 0.95 + Math.sin(a) * H * 0.32;
            c.fillStyle = '#e2e8f0'; c.fillRect(x - 4, y - 3, 8, 6);
            if (i % 3 === 0) { c.fillStyle = '#1d4ed8'; c.fillRect(x - 12, y - 1, 7, 2); c.fillRect(x + 5, y - 1, 7, 2); }
        }
        if (info.rockets) { const p = (t * 0.15) % 1; c.strokeStyle = `rgba(253,186,116,${1 - p})`; c.lineWidth = 2; c.beginPath(); c.moveTo(W * 0.3, H); c.quadraticCurveTo(W * 0.32, H * (1 - p * 0.6), W * 0.36, H * (1 - p * 0.9)); c.stroke(); }
    }

    function sol(t, info) {
        c.fillStyle = '#060402'; c.fillRect(0, 0, W, H);
        stars(t, 0.6);
        const cx = W * 0.5, cy = H * 0.5;
        const g = c.createRadialGradient(cx, cy, 4, cx, cy, 60);
        g.addColorStop(0, '#fff7d6'); g.addColorStop(0.25, '#fbbf24'); g.addColorStop(0.6, 'rgba(251,146,60,0.3)'); g.addColorStop(1, 'rgba(251,146,60,0)');
        c.fillStyle = g; c.fillRect(cx - 70, cy - 70, 140, 140);
        // swarm: one dot per log10 of panels absorbed
        const panels = Eng.S.nodes.reduce((a, n) => a + (n.abs || 0), 0);
        const dots = Math.min(220, Math.floor(Math.log10(1 + panels) * 30));
        const R = seeded(4);
        for (let i = 0; i < dots; i++) {
            const r = 20 + R() * 16, sp = 0.3 + R() * 0.6, a = R() * 7 + t * sp, tilt = R() * 3;
            const x = cx + Math.cos(a) * r * 1.6, y = cy + Math.sin(a) * r * Math.cos(tilt) * 0.6;
            c.fillStyle = '#fde68a'; c.fillRect(x, y, 1.6, 1.6);
        }
        const m = Eng.S.map.sol, list = SG.MAP.sol.list;
        list.forEach((nm, i) => {
            const r = 46 + i * 8, a = i * 2.4 + t * (0.4 / (1 + i * 0.3));
            const x = cx + Math.cos(a) * r * 1.8, y = cy + Math.sin(a) * r * 0.45;
            c.fillStyle = m.got[i] ? '#fbbf24' : m.target === i ? '#f97316' : 'rgba(203,213,225,0.5)';
            c.beginPath(); c.arc(x, y, m.got[i] ? 2.6 : 1.8, 0, 7); c.fill();
        });
    }

    function galaxy(t) {
        c.fillStyle = '#05020c'; c.fillRect(0, 0, W, H);
        const cx = W * 0.5, cy = H * 0.5, R = seeded(8);
        for (let i = 0; i < 700; i++) {
            const arm = i % 2, d = R() * 1, a = arm * Math.PI + d * 6 + t * 0.03 + (R() - 0.5) * 0.5;
            const x = cx + Math.cos(a) * d * W * 0.45, y = cy + Math.sin(a) * d * H * 0.38;
            c.fillStyle = `rgba(${200 + R() * 55},${170 + R() * 60},255,${0.15 + R() * 0.5})`; c.fillRect(x, y, 1.2, 1.2);
        }
        const g = c.createRadialGradient(cx, cy, 2, cx, cy, 30); g.addColorStop(0, 'rgba(255,240,255,0.9)'); g.addColorStop(1, 'rgba(240,171,252,0)');
        c.fillStyle = g; c.fillRect(cx - 30, cy - 30, 60, 60);
        const m = Eng.S.map.galaxy, list = SG.MAP.galaxy.list;
        list.forEach((nm, i) => {
            const d = 0.08 + i / list.length * 0.9, a = (i % 2) * Math.PI + d * 6 + t * 0.03;
            const x = cx + Math.cos(a) * d * W * 0.45, y = cy + Math.sin(a) * d * H * 0.38;
            if (m.got[i]) { c.fillStyle = 'rgba(232,121,249,0.35)'; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); }
            c.fillStyle = m.got[i] ? '#f0abfc' : m.target === i ? '#fb923c' : 'rgba(255,255,255,0.35)';
            c.beginPath(); c.arc(x, y, m.got[i] || m.target === i ? 2.2 : 1.3, 0, 7); c.fill();
        });
    }

    function universe(t) {
        c.fillStyle = '#020205'; c.fillRect(0, 0, W, H);
        const m = Eng.S.map.universe, list = SG.MAP.universe.list, R = seeded(13);
        const pts = list.map(() => [R() * W * 0.9 + W * 0.05, R() * H * 0.8 + H * 0.1]);
        c.lineWidth = 1;
        pts.forEach((p, i) => { const q = pts[(i * 5 + 2) % pts.length], r = pts[(i * 3 + 1) % pts.length];
            c.strokeStyle = m.got[i] && m.got[(i * 5 + 2) % pts.length] ? 'rgba(165,180,252,0.5)' : 'rgba(165,180,252,0.08)';
            c.beginPath(); c.moveTo(...p); c.lineTo(...q); c.moveTo(...p); c.lineTo(...r); c.stroke(); });
        pts.forEach((p, i) => {
            const on = m.got[i];
            if (on) { const g = c.createRadialGradient(p[0], p[1], 1, p[0], p[1], 12); g.addColorStop(0, `hsla(${(t * 30 + i * 40) % 360},90%,75%,0.9)`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(p[0] - 12, p[1] - 12, 24, 24); }
            c.fillStyle = on ? '#fff' : m.target === i ? '#fb923c' : 'rgba(255,255,255,0.3)';
            c.beginPath(); c.arc(p[0], p[1], on ? 2.4 : 1.5, 0, 7); c.fill();
        });
    }

    function stars(t, a) {
        const R = seeded(1);
        c.fillStyle = '#fff';
        for (let i = 0; i < 90; i++) { c.globalAlpha = a * (0.3 + 0.5 * Math.abs(Math.sin(t * 0.8 + i))); c.fillRect(R() * W, R() * H, 1.2, 1.2); }
        c.globalAlpha = 1;
    }

    const SCENES = [shack, garage, loft, datacenter, campus, orbit, sol, galaxy, universe];
    function draw(canvas, t) {
        const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (canvas.width !== Math.round(r.width * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); }
        c = canvas.getContext('2d'); W = r.width; H = r.height;
        if (!W || !H) return;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        const info = {
            nodes: Eng.S.nodes.length,
            compute: count(['laptop', 'gpurig', 'rack', 'rackrow', 'pod', 'hyper', 'ring']),
            solar: count(['solar1', 'solar2', 'solarfarm', 'orbsolar']),
            gens: count(['diesel', 'gasgen', 'turbine']),
            fusion: count(['fusion']), robots: (Eng.S.inv.robot || 0) + count(['robocrew', 'robomine']), rockets: count(['launchpad']),
        };
        (SCENES[Eng.S.site] || shack)(t, info);
    }
    window.Scenes = { draw };
})();
