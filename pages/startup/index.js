const { service, serviceReady } = require("../../config/service");
const config = require("../../config/index");
const { loginAfterConsent } = require("../../utils/session");
const { rawRequest } = require("../../utils/http");
const { startStudyTimer } = require("../../utils/learning-progress");

const CONSENT_VERSION_KEY = "englishStartPrivacyAcceptedVersion";

Page({
  data: {
    saving: false,
    declined: false,
    error: "",
    serviceReady,
    isDebug: config.envVersion === "develop"
  },

  onLoad() {
    if (wx.getStorageSync(CONSENT_VERSION_KEY) === service.privacyVersion) {
      wx.switchTab({ url: "/pages/home/index" });
    }
  },

  openPrivacy() {
    wx.navigateTo({ url: "/pages/service-info/index?type=privacy" });
  },

  async agree() {
    if (this.data.saving) return;
    if (!this.data.isDebug && !this.data.serviceReady) {
      this.setData({ error: "运营与隐私资料尚未完善，暂不能启用个人学习功能" });
      return;
    }
    this.setData({ saving: true, error: "" });
    try {
      await loginAfterConsent("GENERAL");
      startStudyTimer();
      let needsProfile = false;
      try {
        const token = wx.getStorageSync("englishStartSessionToken");
        const result = await rawRequest({ url: "/profile", header: { Authorization: `Bearer ${token}` } });
        needsProfile = !result.data.nickname || !result.data.avatarPath;
      } catch (_error) {
        // 资料页仍可从“我的”再次进入。
      }
      wx.switchTab({
        url: "/pages/home/index",
        success: () => {
          if (needsProfile) wx.navigateTo({ url: "/pages/profile-edit/index" });
        }
      });
    } catch (error) {
      this.setData({ error: error.message || "登录失败，请重试" });
    } finally {
      this.setData({ saving: false });
    }
  },

  decline() {
    this.setData({ declined: true, error: "" });
  },

  showPrompt() {
    this.setData({ declined: false });
  }
});
