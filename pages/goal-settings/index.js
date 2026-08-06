const { request } = require("../../utils/request");
const { getDailyGoal, setDailyGoal } = require("../../utils/learning-progress");

Page({
  data: {
    loading: true,
    saving: false,
    error: "",
    dailyScoreGoal: "",
    weeklyGoalDays: 5,
    weekOptions: [1, 2, 3, 4, 5, 6, 7]
  },

  onLoad() {
    this.loadGoals();
  },

  async loadGoals() {
    this.setData({ loading: true, error: "" });
    try {
      const dashboard = await request({ url: "/me" });
      this.setData({
        dailyScoreGoal: String(Number(dashboard.dailyScoreGoal) || getDailyGoal()),
        weeklyGoalDays: Number(dashboard.weeklyGoalDays) || 5
      });
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  onDailyGoalInput(event) {
    const dailyScoreGoal = String(event.detail.value || "")
      .replace(/\D/g, "")
      .slice(0, 3);
    this.setData({ dailyScoreGoal });
  },

  selectWeeklyGoal(event) {
    this.setData({ weeklyGoalDays: Number(event.currentTarget.dataset.days) });
  },

  async saveGoals() {
    if (this.data.saving) return;
    const dailyScoreGoal = Number(this.data.dailyScoreGoal);
    const weeklyGoalDays = Number(this.data.weeklyGoalDays);
    if (!Number.isInteger(dailyScoreGoal) || dailyScoreGoal < 1 || dailyScoreGoal > 999) {
      wx.showToast({ title: "每日分数请输入 1-999", icon: "none" });
      return;
    }
    if (!Number.isInteger(weeklyGoalDays) || weeklyGoalDays < 1 || weeklyGoalDays > 7) {
      wx.showToast({ title: "请选择每周目标天数", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    try {
      const goals = await request({
        url: "/me/goals",
        method: "PUT",
        data: { dailyScoreGoal, weeklyGoalDays }
      });
      setDailyGoal(goals.dailyScoreGoal);
      wx.showToast({ title: "目标已保存", icon: "success" });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (error) {
      wx.showToast({ title: error.message, icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  }
});
