const { request } = require("../../utils/request");
const {
  centeredText,
  exportCanvas,
  fillRoundedRect,
  leftText,
  posterSize,
  savePoster
} = require("../../utils/poster");

const mottos = [
  "每天进步一点点，英语自然会发光。",
  "今天学会的每一个词，都在靠近更大的世界。",
  "坚持不是重复昨天，而是在积累明天。",
  "开口说英语，就是今天最棒的一步。",
  "认真学过的每一天，都会留下成长的痕迹。",
  "不用走得很快，只要每天都向前一步。",
  "把简单的事情坚持做，进步自然会发生。",
  "今天的练习，正在成为明天的自信。"
];

function displayDate(dateKey) {
  const parts = dateKey.split("-");
  return `${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日`;
}

function dailyMotto(dateKey) {
  const storageKey = "englishStartDailyMotto";
  const stored = wx.getStorageSync(storageKey);
  if (
    stored &&
    stored.dateKey === dateKey &&
    mottos.includes(stored.motto)
  ) {
    return stored.motto;
  }

  const candidates = mottos.filter((motto) => !stored || motto !== stored.motto);
  const motto = candidates[Math.floor(Math.random() * candidates.length)];
  wx.setStorageSync(storageKey, { dateKey, motto });
  return motto;
}

Page({
  data: {
    loading: true,
    saving: false,
    error: "",
    summary: null,
    displayDate: "",
    motto: "",
    posterWidth: 330,
    posterHeight: 396,
    posterPath: ""
  },

  onLoad() {
    const size = posterSize(1.2);
    this.setData({ posterWidth: size.width, posterHeight: size.height });
    wx.showShareMenu({
      menus: ["shareAppMessage", "shareTimeline"]
    });
    this.loadCheckIn();
  },

  async loadCheckIn() {
    this.setData({ loading: true, error: "" });
    try {
      const summary = await request({ url: "/check-ins/today", method: "POST" });
      const motto = dailyMotto(summary.dateKey);
      this.setData(
        {
          summary,
          displayDate: displayDate(summary.dateKey),
          motto
        },
        () => wx.nextTick(() => this.drawPoster())
      );
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  async drawPoster() {
    const { posterWidth: width, posterHeight: height, summary, motto } = this.data;
    if (!summary) return;
    const context = wx.createCanvasContext("checkInPoster", this);
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#1d4ed8");
    gradient.addColorStop(0.55, "#2563eb");
    gradient.addColorStop(1, "#0ea5e9");
    context.setFillStyle(gradient);
    context.fillRect(0, 0, width, height);

    context.setFillStyle("rgba(255,255,255,0.10)");
    context.beginPath();
    context.arc(width - 34, 38, 88, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(24, height - 36, 66, 0, Math.PI * 2);
    context.fill();

    centeredText(context, "今日签到", width / 2, 62, 26, "#ffffff", true);
    centeredText(context, this.data.displayDate, width / 2, 92, 13, "rgba(255,255,255,0.78)");

    fillRoundedRect(context, 28, 138, width - 56, 126, 24, "#ffffff");
    centeredText(context, `连续 ${summary.currentStreak} 天`, width / 2, 181, 34, "#1d4ed8", true);
    centeredText(context, `累计签到 ${summary.totalDays} 天`, width / 2, 226, 14, "#64748b");

    centeredText(context, `“${motto}”`, width / 2, 306, 13, "#ffffff", true);

    fillRoundedRect(context, 20, height - 52, width - 40, 34, 17, "rgba(3, 24, 67, 0.25)");
    centeredText(
      context,
      "微信小程序搜索【单词练练】，一起来学习吧",
      width / 2,
      height - 35,
      9,
      "#ffffff",
      true
    );

    context.draw(false, async () => {
      try {
        const posterPath = await exportCanvas(this, "checkInPoster", width, height);
        this.setData({ posterPath });
      } catch (error) {
        this.setData({ error: error.message });
      }
    });
  },

  async saveForMoments() {
    if (!this.data.posterPath || this.data.saving) return;
    this.setData({ saving: true });
    try {
      await savePoster(this.data.posterPath);
      wx.showModal({
        title: "海报已保存",
        content: "现在可以打开朋友圈，从相册选择这张签到海报。",
        showCancel: false,
        confirmText: "知道了",
        confirmColor: "#2563eb"
      });
    } catch (_error) {
      // 权限提示由保存工具统一处理。
    } finally {
      this.setData({ saving: false });
    }
  },

  goHome() {
    wx.switchTab({ url: "/pages/home/index" });
  },

  onShareAppMessage() {
    return {
      title: `我已连续学习英语 ${this.data.summary ? this.data.summary.currentStreak : 1} 天`,
      path: "/pages/home/index",
      imageUrl: this.data.posterPath || undefined
    };
  },

  onShareTimeline() {
    return {
      title: `今天也完成英语签到，坚持让进步看得见`,
      query: "",
      imageUrl: this.data.posterPath || undefined
    };
  }
});
