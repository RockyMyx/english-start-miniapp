const STUDY_TIME_KEY = "englishStartStudyTimeV1";
const GOAL_CELEBRATION_KEY = "englishStartGoalCelebrationV1";
const DAILY_GOAL_KEY = "englishStartDailyGoalV1";

let activeStartedAt = 0;
let activeDate = "";
let persistTimer = null;

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function readStudyTime() {
  const today = todayKey();
  const saved = wx.getStorageSync(STUDY_TIME_KEY);
  if (!saved || saved.date !== today) {
    return { date: today, seconds: 0 };
  }
  return {
    date: today,
    seconds: Math.max(0, Number(saved.seconds) || 0)
  };
}

function flushStudyTime() {
  if (!activeStartedAt) return;
  const now = Date.now();
  const today = todayKey();
  if (activeDate !== today) {
    activeStartedAt = now;
    activeDate = today;
    wx.setStorageSync(STUDY_TIME_KEY, { date: today, seconds: 0 });
    return;
  }
  const elapsed = Math.floor((now - activeStartedAt) / 1000);
  if (elapsed < 1) return;
  const saved = readStudyTime();
  wx.setStorageSync(STUDY_TIME_KEY, {
    date: today,
    seconds: saved.seconds + elapsed
  });
  activeStartedAt += elapsed * 1000;
}

function startStudyTimer() {
  if (activeStartedAt) return;
  activeStartedAt = Date.now();
  activeDate = todayKey();
  persistTimer = setInterval(flushStudyTime, 15000);
}

function stopStudyTimer() {
  flushStudyTime();
  activeStartedAt = 0;
  activeDate = "";
  if (persistTimer) {
    clearInterval(persistTimer);
    persistTimer = null;
  }
}

function getTodayStudySeconds() {
  const saved = readStudyTime();
  if (!activeStartedAt || activeDate !== saved.date) return saved.seconds;
  return saved.seconds + Math.floor((Date.now() - activeStartedAt) / 1000);
}

function formatStudyTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  const minuteSecond = `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
  return hours > 0 ? `${String(hours).padStart(2, "0")}:${minuteSecond}` : minuteSecond;
}

function getDailyGoal() {
  const storedGoal = Number(wx.getStorageSync(DAILY_GOAL_KEY));
  return Number.isInteger(storedGoal) && storedGoal > 0 && storedGoal <= 999
    ? storedGoal
    : 50;
}

function setDailyGoal(goal) {
  const normalizedGoal = Number(goal);
  if (!Number.isInteger(normalizedGoal) || normalizedGoal < 1 || normalizedGoal > 999) {
    return false;
  }
  wx.setStorageSync(DAILY_GOAL_KEY, normalizedGoal);
  return true;
}

function checkDailyGoal(todayScore, dailyGoal = 50) {
  if (Number(todayScore) < Number(dailyGoal)) return false;
  const today = todayKey();
  const celebrated = wx.getStorageSync(GOAL_CELEBRATION_KEY);
  if (celebrated === today && Number(dailyGoal) === 50) return false;
  if (
    celebrated &&
    celebrated.date === today &&
    Number(celebrated.goal) === Number(dailyGoal)
  ) {
    return false;
  }
  wx.setStorageSync(GOAL_CELEBRATION_KEY, { date: today, goal: Number(dailyGoal) });
  wx.showModal({
    title: "🎉 太棒了！",
    content: `今日得分已达到 ${dailyGoal} 分！`,
    showCancel: false,
    confirmText: "继续学习",
    confirmColor: "#2563eb"
  });
  return true;
}

async function syncDailyGoal() {
  try {
    const { request } = require("./request");
    const dashboard = await request({ url: "/me" });
    const dailyScoreGoal = Number(dashboard.dailyScoreGoal) || getDailyGoal();
    setDailyGoal(dailyScoreGoal);
    checkDailyGoal(dashboard.todayScore, dailyScoreGoal);
    return { ...dashboard, dailyScoreGoal };
  } catch (_error) {
    return null;
  }
}

module.exports = {
  checkDailyGoal,
  formatStudyTime,
  getDailyGoal,
  getTodayStudySeconds,
  setDailyGoal,
  startStudyTimer,
  stopStudyTimer,
  syncDailyGoal
};
