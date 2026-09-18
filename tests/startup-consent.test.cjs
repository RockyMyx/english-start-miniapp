const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

function fixture() {
  const storage = new Map();
  const calls = [];
  const redirects = [];
  const context = {
    module: { exports: {} },
    require(name) {
      if (name === "../config/index") return { useDevLogin: true };
      if (name === "../config/service") return { service: { privacyVersion: "2026-09-18" } };
      if (name === "./http") return { rawRequest: async (options) => {
        calls.push(options);
        if (options.url === "/auth/dev-login") return { data: { token: "session-token" } };
        return { data: { accepted: true } };
      } };
      throw new Error(`Unexpected module ${name}`);
    },
    wx: {
      getStorageSync: (key) => storage.get(key) || "",
      setStorageSync: (key, value) => storage.set(key, value),
      removeStorageSync: (key) => storage.delete(key),
      reLaunch: (options) => { redirects.push(options.url); }
    }
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../utils/session.js"), "utf8"), context);
  return { session: context.module.exports, storage, calls, redirects };
}

test("first entry shows privacy prompt before creating a session", async () => {
  const f = fixture();
  await assert.rejects(f.session.ensureSession(), /请先阅读并同意/);
  assert.deepEqual(f.redirects, ["/pages/startup/index"]);
  assert.equal(f.calls.length, 0);
});

test("agreement logs in, records the current policy, then unlocks normal requests", async () => {
  const f = fixture();
  await f.session.loginAfterConsent("GENERAL");
  assert.deepEqual(f.calls.map((call) => call.url), ["/auth/dev-login", "/privacy/consent"]);
  assert.equal(f.calls[1].data.role, "GENERAL");
  assert.equal(f.calls[1].data.policyVersion, "2026-09-18");
  assert.equal(f.storage.get("englishStartPrivacyAcceptedVersion"), "2026-09-18");
  assert.equal(await f.session.ensureSession(), "session-token");
});

test("startup prompt does not ask users to select an age identity", () => {
  const template = fs.readFileSync(path.resolve(__dirname, "../pages/startup/index.wxml"), "utf8");
  assert.doesNotMatch(template, /radio-group|SELF_14_PLUS|GUARDIAN/);
  assert.match(template, /未满14周岁的用户，请在监护人陪同下使用/);
});
