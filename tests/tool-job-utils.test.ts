import test from "node:test";
import assert from "node:assert/strict";
import { buildToolJobMeta, getToolJobMeta, isTerminalJobStatus, shouldRetryJob } from "../lib/tool-job-utils.ts";

test("tool job meta has defaults", () => {
  const meta = getToolJobMeta({});
  assert.equal(typeof meta.attemptCount, "number");
  assert.equal(typeof meta.maxAttempts, "number");
});

test("buildToolJobMeta preserves attempts", () => {
  const meta = buildToolJobMeta({ attemptCount: 2, maxAttempts: 4 });
  assert.equal(meta.attemptCount, 2);
  assert.equal(meta.maxAttempts, 4);
});

test("terminal statuses are recognized", () => {
  assert.equal(isTerminalJobStatus("SUCCEEDED"), true);
  assert.equal(isTerminalJobStatus("FAILED"), true);
  assert.equal(isTerminalJobStatus("RUNNING"), false);
});

test("retry policy ignores hard failures", () => {
  assert.equal(shouldRetryJob({ attemptCount: 1, maxAttempts: 3, errorMessage: "FILE_NOT_FOUND" }), false);
  assert.equal(shouldRetryJob({ attemptCount: 1, maxAttempts: 3, errorMessage: "PROVIDER_TIMEOUT" }), true);
});
