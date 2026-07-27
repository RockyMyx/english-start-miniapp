const { request } = require("../../utils/request");
const { playSpeech, stopSpeech } = require("../../utils/speech");
const {
  playFeedbackSound,
  prepareFeedbackSound
} = require("../../utils/feedback-sound");
const { syncDailyGoal } = require("../../utils/learning-progress");

const optionLetters = ["A", "B", "C", "D"];

function decorateQuestion(question) {
  if (!question) return null;
  const hasEnglishOptions = question.mode === "MEANING_CHOOSE_WORD";
  return {
    ...question,
    questionAudioText: question.mode === "WORD_CHOOSE_MEANING" ? question.prompt : "",
    options: (question.options || []).map((option, index) => ({
      ...option,
      letter: optionLetters[index] || String(index + 1),
      audioText: hasEnglishOptions ? option.text : "",
      state: ""
    }))
  };
}

const modeInfo = {
  LISTEN_CHOOSE_MEANING: { title: "听读音选中文", instruction: "点击播放，选择你听到的词义" },
  MEANING_CHOOSE_WORD: { title: "看中文选英文", instruction: "根据中文意思，选择正确英文" },
  WORD_CHOOSE_MEANING: { title: "看英文选中文", instruction: "根据英文单词，选择正确中文" }
};

Page({
  data: {
    mode: "",
    title: "",
    instruction: "",
    loading: true,
    error: "",
    questions: [],
    index: 0,
    current: null,
    answered: false,
    answering: false,
    selectedId: "",
    result: null,
    correctCount: 0,
    finished: false,
    summary: null,
    speaking: false,
    speakingText: ""
  },

  onLoad(options) {
    const info = modeInfo[options.mode] || modeInfo.WORD_CHOOSE_MEANING;
    this.setData({ mode: options.mode || "WORD_CHOOSE_MEANING", ...info });
    wx.setNavigationBarTitle({ title: info.title });
    this.loadQuestions();
  },

  onUnload() {
    stopSpeech();
  },

  async loadQuestions() {
    this.setData({ loading: true, error: "" });
    try {
      const result = await request({
        url: `/practice/questions?mode=${this.data.mode}&limit=10`
      });
      const questions = (result.questions || []).map(decorateQuestion);
      this.setData({
        questions,
        index: 0,
        current: questions[0] || null,
        answered: false,
        answering: false,
        selectedId: "",
        result: null,
        finished: false,
        correctCount: 0,
        summary: null
      });
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  async playCurrent() {
    const audioText = this.data.current
      ? this.data.current.audioText || this.data.current.questionAudioText
      : "";
    if (!audioText || this.data.speaking || this.data.speakingText) return;
    this.setData({ speaking: true, error: "" });
    try {
      await playSpeech(audioText, "word");
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ speaking: false });
    }
  },

  async playOption(event) {
    const { id, text } = event.currentTarget.dataset;
    if (!text || this.data.speaking || this.data.speakingText) return;
    this.setData({ speakingText: id, error: "" });
    try {
      await playSpeech(text, "word");
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ speakingText: "" });
    }
  },

  async selectOption(event) {
    if (this.data.answered || this.data.answering) return;
    const selectedId = event.currentTarget.dataset.id;
    prepareFeedbackSound();
    this.setData({ selectedId, answering: true, error: "" });
    try {
      const result = await request({
        url: "/practice/answers",
        method: "POST",
        data: {
          mode: this.data.mode,
          wordId: this.data.current.wordId,
          selectedWordId: selectedId
        }
      });
      const options = this.data.current.options.map((option) => {
        let state = "";
        if (option.id === result.correctWordId) {
          state = "correct";
        } else if (!result.correct && option.id === selectedId) {
          state = "wrong";
        }
        return { ...option, state };
      });
      const answeredQuestion = {
        ...this.data.current,
        options,
        answered: true,
        selectedId,
        result
      };
      const questions = [...this.data.questions];
      questions[this.data.index] = answeredQuestion;
      this.setData({
        questions,
        current: answeredQuestion,
        answered: true,
        answering: false,
        result,
        correctCount: this.data.correctCount + (result.correct ? 1 : 0)
      });
      playFeedbackSound(result.correct);
      if (result.correct) syncDailyGoal();
    } catch (error) {
      this.setData({ error: error.message, selectedId: "", answering: false });
    }
  },

  previous() {
    if (this.data.index === 0 || this.data.answering) return;
    this.showQuestion(this.data.index - 1);
  },

  next() {
    if (!this.data.answered || this.data.answering) return;
    const nextIndex = this.data.index + 1;
    if (nextIndex >= this.data.questions.length) {
      this.finishRound();
      return;
    }
    this.showQuestion(nextIndex);
  },

  showQuestion(index) {
    const current = this.data.questions[index];
    this.setData({
      index,
      current,
      answered: Boolean(current.answered),
      answering: false,
      selectedId: current.selectedId || "",
      result: current.result || null,
      error: ""
    });
  },

  async finishRound() {
    const correctRate = this.data.questions.length
      ? Math.round((this.data.correctCount / this.data.questions.length) * 100)
      : 0;
    this.setData({
      finished: true,
      summary: {
        correctRate,
        roundScore: this.data.correctCount,
        todayScore: 0,
        dailyGoal: 50,
        goalText: "正在同步今日得分…"
      }
    });
    const dashboard = await syncDailyGoal();
    if (!dashboard) {
      this.setData({
        "summary.goalText": "本轮成绩已保存，返回首页可查看今日得分"
      });
      return;
    }
    const remaining = Math.max(0, dashboard.dailyScoreGoal - dashboard.todayScore);
    this.setData({
      summary: {
        correctRate,
        roundScore: this.data.correctCount,
        todayScore: dashboard.todayScore,
        dailyGoal: dashboard.dailyScoreGoal,
        goalText: remaining
          ? `今日已得 ${dashboard.todayScore} 分，再得 ${remaining} 分即可达标`
          : `今日已得 ${dashboard.todayScore} 分，50 分目标已完成`
      }
    });
  },

  goHome() {
    wx.reLaunch({ url: "/pages/home/index" });
  },

  restart() {
    this.loadQuestions();
  }
});
