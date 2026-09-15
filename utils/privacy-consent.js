const { rawRequest } = require("./http");
const { service } = require("../config/service");

let cachedConsent = null;
let pending = null;
let waiting = null;
let nextFlowId = 0;

async function fetchConsent(token, method = "GET", data) {
  const result = await rawRequest({ url: "/privacy/consent", method, data, header: { Authorization: `Bearer ${token}` } });
  return result.data;
}

async function ensureLearnerConsent(token, requiredGuardian = false) {
  if (cachedConsent && cachedConsent.token === token && (!requiredGuardian || cachedConsent.role === "GUARDIAN")) return;
  if (pending) {
    await pending;
    return ensureLearnerConsent(token, requiredGuardian);
  }
  pending = (async () => {
    const consent = await fetchConsent(token);
    if (consent.accepted && (!requiredGuardian || consent.role === "GUARDIAN")) {
      cachedConsent = { token, role: consent.role };
      return;
    }
    await new Promise((resolve, reject) => {
      const flowId = String(++nextFlowId);
      waiting = { token, flowId, resolve, reject };
      wx.navigateTo({
        url: `/pages/privacy-consent/index?guardian=${requiredGuardian ? "1" : "0"}&flow=${flowId}`,
        fail() { cancelConsent(flowId); }
      });
    });
  })();
  try { await pending; } finally { pending = null; }
}

async function acceptConsent(role, flowId) {
  if (!waiting || waiting.flowId !== flowId) throw new Error("同意流程已结束，请返回后重试");
  const current = waiting;
  await fetchConsent(current.token, "POST", { policyVersion: service.privacyVersion, role, accepted: true });
  if (waiting !== current) throw new Error("同意已保存，请返回原页面重新进入");
  cachedConsent = { token: current.token, role };
  waiting = null;
  current.resolve();
}

function cancelConsent(flowId) {
  if (!waiting || waiting.flowId !== flowId) return;
  const current = waiting;
  waiting = null;
  current.reject(new Error("尚未同意学习信息处理指引，可返回阅读或联系售后"));
}

function invalidateConsent() { cachedConsent = null; }

module.exports = { ensureLearnerConsent, acceptConsent, cancelConsent, invalidateConsent };
