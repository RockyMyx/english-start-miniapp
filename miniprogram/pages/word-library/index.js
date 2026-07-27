const { request } = require("../../utils/request");

function groupWords(words) {
  const sortedWords = [...words].sort((left, right) =>
    left.english.localeCompare(right.english, "en", { sensitivity: "base" })
  );
  const groups = {};

  sortedWords.forEach((word) => {
    const firstCharacter = word.english.trim().charAt(0).toUpperCase();
    const letter = /^[A-Z]$/.test(firstCharacter) ? firstCharacter : "#";
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(word);
  });

  return Object.keys(groups)
    .sort((left, right) => {
      if (left === "#") return 1;
      if (right === "#") return -1;
      return left.localeCompare(right);
    })
    .map((letter) => ({ letter, words: groups[letter] }));
}

Page({
  data: {
    loading: true,
    saving: false,
    clearing: false,
    words: [],
    wordGroups: [],
    english: "",
    chinese: "",
    error: ""
  },

  onShow() {
    this.loadWords();
  },

  async loadWords() {
    this.setData({ loading: true, error: "" });
    try {
      const result = await request({ url: "/words" });
      const words = result.words || [];
      this.setData({ words, wordGroups: groupWords(words) });
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  onInput(event) {
    this.setData({ [event.currentTarget.dataset.field]: event.detail.value });
  },

  async addWord() {
    if (this.data.saving) return;
    this.setData({ saving: true, error: "" });
    try {
      await request({
        url: "/words",
        method: "POST",
        data: {
          english: this.data.english,
          chinese: this.data.chinese
        }
      });
      this.setData({ english: "", chinese: "" });
      await this.loadWords();
      wx.showToast({ title: "已加入词库", icon: "success" });
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ saving: false });
    }
  },

  importStarterPack() {
    wx.navigateTo({ url: "/pages/starter-pack/index" });
  },

  removeWord(event) {
    const { id, english } = event.currentTarget.dataset;
    wx.showModal({
      title: `移除 ${english}`,
      content: "移除后不再出题，但历史练习记录会保留。",
      success: async (result) => {
        if (!result.confirm) return;
        try {
          await request({ url: `/words/${id}`, method: "DELETE" });
          await this.loadWords();
        } catch (error) {
          this.setData({ error: error.message });
        }
      }
    });
  },

  clearWords() {
    if (this.data.clearing || !this.data.words.length) return;
    const wordCount = this.data.words.length;
    wx.showModal({
      title: `确认清空 ${wordCount} 个词汇？`,
      content: "清空后所有练习将暂时关闭，且无法撤销；历史练习记录会保留。",
      confirmText: "确认清空",
      confirmColor: "#d4515f",
      cancelText: "取消",
      success: async (result) => {
        if (!result.confirm) return;
        this.setData({ clearing: true, error: "" });
        try {
          const clearResult = await request({ url: "/words", method: "DELETE" });
          this.setData({ words: [], wordGroups: [] });
          wx.showToast({
            title: `已清空 ${clearResult.removed || wordCount} 个词`,
            icon: "none"
          });
        } catch (error) {
          this.setData({ error: error.message });
        } finally {
          this.setData({ clearing: false });
        }
      }
    });
  }
});
