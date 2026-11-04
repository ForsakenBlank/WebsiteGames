/* the list of every game in the arcade, used by the hub.
   pal = card colours, art = emoji drawn on the card tiles,
   players = how many people can play, best() = short text shown on the card */
(function () {
    'use strict';
    const A = window.Arcade;
    const L = (k, d) => A.load(k, d);
    const max = (...keys) => Math.max(0, ...keys.map(k => Number(L(k, 0)) || 0));
    const or = (v, f) => (v ? f(v) : '');
    const wins = (k, field) => { const s = L(k, {}) || {}; const n = typeof s === 'number' ? s : (s[field || 'wins'] || 0); return n ? n + (n === 1 ? ' win' : ' wins') : ''; };
    const stat = (g, s) => ((A.meta().stats[g] || {})[s]) || 0;

    // card palettes: background + ink (title colour)
    const P = {
        cream: ['#f4ecdd', '#d6476b'], navy: ['#2c4760', '#ffffff'], coral: ['#e8655a', '#3a1d1a'], mauve: ['#7a4d5a', '#f7c065'],
        plum: ['#2d2442', '#ff74a6'], night: ['#121216', '#f7c548'], mint: ['#86d4b4', '#163a2d'], sky: ['#82c3ec', '#14324a'],
        sun: ['#f6c445', '#4a3200'], grape: ['#8d6be0', '#ffffff'], forest: ['#2f5a45', '#ffe08a'], peach: ['#f7a77a', '#4a2210'],
        slate: ['#3b3f4a', '#8fe3ff'], rose: ['#f08aa7', '#47152a'], lime: ['#b9dc6e', '#2b3a0b'], teal: ['#2a6f73', '#bff5e8'],
        sand: ['#e8d2a8', '#6b3f12'], berry: ['#5b2a4a', '#ffb3d1'], ink: ['#22304a', '#ffd166'], brick: ['#a5473b', '#ffe4c9'],
    };

    const GAMES = [
        // puzzle
        { id: 'petdoku', title: 'Petdoku', path: 'Petdoku/index.html', genre: 'Puzzle', pal: P.cream, art: ['🐱', '🐶', '🐮'], desc: 'One pet per row, column and colour. Pets can\'t touch.', fresh: 'Updated',
          best: () => { const s = L('arcade.petdoku.q.stats', {}) || {}; const n = Object.values(s).reduce((a, x) => a + (x.wins || 0), 0); return n ? n + ' solved' : ''; } },
        { id: 'tapmatch', title: 'Tap Match', path: 'TapMatch/index.html', genre: 'Puzzle', pal: P.coral, art: ['🫐', '🍉', '🍓'], desc: 'Tap tiles into your tray and clear them in threes.', fresh: 'Updated',
          best: () => { const w = L('tapMatchWins', {}) || {}; const n = (w.easy || 0) + (w.medium || 0) + (w.hard || 0) + (w.extreme || 0); return n ? n + ' wins' : ''; } },
        { id: 'woodblocks', title: 'Wood Blocks', path: 'WoodBlocks/index.html', genre: 'Puzzle', pal: P.mauve, art: ['🪵', '🟨', '🟫'], desc: 'Fit blocks on a 9x9 board and clear rows, columns and squares.', fresh: 'Updated',
          best: () => or(max('arcade.wood.best'), v => 'Best ' + v) },
        { id: 'nonogram', title: 'Nonogram', path: 'Nonogram/index.html', genre: 'Puzzle', pal: P.sand, art: ['⬛', '⬜', '⬛'], desc: 'Use the number clues to paint a hidden picture.', fresh: 'New',
          best: () => { const n = stat('nonogram', 'win'); return n ? n + ' solved' : ''; } },
        { id: 'coloursort', title: 'Colour Sort', path: 'ColourSort/index.html', genre: 'Puzzle', pal: P.rose, art: ['🧪', '🟣', '🟢'], desc: 'Pour colours between tubes until every tube is one colour.', fresh: 'Updated',
          best: () => { const ks = []; for (const m of ['classic', 'mystery']) for (const d of ['', '.easy', '.hard', '.expert', '.master', '.insane']) ks.push('arcade.coloursort.level.' + m + d); const l = Math.max(...ks.map(k => Number(L(k, 1)) || 1)); return l > 1 ? 'Level ' + l : ''; } },
        { id: 'petsudoku', title: 'Pet Sudoku', path: 'PetSudoku/index.html', genre: 'Puzzle', pal: P.peach, art: ['🐶', '🐰', '🦊'], desc: 'Sudoku, but with pets. Pencil marks and hints that explain.', fresh: 'Updated',
          best: () => { const s = L('arcade.petdoku.stats', {}) || {}; const n = Object.values(s).reduce((a, x) => a + (x.wins || 0), 0); return n ? n + (n === 1 ? ' win' : ' wins') : ''; } },
        { id: 'minesweeper', title: 'Minesweeper', path: 'Minesweeper/index.html', genre: 'Puzzle', pal: P.sky, art: ['💣', '🚩', '1️⃣'], desc: 'Classic boards plus a no-guess mode where logic always works.',
          best: () => { const t = ['easy', 'medium', 'hard'].map(d => [d, L('arcade.mines.best.' + d, 0)]).filter(x => x[1]); return t.length ? t.map(x => x[0][0].toUpperCase() + ' ' + x[1] + 's').join(' · ') : ''; } },
        { id: '2048', title: '2048', path: '2048/index.html', genre: 'Puzzle', pal: P.sun, art: ['2️⃣', '4️⃣', '8️⃣'], desc: 'Slide and merge numbers. Board sizes from 3x3 to 8x8.',
          best: () => or(max(...[3, 4, 5, 6, 8].map(n => 'arcade.2048.best.' + n)), v => 'Best ' + A.fmt(v)) },
        { id: 'wordle', title: 'Wordle', path: 'Wordle/index.html', genre: 'Puzzle', pal: P.forest, art: ['🟩', '🟨', '⬜'], desc: 'Guess the word in six tries. Daily and unlimited.',
          best: () => { const s = L('arcade.wordle.stats.daily', {}) || {}, u = L('arcade.wordle.stats.unlimited', {}) || {}; const n = (s.wins || 0) + (u.wins || 0); return n ? n + (n === 1 ? ' win' : ' wins') : ''; } },
        { id: 'flow', title: 'Flow', path: 'Flow/index.html', genre: 'Puzzle', pal: P.plum, art: ['🔴', '🔵', '🟡'], desc: 'Connect matching dots and fill every square.',
          best: () => or(max('arcade.flow.solved'), v => v + ' solved') },
        { id: 'pipes', title: 'Pipes', path: 'Pipes/index.html', genre: 'Puzzle', pal: P.teal, art: ['🚰', '💧', '🔧'], desc: 'Rotate pipes until water reaches every drain.',
          best: () => or(max('arcade.pipes.solved'), v => v + ' solved') },
        { id: 'memory', title: 'Memory', path: 'Memory/index.html', genre: 'Puzzle', pal: P.lime, art: ['🐸', '🍄', '🐸'], desc: 'Flip cards and find the pairs. Solo or with a friend.', fresh: 'New', players: '1-2',
          best: () => { const n = stat('memory', 'win'); return n ? n + ' cleared' : ''; } },

        // arcade
        { id: 'snake', title: 'Snake', path: 'Snake/index.html', genre: 'Arcade', pal: P.night, art: ['🐍', '🍎', '🍏'], desc: 'Classic modes, a 30 level campaign and a level editor.',
          best: () => or(max('arcade.snake.best.chill', 'arcade.snake.best.classic', 'arcade.snake.best.insane'), v => 'Best ' + v) },
        { id: 'blocks', title: 'Falling Blocks', path: 'Blocks/index.html', genre: 'Arcade', pal: P.ink, art: ['🟦', '🟧', '🟪'], desc: 'Stack falling pieces and clear lines. Marathon and sprint.',
          best: () => or(max('arcade.blocks.best'), v => 'Best ' + A.fmt(v)) },
        { id: 'pacman', title: 'Pac-Man', path: 'PacMan/index.html', genre: 'Arcade', pal: P.navy, art: ['🟡', '👻', '🍒'], desc: 'Mazes, power-ups, a maze editor and a ghost mode.',
          best: () => or(max('arcade.pacman.best', 'arcade.pacman.best.arcade', 'arcade.pacman.best.original', 'arcade.pacman.best.infinite'), v => 'Best ' + v) },
        { id: 'flappy', title: 'Flappy', path: 'Flappy/index.html', genre: 'Arcade', pal: P.sky, art: ['🐤', '☁️', '🌿'], desc: 'Tap to flap through the gaps. Unlock new birds.',
          best: () => or(max('arcade.flappy.best'), v => 'Best ' + v) },
        { id: 'stacker', title: 'Tower Stacker', path: 'TowerStacker/index.html', genre: 'Arcade', pal: P.teal, art: ['🏗️', '🧱', '☁️'], desc: 'Drop floors as straight as you can and climb into space.',
          best: () => or(max('stackerBest'), v => v + ' floors') },
        { id: 'gravity', title: 'Gravity Runner', path: 'GravityRunner/index.html', genre: 'Arcade', pal: P.grape, art: ['🔄', '⚡', '🔺'], desc: 'Flip gravity to dodge spikes across changing biomes.',
          best: () => or(max('arcade.gravity.best', ...['easy', 'normal', 'hard', 'insane', 'unleashed'].map(d => 'arcade.gravity.best.' + d)), v => v + 'm') },
        { id: 'slicer', title: 'Fruit Slicer', path: 'Slicer/index.html', genre: 'Arcade', pal: P.lime, art: ['🍉', '🍍', '🍋'], desc: 'Swipe to slice fruit and chain combos. Avoid the bombs.',
          best: () => or(max('arcade.slicer.best'), v => 'Best ' + v) },
        { id: 'starshooter', title: 'Star Shooter', path: 'StarShooter/index.html', genre: 'Arcade', pal: P.ink, art: ['🚀', '👾', '⭐'], desc: 'Pick a ship, upgrade drones and fight big bosses.',
          best: () => or((L('arcade.starshooter.save', {}) || {}).bestWave, v => 'Wave ' + v) },
        { id: 'survivors', title: 'Night Survivors', path: 'Survivors/index.html', genre: 'Arcade', pal: P.berry, art: ['🧛', '🦇', '💀'], desc: 'Your weapons fire on their own. Survive the horde.',
          best: () => or(max('arcade.survivors.best'), v => A.time(v)) },
        { id: 'supershot', title: 'SUPERSHOT', path: 'SuperShot/index.html', genre: 'Arcade', pal: P.brick, art: ['⏱️', '🔫', '🟥'], desc: 'Time only moves when you move.',
          best: () => or(max('chronoHighScore'), v => 'Best ' + v) },
        { id: 'encrypter', title: 'Encrypter', path: 'Encrypter/index.html', genre: 'Arcade', pal: P.forest, art: ['🧬', '🦠', '🔒'], desc: 'Loop your trail around viruses to wipe them out.',
          best: () => or(max('arcade.encrypter.best'), v => 'Best ' + v) },
        { id: 'shapematch', title: 'Shape Match', path: 'ShapeMatch/index.html', genre: 'Arcade', pal: P.sun, art: ['🔺', '🟦', '🟢'], desc: 'Sort falling shapes by shape and colour.',
          best: () => or(max('arcade.shapematch.best'), v => 'Best ' + v) },
        { id: 'physics', title: 'Bounce Lab', path: 'BounceLab/index.html', genre: 'Arcade', pal: P.coral, art: ['🔴', '🟠', '🟡'], desc: 'Satisfying ball physics, Brick Breaker, Ballz and an editor.',
          best: () => or(max('arcade.physics.best'), v => 'Best ' + A.fmt(v)) },
        { id: 'pong', title: 'Pong', path: 'Pong/index.html', genre: 'Arcade', pal: P.slate, art: ['🏓', '⚪', '🏓'], desc: 'The original. Play the AI or a friend on one screen.', players: '1-2',
          best: () => wins('arcade.pong.stats') },

        // board + cards
        { id: 'ludo', title: 'Ludo', path: 'Ludo/index.html', genre: 'Board', pal: P.navy, art: ['🎲', '🔵', '🔴'], desc: 'Race your tokens home against bots or friends.', players: '1-4',
          best: () => { const s = L('arcade.ludo.stats', {}) || {}; return s.wins ? s.wins + (s.wins === 1 ? ' win' : ' wins') : ''; } },
        { id: 'connect4', title: 'Connect Four', path: 'ConnectFour/index.html', genre: 'Board', pal: P.sky, art: ['🔴', '🟡', '🔴'], desc: 'Drop discs and line up four. Smart AI or a friend.', fresh: 'New', players: '1-2',
          best: () => { const n = stat('connect4', 'win'); return n ? n + (n === 1 ? ' win' : ' wins') : ''; } },
        { id: 'checkers', title: 'Checkers', path: 'Checkers/index.html', genre: 'Board', pal: P.brick, art: ['⚫', '🔴', '👑'], desc: 'Jump, chain captures and get kinged.', fresh: 'New', players: '1-2',
          best: () => { const n = stat('checkers', 'win'); return n ? n + (n === 1 ? ' win' : ' wins') : ''; } },
        { id: 'dots', title: 'Dots & Boxes', path: 'DotsBoxes/index.html', genre: 'Board', pal: P.cream, art: ['🔲', '✏️', '🔲'], desc: 'Take turns drawing lines. Close a box to go again.', fresh: 'New', players: '1-4',
          best: () => { const n = stat('dots', 'win'); return n ? n + (n === 1 ? ' win' : ' wins') : ''; } },
        { id: 'battleship', title: 'Battleship', path: 'Battleship/index.html', genre: 'Board', pal: P.teal, art: ['🚢', '💥', '🌊'], desc: 'Hide your fleet and hunt theirs. Three AI levels or pass and play.', fresh: 'Updated', players: '1-2',
          best: () => wins('arcade.battleship.stats') },
        { id: 'tictactoe', title: 'Tic-Tac-Toe', path: 'TicTacToe/index.html', genre: 'Board', pal: P.grape, art: ['❌', '⭕', '❌'], desc: 'Classic and Ultimate, nine boards in one.', players: '1-2',
          best: () => wins('arcade.ttt.stats') },
        { id: 'snakesladders', title: 'Snakes & Ladders', path: 'SnakesLadders/index.html', genre: 'Board', pal: P.lime, art: ['🪜', '🐍', '🎲'], desc: 'Climb ladders and dodge snakes with up to four players.', players: '1-4',
          best: () => wins('arcade.snl.stats') },
        { id: 'solitaire', title: 'Solitaire', path: 'Solitaire/index.html', genre: 'Cards', pal: P.forest, art: ['♠️', '♥️', '🂡'], desc: 'Klondike with draw 1 or 3, undo and auto-finish.', fresh: 'New',
          best: () => { const n = stat('solitaire', 'win'); return n ? n + (n === 1 ? ' win' : ' wins') : ''; } },
        { id: 'cards', title: 'Crazy Cards', path: 'Cards/index.html', genre: 'Cards', pal: P.coral, art: ['🃏', '🟥', '🟦'], desc: 'Match colour or number and get rid of every card.', players: '1-4',
          best: () => wins('arcade.cards.stats') },
        { id: 'dice', title: 'Dice Poker', path: 'Dice/index.html', genre: 'Cards', pal: P.peach, art: ['🎲', '🎲', '🎯'], desc: 'Roll five dice three times and fill the score sheet.', players: '1-4',
          best: () => or(max('arcade.dice.best'), v => 'Best ' + v) },

        // party (pass and play)
        { id: 'imposter', title: 'Imposter', path: 'Imposter/index.html', genre: 'Party', pal: P.plum, art: ['🕵️', '🤫', '❓'], desc: 'Everyone gets the secret word except one. Find the faker.', fresh: 'New', players: '3-12',
          best: () => { const n = stat('imposter', 'round'); return n ? n + ' rounds' : ''; } },
        { id: 'charades', title: 'Charades', path: 'Charades/index.html', genre: 'Party', pal: P.sun, art: ['🎭', '🙈', '🎬'], desc: 'Hold the phone up, your team acts it out. Beat the clock.', fresh: 'New', players: '2-20',
          best: () => { const n = stat('charades', 'round'); return n ? n + ' rounds' : ''; } },
        { id: 'wordbomb', title: 'Word Bomb', path: 'WordBomb/index.html', genre: 'Party', pal: P.brick, art: ['💣', '🔤', '💥'], desc: 'Say a word with the letters, then pass before it blows.', fresh: 'New', players: '2-12',
          best: () => { const n = stat('wordbomb', 'round'); return n ? n + ' rounds' : ''; } },
        { id: 'partycards', title: 'Party Cards', path: 'PartyCards/index.html', genre: 'Party', pal: P.rose, art: ['🎉', '🤔', '🔥'], desc: 'Would you rather, most likely to, truth or dare and hot takes.', fresh: 'New', players: '2-20',
          best: () => { const n = stat('partycards', 'cards'); return n ? n + ' cards' : ''; } },
        { id: 'duel', title: 'Reaction Duel', path: 'Duel/index.html', genre: 'Party', pal: P.slate, art: ['👆', '⚡', '👆'], desc: 'Two to four players, one screen. Fastest finger wins.', fresh: 'New', players: '2-4',
          best: () => { const n = stat('duel', 'round'); return n ? n + ' rounds' : ''; } },

        // idle
        { id: 'thetower', title: 'The Tower', path: 'TheTower/index.html', genre: 'Idle', pal: P.ink, art: ['🗼', '⚡', '💎'], desc: 'Idle tower defense with workshop, labs, cards and modules.', idle: 'Your tower',
          best: () => { const s = L('arcade.tower2.save', {}) || {}; const w = Math.max(0, ...Object.values(s.tierBest || {})); return w ? 'Wave ' + w + (s.maxTier > 1 ? ' · T' + s.maxTier : '') : ''; } },
        { id: 'chicken', title: 'Chicken Farm', path: 'ChickenFarming/index.html', genre: 'Idle', pal: P.sun, art: ['🐔', '🥚', '🌽'], desc: 'Grow a coop, breed hens and hunt for eggs.', idle: 'Your hens',
          best: () => or((L('ChickenGame', {}) || {}).Level, v => 'Farm lvl ' + v) },
        { id: 'essence', title: 'Essence Farm', path: 'EssenceFarming/index.html', genre: 'Idle', pal: P.forest, art: ['🌿', '🌱', '✨'], desc: 'Crop mutations, frontier events and two prestige layers.', idle: 'Your farm',
          best: () => or((L('df_v5_save', {}) || {}).essence, v => A.fmt(v) + ' essence') },
        { id: 'idleminer', title: 'Idle Miner', path: 'IdleMiner/index.html', genre: 'Idle', pal: P.sand, art: ['⛏️', '💎', '🪨'], desc: 'Dig deeper shafts, hire managers and sell ore.', idle: 'Your mine',
          best: () => { const s = L('arcade.idleminer.save', null); return s && s.shafts ? s.shafts.length + ' shafts' : ''; } },
        { id: 'fishing', title: 'Fishing', path: 'Fishing/index.html', genre: 'Idle', pal: P.sky, art: ['🎣', '🐟', '🐠'], desc: 'Cast, reel and sell. Better rods reach deeper water.',
          best: () => { const s = L('arcade.fishing.save', null); return s && s.caught ? s.caught + ' caught' : ''; } },
        { id: 'towerdefense', title: 'Tower Defense', path: 'TowerDefense/index.html', genre: 'Idle', pal: P.lime, art: ['🏰', '🏹', '👹'], desc: 'Place and upgrade towers along the path.',
          best: () => or(max('arcade.td.best'), v => 'Wave ' + v) },

        // automation
        { id: 'singularity', title: 'Singularity', path: 'Singularity/index.html', genre: 'Automation', pal: P.grape, art: ['🧠', '💻', '🌌'], desc: 'Start in a shack with e-waste and end up running the universe.', idle: 'Your AI',
          best: () => { const s = L('arcade.singularity.save', null); if (!s || !s.ai) return ''; const names = ['Shack', 'Garage', 'Loft', 'Datacenter', 'Campus', 'Orbit', 'Sol', 'Galaxy', 'Universe']; return 'AI v' + s.ai.ver + ' · ' + (names[s.site] || ''); } },
        { id: 'automato', title: 'Automato', path: 'Automato/index.html', genre: 'Automation', pal: P.peach, art: ['🏭', '⚙️', '🔩'], desc: 'Mine, smelt and assemble with a research tree and power grid.', idle: 'Your factory',
          best: () => { const s = L('arcade.automato.save', null); return s && s.buildings && s.buildings.length ? s.buildings.length + ' machines' : ''; } },
        { id: 'uploadlabs', title: 'Upload Labs', path: 'UploadLabs/index.html', genre: 'Automation', pal: P.slate, art: ['💾', '🖥️', '📡'], desc: 'Build a data empire and keep the hackers out.', idle: 'Your servers',
          best: () => { const s = L('arcade.uploadlabs.save', null); return s && s.stats && s.stats.earned ? '$' + A.fmt(s.stats.earned) + ' earned' : ''; } },

        // creative + skill
        { id: 'infiniteink', title: 'Infinite Ink', path: 'InfiniteInk/index.html', genre: 'Creative', pal: P.cream, art: ['🎨', '✏️', '🖌️'], desc: 'Endless canvas with layers, animation and export.',
          best: () => { const st = L('arcade.ink.stats', null); const n = st ? st.canvases : Object.keys(Object.assign({}, L('infInkerV5', {}), L('infInkerV6', {}))).length; return n ? n + (n === 1 ? ' canvas' : ' canvases') : ''; } },
        { id: 'typing', title: 'Typing', path: 'Typing/index.html', genre: 'Skill', pal: P.teal, art: ['⌨️', '🔤', '☄️'], desc: 'Speed test plus a meteor shooter you type at.',
          best: () => or(max('arcade.typing.best'), v => v + ' WPM') },
        { id: 'aimtrainer', title: 'Aim Trainer', path: 'AimTrainer/index.html', genre: 'Skill', pal: P.coral, art: ['🎯', '🖱️', '⚡'], desc: 'Hit targets fast or test your reaction time.',
          best: () => or(max('arcade.aim.reaction'), v => v + ' ms') },
    ];
    const LOST = [
        { id: 'rpgmage', title: 'Village & Mines', path: 'LostCauses/RPGMAGE.html', pal: P.slate, art: ['⛏️'], desc: 'Top-down mining RPG prototype.' },
        { id: 'xprpg', title: 'Soul Siphon', path: 'LostCauses/XPrpg.html', pal: P.slate, art: ['🔮'], desc: 'Turn-based XP-draining RPG prototype.' },
    ];
    for (const g of GAMES) if (!g.players) g.players = '1';
    window.ArcadeGames = { GAMES, LOST, PALETTES: P };
})();
