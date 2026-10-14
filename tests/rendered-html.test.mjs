import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("renders the FX Express chatbot", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>FX Express/);
  assert.match(html, /Dijital Asistan/);
  assert.match(html, /AWS Bedrock/);
  assert.doesNotMatch(html, /DHL/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("includes the complete AI cargo journey", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Ücret Hesapla & Gönder/);
  assert.match(page, /Adresten Alım/);
  assert.match(page, /Kargom Nerede\?/);
  assert.match(page, /Akıllı Soru-Cevap/);
  assert.match(page, /3000/);
  assert.match(page, /destinationDistrict/);
  assert.match(page, /api\/chat/);
  assert.match(page, /TRACKING_NUMBER_REGEX/);
});

test("shipment API returns cited demo delay and rejects unknown numbers", async () => {
  const delayed = await render("/api/shipment?trackingNumber=1000000002");
  assert.equal(delayed.status, 200);
  const record = await delayed.json();
  assert.equal(record.statusCode, "DELAY_WEATHER");
  assert.equal(record.handoffRecommended, true);
  assert.ok(record.sources.length > 0);

  const missing = await render("/api/shipment?trackingNumber=1000000099");
  assert.equal(missing.status, 404);

  const malformed = await render("/api/shipment?trackingNumber=FX-123");
  assert.equal(malformed.status, 400);
});
