# FILTHLE — a filthy Wordle

A Wordle clone where every answer is crude. Same five-letter, six-guess game you
know — just with a word list that's NSFW. Profanity, body/sex slang, bodily
functions, and innuendo. **No racial/identity/hate slurs.**

> ⚠️ Adult/comedy content. Not for kids. All answers are deliberately vulgar.

## What it is

- Classic Wordle rules: 5 letters, 6 guesses, green = right spot, magenta/lime
  feedback (recolored from the usual green/yellow).
- **Daily** mode — everyone gets the same word on a given calendar date.
- **Endless** mode — random word each round; press any key after a round to go
  again. Toggle with the button in the top bar.
- On-screen keyboard + physical keyboard, so it works on phone and desktop.
- **Stats** (📊 button): games played, win %, current streak, max streak, and a
  guess-distribution chart. Daily-only (streaks count consecutive solved days);
  the popup auto-opens when a Daily ends. Saved locally per browser.
- **Progress is saved.** Your in-progress or finished game is stored locally and
  restored on reload — so the Daily can't be re-rolled by refreshing the page.
  Daily and Endless keep separate saves; the Daily save is keyed to the puzzle
  number and resets automatically when a new day's word comes up.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs static site to dist/
npm run preview  # preview the production build
```

Lint / format:

```bash
npm run lint
npm run format
```

## Controls

- **Type** letters (keyboard or on-screen).
- **Enter** to submit a guess.
- **Backspace / ⌫** to delete.
- In **Endless**, any key after a finished round starts a new one.

## The word list

All word data lives in [`src/words.js`](src/words.js):

- `ANSWER_POOL` — the curated pool answers are drawn from. Edit this to add or
  remove words. Keep entries **exactly 5 letters, lowercase**; non-5-letter
  entries are filtered out automatically.
- `isValidGuess()` — what players may type. Validation is **lenient by default**
  (any real-looking 5-letter word is accepted) so normal probe words like
  `crane` aren't rejected. There's no full English dictionary bundled.

### Want strict guess validation?

Set `LENIENT = false` in `src/words.js` and populate the `EXTRA_GUESSES` set
with a real 5-letter dictionary (e.g. drop in a word-list file and import it).
With lenient mode off, only words in the answer pool + `EXTRA_GUESSES` are
accepted.

## Content tier

This build is **"crude but no slurs."** If you ever want to dial it up or down,
that's purely a `src/words.js` edit — the game logic doesn't care what the words
are.

## Tech

- [Vite](https://vitejs.dev/) + vanilla JavaScript (ES modules)
- No framework, no runtime dependencies
- Relative asset paths (`base: './'`) so it hosts from a subfolder (GitHub Pages)
  and survives being wrapped for a store later

## License

All rights reserved. © 2026 Pizza Hero Gaming. Not for redistribution.
