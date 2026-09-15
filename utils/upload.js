const { apiBaseUrl } = require("../config/index");
const { clearSession, ensureSession } = require("./session");
const { ensureLearnerConsent, invalidateConsent } = require("./privacy-consent");

async function uploadFile(options, canRetry = true) {
  const token = await ensureSession();
  try { await ensureLearnerConsent(token); }
  catch (error) {
    if (canRetry && error.statusCode === 401) {
      clearSession();
      return uploadFile(options, false);
    }
    throw error;
  }
  const actionName = options.actionName || "语音";
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${apiBaseUrl}${options.url}`,
      filePath: options.filePath,
      name: options.name || "file",
      header: { Authorization: `Bearer ${token}` },
      success(response) {
        let data = {};
        try {
          data = JSON.parse(response.data || "{}");
        } catch (_error) {
          reject(new Error(`${actionName}上传返回了无法解析的数据`));
          return;
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(data);
          return;
        }
        if (response.statusCode === 401 && canRetry) {
          clearSession();
          uploadFile(options, false).then(resolve).catch(reject);
          return;
        }
        const error = new Error(data.message || `${actionName}上传失败`);
        error.statusCode = response.statusCode;
        if (canRetry && data.error === "PRIVACY_CONSENT_REQUIRED") {
          invalidateConsent();
          uploadFile(options, false).then(resolve).catch(reject);
          return;
        }
        reject(error);
      },
      fail() {
        reject(new Error(`${actionName}上传失败，请检查后端服务`));
      }
    });
  });
}

module.exports = { uploadFile };
