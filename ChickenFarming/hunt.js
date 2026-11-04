/* ==========================================================
   Egg Hunt, a fully manual, minesweeper-style side game.

   Dig up the field: every safe tile pays clovers, hidden golden eggs pay a lot
   more, and numbers tell you how many foxes touch a tile. Hitting a fox costs a
   heart. Clovers buy permanent perks (game.js: HUNT_PERKS) that boost the main
   farm. Nothing here runs by itself and nothing is earned while you are away.
   The data (FIELDS, HUNT_PERKS, hLvl, rankXp) lives in game.js.
   ========================================================== */
const HUNT_BOARD_KEY = GameSave + '.hunt-board';
let board = Arcade.load(HUNT_BOARD_KEY, null);
if (board && (!Array.isArray(board.rev) || !FIELDS.find(f => f.id === board.fid))) board = null;

const fieldOf = (id) => FIELDS.find(f => f.id === id) || FIELDS[0];
const fieldOpen = (f) => gameData.hunt.rank >= f.rank;
const nbrs = (b, i) => {
    const x = i % b.w, y = (i / b.w) | 0, out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < b.w && ny < b.h) out.push(ny * b.w + nx);
    }
    return out;
};
const saveBoard = () => Arcade.save(HUNT_BOARD_KEY, board);

function huntStart(fid) {
    const f = fieldOf(fid);
    if (!fieldOpen(f)) return false;
    const n = f.w * f.h, hearts = 3 + hLvl('boots');
    board = {
        fid: f.id, w: f.w, h: f.h, n,
        fox: new Array(n).fill(0), egg: new Array(n).fill(0), num: new Array(n).fill(0),
        rev: new Array(n).fill(0), flag: new Array(n).fill(0),
        placed: false, hearts, maxHearts: hearts, hits: 0, safeRev: 0, safeTotal: n - f.foxes,
        earned: 0, eggsFound: 0, over: false, won: false, bonus: 0,
    };
    saveBoard();
    return true;
}

function placeFoxes(b, first) {
    const f = fieldOf(b.fid);
    // the first click (and ideally its neighbours) is always safe, so you open on a clearing
    const banned = new Set([first, ...nbrs(b, first)]);
    let pool = [];
    for (let i = 0; i < b.n; i++) if (!banned.has(i)) pool.push(i);
    if (pool.length < f.foxes) { pool = []; for (let i = 0; i < b.n; i++) if (i !== first) pool.push(i); }
    Arcade.shuffle(pool);
    for (const i of pool.slice(0, f.foxes)) b.fox[i] = 1;
    for (let i = 0; i < b.n; i++) b.num[i] = nbrs(b, i).reduce((a, j) => a + b.fox[j], 0);
    // golden eggs on safe tiles away from the opening
    const safe = [];
    for (let i = 0; i < b.n; i++) if (!b.fox[i] && !banned.has(i)) safe.push(i);
    Arcade.shuffle(safe);
    const eggs = 2 + Math.floor(b.n / 45) + hLvl('nose');
    for (const i of safe.slice(0, eggs)) b.egg[i] = 1;
    b.placed = true;
    // perks: scout hounds uncover extra safe tiles, the sniffer plants flags on foxes
    const foxes = pool.slice(0, f.foxes);
    for (const i of foxes.slice(0, hLvl('sniffer'))) b.flag[i] = 1;
    return safe.filter(i => !b.egg[i]).slice(0, hLvl('hound'));
}

/** Reveals tile i (flood-filling empty areas). Mutates the board and `res`; payout happens in settle(). */
function revealCore(b, i, res) {
    if (b.rev[i] || b.flag[i] || b.over) return;
    if (b.fox[i]) {
        b.rev[i] = 2; b.hearts--; b.hits++; res.hit = true;
        if (b.hearts <= 0) { b.over = true; b.won = false; }
        return;
    }
    const stack = [i];
    while (stack.length) {
        const k = stack.pop();
        if (b.rev[k] || b.fox[k] || b.flag[k]) continue;
        b.rev[k] = 1; b.safeRev++; res.tiles++;
        if (b.egg[k]) res.eggs++;
        if (b.num[k] === 0) for (const j of nbrs(b, k)) if (!b.rev[j]) stack.push(j);
    }
    if (b.safeRev >= b.safeTotal) { b.over = true; b.won = true; }
}

/** Pays out whatever `res` earned, inside one act() so the save stays consistent. */
function settle(b, res) {
    const f = fieldOf(b.fid), m = huntMult();
    let clovers = (res.tiles * f.per + res.eggs * f.per * 15) * m;
    let xp = (res.tiles + res.eggs * 8) * xpTile(f.id);
    let bonus = 0;
    if (b.over && b.won) {
        bonus = b.safeTotal * f.per * (b.hits === 0 ? 1 : 0.4) * m;
        xp += b.safeTotal * xpTile(f.id) * (b.hits === 0 ? 0.6 : 0.25);
    }
    clovers = Math.floor(clovers); bonus = Math.floor(bonus);
    b.earned += clovers + bonus; b.eggsFound += res.eggs; b.bonus += bonus;
    const rankBefore = gameData.hunt.rank;
    act(() => {
        const h = gameData.hunt;
        h.clovers += clovers + bonus; h.totalClovers += clovers + bonus;
        h.xp += xp;
        while (h.xp >= rankXp(h.rank)) { h.xp -= rankXp(h.rank); h.rank++; }
        if (b.over) {
            h.hunts++;
            if (b.won) { h.cleared++; if (b.hits === 0) h.perfect++; }
            h.bestTiles = Math.max(h.bestTiles, b.safeRev);
        }
    });
    res.clovers = clovers; res.bonus = bonus;
    if (gameData.hunt.rank > rankBefore) {
        const open = FIELDS.filter(f2 => f2.rank > rankBefore && f2.rank <= gameData.hunt.rank);
        Arcade.toast(`🦊 Hunter rank ${gameData.hunt.rank}!` + (open.length ? ` ${open[0].icon} ${open[0].name} unlocked` : ''), 'gold', 3500);
        Arcade.sfx('level');
    }
    return res;
}

/** Left click / tap on tile i. Returns a result object, or null if nothing happened. */
function huntReveal(i) {
    const b = board;
    if (!b || b.over || b.rev[i] || b.flag[i]) return null;
    const res = { hit: false, tiles: 0, eggs: 0 };
    if (!b.placed) {
        const bonusTiles = placeFoxes(b, i);
        revealCore(b, i, res);
        for (const j of bonusTiles) revealCore(b, j, res);
    } else revealCore(b, i, res);
    settle(b, res);
    saveBoard();
    return res;
}

/** Clicking a revealed number whose flags are all placed opens its remaining neighbours. */
function huntChord(i) {
    const b = board;
    if (!b || b.over || b.rev[i] !== 1 || !b.num[i]) return null;
    const around = nbrs(b, i);
    if (around.filter(j => b.flag[j]).length !== b.num[i]) return null;
    const res = { hit: false, tiles: 0, eggs: 0 };
    for (const j of around) revealCore(b, j, res);
    if (!res.tiles && !res.hit) return null;
    settle(b, res);
    saveBoard();
    return res;
}

function huntFlag(i) {
    const b = board;
    if (!b || b.over || b.rev[i] || !b.placed) return false;
    b.flag[i] = b.flag[i] ? 0 : 1;
    saveBoard();
    return true;
}

const huntFoxesLeft = () => board ? fieldOf(board.fid).foxes - board.flag.reduce((a, v) => a + v, 0) : 0;
