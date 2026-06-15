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

  // Animate the flip; everything that reacts to the result happens after it.
  revealRow(row, result, () => {
    updateKeyStates(state.keyStates, guess, result);
    paintKeyboard();

    if (isWin(result)) {
      state.over = true;
      state.won = true;
      recordResult(true, state.guesses.length);
      bounceRow(row);
      flash(winLine(state.guesses.length), true);
      showShare();
      return;
    }

    if (state.guesses.length >= MAX_GUESSES) {
      state.over = true;
      state.won = false;
      recordResult(false, null);
      flash(`Out of guesses — it was ${state.answer.toUpperCase()}`, true);
      showShare();
    }
  });
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

// ---------- stats (localStorage) ----------

function recordResult(won, guessCount) {
  try {
    const stats = JSON.parse(localStorage.getItem('filthle-stats') || '{}');
    stats.played = (stats.played || 0) + 1;
    if (won) {
      stats.wins = (stats.wins || 0) + 1;
      stats.dist = stats.dist || {};
      stats.dist[guessCount] = (stats.dist[guessCount] || 0) + 1;
    }
    localStorage.setItem('filthle-stats', JSON.stringify(stats));
  } catch {
    // storage unavailable (private mode / wrapper) — non-fatal, just skip stats
  }
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

async function doShare() {
  const text = buildShareText();
  // Prefer the native share sheet on mobile / wrapped builds.
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch {
      // user cancelled or share failed — fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    flash('Copied to clipboard');
  } catch {
    // last-resort fallback for older / non-secure contexts
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      flash('Copied to clipboard');
    } catch {
      flash('Could not copy');
    }
    ta.remove();
  }
}

function showShare() {
  shareBtn.classList.remove('hidden');
}

function hideShare() {
  shareBtn.classList.add('hidden');
}

// ---------- game lifecycle ----------

function newGame() {
  state.answer =
    state.mode === 'daily' ? dailyAnswer() : randomAnswer();
  state.guesses = [];
  state.current = '';
  state.over = false;
  state.won = false;
  state.revealing = false;
  state.keyStates = {};
  buildBoard();
  paintBoard();
  paintKeyboard();
  messageEl.textContent = '';
  hideShare();
}

function toggleMode() {
  state.mode = state.mode === 'daily' ? 'endless' : 'daily';
  modeBtn.textContent = state.mode === 'daily' ? 'Daily' : 'Endless';
  newGame();
  if (state.mode === 'endless') flash('Endless mode — new word each round');
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

  // While the help modal is open, swallow keys (Esc closes it).
  if (isHelpOpen()) {
    if (k === 'escape') closeHelp();
    return;
  }

  // In endless mode, any letter/enter after game-over starts a fresh round.
  if (
    state.over &&
    state.mode === 'endless' &&
    (k === 'enter' || /^[a-z]$/.test(k))
  ) {
    newGame();
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

buildKeyboard();
newGame();
maybeShowHelpOnFirstVisit();
