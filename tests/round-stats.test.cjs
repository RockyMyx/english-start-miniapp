const assert = require("node:assert/strict");
const test = require("node:test");
const { countAnswerResults, countPronunciationResults } = require("../utils/round-stats");

test("counts only answered questions once, including after returning to earlier questions", () => {
  const results = [{ correct: true }, null, { correct: false }];
  assert.deepEqual(countAnswerResults(results), { correctCount: 1, wrongCount: 1 });
  assert.deepEqual(countAnswerResults(results), { correctCount: 1, wrongCount: 1 });
});

test("pronunciation retry moves a word from failed to passed without double counting", () => {
  const words = [{ passed: false, voiceResult: { correct: false } }, { passed: false, voiceResult: null }];
  assert.deepEqual(countPronunciationResults(words), { passedCount: 0, failedCount: 1 });
  words[0] = { passed: true, voiceResult: { correct: true } };
  assert.deepEqual(countPronunciationResults(words), { passedCount: 1, failedCount: 0 });
});
