function openRecordSetting(resolve, reject) {
  wx.showModal({
    title: "需要麦克风权限",
    content: "请允许使用麦克风后，再进行语音回答。",
    confirmText: "去设置",
    confirmColor: "#2563eb",
    success(result) {
      if (!result.confirm) {
        reject(new Error("需要允许麦克风权限后才能录音"));
        return;
      }
      wx.openSetting({
        success(setting) {
          if (setting.authSetting && setting.authSetting["scope.record"]) {
            resolve();
            return;
          }
          reject(new Error("需要允许麦克风权限后才能录音"));
        },
        fail() {
          reject(new Error("无法打开权限设置"));
        }
      });
    },
    fail() {
      reject(new Error("需要允许麦克风权限后才能录音"));
    }
  });
}

function ensureRecordPermission() {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success(setting) {
        const recordSetting = setting.authSetting && setting.authSetting["scope.record"];
        if (recordSetting) {
          resolve();
          return;
        }
        if (recordSetting === false) {
          openRecordSetting(resolve, reject);
          return;
        }
        wx.authorize({
          scope: "scope.record",
          success: resolve,
          fail() {
            openRecordSetting(resolve, reject);
          }
        });
      },
      fail() {
        reject(new Error("无法读取麦克风权限状态"));
      }
    });
  });
}

function recorderStartOptions() {
  return {
    duration: 20000,
    sampleRate: 16000,
    numberOfChannels: 1,
    encodeBitRate: 64000,
    format: "wav"
  };
}

module.exports = {
  ensureRecordPermission,
  recorderStartOptions
};
