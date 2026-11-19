import test from "node:test";
import assert from "node:assert/strict";
import { sellersLoginErrorMessage } from "./domain-api.ts";

test("replaces technical service errors with simple vendor copy", () => {
  const fallback = "This request could not be completed. Please try again.";
  assert.equal(sellersLoginErrorMessage("HTTP 500 DomainNameAPI upstream exception", fallback), fallback);
  assert.equal(sellersLoginErrorMessage("MongoDB connection timed out", fallback), fallback);
});

test("uses clear action-specific messages for known errors", () => {
  assert.equal(
    sellersLoginErrorMessage("ignored", "fallback", "INSUFFICIENT_DOMAIN_CREDITS"),
    "You do not have enough credits for this action. Add credits and try again.",
  );
});

test("keeps short non-technical guidance", () => {
  assert.equal(
    sellersLoginErrorMessage("Enter at least two nameservers and try again.", "fallback"),
    "Enter at least two nameservers and try again.",
  );
});
