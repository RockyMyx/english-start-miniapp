const { request } = require("../../utils/request");

function groupWords(words) {
  const groups = {};
  [...words]
    .sort((left, right) =>
      left.english.localeCompare(right.english, "en", { sensitivity: "base" })
    )
    .forEach((word) => {
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
    error: "",
    words: [],
    wordGroups: [],
    selectedCount: 0
  },

  onLoad() {
    const selection = wx.getStorageSync("englishStartDictationSelection");
    this.initialSelectedWordIds =
      selection && Array.isArray(selection.selectedWordIds)
        ? selection.selectedWordIds.map(String)
        : [];
    wx.removeStorageSync("englishStartDictationSelection");
    this.loadWords();
  },

  async loadWords() {
    this.setData({ loading: true, error: "" });
    try {
      const result = await request({ url: "/words" });
      const selectedIds = this.initialSelectedWordIds || [];
      const words = (result.words || []).map((word) => ({
        ...word,
        selected: selectedIds.includes(String(word.id))
      }));
      this.updateWords(words);
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  updateWords(words) {
    this.setData({
      words,
      wordGroups: groupWords(words),
      selectedCount: words.filter((word) => word.selected).length
    });
  },

  toggleWord(event) {
    const id = String(event.currentTarget.dataset.id);
    this.updateWords(
      this.data.words.map((word) =>
        String(word.id) === id ? { ...word, selected: !word.selected } : word
      )
    );
  },

  selectAll() {
    this.updateWords(this.data.words.map((word) => ({ ...word, selected: true })));
  },

  clearAll() {
    this.updateWords(this.data.words.map((word) => ({ ...word, selected: false })));
  },

  confirmSelection() {
    const selectedWordIds = this.data.words
      .filter((word) => word.selected)
      .map((word) => String(word.id));
    if (!selectedWordIds.length) {
      wx.showToast({ title: "请至少选择一个单词", icon: "none" });
      return;
    }
    wx.setStorageSync("englishStartDictationSelectionResult", {
      selectedWordIds
    });
    wx.navigateBack();
  }
});
