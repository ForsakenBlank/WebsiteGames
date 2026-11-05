/* ==========================================================
   SINGULARITY, the factory graph (canvas).
   Machines are drawn in the style of the era they come from,
   so a shack laptop still looks taped-together in the datacenter.
   ========================================================== */
(function () {
    'use strict';
    const { ITEMS, NODES } = SG;
    const NW = 184, NH = 104, PORT = 8;
    let cv, c, W = 800, H = 600, dpr = 1;
    const view = { x: 0, y: 0, z: 1 };
    let cb = {};
    const G = { sel: null, selLink: null, placingBp: null, hover: null, multi: new Set(), selMode: false, hl: null };
    let drag = null, ghost = { x: 0, y: 0 }, pointers = new Map(), pinch = null;

    /* ---------- era styles for machine cards ---------- */
    const STY = [
        { // shack: paper card taped to a plank
            bg: '#efe3c6', bg2: '#e2d2ad', ink: '#3b2f1e', sub: '#7a6646', head: '#d9c79e', edge: '#b39b6c', r: 3, font: '"Courier New", ui-monospace, monospace', tape: true, bar: '#b7791f', port: '#5b4630' },
        { // garage: steel plate with rivets and a hazard stripe
            bg: '#3d434b', bg2: '#353a41', ink: Arcade.ui.text, sub: '#aab3bf', head: '#2c3036', edge: '#59616c', r: 5, font: 'Fredoka, sans-serifFredoka, sans-serif', rivets: true, stripe: '#f6c445', bar: '#f2a541', port: '#f6c445' },
        { // loft: clean slate card with a teal accent
            bg: Arcade.ui.surface, bg2: Arcade.ui.surface, ink: '#e8eef8', sub: Arcade.ui.muted, head: Arcade.ui.surface, edge: Arcade.ui.surface2, r: 10, font: 'Fredoka, sans-serifFredoka, sans-serif', accent: '#54c9b4', bar: '#54c9b4', port: '#54c9b4' },
        { // datacenter: navy glass with a cyan edge
            bg: '#0d1a2e', bg2: '#0b1627', ink: '#e0f2fe', sub: '#8ccbee', head: '#10233d', edge: '#1e4a7a', r: 12, font: 'Fredoka, sans-serifFredoka, sans-serif', accent: '#5bb8ea', glow: 'rgba(56,189,248,0.25)', bar: '#5bb8ea', port: '#5bb8ea' },
        { // campus: graphite with violet
            bg: '#17161d', bg2: '#141319', ink: '#f5f3ff', sub: '#c0b2f0', head: '#1f1c29', edge: '#3b3356', r: 14, font: 'Fredoka, sans-serifFredoka, sans-serif', accent: '#a18bec', glow: 'rgba(167,139,250,0.22)', bar: '#a18bec', port: '#a18bec' },
        { // orbit: white hairline on deep blue
            bg: 'rgba(10,18,40,0.86)', bg2: 'rgba(10,18,40,0.86)', ink: Arcade.ui.text, sub: Arcade.ui.muted, head: 'rgba(255,255,255,0.05)', edge: 'rgba(226,232,240,0.55)', r: 16, font: 'Fredoka, sans-serifFredoka, sans-serif', accent: Arcade.ui.text, glow: 'rgba(226,232,240,0.18)', bar: Arcade.ui.text, port: Arcade.ui.text },
        { // sol: gold
            bg: 'rgba(28,18,4,0.88)', bg2: 'rgba(28,18,4,0.88)', ink: '#fffbeb', sub: '#fcd34d', head: 'rgba(251,191,36,0.08)', edge: 'rgba(251,191,36,0.6)', r: 16, font: 'Fredoka, sans-serifFredoka, sans-serif', accent: '#f5b942', glow: 'rgba(251,191,36,0.22)', bar: '#f5b942', port: '#f5b942' },
        { // galaxy: nebula purple
            bg: 'rgba(24,10,40,0.86)', bg2: 'rgba(24,10,40,0.86)', ink: '#fdf4ff', sub: '#e8a8dc', head: 'rgba(240,171,252,0.07)', edge: 'rgba(240,171,252,0.55)', r: 18, font: 'Fredoka, sans-serifFredoka, sans-serif', accent: '#d98ae0', glow: 'rgba(232,121,249,0.22)', bar: '#d98ae0', port: '#e8a8dc' },
        { // universe: iridescent
            bg: 'rgba(6,6,12,0.9)', bg2: 'rgba(6,6,12,0.9)', ink: '#ffffff', sub: '#d4d4f8', head: 'rgba(255,255,255,0.04)', edge: 'iri', r: 20, font: 'Fredoka, sans-serifFredoka, sans-serif', accent: '#a5b4fc', glow: 'rgba(165,180,252,0.25)', bar: 'iri', port: '#ffffff' },
    ];
    const STATUS = {
        ok: ['#4fc07f', 'Working'], flooded: ['#f2a541', '📉 Market flooded, prices down'], idle: [Arcade.ui.dim, 'Waiting for input'], full: ['#f2a541', 'Output full, connect it'], nopower: ['#f2893d', 'Not enough power'],
        hot: ['#ef5b56', 'Overheating, throttled'], broken: ['#ef5b56', 'Broken, click to repair'], off: [Arcade.ui.surface3, 'Switched off'], broke: ['#ef5b56', 'Out of cash'],
        nogrid: [Arcade.ui.dim, 'No grid here'], cut: ['#ef5b56', 'Power company cut you off'], done: [Arcade.ui.dim, 'No model to train'], notarget: ['#f2a541', 'Pick a target on the Map'], night: [Arcade.ui.dim, 'Night'],
    };

    /* ---------- coordinates ---------- */
    const toScreen = (x, y) => [(x - view.x) * view.z + W / 2, (y - view.y) * view.z + H / 2];
    const toWorld = (sx, sy) => [(sx - W / 2) / view.z + view.x, (sy - H / 2) / view.z + view.y];
    function resize() {
        const r = cv.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = r.width; H = r.height;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    const outPort = (n) => [n.x + NW, n.y + NH / 2];
    const inPort = (n) => [n.x, n.y + NH / 2];

    /* ---------- backgrounds ---------- */
    const patterns = {};
    function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    function tile(siteIdx) {
        if (patterns[siteIdx]) return patterns[siteIdx];
        const T = 480, t = document.createElement('canvas'); t.width = T; t.height = T;
        const g = t.getContext('2d'), R = seeded(siteIdx * 99 + 7);
        if (siteIdx === 0) {            // wooden planks
            for (let y = 0; y < T; y += 60) {
                const base = ['#3a2a1b', '#35261a', '#3f2e1d', '#382819'][(y / 60) % 4];
                g.fillStyle = base; g.fillRect(0, y, T, 60);
                for (let k = 0; k < 9; k++) {
                    g.strokeStyle = `rgba(0,0,0,${0.08 + R() * 0.1})`; g.lineWidth = 1 + R() * 1.5;
                    const yy = y + 6 + R() * 48; g.beginPath(); g.moveTo(0, yy);
                    for (let x = 0; x <= T; x += 40) g.lineTo(x, yy + Math.sin(x * 0.02 + k) * 2.5);
                    g.stroke();
                }
                g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, y + 58, T, 2);
                const seam = 120 + ((y / 60) % 3) * 110;
                g.fillRect(seam, y, 2, 60);
                g.fillStyle = 'rgba(20,14,8,0.8)';
                [[seam - 8, y + 10], [seam - 8, y + 48], [seam + 10, y + 10], [seam + 10, y + 48]].forEach(([x, yy]) => { g.beginPath(); g.arc(x, yy, 2, 0, 7); g.fill(); });
                if (R() < 0.5) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(R() * T, y + 30, 6, 3.5, 0, 0, 7); g.fill(); }
            }
        } else if (siteIdx === 1) {     // concrete with painted lines
            g.fillStyle = '#3a3d41'; g.fillRect(0, 0, T, T);
            for (let i = 0; i < 2500; i++) { g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.035)'; g.fillRect(R() * T, R() * T, 1 + R() * 2, 1 + R() * 2); }
            for (let i = 0; i < 3; i++) { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 40 + R() * 40); gr.addColorStop(0, 'rgba(10,10,12,0.35)'); gr.addColorStop(1, 'rgba(10,10,12,0)'); g.save(); g.translate(R() * T, R() * T); g.fillStyle = gr; g.fillRect(-90, -90, 180, 180); g.restore(); }
            g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.strokeRect(0, 0, T, T);
            g.fillStyle = 'rgba(250,204,21,0.22)'; g.fillRect(0, 0, T, 4); g.fillRect(0, 0, 4, T);
        } else if (siteIdx === 2) {     // clean dot grid
            g.fillStyle = Arcade.ui.bg; g.fillRect(0, 0, T, T);
            g.fillStyle = 'rgba(148,163,184,0.16)';
            for (let y = 0; y < T; y += 30) for (let x = 0; x < T; x += 30) { g.beginPath(); g.arc(x, y, 1.3, 0, 7); g.fill(); }
        } else if (siteIdx === 3) {     // raised floor tiles
            g.fillStyle = Arcade.ui.bg2; g.fillRect(0, 0, T, T);
            for (let y = 0; y < T; y += 120) for (let x = 0; x < T; x += 120) {
                g.fillStyle = Arcade.ui.bg; g.fillRect(x + 2, y + 2, 116, 116);
                if ((x / 120 + y / 120) % 3 === 0) { g.fillStyle = 'rgba(56,189,248,0.10)'; for (let a = 12; a < 116; a += 12) for (let b = 12; b < 116; b += 12) g.fillRect(x + a, y + b, 3, 3); }
            }
        } else if (siteIdx === 4) {     // graphite with a fine grid
            g.fillStyle = Arcade.ui.bg2; g.fillRect(0, 0, T, T);
            g.strokeStyle = 'rgba(167,139,250,0.07)'; g.lineWidth = 1;
            for (let k = 0; k <= T; k += 40) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, T); g.moveTo(0, k); g.lineTo(T, k); g.stroke(); }
            g.strokeStyle = 'rgba(167,139,250,0.13)';
            g.beginPath(); g.moveTo(0, 0); g.lineTo(T, 0); g.moveTo(0, 0); g.lineTo(0, T); g.stroke();
        }
        patterns[siteIdx] = g.createPattern ? c.createPattern(t, 'repeat') : null;
        return patterns[siteIdx];
    }
    const stars = Array.from({ length: 260 }, (_, i) => { const R = seeded(i + 11); return { x: R(), y: R(), s: 0.3 + R() * 1.4, d: 0.05 + R() * 0.25, tw: R() * 6 }; });
    function drawBackground(t) {
        const site = Eng.S.site;
        if (site <= 4) {
            const p = tile(site);
            c.save();
            if (p && p.setTransform) {
                p.setTransform(new DOMMatrix([view.z, 0, 0, view.z, W / 2 - view.x * view.z, H / 2 - view.y * view.z]));
                c.fillStyle = p; c.fillRect(0, 0, W, H);
            } else { c.fillStyle = '#111'; c.fillRect(0, 0, W, H); }
            c.restore();
            if (site === 0) {                    // kerosene lamp light, flickering a little
                const f = 0.94 + Math.sin(t * 7.3) * 0.03 + Math.sin(t * 12.1) * 0.02;
                const g = c.createRadialGradient(W * 0.22, H * 0.12, 10, W * 0.22, H * 0.12, Math.max(W, H) * 0.9 * f);
                g.addColorStop(0, 'rgba(255,190,110,0.20)'); g.addColorStop(0.4, 'rgba(255,170,90,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
                c.fillStyle = g; c.fillRect(0, 0, W, H);
            } else if (site === 3) {
                const g = c.createLinearGradient(0, 0, W, 0);
                g.addColorStop(0, 'rgba(56,189,248,0.05)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(239,68,68,0.04)');
                c.fillStyle = g; c.fillRect(0, 0, W, H);
            } else if (site === 4) {
                const g = c.createLinearGradient(0, 0, W, H);
                g.addColorStop(0, 'rgba(167,139,250,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
                c.fillStyle = g; c.fillRect(0, 0, W, H);
            }
            const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
            v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.35)');
            c.fillStyle = v; c.fillRect(0, 0, W, H);
            return;
        }
        // space eras: deep background, parallax stars and a feature per era
        const bgc = [Arcade.ui.bg2, '#0b0703', '#0a0414', Arcade.ui.bg2][site - 5];
        c.fillStyle = bgc; c.fillRect(0, 0, W, H);
        if (site === 5) {
            const g = c.createRadialGradient(W * 0.5, H * 2.1, H * 1.2, W * 0.5, H * 2.1, H * 1.65);
            g.addColorStop(0, 'rgba(56,130,246,0.55)'); g.addColorStop(0.92, 'rgba(96,165,250,0.18)'); g.addColorStop(1, 'rgba(96,165,250,0)');
            c.fillStyle = g; c.fillRect(0, 0, W, H);
        } else if (site === 6) {
            const g = c.createRadialGradient(-W * 0.1, H * 0.5, 10, -W * 0.1, H * 0.5, W * 0.9);
            g.addColorStop(0, 'rgba(255,214,120,0.45)'); g.addColorStop(0.3, 'rgba(251,146,60,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            c.fillStyle = g; c.fillRect(0, 0, W, H);
            c.strokeStyle = 'rgba(251,191,36,0.07)'; c.lineWidth = 1;
            for (let r = 1; r < 6; r++) { c.beginPath(); c.ellipse(-W * 0.1, H * 0.5, W * 0.25 * r, H * 0.2 * r, 0, -1, 1); c.stroke(); }
        } else if (site === 7) {
            for (let k = 0; k < 3; k++) {
                const g = c.createRadialGradient(W * (0.2 + k * 0.33), H * (0.3 + (k % 2) * 0.4), 10, W * (0.2 + k * 0.33), H * (0.3 + (k % 2) * 0.4), W * 0.45);
                g.addColorStop(0, ['rgba(217,70,239,0.16)', 'rgba(99,102,241,0.14)', 'rgba(236,72,153,0.12)'][k]); g.addColorStop(1, 'rgba(0,0,0,0)');
                c.fillStyle = g; c.fillRect(0, 0, W, H);
            }
        } else {
            c.strokeStyle = 'rgba(165,180,252,0.06)'; c.lineWidth = 1;
            const R = seeded(5);
            const pts = Array.from({ length: 40 }, () => [R() * W, R() * H]);
            c.beginPath();
            pts.forEach((p, i) => { const q = pts[(i * 7 + 3) % pts.length]; c.moveTo(p[0], p[1]); c.quadraticCurveTo((p[0] + q[0]) / 2 + 40, (p[1] + q[1]) / 2 - 40, q[0], q[1]); });
            c.stroke();
        }
        for (const s of stars) {
            const x = ((s.x * W * 1.3 - view.x * view.z * s.d) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15;
            const y = ((s.y * H * 1.3 - view.y * view.z * s.d) % (H * 1.3) + H * 1.3) % (H * 1.3) - H * 0.15;
            c.globalAlpha = 0.45 + Math.sin(t * 1.5 + s.tw) * 0.25;
            c.fillStyle = '#fff'; c.fillRect(x, y, s.s, s.s);
        }
        c.globalAlpha = 1;
    }

    /* ---------- drawing machines ---------- */
    function rr(x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
    function iriGrad(x, y, w, h, t) {
        const g = c.createLinearGradient(x, y, x + w, y + h);
        const h0 = (t * 30) % 360;
        g.addColorStop(0, `hsl(${h0},90%,70%)`); g.addColorStop(0.5, `hsl(${h0 + 120},90%,70%)`); g.addColorStop(1, `hsl(${h0 + 240},90%,70%)`);
        return g;
    }
    function ioLine(d) {
        const fmt = Eng.fmt;
        const side = (o) => Object.entries(o).map(([k, v]) => `${ITEMS[k] ? ITEMS[k].icon : ''}${fmt(v)}`).join(' ');
        switch (d.kind) {
            case 'sell': return `sells ${fmt(d.rate)}/s${d.price ? ' · +' + Math.round((d.price - 1) * 100) + '%' : ''}`;
            case 'store': return '→ inventory';
            case 'train': return `🧮${fmt(d.rate.compute)} 📚${fmt(d.rate.data)} /s max`;
            case 'gen': return (d.in.deut ? '💧 → ' : '') + '⚡ ' + Eng.fmtW(-d.w) + (d.solar ? ' ☀️' : '');
            case 'grid': return '🔌 up to ' + Eng.fmtW(d.cap);
            case 'batt': return '🔋 stores power';
            case 'cool': return '❄️ ' + Eng.fmtW(d.cool);
            case 'repair': return '🛠️ fixes machines';
            case 'launch': return `${ITEMS[Object.keys(d.in)[0]].icon} → 🗺️ map`;
            case 'dyson': return '🔆 → ⚡ forever';
        }
        const a = side(d.in), b = side(d.out);
        return (a ? a + ' → ' : '') + b + ` /${Eng.fmt(d.time)}s`;
    }
    const ic = (k) => (ITEMS[k] ? ITEMS[k].icon : k === 'store' ? '📦' : '');
    // left: what is waiting inside; right: what comes out per second
    function liveIO(n, d) {
        const f = Eng.fmt;
        let left = '', right = '';
        const ins = d.kind === 'proc' || d.kind === 'gen' || d.kind === 'launch' ? Object.keys(d.in) : Object.keys(n.ib).filter(k => n.ib[k] > 0.01);
        if (d.kind === 'train') ['compute', 'data', 'labels'].forEach(k => { if (n.ib[k] > 0.01 && !ins.includes(k)) ins.push(k); });
        left = ins.slice(0, 3).map(k => `${ic(k)}${f(n.ib[k] || 0)}`).join(' ');
        const pr = n.pr || {};
        if (d.kind === 'sell') right = pr.cash ? `+$${f(pr.cash)}/s` : '';
        else if (d.kind === 'store') { const t = Object.keys(pr).reduce((a, k) => a + pr[k], 0); right = t ? `${f(t)}/s 📦` : ''; }
        else if (d.kind === 'train') right = pr.compute || pr.data ? `→ 🧠 ${f((pr.compute || 0))}/s` : '';
        else if (d.kind === 'gen') right = d.solar ? Eng.fmtW(-d.w * n.q * Eng.P.sun) : '';
        else right = Object.keys(d.out).map(k => pr[k] ? (k === 'cash' ? `$${f(pr[k])}/s` : `${ic(k)}${f(pr[k])}/s`) : '').filter(Boolean).slice(0, 2).join(' ');
        return [left, right];
    }
    function fitText(t, w) { while (c.measureText(t).width > w && t.length > 3) t = t.slice(0, -2) + '…'; return t; }
    function drawNode(n, t) {
        const d = NODES[n.t], s = STY[Math.min(8, d.site)];
        const [x, y] = [n.x, n.y];
        const sel = G.sel === n, multi = G.multi.has(n.id);
        c.save();
        if (s.glow) { }
        else { c.shadowOffsetY = 4; }
        c.fillStyle = s.bg; rr(x, y, NW, NH, s.r); c.fill();
        c.restore();
        c.save();
        rr(x, y, NW, NH, s.r); c.clip();
        c.fillStyle = s.head; c.fillRect(x, y, NW, 28);
        if (s.stripe) { for (let k = -2; k < 14; k++) { c.fillStyle = k % 2 ? '#1f2328' : s.stripe; c.beginPath(); c.moveTo(x + k * 14, y + 28); c.lineTo(x + k * 14 + 14, y + 28); c.lineTo(x + k * 14 + 20, y + 24); c.lineTo(x + k * 14 + 6, y + 24); c.fill(); } }
        if (s.accent && !s.stripe) { c.fillStyle = s.accent; c.globalAlpha = 0.9; c.fillRect(x, y, 4, NH); c.globalAlpha = 1; }
        // the live numbers sit on a darker band
        c.fillStyle = 'rgba(0,0,0,0.13)'; c.fillRect(x, y + 50, NW, 20);
        const prog = d.kind === 'proc' ? Math.min(1, n.p) : d.kind === 'batt' ? (Eng.P.battCap ? Eng.S.batt / Eng.P.battCap : 0) : n.act;
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + 10, y + NH - 12, NW - 20, 4);
        c.fillStyle = s.bar === 'iri' ? iriGrad(x, y, NW, NH, t) : s.bar; c.fillRect(x + 10, y + NH - 12, (NW - 20) * Math.max(0, prog), 4);
        c.restore();
        c.lineWidth = sel ? 2.5 : 1.2;
        c.strokeStyle = sel ? (s.accent || '#f5b942') : s.edge === 'iri' ? iriGrad(x, y, NW, NH, t) : s.edge;
        if (n.br) c.strokeStyle = '#ef5b56';
        rr(x, y, NW, NH, s.r); c.stroke();
        if (multi) { c.save(); c.setLineDash([7, 5]); c.lineDashOffset = -t * 20; c.strokeStyle = '#f5b942'; c.lineWidth = 2.5; rr(x - 5, y - 5, NW + 10, NH + 10, s.r + 4); c.stroke(); c.restore(); }
        if (s.tape) {
            c.fillStyle = 'rgba(253,246,178,0.55)';
            c.save(); c.translate(x + NW / 2, y - 2); c.rotate(-0.04); c.fillRect(-22, -6, 44, 12); c.restore();
        }
        if (s.rivets) { c.fillStyle = '#8b939e'; [[6, 6], [NW - 6, 6], [6, NH - 6], [NW - 6, NH - 6]].forEach(([a, b]) => { c.beginPath(); c.arc(x + a, y + b, 2, 0, 7); c.fill(); }); }
        if (view.z < 0.42) {
            c.font = '34px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText(d.icon, x + NW / 2, y + NH / 2);
            c.textBaseline = 'alphabetic';
        } else {
            c.textAlign = 'left'; c.textBaseline = 'middle';
            c.font = '15px Fredoka, sans-serif'; c.fillStyle = s.ink; c.fillText(d.icon, x + 10, y + 14);
            c.font = `700 12.5px ${s.font}`; c.fillStyle = s.ink;
            c.fillText(fitText(d.name, NW - 86), x + 32, y + 15);
            const q = '×' + Eng.fmt(n.q);
            c.font = `700 11px ${s.font}`;
            const qw = c.measureText(q).width + 10;
            c.fillStyle = 'rgba(0,0,0,0.22)'; rr(x + NW - qw - 22, y + 7, qw, 16, 8); c.fill();
            c.fillStyle = s.ink; c.textAlign = 'center'; c.fillText(q, x + NW - qw / 2 - 22, y + 15.5);
            const stc = (STATUS[n.st] || STATUS.idle)[0];
            c.fillStyle = stc; c.beginPath(); c.arc(x + NW - 11, y + 15, 4.5, 0, 7); c.fill();
            if (n.st === 'ok' && s.glow) { c.globalAlpha = 0.35 + Math.sin(t * 4 + n.id) * 0.2; c.beginPath(); c.arc(x + NW - 11, y + 15, 8, 0, 7); c.fill(); c.globalAlpha = 1; }
            c.textAlign = 'left';
            c.font = `500 11px ${s.font}`; c.fillStyle = s.sub;
            c.fillText(fitText(ioLine(d), NW - 20), x + 10, y + 40);
            // live numbers: stored inputs on the left, output per second on the right
            const [lt, rt] = liveIO(n, d);
            c.font = `700 11.5px ${s.font}`; c.fillStyle = s.ink;
            c.textAlign = 'right';
            const rw = Math.min(NW - 30, c.measureText(rt).width);
            c.fillText(fitText(rt, NW - 30), x + NW - 12, y + 60);
            c.textAlign = 'left';
            c.fillStyle = s.sub;
            if (lt) c.fillText(fitText(lt, NW - 34 - rw), x + 12, y + 60);
            c.font = `600 11px ${s.font}`;
            let info = '';
            if (n.br) { c.fillStyle = '#ef5b56'; info = '🔧 BROKEN, click to repair'; }
            else if (d.kind === 'dyson') { c.fillStyle = s.ink; info = `${Eng.fmt(n.abs)} panels · ${Eng.fmtW(n.abs * 5e16)}`; }
            else if (d.kind === 'batt') { c.fillStyle = s.ink; info = `${Math.round((Eng.P.battCap ? Eng.S.batt / Eng.P.battCap : 0) * 100)}% charged`; }
            else { const S2 = STATUS[n.st] || STATUS.idle; c.fillStyle = S2[0] === '#4fc07f' ? s.ink : S2[0]; info = S2[1]; }
            if (n.c < 0.5 && !n.br) info += ` · ${Math.round(n.c * 100)}% condition`;
            c.fillText(fitText(info, NW - 20), x + 10, y + 82);
            c.textBaseline = 'alphabetic';
        }
        if (d.wear > 0 && n.c < 0.999 && !n.br) {
            c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x + 10, y + NH - 6, NW - 20, 2);
            c.fillStyle = n.c > 0.5 ? '#4fc07f' : n.c > 0.25 ? '#f2a541' : '#ef5b56'; c.fillRect(x + 10, y + NH - 6, (NW - 20) * n.c, 2);
        }
        const hasIn = d.kind === 'sell' || d.kind === 'store' || d.kind === 'train' || d.kind === 'dyson' || Object.keys(d.in).length > 0;
        const hasOut = Object.keys(d.out).some(it => !ITEMS[it].cur);
        if (hasIn) port(...inPort(n), s.port, false);
        if (hasOut) port(...outPort(n), s.port, true);
    }
    function port(x, y, col, out) {
        c.fillStyle = Arcade.ui.bg2; c.beginPath(); c.arc(x, y, PORT, 0, 7); c.fill();
        c.strokeStyle = col; c.lineWidth = 2.5; c.stroke();
        if (out) { c.fillStyle = col; c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); }
    }
    // pulsing ring the tutorial uses to point at things
    function beacon(x, y, r, t) {
        const k = (t * 1.2) % 1;
        c.save();
        c.strokeStyle = `rgba(251,191,36,${1 - k})`; c.lineWidth = 3;
        c.beginPath(); c.arc(x, y, r + k * 22, 0, 7); c.stroke();
        c.strokeStyle = '#f5b942'; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
        c.restore();
    }

    /* ---------- cables ---------- */
    function bez(a, b) {
        const dx = Math.max(40, Math.abs(b[0] - a[0]) * 0.5);
        return [a, [a[0] + dx, a[1]], [b[0] - dx, b[1]], b];
    }
    function bpt(p, t) {
        const u = 1 - t;
        return [u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
                u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]];
    }
    const STREAM = 6;     // items per second above which a cable shows a steady stream instead of dots
    function curve(p) { c.beginPath(); c.moveTo(...p[0]); c.bezierCurveTo(...p[1], ...p[2], ...p[3]); }
    function drawLink(l, t, site, idx) {
        const A = idx.get(l.a), B = idx.get(l.b);
        if (!A || !B) return;
        const p = bez(outPort(A), inPort(B));
        const active = l.flow > 0.01;
        const col = active && l.it ? ITEMS[l.it].col : site === 0 ? '#8a7350' : '#5b6684';
        const sel = G.selLink === l;
        c.lineCap = 'round';
        c.strokeStyle = sel ? '#f5b942' : 'rgba(0,0,0,0.45)'; c.lineWidth = sel ? 7 : 6;
        curve(p); c.stroke();
        if (active && l.flow >= STREAM) {
            // heavy traffic: a solid stream, thicker the more it carries, with a slow shimmer
            const w = Math.min(7, 3 + Math.log10(l.flow) * 1.2);
            c.strokeStyle = col; c.globalAlpha = 0.55; c.lineWidth = w + 2; curve(p); c.stroke();
            c.globalAlpha = 1; c.lineWidth = w;
            c.setLineDash([16, 10]); c.lineDashOffset = -t * (40 + 12 * Math.log10(l.flow));
            if (site >= 3) { }
            curve(p); c.stroke();
            c.setLineDash([]); 
        } else {
            c.strokeStyle = col; c.globalAlpha = active ? 0.9 : 0.5; c.lineWidth = site >= 3 ? 2.5 : 3.5;
            curve(p); c.stroke();
            c.globalAlpha = 1;
            if (active) {
                const sp = 0.25 + 0.12 * Math.log10(1 + l.flow);
                const nDots = Math.max(1, Math.min(5, Math.round(l.flow)));
                for (let i = 0; i < nDots; i++) {
                    const k = ((t * sp + i / nDots) % 1 + 1) % 1, q = bpt(p, k);
                    c.fillStyle = col;
                    if (site >= 3) { }
                    c.beginPath(); c.arc(q[0], q[1], 3.6, 0, 7); c.fill();
                }
            }
        }
        if ((active || l.f) && view.z >= 0.45) labels.push([l, bpt(p, 0.5), active, col]);
    }
    let labels = [];
    // rate labels go on top of everything so machines never hide them
    function drawLabel([l, m, active, col]) {
        {
            const txt = (l.f && !active ? ITEMS[l.f].icon + ' only' : `${l.f ? '⛃ ' : ''}${ITEMS[l.it] ? ITEMS[l.it].icon : ''} ${Eng.fmt(l.flow)}/s`);
            c.font = '700 11px Fredoka, sans-serif';
            const w = c.measureText(txt).width + 12;
            c.fillStyle = 'rgba(10,12,20,0.82)'; rr(m[0] - w / 2, m[1] - 10, w, 20, 10); c.fill();
            c.strokeStyle = l.f ? ITEMS[l.f].col : col; c.lineWidth = 1.2; c.stroke();
            c.fillStyle = Arcade.ui.text; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, m[0], m[1] + 0.5); c.textBaseline = 'alphabetic';
        }
    }
    function linkHit(wx, wy) {
        let best = null, bd = 9 / view.z;
        for (const l of Eng.S.links) {
            const A = Eng.byId(l.a), B = Eng.byId(l.b);
            if (!A || !B) continue;
            const p = bez(outPort(A), inPort(B));
            for (let i = 0; i <= 24; i++) {
                const q = bpt(p, i / 24), dd = Math.hypot(q[0] - wx, q[1] - wy);
                if (dd < bd) { bd = dd; best = l; }
            }
        }
        return best;
    }
    function nodeAt(wx, wy) {
        const ns = Eng.S.nodes;
        for (let i = ns.length - 1; i >= 0; i--) { const n = ns[i]; if (wx >= n.x - PORT && wx <= n.x + NW + PORT && wy >= n.y && wy <= n.y + NH) return n; }
        return null;
    }
    function outPortAt(wx, wy) {
        const r = Math.max(PORT + 4, 12 / view.z);
        for (const n of Eng.S.nodes) {
            const d = NODES[n.t];
            if (!Object.keys(d.out).some(it => !ITEMS[it].cur)) continue;
            const [px, py] = outPort(n);
            if (Math.hypot(px - wx, py - wy) <= r) return n;
        }
        return null;
    }

    /* ---------- blueprint ghost ---------- */
    function bpBounds(bp) {
        let w = 0, h = 0;
        bp.nodes.forEach(b => { w = Math.max(w, b.x + NW); h = Math.max(h, b.y + NH); });
        return [w, h];
    }
    function bpOrigin() {
        const [w, h] = bpBounds(G.placingBp.bp);
        return [Math.round((ghost.x - w / 2) / 10) * 10, Math.round((ghost.y - h / 2) / 10) * 10];
    }
    function drawBpGhost() {
        const { bp, full } = G.placingBp;
        const [ox, oy] = bpOrigin();
        const err = Eng.bpProblem(bp, full);
        const col = err ? '#ef5b56' : '#f5b942';
        c.save();
        c.globalAlpha = 0.85;
        c.strokeStyle = col; c.lineWidth = 2.5;
        bp.links.forEach(l => { const a = bp.nodes[l.a], b = bp.nodes[l.b]; if (!a || !b) return; curve(bez([ox + a.x + NW, oy + a.y + NH / 2], [ox + b.x, oy + b.y + NH / 2])); c.stroke(); });
        bp.nodes.forEach(b => {
            c.fillStyle = 'rgba(15,23,42,0.75)'; rr(ox + b.x, oy + b.y, NW, NH, 10); c.fill();
            c.setLineDash([6, 5]); c.strokeStyle = col; c.stroke(); c.setLineDash([]);
            c.fillStyle = '#fff'; c.font = '700 13px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText(`${NODES[b.t].icon} ${NODES[b.t].name}${full && b.q > 1 ? ' ×' + b.q : ''}`, ox + b.x + NW / 2, oy + b.y + NH / 2);
        });
        const [w] = bpBounds(bp);
        c.font = '700 13px Fredoka, sans-serif'; c.fillStyle = col;
        c.fillText(err || `Click to place “${bp.name}” · Esc to cancel`, ox + w / 2, oy - 18);
        c.textBaseline = 'alphabetic';
        c.restore();
    }

    /* ---------- frame ---------- */
    function draw(t) {
        if (!cv) return;
        const S = Eng.S;
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawBackground(t);
        c.setTransform(dpr * view.z, 0, 0, dpr * view.z, dpr * (W / 2 - view.x * view.z), dpr * (H / 2 - view.y * view.z));
        const idx = new Map();
        for (const n of S.nodes) idx.set(n.id, n);
        labels = [];
        for (const l of S.links) drawLink(l, t, S.site, idx);
        if (drag && drag.kind === 'link') {
            const A = drag.from, a = outPort(A), b = [drag.wx, drag.wy];
            c.setLineDash([8, 6]); c.strokeStyle = '#f5b942'; c.lineWidth = 2.5;
            curve(bez(a, b)); c.stroke(); c.setLineDash([]);
            const tgt = nodeAt(drag.wx, drag.wy);
            if (tgt && tgt !== A) {
                const ok = Eng.producible(A).some(it => Eng.accepts(tgt, it));
                c.strokeStyle = ok ? '#4fc07f' : '#ef5b56'; c.lineWidth = 3;
                rr(tgt.x - 4, tgt.y - 4, NW + 8, NH + 8, 14); c.stroke();
            }
        }
        const x0 = view.x - W / 2 / view.z - NW, x1 = view.x + W / 2 / view.z, y0 = view.y - H / 2 / view.z - NH, y1 = view.y + H / 2 / view.z;
        for (const n of S.nodes) if (n.x > x0 && n.x < x1 && n.y > y0 && n.y < y1) drawNode(n, t);
        labels.forEach(drawLabel);
        // tutorial pointer
        if (G.hl && (G.hl.port || G.hl.node)) {
            const n = S.nodes.find(m => m.t === (G.hl.port || G.hl.node));
            if (n) { if (G.hl.port) beacon(...outPort(n), 12, t); else beacon(n.x + NW / 2, n.y + NH / 2, NW * 0.6, t); }
        }
        if (drag && drag.kind === 'box') {
            const bx = Math.min(drag.wx0, drag.wx), by = Math.min(drag.wy0, drag.wy);
            c.fillStyle = 'rgba(251,191,36,0.08)'; c.fillRect(bx, by, Math.abs(drag.wx - drag.wx0), Math.abs(drag.wy - drag.wy0));
            c.setLineDash([7, 5]); c.strokeStyle = '#f5b942'; c.lineWidth = 1.5 / view.z; c.strokeRect(bx, by, Math.abs(drag.wx - drag.wx0), Math.abs(drag.wy - drag.wy0)); c.setLineDash([]);
        }
        if (G.placingBp) drawBpGhost();
    }

    /* ---------- input ---------- */
    function evPos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    function changed() { cb.onSelect && cb.onSelect(); }
    function down(e) {
        cv.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, evPos(e));
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: view.z };
            drag = null; return;
        }
        const [sx, sy] = evPos(e), [wx, wy] = toWorld(sx, sy);
        if (e.button === 2) { if (G.placingBp) { G.placingBp = null; changed(); } return; }
        if (G.placingBp) {
            const [ox, oy] = bpOrigin();
            const r = Eng.placeBp(G.placingBp.bp, ox, oy, G.placingBp.full);
            if (r.err) { cb.toast(r.err, 'bad'); Arcade.sfx('bad'); }
            else {
                Arcade.sfx('level');
                G.multi = new Set(r.nodes.map(n => n.id)); G.sel = null; G.selLink = null;
                if (!e.shiftKey) G.placingBp = null;
                changed();
            }
            return;
        }
        if (G.selMode || e.shiftKey) {
            const n = nodeAt(wx, wy);
            if (n && e.shiftKey && !G.selMode) { drag = { kind: 'toggle', n, sx, sy }; return; }
            if (!n) { drag = { kind: 'box', wx0: wx, wy0: wy, wx, wy }; return; }
        }
        const pn = outPortAt(wx, wy);
        if (pn) { drag = { kind: 'link', from: pn, wx, wy }; return; }
        const n = nodeAt(wx, wy);
        if (n) {
            const group = G.multi.has(n.id) ? Eng.S.nodes.filter(m => G.multi.has(m.id)).map(m => [m, m.x, m.y]) : null;
            drag = { kind: 'node', n, ox: wx - n.x, oy: wy - n.y, sx, sy, wx0: wx, wy0: wy, moved: false, group };
            return;
        }
        const l = linkHit(wx, wy);
        if (l) { G.selLink = l; G.sel = null; changed(); return; }
        drag = { kind: 'pan', sx, sy, vx: view.x, vy: view.y, moved: false };
    }
    function move(e) {
        const pos = evPos(e);
        if (pointers.has(e.pointerId)) pointers.set(e.pointerId, pos);
        if (pinch && pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
            zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, pinch.z * d / pinch.d / view.z);
            return;
        }
        const [sx, sy] = pos, [wx, wy] = toWorld(sx, sy);
        ghost.x = wx; ghost.y = wy;
        G.hover = nodeAt(wx, wy);
        cv.style.cursor = G.placingBp ? 'copy' : (G.selMode || e.shiftKey) && !G.hover ? 'crosshair' : outPortAt(wx, wy) ? 'crosshair' : G.hover ? 'grab' : 'default';
        if (!drag) return;
        if (drag.kind === 'link' || drag.kind === 'box') { drag.wx = wx; drag.wy = wy; return; }
        if (drag.kind === 'node') {
            if (!drag.moved && Math.hypot(sx - drag.sx, sy - drag.sy) < 4) return;
            drag.moved = true;
            if (drag.group) {
                const dx = Math.round((wx - drag.wx0) / 10) * 10, dy = Math.round((wy - drag.wy0) / 10) * 10;
                drag.group.forEach(([m, x, y]) => { m.x = x + dx; m.y = y + dy; });
            } else { drag.n.x = Math.round((wx - drag.ox) / 10) * 10; drag.n.y = Math.round((wy - drag.oy) / 10) * 10; }
            cv.style.cursor = 'grabbing';
            return;
        }
        if (drag.kind === 'pan') {
            if (Math.hypot(sx - drag.sx, sy - drag.sy) > 3) drag.moved = true;
            view.x = drag.vx - (sx - drag.sx) / view.z; view.y = drag.vy - (sy - drag.sy) / view.z;
            cv.style.cursor = 'grabbing';
        }
    }
    function up(e) {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinch = null;
        if (!drag) return;
        const d = drag; drag = null;
        if (d.kind === 'link') {
            const tgt = nodeAt(d.wx, d.wy);
            if (tgt && tgt !== d.from) {
                const r = Eng.link(d.from.id, tgt.id);
                if (r.err) { cb.toast(r.err, 'bad'); Arcade.sfx('bad'); } else Arcade.sfx('select');
            }
            return;
        }
        if (d.kind === 'box') {
            const bx0 = Math.min(d.wx0, d.wx), bx1 = Math.max(d.wx0, d.wx), by0 = Math.min(d.wy0, d.wy), by1 = Math.max(d.wy0, d.wy);
            if (bx1 - bx0 < 4 && by1 - by0 < 4) { G.multi = new Set(); changed(); return; }
            const hit = Eng.S.nodes.filter(n => n.x + NW > bx0 && n.x < bx1 && n.y + NH > by0 && n.y < by1).map(n => n.id);
            G.multi = new Set([...(e.shiftKey ? G.multi : []), ...hit]);
            G.sel = null; G.selLink = null;
            if (hit.length) Arcade.sfx('select');
            changed();
            return;
        }
        if (d.kind === 'toggle') {
            if (G.multi.has(d.n.id)) G.multi.delete(d.n.id); else G.multi.add(d.n.id);
            G.sel = null; changed(); return;
        }
        if (d.kind === 'node' && !d.moved) { G.sel = d.n; G.selLink = null; if (!G.multi.has(d.n.id)) G.multi = new Set(); changed(); Arcade.sfx('click'); }
        if (d.kind === 'pan' && !d.moved) { G.sel = null; G.selLink = null; G.multi = new Set(); changed(); }
    }
    function zoomAt(sx, sy, k) {
        const [wx, wy] = toWorld(sx, sy);
        view.z = Math.max(0.2, Math.min(2.2, view.z * k));
        const [nx, ny] = toWorld(sx, sy);
        view.x += wx - nx; view.y += wy - ny;
    }
    function wheel(e) { e.preventDefault(); zoomAt(...evPos(e), Math.exp(-e.deltaY * 0.0012)); }

    function init(canvas, callbacks) {
        cv = canvas; c = cv.getContext('2d'); cb = callbacks || {};
        resize();
        new ResizeObserver(resize).observe(cv);
        cv.addEventListener('pointerdown', down);
        cv.addEventListener('pointermove', move);
        cv.addEventListener('pointerup', up);
        cv.addEventListener('pointercancel', up);
        cv.addEventListener('wheel', wheel, { passive: false });
        cv.addEventListener('contextmenu', (e) => e.preventDefault());
        fit();
    }
    function fit() {
        const ns = Eng.S.nodes;
        if (!ns.length) { view.x = 300; view.y = 250; view.z = 1; return; }
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        ns.forEach(n => { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + NW); y1 = Math.max(y1, n.y + NH); });
        view.x = (x0 + x1) / 2; view.y = (y0 + y1) / 2;
        view.z = Math.max(0.3, Math.min(1.15, Math.min(W / (x1 - x0 + 220), H / (y1 - y0 + 200))));
    }
    function startBp(bp, full) { G.placingBp = { bp, full: !!full }; G.sel = null; G.selLink = null; ghost.x = view.x; ghost.y = view.y; }
    function freeSpot() {
        for (let r = 0; r < 30; r++) for (let a = 0; a < 8; a++) {
            const x = Math.round((view.x - NW / 2 + Math.cos(a / 8 * Math.PI * 2) * r * 60) / 10) * 10;
            const y = Math.round((view.y - NH / 2 + Math.sin(a / 8 * Math.PI * 2) * r * 50) / 10) * 10;
            if (!Eng.S.nodes.some(n => Math.abs(n.x - x) < NW + 20 && Math.abs(n.y - y) < NH + 20)) return [x, y];
        }
        return [view.x, view.y];
    }
    function focus(n) { view.x = n.x + NW / 2; view.y = n.y + NH / 2; }

    window.Graph = Object.assign(G, { init, draw, fit, startBp, freeSpot, focus, view, STATUS, zoom: (k) => zoomAt(W / 2, H / 2, k) });
})();
