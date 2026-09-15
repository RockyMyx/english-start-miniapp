const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

function page(name, modules = {}, wx = {}) {
  let definition;
  vm.runInNewContext(read(`pages/${name}/index.js`), {
    require: (name) => modules[name] || {}, wx, Page: (value) => { definition = value; }, setTimeout
  });
  definition.data = { ...definition.data };
  definition.setData = (patch) => Object.assign(definition.data, patch);
  return definition;
}

test("public service configuration fails closed until truthful information is provided", () => {
  const required = ["operatorName", "contactEmail", "serviceHours", "responseTime", "thirdPartyDetails", "retentionDetails"];
  const complete = Object.fromEntries(required.map((name) => [name, name === "contactEmail" ? "support@example.com" : "test public information"]));
  for (const [input, expected] of [
    [Object.fromEntries(required.map((name) => [name, ""])), false],
    [complete, true], [{ ...complete, contactEmail: "invalid-email" }, false],
    [{ ...complete, retentionDetails: "  " }, false]
  ]) {
    const context = { module: { exports: {} }, testService: input };
    const source = read("config/service.js").replace("const requiredFields", "Object.assign(service, testService);\nconst requiredFields");
    vm.runInNewContext(source, context);
    assert.equal(context.module.exports.serviceReady, expected);
  }
});

test("a purchase cannot start without explicit agreement, or incomplete release information", async () => {
  let requests = 0;
  const notices = [];
  const definition = page("membership", {
    "../../utils/request": { request: async () => { requests++; throw new Error("test stop"); } },
    "../../utils/session": { getWechatCode: async () => "test-code" },
    "../../config/index": { envVersion: "release" },
    "../../config/service": { serviceReady: false }
  }, { showToast: (notice) => notices.push(notice.title) });
  definition.data.product.available = true;
  await definition.openMembership();
  assert.equal(requests, 0);
  assert.match(notices[0], /协议/);
  definition.onAgreementChange({ detail: { value: ["agree"] } });
  await definition.openMembership();
  assert.equal(requests, 0);
  assert.match(notices[1], /服务信息/);
  definition.data.serviceReady = true;
  await definition.openMembership();
  assert.equal(requests, 1);
  assert.equal(definition.data.paying, false);
  definition.onAgreementChange({ detail: { value: [] } });
  assert.equal(definition.data.agreementAccepted, false);
});

test("support and privacy remain accessible without membership or successful dashboard loading", () => {
  const template = read("pages/me/index.wxml");
  const help = template.indexOf("帮助与服务");
  assert.ok(help > template.indexOf("</block>"));
  for (const type of ["privacy", "membership", "support"]) assert.ok(template.includes(`type=${type}`));
  const serviceTemplate = read("pages/service-info/index.wxml");
  assert.match(serviceTemplate, /open-type="contact"/);
  assert.doesNotMatch(serviceTemplate, /membership\.active/);
});

test("service pages require no account or AI request and unknown types default to privacy", () => {
  const definition = page("service-info", { "../../config/service": { service: {}, serviceReady: false } }, { setNavigationBarTitle() {} });
  for (const type of ["privacy", "membership", "support", "invalid"]) {
    definition.onLoad({ type });
    assert.equal(definition.data.type, type === "invalid" ? "privacy" : type);
    assert.ok(definition.data.sections.length > 0);
  }
  assert.doesNotMatch(read("pages/service-info/index.js"), /require\(.+utils\/(request|upload|session)/);
});

test("consent starts unselected, requires opening the policy and an explicit role", async () => {
  let accepted = 0;
  const definition = page("privacy-consent", {
    "../../utils/privacy-consent": { acceptConsent: async () => { accepted++; }, cancelConsent() {} },
    "../../config/service": { serviceReady: true },
    "../../config/index": { envVersion: "release" }
  }, { navigateBack() {}, navigateTo: (options) => options.success() });
  assert.equal(definition.data.role, "");
  assert.equal(definition.data.agreed, false);
  await definition.confirm();
  assert.equal(accepted, 0);
  definition.openPrivacy();
  definition.onRoleChange({ detail: { value: "GUARDIAN" } });
  definition.onAgreeChange({ detail: { value: ["agree"] } });
  await definition.confirm();
  assert.equal(accepted, 1);
});

test("guardian-required consent cannot be bypassed with a self role", async () => {
  const definition = page("privacy-consent", {
    "../../utils/privacy-consent": { acceptConsent: async () => { throw new Error("must not run"); } },
    "../../config/service": { serviceReady: true }, "../../config/index": { envVersion: "develop" }
  });
  definition.onLoad({ guardian: "1" });
  definition.setData({ read: true, agreed: true, role: "SELF_14_PLUS" });
  await definition.confirm();
  assert.equal(definition.data.saving, false);
});

test("privacy policy has an explicit version for server-recorded consent", () => {
  const context = { module: { exports: {} } };
  vm.runInNewContext(read("config/service.js"), context);
  assert.match(context.module.exports.service.privacyVersion, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(read("utils/privacy-consent.js").includes("policyVersion: service.privacyVersion"));
});
