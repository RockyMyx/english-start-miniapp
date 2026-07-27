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
    error: "",
    words: [],
    index: 0,
    current: null,
    revealed: false,
    finished: false,
    knownCount: 0,
    learningCount: 0,
    scope: "all"
  },

  onLoad(options) {
    this.setData({ scope: options && options.scope === "weak" ? "weak" : "all" });
    this.loadWords();
  },

  onUnload() {
    stopSpeech();
  },

  async loadWords() {
    this.setData({ loading: true, error: "" });
    try {
      const [result, review] = await Promise.all([
        request({ url: "/words" }),
        this.data.scope === "weak" ? request({ url: "/review" }) : Promise.resolve(null)
      ]);
      const pendingIds = review
        ? new Set(
            review.items
              .filter((item) => item.type === "WORD" && item.status === "PENDING")
              .map((item) => item.vocabularyItemId)
          )
        : null;
      const words = shuffled(
        (result.words || []).filter((word) => !pendingIds || pendingIds.has(word.id))
      )
        .sort((left, right) => (right.incorrectCount || 0) - (left.incorrectCount || 0))
        .slice(0, 10)
        .map((word) => ({ ...word, learningResult: "" }));
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

  async markWord(event) {
    if (this.data.saving || this.data.current.learningResult) return;
    const result = event.currentTarget.dataset.result;
    this.setData({ saving: true, error: "" });
    try {
      await request({
        url: `/words/${this.data.current.id}/reading`,
        method: "POST",
        data: { result }
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
    const current = this.data.words[index];
    this.setData({
      index,
      current,
      revealed: Boolean(current.learningResult),
      error: ""
    });
  },

  goHome() {
    wx.switchTab({ url: "/pages/home/index" });
  },

  restart() {
    this.loadWords();
  }
});
