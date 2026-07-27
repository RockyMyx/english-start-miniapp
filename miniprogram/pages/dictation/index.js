const { request } = require("../../utils/request");
const { playSpeech, stopSpeech } = require("../../utils/speech");
const {
  playFeedbackSound,
  prepareFeedbackSound
} = require("../../utils/feedback-sound");
const { syncDailyGoal } = require("../../utils/learning-progress");

function shuffled(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

Page({
  data: {
    loading: true,
    error: "",
    allWords: [],
    words: [],
    rangeMode: "all",
    dictationCount: 10,
    dictationCountInput: "10",
    selectedWordIds: [],
    selectedCount: 0,
    selectorVisible: false,
    selectorWords: [],
    index: 0,
    current: null,
    answer: "",
    result: null,
    correctCount: 0,
    finished: false,
    summary: null,
    speaking: false
  },

  onLoad() {
    this.loadWords();
  },

  onUnload() {
    stopSpeech();
  },

  async loadWords() {
    this.setData({ loading: true, error: "" });
    try {
      const result = await request({ url: "/words" });
      const allWords = result.words || [];
      this.setData({ allWords }, () => this.prepareRound());
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  getRoundSource() {
    if (this.data.rangeMode === "all") return this.data.allWords;
    return this.data.allWords.filter((word) =>
      this.data.selectedWordIds.includes(String(word.id))
    );
  },

  prepareRound() {
    const source = this.getRoundSource();
    if (!source.length) {
      this.setData({
        words: [],
        current: null,
        index: 0,
        answer: "",
        result: null,
        correctCount: 0,
        finished: false,
        summary: null
      });
      if (this.data.rangeMode === "selected") {
        wx.showToast({ title: "请至少选择一个单词", icon: "none" });
      }
      return;
    }

    const requestedCount = Number.parseInt(this.data.dictationCountInput, 10);
    const dictationCount = Math.min(
      source.length,
      Math.max(1, Number.isFinite(requestedCount) ? requestedCount : 10)
    );
    const words = shuffled(source)
      .slice(0, dictationCount)
      .map((word) => ({ ...word, answerState: null }));
    this.setData({
      words,
      dictationCount,
      dictationCountInput: String(dictationCount),
      current: words[0] || null,
      index: 0,
      answer: "",
      result: null,
      correctCount: 0,
      finished: false,
      summary: null,
      error: ""
    });
  },

  setRangeMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (mode === "all") {
      this.setData({ rangeMode: "all" }, () => this.prepareRound());
      return;
    }
    this.openWordSelector();
  },

  onDictationCountInput(event) {
    this.setData({ dictationCountInput: event.detail.value });
  },

  applyDictationCount() {
    this.prepareRound();
  },

  openWordSelector() {
    const selectedIds = this.data.selectedWordIds;
    const selectorWords = this.data.allWords.map((word) => ({
      ...word,
      selected: selectedIds.includes(String(word.id))
    }));
    this.setData({
      selectorWords,
      selectedCount: selectorWords.filter((word) => word.selected).length,
      selectorVisible: true
    });
  },

  closeWordSelector() {
    this.setData({ selectorVisible: false });
  },

  keepSelectorOpen() {},

  toggleSelectorWord(event) {
    const index = Number(event.currentTarget.dataset.index);
    const selectorWords = [...this.data.selectorWords];
    selectorWords[index] = {
      ...selectorWords[index],
      selected: !selectorWords[index].selected
    };
    this.setData({
      selectorWords,
      selectedCount: selectorWords.filter((word) => word.selected).length
    });
  },

  selectAllSelectorWords() {
    const selectorWords = this.data.selectorWords.map((word) => ({
      ...word,
      selected: true
    }));
    this.setData({
      selectorWords,
      selectedCount: selectorWords.length
    });
  },

  clearSelectorWords() {
    const selectorWords = this.data.selectorWords.map((word) => ({
      ...word,
      selected: false
    }));
    this.setData({ selectorWords, selectedCount: 0 });
  },

  confirmWordSelector() {
    const selectedWordIds = this.data.selectorWords
      .filter((word) => word.selected)
      .map((word) => String(word.id));
    if (!selectedWordIds.length) {
      wx.showToast({ title: "请至少选择一个单词", icon: "none" });
      return;
    }
    this.setData(
      {
        rangeMode: "selected",
        selectedWordIds,
        selectedCount: selectedWordIds.length,
        selectorVisible: false
      },
      () => this.prepareRound()
    );
  },

  onAnswerInput(event) {
    this.setData({ answer: event.detail.value });
  },

  async playCurrent() {
    if (!this.data.current || this.data.speaking) return;
    this.setData({ speaking: true, error: "" });
    try {
      await playSpeech(this.data.current.english, "word");
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ speaking: false });
    }
  },

  async submit() {
    if (!this.data.answer.trim() || this.data.result) return;
    prepareFeedbackSound();
    try {
      const result = await request({
        url: "/practice/answers",
        method: "POST",
        data: {
          mode: "DICTATION",
          wordId: this.data.current.id,
          answerText: this.data.answer
        }
      });
      const answeredWord = {
        ...this.data.current,
        answerState: {
          answer: this.data.answer,
          result
        }
      };
      const words = [...this.data.words];
      words[this.data.index] = answeredWord;
      this.setData({
        words,
        current: answeredWord,
        result,
        correctCount: this.data.correctCount + (result.correct ? 1 : 0)
      });
      playFeedbackSound(result.correct);
      if (result.correct) syncDailyGoal();
    } catch (error) {
      this.setData({ error: error.message });
    }
  },

  previous() {
    if (this.data.index === 0) return;
    this.showWord(this.data.index - 1);
  },

  next() {
    if (!this.data.result) return;
    const nextIndex = this.data.index + 1;
    if (nextIndex >= this.data.words.length) {
      this.finishRound();
      return;
    }
    this.showWord(nextIndex);
  },

  showWord(index) {
    const current = this.data.words[index];
    const answerState = current.answerState;
    this.setData({
      index,
      current,
      answer: answerState ? answerState.answer : "",
      result: answerState ? answerState.result : null,
      error: ""
    });
  },

  async finishRound() {
    const correctRate = this.data.words.length
      ? Math.round((this.data.correctCount / this.data.words.length) * 100)
      : 0;
    this.setData({
      finished: true,
      summary: {
        correctRate,
        roundScore: this.data.correctCount * 2,
        goalText: "正在同步今日得分…"
      }
    });
    const dashboard = await syncDailyGoal();
    if (!dashboard) {
      this.setData({
        "summary.goalText": "本轮成绩已保存，返回首页可查看今日得分"
      });
      return;
    }
    const remaining = Math.max(0, dashboard.dailyScoreGoal - dashboard.todayScore);
    this.setData({
      "summary.goalText": remaining
        ? `今日已得 ${dashboard.todayScore} 分，再得 ${remaining} 分即可达标`
        : `今日已得 ${dashboard.todayScore} 分，50 分目标已完成`
    });
  },

  goHome() {
    wx.reLaunch({ url: "/pages/home/index" });
  },

  restart() {
    this.prepareRound();
  }
});
