const {
  startStudyTimer,
  stopStudyTimer
} = require("./utils/learning-progress");
const { service } = require("./config/service");

App({
  onShow() {
    if (wx.getStorageSync("englishStartPrivacyAcceptedVersion") === service.privacyVersion) {
      startStudyTimer();
    }
  },

  onHide() {
    stopStudyTimer();
  }
});
