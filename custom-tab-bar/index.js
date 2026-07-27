Component({
  data: {
    selected: 0,
    pendingReviewCount: 0,
    tabs: [
      {
        pagePath: "/pages/home/index",
        text: "学习",
        icon: "/assets/tab/learn.svg",
        selectedIcon: "/assets/tab/learn-active.svg"
      },
      {
        pagePath: "/pages/review/index",
        text: "复习",
        icon: "/assets/tab/review.svg",
        selectedIcon: "/assets/tab/review-active.svg"
      },
      {
        pagePath: "/pages/me/index",
        text: "我的",
        icon: "/assets/tab/me.svg",
        selectedIcon: "/assets/tab/me-active.svg"
      }
    ]
  },

  methods: {
    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index);
      const tab = this.data.tabs[index];
      if (!tab || index === this.data.selected) return;
      wx.switchTab({ url: tab.pagePath });
    }
  }
});
