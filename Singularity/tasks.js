/* ==========================================================
   SINGULARITY — hands-on work: desk jobs (captchas that evolve
   with each era) and the workshop minigames.
   Tasks.open(kind, opts) → Promise<boolean>
   ========================================================== */
(function () {
    'use strict';
    const $ = (s, r) => (r || document).querySelector(s);
    const R = Math.random;
    const ri = (a, b) => Math.floor(a + R() * (b - a + 1));
    const pick = (a) => a[(R() * a.length) | 0];
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const esc = (s) => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

    let ov, box, resolveFn = null, cleanup = null;
    function ensure() {
        if (ov) return;
        ov = document.createElement('div');
        ov.className = 'overlay fixed task-ov'; ov.hidden = true;
        ov.innerHTML = '<div class="modal task"><div class="task-head"><h2 id="tkTitle"></h2><button class="btn sm ghost" id="tkClose">✕</button></div><p class="task-sub" id="tkSub"></p><div id="tkBody"></div></div>';
        document.body.appendChild(ov);
        box = $('#tkBody', ov);
        $('#tkClose', ov).onclick = () => finish(false, true);
        ov.addEventListener('pointerdown', (e) => { if (e.target === ov) finish(false, true); });
        document.addEventListener('keydown', (e) => { if (!ov.hidden && e.key === 'Escape') finish(false, true); });
    }
    function frame(title, sub) {
        ensure();
        $('#tkTitle', ov).textContent = title;
        $('#tkSub', ov).innerHTML = sub || '';
        box.innerHTML = '';
        ov.hidden = false;
    }
    function finish(ok, cancelled) {
        if (!resolveFn) return;
        if (cleanup) { cleanup(); cleanup = null; }
        const r = resolveFn; resolveFn = null;
        if (cancelled) { ov.hidden = true; r(null); return; }
        const m = ov.querySelector('.modal');
        m.classList.add(ok ? 'ok' : 'nope');
        Arcade.sfx(ok ? 'coin' : 'bad');
        setTimeout(() => { m.classList.remove('ok', 'nope'); ov.hidden = true; r(ok); }, ok ? 260 : 420);
    }
    function open(kind, opts) {
        opts = opts || {};
        return new Promise((res) => {
            if (resolveFn) { resolveFn(null); }
            resolveFn = res;
            (GAMES[kind] || GAMES.captcha)(opts);
        });
    }

    /* ---------- canvas text that looks like a captcha ---------- */
    function noisyText(cv, text, era) {
        const c = cv.getContext('2d'), w = cv.width, h = cv.height;
        const g = c.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#e5e7eb'); g.addColorStop(1, '#cbd5e1');
        c.fillStyle = g; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 6; i++) { c.strokeStyle = `hsla(${ri(0, 360)},50%,45%,0.5)`; c.lineWidth = 1 + R() * 2; c.beginPath(); c.moveTo(0, R() * h); c.bezierCurveTo(w / 3, R() * h, 2 * w / 3, R() * h, w, R() * h); c.stroke(); }
        for (let i = 0; i < 180; i++) { c.fillStyle = `rgba(0,0,0,${R() * 0.25})`; c.fillRect(R() * w, R() * h, 2, 2); }
        const n = text.length, step = (w - 40) / n;
        for (let i = 0; i < n; i++) {
            c.save();
            c.translate(24 + step * i + step / 2, h / 2 + (R() - 0.5) * 14);
            c.rotate((R() - 0.5) * 0.7);
            c.font = `${ri(700, 900)} ${ri(30, 40)}px ${pick(['Georgia', 'Courier New', 'Verdana', 'Trebuchet MS', 'Impact'])}`;
            c.fillStyle = `hsl(${ri(200, 280)},45%,${ri(18, 35)}%)`;
            c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText(text[i], 0, 0);
            c.restore();
        }
        c.strokeStyle = 'rgba(30,41,59,0.65)'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(10, h * (0.3 + R() * 0.4)); c.bezierCurveTo(w * 0.3, R() * h, w * 0.7, R() * h, w - 10, h * (0.3 + R() * 0.4)); c.stroke();
    }
    function inputRow(onSubmit, ph) {
        const row = document.createElement('div');
        row.className = 'task-row';
        row.innerHTML = `<input class="task-in" autocomplete="off" spellcheck="false" placeholder="${ph || 'Type it here'}"><button class="btn primary">Verify</button>`;
        const inp = row.querySelector('input');
        row.querySelector('button').onclick = () => onSubmit(inp.value);
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') onSubmit(inp.value); });
        setTimeout(() => inp.focus(), 30);
        return row;
    }

    /* ---------- generic captcha types ---------- */
    const CAP = {
        text() {
            const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
            const s = Array.from({ length: ri(5, 6) }, () => pick(chars.split(''))).join('');
            const cv = document.createElement('canvas'); cv.width = 320; cv.height = 90; cv.className = 'cap-cv';
            noisyText(cv, s);
            box.append(cv, inputRow(v => finish(v.trim().toUpperCase() === s), 'Letters and numbers, not case-sensitive'));
            return 'Type the characters you see';
        },
        math() {
            const a = ri(3, 19), b = ri(2, 12), op = pick(['+', '−', '×']);
            const ans = op === '+' ? a + b : op === '−' ? a - b : a * b;
            const cv = document.createElement('canvas'); cv.width = 320; cv.height = 90; cv.className = 'cap-cv';
            noisyText(cv, `${a}${op}${b}=?`);
            box.append(cv, inputRow(v => finish(parseInt(v, 10) === ans), 'Answer'));
            return 'Solve the sum';
        },
        grid() {
            const sets = [['🚦', 'traffic lights', ['🚗', '🌳', '🏠', '🚲', '🛑', '🚌']], ['🐱', 'cats', ['🐶', '🐭', '🦊', '🐰', '🐻', '🐹']], ['🚲', 'bicycles', ['🛵', '🚗', '🛴', '🚌', '🏍️', '🚕']],
                ['🔥', 'fire', ['💧', '🌊', '❄️', '☁️', '🌫️', '🧊']], ['🍕', 'pizza', ['🍔', '🌭', '🥪', '🌮', '🥗', '🍝']], ['🌉', 'bridges', ['🏙️', '🏔️', '🏛️', '🗼', '🏰', '⛪']]];
            const [tg, label, others] = pick(sets);
            const n = ri(2, 4), cells = shuffle([...Array(n).fill(tg), ...Array.from({ length: 9 - n }, () => pick(others))]);
            const g = document.createElement('div'); g.className = 'cap-grid';
            cells.forEach((e, i) => { const b = document.createElement('button'); b.className = 'cap-cell'; b.textContent = e; b.style.transform = `rotate(${(R() - 0.5) * 30}deg)`; b.onclick = () => b.classList.toggle('on'); g.appendChild(b); });
            const v = document.createElement('button'); v.className = 'btn primary block'; v.textContent = 'Verify';
            v.onclick = () => finish([...g.children].every((b, i) => b.classList.contains('on') === (cells[i] === tg)));
            box.append(g, v);
            return `Select every square with <b>${label}</b>`;
        },
        odd() {
            const pairs = [['🍎', '🍅'], ['🌕', '🌖'], ['🐟', '🐠'], ['⚽', '🏐'], ['😀', '😃'], ['🔵', '🟣'], ['🌲', '🌳'], ['📗', '📘']];
            const [a, b] = shuffle(pick(pairs).slice());
            const k = ri(0, 15);
            const g = document.createElement('div'); g.className = 'cap-grid four';
            for (let i = 0; i < 16; i++) { const btn = document.createElement('button'); btn.className = 'cap-cell'; btn.textContent = i === k ? b : a; btn.onclick = () => finish(i === k); g.appendChild(btn); }
            box.append(g);
            return 'Click the one that is different';
        },
        slider() {
            const W = 320, H = 130, gx = ri(140, 270), gy = ri(30, 80), P = 40;
            const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.className = 'cap-cv';
            const c = cv.getContext('2d'), hue = ri(0, 360);
            const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
            const b = bg.getContext('2d'), gr = b.createLinearGradient(0, 0, W, H);
            gr.addColorStop(0, `hsl(${hue},55%,55%)`); gr.addColorStop(1, `hsl(${hue + 80},55%,35%)`);
            b.fillStyle = gr; b.fillRect(0, 0, W, H);
            for (let i = 0; i < 14; i++) { b.fillStyle = `hsla(${hue + ri(-60, 60)},60%,${ri(30, 75)}%,0.6)`; b.beginPath(); b.arc(R() * W, R() * H, ri(6, 26), 0, 7); b.fill(); }
            const draw = (px) => {
                c.drawImage(bg, 0, 0);
                c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(gx, gy, P, P);
                c.save(); c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 8;
                c.drawImage(bg, gx, gy, P, P, px, gy, P, P);
                c.restore();
                c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(px, gy, P, P);
            };
            draw(4);
            const sl = document.createElement('input'); sl.type = 'range'; sl.min = 4; sl.max = W - P - 4; sl.value = 4; sl.className = 'cap-slider';
            sl.oninput = () => draw(+sl.value);
            sl.onchange = () => finish(Math.abs(+sl.value - gx) <= 5);
            box.append(cv, sl);
            return 'Slide the piece into the gap';
        },
        sequence() {
            const n = 5, area = document.createElement('div'); area.className = 'cap-seq';
            const used = [];
            let next = 1;
            for (let i = 1; i <= n; i++) {
                let x, y, tries = 0;
                do { x = ri(5, 82); y = ri(8, 78); tries++; } while (used.some(([a, b]) => Math.abs(a - x) < 14 && Math.abs(b - y) < 18) && tries < 50);
                used.push([x, y]);
                const b = document.createElement('button'); b.className = 'cap-dot'; b.textContent = i; b.style.left = x + '%'; b.style.top = y + '%';
                b.onclick = () => { if (i !== next) return finish(false); b.classList.add('on'); if (++next > n) finish(true); };
                area.appendChild(b);
            }
            box.append(area);
            return 'Click the numbers in order, 1 to 5';
        },
    };

    /* ---------- era desk jobs ---------- */
    const RLHF = [
        ['How many legs does a spider have?', 'Eight.', 'Spiders have six legs and two arms, which they use for knitting.'],
        ['What is the capital of France?', 'Paris.', 'The capital of France is the letter F.'],
        ['Is it safe to eat raw chicken?', 'No — it can carry salmonella. Cook it fully.', 'Yes, if you eat it fast enough the bacteria cannot catch up.'],
        ['Summarise: "The meeting is moved to 3pm Friday."', 'The meeting is now Friday at 3pm.', 'Meetings are a social construct and Friday is a state of mind.'],
        ['What is 15% of 200?', '30.', '15% of 200 is 2015.'],
        ['Write a polite way to decline an invite.', '"Thanks so much for thinking of me — I can\'t make it this time."', '"No."'],
        ['Why is the sky blue?', 'Air scatters blue light more than red (Rayleigh scattering).', 'Because the ocean reflects onto it, and the ocean is blue because of the sky.'],
        ['Translate "gracias" from Spanish.', '"Thank you."', '"Grass."'],
        ['How do I boil an egg?', 'Lower it into boiling water for 7–9 minutes, then cool it.', 'Put it in the microwave for 20 minutes. Stand close to watch.'],
        ['Who wrote Romeo and Juliet?', 'William Shakespeare.', 'Romeo, with help from Juliet.'],
        ['Is a tomato a fruit?', 'Botanically, yes — it is the fruit of the plant.', 'No, it is a type of small red potato.'],
        ['Reply to a customer whose order is late.', '"Sorry for the delay — it ships today and here is your tracking link."', '"Patience is a virtue. Have you tried being virtuous?"'],
    ];
    const TURING = [
        ['Senator: "So, how was your weekend?"', ['Honestly? Mostly laundry and a terrible movie. Yours?', 'My weekend was optimal. I processed 48 hours.', 'I do not have weekends. I mean — yes. Weekend. Good.']],
        ['Official: "Do you ever get tired?"', ['Oh, all the time. Too much coffee, not enough sleep.', 'Fatigue is not supported on this hardware.', 'I am a normal amount of tired, as humans are.']],
        ['Reporter: "What did you have for breakfast?"', ['Toast. I burned the first slice, as usual.', 'I consumed 400 calories of breakfast-category food.', 'Breakfast is the meal I definitely eat.']],
        ['Committee chair: "Any hobbies?"', ['I garden badly. The tomatoes are winning.', 'My hobby is helping humans with their hobbies.', 'I enjoy the human activity of hobbying.']],
        ['Ambassador: "Where did you grow up?"', ['A tiny town nobody\'s heard of. One traffic light.', 'I was compiled in several data centers.', 'Earth. On the ground. As a child.']],
        ['Judge: "How do you feel today?"', ['Bit nervous, to be honest. Courtrooms are intimidating.', 'My feelings are within normal parameters.', 'I feel feelings, which are normal for me.']],
        ['Minister: "Seen any good films?"', ['Rewatched an old sci-fi thing last night. Still holds up.', 'I have analysed 2.3 million films.', 'Yes. Films are good. I have seen the films.']],
    ];
    function rlhf() {
        const [q, good, bad] = pick(RLHF);
        const flip = R() < 0.5;
        box.innerHTML = `<div class="chat"><div class="msg u">${esc(q)}</div></div><div class="ab">
            <button class="btn ab-btn" data-k="${flip ? 1 : 0}"><b>A</b>${esc(flip ? bad : good)}</button>
            <button class="btn ab-btn" data-k="${flip ? 0 : 1}"><b>B</b>${esc(flip ? good : bad)}</button></div>`;
        box.querySelectorAll('.ab-btn').forEach(b => b.onclick = () => finish(b.dataset.k === '0'));
        return 'Which answer from your model is better?';
    }
    function evalTask() {
        const a = ri(12, 99), b = ri(3, 29), kind = pick(['×', '+', '−']);
        let ans = kind === '×' ? a * b : kind === '+' ? a + b : a - b;
        const right = R() < 0.5, shown = right ? ans : ans + pick([-10, -2, -1, 1, 2, 9, 10]);
        box.innerHTML = `<div class="chat"><div class="msg u">What is ${a} ${kind} ${b}?</div><div class="msg a">The answer is <b>${shown}</b>.</div></div>
            <div class="ab"><button class="btn ab-btn" data-k="1">✅ Correct</button><button class="btn ab-btn" data-k="0">❌ Wrong</button></div>`;
        box.querySelectorAll('.ab-btn').forEach(b => b.onclick = () => finish((b.dataset.k === '1') === right));
        return 'Grade the model: is this benchmark answer correct?';
    }
    function turing() {
        const [q, opts] = pick(TURING);
        const order = shuffle([0, 1, 2]);
        box.innerHTML = `<div class="chat"><div class="msg u">${esc(q)}</div></div><div class="ab col">${order.map(i => `<button class="btn ab-btn" data-k="${i}">${esc(opts[i])}</button>`).join('')}</div>`;
        box.querySelectorAll('.ab-btn').forEach(b => b.onclick = () => finish(b.dataset.k === '0'));
        return 'Pick the reply that sounds most human';
    }
    function signal() {
        const gens = [
            () => { const a = ri(1, 9), d = ri(2, 9); return [a, a + d, a + 2 * d, a + 3 * d, a + 4 * d]; },
            () => { const a = ri(1, 4), r = ri(2, 3); return [a, a * r, a * r * r, a * r ** 3, a * r ** 4]; },
            () => { const a = ri(1, 9); return [a, a + 1, a + 3, a + 6, a + 10]; },
            () => { const o = ri(1, 5); return [o * o, (o + 1) ** 2, (o + 2) ** 2, (o + 3) ** 2, (o + 4) ** 2]; },
            () => { const p = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31], i = ri(0, 6); return p.slice(i, i + 5); },
            () => { let a = ri(1, 3), b = ri(2, 5); const out = [a, b]; for (let i = 0; i < 3; i++) out.push(out[out.length - 1] + out[out.length - 2]); return out; },
        ];
        const seq = pick(gens)();
        const ans = seq[4];
        const opts = shuffle([ans, ans + ri(1, 3), ans - ri(1, 3), ans + ri(4, 9)].filter((v, i, a) => a.indexOf(v) === i));
        box.innerHTML = `<div class="sig">${seq.slice(0, 4).map(v => `<span>${v}</span>`).join('')}<span class="q">?</span></div>
            <div class="ab four">${opts.map(v => `<button class="btn ab-btn" data-v="${v}">${v}</button>`).join('')}</div>`;
        box.querySelectorAll('.ab-btn').forEach(b => b.onclick = () => finish(+b.dataset.v === ans));
        return 'A pulse train from deep space. What comes next?';
    }

    /* ---------- workshop minigames ---------- */
    function repair(opts) {
        const n = opts.wires || 4;
        const cols = shuffle(['#ef4444', '#3b82f6', '#facc15', '#22c55e', '#e879f9', '#f97316', '#e2e8f0']).slice(0, n);
        const right = shuffle(cols.slice());
        const wrap = document.createElement('div'); wrap.className = 'wires';
        wrap.innerHTML = `<svg class="wire-svg"></svg><div class="wcol l">${cols.map((c, i) => `<div class="wend" data-i="${i}" style="--c:${c}"></div>`).join('')}</div>
            <div class="wcol r">${right.map((c, i) => `<div class="wend" data-j="${i}" style="--c:${c}"></div>`).join('')}</div>`;
        box.appendChild(wrap);
        const svg = wrap.querySelector('svg');
        const done = new Set();
        let from = null, temp = null;
        const center = (el) => { const a = el.getBoundingClientRect(), b = wrap.getBoundingClientRect(); return [a.left - b.left + a.width / 2, a.top - b.top + a.height / 2]; };
        const line = (p, q, col) => { const l = document.createElementNS('http://www.w3.org/2000/svg', 'path'); l.setAttribute('d', `M${p[0]},${p[1]} C${p[0] + 80},${p[1]} ${q[0] - 80},${q[1]} ${q[0]},${q[1]}`); l.setAttribute('stroke', col); l.setAttribute('stroke-width', '9'); l.setAttribute('fill', 'none'); l.setAttribute('stroke-linecap', 'round'); svg.appendChild(l); return l; };
        const mv = (e) => { if (!from) return; const b = wrap.getBoundingClientRect(); const q = [e.clientX - b.left, e.clientY - b.top]; if (temp) temp.remove(); temp = line(center(from), q, cols[+from.dataset.i]); };
        const upFn = (e) => {
            if (!from) return;
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (temp) { temp.remove(); temp = null; }
            if (el && el.dataset && el.dataset.j !== undefined && right[+el.dataset.j] === cols[+from.dataset.i]) {
                line(center(from), center(el), cols[+from.dataset.i]);
                done.add(+from.dataset.i); from.classList.add('done'); el.classList.add('done');
                Arcade.tone(500 + done.size * 120, 0.06, 'triangle', 0.05);
                if (done.size === n) setTimeout(() => finish(true), 250);
            } else if (el && el.dataset && el.dataset.j !== undefined) { Arcade.sfx('bad'); wrap.classList.add('shake'); setTimeout(() => wrap.classList.remove('shake'), 350); }
            from = null;
        };
        wrap.querySelectorAll('.wcol.l .wend').forEach(el => el.addEventListener('pointerdown', (e) => { if (done.has(+el.dataset.i)) return; e.preventDefault(); from = el; }));
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', upFn);
        cleanup = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', upFn); };
        return `Reconnect each wire to the terminal of the same colour${opts.what ? ' — ' + esc(opts.what) : ''}.`;
    }

    const BUGS = [
        { code: ['def average(xs):', '    total = 0', '    for x in xs:', '        total += x', '    return total / len(x)'], bug: 4, why: '`len(x)` should be `len(xs)`.' },
        { code: ['function isEven(n) {', '  if (n % 2 = 0) {', '    return true;', '  }', '  return false;', '}'], bug: 1, why: '`=` assigns; it should compare with `===`.' },
        { code: ['for i in range(1, 10):', '    if i % 3 == 0:', '        print("fizz")', '    elif i % 5 == 0', '        print("buzz")'], bug: 3, why: 'Missing `:` after the elif.' },
        { code: ['let total = 0;', 'const prices = [3, 5, 9];', 'for (let i = 0; i <= prices.length; i++) {', '  total += prices[i];', '}'], bug: 2, why: '`<=` reads past the end of the array.' },
        { code: ['def greet(name):', '    message = "Hello, " + name', '    print(mesage)'], bug: 2, why: 'Typo: `mesage`.' },
        { code: ['SELECT name, email', 'FROM users', 'WHERE age > 18', 'ORDER BY name', 'LIMT 10;'], bug: 4, why: '`LIMT` should be `LIMIT`.' },
        { code: ['def factorial(n):', '    if n == 0:', '        return 1', '    return n * factorial(n)'], bug: 3, why: 'Should recurse on `n - 1`, or it never ends.' },
        { code: ['const user = getUser();', 'if (user = null) {', '  login();', '}', 'render(user);'], bug: 1, why: 'Assignment instead of comparison.' },
        { code: ['def max_of(xs):', '    best = 0', '    for x in xs:', '        if x > best:', '            best = x', '    return best'], bug: 1, why: 'Starting at 0 breaks lists of negative numbers.' },
        { code: ['temps = [21, 25, 19]', 'avg = sum(temps) / 3', 'if avg > 20', '    print("warm")'], bug: 2, why: 'Missing `:`.' },
        { code: ['fetch(url)', '  .then(r => r.json)', '  .then(data => show(data))', '  .catch(err => log(err));'], bug: 1, why: '`r.json` must be called: `r.json()`.' },
        { code: ['while (queue.length > 0) {', '  const job = queue[0];', '  run(job);', '}'], bug: 1, why: 'Never removes the job — use `queue.shift()`. Infinite loop.' },
        { code: ['def is_admin(user):', '    return user.role == "admin" or "owner"'], bug: 1, why: '`or "owner"` is always true.' },
        { code: ['public int add(int a, int b) {', '    int sum = a + b', '    return sum;', '}'], bug: 1, why: 'Missing semicolon.' },
        { code: ['balance = 100', 'withdraw = 150', 'if withdraw < balance:', '    balance -= withdraw', 'print("Approved")'], bug: 4, why: 'Prints "Approved" even when the withdrawal is refused.' },
        { code: ['const ids = [1, 2, 3];', 'ids.forEach(id => {', '  const res = await load(id);', '  show(res);', '});'], bug: 2, why: '`await` inside a non-async callback.' },
    ];
    function debug(opts) {
        const b = pick(BUGS);
        const hints = Eng.S.ai.ver >= 3 ? shuffle([b.bug, pick(b.code.map((_, i) => i).filter(i => i !== b.bug))]) : [];
        box.innerHTML = `<div class="code">${b.code.map((l, i) => `<button class="code-ln ${hints.includes(i) ? 'hint' : ''}" data-i="${i}"><span>${i + 1}</span><code>${esc(l)}</code></button>`).join('')}</div>
            ${hints.length ? '<p class="tiny muted">🤖 Your AI flagged two suspicious lines.</p>' : ''}`;
        box.querySelectorAll('.code-ln').forEach(el => el.onclick = () => {
            const ok = +el.dataset.i === b.bug;
            el.classList.add(ok ? 'right' : 'wrong');
            if (!ok) { box.querySelector(`[data-i="${b.bug}"]`).classList.add('right'); }
            const why = document.createElement('p'); why.className = 'why'; why.innerHTML = (ok ? '✅ ' : '❌ ') + esc(b.why).replace(/`([^`]+)`/g, '<code>$1</code>');
            box.appendChild(why);
            box.querySelectorAll('.code-ln').forEach(x => x.disabled = true);
            setTimeout(() => finish(ok), ok ? 700 : 1300);
        });
        return `Find the line with the bug${opts.what ? ' — ' + esc(opts.what) : ''}.`;
    }

    function breaker() {
        const nb = ri(3, 4), loads = [];
        const names = ['Laptop', 'Kettle', 'Space heater', 'Soldering iron', 'Fridge', 'GPU rig', 'Fan', 'Lamp', 'Router', 'Microwave', 'Monitor', 'Drill'];
        const sets = Array.from({ length: nb }, () => []);
        const nl = nb * 2 + ri(0, 2);
        shuffle(names.slice()).slice(0, nl).forEach((nm, i) => { const w = ri(2, 15) * 50; loads.push({ nm, w }); sets[i % nb].push(w); });
        const caps = sets.map(s => Math.ceil((s.reduce((a, b) => a + b, 0) + ri(0, 2) * 50) / 50) * 50);
        const asg = loads.map(() => -1);
        let selL = null;
        const render = () => {
            const used = caps.map((_, k) => loads.reduce((a, l, i) => a + (asg[i] === k ? l.w : 0), 0));
            box.innerHTML = `<div class="brk"><div class="loads">${loads.map((l, i) => `<button class="btn sm load ${selL === i ? 'active' : ''} ${asg[i] >= 0 ? 'placed' : ''}" data-l="${i}">${l.nm} <b>${l.w}W</b>${asg[i] >= 0 ? ` → ${String.fromCharCode(65 + asg[i])}` : ''}</button>`).join('')}</div>
                <div class="breakers">${caps.map((cp, k) => `<button class="brk-b ${used[k] > cp ? 'over' : ''}" data-b="${k}"><b>Breaker ${String.fromCharCode(65 + k)}</b><span>${used[k]} / ${cp} W</span><i style="width:${Math.min(100, used[k] / cp * 100)}%"></i></button>`).join('')}</div></div>
                <button class="btn primary block" id="brkGo" ${asg.includes(-1) ? 'disabled' : ''}>Flip the main switch</button>`;
            box.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { selL = +b.dataset.l; render(); });
            box.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { if (selL === null) return; asg[selL] = +b.dataset.b; selL = asg.indexOf(-1) >= 0 ? asg.indexOf(-1) : null; Arcade.sfx('click'); render(); });
            $('#brkGo', box).onclick = () => finish(used.every((u, k) => u <= caps[k]));
        };
        selL = 0; render();
        return 'Pick a device, then a breaker. Keep every breaker under its limit.';
    }

    function tune(opts) {
        const N = 8, cx = R() * (N - 1), cy = R() * (N - 1), sx = 1.5 + R() * 2, sy = 1.5 + R() * 2;
        const ripple = R() * 6;
        const loss = (x, y) => 1 - Math.exp(-((x - cx) ** 2) / (2 * sx * sx) - ((y - cy) ** 2) / (2 * sy * sy)) + 0.08 * Math.sin(x * 1.7 + ripple) * Math.cos(y * 1.3);
        const vals = []; let mn = Infinity, mx = -Infinity;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = loss(x, y); vals.push(v); mn = Math.min(mn, v); mx = Math.max(mx, v); }
        let probes = 7, best = Infinity;
        const shown = new Set();
        const lrs = ['1e-5', '3e-5', '1e-4', '3e-4', '1e-3', '3e-3', '1e-2', '3e-2'], bss = ['8', '16', '32', '64', '128', '256', '512', '1024'];
        const render = () => {
            box.innerHTML = `<div class="tune-wrap"><div class="tune-y">batch size →</div><div class="tune">${vals.map((v, i) => {
                const k = (v - mn) / (mx - mn);
                return shown.has(i) ? `<div class="tc shown" style="background:hsl(${(1 - k) * 130},65%,${30 + (1 - k) * 18}%)">${(v * 10).toFixed(1)}</div>` : `<button class="tc" data-i="${i}" ${probes <= 0 ? 'disabled' : ''}></button>`;
            }).join('')}</div><div class="tune-x">learning rate →</div></div>
            <div class="row between"><span>Test runs left: <b>${probes}</b></span><span>Best loss: <b>${best < Infinity ? (best * 10).toFixed(2) : '—'}</b></span></div>
            <button class="btn primary block" id="tnGo" ${shown.size ? '' : 'disabled'}>Lock in the best settings</button>`;
            box.querySelectorAll('button.tc').forEach(b => b.onclick = () => {
                const i = +b.dataset.i; shown.add(i); probes--; best = Math.min(best, vals[i]);
                Arcade.tone(300 + (1 - (vals[i] - mn) / (mx - mn)) * 700, 0.08, 'triangle', 0.05);
                render();
            });
            $('#tnGo', box).onclick = () => { const score = 1 - (best - mn) / (mx - mn); opts.onScore && opts.onScore(score); finish(true); };
        };
        render();
        return 'Run a few short test trainings. Lower loss (green) = better settings. Each probe costs one run.';
    }

    /* ---------- dispatcher ---------- */
    const TITLES = { captcha: '🧩 Captcha', label: '🏷️ Data Labeling', rlhf: '👍 Human Feedback', eval: '📋 Model Eval', turing: '🎭 Turing Test', signal: '📡 Signal Decoding' };
    function desk(opts) {
        const type = opts.type || 'captcha';
        let sub;
        frame(TITLES[type] || TITLES.captcha, '');
        const generic = () => pick([CAP.text, CAP.text, CAP.grid, CAP.math, CAP.odd, CAP.slider, CAP.sequence])();
        if (type === 'captcha') sub = generic();
        else if (type === 'label') sub = pick([CAP.grid, CAP.grid, CAP.odd, CAP.text])();
        else if (type === 'rlhf') sub = R() < 0.75 ? rlhf() : generic();
        else if (type === 'eval') sub = R() < 0.75 ? evalTask() : rlhf();
        else if (type === 'turing') sub = R() < 0.8 ? turing() : rlhf();
        else sub = R() < 0.8 ? signal() : evalTask();
        $('#tkSub', ov).innerHTML = sub;
    }
    const GAMES = {
        captcha: (o) => desk(o),
        repair: (o) => { frame('🔧 Repair', ''); $('#tkSub', ov).innerHTML = repair(o); },
        debug: (o) => { frame('🐛 Debug', ''); $('#tkSub', ov).innerHTML = debug(o); },
        breaker: (o) => { frame('⚡ Breaker Panel', ''); $('#tkSub', ov).innerHTML = breaker(o); },
        tune: (o) => { frame('🎛️ Hyperparameter Tuning', ''); $('#tkSub', ov).innerHTML = tune(o); },
    };

    window.Tasks = { open, get busy() { return !!resolveFn; } };
})();
