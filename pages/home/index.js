const { request } = require("../../utils/request");
const { syncTabBar } = require("../../utils/tab-bar");
const {
  checkDailyGoal,
  formatStudyTime,
  getDailyGoal,
  getTodayStudySeconds,
  setDailyGoal
} = require("../../utils/learning-progress");

const modules = [
  {
    key: "WORD_STUDY",
    capability: "reading",
    icon: "/assets/icons/cards.svg",
    title: "单词学习",
    subtitle: "听发音、看词义，标记认识和不熟的单词",
    tag: "先学再练",
    points: "学习模式",
    url: "/pages/word-study/index"
  },
  {
    key: "LISTEN_CHOOSE_MEANING",
    capability: "choice",
    icon: "/assets/icons/headphones.svg",
    title: "听读音选中文",
    subtitle: "听到英文发音，选择对应的中文意思",
    tag: "提升听力理解",
    points: "每题 1 分",
    url: "/pages/practice-choice/index?mode=LISTEN_CHOOSE_MEANING"
  },
  {
    key: "MEANING_CHOOSE_WORD",
    capability: "choice",
    icon: "/assets/icons/keyboard.svg",
    title: "看中文选英文",
    subtitle: "看到中文意思，选择正确的英文单词",
    tag: "逆向思维训练",
    points: "每题 1 分",
    url: "/pages/practice-choice/index?mode=MEANING_CHOOSE_WORD"
  },
  {
    key: "WORD_CHOOSE_MEANING",
    capability: "choice",
    icon: "/assets/icons/language.svg",
    title: "看英文选中文",
    subtitle: "看到英文单词，选择对应的中文意思",
    tag: "词汇积累",
    points: "每题 1 分",
    url: "/pages/practice-choice/index?mode=WORD_CHOOSE_MEANING"
  },
  {
    key: "DICTATION",
    capability: "dictation",
    icon: "/assets/icons/spellcheck.svg",
    title: "单词听写",
    subtitle: "听英文发音，独立拼写出正确单词",
    tag: "强化拼写记忆",
    points: "每题 2 分",
    url: "/pages/dictation/index"
  },
  {
    key: "WORD_PRONUNCIATION",
    capability: "pronunciation",
    icon: "/assets/icons/microphone.svg",
    title: "单词跟读",
    subtitle: "跟读标准发音，获得 Azure 发音评测",
    tag: "开口表达训练",
    points: "发音评测",
    url: "/pages/word-pronunciation/index"
  },
  {
    key: "SENTENCE",
    capability: "sentence",
    icon: "/assets/icons/pen.svg",
    title: "单词造句",
    subtitle: "根据中文情境，用英文说出完整句子",
    tag: "AI 语义与发音评测",
    points: "每题 5 分",
    url: "/pages/sentence/index"
  },
  {
    key: "DIALOGUE",
    capability: "dialogue",
    icon: "/assets/icons/comments.svg",
    title: "模拟对话",
    subtitle: "像真实聊天一样，用语音回答英文问题",
    tag: "情景对话练习",
    points: "每题 2 分",
    url: "/pages/dialogue/index"
  }
];

Page({
  data: {
    loading: true,
    importing: false,
    error: "",
    dashboard: null,
    beginnerModules: [],
    advancedModules: [],
    studyTimeText: "00:00",
    goalAchieved: false,
    checkInPopupVisible: false,
    checkInSummary: null
  },

  onShow() {
    syncTabBar(this, 0);
    this.clearStudyTimeTimer();
    this.updateStudyTime();
    this.studyTimeTimer = setInterval(() => this.updateStudyTime(), 1000);
    this.loadDashboard();
  },

  onHide() {
    this.clearStudyTimeTimer();
  },

  onUnload() {
    this.clearStudyTimeTimer();
  },

  clearStudyTimeTimer() {
    if (this.studyTimeTimer) {
      clearInterval(this.studyTimeTimer);
      this.studyTimeTimer = null;
    }
  },

  updateStudyTime() {
    this.setData({ studyTimeText: formatStudyTime(getTodayStudySeconds()) });
  },

  async loadDashboard() {
    this.setData({ loading: true, error: "" });
    try {
      const dashboard = await request({ url: "/me" });
      const dailyScoreGoal = Number(dashboard.dailyScoreGoal) || getDailyGoal();
      setDailyGoal(dailyScoreGoal);
      const displayDashboard = { ...dashboard, dailyScoreGoal };
      const decoratedModules = modules.map((item) => ({
          ...item,
          enabled: Boolean(dashboard.modules[item.capability]),
          lockText:
            item.capability === "choice"
              ? dashboard.wordCount === 0
                ? "先查看启蒙词库并导入"
                : `还差 ${Math.max(0, 4 - dashboard.wordCount)} 个词`
              : item.capability === "reading" ||
                  item.capability === "dictation" ||
                  item.capability === "pronunciation"
                ? "先查看启蒙词库并导入"
                : "导入启蒙词包后开放"
        }));
      this.setData({
        dashboard: displayDashboard,
        beginnerModules: [
          decoratedModules[0],
          decoratedModules[1],
          decoratedModules[3],
          decoratedModules[2]
        ],
        advancedModules: [
          decoratedModules[5],
          decoratedModules[4],
          decoratedModules[6],
          decoratedModules[7]
        ],
        goalAchieved: dashboard.todayScore >= dailyScoreGoal
      });
      syncTabBar(this, 0, dashboard.pendingReviewCount);
      checkDailyGoal(dashboard.todayScore, dailyScoreGoal);
      this.maybeShowDailyCheckIn();
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  localDateKey() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  },

  async maybeShowDailyCheckIn() {
    const dateKey = this.localDateKey();
    if (wx.getStorageSync("englishStartCheckInShownDate") === dateKey) return;
    try {
      const summary = await request({ url: "/check-ins/today", method: "POST" });
      wx.setStorageSync("englishStartCheckInShownDate", dateKey);
      this.setData({
        checkInSummary: summary,
        checkInPopupVisible: true,
        "dashboard.checkedInToday": true,
        "dashboard.checkInDays": summary.totalDays,
        "dashboard.currentStreak": summary.currentStreak
      });
    } catch (_error) {
      // 签到失败不打断首页学习流程，用户仍可在“我的”里重试。
    }
  },

  dismissCheckInPopup() {
    this.setData({ checkInPopupVisible: false });
  },

  openCheckInPoster() {
    this.setData({ checkInPopupVisible: false });
    wx.navigateTo({ url: "/pages/check-in/index" });
  },

  noop() {},

  editDailyGoal() {
    const currentGoal = getDailyGoal();
    wx.showModal({
      title: "设置每日达标分数",
      content: "",
      editable: true,
      placeholderText: `当前目标 ${currentGoal} 分，输入新目标`,
      confirmText: "保存",
      confirmColor: "#2563eb",
      success: async (result) => {
        if (!result.confirm) return;
        const dailyScoreGoal = Number(result.content);
        if (!result.content) return;
        if (
          !Number.isInteger(dailyScoreGoal) ||
          dailyScoreGoal < 1 ||
          dailyScoreGoal > 999
        ) {
          wx.showToast({ title: "请输入 1-999 的整数", icon: "none" });
          return;
        }
        wx.showLoading({ title: "正在保存" });
        try {
          const updated = await request({
            url: "/me/daily-goal",
            method: "PUT",
            data: { dailyScoreGoal }
          });
          setDailyGoal(updated.dailyScoreGoal);
          const dashboard = {
            ...this.data.dashboard,
            dailyScoreGoal: updated.dailyScoreGoal
          };
          this.setData({
            dashboard,
            goalAchieved: dashboard.todayScore >= updated.dailyScoreGoal
          });
          checkDailyGoal(dashboard.todayScore, updated.dailyScoreGoal);
          wx.showToast({ title: "目标已保存", icon: "success" });
        } catch (error) {
          wx.showToast({ title: error.message, icon: "none" });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  openModule(event) {
    const { url, enabled, lock } = event.currentTarget.dataset;
    if (!enabled) {
      if (this.data.dashboard && this.data.dashboard.wordCount === 0) {
        wx.navigateTo({ url: "/pages/starter-pack/index" });
        return;
      }
      wx.showToast({ title: lock, icon: "none" });
      return;
    }
    wx.navigateTo({ url });
  },

  importStarterPack() {
    wx.navigateTo({ url: "/pages/starter-pack/index" });
  }
});
