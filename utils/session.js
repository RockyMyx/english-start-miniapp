const config = require("../config/index");
const { service } = require("../config/service");
const { rawRequest } = require("./http");

const TOKEN_KEY = "englishStartSessionToken";
const DEV_OPEN_ID_KEY = "englishStartDevOpenId";
const CONSENT_VERSION_KEY = "englishStartPrivacyAcceptedVersion";
let loginPromise = null;
let redirectingToConsent = false;

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || "";
}

function clearSession() {
  wx.removeStorageSync(TOKEN_KEY);
}

function getDevOpenId() {
  let openId = wx.getStorageSync(DEV_OPEN_ID_KEY);
  if (!openId) {
    openId = `local-user-${Date.now()}`;
    wx.setStorageSync(DEV_OPEN_ID_KEY, openId);
  }
  return openId;
}

function getWechatCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(result) {
        if (result.code) resolve(result.code);
        else reject(new Error("微信登录没有返回有效 code"));
      },
      fail: reject
    });
  });
}

async function login() {
  const response = config.useDevLogin
    ? await rawRequest({
        url: "/auth/dev-login",
        method: "POST",
        data: { openId: getDevOpenId() }
      })
    : await rawRequest({
        url: "/auth/wechat",
        method: "POST",
        data: { code: await getWechatCode() }
      });

  wx.setStorageSync(TOKEN_KEY, response.data.token);
  return response.data.token;
}

async function ensureSession() {
  if (wx.getStorageSync(CONSENT_VERSION_KEY) !== service.privacyVersion) {
    if (!redirectingToConsent) {
      redirectingToConsent = true;
      wx.reLaunch({
        url: "/pages/startup/index",
        fail() { redirectingToConsent = false; }
      });
    }
    throw new Error("请先阅读并同意隐私保护指引");
  }
  const existing = getToken();
  if (existing) return existing;
  if (!loginPromise) {
    loginPromise = login().finally(() => {
      loginPromise = null;
    });
  }
  return loginPromise;
}

async function loginAfterConsent(role) {
  if (role !== "GENERAL" && role !== "SELF_14_PLUS" && role !== "GUARDIAN") {
    throw new Error("无效的隐私同意类型");
  }
  const token = getToken() || await login();
  try {
    await rawRequest({
      url: "/privacy/consent",
      method: "POST",
      data: { policyVersion: service.privacyVersion, role, accepted: true },
      header: { Authorization: `Bearer ${token}` }
    });
    wx.setStorageSync(CONSENT_VERSION_KEY, service.privacyVersion);
    redirectingToConsent = false;
  } catch (error) {
    clearSession();
    throw error;
  }
}

module.exports = { clearSession, ensureSession, getToken, getWechatCode, loginAfterConsent };
