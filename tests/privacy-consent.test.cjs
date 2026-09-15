const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const tick = () => new Promise((resolve) => setImmediate(resolve));

function fixture() {
  const stored = new Map();
  const calls = [];
  const navigations = [];
  const context = {
    module: { exports: {} },
    require(name) {
      if (name === "../config/service") return { service: { privacyVersion: "2026-09-15" } };
      return { rawRequest: async (options) => {
        calls.push(options);
        const token = options.header.Authorization;
        if (options.method === "POST") stored.set(token, { accepted: true, role: options.data.role });
        return { data: stored.get(token) || { accepted: false, role: null } };
      } };
    },
    wx: { navigateTo: (options) => navigations.push(options) }
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../utils/privacy-consent.js"), "utf8"), context);
  const flow = () => new URLSearchParams(navigations.at(-1).url.split("?")[1]).get("flow");
  return { api: context.module.exports, stored, calls, navigations, flow };
}

test("parallel dashboard requests share one consent screen and cache only after server acceptance", async () => {
  const f = fixture();
  const first = f.api.ensureLearnerConsent("token-a");
  const second = f.api.ensureLearnerConsent("token-a");
  await tick();
  assert.equal(f.navigations.length, 1);
  assert.equal(f.calls.length, 1);
  await f.api.acceptConsent("GUARDIAN", f.flow());
  await Promise.all([first, second]);
  assert.equal(f.calls.filter((call) => call.method === "POST").length, 1);
  await f.api.ensureLearnerConsent("token-a");
  assert.equal(f.calls.length, 2);
});

test("declining rejects all pending requests and permits a later fresh attempt", async () => {
  const f = fixture();
  const first = f.api.ensureLearnerConsent("token-a");
  const second = f.api.ensureLearnerConsent("token-a");
  const result = Promise.allSettled([first, second]);
  await tick();
  f.api.cancelConsent(f.flow());
  assert.ok((await result).every((value) => value.status === "rejected"));
  assert.equal(f.stored.size, 0);
  const retry = f.api.ensureLearnerConsent("token-a");
  await tick();
  assert.equal(f.navigations.length, 2);
  await f.api.acceptConsent("GUARDIAN", f.flow());
  await retry;
});

test("child profile triggers a guardian flow even after self consent", async () => {
  const f = fixture();
  f.stored.set("Bearer token-a", { accepted: true, role: "SELF_14_PLUS" });
  await f.api.ensureLearnerConsent("token-a");
  const guardian = f.api.ensureLearnerConsent("token-a", true);
  await tick();
  assert.ok(f.navigations[0].url.includes("guardian=1"));
  await f.api.acceptConsent("GUARDIAN", f.flow());
  await guardian;
  assert.equal(f.stored.get("Bearer token-a").role, "GUARDIAN");
});

test("a closing old consent page cannot cancel a different account's pending consent", async () => {
  const f = fixture();
  const first = f.api.ensureLearnerConsent("token-a");
  await tick();
  const oldFlow = f.flow();
  await f.api.acceptConsent("GUARDIAN", oldFlow);
  await first;
  const second = f.api.ensureLearnerConsent("token-b");
  await tick();
  f.api.cancelConsent(oldFlow);
  await f.api.acceptConsent("GUARDIAN", f.flow());
  await second;
  assert.equal(f.stored.size, 2);
});

test("server consent invalidation rechecks without trusting the old memory cache", async () => {
  const f = fixture();
  f.stored.set("Bearer token-a", { accepted: true, role: "GUARDIAN" });
  await f.api.ensureLearnerConsent("token-a");
  f.stored.delete("Bearer token-a");
  f.api.invalidateConsent();
  const fresh = f.api.ensureLearnerConsent("token-a");
  await tick();
  assert.equal(f.navigations.length, 1);
  await f.api.acceptConsent("GUARDIAN", f.flow());
  await fresh;
});
