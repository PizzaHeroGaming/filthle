import {
  MAX_GUESSES,
  WORD_LENGTH,
  scoreGuess,
  updateKeyStates,
  isWin,
} from './game.js';
import { isValidGuess, randomAnswer, dailyAnswer } from './words.js';

const board = document.getElementById('board');
const keyboardEl = document.getElementById('keyboard');
const messageEl = document.getElementById('message');
const modeBtn = document.getElementById('mode-btn');

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

const state = {
  mode: 'daily', // 'daily' | 'endless'
  answer: '',
  guesses: [], // committed guesses (strings)
  current: '', // in-progress row
  over: false,
  keyStates: {}, // letter -> 'correct' | 'present' | 'absent'
};

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

function paintBoard() {
  const rows = board.querySelectorAll('.row');
  state.guesses.forEach((guess, r) => {
    const result = scoreGuess(guess, state.answer);
    const tiles = rows[r].querySelectorAll('.tile');
    tiles.forEach((tile, c) => {
      tile.textContent = guess[c].toUpperCase();
      tile.classList.add('filled', result[c]);
    });
  });

  // in-progress row
  const r = state.guesses.length;
  if (r < MAX_GUESSES) {
    const tiles = rows[r].querySelectorAll('.tile');
    tiles.forEach((tile, c) => {
      tile.textContent = (state.current[c] || '').toUpperCase();
      tile.classList.toggle('filled', !!state.current[c]);
      tile.classList.remove('correct', 'present', 'absent');
    });
  }
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
  if (state.over) return;

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
  state.guesses.push(guess);
  state.current = '';
  updateKeyStates(state.keyStates, guess, result);
  paintBoard();
  paintKeyboard();

  if (isWin(result)) {
    state.over = true;
    recordResult(true, state.guesses.length);
    setTimeout(() => flash(winLine(state.guesses.length), true), 250);
    return;
  }

  if (state.guesses.length >= MAX_GUESSES) {
    state.over = true;
    recordResult(false, null);
    setTimeout(
      () => flash(`Out of guesses — it was ${state.answer.toUpperCase()}`, true),
      250
    );
  }
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

// ---------- game lifecycle ----------

function newGame() {
  state.answer =
    state.mode === 'daily' ? dailyAnswer() : randomAnswer();
  state.guesses = [];
  state.current = '';
  state.over = false;
  state.keyStates = {};
  buildBoard();
  paintBoard();
  paintKeyboard();
  messageEl.textContent = '';
}

function toggleMode() {
  state.mode = state.mode === 'daily' ? 'endless' : 'daily';
  modeBtn.textContent = state.mode === 'daily' ? 'Daily' : 'Endless';
  newGame();
  if (state.mode === 'endless') flash('Endless mode — new word each round');
}

// ---------- wiring ----------

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();

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

buildKeyboard();
newGame();
