// Deterministic analysis of the real rules; no browser, saved game, or src mutation.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';

const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
const dataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const domain = dataUrl(
  compile(await readFile(new URL('../src/domain.ts', import.meta.url), 'utf8')),
);
const source = compile(await readFile(new URL('../src/game.ts', import.meta.url), 'utf8'));
assert(source.includes("from './domain'"), 'Update analysis loader after game import changes');
const { newGame, play, parseGame, serializeGame } = await import(
  dataUrl(source.replace("from './domain'", `from '${domain}'`))
);

const upgrade = (placeId, kind) => ({ type: 'upgrade', placeId, upgrade: kind });
const advise = { type: 'advise' };
const advance = { type: 'advance' };
function campaign(name, turns) {
  let state = newGame();
  const waves = [];
  for (const actions of turns) {
    for (const action of actions) state = play(state, action);
    state = play(state, advance);
    const outcomes = state.outcomes.filter((o) => o.turn === state.turn - 1);
    waves.push({
      housed: outcomes.filter((o) => o.placeId).length,
      score: outcomes.reduce((sum, o) => sum + o.score, 0),
      outcomes,
    });
  }
  assert.equal(state.turn, 4);
  assert.deepEqual(parseGame(serializeGame(state)), state);
  return {
    name,
    housed: waves.reduce((sum, wave) => sum + wave.housed, 0),
    score: waves.reduce((sum, wave) => sum + wave.score, 0),
    tokens: state.tokens,
    waves,
  };
}

const reasonable = [
  ['castle', 'quiet'],
  ['library', 'dark'],
  ['manor', 'damp'],
];
const strategies = [
  campaign(
    'one-house-per-wave',
    reasonable.map(([p, u]) => [upgrade(p, u), advise]),
  ),
  campaign('advisor-without-upgrades', [[advise], [advise], [advise]]),
  campaign('all-upgrades-one-house', [
    [upgrade('castle', 'quiet'), upgrade('castle', 'dark'), upgrade('castle', 'damp'), advise],
    [advise],
    [advise],
  ]),
  campaign('two-quiet-houses', [
    [upgrade('castle', 'quiet'), upgrade('library', 'quiet'), advise],
    [upgrade('manor', 'dark'), advise],
    [advise],
  ]),
  campaign('skip-first-wave', [
    [advise],
    [upgrade('castle', 'dark'), upgrade('castle', 'quiet'), advise],
    [upgrade('manor', 'damp'), advise],
  ]),
];
assert.deepEqual(
  strategies.map(({ housed, score, tokens }) => [housed, score, tokens]),
  [
    [6, 476, 0],
    [0, 0, 3],
    [2, 172, 0],
    [4, 336, 0],
    [4, 320, 0],
  ],
);

// To house six with three tokens, each condition needs its own upgrade and its own
// two-slot house. Thus these six permutations cover all full-housing plans; the
// advisor maximizes comfort for each wave. Upgrade timing cannot improve a score
// without spending a fourth token. This is not an enumeration of all partial runs.
const houses = ['castle', 'library', 'manor'];
const fullHousing = [];
for (const quiet of houses) {
  for (const dark of houses.filter((id) => id !== quiet)) {
    const damp = houses.find((id) => id !== quiet && id !== dark);
    fullHousing.push(
      campaign(`${quiet}/${dark}/${damp}`, [
        [upgrade(quiet, 'quiet'), advise],
        [upgrade(dark, 'dark'), advise],
        [upgrade(damp, 'damp'), advise],
      ]),
    );
  }
}
assert(fullHousing.every((result) => result.housed === 6));
assert.equal(Math.max(...fullHousing.map((result) => result.score)), 476);
assert.equal(Math.min(...fullHousing.map((result) => result.score)), 460);
// A plan missing a condition upgrade can house at most four (<=400 points).
// Covering all three conditions costs all tokens. If two upgrades share a house,
// capacity limits total housing to four. Otherwise any partial assignment can be
// extended to its corresponding full-housing plan, without changing prior scores.
// Thus no partial plan can exceed the maximum of the six full-housing plans.
console.log(JSON.stringify({ strategies, fullHousing, fullHousingMaximum: 476 }, null, 2));
