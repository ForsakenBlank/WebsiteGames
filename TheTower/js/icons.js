/* The Tower — line-art neon icons in the style of the mobile game (© coins, outlined pink gems, green triangle stones,
   white outline menu icons). The rest of the UI still writes emoji; G.iconize swaps them for these icons when the HTML
   is put on the page (text only, never inside tags), so data files and toasts keep working with plain characters. */
(() => {
    const G = window.TG, D = G.D;

    /* ---------- drawing helpers (24×24 view box, mostly strokes) ---------- */
    const st = (stroke, w = 1.7) => stroke ? ` stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"` : '';
    const P = (d, c, w, fill) => `<path d="${d}" fill="${fill || 'none'}"${st(c, w)}/>`;
    const F = (d, fill) => `<path d="${d}" fill="${fill}"/>`;
    const C = (cx, cy, r, c, w, fill) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill || 'none'}"${st(c, w)}/>`;
    const R = (x, y, w, h, rx, c, sw, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill || 'none'}"${st(c, sw)}/>`;
    const PG = (pts, c, w, fill) => `<polygon points="${pts}" fill="${fill || 'none'}"${st(c, w)}/>`;
    const pts = (cx, cy, rs, n, rot = -Math.PI / 2) => {
        const out = [];
        for (let i = 0; i < n * rs.length; i++) { const r = rs[i % rs.length], a = rot + i * Math.PI * 2 / (n * rs.length); out.push((cx + Math.cos(a) * r).toFixed(2) + ',' + (cy + Math.sin(a) * r).toFixed(2)); }
        return out.join(' ');
    };
    const star = (cx, cy, R1, r1, n = 5) => pts(cx, cy, [R1, r1], n);
    const hex = (cx, cy, r, rot = 0) => pts(cx, cy, [r], 6, rot);
    const rays = (cx, cy, r1, r2, n, rot = 0) => Array.from({ length: n }, (_, i) => { const a = rot + i * Math.PI * 2 / n; return `M${(cx + Math.cos(a) * r1).toFixed(2)} ${(cy + Math.sin(a) * r1).toFixed(2)}L${(cx + Math.cos(a) * r2).toFixed(2)} ${(cy + Math.sin(a) * r2).toFixed(2)}`; }).join('');
    const HEART = 'M12 20.5s-8-5.1-8-10.6A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8 2.6c0 5.5-8 10.6-8 10.6z';
    const SHIELD = 'M12 2.5l8 3v6c0 5-3.4 8.6-8 10.3-4.6-1.7-8-5.3-8-10.3v-6z';

    /* ---------- the icons: [default colour, (c) => svg body] ---------- */
    const W = '#ffffff';
    const I = {
        // currencies
        coin: ['#f5d58a', (c) => C(12, 12, 9, c, 1.9) + P('M15.2 9.2a4.3 4.3 0 1 0 0 5.6', c, 2)],
        gem: ['#ff6ad5', (c) => PG('6.5,4 17.5,4 21.5,9.5 12,20.5 2.5,9.5', c, 1.7) + P('M2.5 9.5h19M9 9.5L12 20.5L15 9.5M9 9.5l2-5.5M15 9.5l-2-5.5', c, 1)],
        stone: ['#3ee08f', (c) => PG('12,3 21.5,20 2.5,20', c, 1.9) + PG('12,10 16,17.5 8,17.5', c, 1, c)],
        medal: ['#ffb020', (c) => P('M8 2.5l2.5 6.5M16 2.5l-2.5 6.5', c, 1.7) + C(12, 15, 6, c, 1.8) + PG(star(12, 15.2, 3.4, 1.4), c, 1, c)],
        key: ['#f5d58a', (c) => C(8, 9, 4.5, c, 2) + P('M11.4 12.4L20.5 21.5M16 17.5l2.6-2.6M18.4 19.9l2.6-2.6', c, 2)],
        bit: ['#5ad8ff', (c) => PG('12,3 20,7.5 12,12 4,7.5', c, 1.6) + P('M4 7.5v9l8 4.5 8-4.5v-9M12 12v9', c, 1.6)],
        cell: ['#5ef0c0', (c) => PG(hex(12, 12, 9.5, Math.PI / 6), c, 1.8) + C(12, 12, 3.4, c, 1.6) + C(12, 12, 1, c, 0, c)],
        reroll: ['#c49bff', (c) => R(4, 4, 16, 16, 3.5, c, 1.8) + C(8.5, 8.5, 1.3, c, 0, c) + C(15.5, 15.5, 1.3, c, 0, c) + C(12, 12, 1.3, c, 0, c) + C(15.5, 8.5, 1.3, c, 0, c) + C(8.5, 15.5, 1.3, c, 0, c)],
        ticket: ['#f5d58a', (c) => P('M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5z', c, 1.7) + P('M14.5 6.5v11', c, 1.2) + PG(star(9, 12, 2.8, 1.2), c, 1, c)],
        cash: ['#5dff7e', (c) => `<text x="12" y="18.5" text-anchor="middle" font-size="19" font-weight="700" fill="${c}" font-family="Exo 2, Arial">$</text>`],
        // module shapes: cannon circle, armor square, generator triangle, core hexagon
        modCannon: ['#ff6a7a', (c) => C(12, 12, 9, c, 1.8) + C(12, 12, 4.5, c, 1.2)],
        modArmor: ['#5ab4ff', (c) => R(3.5, 3.5, 17, 17, 4, c, 1.8) + R(8, 8, 8, 8, 2, c, 1.2)],
        modGen: ['#ffd23d', (c) => PG('12,3 21.5,20 2.5,20', c, 1.8) + PG('12,10 16,17.5 8,17.5', c, 1.2)],
        modCore: ['#5ef0c0', (c) => PG(hex(12, 12, 9.5, Math.PI / 6), c, 1.8) + PG(hex(12, 12, 4.8, Math.PI / 6), c, 1.2)],
        module: [W, (c) => PG('12,2.5 21.5,12 12,21.5 2.5,12', c, 1.8) + PG('12,8 15.5,14.5 8.5,14.5', c, 1.5)],
        // menus and buttons (white line art like the game)
        hammer: [W, (c) => P('M13.5 6.5l-9 9 3 3 9-9M10.5 4.5l5-1.5 5 5-1.5 5-3-3', c, 1.8) + P('M4.5 15.5l4 4', c, 1.8)],
        flask: [W, (c) => P('M9 3h6M10 3v6.3L4.6 18.6A1.9 1.9 0 0 0 6.2 21.5h11.6a1.9 1.9 0 0 0 1.6-2.9L14 9.3V3M7.2 15h9.6', c, 1.7)],
        card: [W, (c) => R(5.5, 3, 13, 18, 2.5, c, 1.8)],
        cards: [W, (c) => R(7, 3, 12, 16, 2.2, c, 1.6) + P('M5 6.5v12.3A2.2 2.2 0 0 0 7.2 21H15', c, 1.6)],
        uw: ['#3ee08f', (c) => PG('12,3 21.5,20 2.5,20', c, 1.9) + C(12, 15, 2.6, c, 1.4)],
        missions: [W, (c) => R(4.5, 4, 15, 17.5, 2, c, 1.6) + R(8.5, 2.5, 7, 3.5, 1, c, 1.4) + P('M8 11l1.6 1.6L12.4 9.8M8 16.5l1.6 1.6 2.8-2.8M14 11.5h2.5M14 17h2.5', c, 1.4)],
        flag: [W, (c) => P('M5.5 21.5V3M5.5 4h12l-2.8 4 2.8 4h-12', c, 1.7)],
        trophy: ['#f5c04a', (c) => P('M7.5 4.5H4.5a3 3 0 0 0 3 4.5M16.5 4.5h3a3 3 0 0 1-3 4.5M7 2.8h10v5.2a5 5 0 0 1-10 0zM12 13v4M8 21h8l-1-4H9z', c, 1.6) + PG(star(12, 7.3, 2.3, 1), c, 1, c)],
        event: ['#5aa8ff', (c) => R(3.5, 5, 17, 15.5, 2, c, 1.7) + P('M3.5 9.5h17M8 3v4M16 3v4', c, 1.7) + PG(star(12, 15, 3, 1.3), c, 1.1)],
        castle: ['#ff5a6a', (c) => P('M3.5 21V8.5h3V11h2.5V8.5h3V11h1V8.5h3V11h2.5V8.5h3V21zM10 21v-4.5a2 2 0 0 1 4 0V21', c, 1.6)],
        bot: [W, (c) => P('M12 6.8V4', c, 1.6) + C(12, 3, 1.2, c, 1.4) + R(4.5, 7, 15, 11.5, 3.2, c, 1.7) + C(9.2, 12.5, 1.6, c, 1.4) + C(14.8, 12.5, 1.6, c, 1.4) + P('M2.5 11v4M21.5 11v4M9.5 16h5', c, 1.6)],
        shield: [W, (c) => P(SHIELD, c, 1.8)],
        relic: ['#ffb020', (c) => PG(hex(12, 12, 10), c, 1.6) + PG('12,6.5 16.5,10.5 12,17.5 7.5,10.5', c, 1.4) + P('M7.5 10.5h9', c, 1)],
        vault: [W, (c) => R(3, 4, 18, 16, 2.2, c, 1.6) + C(12, 12, 4.5, c, 1.5) + P('M12 9v6M9 12h6M6 20v1.5M18 20v1.5', c, 1.3)],
        drone: [W, (c) => P('M6 8l4 3M18 8l-4 3M6 16l4-3M18 16l-4-3', c, 1.4) + `<ellipse cx="5.5" cy="7" rx="3.3" ry="1.2" fill="none" stroke="${c}" stroke-width="1.4"/><ellipse cx="18.5" cy="7" rx="3.3" ry="1.2" fill="none" stroke="${c}" stroke-width="1.4"/><ellipse cx="5.5" cy="17" rx="3.3" ry="1.2" fill="none" stroke="${c}" stroke-width="1.4"/><ellipse cx="18.5" cy="17" rx="3.3" ry="1.2" fill="none" stroke="${c}" stroke-width="1.4"/>` + R(9, 9.5, 6, 5, 1.6, c, 1.5)],
        podium: [W, (c) => P('M9 21V9h6v12M3 21v-7h6M15 21v-5h6v5M2.5 21h19', c, 1.7) + PG(star(12, 4.8, 2.4, 1), c, 1.1)],
        gear: [W, (c) => PG(pts(12, 12, [9.8, 9.8, 7.4, 7.4], 8, -Math.PI / 2 - 0.2), c, 1.6) + C(12, 12, 3.2, c, 1.6)],
        tower: ['#4d9bff', (c) => PG(hex(12, 12, 9.5), c, 2)],
        swords: [W, (c) => P('M4 4l10.5 10.5M20 4L9.5 14.5M12.5 17l4.5-4.5M7 12.5l4.5 4.5M16.5 16.5l3.5 3.5M7.5 16.5L4 20', c, 1.8)],
        sword: [W, (c) => P('M20 4l-.6 3.4L9.2 17.6l-2.8-2.8L16.6 4.6zM5 13l6 6M7.6 16.4L3.8 20.2', c, 1.7)],
        star: ['#ffd23d', (c) => PG(star(12, 12.6, 9.5, 4.2), c, 1.8)],
        coins: [W, (c) => `<ellipse cx="12" cy="6.5" rx="7.5" ry="3" fill="none" stroke="${c}" stroke-width="1.6"/>` + P('M4.5 6.5v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5M4.5 11.5v5c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-5', c, 1.6)],
        lock: [W, (c) => P('M7.5 11V8a4.5 4.5 0 0 1 9 0v3', c, 1.8) + R(5, 10.5, 14, 11, 2, c, 1.8) + P('M12 14.5v3', c, 1.8)],
        unlock: ['#3ee08f', (c) => P('M7.5 11V8a4.5 4.5 0 0 1 8.8-1.3', c, 1.8) + R(5, 10.5, 14, 11, 2, c, 1.8) + P('M12 14.5v3', c, 1.8)],
        check: ['#3ee08f', (c) => P('M4.5 12.5l4.8 4.8L19.5 7', c, 2.6)],
        tv: ['#5ad8ff', (c) => R(3, 4, 18, 16, 2.5, c, 1.7) + PG('10,8.5 15.5,12 10,15.5', c, 1.4, c)],
        wall: [W, (c) => R(2.5, 5, 19, 14, 1, c, 1.5) + P('M2.5 9.7h19M2.5 14.3h19M8 5v4.7M16 5v4.7M12 9.7v4.6M5 14.3V19M19 14.3V19M12 14.3V19', c, 1.1)],
        boss: ['#ff3355', (c) => PG('12,2.5 21.5,12 12,21.5 2.5,12', c, 1.9) + PG('12,8 16,12 12,16 8,12', c, 1.3)],
        mask: ['#c49bff', (c) => P('M3 6c3 1.5 6 1.5 9 0 3 1.5 6 1.5 9 0 0 7-3.5 12-9 12S3 13 3 6zM6.5 10.5c1-.8 2.5-.8 3.5 0M14 10.5c1-.8 2.5-.8 3.5 0M9 15c2 1.4 4 1.4 6 0', c, 1.5)],
        palette: ['#ff6ad5', (c) => P('M12 2.5a9.5 9.5 0 0 0 0 19c1.6 0 2-1.2 1.4-2.3-.7-1.3.2-2.7 1.7-2.7h2.4a4 4 0 0 0 4-4c0-5.5-4.3-10-9.5-10z', c, 1.5) + C(7.5, 10, 1.4, c, 1.2) + C(10.5, 6.6, 1.4, c, 1.2) + C(15, 6.8, 1.4, c, 1.2)],
        note: [W, (c) => P('M9 17.5V5l11-2.5v12.5', c, 1.8) + C(6.5, 17.5, 2.6, c, 1.6) + C(17.5, 15, 2.6, c, 1.6)],
        loop: [W, (c) => P('M4.5 11a7.5 7.5 0 0 1 13-4.5M19.5 13a7.5 7.5 0 0 1-13 4.5M18.5 2.5v4h-4M5.5 21.5v-4h4', c, 1.8)],
        moon: ['#c9b8ff', (c) => P('M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z', c, 1.7)],
        mail: [W, (c) => R(2.5, 5, 19, 14, 2, c, 1.6) + P('M3 6.5l9 6.5 9-6.5', c, 1.6)],
        cart: ['#ffd23d', (c) => P('M2.5 4h3l2.4 11h10.6l2-7.5H7', c, 1.8) + C(9.5, 19, 1.6, c, 1.6) + C(17, 19, 1.6, c, 1.6)],
        chart: [W, (c) => P('M3 20.5h18M4 16l5-5 4 3 7-8M15.5 6h4.5v4.5', c, 1.7)],
        plus: [W, (c) => P('M12 4v16M4 12h16', c, 2.4)],
        pause: [W, (c) => P('M8.5 5v14M15.5 5v14', c, 2.6)],
        // ultimate weapons (as drawn on the game's UW screen)
        bolt: ['#ffe14d', (c) => PG('13.5,1.8 4.5,13.5 10.8,13.5 9.5,22.2 19.5,9.8 13.2,9.8', c, 1.6)],
        missile: [W, (c) => [6, 12, 18].map((x, i) => P(`M${x} ${3 + i % 2 * 2}c1.8 2 2.2 4 2.2 6.5v8h-4.4v-8c0-2.5.4-4.5 2.2-6.5zM${x - 2.2} ${15 + i % 2 * 2}l-1.3 3h7l-1.3-3`, c, 1.2)).join('')],
        deathwave: ['#ff4d6d', (c) => C(12, 12, 10, c, 1.4) + C(12, 12, 7, c, 1) + P('M9.3 10.3a2.7 2.7 0 1 1 5.4 0c0 1.2-.7 1.8-1.2 2.2v1.3h-3v-1.3c-.5-.4-1.2-1-1.2-2.2z', c, 1.2) + C(11, 10.5, 0.6, c, 0, c) + C(13, 10.5, 0.6, c, 0, c)],
        chrono: ['#7fd8ff', (c) => C(12, 13, 8.5, c, 1.7) + P('M12 8.5V13l3.2 2M9.5 2.5h5M12 2.5v2', c, 1.7)],
        mine: ['#ff5a3d', (c) => P(rays(12, 12, 5.8, 9.8, 8), c, 1.8) + C(12, 12, 5.6, c, 1.7) + C(12, 12, 1.6, c, 0, c)],
        sunwheel: ['#ffc23d', (c) => C(12, 12, 9.5, c, 1.6) + C(12, 12, 3, c, 1.4) + P(rays(12, 12, 3, 9.5, 16), c, 1)],
        poison: ['#7dff4a', (c) => P('M11 3.5c3 4.3 5.8 7.4 5.8 10.8a5.8 5.8 0 0 1-11.6 0c0-3.4 2.8-6.5 5.8-10.8z', c, 1.7) + C(19, 7.5, 1.8, c, 1.3) + C(18.5, 14, 1.1, c, 1.1) + C(9.5, 14.5, 1.4, c, 1.1)],
        blackhole: ['#c49bff', (c) => P('M12 12m-1.5 0a1.5 1.5 0 1 0 3 0a3.5 3.5 0 1 0-7 0a5.5 5.5 0 1 0 11 0a7.5 7.5 0 1 0-15 0a9.5 9.5 0 1 0 19 0', c, 1.5)],
        spotlight: ['#fff2a8', (c) => P('M4.5 9.5L8 6l3.5 3.5L8 13z', c, 1.5) + P('M9.8 11.3L20.5 21.5M11.3 8.2L21.5 13.5', c, 1.4) + P('M5 13.5l-2.5 2.5', c, 1.6)],
        // bots
        flame: ['#ff7a2e', (c) => P('M12 2.5c1 4 6 6.2 6 11.8a6 6 0 0 1-12 0c0-2.9 1.8-5 3-6 0 1.9.8 3.1 2 3.1-1-4 .1-6.9 1-8.9zM12 13c.5 1.8 2.6 2.6 2.6 4.6a2.6 2.6 0 0 1-5.2 0c0-1.3.8-2.1 1.3-2.6', c, 1.5)],
        thunder: ['#8fa8ff', (c) => P('M6.5 14.5a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.4 1.4 3.8 3.8 0 0 1 .1 7.6', c, 1.5) + PG('12.5,11 8.5,17 11.5,17 10.5,22 15.5,15.5 12.5,15.5', c, 1.2)],
        amplify: ['#ff6fd0', (c) => P('M4.5 9.5a8.5 8.5 0 0 0 10 10zM9.5 14.5l4-4M16 4.5a5 5 0 0 1 3.5 3.5M16.5 1.8a8 8 0 0 1 5.7 5.7M3 21h8', c, 1.5) + C(14.2, 9.8, 1.4, c, 1.2)],
        // card art
        gauge: [W, (c) => P('M3.5 17a8.5 8.5 0 1 1 17 0', c, 1.8) + P(rays(12, 17, 6.2, 8, 7, Math.PI), c, 1.3) + P('M12 17l4-6', c, 2) + C(12, 17, 1.4, c, 0, c)],
        heart: [W, (c) => P(HEART, c, 1.8) + P('M5 12.5h3.5l1.5-3 2.5 6 1.5-3H19', c, 1.4)],
        hp: [W, (c) => P(HEART, c, 1.9)],
        regen: [W, (c) => P(HEART, c, 1.8) + P('M12 10v6M9 13h6', c, 1.8)],
        range: [W, (c) => C(12, 12, 2, c, 1.6) + P('M8 8a5.6 5.6 0 0 0 0 8M16 8a5.6 5.6 0 0 1 0 8M5 5a9.9 9.9 0 0 0 0 14M19 5a9.9 9.9 0 0 1 0 14', c, 1.7)],
        dollars: [W, (c) => `<text x="7" y="16.5" text-anchor="middle" font-size="12" font-weight="700" fill="${c}" font-family="Exo 2, Arial">$</text><text x="17" y="16.5" text-anchor="middle" font-size="12" font-weight="700" fill="${c}" font-family="Exo 2, Arial">$</text>` + P('M12 5v14', c, 1.3)],
        crit: [W, (c) => C(12, 12, 7.5, c, 1.7) + C(12, 12, 2, c, 0, c) + P('M12 2v5M12 17v5M2 12h5M17 12h5', c, 1.7)],
        slow: [W, (c) => P('M3 18.5h14.5a3 3 0 0 0 3-3V12M19.8 11.5l-1-3M21.2 11.5l1-3', c, 1.5) + C(11, 12, 5.8, c, 1.6) + P('M11 12a2.2 2.2 0 1 1 2.2 2.2 4 4 0 1 1-4-4', c, 1.3)],
        balance: [W, (c) => P('M12 3v17M7 20.5h10M4 6.5h16M4 7l-2.5 6h5zM20 7l-2.5 6h5z', c, 1.5) + P('M1.5 13a2.5 2 0 0 0 5 0M17.5 13a2.5 2 0 0 0 5 0', c, 1.3)],
        fortress: [W, (c) => P('M3 21V8h3v2.5h2.5V8h3v2.5h1V8h3v2.5H18V8h3v13zM10 21v-4.5a2 2 0 0 1 4 0V21', c, 1.5)],
        sparkle: [W, (c) => PG(star(10, 13, 8.5, 2.2, 4), c, 1.4) + PG(star(18.5, 5.5, 3.4, 1, 4), c, 1.2)],
        orb: [W, (c) => `<ellipse cx="12" cy="12" rx="10" ry="4.5" fill="none" stroke="${c}" stroke-width="1.3" transform="rotate(-20 12 12)"/>` + C(12, 12, 3.4, c, 1.6) + C(20.4, 8.6, 1.8, c, 0, c)],
        plasma: [W, (c) => P('M3 21l9.5-9.5M5.5 14l5.5-4.5M10 19l4.5-5.5', c, 1.6) + C(15.5, 8.5, 4.6, c, 1.7) + C(15.5, 8.5, 1.6, c, 0, c)],
        skip: [W, (c) => PG('3,5 11.5,12 3,19', c, 1.6) + PG('12,5 20.5,12 12,19', c, 1.6)],
        sprint: [W, (c) => P('M2.5 8h6M1.5 12h5M2.5 16h6', c, 1.5) + PG('9,4.5 21.5,12 9,19.5 12,12', c, 1.6)],
        stun: [W, (c) => `<ellipse cx="12" cy="13" rx="9.5" ry="3.6" fill="none" stroke="${c}" stroke-width="1.2"/>` + PG(star(5.5, 12, 3.2, 1.2), c, 1.1) + PG(star(12, 15.5, 3.2, 1.2), c, 1.1) + PG(star(18.5, 11.5, 3.2, 1.2), c, 1.1)],
        package: [W, (c) => PG('12,2.5 21,7 21,17 12,21.5 3,17 3,7', c, 1.6) + P('M3 7l9 4.5 9-4.5M12 11.5v10', c, 1.4)],
        ray: [W, (c) => P(rays(12, 12, 6.5, 10.5, 8), c, 1.6) + C(12, 12, 4.4, c, 1.7)],
        net: [W, (c) => P('M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1', c, 1) + PG(pts(12, 12, [4], 8), c, 1) + PG(pts(12, 12, [8.5], 8), c, 1)],
        wing: [W, (c) => P('M3 18c0-8 5.5-14 18-15-1.4 2.2-3 3.4-5 4 1.5.3 2.4.2 3.6-.3-1.5 2.4-3.4 3.7-6 4 1.2.4 2.4.4 3.6 0-2.2 3.7-6.5 6-14.2 7.3z', c, 1.4)],
        demon: ['#ff4d5a', (c) => P('M5 3.5l2.5 5M19 3.5l-2.5 5M7.5 11.5l3 1.5M16.5 11.5l-3 1.5M8.5 17c2.2 1.4 4.8 1.4 7 0', c, 1.6) + C(12, 13.5, 8, c, 1.7)],
        eshield: [W, (c) => P(SHIELD, c, 1.7) + PG('13,6.5 8.5,13 11.5,13 10.5,18 15.5,11 12.5,11', c, 1.2)],
        stopwatch: [W, (c) => C(12, 13.5, 8, c, 1.7) + P('M12 9v4.5l3-1.5M10 2.5h4M12 2.5v2.7M18.5 6l1.6-1.6', c, 1.6)],
        rage: [W, (c) => C(12, 12, 9.5, c, 1.7) + P('M6.5 8.5l4 1.8M17.5 8.5l-4 1.8M8.5 17.5c2.2-1.6 4.8-1.6 7 0', c, 1.6) + C(9, 12, 1.1, c, 0, c) + C(15, 12, 1.1, c, 0, c)],
        burst: ['#ff9640', (c) => PG(star(12, 12, 10.5, 4.6, 8), c, 1.5)],
        nuke: ['#ffe14d', (c) => C(12, 12, 10, c, 1.4) + [0, 1, 2].map(k => { const a = -Math.PI / 2 + k * Math.PI * 2 / 3; const p = (r, d) => `${(12 + Math.cos(a + d) * r).toFixed(1)} ${(12 + Math.sin(a + d) * r).toFixed(1)}`; return P(`M${p(3, -0.5)}L${p(8, -0.55)}A8 8 0 0 1 ${p(8, 0.55)}L${p(3, 0.5)}A3 3 0 0 0 ${p(3, -0.5)}z`, c, 1.2); }).join('') + C(12, 12, 1.5, c, 0, c)],
        aoe: [W, (c) => P(rays(12, 12, 3, 8, 12), c, 1.3) + C(12, 12, 10, c, 1.2)],
        bone: [W, (c) => P('M6.5 9.5L14.5 17.5', c, 2.6) + C(5, 9, 2.2, c, 1.5) + C(7, 5.5, 2.2, c, 1.5) + C(17, 18.5, 2.2, c, 1.5) + C(18.5, 15, 2.2, c, 1.5)],
        ally: [W, (c) => P('M2.5 12.5l4-4 4 2.5 3-2.5h4l4 4-6.5 6.5-2-1.5-2 1.5-2-1.5-2 1zM10.5 11l3 3', c, 1.4)],
        // league trophies use the league colours
        tCopper: ['#d98a3a', (c) => I.trophy[1](c)], tSilver: ['#cbd5e1', (c) => I.trophy[1](c)], tPlat: ['#67e8f9', (c) => I.trophy[1](c)],
        tChamp: ['#c084fc', (c) => I.trophy[1](c)], tLegend: ['#ff5a6a', (c) => I.trophy[1](c)], tMythic: ['#f0abfc', (c) => I.trophy[1](c)],
    };

    /* ---------- emoji → icon ---------- */
    const EMO = {
        '🪙': 'coin', '💎': 'gem', '💠': 'stone', '🏅': 'medal', '🗝️': 'key', '🔹': 'bit', '🧬': 'cell', '🎲': 'reroll', '🎟️': 'ticket', '🎫': 'ticket', '💵': 'dollars',
        '🔴': 'modCannon', '🟦': 'modArmor', '🔺': 'modGen', '🔷': 'modCore', '🧩': 'module',
        '🔧': 'hammer', '🧪': 'flask', '🃏': 'card', '🎴': ['star', '#ffd23d'], '📋': 'missions', '🏁': 'flag', '🏆': 'trophy', '🎉': 'event', '🤖': 'bot', '🛡️': 'shield',
        '🏺': 'relic', '🛸': 'drone', '📊': 'podium', '⚙️': 'gear', '🏠': 'tower', '🗼': 'tower', '⚔️': 'swords', '🗡️': 'sword', '💰': 'coins', '🏯': 'castle', '📅': 'event',
        '🔒': 'lock', '🔓': 'unlock', '✅': 'check', '📺': 'tv', '🧱': 'wall', '👹': 'boss', '🎭': 'mask', '🎨': 'palette', '🖼️': 'palette', '🎵': 'note',
        '🔁': 'loop', '♻️': 'loop', '🌙': 'moon', '📬': 'mail', '🛒': 'cart', '📈': 'chart', '➕': 'plus', '🌟': ['star', '#ffd23d'], '⭐': 'star', '⏸️': 'pause',
        '⚡': 'bolt', '🚀': 'missile', '🌊': 'deathwave', '⏳': 'chrono', '💣': 'mine', '👑': 'sunwheel', '☠️': 'poison', '🕳️': 'blackhole', '🔦': 'spotlight',
        '🔥': 'flame', '🌩️': 'thunder', '📡': 'amplify',
        '🔫': 'gauge', '❤️': 'heart', '💗': 'regen', '🔭': 'range', '🎯': 'crit', '🐌': 'slow', '⚖️': 'balance', '🏰': 'fortress', '✨': 'sparkle', '🌀': 'orb',
        '☄️': 'plasma', '⏩': 'skip', '🏃': 'sprint', '💫': 'stun', '📦': 'package', '🔆': 'ray', '🕸️': 'net', '🪽': 'wing', '😈': 'demon', '🔰': 'eshield',
        '⏱️': 'stopwatch', '⏱': 'stopwatch', '😡': 'rage', '💥': 'burst', '☢️': 'nuke', '🎆': 'aoe', '🦴': 'bone', '🤝': 'ally',
        '🥉': 'tCopper', '🥈': 'tSilver', '🥇': 'trophy', '🔘': 'tPlat', '🏵️': 'tChamp', '🎖️': 'tLegend', '🌌': 'tMythic',
    };
    const svg = (name, col, cls = 'gi') => {
        const d = I[name];
        if (!d) return '';
        const c = col || d[0];
        return `<svg class="${cls}" viewBox="0 0 24 24" style="--g:${c}" aria-hidden="true">${d[1](c)}</svg>`;
    };
    G.ic = (name, col, cls) => svg(name, col, cls);
    const fromEmoji = (e) => { const m = EMO[e] || EMO[e + '️'] || EMO[e.replace('️', '')]; if (!m) return null; return Array.isArray(m) ? m : [m]; };
    // the icon drawn for an emoji, in a given colour (cards and UW art are drawn white)
    G.icFor = (e, col, cls) => { const f = fromEmoji(e); return f ? svg(f[0], col || f[1], cls) : e; };
    const keys = Object.keys(EMO).map(k => k.replace('️', '')).filter((k, i, a) => a.indexOf(k) === i).sort((a, b) => b.length - a.length);
    const RE = new RegExp('(' + keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')️?', 'gu');
    const cache = new Map();
    // swap emoji in text (never in tags or attributes) for icons
    G.iconize = (html) => {
        if (!html) return html;
        return html.split(/(<[^>]*>)/).map((part, i) => (i % 2 || !part ? part : part.replace(RE, (m, k) => {
            let out = cache.get(k);
            if (out === undefined) { const f = fromEmoji(k); out = f ? svg(f[0], f[1]) : m; cache.set(k, out); }
            return out;
        }))).join('');
    };

    // relic badges: a hexagon in the relic's rarity colour with its stat inside
    const RARITY_COL = { Rare: '#4fb4ff', Epic: '#d070ff', Legendary: '#ffb020' };
    const STAT_IC = {
        coins: 'coin', labSpeed: 'flask', critFactor: 'crit', critChance: 'crit', damage: 'sword', rendMult: 'sword', health: 'heart', regen: 'regen', attackSpeed: 'gauge',
        defPct: 'shield', defAbs: 'shield', thorns: 'burst', cash: 'dollars', uwDamage: 'uw', scChance: 'burst', scMult: 'burst', dpm: 'range', botRange: 'bot',
        kbForce: 'skip', orbSpeed: 'orb', wallRebuild: 'wall', freeAtk: 'sparkle', freeDef: 'sparkle', freeUtil: 'sparkle', pkgAmount: 'package', skipAtk: 'skip', skipHp: 'skip',
    };
    G.relicIc = (r) => {
        const col = RARITY_COL[r.rarity] || '#ffb020', g = I[STAT_IC[r.stat] || 'relic'];
        return `<svg class="gi relic" viewBox="0 0 24 24" style="--g:${col}" aria-hidden="true">${PG(hex(12, 12, 11), col, 1.5, col).replace('fill="' + col + '"', 'fill="' + col + '" fill-opacity="0.16"')}<g transform="translate(4.2 4.2) scale(0.65)">${g[1](col === '#ffb020' ? '#ffe0a0' : '#ffffff')}</g></svg>`;
    };

    // canvas: icons as images, drawn where the battlefield used to draw emoji
    const imgs = new Map();
    G.icImg = (e) => {
        if (imgs.has(e)) return imgs.get(e);
        const f = fromEmoji(e);
        let img = null;
        if (f && I[f[0]]) {
            img = new Image();
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">${I[f[0]][1](f[1] || I[f[0]][0])}</svg>`);
        }
        imgs.set(e, img);
        return img;
    };

    // toasts are plain text in the shared helper; give them icons too
    const plainToast = G.toast;
    G.toast = (msg, type, ms) => {
        plainToast(msg, type, ms);
        const host = document.getElementById('toasts');
        const t = host && host.lastElementChild;
        if (t && t.textContent === String(msg)) t.innerHTML = G.iconize(G.esc(msg));
    };

    // league icons get their own characters so they don't clash with power stones and the golden tower
    const LEAGUE_IC = { Platinum: '🔘', Champion: '🏵️', Legend: '🎖️' };
    for (const L of D.LEAGUES) if (LEAGUE_IC[L.id]) L.ic = LEAGUE_IC[L.id];
})();
