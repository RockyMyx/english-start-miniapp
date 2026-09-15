const { acceptConsent, cancelConsent } = require("../../utils/privacy-consent");
const { serviceReady } = require("../../config/service");
const config = require("../../config/index");

Page({
  data: { role: "", agreed: false, read: false, saving: false, requiredGuardian: false, serviceReady, isDebug: config.envVersion === "develop", error: "" },
  onLoad(options) { this.flowId = options.flow; this.setData({ requiredGuardian: options.guardian === "1" }); },
  onUnload() { cancelConsent(this.flowId); },
  openPrivacy() {
    wx.navigateTo({ url: "/pages/service-info/index?type=privacy", success: () => this.setData({ read: true }) });
  },
  onRoleChange(event) { this.setData({ role: event.detail.value }); },
  onAgreeChange(event) { this.setData({ agreed: event.detail.value.includes("agree") }); },
  async confirm() {
    if (this.data.saving) return;
    if (!this.data.read || !this.data.agreed || !this.data.role) {
      this.setData({ error: "请先打开指引阅读，选择使用身份并明确勾选同意" });
      return;
    }
    if (this.data.requiredGuardian && this.data.role !== "GUARDIAN") return;
    if (!this.data.isDebug && !this.data.serviceReady) {
      this.setData({ error: "运营与隐私资料尚未完善，暂不能启用个人学习功能" });
      return;
    }
    this.setData({ saving: true, error: "" });
    try {
      await acceptConsent(this.data.role, this.flowId);
      wx.navigateBack();
    } catch (error) { this.setData({ error: error.message }); }
    finally { this.setData({ saving: false }); }
  },
  decline() { cancelConsent(this.flowId); wx.navigateBack(); }
});
