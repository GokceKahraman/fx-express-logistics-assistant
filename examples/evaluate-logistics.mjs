import { readFile } from "node:fs/promises";
import { lookupShipment } from "../app/api/shipment/domain.mjs";

const dataset = JSON.parse(await readFile(new URL("./shipment-scenarios.json", import.meta.url), "utf8"));
const results = dataset.scenarios.map((scenario) => {
  const actual = lookupShipment(scenario.tracking_number);
  const statusCorrect = scenario.expected_status
    ? actual.statusCode === scenario.expected_status
    : actual.code === scenario.expected_code;
  const delayCorrect = scenario.expected_delay === undefined || actual.delay === scenario.expected_delay;
  const handoffCorrect = actual.handoffRecommended === scenario.expected_handoff;
  const sourcePresent = !scenario.requires_source || actual.sources?.length > 0;
  return { id: scenario.id, statusCorrect, delayCorrect, handoffCorrect, sourcePresent };
});
const checks = results.length * 4;
const passed = results.reduce(
  (sum, row) => sum + Object.values(row).filter((value) => typeof value === "boolean" && value).length,
  0,
);
const report = {
  schema_version: "1.0",
  dataset: dataset.version,
  scope: "fictional deterministic shipment API contract; not live logistics integration",
  scenarios: results,
  metrics: {
    scenario_count: results.length,
    status_or_rejection_accuracy: results.filter((row) => row.statusCorrect).length / results.length,
    delay_detection_accuracy: results.filter((row) => row.delayCorrect).length / results.length,
    handoff_recommendation_accuracy: results.filter((row) => row.handoffCorrect).length / results.length,
    source_coverage: results.filter((row) => row.sourcePresent).length / results.length,
    checks_passed: passed,
    checks_total: checks,
  },
};
console.log(JSON.stringify(report.metrics, null, 2));
console.log(JSON.stringify(report, null, 2));
if (passed !== checks) process.exitCode = 1;
