const config = require("../config/index");
const { rawRequest } = require("./http");

const TOKEN_KEY = "englishStartSessionToken";
const DEV_OPEN_ID_KEY = "englishStartDevOpenId";
let loginPromise = null;

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
  const existing = getToken();
  if (existing) return existing;
  if (!loginPromise) {
    loginPromise = login().finally(() => {
      loginPromise = null;
    });
  }
  return loginPromise;
}

module.exports = { clearSession, ensureSession, getToken };
