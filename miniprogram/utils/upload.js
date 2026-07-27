const { apiBaseUrl } = require("../config/index");
const { clearSession, ensureSession } = require("./session");

async function uploadFile(options, canRetry = true) {
  const token = await ensureSession();
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
          reject(new Error("语音评测返回了无法解析的数据"));
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
        const error = new Error(data.message || "语音评测失败");
        error.statusCode = response.statusCode;
        reject(error);
      },
      fail() {
        reject(new Error("录音上传失败，请检查后端服务"));
      }
    });
  });
}

module.exports = { uploadFile };
