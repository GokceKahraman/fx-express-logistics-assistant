import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { lookupShipment } from "../app/api/shipment/domain.mjs";

const dataset = JSON.parse(await readFile(new URL("../examples/shipment-scenarios.json", import.meta.url), "utf8"));

test("known delay and exception records include provenance and recommend handoff", () => {
  for (const id of ["1000000002", "1000000003"]) {
    const shipment = lookupShipment(id);
    assert.equal(shipment.found, true);
    assert.equal(shipment.delay, true);
    assert.equal(shipment.handoffRecommended, true);
    assert.ok(shipment.sources.length > 0);
  }
});

test("on-time shipment is sourced and does not trigger an unnecessary handoff", () => {
  const shipment = lookupShipment("1000000001");
  assert.equal(shipment.statusCode, "IN_TRANSIT");
  assert.equal(shipment.delay, false);
  assert.equal(shipment.handoffRecommended, false);
  assert.ok(shipment.sources.length > 0);
});

test("unknown and malformed tracking numbers are rejected without inventing status", () => {
  assert.deepEqual(lookupShipment("1000000099"), {
    found: false,
    code: "NOT_FOUND",
    handoffRecommended: false,
  });
  assert.equal(lookupShipment("FX-123").code, "INVALID_TRACKING_NUMBER");
});

test("all labeled logistics scenarios meet status, exception, handoff, and source expectations", () => {
  const results = dataset.scenarios.map((scenario) => {
    const actual = lookupShipment(scenario.tracking_number);
    const responseCorrect = scenario.expected_status
      ? actual.statusCode === scenario.expected_status
      : actual.code === scenario.expected_code;
    return responseCorrect
      && (scenario.expected_delay === undefined || actual.delay === scenario.expected_delay)
      && actual.handoffRecommended === scenario.expected_handoff
      && (!scenario.requires_source || actual.sources?.length > 0);
  });
  assert.equal(results.filter(Boolean).length, dataset.scenarios.length);
});
