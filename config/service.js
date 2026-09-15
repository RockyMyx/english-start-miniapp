// 公开的服务信息，不得放入密钥。空项须按实际运营情况补齐后再提审。
const service = {
  operatorName: "",
  contactEmail: "",
  serviceHours: "",
  responseTime: "",
  privacyVersion: "2026-09-15",
  effectiveDate: "2026-09-15",
  thirdPartyDetails: "",
  retentionDetails: ""
};

const requiredFields = ["operatorName", "contactEmail", "serviceHours", "responseTime", "thirdPartyDetails", "retentionDetails"];
const missingFields = requiredFields.filter((field) => !service[field].trim());
const serviceReady = missingFields.length === 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(service.contactEmail);

module.exports = { service, serviceReady, missingFields };
