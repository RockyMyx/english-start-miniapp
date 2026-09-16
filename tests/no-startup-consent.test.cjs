const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

function requestFixture() {
  const calls = [];
  const consents = [];
  const context = {
    module: { exports: {} },
    require(name) {
      if (name === "./http") return { rawRequest: async (options) => { calls.push(options); return { data: { ok: true } }; } };
      if (name === "./session") return { ensureSession: async () => "token", clearSession() {} };
      if (name === "./privacy-consent") return { ensureLearnerConsent: async (...args) => consents.push(args), invalidateConsent() {} };
      throw new Error(`Unexpected module ${name}`);
    }
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../utils/request.js"), "utf8"), context);
  return { request: context.module.exports.request, calls, consents };
}

test("startup, library, reports, payment and ordinary practice never trigger custom consent", async () => {
  const f = requestFixture();
  for (const url of ["/me", "/profile", "/daily-plans/today", "/onboarding", "/words", "/reports/learning", "/membership"]) await f.request({ url });
  for (const url of ["/starter-pack/import", "/practice/answers", "/membership/payment/orders"]) await f.request({ url, method: "POST", data: {} });
  assert.equal(f.consents.length, 0);
  assert.equal(f.calls.length, 10);
});

test("only submitting child assessment information requests guardian consent", async () => {
  const f = requestFixture();
  await f.request({ url: "/onboarding/profile", method: "PUT", data: { ageBand: "14+" } });
  assert.equal(f.consents.length, 0);
  for (const ageBand of ["3-5", "6-7", "8-9", "10-12", "13+"]) await f.request({ url: "/onboarding/profile", method: "PUT", data: { ageBand } });
  assert.equal(f.consents.length, 5);
  assert.ok(f.consents.every(([token, guardian]) => token === "token" && guardian === true));
});

test("camera, recorder and uploads retain native privacy flow without a custom gate", () => {
  for (const file of ["utils/recorder.js", "utils/upload.js", "pages/word-library/index.js"]) {
    const source = fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
    assert.doesNotMatch(source, /ensureLearnerConsent|privacy-consent/);
  }
  const permissions = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../app.json"), "utf8")).permission;
  assert.ok(permissions["scope.camera"]);
  assert.ok(permissions["scope.record"]);
});
