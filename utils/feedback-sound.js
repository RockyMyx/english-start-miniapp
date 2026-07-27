let audioContext = null;

function getAudioContext() {
  if (!audioContext && typeof wx.createWebAudioContext === "function") {
    audioContext = wx.createWebAudioContext();
  }
  return audioContext;
}

function prepareFeedbackSound() {
  const context = getAudioContext();
  if (context && context.state === "suspended" && typeof context.resume === "function") {
    context.resume();
  }
}

function playFeedbackSound(isCorrect) {
  try {
    const context = getAudioContext();
    if (!context) throw new Error("WebAudioContext is unavailable");

    prepareFeedbackSound();

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const startAt = context.currentTime + 0.01;
    const endAt = startAt + 0.25;

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.type = "sine";

    if (isCorrect) {
      oscillator.frequency.setValueAtTime(880, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(660, startAt + 0.15);
    } else {
      oscillator.frequency.setValueAtTime(220, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(110, startAt + 0.15);
    }

    gainNode.gain.setValueAtTime(0.45, startAt);
    gainNode.gain.exponentialRampToValueAtTime(0.01, endAt);
    oscillator.start(startAt);
    oscillator.stop(endAt);
  } catch (error) {
    if (typeof wx.vibrateShort === "function") {
      wx.vibrateShort({ type: isCorrect ? "light" : "heavy" });
    }
  }
}

module.exports = {
  playFeedbackSound,
  prepareFeedbackSound
};
