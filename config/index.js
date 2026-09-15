const serverApiBaseUrl = "https://wx.rockyma.online";

function getEnvVersion() {
  try {
    const accountInfo = wx.getAccountInfoSync();
    const version = accountInfo.miniProgram.envVersion;
    return ["develop", "trial", "release"].includes(version) ? version : "release";
  } catch (_error) {
    return "release";
  }
}

const envVersion = getEnvVersion();

module.exports = {
  apiBaseUrl: serverApiBaseUrl,
  useDevLogin: false,
  envVersion
};
