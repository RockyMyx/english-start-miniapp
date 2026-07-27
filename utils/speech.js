const { request } = require("./request");

const CACHE_INDEX_KEY = "englishStartSpeechCacheV1";
const MAX_CACHE_FILES = 80;
const pendingDownloads = {};
let audioContext = null;

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function readCacheIndex() {
  const value = wx.getStorageSync(CACHE_INDEX_KEY);
  return Array.isArray(value) ? value : [];
}

function writeCacheIndex(entries) {
  wx.setStorageSync(CACHE_INDEX_KEY, entries);
}

function fileExists(filePath) {
  return new Promise((resolve) => {
    wx.getFileSystemManager().access({
      path: filePath,
      success: () => resolve(true),
      fail: () => resolve(false)
    });
  });
}

function writeAudioFile(filePath, data) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().writeFile({
      filePath,
      data,
      success: resolve,
      fail: reject
    });
  });
}

function removeAudioFile(filePath) {
  wx.getFileSystemManager().unlink({
    filePath,
    fail() {}
  });
}

function touchCacheEntry(cacheKey, filePath) {
  const now = Date.now();
  const entries = readCacheIndex()
    .filter((entry) => entry && entry.cacheKey !== cacheKey && entry.filePath !== filePath)
    .concat({ cacheKey, filePath, lastUsedAt: now })
    .sort((left, right) => right.lastUsedAt - left.lastUsedAt);
  const retained = entries.slice(0, MAX_CACHE_FILES);
  entries.slice(MAX_CACHE_FILES).forEach((entry) => removeAudioFile(entry.filePath));
  writeCacheIndex(retained);
}

async function findCachedFile(cacheKey) {
  const entries = readCacheIndex();
  const entry = entries.find((item) => item && item.cacheKey === cacheKey);
  if (!entry) return "";
  if (!(await fileExists(entry.filePath))) {
    writeCacheIndex(entries.filter((item) => item !== entry));
    return "";
  }
  touchCacheEntry(cacheKey, entry.filePath);
  return entry.filePath;
}

async function getSpeechFile(text, kind, speed) {
  const normalizedText = text.trim();
  const cacheKey = JSON.stringify({ text: normalizedText, kind, speed });
  const cachedFile = await findCachedFile(cacheKey);
  if (cachedFile) return cachedFile;
  if (pendingDownloads[cacheKey]) return pendingDownloads[cacheKey];

  pendingDownloads[cacheKey] = (async () => {
    const audioData = await request({
      url: "/speech/tts",
      method: "POST",
      data: { text: normalizedText, speed, kind },
      responseType: "arraybuffer"
    });
    const fileName = `english-start-speech-${hashString(cacheKey)}-${cacheKey.length}.mp3`;
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    await writeAudioFile(filePath, audioData);
    touchCacheEntry(cacheKey, filePath);
    return filePath;
  })();

  try {
    return await pendingDownloads[cacheKey];
  } finally {
    delete pendingDownloads[cacheKey];
  }
}

async function playSpeech(text, kind = "auto") {
  const filePath = await getSpeechFile(text, kind, 0.85);
  stopSpeech();
  await new Promise((resolve, reject) => {
    audioContext = wx.createInnerAudioContext();
    audioContext.src = filePath;
    audioContext.onCanplay(resolve);
    audioContext.onError((error) => {
      stopSpeech();
      reject(new Error(error.errMsg || "音频播放失败"));
    });
    audioContext.play();
  });
}

function stopSpeech() {
  if (audioContext) {
    audioContext.stop();
    audioContext.destroy();
    audioContext = null;
  }
}

module.exports = { playSpeech, stopSpeech };
