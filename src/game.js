// Core Wordle scoring logic — framework-free, fully testable.

export const MAX_GUESSES = 6;
export const WORD_LENGTH = 5;

/**
 * Score a guess against the answer using standard Wordle rules, including
 * correct double-letter handling (a letter only gets "present" credit if the
 * answer has an unmatched copy of it left).
 *
 * Returns an array of WORD_LENGTH states: 'correct' | 'present' | 'absent'.
 */
export function scoreGuess(guess, answer) {
  guess = guess.toLowerCase();
  answer = answer.toLowerCase();

  const result = new Array(WORD_LENGTH).fill('absent');
  const counts = {};

  // First pass: greens, and tally remaining answer letters.
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) {
      result[i] = 'correct';
    } else {
      counts[answer[i]] = (counts[answer[i]] || 0) + 1;
    }
  }

  // Second pass: yellows, drawing from the leftover tally.
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === 'correct') continue;
    const ch = guess[i];
    if (counts[ch] > 0) {
      result[i] = 'present';
      counts[ch] -= 1;
    }
  }

  return result;
}

/**
 * Merge per-letter states into a keyboard color map. A letter's best-known
 * state wins (correct > present > absent) so the keyboard never downgrades.
 */
export function updateKeyStates(keyStates, guess, result) {
  const rank = { absent: 0, present: 1, correct: 2 };
  for (let i = 0; i < guess.length; i++) {
    const ch = guess[i].toLowerCase();
    const next = result[i];
    if (!keyStates[ch] || rank[next] > rank[keyStates[ch]]) {
      keyStates[ch] = next;
    }
  }
  return keyStates;
}

export function isWin(result) {
  return result.every((s) => s === 'correct');
}
