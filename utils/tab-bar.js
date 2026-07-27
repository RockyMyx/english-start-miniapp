function syncTabBar(page, selected, pendingReviewCount) {
  if (!page || typeof page.getTabBar !== "function") return;
  const tabBar = page.getTabBar();
  if (!tabBar) return;
  const data = { selected };
  if (pendingReviewCount !== undefined) {
    data.pendingReviewCount = Number(pendingReviewCount) || 0;
  }
  tabBar.setData(data);
}

module.exports = { syncTabBar };
