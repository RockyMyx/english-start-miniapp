const { rawRequest } = require("./http");
const { clearSession, ensureSession } = require("./session");
const { ensureLearnerConsent, invalidateConsent } = require("./privacy-consent");

async function request(options, canRetry = true) {
  const token = await ensureSession();
  try {
    const requiredGuardian = options.url === "/onboarding/profile" && options.data && options.data.ageBand !== "14+";
    await ensureLearnerConsent(token, Boolean(requiredGuardian));
    const response = await rawRequest({
      ...options,
      header: {
        ...(options.header || {}),
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    if (canRetry && error.code === "PRIVACY_CONSENT_REQUIRED") {
      invalidateConsent();
      return request(options, false);
    }
    if (canRetry && error.statusCode === 401) {
      clearSession();
      return request(options, false);
    }
    throw error;
  }
}

module.exports = { request };
