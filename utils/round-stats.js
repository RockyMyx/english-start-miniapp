function countAnswerResults(results) {
  return results.reduce(
    (counts, result) => {
      if (!result) return counts;
      if (result.correct) counts.correctCount += 1;
      else counts.wrongCount += 1;
      return counts;
    },
    { correctCount: 0, wrongCount: 0 }
  );
}

function countPronunciationResults(words) {
  return {
    passedCount: words.filter((word) => word.passed).length,
    failedCount: words.filter((word) => word.voiceResult && !word.passed).length
  };
}

module.exports = { countAnswerResults, countPronunciationResults };
