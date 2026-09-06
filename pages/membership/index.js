const { request } = require("../../utils/request");
const { getWechatCode } = require("../../utils/session");
const config = require("../../config/index");

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPrice(priceFen) {
  const value = Number(priceFen || 0) / 100;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function requestVirtualPayment(payment) {
  return new Promise((resolve, reject) => {
    if (typeof wx.requestVirtualPayment !== "function") {
      reject(new Error("当前微信版本暂不支持虚拟支付，请升级微信后重试"));
      return;
    }
    wx.requestVirtualPayment({
      signData: payment.signData,
      paySig: payment.paySig,
      signature: payment.signature,
      mode: payment.mode,
      success: resolve,
      fail(error) {
        const canceled = error && error.errCode === -2;
        const paymentError = new Error(canceled ? "已取消支付" : (error.errMsg || "支付失败，请稍后重试"));
        paymentError.canceled = canceled;
        reject(paymentError);
      }
    });
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

Page({
  data: {
    loading: true,
    paying: false,
    switching: false,
    isDebug: config.envVersion === "develop",
    membership: null,
    product: { available: false, durationDays: 365, priceFen: 9900 },
    priceText: "99",
    expiryText: "",
    error: ""
  },

  onShow() {
    this.loadMembership();
  },

  async loadMembership() {
    this.setData({ loading: true, error: "" });
    try {
      const state = await request({ url: "/membership" });
      const membership = { active: state.active, expiresAt: state.expiresAt };
      const product = state.product || { available: false, durationDays: 365, priceFen: 9900 };
      this.applyMembership(membership);
      this.setData({
        product,
        priceText: formatPrice(product.priceFen)
      });
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

  async openMembership() {
    if (this.data.paying) return;
    if (!this.data.product || !this.data.product.available) {
      wx.showToast({ title: "会员支付暂未开放", icon: "none" });
      return;
    }
    this.setData({ paying: true, error: "" });
    try {
      const order = await request({
        url: "/membership/payment/orders",
        method: "POST",
        data: { code: await getWechatCode() }
      });
      await requestVirtualPayment(order.payment);
      const membership = await this.confirmPayment(order.payment.outTradeNo);
      if (!membership || !membership.active) {
        wx.showModal({
          title: "支付已完成",
          content: "会员权益正在到账，请稍后进入会员中心刷新查看。",
          showCancel: false
        });
        return;
      }
      this.applyMembership(membership);
      wx.showToast({ title: "会员已开通", icon: "success" });
      this.showAssessmentPrompt();
    } catch (error) {
      if (!error.canceled) this.setData({ error: error.message });
    } finally {
      this.setData({ paying: false });
    }
  },

  async confirmPayment(outTradeNo) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (attempt > 0) await delay(1200);
      const result = await request({
        url: `/membership/payment/orders/${outTradeNo}/confirm`,
        method: "POST"
      });
      if (result.status === "DELIVERED") return result.membership;
      if (result.status === "CLOSED") throw new Error("支付订单未完成");
    }
    return null;
  },

  showAssessmentPrompt() {
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
