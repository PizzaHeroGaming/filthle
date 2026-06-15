// Word data for Vulgar Wordle.
//
// Content tier: "crude but no slurs" — profanity, body/sex slang, bodily
// functions, and innuendo. Deliberately EXCLUDES racial/identity/hate slurs
// and the harshest gendered slurs. If you want to add/remove words, edit the
// ANSWERS array; keep everything exactly 5 letters and lowercase.
//
// Two-list design, same as real Wordle:
//   ANSWERS        — the curated vulgar pool the daily/random word is drawn from.
//   isValidGuess() — the much larger set of words a player may TYPE as a guess
//                    (full English dictionary + the vulgar answers).
//
// Guesses are validated against a bundled ~15k-word English dictionary
// (src/dictionary.js) UNIONED with the vulgar answer pool below, so real words
// are accepted and typos are rejected — and every answer is always a legal
// guess even if it isn't in the standard dictionary.

import { DICTIONARY_RAW } from './dictionary.js';

export const ANSWERS = [
  // --- profanity core ---
  'shits',
  'shite',
  'fucks',
  'pissy',
  'craps',
  'turds',
  'farts',
  'damns',
  'hells',
  'arses',
  'asses',
  'butts',

  // --- anatomy: rude ---
  'dicks',
  'cocks',
  'prick',
  'knobs',
  'willy',
  'wangs',
  'chode',
  'choad',
  'balls',
  'gonad',
  'sacks',
  'shaft',
  'girth',
  'pubes',
  'groin',
  'penis',
  'boobs',
  'booby',
  'titty',
  'teats',
  'udder',
  'melon',
  'rack',
  'twats',
  'fanny',
  'minge',
  'gooch',
  'taint',
  'vulva',
  'labia',
  'cooch',
  'snatch',
  'booty',
  'rump',
  'tush',
  'cheek',
  'crack',
  'rears',

  // --- bodily fluids / functions ---
  'semen',
  'sperm',
  'spunk',
  'spurt',
  'queef',
  'poops',
  'poopy',
  'poohs',
  'dumps',
  'pees',
  'snots',
  'snot',
  'burps',
  'belch',
  'puke',
  'pukes',
  'barfs',
  'ralph',
  'booger',
  'fluid',
  'gooey',

  // --- acts / verbs ---
  'screw',
  'bangs',
  'boink',
  'shags',
  'bonks',
  'humps',
  'hump',
  'poke',
  'pokes',
  'prods',
  'grope',
  'grabs',
  'spank',
  'smack',
  'twerk',
  'grind',
  'thrust',
  'diddle',
  'fondle',
  'tease',
  'mount',
  'rides',
  'stuff',

  // --- states / vibes ---
  'horny',
  'randy',
  'kinky',
  'naked',
  'nudes',
  'nudie',
  'bared',
  'erect',
  'woody',
  'stiff',
  'limp',
  'moist',
  'juicy',
  'slick',
  'gushy',
  'meaty',
  'thicc',
  'frisk',
  'drunk',
  'boozy',
  'tipsy',
  'sozzled',

  // --- insults / characters ---
  'bimbo',
  'tramp',
  'hussy',
  'sluts',
  'vixen',
  'tarts',
  'wench',
  'skank',
  'floozy',
  'dweeb',
  'dummy',
  'idiot',
  'moron',
  'dunce',
  'twit',
  'dorks',
  'goons',

  // --- descriptors ---
  'nasty',
  'dirty',
  'filth',
  'lewds',
  'smut',
  'gross',
  'icky',
  'yucky',
  'sweat',
  'stink',
  'reeks',
  'funky',
  'musty',
  'sloppy',

  // --- innuendo (technically-clean but filthy in context) ---
  'wood',
  'plums',
  'mound',
  'cleft',
  'slits',
  'holes',
  'throb',
  'pulse',
  'cream',
  'spank',
  'lusty',
  'flirt',
  'tease',
  'sexed',
  'sexes',
].filter((w) => w.length === 5);

// De-duplicate (a few words intentionally appear in more than one category
// above) and freeze the final pool.
const uniqueAnswers = [...new Set(ANSWERS)];
export const ANSWER_POOL = Object.freeze(uniqueAnswers);

// The set of legal guesses: the bundled English dictionary unioned with the
// vulgar answer pool (so an answer is always typeable even if it's not in the
// standard Wordle dictionary). Built once at module load.
const VALID_GUESSES = new Set(DICTIONARY_RAW.split('\n'));
for (const w of ANSWER_POOL) VALID_GUESSES.add(w);

/** A guess is valid if it's exactly 5 letters and a known word. */
export function isValidGuess(word) {
  const w = word.toLowerCase();
  if (!/^[a-z]{5}$/.test(w)) return false;
  return VALID_GUESSES.has(w);
}

/** Total number of accepted guess words (dictionary + vulgar answers). */
export const VALID_GUESS_COUNT = VALID_GUESSES.size;

/** Pick a random answer (used for the casual/endless mode). */
export function randomAnswer(rng = Math.random) {
  const i = Math.floor(rng() * ANSWER_POOL.length);
  return ANSWER_POOL[i];
}

// The Daily resets at midnight US Eastern (ET) for everyone, no matter their
// own timezone. Using Intl with America/New_York means EST/EDT (daylight
// saving) is handled for us — the offset shifts automatically.
const ET_DATE_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar date in US Eastern as { y, m, d } (m is 1-12). */
function easternParts(date) {
  const parts = ET_DATE_FMT.formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

/** Day number since launch (Eastern 2026-01-01 = #1). The daily puzzle id. */
export function dailyNumber(date = new Date()) {
  const epoch = Date.UTC(2026, 0, 1);
  const { y, m, d } = easternParts(date);
  const today = Date.UTC(y, m - 1, d);
  return Math.floor((today - epoch) / 86400000) + 1;
}

/**
 * Deterministic "word of the day" so everyone sharing the game on the same
 * date gets the same answer. Seeded from the calendar date.
 */
export function dailyAnswer(date = new Date()) {
  const dayIndex = dailyNumber(date) - 1;
  const i =
    ((dayIndex % ANSWER_POOL.length) + ANSWER_POOL.length) % ANSWER_POOL.length;
  return ANSWER_POOL[i];
}
