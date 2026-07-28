const { request } = require("../../utils/request");

const taskRoutes = {
  WORD_READING: "/pages/word-study/index",
  WORD_CHOOSE_MEANING:
    "/pages/practice-choice/index?mode=WORD_CHOOSE_MEANING",
  DICTATION: "/pages/dictation/index"
};

Page({
  data: {
    loading: true,
    checkingIn: false,
    error: "",
    plan: null,
    progressPercent: 0,
    checkInSummary: null
  },

  onShow() {
    this.loadPlan();
  },

  async loadPlan() {
    this.setData({ loading: true, error: "" });
    try {
      let plan = await request({ url: "/daily-plans/today" });
      let checkInSummary = this.data.checkInSummary;
      if (
        !checkInSummary &&
        (plan.checkedInToday || plan.completedCount >= 3) &&
        !this.data.checkingIn
      ) {
        this.setData({ checkingIn: true });
        try {
          checkInSummary = await request({
            url: "/check-ins/today",
            method: "POST"
          });
          plan = { ...plan, checkedInToday: true };
        } catch (error) {
          if (error.code !== "LEARNING_REQUIRED") throw error;
        } finally {
          this.setData({ checkingIn: false });
        }
      }
      this.setData({
        plan,
        checkInSummary,
        progressPercent: plan.totalCount
          ? Math.round((plan.completedCount / plan.totalCount) * 100)
          : 0
      });
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  openTask(taskKey) {
    const plan = this.data.plan;
    const task = plan && plan.tasks.find((item) => item.key === taskKey);
    if (!task) return;
    const baseRoute = taskRoutes[task.mode];
    if (!plan || !baseRoute || task.completed) return;
    const separator = baseRoute.includes("?") ? "&" : "?";
    wx.navigateTo({
      url:
        `${baseRoute}${separator}dailyPlanId=${encodeURIComponent(plan.id)}` +
        `&dailyTaskKey=${encodeURIComponent(task.key)}`
    });
  },

  startTask(event) {
    this.openTask(event.currentTarget.dataset.key);
  },

  startNext() {
    const task =
      this.data.plan &&
      this.data.plan.tasks.find((item) => !item.completed);
    if (!task) return;
    this.openTask(task.key);
  },

  openCheckInPoster() {
    wx.navigateTo({ url: "/pages/check-in/index" });
  },

  openStarterPack() {
    wx.navigateTo({ url: "/pages/starter-pack/index" });
  }
});
