const { request } = require("../../utils/request");
const { uploadFile } = require("../../utils/upload");
const {
  playFeedbackSound,
  prepareFeedbackSound
} = require("../../utils/feedback-sound");
const { syncDailyGoal } = require("../../utils/learning-progress");
const {
  ensureRecordPermission,
  recorderStartOptions
} = require("../../utils/recorder");

const recorder = wx.getRecorderManager();

Page({
  data: {
    loading: true,
    evaluating: false,
    recording: false,
    recordingCanceling: false,
    error: "",
    prompts: [],
    index: 0,
    current: null,
    answer: "",
    evaluation: null,
    voiceResult: null,
    answered: false,
    correctCount: 0,
    finished: false,
    summary: null
    ,
    scope: "all"
  },

  onLoad(options) {
    this.setData({ scope: options && options.scope === "weak" ? "weak" : "all" });
    this.handleRecorderStop = (result) => {
      this.recordingStopping = false;
      this.setData({ recording: false, recordingCanceling: false });
      if (this.ignoreNextRecordStop) {
        this.ignoreNextRecordStop = false;
        return;
      }
      if (!result.tempFilePath) {
        this.setData({ error: "没有录到声音，请按住按钮说完整句子" });
        return;
      }
      this.submitVoice(result.tempFilePath);
    };
    this.handleRecorderError = (error) => {
      this.recordingStarting = false;
      this.recordingStopping = false;
      this.setData({
        recording: false,
        recordingCanceling: false,
        error: error && error.errMsg ? `录音失败：${error.errMsg}` : "录音失败，请确认已经允许使用麦克风"
      });
    };
    recorder.onStop(this.handleRecorderStop);
    recorder.onError(this.handleRecorderError);
    this.loadPrompts();
  },

  onUnload() {
    if (this.data.recording) {
      this.ignoreNextRecordStop = true;
      recorder.stop();
    }
    if (typeof recorder.offStop === "function") recorder.offStop(this.handleRecorderStop);
    if (typeof recorder.offError === "function") recorder.offError(this.handleRecorderError);
  },

  async loadPrompts() {
    this.setData({ loading: true, error: "" });
    try {
      const result = await request({
        url: `/sentences${this.data.scope === "weak" ? "?scope=weak" : ""}`
      });
      const prompts = (result.prompts || []).map((prompt) => ({
        ...prompt,
        answerState: null
      }));
      this.setData({
        prompts,
        current: prompts[0] || null,
        index: 0,
        answer: "",
        evaluation: null,
        voiceResult: null,
        recordingCanceling: false,
        answered: false,
        correctCount: 0,
        finished: false,
        summary: null
      });
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  onInput(event) {
    this.setData({ answer: event.detail.value });
  },

  async submit() {
    if (!this.data.answer.trim() || this.data.evaluating || this.data.answered) return;
    prepareFeedbackSound();
    this.setData({ evaluating: true, error: "", evaluation: null, voiceResult: null });
    try {
      const evaluation = await request({
        url: `/sentences/${this.data.current.id}/answer`,
        method: "POST",
        data: { answer: this.data.answer }
      });
      this.saveAnswerState({
        answer: this.data.answer,
        evaluation,
        voiceResult: null,
        correct: evaluation.correct
      });
      playFeedbackSound(evaluation.correct);
      if (evaluation.correct) syncDailyGoal();
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ evaluating: false });
    }
  },

  async startRecording(event) {
    if (
      this.recordingStarting ||
      this.recordingStopping ||
      this.data.recording ||
      this.data.evaluating ||
      this.data.answered
    ) return;
    this.recordingStarting = true;
    this.recordStartY =
      event && event.touches && event.touches.length ? event.touches[0].clientY : 0;
    this.recordStartAt = 0;
    prepareFeedbackSound();
    this.setData({
      error: "",
      evaluation: null,
      voiceResult: null,
      recordingCanceling: false
    });
    try {
      await ensureRecordPermission();
      if (!this.recordingStarting) return;
      this.recordStartAt = Date.now();
      recorder.start(recorderStartOptions());
      this.setData({ recording: true });
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.recordingStarting = false;
    }
  },

  moveRecording(event) {
    if (!this.data.recording || !event.touches || !event.touches.length) return;
    if (!this.recordStartY) {
      this.recordStartY = event.touches[0].clientY;
      return;
    }
    const recordingCanceling = this.recordStartY - event.touches[0].clientY > 70;
    if (recordingCanceling !== this.data.recordingCanceling) {
      this.setData({ recordingCanceling });
    }
  },

  stopRecording() {
    if (this.data.recording) {
      if (this.data.recordingCanceling) {
        this.discardRecording("已取消");
        return;
      }
      if (this.recordStartAt && Date.now() - this.recordStartAt < 500) {
        this.discardRecording("说话时间太短");
        return;
      }
      recorder.stop();
      return;
    }
    this.recordingStarting = false;
  },

  cancelRecording() {
    this.recordingStarting = false;
    if (this.data.recording) this.discardRecording("已取消");
  },

  discardRecording(message) {
    this.ignoreNextRecordStop = true;
    this.recordingStopping = true;
    recorder.stop();
    this.setData({ recording: false, recordingCanceling: false });
    wx.showToast({ title: message, icon: "none" });
  },

  async submitVoice(filePath) {
    this.setData({ evaluating: true, error: "" });
    try {
      const voiceResult = await uploadFile({
        url: `/sentences/${this.data.current.id}/voice-answer`,
        filePath
      });
      this.saveAnswerState({
        answer: this.data.answer,
        evaluation: null,
        voiceResult,
        correct: voiceResult.correct
      });
      playFeedbackSound(voiceResult.correct);
      if (voiceResult.correct) syncDailyGoal();
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ evaluating: false });
    }
  },

  saveAnswerState(answerState) {
    const current = { ...this.data.current, answerState };
    const prompts = [...this.data.prompts];
    prompts[this.data.index] = current;
    this.setData({
      prompts,
      current,
      answer: answerState.answer,
      evaluation: answerState.evaluation,
      voiceResult: answerState.voiceResult,
      recordingCanceling: false,
      answered: true,
      correctCount: this.data.correctCount + (answerState.correct ? 1 : 0)
    });
  },

  previous() {
    if (this.data.index === 0 || this.data.recording || this.data.evaluating) return;
    this.showPrompt(this.data.index - 1);
  },

  next() {
    if (!this.data.answered || this.data.recording || this.data.evaluating) return;
    const nextIndex = this.data.index + 1;
    if (nextIndex >= this.data.prompts.length) {
      this.finishRound();
      return;
    }
    this.showPrompt(nextIndex);
  },

  showPrompt(index) {
    const current = this.data.prompts[index];
    const state = current.answerState;
    this.setData({
      index,
      current,
      answer: state ? state.answer : "",
      evaluation: state ? state.evaluation : null,
      voiceResult: state ? state.voiceResult : null,
      recordingCanceling: false,
      answered: Boolean(state),
      error: ""
    });
  },

  async finishRound() {
    const correctRate = this.data.prompts.length
      ? Math.round((this.data.correctCount / this.data.prompts.length) * 100)
      : 0;
    this.setData({
      finished: true,
      summary: {
        correctRate,
        roundScore: this.data.correctCount * 5,
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
      "summary.goalText": remaining
        ? `今日已得 ${dashboard.todayScore} 分，再得 ${remaining} 分即可达标`
        : `今日已得 ${dashboard.todayScore} 分，50 分目标已完成`
    });
  },

  goHome() {
    wx.switchTab({ url: "/pages/home/index" });
  },

  restart() {
    this.loadPrompts();
  }
});
