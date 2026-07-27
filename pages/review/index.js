const { request } = require("../../utils/request");
const { syncTabBar } = require("../../utils/tab-bar");

const categoryLabels = {
  WORD: "单词",
  SENTENCE: "句子",
  DIALOGUE: "对话"
};

Page({
  data: {
    loading: true,
    error: "",
    overview: null,
    dashboard: null,
    category: "WORD",
    status: "PENDING",
    categoryTabs: [],
    visibleItems: []
  },

  onShow() {
    syncTabBar(this, 1);
    this.loadReview();
  },

  async loadReview() {
    this.setData({ loading: true, error: "" });
    try {
      const [overview, dashboard] = await Promise.all([
        request({ url: "/review" }),
        request({ url: "/me" })
      ]);
      const categoryTabs = (overview.categories || []).map((item) => ({
        ...item,
        label: categoryLabels[item.type]
      }));
      this.setData({ overview, dashboard, categoryTabs }, () => this.refreshVisibleItems());
      syncTabBar(this, 1, overview.pendingCount);
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  selectCategory(event) {
    this.setData({ category: event.currentTarget.dataset.type }, () =>
      this.refreshVisibleItems()
    );
  },

  selectStatus(event) {
    this.setData({ status: event.currentTarget.dataset.status }, () =>
      this.refreshVisibleItems()
    );
  },

  refreshVisibleItems() {
    const overview = this.data.overview;
    const visibleItems = overview
      ? overview.items.filter(
          (item) => item.type === this.data.category && item.status === this.data.status
        )
      : [];
    this.setData({ visibleItems });
  },

  startSmartReview() {
    const pending = this.data.overview && this.data.overview.pendingCount;
    if (!pending) {
      wx.showToast({ title: "暂无待复习内容", icon: "none" });
      return;
    }
    const firstCategory = ["WORD", "SENTENCE", "DIALOGUE"].find((type) =>
      this.data.overview.items.some((item) => item.type === type && item.status === "PENDING")
    );
    this.openCategory(firstCategory);
  },

  practiceCategory(event) {
    this.openCategory(event.currentTarget.dataset.type || this.data.category);
  },

  openCategory(type) {
    if (type === "SENTENCE") {
      wx.navigateTo({ url: "/pages/sentence/index?scope=weak" });
      return;
    }
    if (type === "DIALOGUE") {
      wx.navigateTo({ url: "/pages/dialogue/index?scope=weak" });
      return;
    }
    if (!this.data.dashboard || this.data.dashboard.wordCount < 4) {
      wx.navigateTo({ url: "/pages/word-study/index?scope=weak" });
      return;
    }
    wx.navigateTo({
      url: "/pages/practice-choice/index?mode=WORD_CHOOSE_MEANING&scope=weak"
    });
  },

  async toggleMastered(event) {
    const { type, key, status } = event.currentTarget.dataset;
    const nextStatus = status === "MASTERED" ? "PENDING" : "MASTERED";
    try {
      await request({
        url: "/review/status",
        method: "PUT",
        data: { itemType: type, itemKey: key, status: nextStatus }
      });
      wx.showToast({
        title: nextStatus === "MASTERED" ? "已标记掌握" : "已移回待复习",
        icon: "none"
      });
      this.loadReview();
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    }
  }
});
