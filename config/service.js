// 公开的服务信息，不得放入密钥。空项须按实际运营情况补齐后再提审。
const service = {
  operatorName: "马宇翔",
  contactEmail: "46821618@qq.com",
  serviceHours: "每天 09:00–21:00",
  responseTime: "一般当天会回复",
  privacyVersion: "2026-09-18",
  membershipVersion: "2026-09-16",
  draftUpdatedDate: "2026-09-18",
  effectiveDate: "2026-09-18",
  thirdPartyDetails:
    "微信：用于微信登录、客服与支付；微软 Azure：用于语音转写、发音评分和语音合成；智谱：用于拍照识词和学习答案的语义判断；有道：用于单词朗读。仅在用户主动使用对应功能时处理必要信息。",
  retentionDetails:
    "账号资料、头像、词库、练习和测评结果在账号存续期间保存，用于持续提供学习服务。订单和支付资料按法律法规要求的期限保存。用户可在微信中清理小程序本机缓存；服务器日志和备份在实现目的所需的必要期限后清理。"
};

const requiredFields = ["operatorName", "contactEmail", "serviceHours", "responseTime", "thirdPartyDetails", "retentionDetails"];
const missingFields = requiredFields.filter((field) => !service[field].trim());
const serviceReady = missingFields.length === 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(service.contactEmail);

module.exports = { service, serviceReady, missingFields };
