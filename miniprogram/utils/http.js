const { apiBaseUrl } = require("../config/index");

function rawRequest(options) {
  return new Promise((resolve, reject) => {
    const requestOptions =
      String(options.method || "GET").toUpperCase() === "DELETE" && options.data === undefined
        ? { ...options, data: {} }
        : options;

    wx.request({
      ...requestOptions,
      url: `${apiBaseUrl}${options.url}`,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response);
          return;
        }
        const error = new Error(response.data?.message || "请求失败");
        error.statusCode = response.statusCode;
        error.code = response.data?.error;
        reject(error);
      },
      fail(error) {
        const requestError = new Error("无法连接学习服务，请确认后端已启动");
        requestError.cause = error;
        reject(requestError);
      }
    });
  });
}

module.exports = { rawRequest };
