const { ensureSession } = require("./utils/session");
const {
  startStudyTimer,
  stopStudyTimer
} = require("./utils/learning-progress");

App({
  onLaunch() {
    ensureSession().catch(() => {
      // 页面会展示可操作的连接错误。
    });
  },

  onShow() {
    startStudyTimer();
  },

  onHide() {
    stopStudyTimer();
  }
});
