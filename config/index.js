const serverApiBaseUrl = "https://wx.rockyma.online";

function getEnvVersion() {
  try {
    const accountInfo = wx.getAccountInfoSync();
    return accountInfo.miniProgram.envVersion || "develop";
  } catch (_error) {
    return "develop";
  }
}

const envVersion = getEnvVersion();

module.exports = {
  apiBaseUrl: serverApiBaseUrl,
  useDevLogin: false,
  envVersion
};
