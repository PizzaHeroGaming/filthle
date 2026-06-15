import {
  MAX_GUESSES,
  WORD_LENGTH,
  scoreGuess,
  updateKeyStates,
  isWin,
} from './game.js';
import {
  isValidGuess,
  randomAnswer,
  dailyAnswer,
  dailyNumber,
} from './words.js';

const SITE_URL = 'https://pizzaherogaming.github.io/filthle/';

const board = document.getElementById('board');
const keyboardEl = document.getElementById('keyboard');
const messageEl = document.getElementById('message');
const modeBtn = document.getElementById('mode-btn');
const helpModal = document.getElementById('help-modal');
const helpBtn = document.getElementById('help-btn');
const statsModal = document.getElementById('stats-modal');
const statsBtn = document.getElementById('stats-btn');
const shareBtn = document.getElementById('share-btn');

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const state = {
  mode: 'daily', // 'daily' | 'endless'
  answer: '',
  guesses: [], // committed guesses (strings)
  current: '', // in-progress row
  over: false,
  won: false,
  revealing: false, // true while a row's flip animation plays
  keyStates: {}, // letter -> 'correct' | 'present' | 'absent'
};

// Flip-reveal timing (kept in one place so JS + CSS stay in sync).
const FLIP_MS = 500; // full flip duration
const FLIP_STAGGER = 280; // delay between consecutive tiles

// ---------- rendering ----------

function buildBoard() {
  board.innerHTML = '';
  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.row = String(r);
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.col = String(c);
      row.appendChild(tile);
    }
    board.appendChild(row);
  }
}

function buildKeyboard() {
  keyboardEl.innerHTML = '';
  KEY_ROWS.forEach((rowKeys, idx) => {
    const row = document.createElement('div');
    row.className = 'key-row';

    if (idx === 2) row.appendChild(makeKey('Enter', 'enter', 'wide'));

    for (const ch of rowKeys) row.appendChild(makeKey(ch, ch));

    if (idx === 2) row.appendChild(makeKey('⌫', 'backspace', 'wide'));

    keyboardEl.appendChild(row);
  });
}

function makeKey(label, value, extra = '') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `key ${extra}`.trim();
  btn.textContent = label;
  btn.dataset.key = value;
  btn.addEventListener('click', () => handleKey(value));
  return btn;
}

// Render only the in-progress row. Committed rows are painted (with their
// colors) by revealRow during the flip animation and then left untouched, so
// nothing here can snap a revealed color or re-trigger an animation.
function paintBoard() {
  const r = state.guesses.length;
  if (r >= MAX_GUESSES) return;
  const tiles = board.querySelectorAll('.row')[r].querySelectorAll('.tile');
  tiles.forEach((tile, c) => {
    const ch = state.current[c];
    tile.textContent = (ch || '').toUpperCase();
    tile.classList.toggle('filled', !!ch);
    // brief pop on the most-recently typed tile
    if (ch && c === state.current.length - 1) {
      tile.classList.remove('pop');
      void tile.offsetWidth;
      tile.classList.add('pop');
    }
  });
}

// Flip each tile in row `r` in sequence, revealing its color at the midpoint
// of the flip. Calls onDone once the whole row has finished.
function revealRow(r, result, onDone) {
  state.revealing = true;
  const tiles = board.querySelectorAll('.row')[r].querySelectorAll('.tile');
  tiles.forEach((tile, c) => {
    setTimeout(() => {
      tile.classList.add('reveal');
      // apply the color as the tile turns edge-on (halfway through the flip)
      setTimeout(() => tile.classList.add(result[c]), FLIP_MS / 2);
    }, c * FLIP_STAGGER);
  });
  const total = (tiles.length - 1) * FLIP_STAGGER + FLIP_MS;
  setTimeout(() => {
    state.revealing = false;
    if (onDone) onDone();
  }, total + 30);
}

// Little victory hop across the winning row.
function bounceRow(r) {
  const tiles = board.querySelectorAll('.row')[r].querySelectorAll('.tile');
  tiles.forEach((tile, c) => {
    setTimeout(() => {
      tile.classList.add('jump');
      setTimeout(() => tile.classList.remove('jump'), 500);
    }, c * 90);
  });
}

function paintKeyboard() {
  keyboardEl.querySelectorAll('.key').forEach((btn) => {
    const k = btn.dataset.key;
    btn.classList.remove('correct', 'present', 'absent');
    if (state.keyStates[k]) btn.classList.add(state.keyStates[k]);
  });
}

let messageTimer = null;
function flash(text, sticky = false) {
  messageEl.textContent = text;
  if (messageTimer) clearTimeout(messageTimer);
  if (!sticky) {
    messageTimer = setTimeout(() => {
      messageEl.textContent = '';
    }, 1600);
  }
}

function shakeRow() {
  const row = board.querySelectorAll('.row')[state.guesses.length];
  if (!row) return;
  row.classList.remove('shake');
  void row.offsetWidth; // restart animation
  row.classList.add('shake');
}

// ---------- input ----------

function handleKey(key) {
  if (state.over || state.revealing) return;

  if (key === 'enter') return submitGuess();
  if (key === 'backspace') {
    state.current = state.current.slice(0, -1);
    paintBoard();
    return;
  }
  if (/^[a-z]$/.test(key) && state.current.length < WORD_LENGTH) {
    state.current += key;
    paintBoard();
  }
}

function submitGuess() {
  if (state.current.length !== WORD_LENGTH) {
    flash('Not enough letters');
    shakeRow();
    return;
  }
  if (!isValidGuess(state.current)) {
    flash('Not a word');
    shakeRow();
    return;
  }

  const guess = state.current;
  const result = scoreGuess(guess, state.answer);
  const row = state.guesses.length;
  state.guesses.push(guess);
  state.current = '';
  // Save immediately so a refresh mid-reveal still counts this guess —
  // you can't refresh your way out of an attempt.
  persist();

  // Animate the flip; everything that reacts to the result happens after it.
  revealRow(row, result, () => {
    updateKeyStates(state.keyStates, guess, result);
    paintKeyboard();

    if (isWin(result)) {
      state.over = true;
      state.won = true;
      recordResult(true, state.guesses.length);
      persist();
      bounceRow(row);
      showEndState();
      autoOpenStats(state.guesses.length);
      return;
    }

    if (state.guesses.length >= MAX_GUESSES) {
      state.over = true;
      state.won = false;
      recordResult(false, null);
      persist();
      showEndState();
      autoOpenStats(null);
    }
  });
}

// After a Daily ends, slide the stats up so the player sees their streak.
function autoOpenStats(highlightGuess) {
  if (state.mode !== 'daily') return;
  setTimeout(() => openStats(highlightGuess), 1500);
}

function winLine(n) {
  const lines = [
    'Filthy genius.',
    'Nailed it.',
    'Dirty work.',
    'Got there.',
    'Phew.',
    'Clutch.',
  ];
  return `${lines[Math.min(n - 1, lines.length - 1)]} (${n}/${MAX_GUESSES})`;
}

// ---------- stats (localStorage, Daily only) ----------

function loadStats() {
  const base = {
    played: 0,
    wins: 0,
    dist: {},
    currentStreak: 0,
    maxStreak: 0,
    lastDay: null, // dailyNumber of the last Daily that was recorded
  };
  try {
    const s = JSON.parse(localStorage.getItem('filthle-stats') || '{}');
    return { ...base, ...s, dist: { ...base.dist, ...(s.dist || {}) } };
  } catch {
    return base;
  }
}

function saveStats(stats) {
  try {
    localStorage.setItem('filthle-stats', JSON.stringify(stats));
  } catch {
    // storage unavailable — non-fatal
  }
}

// Record a finished Daily. Streaks count consecutive solved days; a miss or a
// skipped day resets the current streak. Endless games are not tracked.
function recordResult(won, guessCount) {
  if (state.mode !== 'daily') return;
  const stats = loadStats();
  const today = dailyNumber();
  if (stats.lastDay === today) return; // already recorded today (safety)

  stats.played += 1;
  if (won) {
    stats.wins += 1;
    stats.dist[guessCount] = (stats.dist[guessCount] || 0) + 1;
    stats.currentStreak = stats.lastDay === today - 1 ? stats.currentStreak + 1 : 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
  } else {
    stats.currentStreak = 0;
  }
  stats.lastDay = today;
  saveStats(stats);
}

// ---------- stats modal ----------

function renderStats(highlightGuess) {
  const s = loadStats();
  document.getElementById('stat-played').textContent = s.played;
  document.getElementById('stat-winrate').textContent = s.played
    ? Math.round((100 * s.wins) / s.played)
    : 0;
  document.getElementById('stat-streak').textContent = s.currentStreak;
  document.getElementById('stat-max').textContent = s.maxStreak;

  const counts = [1, 2, 3, 4, 5, 6].map((n) => s.dist[n] || 0);
  const max = Math.max(1, ...counts);
  const container = document.getElementById('stat-dist');
  container.innerHTML = '';
  counts.forEach((c, i) => {
    const n = i + 1;
    const row = document.createElement('div');
    row.className = 'dist-row' + (highlightGuess === n ? ' hot' : '');
    const idx = document.createElement('span');
    idx.className = 'idx';
    idx.textContent = n;
    const track = document.createElement('div');
    track.className = 'track';
    const bar = document.createElement('span');
    bar.className = 'bar';
    bar.style.width = `${Math.max(8, Math.round((c / max) * 100))}%`;
    bar.textContent = c;
    track.appendChild(bar);
    row.append(idx, track);
    container.appendChild(row);
  });

  document.getElementById('stat-empty').classList.toggle('hidden', s.played > 0);
}

function openStats(highlightGuess) {
  renderStats(highlightGuess);
  statsModal.classList.remove('hidden');
}

function closeStats() {
  statsModal.classList.add('hidden');
}

function isStatsOpen() {
  return !statsModal.classList.contains('hidden');
}

// ---------- share ----------

const EMOJI = { correct: '🟪', present: '🟩', absent: '⬛' };

function buildShareText() {
  const score = state.won ? state.guesses.length : 'X';
  const header =
    state.mode === 'daily'
      ? `FILTHLE #${dailyNumber()}  ${score}/${MAX_GUESSES}`
      : `FILTHLE (endless)  ${score}/${MAX_GUESSES}`;
  const grid = state.guesses
    .map((g) =>
      scoreGuess(g, state.answer)
        .map((s) => EMOJI[s])
        .join('')
    )
    .join('\n');
  return `${header}\n\n${grid}\n${SITE_URL}`;
}

// Copy text to the clipboard, with a fallback for older / non-secure contexts.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fall through to the legacy execCommand path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

let shareLabelTimer = null;
function flashShareLabel(text) {
  if (shareLabelTimer) clearTimeout(shareLabelTimer);
  shareBtn.textContent = text;
  shareLabelTimer = setTimeout(() => {
    shareBtn.textContent = 'Share 📋';
  }, 1900);
}

async function doShare() {
  const text = buildShareText();

  // On touch devices, the native share sheet is the natural way to fire it
  // straight into Messages/Discord. On desktop we always copy so it can be
  // pasted anywhere.
  const isTouch =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;

  if (isTouch && navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch {
      // user cancelled or share failed — fall back to copying
    }
  }

  const ok = await copyText(text);
  flashShareLabel(ok ? 'Copied! ✓' : 'Copy failed');
}

function showShare() {
  shareBtn.classList.remove('hidden');
}

function hideShare() {
  shareBtn.classList.add('hidden');
}

// ---------- persistence ----------

const SAVE_KEYS = { daily: 'filthle-daily', endless: 'filthle-endless' };

// Save the current game so a refresh restores it exactly.
//  - daily   keyed by puzzle number (answer is derivable, so not stored)
//  - endless stores the random answer (not otherwise recoverable)
function persist() {
  try {
    const data = {
      guesses: state.guesses,
      over: state.over,
      won: state.won,
    };
    if (state.mode === 'daily') data.day = dailyNumber();
    else data.answer = state.answer;
    localStorage.setItem(SAVE_KEYS[state.mode], JSON.stringify(data));
    localStorage.setItem('filthle-mode', state.mode);
  } catch {
    // storage unavailable — game still works, just won't persist
  }
}

// Return a restorable save for `mode`, or null. Daily saves from a previous
// day are ignored (and cleared) so a new word is started.
function loadSaved(mode) {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEYS[mode]) || 'null');
    if (!s || !Array.isArray(s.guesses)) return null;
    if (mode === 'daily') {
      if (s.day !== dailyNumber()) {
        localStorage.removeItem(SAVE_KEYS.daily);
        return null;
      }
    } else if (typeof s.answer !== 'string') {
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

// ---------- game lifecycle ----------

function showEndState() {
  if (state.won) {
    let msg = winLine(state.guesses.length);
    if (state.mode === 'daily') {
      const streak = loadStats().currentStreak;
      if (streak > 1) msg = `${streak}-day streak! ` + msg;
    }
    flash(msg, true);
  } else {
    flash(`Out of guesses — it was ${state.answer.toUpperCase()}`, true);
  }
  showShare();
}

// Instantly paint already-committed guesses (no flip) when restoring a save.
function renderRestored() {
  const rows = board.querySelectorAll('.row');
  state.guesses.forEach((guess, r) => {
    const result = scoreGuess(guess, state.answer);
    const tiles = rows[r].querySelectorAll('.tile');
    tiles.forEach((tile, c) => {
      tile.textContent = guess[c].toUpperCase();
      tile.classList.add('filled', result[c]);
    });
    updateKeyStates(state.keyStates, guess, result);
  });
}

// Reset shared state and rebuild the empty board.
function resetState(mode, answer) {
  state.mode = mode;
  state.answer = answer;
  state.current = '';
  state.revealing = false;
  state.keyStates = {};
  modeBtn.textContent = mode === 'daily' ? 'Daily' : 'Endless';
  buildBoard();
  messageEl.textContent = '';
  hideShare();
}

// Start `mode`, restoring a saved game if one exists for it.
function startGame(mode) {
  const saved = loadSaved(mode);
  const answer =
    mode === 'daily'
      ? dailyAnswer()
      : saved
        ? saved.answer
        : randomAnswer();

  resetState(mode, answer);
  state.guesses = saved ? saved.guesses.slice() : [];
  state.over = saved ? !!saved.over : false;
  state.won = saved ? !!saved.won : false;

  renderRestored();
  paintBoard();
  paintKeyboard();
  if (state.over) showEndState();
  persist();
}

// Endless only: abandon the current word and roll a fresh one.
function freshEndless() {
  try {
    localStorage.removeItem(SAVE_KEYS.endless);
  } catch {
    // ignore
  }
  resetState('endless', randomAnswer());
  state.guesses = [];
  state.over = false;
  state.won = false;
  paintBoard();
  paintKeyboard();
  persist();
}

function toggleMode() {
  const next = state.mode === 'daily' ? 'endless' : 'daily';
  startGame(next);
  if (next === 'endless' && !state.over && state.guesses.length === 0) {
    flash('Endless mode — new word each round');
  }
}

// ---------- help modal ----------

function openHelp() {
  helpModal.classList.remove('hidden');
}

function closeHelp() {
  helpModal.classList.add('hidden');
  try {
    localStorage.setItem('filthle-seen-help', '1');
  } catch {
    // storage unavailable — non-fatal
  }
}

function isHelpOpen() {
  return !helpModal.classList.contains('hidden');
}

function maybeShowHelpOnFirstVisit() {
  let seen = null;
  try {
    seen = localStorage.getItem('filthle-seen-help');
  } catch {
    // storage unavailable — just show it
  }
  if (!seen) openHelp();
}

// ---------- wiring ----------

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();

  // While a modal is open, swallow game keys (Esc closes it).
  if (isHelpOpen()) {
    if (k === 'escape') closeHelp();
    return;
  }
  if (isStatsOpen()) {
    if (k === 'escape') closeStats();
    return;
  }

  // In endless mode, any letter/enter after game-over starts a fresh round.
  if (
    state.over &&
    state.mode === 'endless' &&
    (k === 'enter' || /^[a-z]$/.test(k))
  ) {
    freshEndless();
    return;
  }

  if (k === 'enter') return handleKey('enter');
  if (k === 'backspace') return handleKey('backspace');
  if (/^[a-z]$/.test(k)) handleKey(k);
});

modeBtn.addEventListener('click', toggleMode);
shareBtn.addEventListener('click', doShare);

helpBtn.addEventListener('click', openHelp);
document.getElementById('help-close').addEventListener('click', closeHelp);
document.getElementById('help-play').addEventListener('click', closeHelp);
helpModal.addEventListener('click', (e) => {
  // click on the dark overlay (outside the dialog) closes it
  if (e.target === helpModal) closeHelp();
});

statsBtn.addEventListener('click', () => openStats());
document.getElementById('stats-close').addEventListener('click', closeStats);
statsModal.addEventListener('click', (e) => {
  if (e.target === statsModal) closeStats();
});

// Restore the last mode the player was in (defaults to daily).
let initialMode = 'daily';
try {
  const m = localStorage.getItem('filthle-mode');
  if (m === 'endless' || m === 'daily') initialMode = m;
} catch {
  // ignore
}

buildKeyboard();
startGame(initialMode);
maybeShowHelpOnFirstVisit();
