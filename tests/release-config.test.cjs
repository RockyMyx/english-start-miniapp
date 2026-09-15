const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const readSource = (file) => fs.readFileSync(path.join(root, file), "utf8");

function loadConfig(getAccountInfoSync) {
  const context = { module: { exports: {} }, wx: { getAccountInfoSync } };
  vm.runInNewContext(readSource("config/index.js"), context);
  return context.module.exports;
}

function loadPage(file, config) {
  let page;
  vm.runInNewContext(readSource(file), {
    require(name) {
      return name === "../../config/index" ? config : {};
    },
    wx: { getRecorderManager: () => ({}) },
    Page(definition) { page = definition; }
  });
  return page;
}

for (const version of ["develop", "trial", "release", undefined, "unknown"]) {
  test(`development controls are hidden except for develop (${String(version)})`, async () => {
    const config = loadConfig(() => ({ miniProgram: { envVersion: version } }));
    const expectedDebug = version === "develop";
    assert.equal(config.envVersion, version === "develop" || version === "trial" ? version : "release");
    assert.equal(config.useDevLogin, false);
    assert.equal(config.apiBaseUrl, "https://wx.rockyma.online");

    for (const name of ["membership", "initial-assessment"]) {
      const page = loadPage(`pages/${name}/index.js`, config);
      assert.equal(page.data.isDebug, expectedDebug);
      const template = readSource(`pages/${name}/index.wxml`);
      assert.match(template, name === "membership"
        ? /<view wx:if="\{\{isDebug\}\}" class="debug-card">/
        : /<button wx:if="\{\{isDebug\}\}" class="debug-reset"/);
      const action = name === "membership" ? page.switchTestMembership : page.resetAssessment;
      if (!expectedDebug) {
        // 非开发版即使直接触发处理函数，也不能调用开发身份或测评重置接口。
        const context = {
          data: page.data,
          setData() { throw new Error("A hidden development action must not execute"); }
        };
        await action.call(context);
      }
    }
  });
}

for (const scenario of ["API throws", "API missing", "invalid response"]) {
  test(`environment detection fails closed when ${scenario}`, () => {
    const resolver = scenario === "API missing" ? undefined : () => {
      if (scenario === "API throws") throw new Error("Not available");
      return {};
    };
    const config = loadConfig(resolver);
    assert.equal(config.envVersion, "release");
    assert.equal(loadPage("pages/membership/index.js", config).data.isDebug, false);
    assert.equal(loadPage("pages/initial-assessment/index.js", config).data.isDebug, false);
  });
}

test("release validation tests are excluded from the mini program upload", () => {
  const project = JSON.parse(readSource("project.config.json"));
  assert.ok(project.packOptions.ignore.some((item) => item.type === "folder" && item.value === "tests"));
});
