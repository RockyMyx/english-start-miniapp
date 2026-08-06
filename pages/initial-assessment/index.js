const { request } = require("../../utils/request");
const { uploadFile } = require("../../utils/upload");
const { playSpeech, stopSpeech } = require("../../utils/speech");
const { ensureRecordPermission, recorderStartOptions } = require("../../utils/recorder");
const config = require("../../config/index");

const recorder = wx.getRecorderManager();

const AGE_OPTIONS = [
  { value: "3-5", label: "3～5岁" },
  { value: "6-7", label: "6～7岁" },
  { value: "8-9", label: "8～9岁" },
  { value: "10-12", label: "10～12岁" },
  { value: "13+", label: "13岁以上" }
];
const GRADE_OPTIONS = [
  { value: "PRESCHOOL", label: "学前" },
  { value: "GRADE_1", label: "一年级" },
  { value: "GRADE_2", label: "二年级" },
  { value: "GRADE_3", label: "三年级" },
  { value: "GRADE_4", label: "四年级" },
  { value: "GRADE_5", label: "五年级" },
  { value: "GRADE_6_PLUS", label: "六年级及以上" }
];
const EXPERIENCE_OPTIONS = [
  { value: "NONE", label: "还没正式接触" },
  { value: "UNDER_6_MONTHS", label: "半年以内" },
  { value: "6_TO_12_MONTHS", label: "半年至一年" },
  { value: "OVER_1_YEAR", label: "一年以上" }
];
const GOAL_OPTIONS = [
  { value: "BALANCED", label: "均衡启蒙", note: "根据薄弱能力安排练习" },
  { value: "VOCABULARY", label: "认识更多单词", note: "侧重认读和听辨" },
  { value: "SPELLING", label: "加强听写拼写", note: "侧重听写和易错词" },
  { value: "PRONUNCIATION", label: "改善英语发音", note: "侧重单词跟读" },
  { value: "SPEAKING", label: "提升开口表达", note: "侧重造句和对话" },
  { value: "SCHOOL", label: "校内英语同步", note: "侧重认读和拼写" }
];
const DIMENSION_LABELS = {
  RECOGNITION: "认读",
  SPELLING: "拼写",
  PRONUNCIATION: "发音",
  EXPRESSION: "表达"
};

function decoratedOptions(options, selected, multiple) {
  const values = multiple ? selected || [] : [selected];
  return options.map((option) => ({ ...option, selected: values.includes(option.value) }));
}

Page({
  data: {
    loading: true,
    saving: false,
    evaluating: false,
    recording: false,
    recordingCanceling: false,
    speaking: false,
    isDebug: config.envVersion === "develop",
    error: "",
    stage: "PROFILE",
    membership: { active: false },
    ageBand: "",
    gradeLevel: "",
    englishExperience: "",
    learningGoals: [],
    ageOptions: decoratedOptions(AGE_OPTIONS, "", false),
    gradeOptions: decoratedOptions(GRADE_OPTIONS, "", false),
    experienceOptions: decoratedOptions(EXPERIENCE_OPTIONS, "", false),
    goalOptions: decoratedOptions(GOAL_OPTIONS, [], true),
    assessment: null,
    questions: [],
    index: 0,
    current: null,
    answerText: "",
    answerPlaceholder: "请输入答案",
    progressText: "",
    progressPercent: 0,
    dimensionLabel: "",
    difficultyLabel: "",
    resultScores: [],
    assessmentHistory: [],
    assessmentCount: 0,
    resetting: false
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
        this.setData({ error: "没有录到声音，请重新录音" });
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
        error: error && error.errMsg ? `录音失败：${error.errMsg}` : "录音失败，请检查麦克风权限"
      });
    };
    recorder.onStop(this.handleRecorderStop);
    recorder.onError(this.handleRecorderError);
    this.loadState();
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

  async loadState() {
    this.setData({ loading: true, error: "" });
    try {
      const state = await request({ url: "/onboarding" });
      const assessmentHistory = state.assessmentHistory || [];
      this.setData({
        difficultyLabel: this.formatDifficulty(state.difficulty),
        assessmentHistory,
        assessmentCount: Number(state.assessmentCount) || assessmentHistory.length
      });
      if (!state.membership || !state.membership.active) {
        this.setData({ membership: state.membership || { active: false }, stage: "LOCKED" });
        return;
      }
      const profile = state.profile || {};
      this.applyProfile(profile);
      if (state.assessment && state.assessment.status === "COMPLETED") {
        this.showResult(state.assessment, assessmentHistory);
      } else if (state.assessment && state.assessment.status === "IN_PROGRESS") {
        await this.startAssessment();
      } else {
        this.setData({
          membership: state.membership,
          assessment: null,
          stage: profile.complete ? "INTRO" : "PROFILE"
        });
      }
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  applyProfile(profile) {
    const learningGoals = profile.learningGoals || [];
    this.setData({
      ageBand: profile.ageBand || "",
      gradeLevel: profile.gradeLevel || "",
      englishExperience: profile.englishExperience || "",
      learningGoals,
      ageOptions: decoratedOptions(AGE_OPTIONS, profile.ageBand || "", false),
      gradeOptions: decoratedOptions(GRADE_OPTIONS, profile.gradeLevel || "", false),
      experienceOptions: decoratedOptions(EXPERIENCE_OPTIONS, profile.englishExperience || "", false),
      goalOptions: decoratedOptions(GOAL_OPTIONS, learningGoals, true)
    });
  },

  selectSingle(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.currentTarget.dataset.value;
    const optionField = {
      ageBand: "ageOptions",
      gradeLevel: "gradeOptions",
      englishExperience: "experienceOptions"
    }[field];
    const source = {
      ageBand: AGE_OPTIONS,
      gradeLevel: GRADE_OPTIONS,
      englishExperience: EXPERIENCE_OPTIONS
    }[field];
    this.setData({ [field]: value, [optionField]: decoratedOptions(source, value, false), error: "" });
  },

  toggleGoal(event) {
    const value = event.currentTarget.dataset.value;
    const learningGoals = this.data.learningGoals.includes(value)
      ? this.data.learningGoals.filter((item) => item !== value)
      : [...this.data.learningGoals, value];
    this.setData({
      learningGoals,
      goalOptions: decoratedOptions(GOAL_OPTIONS, learningGoals, true),
      error: ""
    });
  },

  async saveProfile() {
    if (this.data.saving) return;
    if (!this.data.ageBand || !this.data.gradeLevel || !this.data.englishExperience) {
      wx.showToast({ title: "请完成基本信息", icon: "none" });
      return;
    }
    if (!this.data.learningGoals.length) {
      wx.showToast({ title: "请至少选择一个学习目标", icon: "none" });
      return;
    }
    this.setData({ saving: true, error: "" });
    try {
      await request({
        url: "/onboarding/profile",
        method: "PUT",
        data: {
          ageBand: this.data.ageBand,
          gradeLevel: this.data.gradeLevel,
          englishExperience: this.data.englishExperience,
          learningGoals: this.data.learningGoals
        }
      });
      this.setData({
        difficultyLabel: this.formatDifficulty(
          this.difficultyForExperience(this.data.englishExperience)
        ),
        stage: this.data.assessment && this.data.assessment.status === "COMPLETED"
          ? "RESULT"
          : "INTRO"
      });
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ saving: false });
    }
  },

  editProfile() {
    this.setData({ stage: "PROFILE", error: "" });
  },

  async startAssessment() {
    if (this.data.saving) return;
    this.setData({ saving: true, error: "" });
    try {
      const response = await request({ url: "/assessments/initial/start", method: "POST" });
      const answered = new Set((response.assessment.answers || []).map((item) => item.questionKey));
      let index = (response.questions || []).findIndex((question) => !answered.has(question.key));
      if (index < 0) index = Math.max(0, response.questions.length - 1);
      this.setData({
        assessment: response.assessment,
        questions: response.questions || [],
        difficultyLabel: this.formatDifficulty(response.assessment.difficulty),
        stage: "QUESTIONS"
      });
      this.showQuestion(index);
    } catch (error) {
      if (error.statusCode === 409) {
        await this.loadState();
      } else {
        this.setData({ error: error.message });
      }
    } finally {
      this.setData({ saving: false, loading: false });
    }
  },

  showQuestion(index) {
    const current = this.data.questions[index] || null;
    this.setData({
      index,
      current,
      answerText: "",
      answerPlaceholder:
        current && current.type === "TEXT" && current.dimension === "RECOGNITION"
          ? "请输入中文意思"
          : "请输入英文答案",
      progressText: current ? `${index + 1}/${this.data.questions.length}` : "",
      progressPercent: current && this.data.questions.length
        ? Math.round(((index + 1) / this.data.questions.length) * 100)
        : 0,
      dimensionLabel: current ? DIMENSION_LABELS[current.dimension] : "",
      error: ""
    });
  },

  async playCurrent() {
    if (!this.data.current || !this.data.current.audioText || this.data.speaking) return;
    this.setData({ speaking: true, error: "" });
    try {
      await playSpeech(this.data.current.audioText, "word");
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ speaking: false });
    }
  },

  onAnswerInput(event) {
    this.setData({ answerText: event.detail.value });
  },

  chooseAnswer(event) {
    if (this.data.evaluating) return;
    this.submitTextAnswer(event.currentTarget.dataset.id);
  },

  submitInputAnswer() {
    const answerText = this.data.answerText.trim();
    if (!answerText) {
      wx.showToast({ title: "请输入答案", icon: "none" });
      return;
    }
    this.submitTextAnswer(answerText);
  },

  async submitTextAnswer(answerText, skipped = false) {
    if (!this.data.current || this.data.evaluating) return;
    this.setData({ evaluating: true, error: "" });
    try {
      await request({
        url: `/assessments/initial/${this.data.assessment.id}/answers`,
        method: "POST",
        data: { questionKey: this.data.current.key, answerText, skipped }
      });
      await this.advance();
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ evaluating: false });
    }
  },

  skipQuestion() {
    this.submitTextAnswer("", true);
  },

  async advance() {
    const nextIndex = this.data.index + 1;
    if (nextIndex < this.data.questions.length) {
      this.showQuestion(nextIndex);
      return;
    }
    this.setData({ saving: true });
    try {
      await request({
        url: `/assessments/initial/${this.data.assessment.id}/complete`,
        method: "POST"
      });
      await this.loadState();
    } finally {
      this.setData({ saving: false });
    }
  },

  async startRecording(event) {
    if (this.recordingStarting || this.data.recording || this.data.evaluating) return;
    this.recordingStarting = true;
    this.recordStartY = event && event.touches && event.touches.length ? event.touches[0].clientY : 0;
    this.recordStartAt = 0;
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
    if (recordingCanceling !== this.data.recordingCanceling) this.setData({ recordingCanceling });
  },

  stopRecording() {
    if (!this.data.recording) {
      this.recordingStarting = false;
      return;
    }
    if (this.data.recordingCanceling || (this.recordStartAt && Date.now() - this.recordStartAt < 500)) {
      this.ignoreNextRecordStop = true;
      recorder.stop();
      this.setData({ recording: false, recordingCanceling: false });
      wx.showToast({ title: "录音已取消或时间太短", icon: "none" });
      return;
    }
    recorder.stop();
  },

  cancelRecording() {
    this.recordingStarting = false;
    if (this.data.recording) {
      this.ignoreNextRecordStop = true;
      recorder.stop();
      this.setData({ recording: false, recordingCanceling: false });
    }
  },

  async submitVoice(filePath) {
    this.setData({ evaluating: true, error: "" });
    try {
      await uploadFile({
        url: `/assessments/initial/${this.data.assessment.id}/questions/${this.data.current.key}/voice`,
        filePath,
        actionName: "测评录音"
      });
      await this.advance();
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ evaluating: false });
    }
  },

  showResult(assessment, history = this.data.assessmentHistory) {
    const scores = assessment.scores || {};
    const previous = history.find((item) => item.id !== assessment.id) || null;
    const previousScores = previous && previous.scores ? previous.scores : {};
    const scoreFields = [
      ["recognition", "认读"],
      ["spelling", "拼写"],
      ["pronunciation", "发音"],
      ["expression", "表达"]
    ];
    this.setData({
      assessment,
      stage: "RESULT",
      assessmentCount: this.data.assessmentCount || history.length || 1,
      difficultyLabel: this.formatDifficulty(assessment.difficulty),
      resultScores: scoreFields.map(([key, label]) => ({
        key,
        label,
        value: scores[key] === null || scores[key] === undefined ? "未测" : `${scores[key]}分`,
        ...this.scoreChange(
          scores[key],
          previousScores[key],
          Boolean(previous),
          !previous || previous.difficulty === assessment.difficulty
        )
      }))
    });
  },

  scoreChange(current, previous, hasPrevious, comparable) {
    if (!hasPrevious) return { changeText: "首次记录", changeClass: "change-muted" };
    if (!comparable) return { changeText: "题组已调整", changeClass: "change-muted" };
    if (current === null || current === undefined) {
      return { changeText: "本次未测", changeClass: "change-muted" };
    }
    if (previous === null || previous === undefined) {
      return { changeText: "本次新增", changeClass: "change-up" };
    }
    const difference = Math.round(Number(current) - Number(previous));
    if (difference > 0) return { changeText: `较上次 +${difference}`, changeClass: "change-up" };
    if (difference < 0) return { changeText: `较上次 ${difference}`, changeClass: "change-down" };
    return { changeText: "较上次持平", changeClass: "change-stable" };
  },

  repeatAssessment() {
    if (this.data.saving) return;
    wx.showModal({
      title: "开始新一轮能力测评？",
      content: "新结果会与上一次测评对比，建议在完成一段时间学习后再次测评。",
      confirmText: "开始测评",
      success: (result) => {
        if (result.confirm) this.startAssessment();
      }
    });
  },

  formatDifficulty(difficulty) {
    return {
      FOUNDATION: "基础题组",
      STANDARD: "标准题组",
      ADVANCED: "进阶题组"
    }[difficulty] || "匹配题组";
  },

  difficultyForExperience(experience) {
    if (experience === "OVER_1_YEAR") return "ADVANCED";
    if (experience === "6_TO_12_MONTHS") return "STANDARD";
    return "FOUNDATION";
  },

  openReport() {
    wx.navigateTo({ url: "/pages/learning-report/index" });
  },

  openMembership() {
    wx.redirectTo({ url: "/pages/membership/index" });
  },

  async resetAssessment() {
    if (!this.data.isDebug || this.data.resetting) return;
    this.setData({ resetting: true, error: "" });
    try {
      await request({ url: "/assessments/initial/dev-reset", method: "DELETE" });
      wx.showToast({ title: "测评记录已清空", icon: "none" });
      await this.loadState();
    } catch (error) {
      this.setData({ error: error.message });
    } finally {
      this.setData({ resetting: false });
    }
  }
});
