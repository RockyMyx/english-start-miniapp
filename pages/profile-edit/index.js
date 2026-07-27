const { apiBaseUrl } = require("../../config/index");
const { request } = require("../../utils/request");
const { uploadFile } = require("../../utils/upload");

function compressAvatar(filePath) {
  return new Promise((resolve, reject) => {
    if (typeof wx.compressImage !== "function") {
      resolve(filePath);
      return;
    }
    wx.compressImage({
      src: filePath,
      quality: 60,
      success: (result) => resolve(result.tempFilePath),
      fail: reject
    });
  });
}

Page({
  data: {
    loading: true,
    saving: false,
    error: "",
    profile: null,
    nickname: "",
    avatarUrl: "",
    pendingAvatarPath: ""
  },

  onLoad() {
    const pendingAvatarPath =
      wx.getStorageSync("englishStartPendingProfileAvatar") || "";
    wx.removeStorageSync("englishStartPendingProfileAvatar");
    this.setData({
      pendingAvatarPath,
      avatarUrl: pendingAvatarPath
    });
    this.loadProfile();
  },

  async loadProfile() {
    this.setData({ loading: true, error: "" });
    try {
      const profile = await request({ url: "/profile" });
      this.setData({
        profile,
        nickname: profile.nickname || "",
        avatarUrl:
          this.data.pendingAvatarPath ||
          (profile.avatarPath ? `${apiBaseUrl}${profile.avatarPath}` : "")
      });
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  chooseWechatAvatar(event) {
    const avatarUrl = event.detail && event.detail.avatarUrl;
    if (!avatarUrl) return;
    this.setData({
      avatarUrl,
      pendingAvatarPath: avatarUrl
    });
    wx.showToast({ title: "头像已选择，请点击保存", icon: "none" });
  },

  onNicknameInput(event) {
    this.setData({ nickname: event.detail.value });
  },

  onNicknameReview(event) {
    if (event.detail && event.detail.pass === false && !event.detail.timeout) {
      wx.showToast({ title: "该昵称暂时无法使用", icon: "none" });
    }
  },

  async saveProfile(event) {
    if (this.data.saving) return;
    const nickname = String(
      (event.detail && event.detail.value && event.detail.value.nickname) ||
        this.data.nickname ||
        ""
    ).trim();
    const currentNickname =
      this.data.profile && this.data.profile.nickname
        ? this.data.profile.nickname
        : "";
    const pendingAvatarPath = this.data.pendingAvatarPath;
    if (!nickname && !pendingAvatarPath) {
      wx.showToast({ title: "请选择头像或填写昵称", icon: "none" });
      return;
    }

    this.setData({ saving: true, error: "" });
    try {
      let profile = this.data.profile;
      if (nickname && nickname !== currentNickname) {
        profile = await request({
          url: "/profile",
          method: "PUT",
          data: { nickname }
        });
      }
      if (pendingAvatarPath) {
        let filePath = pendingAvatarPath;
        try {
          filePath = await compressAvatar(pendingAvatarPath);
        } catch (_error) {
          filePath = pendingAvatarPath;
        }
        profile = await uploadFile({
          url: "/profile/avatar",
          filePath,
          actionName: "头像"
        });
      }
      profile = await request({ url: "/profile" });
      if (pendingAvatarPath && !profile.avatarPath) {
        throw new Error("头像未保存成功，请重试");
      }
      this.setData({
        profile,
        nickname: profile.nickname || nickname,
        avatarUrl: profile.avatarPath
          ? `${apiBaseUrl}${profile.avatarPath}`
          : this.data.avatarUrl,
        pendingAvatarPath: ""
      });
      wx.showToast({ title: "资料已保存", icon: "success" });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (error) {
      const message = error.message || "资料保存失败";
      this.setData({ error: message });
      wx.showToast({ title: message, icon: "none", duration: 3000 });
    } finally {
      this.setData({ saving: false });
    }
  }
});
