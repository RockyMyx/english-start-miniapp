const { request } = require("../../utils/request");
const {
  centeredText,
  exportCanvas,
  fillRoundedRect,
  posterSize,
  savePoster
} = require("../../utils/poster");

const modeLabels = {
  WORD_READING: "单词学习与跟读",
  WORD_PRONUNCIATION: "单词发音",
  LISTEN_CHOOSE_MEANING: "听读音选中文",
  MEANING_CHOOSE_WORD: "看中文选英文",
  WORD_CHOOSE_MEANING: "看英文选中文",
  DICTATION: "单词听写",
  SENTENCE: "单词造句",
  DIALOGUE_TEXT: "模拟对话",
  DIALOGUE_VOICE: "模拟对话"
};

function shortDate(dateKey) {
  const parts = dateKey.split("-");
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

Page({
  data: {
    loading: true,
    saving: false,
    error: "",
    report: null,
    recentDays: [],
    modeStats: [],
    posterWidth: 330,
    posterHeight: 376,
    posterPath: ""
  },

  onLoad() {
    const size = posterSize(1.14);
    this.setData({ posterWidth: size.width, posterHeight: size.height });
    wx.showShareMenu({
      menus: ["shareAppMessage", "shareTimeline"]
    });
    this.loadReport();
  },

  async loadReport() {
    this.setData({ loading: true, error: "" });
    try {
      const report = await request({ url: "/reports/learning" });
      const maxScore = Math.max(1, ...(report.recentDays || []).map((item) => item.score));
      const recentDays = (report.recentDays || []).map((item) => ({
        ...item,
        label: shortDate(item.dateKey),
        barHeight: Math.max(8, Math.round((item.score / maxScore) * 108))
      }));
      const modeStats = (report.modeStats || []).map((item) => ({
        ...item,
        label: modeLabels[item.mode] || item.mode,
        accuracy: item.attempts ? Math.round((item.correct / item.attempts) * 100) : 0
      }));
      this.setData(
        { report, recentDays, modeStats },
        () => wx.nextTick(() => this.drawPoster())
      );
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  async drawPoster() {
    const { posterWidth: width, posterHeight: height, report } = this.data;
    if (!report) return;
    const context = wx.createCanvasContext("reportPoster", this);
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(0.55, "#1e3a8a");
    gradient.addColorStop(1, "#2563eb");
    context.setFillStyle(gradient);
    context.fillRect(0, 0, width, height);

    context.setFillStyle("rgba(96,165,250,0.20)");
    context.beginPath();
    context.arc(width - 20, 38, 90, 0, Math.PI * 2);
    context.fill();

    centeredText(context, "学习报告", width / 2, 48, 26, "#ffffff", true);
    centeredText(context, report.generatedDate, width / 2, 78, 12, "rgba(255,255,255,0.68)");

    fillRoundedRect(context, 24, 104, width - 48, 138, 22, "#ffffff");
    const metrics = [
      [report.totalCheckInDays, "签到天数"],
      [report.totalScore, "累计得分"],
      [`${report.accuracy}%`, "练习正确率"]
    ];
    metrics.forEach((metric, index) => {
      const x = 24 + ((index + 0.5) * (width - 48)) / 3;
      centeredText(context, metric[0], x, 150, 25, "#1d4ed8", true);
      centeredText(context, metric[1], x, 182, 10, "#64748b");
    });
    centeredText(
      context,
      `已学习 ${report.learningWordCount} 个词 · 掌握 ${report.masteredWordCount} 个词`,
      width / 2,
      220,
      11,
      "#475569",
      true
    );

    fillRoundedRect(context, 30, 268, width - 60, 58, 18, "rgba(255,255,255,0.12)");
    centeredText(
      context,
      "每一次练习，都让进步有迹可循",
      width / 2,
      297,
      13,
      "#ffffff",
      true
    );
    centeredText(
      context,
      "微信小程序搜索【单词练练】，一起来学习吧",
      width / 2,
      height - 24,
      9,
      "rgba(255,255,255,0.7)"
    );

    context.draw(false, async () => {
      try {
        const posterPath = await exportCanvas(this, "reportPoster", width, height);
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
        title: "学习报告已保存",
        content: "可以从相册选择这张成长报告，分享你的学习成果。",
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

  startReview() {
    wx.switchTab({ url: "/pages/review/index" });
  },

  onShareAppMessage() {
    return {
      title: "学习报告",
      path: "/pages/home/index",
      imageUrl: this.data.posterPath || undefined
    };
  },

  onShareTimeline() {
    return {
      title: "学习报告",
      query: "",
      imageUrl: this.data.posterPath || undefined
    };
  }
});
