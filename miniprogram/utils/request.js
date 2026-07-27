const { rawRequest } = require("./http");
const { clearSession, ensureSession } = require("./session");

async function request(options, canRetry = true) {
  const token = await ensureSession();
  try {
    const response = await rawRequest({
      ...options,
      header: {
        ...(options.header || {}),
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    if (canRetry && error.statusCode === 401) {
      clearSession();
      return request(options, false);
    }
    throw error;
  }
}

module.exports = { request };
