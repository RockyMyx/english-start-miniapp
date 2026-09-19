const { request } = require("../../utils/request");
const { playSpeech, stopSpeech } = require("../../utils/speech");

function shuffled(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

Page({
  data: {
    loading: true,
    saving: false,
    speaking: false,
    speakingExample: false,
    error: "",
    words: [],
    index: 0,
    current: null,
    revealed: false,
    finished: false,
    knownCount: 0,
    learningCount: 0,
    scope: "all",
    dailyPlanId: "",
    dailyTaskKey: ""
  },

  onLoad(options) {
    this.setData({
      scope: options && options.scope === "weak" ? "weak" : "all",
      dailyPlanId: (options && options.dailyPlanId) || "",
      dailyTaskKey: (options && options.dailyTaskKey) || ""
    });
    this.loadWords();
  },

  onUnload() {
    stopSpeech();
  },

  async loadWords() {
    this.setData({ loading: true, error: "" });
    try {
      const wordsUrl = this.data.dailyPlanId
        ? `/daily-plans/${this.data.dailyPlanId}/tasks/${this.data.dailyTaskKey}/words`
        : "/words";
      const [result, review, examplesResult] = await Promise.all([
        request({ url: wordsUrl }),
        this.data.scope === "weak" ? request({ url: "/review" }) : Promise.resolve(null),
        request({ url: "/words/examples" }).catch((error) => {
          if (error.statusCode === 404) return { examples: [] };
          throw error;
        })
      ]);
      const examplesByWordId = new Map(
        (examplesResult.examples || []).map((example) => [example.wordId, example])
      );
      const pendingIds = review
        ? new Set(
            review.items
              .filter((item) => item.type === "WORD" && item.status === "PENDING")
              .map((item) => item.vocabularyItemId)
          )
        : null;
      const sourceWords = (result.words || []).filter(
        (word) => !pendingIds || pendingIds.has(word.id)
      );
      const words = (this.data.dailyPlanId ? sourceWords : shuffled(sourceWords))
        .sort((left, right) => (right.incorrectCount || 0) - (left.incorrectCount || 0))
        .slice(0, 10)
        .map((word) => ({
          ...word,
          learningResult: "",
          example: examplesByWordId.get(word.id) || null
        }));
      this.setData({
        words,
        index: 0,
        current: words[0] || null,
        revealed: false,
        finished: false,
        knownCount: 0,
        learningCount: 0
      });
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  reveal() {
    this.setData({ revealed: true });
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

  async playExample() {
    const example = this.data.current && this.data.current.example;
    if (!example || this.data.speakingExample || this.data.speaking) return;
    this.setData({ speakingExample: true, error: "" });
    try {
      await playSpeech(example.english, "sentence");
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ speakingExample: false });
    }
  },

  async markWord(event) {
    if (this.data.saving || this.data.current.learningResult) return;
    const result = event.currentTarget.dataset.result;
    this.setData({ saving: true, error: "" });
    try {
      await request({
        url: `/words/${this.data.current.id}/reading`,
        method: "POST",
        data: {
          result,
          dailyPlanId: this.data.dailyPlanId || undefined,
          dailyTaskKey: this.data.dailyTaskKey || undefined
        }
      });
      const current = { ...this.data.current, learningResult: result };
      const words = [...this.data.words];
      words[this.data.index] = current;
      this.setData({
        words,
        current,
        revealed: true,
        knownCount: this.data.knownCount + (result === "CORRECT" ? 1 : 0),
        learningCount: this.data.learningCount + (result === "INCORRECT" ? 1 : 0)
      });
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ saving: false });
    }
  },

  previous() {
    if (this.data.index === 0 || this.data.saving) return;
    this.showWord(this.data.index - 1);
  },

  next() {
    if (!this.data.current.learningResult || this.data.saving) return;
    const nextIndex = this.data.index + 1;
    if (nextIndex >= this.data.words.length) {
      this.setData({ finished: true });
      return;
    }
    this.showWord(nextIndex);
  },

  showWord(index) {
    stopSpeech();
    const current = this.data.words[index];
    this.setData({
      index,
      current,
      revealed: Boolean(current.learningResult),
      speaking: false,
      speakingExample: false,
      error: ""
    });
  },

  onShareAppMessage() {
    return { title: "一起来单词练练，轻松学英语", path: "/pages/home/index" };
  },

  goHome() {
    if (this.data.dailyPlanId) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: "/pages/home/index" });
  },

  restart() {
    this.loadWords();
  }
});
