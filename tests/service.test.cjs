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
    require: (name) => modules[name] || (name === "../../config/service-documents"
      ? require(path.join(root, "config/service-documents.js"))
      : {}), wx, Page: (value) => { definition = value; }, setTimeout
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

test("purchase opens an agreement, cancel creates no order, explicit agreement starts one purchase", async () => {
  let requests = 0;
  const definition = page("membership", {
    "../../utils/request": { request: async () => { requests++; throw new Error("test stop"); } },
    "../../utils/session": { getWechatCode: async () => "test-code" },
    "../../config/index": { envVersion: "release" },
    "../../config/service": { service: {}, serviceReady: false }
  });
  definition.data.loading = false;
  definition.data.product.available = true;
  await definition.confirmMembershipPurchase();
  assert.equal(requests, 0);
  await definition.openMembership();
  assert.equal(requests, 0);
  assert.equal(definition.data.showAgreement, true);
  assert.ok(definition.data.agreementSections.length > 1);
  definition.cancelAgreement();
  await definition.confirmMembershipPurchase();
  assert.equal(requests, 0);
  await definition.openMembership();
  await Promise.all([definition.confirmMembershipPurchase(), definition.confirmMembershipPurchase()]);
  assert.equal(requests, 1);
  assert.equal(definition.data.paying, false);
  assert.equal(definition.data.showAgreement, false);
  await definition.confirmMembershipPurchase();
  assert.equal(requests, 1);
  definition.data.membership = { active: true };
  definition.openMembership();
  assert.equal(definition.data.showAgreement, true);
});

test("my page exposes privacy and native contact support without requiring a loaded dashboard", () => {
  const template = read("pages/me/index.wxml");
  const help = template.indexOf("帮助与服务");
  assert.ok(help > template.indexOf("</block>"));
  assert.match(template, /data-url="\/pages\/service-info\/index\?type=privacy" bindtap="openPage"/);
  assert.doesNotMatch(template, /service-info\/index\?type=(membership|support)/);
  assert.match(template, /<button class="menu-row contact-menu" open-type="contact">/);
  assert.equal((template.match(/open-type="contact"/g) || []).length, 1);
  const serviceTemplate = read("pages/service-info/index.wxml");
  assert.match(serviceTemplate, /open-type="contact"/);
  assert.doesNotMatch(serviceTemplate, /membership\.active/);
});

for (const priceFen of [100, 9900]) {
  test(`agreement uses current server price (${priceFen}) and successful payment needs fresh acceptance`, async () => {
    const product = { available: true, priceFen, durationDays: 365 };
    let orders = 0;
    let payments = 0;
    const definition = page("membership", {
      "../../config/index": { envVersion: "release" },
      "../../config/service": { service: {}, serviceReady: true },
      "../../utils/session": { getWechatCode: async () => "test-code" },
      "../../utils/request": { request: async (options) => {
        assert.equal(options.url, "/membership/payment/orders");
        orders++;
        return { product, payment: { signData: JSON.stringify({ goodsPrice: priceFen }), outTradeNo: "test-order" } };
      } }
    }, { requestVirtualPayment: (options) => { payments++; options.success(); }, showToast() {} });
    Object.assign(definition.data, { loading: false, product });
    definition.confirmPayment = async () => ({ active: true, expiresAt: "2027-09-16" });
    definition.showAssessmentPrompt = () => {};
    definition.openMembership();
    assert.match(definition.data.agreementSections[0].text, new RegExp(`人民币 ${priceFen / 100} 元`));
    assert.match(definition.data.agreementSections[0].text, /365 天/);
    assert.equal(definition.data.agreementPriceText, String(priceFen / 100));
    await definition.confirmMembershipPurchase();
    await definition.confirmMembershipPurchase();
    assert.equal(orders, 1);
    assert.equal(payments, 1);
    assert.equal(definition.data.membership.active, true);
    definition.openMembership();
    assert.equal(definition.data.showAgreement, true);
  });
}

for (const changed of ["signed price", "product price", "duration"]) {
  test(`changed ${changed} cannot charge against previously accepted terms`, async () => {
    let payments = 0;
    const currentProduct = { available: true, priceFen: changed === "duration" ? 100 : 9900, durationDays: changed === "duration" ? 7 : 365 };
    const definition = page("membership", {
      "../../config/index": { envVersion: "release" },
      "../../config/service": { service: {} },
      "../../utils/session": { getWechatCode: async () => "test-code" },
      "../../utils/request": { request: async (options) => options.url === "/membership"
        ? { active: false, product: currentProduct }
        : { product: currentProduct, payment: { signData: JSON.stringify({ goodsPrice: changed === "signed price" ? 9900 : 100 }) } } }
    }, { requestVirtualPayment: () => { payments++; } });
    Object.assign(definition.data, { loading: false, product: { available: true, priceFen: 100, durationDays: 365 } });
    definition.openMembership();
    await definition.confirmMembershipPurchase();
    assert.equal(payments, 0);
    assert.match(definition.data.error, /重新阅读协议/);
    assert.equal(definition.data.showAgreement, false);
    assert.equal(definition.data.paying, false);
    assert.equal(definition.data.product.priceFen, currentProduct.priceFen);
    assert.equal(definition.data.product.durationDays, currentProduct.durationDays);
  });
}

test("privacy covers actual learning, media, orders, caches and provider processing without claiming anonymous data", () => {
  const { privacySections, membershipSections } = require(path.join(root, "config/service-documents.js"));
  const privacy = privacySections.map((section) => section.text).join("\n");
  for (const term of ["OpenID", "不会自动获取", "点击保存", "年龄段", "学习目标", "录音", "图片", "交易号", "缓存", "IP", "Azure", "有道", "智谱", "OpenAI", "哈希安全标识", "归档", "监护人", "注销"]) assert.ok(privacy.includes(term), term);
  const agreement = membershipSections.map((section) => section.text).join("\n");
  assert.match(agreement, /不自动续费/);
  assert.match(agreement, /不属于本次付费承诺/);
  assert.match(agreement, /到期而自动删除/);
  assert.match(agreement, /不排除法定权利/);
  assert.doesNotMatch(read("pages/membership/index.wxml"), /checkbox-group|agreementAccepted/);
  assert.match(read("pages/membership/index.wxml"), /wx:if="\{\{showAgreement\}\}"/);
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
