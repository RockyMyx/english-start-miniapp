const { apiBaseUrl } = require("../config/index");
const { request } = require("./request");

const pendingDownloads = {};

function remoteAvatarUrl(avatarPath) {
  return avatarPath ? `${apiBaseUrl}${avatarPath}` : "";
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

function writeAvatarFile(filePath, data) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().writeFile({
      filePath,
      data,
      success: resolve,
      fail: reject
    });
  });
}

function avatarCachePath(avatarPath) {
  const fileName = avatarPath.split("/").pop();
  return `${wx.env.USER_DATA_PATH}/english-start-avatar-${fileName}`;
}

async function getAvatarUrl(avatarPath, refresh = false) {
  if (!avatarPath) return "";
  const filePath = avatarCachePath(avatarPath);
  if (!refresh && (await fileExists(filePath))) return filePath;
  if (pendingDownloads[avatarPath]) return pendingDownloads[avatarPath];

  pendingDownloads[avatarPath] = (async () => {
    const data = await request({
      url: avatarPath,
      responseType: "arraybuffer"
    });
    await writeAvatarFile(filePath, data);
    return filePath;
  })();

  try {
    return await pendingDownloads[avatarPath];
  } catch (_error) {
    return remoteAvatarUrl(avatarPath);
  } finally {
    delete pendingDownloads[avatarPath];
  }
}

module.exports = { getAvatarUrl };
