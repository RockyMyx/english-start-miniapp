const { request } = require("../../utils/request");
const { playSpeech, stopSpeech } = require("../../utils/speech");
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
    speaking: false,
    error: "",
    prompts: [],
    index: 0,
    current: null,
    showTranslation: false,
    voiceResult: null,
    recordingCanceling: false,
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
        this.setData({ error: "没有录到声音，请按住按钮说完整回答" });
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
    stopSpeech();
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
        url: `/dialogues${this.data.scope === "weak" ? "?scope=weak" : ""}`
      });
      const prompts = (result.prompts || []).map((prompt) => ({
        ...prompt,
        showTranslation: false,
        answerState: null
      }));
      this.setData({
        prompts,
        current: prompts[0] || null,
        index: 0,
        showTranslation: false,
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

  toggleTranslation() {
    const showTranslation = !this.data.showTranslation;
    const current = { ...this.data.current, showTranslation };
    const prompts = [...this.data.prompts];
    prompts[this.data.index] = current;
    this.setData({ prompts, current, showTranslation });
  },

  async playQuestion() {
    if (!this.data.current || this.data.speaking) return;
    this.setData({ speaking: true, error: "" });
    try {
      await playSpeech(this.data.current.question, "sentence");
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ speaking: false });
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
    this.setData({ error: "", voiceResult: null, recordingCanceling: false });
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
        this.ignoreNextRecordStop = true;
        this.recordingStopping = true;
        recorder.stop();
        this.setData({ recording: false, recordingCanceling: false });
        wx.showToast({ title: "已取消", icon: "none" });
        return;
      }
      if (this.recordStartAt && Date.now() - this.recordStartAt < 500) {
        this.ignoreNextRecordStop = true;
        this.recordingStopping = true;
        recorder.stop();
        this.setData({ recording: false, recordingCanceling: false });
        wx.showToast({ title: "说话时间太短", icon: "none" });
        return;
      }
      recorder.stop();
      return;
    }
    this.recordingStarting = false;
  },

  cancelRecording() {
    this.recordingStarting = false;
    if (!this.data.recording) return;
    this.ignoreNextRecordStop = true;
    this.recordingStopping = true;
    recorder.stop();
    this.setData({ recording: false, recordingCanceling: false });
    wx.showToast({ title: "已取消", icon: "none" });
  },

  async submitVoice(filePath) {
    this.setData({ evaluating: true, error: "" });
    try {
      const rawVoiceResult = await uploadFile({
        url: `/dialogues/${this.data.current.id}/voice-answer`,
        filePath
      });
      const voiceResult = this.formatVoiceResult(rawVoiceResult);
      this.saveAnswerState({
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

  formatVoiceResult(result) {
    const round = (value) => Math.round(Number(value) || 0);
    return {
      ...result,
      semantic: result.semantic
        ? { ...result.semantic, score: round(result.semantic.score) }
        : result.semantic,
      voice: result.voice
        ? {
            ...result.voice,
            pronunciationScore: round(result.voice.pronunciationScore),
            accuracyScore: round(result.voice.accuracyScore),
            fluencyScore: round(result.voice.fluencyScore),
            completenessScore: round(result.voice.completenessScore)
          }
        : result.voice
    };
  },

  saveAnswerState(answerState) {
    const current = { ...this.data.current, answerState };
    const prompts = [...this.data.prompts];
    prompts[this.data.index] = current;
    this.setData({
      prompts,
      current,
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
      showTranslation: Boolean(current.showTranslation),
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
        roundScore: this.data.correctCount * 2,
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
