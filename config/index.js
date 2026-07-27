const localApiConfig = {
  mode: "auto",
  officeBaseUrl: "http://192.168.0.191:3000",
  homeBaseUrl: "http://192.168.110.16:3000",
  officeHours: {
    weekdays: [1, 2, 3, 4, 5],
    startHour: 9,
    endHour: 18
  }
};

function isOfficeTime(now, officeHours = localApiConfig.officeHours) {
  return (
    officeHours.weekdays.includes(now.getDay()) &&
    now.getHours() >= officeHours.startHour &&
    now.getHours() < officeHours.endHour
  );
}

function resolveApiBaseUrl(options = {}) {
  const mode = options.mode || localApiConfig.mode;
  const now = options.now || new Date();

  if (mode === "office") return localApiConfig.officeBaseUrl;
  if (mode === "home") return localApiConfig.homeBaseUrl;
  if (mode === "auto") {
    return isOfficeTime(now) ? localApiConfig.officeBaseUrl : localApiConfig.homeBaseUrl;
  }

  throw new Error(`不支持的本地 API 模式：${mode}`);
}

module.exports = {
  apiBaseUrl: resolveApiBaseUrl(),
  useDevLogin: true,
  resolveApiBaseUrl
};
