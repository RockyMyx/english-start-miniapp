const { request } = require("../../utils/request");
const { uploadFile } = require("../../utils/upload");

function compressImage(filePath) {
  if (typeof wx.compressImage !== "function") return Promise.resolve(filePath);
  return new Promise((resolve) => {
    wx.compressImage({
      src: filePath,
      quality: 72,
      success: (result) => resolve(result.tempFilePath),
      fail: () => resolve(filePath)
    });
  });
}

function chooseCameraImage() {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["camera"],
      sizeType: ["compressed"],
      success: (result) => {
        const file = result.tempFiles && result.tempFiles[0];
        if (!file || !file.tempFilePath) {
          reject(new Error("没有获取到照片"));
          return;
        }
        resolve(file.tempFilePath);
      },
      fail: reject
    });
  });
}

Page({
  data: {
    photoPath: "",
    recognizing: false,
    saving: false,
    recognized: false,
    words: [],
    error: ""
  },

  onLoad() {
    const photoPath = wx.getStorageSync("englishStartPendingWordPhoto");
    wx.removeStorageSync("englishStartPendingWordPhoto");
    if (!photoPath) {
      this.setData({ error: "没有找到待识别的照片，请重新拍摄。" });
      return;
    }
    this.setData({ photoPath });
    this.recognizePhoto();
  },

  async recognizePhoto() {
    if (!this.data.photoPath || this.data.recognizing) return;
    this.setData({
      recognizing: true,
      recognized: false,
      words: [],
      error: ""
    });
    try {
      const result = await uploadFile({
        url: "/words/recognize-image",
        filePath: this.data.photoPath,
        actionName: "图片"
      });
      this.setData({
        recognized: true,
        words: (result.words || []).map((word) => ({
          english: word.english || "",
          chinese: word.chinese || ""
        }))
      });
      if (!result.words || !result.words.length) {
        this.setData({ error: "没有在照片中识别到英文单词，请重新拍摄清晰的单词区域。" });
      }
    } catch (error) {
      this.setData({ recognized: true, error: error.message });
    } finally {
      this.setData({ recognizing: false });
    }
  },

  editWord(event) {
    const index = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;
    this.setData({ [`words[${index}].${field}`]: event.detail.value });
  },

  removeWord(event) {
    const index = Number(event.currentTarget.dataset.index);
    const words = this.data.words.filter((_word, wordIndex) => wordIndex !== index);
    this.setData({ words });
  },

  addEmptyWord() {
    this.setData({
      words: [...this.data.words, { english: "", chinese: "" }]
    });
  },

  async retakePhoto() {
    try {
      const originalPath = await chooseCameraImage();
      const photoPath = await compressImage(originalPath);
      this.setData({ photoPath, words: [], recognized: false, error: "" });
      this.recognizePhoto();
    } catch (error) {
      const message = error && error.errMsg ? error.errMsg : error.message;
      if (!message || !message.includes("cancel")) {
        this.setData({ error: message || "拍照失败，请重试" });
      }
    }
  },

  async confirmImport() {
    if (this.data.saving || !this.data.words.length) return;
    const words = this.data.words.map((word) => ({
      english: word.english.trim(),
      chinese: word.chinese.trim()
    }));
    const invalidIndex = words.findIndex((word) => !word.english || !word.chinese);
    if (invalidIndex >= 0) {
      wx.showToast({
        title: `请补全第 ${invalidIndex + 1} 个单词`,
        icon: "none"
      });
      return;
    }
    this.setData({ saving: true, error: "" });
    try {
      const result = await request({
        url: "/words/batch",
        method: "POST",
        data: { words }
      });
      wx.showToast({ title: `已加入 ${result.saved} 个单词`, icon: "success" });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ saving: false });
    }
  }
});
