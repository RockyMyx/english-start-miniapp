const now = new Date();
const dayOfWeek = now.getDay();
const hour = now.getHours();
const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
const isOfficeHours = isWeekday && hour >= 9 && hour < 18;
const localApiBaseUrl = isOfficeHours
  ? "http://192.168.0.191:3000"
  : "http://192.168.110.16:3000";

function getEnvVersion() {
  try {
    const accountInfo = wx.getAccountInfoSync();
    return accountInfo.miniProgram.envVersion || "develop";
  } catch (_error) {
    return "develop";
  }
}

const envVersion = getEnvVersion();
const useServerApi = envVersion === "trial" || envVersion === "release";

module.exports = {
  apiBaseUrl: useServerApi
    ? "http://122.51.131.175:3000"
    : localApiBaseUrl,
  useDevLogin: envVersion !== "release",
  envVersion
};
