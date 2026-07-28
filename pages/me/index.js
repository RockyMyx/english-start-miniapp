const { apiBaseUrl } = require("../../config/index");
const { request } = require("../../utils/request");
const {
  checkDailyGoal,
  getDailyGoal,
  setDailyGoal
} = require("../../utils/learning-progress");
const { syncTabBar } = require("../../utils/tab-bar");

Page({
  data: {
    loading: true,
    error: "",
    profile: null,
    dashboard: null,
    nickname: "",
    avatarUrl: "",
    hasProfile: false
  },

  onShow() {
    syncTabBar(this, 2);
    this.loadPage();
  },

  async loadPage() {
    this.setData({ loading: true, error: "" });
    try {
      const [profile, dashboard] = await Promise.all([
        request({ url: "/profile" }),
        request({ url: "/me" })
      ]);
      const dailyScoreGoal = Number(dashboard.dailyScoreGoal) || getDailyGoal();
      setDailyGoal(dailyScoreGoal);
      this.setData({
        profile,
        dashboard: { ...dashboard, dailyScoreGoal },
        nickname: profile.nickname || "",
        avatarUrl: profile.avatarPath
          ? `${apiBaseUrl}${profile.avatarPath}?v=${Date.now()}`
          : "",
        hasProfile: Boolean(profile.nickname || profile.avatarPath)
      });
      syncTabBar(this, 2, dashboard.pendingReviewCount);
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  openProfileEditor() {
    wx.navigateTo({ url: "/pages/profile-edit/index" });
  },

  editDailyGoal() {
    const currentGoal = this.data.dashboard
      ? this.data.dashboard.dailyScoreGoal
      : getDailyGoal();
    wx.showModal({
      title: "设置每日达标分数",
      content: "",
      editable: true,
      placeholderText: `当前 ${currentGoal} 分，请输入新目标`,
      confirmText: "保存",
      confirmColor: "#2563eb",
      success: async (result) => {
        if (!result.confirm || !result.content) return;
        const dailyScoreGoal = Number(result.content);
        if (!Number.isInteger(dailyScoreGoal) || dailyScoreGoal < 1 || dailyScoreGoal > 999) {
          wx.showToast({ title: "请输入 1-999 的整数", icon: "none" });
          return;
        }
        try {
          const updated = await request({
            url: "/me/daily-goal",
            method: "PUT",
            data: { dailyScoreGoal }
          });
          setDailyGoal(updated.dailyScoreGoal);
          this.setData({ "dashboard.dailyScoreGoal": updated.dailyScoreGoal });
          checkDailyGoal(this.data.dashboard.todayScore, updated.dailyScoreGoal);
          wx.showToast({ title: "目标已保存", icon: "success" });
        } catch (error) {
          wx.showToast({ title: error.message, icon: "none" });
        }
      }
    });
  },

  openPage(event) {
    wx.navigateTo({ url: event.currentTarget.dataset.url });
  }
});
