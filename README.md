# Arcade

A pile of offline games in one place: puzzles, arcade, board and card games, party games for groups, idle and automation games.
Everything is plain HTML, CSS and JavaScript, no build step needed to play.

Open `GameIndex.html` (or `index.html`, which just redirects there).

## Layout

```
GameIndex.html         the hub: games, play together, quests and profile tabs
_shared/arcade.css     the shared look (every game uses it except The Tower)
_shared/arcade-classic.css   the old look, kept only for The Tower
_shared/arcade.js      helpers + the meta system (xp, levels, quests, achievements, unlocks)
_shared/games.js       list of every game shown in the hub
_shared/fonts/         Fredoka and Nunito (open font licence), bundled so it works offline
<GameName>/index.html  one folder per game
manifest.webmanifest, sw.js, precache.js, icons/   installable app + offline support
tools/build.js         rebuilds precache.js (and www/ for the native app)
```

## Adding a game

1. Make a folder with an `index.html` that links `../_shared/arcade.css` and `../_shared/arcade.js`.
2. Add the folder to `FOLDER_IDS` in `_shared/arcade.js` so play time and quests track it.
3. Add an entry to `_shared/games.js` so it shows up in the hub.
4. Call `Arcade.report('score', n)` when a run ends, or `Arcade.count('win')` when someone wins.
   That's all a game needs for xp, quests and achievements.
5. Run `node tools/build.js` so the offline cache knows about the new files.

## Meta system

* Levels: every level needs a bit more xp than the last and pays coins. Some levels unlock themes, avatars, frames and titles.
* Quests: 3 daily and 3 weekly. One free swap a day. Finishing all 3 dailies pays a bonus.
* Login reward: a 7 day cycle that grows each day you come back.
* Achievements: around 130, general ones plus a few for each game.
* Shop: spend coins on themes, avatars, frames, titles and skins.

## Phone app

See [APP.md](APP.md). Short version: host it (GitHub Pages works) and install it from the browser,
or build a native Android / iOS app with Capacitor.
