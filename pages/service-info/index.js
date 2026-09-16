const { service, serviceReady } = require("../../config/service");
const { privacySections, membershipSections } = require("../../config/service-documents");

const supportSections = [
  { title: "支付成功但会员未开通", text: "先回到会员中心刷新。仍未到账时，请联系客服，提供购买时间及微信／Apple 订单截图，并遮挡无关个人信息；我们核对支付结果与发货记录后处理。无需再次支付，也不要提供支付密码或验证码。" },
  { title: "重复扣款或支付异常", text: "请提供问题描述、购买时间与相关订单凭证，通过客服核实。请勿为重试反复付款。涉及退款时依法律及实际支付渠道规则办理，本应用不提供自助退款按钮。" },
  { title: "功能与账号问题", text: "请说明出问题的页面、操作步骤、微信版本和出现时间。可提供已遮挡个人信息的截图，不需要发送儿童原始录音或照片作为常规排查材料。" },
  { title: "隐私与数据申请", text: "可申请查阅／复制、更正、删除学习数据、撤回同意或注销账号。客服会核验与你账号的关联，并说明订单、会员及依法保留资料的处理方式。不能用清空词库代替完整数据删除。" }
];

Page({
  data: { type: "privacy", title: "隐私保护指引", sections: [], version: service.privacyVersion, service, serviceReady },
  onLoad(options) {
    const type = ["privacy", "membership", "support"].includes(options.type) ? options.type : "privacy";
    const title = { privacy: "隐私保护指引", membership: "会员服务协议", support: "联系客服与售后" }[type];
    const version = type === "membership" ? service.membershipVersion : service.privacyVersion;
    this.setData({ type, title, version, sections: { privacy: privacySections, membership: membershipSections, support: supportSections }[type] });
    wx.setNavigationBarTitle({ title });
  },
  copyEmail() {
    if (!service.contactEmail) {
      wx.showToast({ title: "联系邮箱尚未配置，请使用原生客服", icon: "none" });
      return;
    }
    wx.setClipboardData({ data: service.contactEmail });
  },
  onContactError() {
    wx.showToast({ title: "客服暂不可用，可通过联系邮箱反馈", icon: "none" });
  }
});
