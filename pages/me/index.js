const { request } = require("../../utils/request");
const { getAvatarUrl } = require("../../utils/avatar");
const {
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
    hasProfile: false,
    membershipExpiryText: "",
    assessmentNote: "正在读取测评状态…"
  },

  onShow() {
    syncTabBar(this, 2);
    this.loadPage();
  },

  async loadPage() {
    this.setData({ loading: true, error: "" });
    try {
      const [profile, dashboard, onboarding] = await Promise.all([
        request({ url: "/profile" }),
        request({ url: "/me" }),
        request({ url: "/onboarding" })
      ]);
      const dailyScoreGoal = Number(dashboard.dailyScoreGoal) || getDailyGoal();
      const weeklyGoalDays = Number(dashboard.weeklyGoalDays) || 5;
      const weekCompletedDays = Number(dashboard.weekCompletedDays) || 0;
      const membership = dashboard.membership || { active: false, expiresAt: null };
      const avatarUrl = await getAvatarUrl(profile.avatarPath);
      setDailyGoal(dailyScoreGoal);
      this.setData({
        profile,
        dashboard: {
          ...dashboard,
          dailyScoreGoal,
          weeklyGoalDays,
          weekCompletedDays,
          membership
        },
        nickname: profile.nickname || "",
        avatarUrl,
        hasProfile: Boolean(profile.nickname || profile.avatarPath),
        membershipExpiryText: membership.expiresAt
          ? this.formatDate(membership.expiresAt)
          : "",
        assessmentNote: this.assessmentNote(membership, onboarding)
      });
      syncTabBar(this, 2, dashboard.pendingReviewCount);
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },

  assessmentNote(membership, onboarding) {
    if (!membership.active) return "会员专享 · 开通后开始测评";
    const assessment = onboarding && onboarding.assessment;
    if (!assessment) return "尚未测评 · 点击开始";
    if (assessment.status === "COMPLETED") {
      const count = Number(onboarding.assessmentCount) || 1;
      return `${assessment.level || "测评已完成"} · 已完成 ${count} 次，可查看或再测`;
    }
    const answeredCount = (assessment.answers || []).length;
    const questionCount = Number(onboarding.questionCount) || 0;
    return `已完成 ${answeredCount}/${questionCount} 题 · 继续测评`;
  },

  openProfileEditor() {
    wx.navigateTo({ url: "/pages/profile-edit/index" });
  },

  openPage(event) {
    wx.navigateTo({ url: event.currentTarget.dataset.url });
  }
});
