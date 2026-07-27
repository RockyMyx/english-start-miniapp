const { request } = require("../../utils/request");
const { uploadFile } = require("../../utils/upload");
const { playSpeech, stopSpeech } = require("../../utils/speech");
const {
  playFeedbackSound,
  prepareFeedbackSound
} = require("../../utils/feedback-sound");
const {
  ensureRecordPermission,
  recorderStartOptions
} = require("../../utils/recorder");

const recorder = wx.getRecorderManager();

function shuffled(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

Page({
  data: {
    loading: true,
    evaluating: false,
    recording: false,
    recordingCanceling: false,
    speaking: false,
    error: "",
    words: [],
    index: 0,
    current: null,
    voiceResult: null,
    answered: false,
    passedCount: 0,
    finished: false
  },

  onLoad() {
    this.handleRecorderStop = (result) => {
      this.recordingStopping = false;
      this.setData({ recording: false, recordingCanceling: false });
      if (this.ignoreNextRecordStop) {
        this.ignoreNextRecordStop = false;
        return;
      }
      if (!result.tempFilePath) {
        this.setData({ error: "没有录到声音，请按住按钮跟读" });
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
    this.loadWords();
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

  async loadWords() {
    this.setData({ loading: true, error: "" });
    try {
      const result = await request({ url: "/words" });
      const words = shuffled(result.words || [])
        .slice(0, 10)
        .map((word) => ({ ...word, voiceResult: null, passed: false }));
      this.setData({
        words,
        index: 0,
        current: words[0] || null,
        voiceResult: null,
        answered: false,
        passedCount: 0,
        finished: false
      });
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  async playCurrent() {
    if (!this.data.current || this.data.speaking) return;
    this.setData({ speaking: true, error: "" });
    try {
      await playSpeech(this.data.current.english, "word");
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
      this.data.evaluating
    ) return;
    this.recordingStarting = true;
    this.recordStartY =
      event && event.touches && event.touches.length ? event.touches[0].clientY : 0;
    this.recordStartAt = 0;
    prepareFeedbackSound();
    this.setData({ error: "", recordingCanceling: false });
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
    const recordingCanceling = this.recordStartY - event.touches[0].clientY > 70;
    if (recordingCanceling !== this.data.recordingCanceling) {
      this.setData({ recordingCanceling });
    }
  },

  stopRecording() {
    if (!this.data.recording) {
      this.recordingStarting = false;
      return;
    }
    if (this.data.recordingCanceling) {
      this.discardRecording("已取消");
      return;
    }
    if (this.recordStartAt && Date.now() - this.recordStartAt < 500) {
      this.discardRecording("说话时间太短");
      return;
    }
    recorder.stop();
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
      const rawResult = await uploadFile({
        url: `/words/${this.data.current.id}/pronunciation`,
        filePath
      });
      const round = (value) => Math.round(Number(value) || 0);
      const voiceResult = {
        ...rawResult,
        voice: {
          ...rawResult.voice,
          pronunciationScore: round(rawResult.voice.pronunciationScore),
          accuracyScore: round(rawResult.voice.accuracyScore),
          fluencyScore: round(rawResult.voice.fluencyScore),
          completenessScore: round(rawResult.voice.completenessScore)
        }
      };
      const wasPassed = Boolean(this.data.current.passed);
      const current = {
        ...this.data.current,
        voiceResult,
        passed: wasPassed || voiceResult.correct
      };
      const words = [...this.data.words];
      words[this.data.index] = current;
      this.setData({
        words,
        current,
        voiceResult,
        answered: true,
        passedCount: this.data.passedCount + (!wasPassed && voiceResult.correct ? 1 : 0)
      });
      playFeedbackSound(voiceResult.correct);
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ evaluating: false });
    }
  },

  previous() {
    if (this.data.index === 0 || this.data.recording || this.data.evaluating) return;
    this.showWord(this.data.index - 1);
  },

  next() {
    if (!this.data.answered || this.data.recording || this.data.evaluating) return;
    const nextIndex = this.data.index + 1;
    if (nextIndex >= this.data.words.length) {
      this.setData({ finished: true });
      return;
    }
    this.showWord(nextIndex);
  },

  showWord(index) {
    const current = this.data.words[index];
    this.setData({
      index,
      current,
      voiceResult: current.voiceResult,
      answered: Boolean(current.voiceResult),
      error: ""
    });
  },

  goHome() {
    wx.switchTab({ url: "/pages/home/index" });
  },

  restart() {
    this.loadWords();
  }
});
