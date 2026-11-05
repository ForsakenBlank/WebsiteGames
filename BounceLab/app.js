/* =====================================================================
   Bounce Lab app: feeds, grid, studio, recording, manual Brick Breaker,
   Ballz, level editor and the manual.
   ===================================================================== */
(() => {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const { TAU, clamp } = BL;
    const cv = $('cv');
    const view = Arcade.fitCanvas(cv, 360, 640, { parent: $('box'), max: 2 });
    const c = view.ctx;
    let tab = 'shorts';
    const isFeed = () => tab === 'shorts' || tab === 'bricks';

    /* ---------- descriptions (used by the manual and the studio) ---------- */
    const DESC = {
        frozen: 'A ball that touches a spike freezes on the spot for good, and a new ball appears at the start. Frozen balls become obstacles. Six maps: circle, square, hexagon, octagon, spike mines and double ring.',
        spiralmult: 'Balls roll down a spiral into the centre. Touching a ×2/×3/×5 pad sends that many new balls in from the start.',
        spiralglass: 'Glass walls block the spiral. A new ball arrives every few seconds, each faster than the last, cracking the glass bit by bit. Reach the centre before the timer ends!',
        grow: 'Each bounce makes the ball bigger until it fills the circle.', escape: 'Nested rotating rings, each with a gap. A ring shatters when a ball slips through.',
        accumulate: 'Every bounce spawns another ball, one becomes hundreds.', fill: 'Like Accumulate, but the balls really collide and pile up until the arena is full.',
        race: 'Coloured balls race out through rotating rings. First one out wins.', speed: 'A spinning polygon. Every bounce makes the ball faster.',
        gap: 'A spinning polygon with one opening. How long until the ball finds it?', drawer: 'The balls are pens: they leave paint that never fades.',
        shrink: 'The circle gets smaller with each bounce until the ball is trapped.', rhythm: 'Every bounce plays the next note of a song, so the physics performs the melody.',
        ghost: 'Every bounce leaves a spike on the wall. Escape through the gap before touching one.', breaker: 'A rotating spiral of glass cells, cracked and cleared one impact at a time.',
        targets: 'Light up every target in the arena.', glass: 'A ball falls through a tower of glass plates; each bounce breaks twice as many as the last.',
        strings: 'Teams are tied to the wall by strings. Touch an enemy string to cut it, the last team with strings wins.', plinko: 'Hundreds of balls fall through a peg board into bins, and a bell curve appears.',
        track: 'Named marbles race down a long obstacle course with a live leaderboard.', lava: 'Marbles race down while lava pours in from above. Reach the bottom or melt.',
        colormatch: 'The ball keeps changing colour and can only break bricks of its current colour.', gates: 'One ball falls through ×2 and ×3 gates, multiplying into hundreds that smash a glass pane.',
        bloom: 'Rods spin at slightly different speeds, a line, a wave, a spiral, a bloom, then line up again.', well: 'Planets orbit a hungry star and fall in one by one, leaving glowing trails.',
        battle: 'Fighters with spinning weapons. Every hit makes the weapon stronger. Last one standing wins.',
        bauto: 'An AI paddle plays breakout, with multi-ball and wide-paddle drops.', bhp: 'Bricks have hit points; every brick destroyed releases a new ball.',
        bballz: 'A bot plays Ballz: it aims volleys while rows of numbered bricks creep down.', bpixel: 'An emoji is turned into pixel bricks, then smashed by bouncing balls.',
        bterritory: "Each team's ball paints enemy tiles in its own colour. Whoever owns most of the board after 45 s wins.", bcolor: 'Balls only break bricks of their current colour, and keep changing colour.',
        bchain: 'Bombs blow up their neighbours in long chain reactions.',
    };
    const PDESC = { g: 'How strongly balls fall. 0 = straight lines between bounces.', rest: 'Energy kept on each bounce. Above 1 adds energy on every impact!', rand: 'Jitters bounce angles so no path ever repeats.', speed: 'How fast balls start.', accel: 'Extra speed added on every bounce.', vmax: 'The speed limit.', grow: 'Size added on every bounce.', rmax: 'The biggest a ball can grow.', r: 'Starting ball size.', genesis: 'How many balls start (racers / teams in battle modes).', spawn: 'New balls created on every bounce.', spread: 'How widely new balls fan out.', popMax: 'Cap on how many balls can exist.', arena: 'Radius of the circle arena.' };

    /* =====================================================================
       Feeds
       ===================================================================== */
    let likes = (Arcade.load('arcade.physics.likes', []) || []).filter(l => l && BL.MODES[l.type]).map(l => ({ type: l.type, seed: l.seed, o: l.o, title: l.title }));
    let watched = Arcade.load('arcade.physics.watched', 0) || 0;
    const FEED = {};
    for (const [k, types] of [['shorts', BL.SHORTS], ['bricks', BL.BRICKS]]) {
        const saved = Arcade.load('arcade.physics.filter.' + k, null);
        FEED[k] = { list: [], idx: 0, types, filter: new Set((saved || types).filter(t => types.includes(t))), sim: null };
        if (!FEED[k].filter.size) FEED[k].filter = new Set(types);
    }
    FEED.shorts.list.push({ type: 'frozen', seed: (Math.random() * 2147483647) | 0 });   // the feed opens on Spike freeze
    const F = () => FEED[tab];
    let auto = Arcade.load('arcade.physics.auto', true) !== false, grid = false, gridSims = [], paused = false, slide = null;
    const snap = document.createElement('canvas');
    function randomSpec(Fd) {
        const pool = [...Fd.filter];
        let t, n = 0;
        do t = pool[Math.floor(Math.random() * pool.length)]; while (pool.length > 1 && Fd.list.length && Fd.list[Fd.list.length - 1].type === t && n++ < 10);
        return { type: t, seed: (Math.random() * 2147483647) | 0 };
    }
    function specAt(Fd, i) { while (Fd.list.length <= i) Fd.list.push(randomSpec(Fd)); return Fd.list[i]; }
    const cur = () => F().sim;
    function go(i, dir) {
        const Fd = F();
        if (i < 0) { Arcade.toast('This is the first one, swipe up for more', null, 1200); return; }
        if (rec) stopRec();
        if (Fd.sim && !grid) { snap.width = cv.width; snap.height = cv.height; snap.getContext('2d').drawImage(cv, 0, 0); slide = { t: 0, dir: dir || 1 }; }
        Fd.idx = i;
        Fd.sim = BL.newSim(specAt(Fd, i), true);
        paused = false;
        watched++; Arcade.save('arcade.physics.watched', watched);
        if (watched % 10 === 0) Arcade.addXP(5, true);
        Arcade.report('watched', watched);
        syncSide(); hud();
        if (studioOpen) buildStudio();
    }
    function replay() { const Fd = F(); Fd.sim = BL.newSim(Fd.sim.spec, true); paused = false; }
    function loadSpec(sp) { const Fd = F(); Fd.list.splice(Fd.idx + 1, 0, sp); go(Fd.idx + 1, 1); }
    function syncSide() {
        const S = cur(); if (!S) return;
        const liked = likes.some(l => BL.codeOf(l) === BL.codeOf(S.spec));
        $('likeBtn').classList.toggle('on', liked); $('likeN').textContent = liked ? 'Liked' : 'Like';
    }
    function toggleLike() {
        const S = cur(); if (!S) return;
        const code = BL.codeOf(S.spec), i = likes.findIndex(l => BL.codeOf(l) === code);
        if (i >= 0) likes.splice(i, 1); else { likes.unshift({ ...S.spec, title: S.title }); Arcade.sfx('coin'); }
        Arcade.save('arcade.physics.likes', likes.slice(0, 300));
        syncSide(); hud();
    }
    $('likeBtn').onclick = toggleLike;
    $('replayBtn').onclick = replay;
    $('shareBtn').onclick = () => { const code = BL.codeOf(cur().spec); navigator.clipboard && navigator.clipboard.writeText(code).catch(() => { }); Arcade.toast('Code copied: ' + code.slice(0, 40), 'good', 2500); };
    $('upBtn').onclick = () => go(F().idx - 1, -1);
    $('downBtn').onclick = () => go(F().idx + 1, 1);
    const syncAuto = () => { $('autoBtn').textContent = auto ? '▶ Autoplay on' : '⏸ Autoplay off'; $('autoBtn').classList.toggle('on', auto); };
    $('autoBtn').onclick = () => { auto = !auto; Arcade.save('arcade.physics.auto', auto); syncAuto(); };
    $('gridBtn').onclick = () => setGrid(!grid);
    function setGrid(on) {
        grid = on;
        $('gridBtn').classList.toggle('on', grid);
        $('sideBtns').hidden = grid || !isFeed();
        if (grid) { gridSims = [0, 1, 2, 3].map(i => BL.newSim(i === 0 && cur() ? cur().spec : randomSpec(F()), i === 0)); view.setSize(720, 1280); }
        else view.setSize(360, 640);
        slide = null;
    }
    $('likedBtn').onclick = () => {
        const host = $('likedList'); host.innerHTML = '';
        if (!likes.length) host.innerHTML = '<p class="small muted center">Tap ❤ on a simulation to keep it here.</p>';
        likes.forEach((sp, i) => {
            const M = BL.MODES[sp.type];
            const row = document.createElement('div'); row.className = 'lv-row';
            row.innerHTML = `<span>${M.icon}</span><b></b><button class="btn sm primary">▶</button><button class="btn sm ghost">✕</button>`;
            row.querySelector('b').textContent = (sp.title || M.label) + ' · ' + BL.codeOf(sp).slice(0, 24);
            row.querySelector('.primary').onclick = () => { Arcade.hide('likedOv'); const target = BL.BRICKS.includes(sp.type) ? 'bricks' : 'shorts'; if (tab !== target) setTab(target); loadSpec({ type: sp.type, seed: sp.seed, o: sp.o }); };
            row.querySelector('.ghost').onclick = () => { likes.splice(i, 1); Arcade.save('arcade.physics.likes', likes); $('likedBtn').onclick(); syncSide(); hud(); };
            host.appendChild(row);
        });
        Arcade.show('likedOv');
    };
    $('codeLoadBtn').onclick = () => { $('codeIn').value = ''; Arcade.show('codeOv'); setTimeout(() => $('codeIn').focus(), 50); };
    $('codeGo').onclick = () => {
        const sp = BL.parseCode($('codeIn').value);
        if (!sp) { Arcade.toast("That isn't a Bounce Lab code", 'bad'); return; }
        Arcade.hide('codeOv');
        const target = BL.BRICKS.includes(sp.type) ? 'bricks' : 'shorts';
        if (tab !== target) setTab(target);
        if (grid) setGrid(false);
        loadSpec(sp);
    };
    document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { b.closest('.overlay').hidden = true; });

    /* ---------- video recording (picture + the sim's own sound) ---------- */
    let rec = null;
    function startRec() {
        if (!cv.captureStream || !window.MediaRecorder) { Arcade.toast('Recording is not supported in this browser', 'bad'); return; }
        if (grid) setGrid(false);
        replay();
        const stream = cv.captureStream(60);
        BL.audio && BL.audio();
        if (BL.recDest) for (const t of BL.recDest.stream.getAudioTracks()) stream.addTrack(t);
        const type = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
        const mr = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 8e6 } : undefined);
        rec = { mr, chunks: [], code: BL.codeOf(cur().spec), t0: performance.now() };
        mr.ondataavailable = (e) => { if (e.data && e.data.size) rec && rec.chunks.push(e.data); };
        mr.onstop = () => {
            const r = mr._rec;
            const blob = new Blob(r.chunks, { type: 'video/webm' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bouncelab-' + r.code.replace(/[^\w-]/g, '').slice(0, 30) + '.webm'; a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 5000);
            Arcade.toast('Video saved', 'good');
        };
        mr._rec = rec;
        mr.start(250);
        $('recBtn').classList.add('on'); $('recN').textContent = 'Stop';
        Arcade.toast('Recording… it stops by itself when the simulation ends', null, 2500);
    }
    function stopRec() { if (!rec) return; const r = rec; rec = null; try { r.mr.stop(); } catch (e) { } $('recBtn').classList.remove('on'); $('recN').textContent = 'Record'; }
    $('recBtn').onclick = () => (rec ? stopRec() : startRec());

    /* =====================================================================
       Studio (Ball Engine style settings, live)
       ===================================================================== */
    let studioOpen = false, studioSpec = null, studioTimer = 0;
    $('studioBtn').onclick = () => { studioOpen = !studioOpen; $('studio').hidden = !studioOpen; $('studioBtn').classList.toggle('on', studioOpen); if (studioOpen) { if (grid) setGrid(false); buildStudio(); } view.refit(); };
    function applyStudio(now) {
        clearTimeout(studioTimer);
        const doIt = () => { const Fd = F(); Fd.list[Fd.idx] = JSON.parse(JSON.stringify(studioSpec)); Fd.sim = BL.newSim(Fd.list[Fd.idx], true); paused = false; syncSide(); };
        if (now) doIt(); else studioTimer = setTimeout(doIt, 160);
    }
    const fmtP = (v, step) => (step < 1 ? (+v).toFixed(step < 0.01 ? 3 : 2) : Math.round(v));
    function buildStudio() {
        const host = $('studio'), Fd = F(), S = cur();
        if (!S) return;
        studioSpec = JSON.parse(JSON.stringify(S.spec)); studioSpec.o = studioSpec.o || {};
        const base = S.base, sp = studioSpec;
        host.innerHTML = '';
        const h = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; };
        host.appendChild(h(`<h3>🎛 Studio <button class="btn sm ghost" id="stClose">✕</button></h3>`));
        host.appendChild(h(`<p class="small muted" style="margin:0">${DESC[sp.type] || ''}</p>`));
        host.appendChild(h('<h4>Simulation</h4>'));
        const types = h('<div class="types"></div>');
        for (const t of Fd.types) { const M = BL.MODES[t]; const b = document.createElement('button'); b.className = t === sp.type ? 'on' : ''; b.textContent = M.icon + ' ' + M.label; b.title = DESC[t] || ''; b.onclick = () => { studioSpec = { type: t, seed: sp.seed, o: sp.o.song != null ? { song: sp.o.song } : {} }; applyStudio(true); setTimeout(buildStudio, 0); }; types.appendChild(b); }
        host.appendChild(types);
        if (sp.type === 'frozen') {
            host.appendChild(h('<h4>Map</h4>'));
            const ms = h('<select></select>');
            ms.innerHTML = '<option value="">🎲 Random map</option>' + BL.FROZEN_MAPS.map(m => `<option value="${m}">${BL.MAP_NAMES[m]}</option>`).join('');
            ms.value = sp.o.map || '';
            ms.onchange = () => { if (ms.value) sp.o.map = ms.value; else delete sp.o.map; applyStudio(true); };
            host.appendChild(ms);
        }
        host.appendChild(h('<h4>Physics</h4>'));
        for (const [k, label, min, max, step] of BL.PARAMS) {
            const val = sp.o[k] != null ? sp.o[k] : base[k];
            const row = h(`<label class="prow" title="${PDESC[k] || ''}"><span class="${sp.o[k] != null ? 'set' : ''}">${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><b></b></label>`);
            const inp = row.querySelector('input'), out = row.querySelector('b'), lab = row.querySelector('span');
            inp.value = typeof val === 'boolean' ? +val : val; out.textContent = fmtP(inp.value, step);
            inp.oninput = () => { const v = +inp.value; out.textContent = fmtP(v, step); if (Math.abs(v - base[k]) < step / 2) delete sp.o[k]; else sp.o[k] = v; lab.className = sp.o[k] != null ? 'set' : ''; applyStudio(); };
            host.appendChild(row);
        }
        const tg = h('<div class="togs"></div>');
        const colBtn = document.createElement('button'); const colOn = sp.o.collide != null ? sp.o.collide : base.collide;
        colBtn.className = colOn ? 'on' : ''; colBtn.textContent = 'Balls collide'; colBtn.onclick = () => { sp.o.collide = !colOn; applyStudio(true); setTimeout(buildStudio, 0); };
        tg.appendChild(colBtn);
        host.appendChild(tg);
        host.appendChild(h('<h4>Song · every bounce plays the next note</h4>'));
        const song = h('<select></select>');
        song.innerHTML = '<option value="-1">🎲 Random song</option>' + BL.SONGS.map((s, i) => `<option value="${i}">${s[0]}</option>`).join('');
        song.value = sp.o.song != null ? sp.o.song : -1;
        song.onchange = () => { if (+song.value < 0) delete sp.o.song; else sp.o.song = +song.value; applyStudio(true); };
        host.appendChild(song);
        host.appendChild(h('<h4>Look &amp; sound</h4>'));
        const two = h('<div class="two"></div>');
        const sel = (opts, key) => { const s = document.createElement('select'); s.innerHTML = Object.entries(opts).map(([v, l]) => `<option value="${v}">${l}</option>`).join(''); s.value = BL.look[key]; s.onchange = () => { BL.look[key] = s.value; BL.saveLook(); }; return s; };
        two.appendChild(sel({ neon: 'Neon colours', pastel: 'Pastel', fire: 'Fire', ocean: 'Ocean', candy: 'Candy', mono: 'Mono', rainbow: 'Rainbow cycle' }, 'palette'));
        two.appendChild(sel(BL.BGS, 'bg'));
        two.appendChild(sel(BL.INSTS, 'inst'));
        const vol = h('<input type="range" min="0" max="1" step="0.05" title="Sim volume">'); vol.value = BL.look.vol; vol.oninput = () => { BL.look.vol = +vol.value; BL.saveLook(); };
        two.appendChild(vol);
        host.appendChild(two);
        const lt = h('<div class="togs"></div>');
        for (const [k, l] of [['hud', 'Titles & counters'], ['viz', 'Visualizer bars'], ['trails', 'Trails'], ['glow', 'Glow'], ['shake', 'Screen shake']]) {
            const b = document.createElement('button'); b.className = BL.look[k] ? 'on' : ''; b.textContent = l;
            b.onclick = () => { BL.look[k] = !BL.look[k]; BL.saveLook(); b.className = BL.look[k] ? 'on' : ''; };
            lt.appendChild(b);
        }
        host.appendChild(lt);
        host.appendChild(h('<h4>Seed</h4>'));
        const seedRow = h(`<div class="two"><input type="text" value="${(sp.seed >>> 0).toString(36)}" spellcheck="false" title="Same seed = same simulation"><button class="btn sm">Use seed</button></div>`);
        seedRow.querySelector('button').onclick = () => { const v = seedRow.querySelector('input').value.trim(); sp.seed = /^[0-9a-z]+$/i.test(v) ? parseInt(v, 36) : Arcade.hash(v); applyStudio(true); setTimeout(buildStudio, 0); };
        host.appendChild(seedRow);
        const btns = h('<div class="sbtns"></div>');
        const mk = (label, fn, cls = '') => { const b = document.createElement('button'); b.className = 'btn sm ' + cls; b.textContent = label; b.onclick = fn; btns.appendChild(b); };
        mk('🎲 New seed', () => { sp.seed = (Math.random() * 2147483647) | 0; applyStudio(true); setTimeout(buildStudio, 0); });
        mk('🎰 Chaos', () => {
            sp.seed = (Math.random() * 2147483647) | 0;
            const picks = Arcade.shuffle(BL.PARAMS.slice()).slice(0, 4);
            for (const [k, , min, max, step] of picks) sp.o[k] = Math.round((min + Math.random() * (max - min)) / step) * step;
            applyStudio(true); setTimeout(buildStudio, 0);
        });
        mk('↺ Defaults', () => { sp.o = sp.o.song != null ? { song: sp.o.song } : {}; applyStudio(true); setTimeout(buildStudio, 0); });
        mk('❤ Save', () => { if (!likes.some(l => BL.codeOf(l) === BL.codeOf(cur().spec))) toggleLike(); else Arcade.toast('Already in ❤ Liked', null, 1200); }, 'primary');
        host.appendChild(btns);
        host.appendChild(h('<h4>Feed, which types appear when you scroll</h4>'));
        const ft = h('<div class="togs"></div>');
        for (const t of Fd.types) {
            const b = document.createElement('button'); b.className = Fd.filter.has(t) ? 'on' : ''; b.textContent = BL.MODES[t].icon + ' ' + BL.MODES[t].label;
            b.onclick = () => { if (Fd.filter.has(t)) { if (Fd.filter.size > 1) Fd.filter.delete(t); } else Fd.filter.add(t); Arcade.save('arcade.physics.filter.' + tab, [...Fd.filter]); b.className = Fd.filter.has(t) ? 'on' : ''; Fd.list.length = Fd.idx + 1; };
            ft.appendChild(b);
        }
        host.appendChild(ft);
        $('stClose').onclick = () => $('studioBtn').click();
    }

    /* =====================================================================
       BRICK BREAKER (manual play)
       ===================================================================== */
    const BW = 480, BH = 640, COLS = 12, ROWS = 14, CW = 38, CH = 18, LEFT = (BW - COLS * CW) / 2, TOP = 70;
    const BRICK = { '1': { hp: 1, c: '#5bb8ea' }, '2': { hp: 2, c: '#4fc07f' }, '3': { hp: 3, c: '#f6c445' }, '4': { hp: 4, c: '#f2893d' }, '5': { hp: 5, c: '#ef5b56' }, X: { hp: Infinity, c: Arcade.ui.dim }, B: { hp: 1, c: '#9a6de0' }, P: { hp: 1, c: '#f08aa7' } };
    const HP_C = ['#000', '#5bb8ea', '#4fc07f', '#f6c445', '#f2893d', '#ef5b56'];
    const LEVELS = [
        ['Warm-up', ['............', '.1111111111.', '.1111111111.', '.2222222222.', '.2222222222.']],
        ['Pyramid', ['.....33.....', '....2222....', '...111P11...', '..22222222..', '.1111111111.']],
        ['Checkers', ['1.2.1.2.1.2.', '.2.1.2.1.2.1', '1.2.P.2.1.2.', '.2.1.2.1.2.1', '1.2.1.2.1.2.']],
        ['Invader', ['...3....3...', '....3..3....', '...333333...', '..33.33.33..', '.3333333333.', '.3.3PPP3.3..', '.3.3....3.3.', '....33.33...']],
        ['Bombs away', ['222222222222', '2B22B22B22B2', '333333333333', '3B33B33B33B3', '111111111111']],
        ['Fortress', ['XXXXX..XXXXX', 'X4444444444X', 'X3333333333X', 'X2222BB2222X', 'X1111111111X', 'X....PP....X']],
        ['Heart', ['..44....44..', '.4444..4444.', '444444444444', '44442BB24444', '.4444224444.', '..44444444..', '...444444...', '....4444....', '.....44.....']],
        ['Zigzag', ['11..........', '2211........', '332211......', '44332211....', '.44332211...', '...44332211.', '.....443322.', '.......4433.', '.........44.']],
        ['Steel maze', ['5555555555.5', 'XXXXXXXXX..X', '4444444444..', '..XXXXXXXXXX', '3333333333P3', 'XXXXXXXX..XX', '222222222222']],
        ['Rainbow', ['555555555555', '444444444444', '333333333333', '222222222222', '111111111111', 'P.P.P.P.P.P.']],
        ['Chain reaction', ['BBBBBBBBBBBB', '5.5.5.5.5.5.', 'BBBBBBBBBBBB', '.4.4.4.4.4.4', 'BBBBBBBBBBBB']],
        ['The vault', ['XXXXXXXXXXXX', 'X5555555555X', 'X5XXXXXXXX5X', 'X5X3PPPP3X5X', 'X5X333333X5X', 'X5XXXX.XXX5X', 'X5555555555X', 'XXXXX..XXXXX']],
        ['Invader II', ['..3......3..', '...3....3...', '..33333333..', '.33.3333.33.', '444444444444', '4.44444444.4', '4.4......4.4', '...44..44...']],
        ['Diamond', ['.....55.....', '....4444....', '...333333...', '..22222222..', '.1111PP1111.', '..22222222..', '...333333...', '....4444....', '.....55.....']],
        ['Steel bars', ['5.5.5.5.5.5.', 'X.X.X.X.X.X.', '4.4.4.4.4.4.', '.3.3.3.3.3.3', '.X.X.X.X.X.X', '.2.2.2.2.2.2', '1B1B1B1B1B1B']],
        ['Smiley', ['...444444...', '..4......4..', '.4.55..55.4.', '.4.55..55.4.', '.4........4.', '.4.3....3.4.', '.4..3333..4.', '..4......4..', '...444444...']],
        ['Bomb field', ['2B2B2B2B2B2B', 'B2B2B2B2B2B2', '2B2B2B2B2B2B', '............', '555555555555']],
        ['Arrow', ['.....33.....', '....3333....', '...333333...', '..33333333..', '.....44.....', '.....44.....', '.....44.....', '....5555....']],
        ['Ladder', ['X5555555555X', 'X..........X', 'X4444444444X', 'X..........X', 'X3333333333X', 'X..........X', 'X2222222222X', 'X....PP....X']],
        ['Waves', ['11......1111', '.22....22...', '..33..33....', '...4444.....', '....55......', '...4444.....', '..33..33....', '.22....22...']],
        ['Fortress II', ['XXXX....XXXX', 'X555....555X', 'X5B5....5B5X', 'X555.PP.555X', 'XXXX....XXXX', '.4444..4444.', '.3333..3333.']],
        ['Galaxy', ['....5..5....', '..4..44..4..', '.3.3....3.3.', '2..2.PP.2..2', '.3.3....3.3.', '..4..44..4..', '....5..5....']],
        ['Columns', ['5..5..5..5..', '4..4..4..4..', '3..3..3..3..', '2..2..2..2..', '1..1..1..1..', 'P..P..P..P..']],
        ['Final boss', ['XXXXXXXXXXXX', 'X5555555555X', 'X5BBBBBBBB5X', 'X5B444444B5X', 'X5B4PPPP4B5X', 'X5B444444B5X', 'X5BBBBBBBB5X', 'X5555555555X', 'XXXXX..XXXXX']],
    ];
    function genLevel(n) {
        const rng = Arcade.seeded(Arcade.hash('bricks' + n)), rows = 5 + Math.min(7, Math.floor(n / 4)), out = [], maxHp = Math.min(5, 2 + Math.floor(n / 5));
        for (let r = 0; r < rows; r++) {
            let half = ''; const rowHp = 1 + Math.floor(rng() * maxHp);
            for (let col = 0; col < 6; col++) { const x = rng(); half += x < 0.16 ? '.' : x < 0.2 ? 'X' : x < 0.25 ? 'B' : x < 0.29 ? 'P' : String(clamp(rowHp + (rng() < 0.3 ? 1 : 0), 1, 5)); }
            out.push(half + half.split('').reverse().join(''));
        }
        return ['Generated #' + (n + 1), out];
    }
    const levelAt = (n) => (n < LEVELS.length ? LEVELS[n] : genLevel(n));
    const POWERS = {
        multi: { c: '#56c8dc', l: '×3', t: 'Multi-ball', w: 14 }, wide: { c: '#4fc07f', l: '⟷', t: 'Wide paddle', w: 12 }, slow: { c: '#6ba6ee', l: '🐢', t: 'Slow ball', w: 10 },
        fire: { c: '#f2893d', l: '🔥', t: 'Fireball', w: 8 }, laser: { c: '#ef5b56', l: '⚡', t: 'Lasers', w: 9 }, life: { c: '#f08aa7', l: '❤', t: 'Extra life', w: 4 },
        catch: { c: '#b9dc6e', l: '🧲', t: 'Catch, click to launch', w: 9 }, mega: { c: '#f6c445', l: '⬤', t: 'Mega ball', w: 7 }, extra: { c: '#d98ae0', l: '+1', t: 'Extra ball', w: 10 },
        shrink: { c: Arcade.ui.dim, l: '⟶⟵', t: 'Shrunk paddle!', w: 8, bad: true },
    };
    const PKEYS = Object.keys(POWERS);
    const pickPower = (good) => { const list = PKEYS.filter(k => !(good && POWERS[k].bad)); let r = Math.random() * list.reduce((a, k) => a + POWERS[k].w, 0); for (const k of list) { r -= POWERS[k].w; if (r <= 0) return k; } return list[0]; };
    let unlocked = Arcade.load('arcade.physics.level', 0) || 0;
    let stars = Arcade.load('arcade.physics.stars', {}) || {};
    let custom = Arcade.load('arcade.physics.custom', []) || [];
    let G = null, bbPaused = false;
    const freshPw = () => ({ wide: 0, slow: 0, fire: 0, laser: 0, catch: 0, mega: 0, shrink: 0 });
    function newGame(levelNo, rows, name, test) {
        G = { level: levelNo, rows, name, test: !!test, score: 0, lives: 3, lostLevel: 0, balls: [], bricks: [], drops: [], bolts: [], p: { x: BW / 2, y: 600, w: 84, tw: 84, h: 12 }, pw: freshPw(), combo: 0, laserCd: 0, fx: new Arcade.Particles(500), msg: '', msgT: 0, serveT: 0, over: false };
        loadBricks(rows); serve(); bbPaused = false; hud();
    }
    function loadBricks(rows) {
        G.bricks = [];
        rows.forEach((row, r) => { for (let col = 0; col < COLS; col++) { const ch = row[col]; if (!ch || !BRICK[ch]) continue; const d = BRICK[ch]; G.bricks.push({ col, r, x: LEFT + col * CW + 1, y: TOP + r * CH + 1, w: CW - 2, h: CH - 2, t: ch, hp: d.hp, alive: true, hit: 0 }); } });
    }
    function serve() { G.balls = [{ x: G.p.x, y: G.p.y - 7, vx: 0, vy: 0, r: 6, stuck: true, off: 0 }]; G.combo = 0; G.serveT = 0; }
    const baseSpeed = () => Math.min(520, 360 + (G.level >= 0 ? G.level : 3) * 7) * (G.pw.slow > 0 ? 0.68 : 1) + Math.min(120, G.serveT * 4);
    function launch() {
        let any = false;
        for (const b of G.balls) if (b.stuck) { b.stuck = false; any = true; const a = -Math.PI / 2 + (b.off ? clamp(b.off / (G.p.w / 2), -1, 1) * 0.9 : (Math.random() - 0.5) * 0.6), sp = baseSpeed(); b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; }
        return any;
    }
    function damage(k, n) {
        if (!k.alive || k.t === 'X') return;
        k.hp -= n; k.hit = 0.15; G.score += 10;
        if (k.hp > 0) { Arcade.tone(300 + k.hp * 90, 0.06, 'square', 0.03); return; }
        k.alive = false; G.combo++;
        G.score += 50 * Math.max(1, Math.floor(G.combo / 4) + 1);
        const col = BRICK[k.t].c;
        G.fx.emit(k.x + k.w / 2, k.y + k.h / 2, { n: 10, speed: 140, color: [col, '#fff'], life: 0.5, size: 3, gravity: 300 });
        Arcade.tone(520 + Math.min(G.combo, 20) * 40, 0.07, 'triangle', 0.05);
        if (k.t === 'P' || Math.random() < 0.11) G.drops.push({ x: k.x + k.w / 2, y: k.y + k.h / 2, t: pickPower(k.t === 'P') });
        if (k.t === 'B') {
            Arcade.sfx('boom');
            G.fx.emit(k.x + k.w / 2, k.y + k.h / 2, { n: 30, speed: 260, color: ['#9a6de0', '#e8a8dc', '#fff'], life: 0.6, size: 4 });
            for (const o of G.bricks) if (o.alive && Math.abs(o.col - k.col) <= 1 && Math.abs(o.r - k.r) <= 1) damage(o, 99);
        }
    }
    function applyPower(t) {
        Arcade.sfx(POWERS[t].bad ? 'bad' : 'power');
        G.msg = POWERS[t].t; G.msgT = 1.6;
        if (t === 'multi') { const add = []; for (const b of G.balls.slice(0, 8)) { if (b.stuck) continue; const sp = Math.hypot(b.vx, b.vy), a = Math.atan2(b.vy, b.vx); for (const d of [-0.4, 0.4]) add.push({ x: b.x, y: b.y, vx: Math.cos(a + d) * sp, vy: Math.sin(a + d) * sp, r: 6 }); } G.balls.push(...add); }
        else if (t === 'extra') { const a = -Math.PI / 2 + (Math.random() - 0.5), sp = baseSpeed(); G.balls.push({ x: G.p.x, y: G.p.y - 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 6 }); }
        else if (t === 'life') G.lives = Math.min(9, G.lives + 1);
        else if (t === 'shrink') { G.pw.shrink = 8; G.pw.wide = 0; }
        else if (t === 'wide') { G.pw.wide = 14; G.pw.shrink = 0; }
        else G.pw[t] = t === 'catch' ? 12 : 10;
    }
    function stepBB(dt) {
        if (!G || G.over || bbPaused) return;
        const p = G.p;
        G.serveT += dt;
        for (const k of Object.keys(G.pw)) G.pw[k] = Math.max(0, G.pw[k] - dt);
        p.tw = G.pw.wide > 0 ? 134 : G.pw.shrink > 0 ? 54 : 84;
        p.w += (p.tw - p.w) * Math.min(1, dt * 8);
        if (keys.left) p.x -= 520 * dt;
        if (keys.right) p.x += 520 * dt;
        p.x = clamp(p.x, p.w / 2, BW - p.w / 2);
        G.msgT -= dt;
        for (const k of G.bricks) if (k.hit > 0) k.hit -= dt;
        G.laserCd -= dt;
        if (G.pw.laser > 0 && (keys.fire || pointerDown) && G.laserCd <= 0) { G.laserCd = 0.28; G.bolts.push({ x: p.x - p.w / 2 + 6, y: p.y }, { x: p.x + p.w / 2 - 6, y: p.y }); Arcade.sfx('shoot'); }
        for (const bo of G.bolts) { bo.y -= 620 * dt; for (const k of G.bricks) if (k.alive && bo.x > k.x && bo.x < k.x + k.w && bo.y > k.y && bo.y < k.y + k.h) { damage(k, 1); bo.dead = true; break; } if (bo.y < 40) bo.dead = true; }
        G.bolts = G.bolts.filter(b => !b.dead);
        const sp = baseSpeed(), mega = G.pw.mega > 0;
        for (const b of G.balls) {
            b.r = mega ? 10 : 6;
            if (b.stuck) { b.x = p.x + (b.off || 0); b.y = p.y - b.r - 1; continue; }
            const cs = Math.hypot(b.vx, b.vy) || 1; b.vx *= sp / cs; b.vy *= sp / cs;
            if (Math.abs(b.vy) < sp * 0.25) { b.vy = Math.sign(b.vy || -1) * sp * 0.25; b.vx = Math.sign(b.vx || 1) * Math.sqrt(Math.max(0, sp * sp - b.vy * b.vy)); }
            const steps = Math.ceil(sp * dt / 4), h = dt / steps;
            for (let s = 0; s < steps && !b.dead && !b.stuck; s++) {
                b.x += b.vx * h; b.y += b.vy * h;
                if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
                if (b.x > BW - b.r) { b.x = BW - b.r; b.vx = -Math.abs(b.vx); }
                if (b.y < 40 + b.r) { b.y = 40 + b.r; b.vy = Math.abs(b.vy); }
                if (b.vy > 0 && b.y + b.r >= p.y && b.y - b.r <= p.y + p.h && b.x >= p.x - p.w / 2 - b.r && b.x <= p.x + p.w / 2 + b.r) {
                    if (G.pw.catch > 0) { b.stuck = true; b.off = b.x - p.x; b.vx = b.vy = 0; Arcade.tone(300, 0.05, 'sine', 0.05); break; }
                    const off = clamp((b.x - p.x) / (p.w / 2), -1, 1), a = -Math.PI / 2 + off * 1.05;
                    b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.y = p.y - b.r;
                    G.combo = 0; Arcade.tone(220, 0.05, 'sine', 0.06);
                }
                for (const k of G.bricks) {
                    if (!k.alive) continue;
                    const cx = clamp(b.x, k.x, k.x + k.w), cy = clamp(b.y, k.y, k.y + k.h), dx = b.x - cx, dy = b.y - cy;
                    if (dx * dx + dy * dy > b.r * b.r) continue;
                    const fire = G.pw.fire > 0 && k.t !== 'X';
                    damage(k, fire ? 99 : mega ? 2 : 1);
                    if (k.t === 'X') Arcade.tone(900, 0.04, 'square', 0.02);
                    if (!fire) {
                        const ox = Math.min(b.x + b.r - k.x, k.x + k.w - (b.x - b.r)), oy = Math.min(b.y + b.r - k.y, k.y + k.h - (b.y - b.r));
                        if (ox < oy) { b.vx = b.x < k.x + k.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx); b.x += b.vx > 0 ? ox : -ox; }
                        else { b.vy = b.y < k.y + k.h / 2 ? -Math.abs(b.vy) : Math.abs(b.vy); b.y += b.vy > 0 ? oy : -oy; }
                        break;
                    }
                }
                if (b.y > BH + 20) b.dead = true;
            }
        }
        G.balls = G.balls.filter(b => !b.dead);
        if (!G.balls.length) {
            G.lives--; G.lostLevel++; Arcade.sfx('die');
            G.pw = freshPw(); G.drops = []; G.bolts = [];
            if (G.lives <= 0) return gameOver(false);
            serve();
        }
        for (const d of G.drops) { d.y += 150 * dt; if (d.y > p.y - 8 && d.y < p.y + p.h + 8 && Math.abs(d.x - p.x) < p.w / 2 + 12) { d.dead = true; applyPower(d.t); } if (d.y > BH) d.dead = true; }
        G.drops = G.drops.filter(d => !d.dead);
        G.fx.update(dt);
        if (!G.bricks.some(k => k.alive && k.t !== 'X')) levelClear();
        hud();
    }
    function levelClear() {
        const bonus = 500 + G.lives * 250;
        G.score += bonus; Arcade.sfx('win');
        if (G.test) { Arcade.toast('Level cleared! Back to the editor', 'good'); setTab('editor'); return; }
        if (G.level >= 0) {
            const st = G.lostLevel === 0 ? 3 : G.lostLevel === 1 ? 2 : 1;
            stars[G.level] = Math.max(stars[G.level] || 0, st); Arcade.save('arcade.physics.stars', stars);
            if (G.level + 1 > unlocked) { unlocked = G.level + 1; Arcade.save('arcade.physics.level', unlocked); }
            Arcade.report('score', G.score); Arcade.count('levels');
            Arcade.toast(`${G.name} cleared! ${'★'.repeat(st)}${'☆'.repeat(3 - st)} +${bonus}`, 'gold', 2400);
            const next = G.level + 1, [nm, rows] = levelAt(next);
            G.level = next; G.name = nm; G.rows = rows; G.lostLevel = 0;
            loadBricks(rows); serve(); G.drops = []; G.bolts = []; G.pw = freshPw();
        } else gameOver(true);
    }
    function gameOver(won) {
        G.over = true;
        if (G.test) { Arcade.toast('Out of lives, back to the editor', null, 1500); setTab('editor'); return; }
        const r = Arcade.best('arcade.physics.best', G.score);
        Arcade.report('score', G.score);
        Arcade.addXP(Math.min(60, Math.floor(G.score / 200)), true);
        showEnd(won ? 'Level cleared!' : 'Game over', won, Arcade.fmt(G.score), r.isNew, G.name + (G.level >= 0 ? ' · level ' + (G.level + 1) : ''));
    }
    function showEnd(title, good, big, isNew, text) {
        $('endTitle').textContent = title; $('endTitle').className = good ? 'good' : 'bad';
        $('endScore').textContent = big; $('newBest').hidden = !isNew; $('endText').textContent = text;
        $('endLv').hidden = tab !== 'play';
        Arcade.show('endOv'); hud();
    }
    function drawBrickBB(g, k, x, y, w, h) {
        const hp = k.t === 'X' || k.t === 'B' || k.t === 'P' ? 0 : k.hp;
        g.fillStyle = hp ? HP_C[Math.max(1, Math.min(5, hp))] : BRICK[k.t].c;
        g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, 4); else g.rect(x, y, w, h); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 2, y + 2, w - 4, 3);
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x + 2, y + h - 4, w - 4, 2);
        if (k.hit > 0) { g.fillStyle = `rgba(255,255,255,${k.hit * 4})`; g.fillRect(x, y, w, h); }
        g.textAlign = 'center'; g.textBaseline = 'middle';
        if (k.t === 'X') { g.fillStyle = Arcade.ui.muted; for (const dx of [5, w - 5]) { g.beginPath(); g.arc(x + dx, y + h / 2, 1.8, 0, TAU); g.fill(); } }
        else if (k.t === 'B') { g.font = '11px Fredoka, sans-serif'; g.fillText('💣', x + w / 2, y + h / 2 + 1); }
        else if (k.t === 'P') { g.fillStyle = '#fff'; g.font = '800 11px Fredoka, sans-serif'; g.fillText('★', x + w / 2, y + h / 2 + 1); }
        else if (hp > 1) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.font = '800 10px Fredoka, sans-serif'; g.fillText(hp, x + w / 2, y + h / 2 + 1); }
    }
    function drawBB(g) {
        const grd = Arcade.ui.bg2;
        g.fillStyle = grd; g.fillRect(0, 0, BW, BH);
        g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(0, 0, BW, 40);
        g.fillStyle = Arcade.ui.text; g.font = '700 13px Fredoka, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText(G.name + (G.level >= 0 ? '  ·  Lv ' + (G.level + 1) : ''), 12, 20);
        g.textAlign = 'right'; g.fillText('❤'.repeat(Math.min(G.lives, 6)) + (G.lives > 6 ? '+' : ''), BW - 12, 20);
        let px = 200;
        for (const [k, v] of Object.entries(G.pw)) if (v > 0) { g.fillStyle = POWERS[k].c; g.textAlign = 'center'; g.fillText(POWERS[k].l + ' ' + Math.ceil(v), px, 20); px += 44; }
        for (const k of G.bricks) if (k.alive) drawBrickBB(g, k, k.x, k.y, k.w, k.h);
        for (const d of G.drops) { const P = POWERS[d.t]; g.fillStyle = P.c; g.beginPath(); if (g.roundRect) g.roundRect(d.x - 17, d.y - 8, 34, 16, 8); else g.rect(d.x - 17, d.y - 8, 34, 16); g.fill(); g.fillStyle = '#fff'; g.font = '800 10px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText(P.l, d.x, d.y + 1); }
        g.fillStyle = '#f7a8a1'; for (const bo of G.bolts) g.fillRect(bo.x - 1.5, bo.y - 8, 3, 12);
        const p = G.p, pg = g.createLinearGradient(0, p.y, 0, p.y + p.h);
        pg.addColorStop(0, G.pw.catch > 0 ? '#c9e486' : '#fda4af'); pg.addColorStop(1, G.pw.shrink > 0 ? Arcade.ui.dim : '#ee5a72');
        g.fillStyle = pg; g.beginPath(); if (g.roundRect) g.roundRect(p.x - p.w / 2, p.y, p.w, p.h, 6); else g.rect(p.x - p.w / 2, p.y, p.w, p.h); g.fill();
        if (G.pw.laser > 0) { g.fillStyle = '#ef5b56'; g.fillRect(p.x - p.w / 2 + 3, p.y - 5, 6, 6); g.fillRect(p.x + p.w / 2 - 9, p.y - 5, 6, 6); }
        for (const b of G.balls) { g.fillStyle = G.pw.fire > 0 ? '#f59a55' : G.pw.mega > 0 ? '#f8d25c' : '#fff'; g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill(); }
        G.fx.draw(g);
        g.textAlign = 'center';
        if (G.combo >= 4) { g.fillStyle = '#fde68a'; g.font = '800 15px Fredoka, sans-serif'; g.fillText('Combo ×' + (Math.floor(G.combo / 4) + 1), BW / 2, 470); }
        if (G.msgT > 0) { g.globalAlpha = Math.min(1, G.msgT); g.fillStyle = '#fff'; g.font = '800 22px Fredoka, sans-serif'; g.fillText(G.msg, BW / 2, 420); g.globalAlpha = 1; }
        if (G.balls.some(b => b.stuck)) { g.fillStyle = 'rgba(255,255,255,0.75)'; g.font = '600 13px Fredoka, sans-serif'; g.fillText('Click, tap or press Space to launch', BW / 2, 540); }
        if (bbPaused) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, BW, BH); g.fillStyle = '#fff'; g.font = '800 30px Fredoka, sans-serif'; g.fillText('Paused', BW / 2, BH / 2); }
    }
    function startLevel(n) { Arcade.hide('lvOv'); Arcade.hide('endOv'); const [nm, rows] = levelAt(n); newGame(n, rows, nm); }
    function buildLvGrid() {
        const host = $('lvGrid'); host.innerHTML = '';
        const n = Math.max(LEVELS.length, unlocked + 1);
        for (let i = 0; i < n + 3; i++) {
            const b = document.createElement('button'), st = stars[i] || 0;
            b.innerHTML = `<b>${i + 1}</b>${levelAt(i)[0]}<i>${i <= unlocked ? '★'.repeat(st) + '☆'.repeat(3 - st) : '🔒'}</i>`;
            b.disabled = i > unlocked;
            b.onclick = () => startLevel(i);
            host.appendChild(b);
        }
    }
    $('lvBtn').onclick = () => { buildLvGrid(); Arcade.show('lvOv'); };
    $('endLv').onclick = () => { Arcade.hide('endOv'); buildLvGrid(); Arcade.show('lvOv'); };
    $('endGo').onclick = () => { Arcade.hide('endOv'); if (tab === 'ballz') zNew(); else if (G.level >= 0) startLevel(G.level); else newGame(-1, G.rows, G.name); };
    $('pauseBtn').onclick = () => { bbPaused = !bbPaused; $('pauseBtn').textContent = bbPaused ? '▶ Resume' : '⏸ Pause'; };
    function buildMy() {
        const host = $('myList'); host.innerHTML = '';
        if (!custom.length) host.innerHTML = '<p class="small muted center">Nothing yet, build one in the ✏️ Level Editor.</p>';
        custom.forEach((lv, i) => {
            const row = document.createElement('div'); row.className = 'lv-row';
            row.innerHTML = '<b></b><button class="btn sm primary">▶ Play</button><button class="btn sm">✏️</button><button class="btn sm ghost">✕</button>';
            row.querySelector('b').textContent = lv.name;
            const [play, edit, del] = row.querySelectorAll('button');
            play.onclick = () => { Arcade.hide('myOv'); if (tab !== 'play') setTab('play', true); newGame(-1, lv.rows, lv.name); };
            edit.onclick = () => { Arcade.hide('myOv'); ed.rows = padRows(lv.rows); ed.name = lv.name; setTab('editor'); };
            del.onclick = () => { custom.splice(i, 1); Arcade.save('arcade.physics.custom', custom); buildMy(); };
            host.appendChild(row);
        });
    }
    $('myBtn').onclick = () => { buildMy(); Arcade.show('myOv'); };
    $('impBtn').onclick = () => {
        const rows = decodeLevel($('impCode').value);
        if (!rows) { Arcade.toast('That is not a level code', 'bad'); return; }
        custom.unshift({ name: 'Imported ' + new Date().toLocaleDateString(), rows }); Arcade.save('arcade.physics.custom', custom);
        $('impCode').value = ''; buildMy(); Arcade.toast('Level added', 'good');
    };

    /* =====================================================================
       BALLZ (manual)
       ===================================================================== */
    const ZW = 420, ZC = 7, ZS = 54, ZX = 21, ZT = 80, ZF = 590;
    let Z = null, zSpeed = 1;
    const zbest = () => Arcade.load('arcade.physics.ballz', 0) || 0;
    function zNew() {
        Z = { round: 1, n: 1, pending: 0, lx: ZW / 2, bricks: [], plus: [], balls: [], state: 'aim', aim: null, fired: 0, fireT: 0, first: null, fx: new Arcade.Particles(400), over: false, texts: [] };
        zAddRow(); zShift();
        hud();
    }
    function zAddRow() {
        const free = [];
        for (let col = 0; col < ZC; col++) {
            if (Math.random() < 0.58) { const hp = Math.random() < 0.22 ? Z.round * 2 : Z.round; Z.bricks.push({ col, row: 0, hp, max: hp }); }
            else free.push(col);
        }
        if (!free.length) { const k = Z.bricks.pop(); free.push(k.col); }
        Z.plus.push({ col: free[Math.floor(Math.random() * free.length)], row: 0 });
    }
    function zShift() {
        for (const k of Z.bricks) k.row++;
        for (const p of Z.plus) p.row++;
        for (const p of Z.plus) if (p.row >= 9) { p.dead = true; Z.pending++; }
        Z.plus = Z.plus.filter(p => !p.dead);
        if (Z.bricks.some(k => k.row >= 9)) zOver();
    }
    function zOver() {
        Z.over = true;
        const r = Arcade.best('arcade.physics.ballz', Z.round);
        Arcade.report('ballz', Z.round);
        Arcade.addXP(Math.min(60, Z.round), true);
        Arcade.sfx('die');
        showEnd('Game over', false, 'Round ' + Z.round, r.isNew, `${Z.n} balls · best round ${zbest()}`);
    }
    const zRect = (k) => ({ x: ZX + k.col * ZS + 2, y: ZT + k.row * ZS + 2, w: ZS - 4, h: ZS - 4 });
    function zFire(ang) { Z.aimAng = ang; Z.state = 'fire'; Z.fired = 0; Z.fireT = 0; Z.first = null; }
    function zStep(dt0) {
        if (!Z || Z.over) return;
        const dt = dt0 * zSpeed;
        Z.fx.update(dt0);
        for (const t of Z.texts) { t.t -= dt0; t.y -= 30 * dt0; }
        Z.texts = Z.texts.filter(t => t.t > 0);
        if (Z.state === 'fire') {
            Z.fireT -= dt;
            while (Z.fireT <= 0 && Z.fired < Z.n) { Z.fireT += 0.06; Z.fired++; Z.balls.push({ x: Z.lx, y: ZF - 7, vx: Math.cos(Z.aimAng) * 900, vy: Math.sin(Z.aimAng) * 900 }); }
            if (Z.fired >= Z.n) Z.state = 'roll';
        }
        const steps = Math.ceil(900 * dt / 5), h = dt / Math.max(1, steps);
        for (let s = 0; s < steps; s++) for (const b of Z.balls) {
            if (b.dead) continue;
            b.x += b.vx * h; b.y += b.vy * h;
            if (b.x < ZX + 7) { b.x = ZX + 7; b.vx = Math.abs(b.vx); }
            if (b.x > ZX + ZC * ZS - 7) { b.x = ZX + ZC * ZS - 7; b.vx = -Math.abs(b.vx); }
            if (b.y < ZT + 7) { b.y = ZT + 7; b.vy = Math.abs(b.vy); }
            if (b.vy > 0 && b.y >= ZF - 7) { b.dead = true; if (Z.first == null) Z.first = clamp(b.x, ZX + 10, ZX + ZC * ZS - 10); continue; }
            for (const k of Z.bricks) {
                if (k.dead) continue;
                const R = zRect(k), cx = clamp(b.x, R.x, R.x + R.w), cy = clamp(b.y, R.y, R.y + R.h), dx = b.x - cx, dy = b.y - cy;
                if (dx * dx + dy * dy > 49) continue;
                const ox = Math.min(b.x + 7 - R.x, R.x + R.w - (b.x - 7)), oy = Math.min(b.y + 7 - R.y, R.y + R.h - (b.y - 7));
                if (ox < oy) { b.vx = b.x < R.x + R.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx); b.x += b.vx > 0 ? ox : -ox; }
                else { b.vy = b.y < R.y + R.h / 2 ? -Math.abs(b.vy) : Math.abs(b.vy); b.y += b.vy > 0 ? oy : -oy; }
                k.hp--; k.hit = 0.1;
                if (k.hp <= 0) { k.dead = true; Z.fx.emit(R.x + R.w / 2, R.y + R.h / 2, { n: 14, speed: 150, color: [zCol(k), '#fff'], life: 0.5, size: 4 }); Arcade.tone(500 + Math.random() * 300, 0.06, 'triangle', 0.04); }
                else if (Math.random() < 0.2) Arcade.tone(300 + k.hp % 12 * 30, 0.03, 'square', 0.015);
                break;
            }
            for (const p of Z.plus) if (!p.dead && Math.hypot(b.x - (ZX + p.col * ZS + ZS / 2), b.y - (ZT + p.row * ZS + ZS / 2)) < 16) { p.dead = true; Z.pending++; Z.texts.push({ x: ZX + p.col * ZS + ZS / 2, y: ZT + p.row * ZS + ZS / 2, s: '+1', t: 0.8 }); Arcade.sfx('coin'); }
        }
        Z.bricks = Z.bricks.filter(k => !k.dead); Z.plus = Z.plus.filter(p => !p.dead); Z.balls = Z.balls.filter(b => !b.dead);
        for (const k of Z.bricks) if (k.hit > 0) k.hit -= dt0;
        if (Z.state === 'roll' && !Z.balls.length) zEndTurn();
        hud();
    }
    function zEndTurn() {
        Z.n += Z.pending; Z.pending = 0; Z.lx = Z.first ?? Z.lx; Z.round++;
        zShift();
        if (Z.over) return;
        zAddRow();
        Z.state = 'aim';
        if (Z.round % 10 === 0) Arcade.toast('Round ' + Z.round + '!', 'gold', 1200);
    }
    function zRecall() { if (!Z || Z.state === 'aim') return; for (const b of Z.balls) b.dead = true; Z.balls = []; Z.fired = Z.n; Z.state = 'roll'; if (Z.first == null) Z.first = Z.lx; }
    const zCol = (k) => `hsl(${Math.round(190 - 190 * clamp(k.hp / Math.max(2, Z.round * 2), 0, 1))},85%,58%)`;
    function zDraw(g) {
        const grd = Arcade.ui.bg2;
        g.fillStyle = grd; g.fillRect(0, 0, ZW, 640);
        g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(ZX, ZT, ZC * ZS, ZF - ZT);
        g.strokeStyle = 'rgba(239,68,68,0.45)'; g.setLineDash([6, 6]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(ZX, ZT + 9 * ZS); g.lineTo(ZX + ZC * ZS, ZT + 9 * ZS); g.stroke(); g.setLineDash([]);
        g.fillStyle = Arcade.ui.text; g.font = '800 16px Fredoka, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText('Round ' + Z.round, ZX, 40);
        g.textAlign = 'right'; g.fillText('Best ' + Math.max(zbest(), 0), ZX + ZC * ZS, 40);
        for (const k of Z.bricks) {
            const R = zRect(k);
            g.fillStyle = zCol(k); g.beginPath(); if (g.roundRect) g.roundRect(R.x, R.y, R.w, R.h, 7); else g.rect(R.x, R.y, R.w, R.h); g.fill();
            if (k.hit > 0) { g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(R.x, R.y, R.w, R.h); }
            g.fillStyle = 'rgba(0,0,0,0.75)'; g.font = '800 17px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText(k.hp, R.x + R.w / 2, R.y + R.h / 2 + 1);
        }
        for (const p of Z.plus) { const x = ZX + p.col * ZS + ZS / 2, y = ZT + p.row * ZS + ZS / 2; g.strokeStyle = '#6fd29a'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 12 + Math.sin(performance.now() / 160) * 2, 0, TAU); g.stroke(); g.fillStyle = '#6fd29a'; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); }
        g.fillStyle = 'rgba(148,163,184,0.5)'; g.fillRect(ZX, ZF, ZC * ZS, 2);
        if (Z.state === 'aim' && Z.aim) {
            // dotted aim line, with one wall bounce previewed
            let x = Z.lx, y = ZF - 7, vx = Math.cos(Z.aim), vy = Math.sin(Z.aim), bounced = 0;
            g.fillStyle = 'rgba(255,255,255,0.8)';
            for (let i = 0; i < 90; i++) {
                x += vx * 8; y += vy * 8;
                if (x < ZX + 7 || x > ZX + ZC * ZS - 7) { if (bounced++) break; vx = -vx; }
                if (y < ZT + 7) break;
                if (Z.bricks.some(k => { const R = zRect(k); return x > R.x - 6 && x < R.x + R.w + 6 && y > R.y - 6 && y < R.y + R.h + 6; })) break;
                if (i % 2 === 0) { g.beginPath(); g.arc(x, y, 2.4, 0, TAU); g.fill(); }
            }
        }
        for (const b of Z.balls) { g.fillStyle = '#fff'; g.beginPath(); g.arc(b.x, b.y, 7, 0, TAU); g.fill(); }
        if (Z.state !== 'roll' || Z.fired < Z.n) { g.fillStyle = '#fff'; g.beginPath(); g.arc(Z.lx, ZF - 7, 7, 0, TAU); g.fill(); }
        g.fillStyle = Arcade.ui.muted; g.font = '700 12px Fredoka, sans-serif'; g.textAlign = 'center';
        g.fillText('×' + (Z.state === 'aim' ? Z.n : Z.n - Z.fired), Z.lx, ZF + 15);
        Z.fx.draw(g);
        for (const t of Z.texts) { g.globalAlpha = Math.min(1, t.t * 2); g.fillStyle = '#6fd29a'; g.font = '900 16px Fredoka, sans-serif'; g.fillText(t.s, t.x, t.y); }
        g.globalAlpha = 1;
        if (Z.state === 'aim' && !Z.aim) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = '600 13px Fredoka, sans-serif'; g.fillText('Drag to aim, release to shoot', ZW / 2, 630); }
    }
    $('zSpeedBtn').onclick = () => { zSpeed = zSpeed === 1 ? 2 : zSpeed === 2 ? 4 : 1; $('zSpeedBtn').textContent = '⏩ ×' + zSpeed; };
    $('zRecallBtn').onclick = zRecall;
    $('zNewBtn').onclick = () => { if (Z && Z.round > 3 && !Z.over && !confirm('Start a new game?')) return; Arcade.hide('endOv'); zNew(); };

    /* =====================================================================
       LEVEL EDITOR
       ===================================================================== */
    const padRows = (rows) => Array.from({ length: ROWS }, (_, r) => ((rows[r] || '') + '.'.repeat(COLS)).slice(0, COLS));
    const trimRows = (rows) => { const out = rows.slice(); while (out.length && /^\.+$/.test(out[out.length - 1])) out.pop(); return out; };
    const encodeLevel = (rows) => 'BL1:' + trimRows(rows).join('/');
    function decodeLevel(code) {
        const m = /^BL1:([.12345XBP/]+)$/.exec((code || '').trim());
        if (!m) return null;
        const rows = m[1].split('/').slice(0, ROWS).map(r => (r + '.'.repeat(COLS)).slice(0, COLS));
        return rows.some(r => /[12345BP]/.test(r)) ? rows : null;
    }
    const ed = { rows: padRows([]), brush: '1', mirror: Arcade.load('arcade.physics.mirror', true), hover: null, name: '' };
    const PAL = [['.', 'Erase', Arcade.ui.surface2], ['1', '1', HP_C[1]], ['2', '2', HP_C[2]], ['3', '3', HP_C[3]], ['4', '4', HP_C[4]], ['5', '5', HP_C[5]], ['X', 'Steel', BRICK.X.c], ['B', '💣', BRICK.B.c], ['P', '★', BRICK.P.c]];
    function buildPal() {
        const host = $('pal'); host.innerHTML = '';
        for (const [k, label, col] of PAL) {
            const b = document.createElement('button');
            b.textContent = label; b.style.background = col; b.className = k === ed.brush ? 'on' : '';
            b.title = k === '.' ? 'Erase' : k === 'X' ? 'Unbreakable steel' : k === 'B' ? 'Bomb: blows up its neighbours' : k === 'P' ? 'Power brick: always drops a power-up' : k + ' hit' + (k === '1' ? '' : 's');
            b.onclick = () => { ed.brush = k; buildPal(); };
            host.appendChild(b);
        }
        $('mirBtn').classList.toggle('on', ed.mirror);
    }
    $('mirBtn').onclick = () => { ed.mirror = !ed.mirror; Arcade.save('arcade.physics.mirror', ed.mirror); buildPal(); };
    $('clearBtn').onclick = () => { ed.rows = padRows([]); Arcade.toast('Cleared', null, 900); };
    $('testBtn').onclick = () => {
        if (!ed.rows.some(r => /[12345BP]/.test(r))) { Arcade.toast('Place some breakable bricks first', 'bad'); return; }
        setTab('play', true);
        newGame(-1, trimRows(ed.rows), 'Test: ' + (ed.name || 'my level'), true);
    };
    $('saveBtn').onclick = () => {
        if (!ed.rows.some(r => /[12345BP]/.test(r))) { Arcade.toast('Place some breakable bricks first', 'bad'); return; }
        const name = (prompt('Name your level', ed.name || 'My level ' + (custom.length + 1)) || '').trim();
        if (!name) return;
        ed.name = name;
        const i = custom.findIndex(l => l.name === name), lv = { name, rows: trimRows(ed.rows) };
        if (i >= 0) custom[i] = lv; else custom.unshift(lv);
        Arcade.save('arcade.physics.custom', custom);
        Arcade.toast('Saved "' + name + '", play it from ⭐ My levels', 'good', 2200);
    };
    $('codeBtn').onclick = () => { const code = encodeLevel(ed.rows); navigator.clipboard && navigator.clipboard.writeText(code).catch(() => { }); Arcade.toast('Level code copied: ' + (code.length > 40 ? code.slice(0, 40) + '…' : code), 'good', 2600); };
    function edPaint(pt, brush) {
        const col = Math.floor((pt.x - LEFT) / CW), r = Math.floor((pt.y - TOP) / CH);
        if (col < 0 || col >= COLS || r < 0 || r >= ROWS) return;
        const set = (cc) => { const row = ed.rows[r].split(''); row[cc] = brush; ed.rows[r] = row.join(''); };
        set(col); if (ed.mirror) set(COLS - 1 - col);
    }
    function drawEditor(g) {
        g.fillStyle = '#080b18'; g.fillRect(0, 0, BW, BH);
        g.fillStyle = Arcade.ui.muted; g.font = '600 12px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('Click or drag to paint · right-click erases' + (ed.mirror ? ' · mirror on' : ''), BW / 2, 30);
        for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
            const x = LEFT + col * CW, y = TOP + r * CH, ch = ed.rows[r][col];
            g.strokeStyle = 'rgba(148,163,184,0.12)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, CW - 1, CH - 1);
            if (ch !== '.') drawBrickBB(g, { t: ch, hp: BRICK[ch].hp, hit: 0 }, x + 1, y + 1, CW - 2, CH - 2);
        }
        if (ed.hover) {
            const { col, r } = ed.hover;
            g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(LEFT + col * CW + 1, TOP + r * CH + 1, CW - 2, CH - 2);
            if (ed.mirror) { g.strokeStyle = 'rgba(255,255,255,0.4)'; g.strokeRect(LEFT + (COLS - 1 - col) * CW + 1, TOP + r * CH + 1, CW - 2, CH - 2); }
        }
        g.fillStyle = 'rgba(244,63,94,0.5)'; g.beginPath(); if (g.roundRect) g.roundRect(BW / 2 - 42, 600, 84, 12, 6); else g.rect(BW / 2 - 42, 600, 84, 12); g.fill();
    }

    /* =====================================================================
       Manual
       ===================================================================== */
    const MAN = {
        'Physics Shorts': () => `<p>An endless feed of physics simulations, like satisfying ball videos. Every one is generated from a <b>seed</b>, so the same code always replays the same simulation.</p>
            <h3>Controls</h3><table>
            <tr><td>Scroll · ↓ / ↑ · swipe</td><td>Next / previous simulation</td></tr><tr><td>Space · tap</td><td>Pause</td></tr><tr><td>R</td><td>Replay</td></tr><tr><td>L</td><td>Like (saved in ❤ Liked)</td></tr>
            <tr><td>G</td><td>2×2 grid, four simulations at once; click one to open it</td></tr><tr><td>S</td><td>Open the Studio</td></tr><tr><td>⏺</td><td>Record the simulation from the start as a video (with sound)</td></tr><tr><td>🔗</td><td>Copy a code anyone can paste into 🔗 Open code</td></tr></table>
            <h3>Simulation types</h3><table>${BL.SHORTS.map(t => `<tr><td>${BL.MODES[t].icon} ${BL.MODES[t].label}</td><td>${DESC[t]}</td></tr>`).join('')}</table>
            <h3>Sound</h3><p>Every bounce plays the next note of a song, Ode to Joy, Für Elise, Korobeiniki and more. Pick the song and the instrument in the Studio.</p>`,
        'Studio': () => `<p>The Studio changes the rules of the current simulation live. Changed settings are highlighted; the code you share includes them.</p>
            <h3>Physics settings</h3><table>${BL.PARAMS.map(([k, l]) => `<tr><td>${l}</td><td>${PDESC[k]}</td></tr>`).join('')}<tr><td>Balls collide</td><td>Balls bounce off each other instead of passing through.</td></tr></table>
            <h3>Look &amp; sound</h3><p>Colour palettes (including a rainbow cycle), backgrounds, instruments, volume, and toggles for titles, visualizer bars, trails, glow and screen shake. These apply to every simulation.</p>
            <h3>Buttons</h3><table><tr><td>🎲 New seed</td><td>Same type and settings, different layout.</td></tr><tr><td>🎰 Chaos</td><td>New seed and four random settings.</td></tr><tr><td>↺ Defaults</td><td>Back to the type's normal settings.</td></tr><tr><td>Feed</td><td>Choose which types appear when you scroll.</td></tr></table>`,
        'Brick Shorts': () => `<p>A second scroller with auto-played brick-breaker simulations. It has the same controls, Studio, grid, likes and recording as Physics Shorts.</p>
            <table>${BL.BRICKS.map(t => `<tr><td>${BL.MODES[t].icon} ${BL.MODES[t].label}</td><td>${DESC[t]}</td></tr>`).join('')}</table>`,
        'Brick Breaker': () => `<p>Play it yourself: 24 handmade levels, then endless generated ones. Lose no lives on a level for ★★★.</p>
            <h3>Controls</h3><table><tr><td>Mouse / drag</td><td>Move the paddle</td></tr><tr><td>← →  or A D</td><td>Move with the keyboard</td></tr><tr><td>Click · Space</td><td>Launch the ball · fire lasers · release caught balls</td></tr><tr><td>P / Esc</td><td>Pause</td></tr></table>
            <h3>Bricks</h3><table>
            ${[1, 2, 3, 4, 5].map(n => `<tr><td><span class="chipk" style="background:${HP_C[n]}">${n}</span></td><td>Takes ${n} hit${n > 1 ? 's' : ''}</td></tr>`).join('')}
            <tr><td><span class="chipk" style="background:${BRICK.X.c}">Steel</span></td><td>Unbreakable, even fireballs bounce off.</td></tr>
            <tr><td><span class="chipk" style="background:${BRICK.B.c}">💣</span></td><td>Bomb: destroys every brick around it (chains!).</td></tr>
            <tr><td><span class="chipk" style="background:${BRICK.P.c}">★</span></td><td>Power brick: always drops a good power-up.</td></tr></table>
            <h3>Power-ups</h3><table>${PKEYS.map(k => `<tr><td><span class="chipk" style="background:${POWERS[k].c}">${POWERS[k].l}</span></td><td>${POWERS[k].t}${POWERS[k].bad ? ' (bad, dodge it)' : ''}</td></tr>`).join('')}</table>
            <h3>Scoring</h3><p>10 per hit, 50 per brick, multiplied by your combo (bricks broken without touching the paddle). Clearing a level adds 500 + 250 per life left.</p>`,
        'Ballz': () => `<p>Turn-based brick breaking. Drag to aim and release to fire every ball you own. Each brick shows how many hits it needs. Collect green rings for +1 ball.</p>
            <p>After every turn the bricks move down a row and a new, tougher row appears. If a brick reaches the red line, the game is over. The first ball to land decides where you shoot from next.</p>
            <table><tr><td>⏩</td><td>Speed up a long volley (×2, ×4)</td></tr><tr><td>⤓ Recall</td><td>Bring all balls home now</td></tr></table>`,
        'Level Editor': () => `<p>Paint a 12×14 brick layout. Choose a brick from the palette, click or drag on the grid; right-click erases. ⇋ Mirror paints both halves at once.</p>
            <table><tr><td>▶ Test</td><td>Play it straight away (you come back here when you finish)</td></tr><tr><td>💾 Save</td><td>Keeps it in ⭐ My levels in Brick Breaker</td></tr><tr><td>🔗 Code</td><td>Copies a text code; paste it into ⭐ My levels → Import to share levels</td></tr></table>`,
    };
    let manSec = 'Physics Shorts';
    function openManual() {
        const host = $('manTabs'); host.innerHTML = '';
        for (const k of Object.keys(MAN)) { const b = document.createElement('button'); b.className = 'btn sm' + (k === manSec ? ' active' : ''); b.textContent = k; b.onclick = () => { manSec = k; openManual(); }; host.appendChild(b); }
        $('manual').innerHTML = MAN[manSec]();
        Arcade.show('manualOv');
    }
    $('manualBtn').onclick = () => { manSec = { shorts: 'Physics Shorts', bricks: 'Brick Shorts', play: 'Brick Breaker', ballz: 'Ballz', editor: 'Level Editor' }[tab]; openManual(); };

    /* =====================================================================
       Tabs, HUD, input, loop
       ===================================================================== */
    function setTab(t, keepGame) {
        if (rec) stopRec();
        tab = t;
        document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
        $('barFeed').hidden = !isFeed(); $('barPlay').hidden = t !== 'play'; $('barBallz').hidden = t !== 'ballz'; $('barEditor').hidden = t !== 'editor';
        if (!isFeed()) { if (studioOpen) { studioOpen = false; $('studio').hidden = true; $('studioBtn').classList.remove('on'); } grid = false; $('gridBtn').classList.remove('on'); }
        $('sideBtns').hidden = !isFeed() || grid;
        Arcade.hide('endOv');
        if (isFeed()) { view.setSize(grid ? 720 : 360, grid ? 1280 : 640); if (!F().sim) go(F().idx, 1); slide = null; if (grid) gridSims = [0, 1, 2, 3].map(i => BL.newSim(i === 0 ? cur().spec : randomSpec(F()), i === 0)); if (studioOpen) buildStudio(); }
        else if (t === 'play') { view.setSize(BW, BH); if (!keepGame && (!G || G.over || G.test)) startLevel(Math.min(unlocked, unlocked)); }
        else if (t === 'ballz') { view.setSize(ZW, 640); if (!Z || Z.over) zNew(); }
        else { view.setSize(BW, BH); buildPal(); }
        $('help').innerHTML = isFeed() ? '<span class="desktop-only">Scroll or <kbd>↓</kbd>/<kbd>↑</kbd> to change · <kbd>Space</kbd> pause · <kbd>R</kbd> replay · <kbd>L</kbd> like · <kbd>G</kbd> grid · <kbd>S</kbd> studio</span><span class="touch-only">Swipe up for the next simulation · tap to pause</span>'
            : t === 'play' ? '<span class="desktop-only">Mouse or <kbd>←</kbd><kbd>→</kbd> to move · click / <kbd>Space</kbd> launch &amp; fire · <kbd>P</kbd> pause</span><span class="touch-only">Drag to move the paddle · tap to launch</span>'
            : t === 'ballz' ? 'Drag to aim · release to shoot · rings give +1 ball · don\'t let a brick reach the red line'
            : 'Pick a brick, paint the grid, then ▶ Test it. Save it to ⭐ My levels or share its code.';
        hud();
    }
    document.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => setTab(b.dataset.tab); });
    function hud() {
        const best = Arcade.fmt(Arcade.load('arcade.physics.best', 0) || 0);
        const set = (a, b, c2) => { Arcade.text('cAl', a[0]); Arcade.text('cA', a[1]); Arcade.text('cBl', b[0]); Arcade.text('cB', b[1]); Arcade.text('cCl', c2[0]); Arcade.text('cC', c2[1]); };
        if (isFeed()) set(['Watched', watched], ['Liked', likes.length], ['Types', F().types.length]);
        else if (tab === 'play' && G) set(['Score', Arcade.fmt(G.score)], ['Lives', G.lives], ['Best', Arcade.fmt(Math.max(G.score, Arcade.load('arcade.physics.best', 0) || 0))]);
        else if (tab === 'ballz' && Z) set(['Round', Z.round], ['Balls', Z.n], ['Best', zbest()]);
        else set(['My levels', custom.length], ['Unlocked', unlocked + 1], ['Best', best]);
    }

    const keys = { left: false, right: false, fire: false };
    let pointerDown = false, swipe0 = null, wheelLock = 0;
    cv.addEventListener('pointerdown', (e) => {
        const pt = Arcade.pointer(cv, e, view.w, view.h);
        pointerDown = true;
        if (isFeed()) {
            if (grid) { const i = (pt.x >= 360 ? 1 : 0) + (pt.y >= 640 ? 2 : 0); const sp = gridSims[i].spec; setGrid(false); loadSpec(sp); return; }
            swipe0 = { x: e.clientX, y: e.clientY, t: performance.now() }; return;
        }
        if (tab === 'play') { if (G && !G.over) { G.p.x = pt.x; launch(); } return; }
        if (tab === 'ballz') { if (Z && !Z.over && Z.state === 'aim') { Z.aiming = true; zAim(pt); } cv.setPointerCapture(e.pointerId); return; }
        if (tab === 'editor') { edPaint(pt, e.button === 2 ? '.' : ed.brush); cv.setPointerCapture(e.pointerId); }
    });
    function zAim(pt) { const a = Math.atan2(pt.y - (ZF - 7), pt.x - Z.lx); Z.aim = a < 0 ? clamp(a, -Math.PI + 0.13, -0.13) : (pt.x < Z.lx ? -Math.PI + 0.13 : -0.13); }
    cv.addEventListener('pointermove', (e) => {
        const pt = Arcade.pointer(cv, e, view.w, view.h);
        if (tab === 'play' && G && !bbPaused && (e.pointerType === 'mouse' || pointerDown)) G.p.x = pt.x;
        if (tab === 'ballz' && Z && Z.state === 'aim' && (Z.aiming || e.pointerType === 'mouse')) zAim(pt);
        if (tab === 'editor') {
            const col = Math.floor((pt.x - LEFT) / CW), r = Math.floor((pt.y - TOP) / CH);
            ed.hover = col >= 0 && col < COLS && r >= 0 && r < ROWS ? { col, r } : null;
            if (pointerDown) edPaint(pt, e.buttons === 2 ? '.' : ed.brush);
        }
    });
    const up = (e) => {
        pointerDown = false;
        if (isFeed() && swipe0) {
            const dy = e.clientY - swipe0.y, dx = e.clientX - swipe0.x;
            if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) go(F().idx + (dy < 0 ? 1 : -1), dy < 0 ? 1 : -1);
            else if (Math.abs(dy) < 10 && Math.abs(dx) < 10 && performance.now() - swipe0.t < 400) paused = !paused;
            swipe0 = null;
        }
        if (tab === 'ballz' && Z && Z.aiming) { Z.aiming = false; if (Z.state === 'aim' && Z.aim != null) { zFire(Z.aim); Z.aim = null; } }
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', () => { pointerDown = false; swipe0 = null; if (Z) Z.aiming = false; });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => {
        if (!isFeed() || grid) return;
        e.preventDefault();
        const now = performance.now();
        if (now < wheelLock || Math.abs(e.deltaY) < 8) return;
        wheelLock = now + 500;
        go(F().idx + (e.deltaY > 0 ? 1 : -1), e.deltaY > 0 ? 1 : -1);
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') { if (e.key === 'Enter' && e.target.id === 'codeIn') $('codeGo').click(); return; }
        if (isFeed()) {
            if (e.code === 'ArrowDown' || e.code === 'KeyJ') { e.preventDefault(); go(F().idx + 1, 1); }
            else if (e.code === 'ArrowUp' || e.code === 'KeyK') { e.preventDefault(); go(F().idx - 1, -1); }
            else if (e.code === 'Space') { e.preventDefault(); paused = !paused; }
            else if (e.code === 'KeyR') replay();
            else if (e.code === 'KeyL') toggleLike();
            else if (e.code === 'KeyG') setGrid(!grid);
            else if (e.code === 'KeyS') $('studioBtn').click();
            return;
        }
        if (tab === 'play') {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
            if (e.code === 'Space') { e.preventDefault(); keys.fire = true; if (G && !G.over) launch(); }
            if (e.code === 'KeyP' || e.code === 'Escape') $('pauseBtn').click();
        }
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
        if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
        if (e.code === 'Space') keys.fire = false;
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && tab === 'play' && G && !G.over) { bbPaused = true; $('pauseBtn').textContent = '▶ Resume'; } });

    const loop = Arcade.loop((dt) => {
        const k = view.scale * Math.min(window.devicePixelRatio || 1, 2);
        c.setTransform(k, 0, 0, k, 0, 0);
        if (isFeed()) {
            if (grid) {
                gridSims.forEach((S, i) => {
                    BL.stepSim(S, dt);
                    S.autoNext = 3;
                    if (S.done && S.doneT > 3) gridSims[i] = BL.newSim(randomSpec(F()), i === 0);
                    c.save(); c.translate((i % 2) * 360, Math.floor(i / 2) * 640);
                    c.beginPath(); c.rect(0, 0, 360, 640); c.clip();
                    BL.drawSim(gridSims[i], c);
                    c.restore();
                });
                c.fillStyle = '#000'; c.fillRect(358, 0, 4, 1280); c.fillRect(0, 638, 720, 4);
                return;
            }
            const S = cur();
            if (!S) return;
            S.autoNext = auto && !rec ? 3 : null;
            if (!paused) BL.stepSim(S, dt);
            if (rec && ((S.done && S.doneT > 1.5) || performance.now() - rec.t0 > 120000)) stopRec();
            if (S.done && auto && !rec && S.doneT > 3 && !slide) go(F().idx + 1, 1);
            if (slide) {
                slide.t += dt / 0.3;
                const t = Math.min(1, slide.t), ee = 1 - Math.pow(1 - t, 3), off = 640 * ee * slide.dir;
                c.save(); c.translate(0, 640 * slide.dir - off); BL.drawSim(S, c); c.restore();
                c.save(); c.setTransform(1, 0, 0, 1, 0, -off * k); c.drawImage(snap, 0, 0); c.restore();
                if (t >= 1) slide = null;
            } else BL.drawSim(S, c);
            if (paused) { c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(0, 0, 360, 640); c.fillStyle = '#fff'; c.font = '800 48px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('❚❚', 180, 320); }
        } else if (tab === 'play') { if (G) { stepBB(dt); drawBB(c); } }
        else if (tab === 'ballz') { if (Z) { zStep(dt); zDraw(c); } }
        else drawEditor(c);
    });

    syncAuto();
    setTab('shorts');
    loop.start();
    window.__bl = { go, setTab, setGrid, get sim() { return cur(); }, FEED, loadSpec, get Z() { return Z; }, zFire, get G() { return G; }, startRec, stopRec };
})();
