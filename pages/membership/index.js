const { request } = require("../../utils/request");
const config = require("../../config/index");

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

Page({
  data: {
    loading: true,
    redeeming: false,
    switching: false,
    isDebug: config.envVersion === "develop",
    membership: null,
    expiryText: "",
    code: "",
    error: ""
  },

  onShow() {
    this.loadMembership();
  },

  async loadMembership() {
    this.setData({ loading: true, error: "" });
    try {
      const dashboard = await request({ url: "/me" });
      const membership = dashboard.membership || { active: false, expiresAt: null };
      this.applyMembership(membership);
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  applyMembership(membership) {
    this.setData({
      membership,
      expiryText: membership.expiresAt ? formatDate(membership.expiresAt) : ""
    });
  },

  openAssessment() {
    wx.navigateTo({ url: "/pages/initial-assessment/index" });
  },

  onCodeInput(event) {
    this.setData({ code: event.detail.value, error: "" });
  },

  async redeem() {
    if (this.data.redeeming) return;
    const code = this.data.code.trim();
    if (!code) {
      wx.showToast({ title: "请输入兑换码", icon: "none" });
      return;
    }
    this.setData({ redeeming: true, error: "" });
    try {
      const membership = await request({
        url: "/membership/redeem",
        method: "POST",
        data: { code }
      });
      this.applyMembership(membership);
      this.setData({ code: "" });
      wx.showToast({ title: "兑换成功", icon: "success" });
      setTimeout(() => {
        wx.showModal({
          title: "会员已开通",
          content: "现在完成能力测评，可以获得更匹配的学习建议。",
          confirmText: "开始测评",
          cancelText: "稍后再说",
          success: (result) => {
            if (result.confirm) this.openAssessment();
          }
        });
      }, 500);
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ redeeming: false });
    }
  },

  async switchTestMembership() {
    if (!this.data.isDebug || this.data.switching || !this.data.membership) return;
    const active = !this.data.membership.active;
    this.setData({ switching: true, error: "" });
    try {
      const membership = await request({
        url: "/membership/dev-status",
        method: "PUT",
        data: { active }
      });
      this.applyMembership(membership);
      wx.showToast({
        title: active ? "已切换为测试会员" : "已切换为普通用户",
        icon: "none"
      });
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ switching: false });
    }
  }
});
