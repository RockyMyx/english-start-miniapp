const { request } = require("../../utils/request");

const categories = [
  {
    key: "greeting",
    title: "问候与回应",
    description: "打招呼、告别、感谢和日常回应",
    color: "orange"
  },
  {
    key: "number",
    title: "数字 1—10",
    description: "认识和使用最常见的十个数字",
    color: "blue"
  },
  {
    key: "question",
    title: "常用问句",
    description: "what、who、where、how 等提问表达",
    color: "cyan"
  },
  {
    key: "sentence",
    title: "句子小帮手",
    description: "人称、物主、冠词和句子核心词",
    color: "teal"
  },
  {
    key: "color",
    title: "基础颜色",
    description: "认识和描述常见颜色",
    color: "pink"
  },
  {
    key: "school",
    title: "学校用品",
    description: "书本文具以及桌椅等常见物品",
    color: "green"
  },
  {
    key: "fruit",
    title: "常见水果",
    description: "启蒙阶段常见的苹果和香蕉",
    color: "yellow"
  },
  {
    key: "life",
    title: "常见宠物",
    description: "认识生活中常见的猫和狗",
    color: "purple"
  }
];

Page({
  data: {
    loading: true,
    importing: false,
    done: false,
    error: "",
    name: "启蒙 70 词",
    count: 0,
    groups: []
  },

  onLoad() {
    this.loadPreview();
  },

  async loadPreview() {
    this.setData({ loading: true, error: "" });
    try {
      const result = await request({ url: "/starter-pack" });
      const words = result.words || [];
      const groups = categories.map((category) => ({
        ...category,
        words: words.filter((word) => word.category === category.key),
        count: words.filter((word) => word.category === category.key).length
      }));
      this.setData({
        name: result.name || "启蒙 70 词",
        count: result.count || words.length,
        groups
      });
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  async confirmImport() {
    if (this.data.importing || this.data.done) return;
    this.setData({ importing: true, error: "" });
    try {
      const result = await request({
        url: "/starter-pack/import",
        method: "POST",
        data: {}
      });
      this.setData({ done: true });
      wx.showToast({
        title: "词包已经导入",
        icon: "success"
      });
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ importing: false });
    }
  },

  goBack() {
    wx.navigateBack();
  }
});
