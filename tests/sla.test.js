import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, businessMinutesBetween, calendarMinutesBetween, evaluateTickets, buildSummary } from "../src/sla.js";

const config = {
  utcOffsetMinutes: 0,
  businessHours: { "0": null, "1": { start: "09:00", end: "17:00" }, "2": { start: "09:00", end: "17:00" }, "3": { start: "09:00", end: "17:00" }, "4": { start: "09:00", end: "17:00" }, "5": { start: "09:00", end: "17:00" }, "6": null },
  holidays: ["2026-01-01"],
  targets: { urgent: { firstResponse: 60, resolution: 480 }, high: { firstResponse: 120, resolution: 960 } }
};

test("same day span inside business hours counts fully", () => {
  assert.equal(businessMinutesBetween("2026-01-05T09:30:00Z", "2026-01-05T10:30:00Z", config), 60);
});

test("time outside business hours is not counted", () => {
  assert.equal(businessMinutesBetween("2026-01-05T07:00:00Z", "2026-01-05T10:00:00Z", config), 60);
});

test("weekend skipping: friday afternoon to monday morning", () => {
  // Friday 2026-01-02 16:00 to 17:00 is 60, weekend is skipped, Monday 09:00 to 10:00 is 60.
  assert.equal(businessMinutesBetween("2026-01-02T16:00:00Z", "2026-01-05T10:00:00Z", config), 120);
});

test("holiday skipping: new year day does not count", () => {
  // 2026-01-01 is a holiday. Wednesday 2025-12-31 16:00 to 17:00 is 60, Friday 2026-01-02 09:00 to 10:00 is 60.
  assert.equal(businessMinutesBetween("2025-12-31T16:00:00Z", "2026-01-02T10:00:00Z", config), 120);
});

test("overnight span counts the end of one day and the start of the next", () => {
  assert.equal(businessMinutesBetween("2026-01-05T16:30:00Z", "2026-01-06T09:30:00Z", config), 60);
});

test("calendar minutes count everything, including nights and weekends", () => {
  assert.equal(calendarMinutesBetween("2026-01-02T16:00:00Z", "2026-01-05T10:00:00Z"), 3960);
});

test("empty end timestamp returns null business minutes", () => {
  assert.equal(businessMinutesBetween("2026-01-05T09:00:00Z", "", config), null);
});

test("utc offset shifts the business window", () => {
  const shifted = { ...config, utcOffsetMinutes: 120 };
  // 07:30 UTC is 09:30 in a UTC+2 config, so 07:30 to 08:30 UTC is fully inside 09:00 to 17:00 local.
  assert.equal(businessMinutesBetween("2026-01-05T07:30:00Z", "2026-01-05T08:30:00Z", shifted), 60);
  assert.equal(businessMinutesBetween("2026-01-05T07:30:00Z", "2026-01-05T08:30:00Z", config), 0);
});

test("parseCsv handles quoted fields with commas", () => {
  const rows = parseCsv('id,team\n1,"support, tier 2"\n');
  assert.equal(rows[0].team, "support, tier 2");
});

test("evaluateTickets flags breaches and leaves empty replies unevaluated", () => {
  const rows = evaluateTickets([
    { id: "1", created_at: "2026-01-05T09:00:00Z", first_reply_at: "2026-01-05T12:00:00Z", resolved_at: "", priority: "urgent", team: "support" },
    { id: "2", created_at: "2026-01-05T09:00:00Z", first_reply_at: "", resolved_at: "", priority: "urgent", team: "support" }
  ], config);
  assert.equal(rows[0].first_response_business_minutes, 180);
  assert.equal(rows[0].first_response_breach, "true");
  assert.equal(rows[1].first_response_breach, "");
});

test("summary reports breach counts by priority and by team", () => {
  const rows = evaluateTickets([
    { id: "1", created_at: "2026-01-05T09:00:00Z", first_reply_at: "2026-01-05T12:00:00Z", resolved_at: "2026-01-05T16:00:00Z", priority: "urgent", team: "support" }
  ], config);
  const summary = buildSummary(rows);
  assert.ok(summary.includes("By priority"));
  assert.ok(summary.includes("By team"));
  assert.ok(summary.includes("First response breaches: 1"));
});
