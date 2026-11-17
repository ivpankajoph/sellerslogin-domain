import assert from "node:assert/strict";
import test from "node:test";
import { boundedSearchSignal, domainSearchRank, isCurrentDomainSearch, isSuggestionCheckFailed, isVerifiedAvailable, shouldStartDomainSearch } from "./domain-search-state.ts";

test("same submitted query cannot restart while pending", () => {
  assert.equal(shouldStartDomainSearch("example", true, "example"), false);
  assert.equal(shouldStartDomainSearch("example", false, "example"), true);
  assert.equal(shouldStartDomainSearch("example", true, "different"), true);
});

test("stale or aborted responses cannot update the current search", () => {
  assert.equal(isCurrentDomainSearch(4, 3, false), false);
  assert.equal(isCurrentDomainSearch(4, 4, true), false);
  assert.equal(isCurrentDomainSearch(4, 4, false), true);
});

test("exact result keeps top rank independently of suggestion status", () => {
  assert.ok(domainSearchRank({ status: "NOTAVAILABLE", liveVerified: true, badges: ["EXACT_MATCH"] })
    < domainSearchRank({ status: "AVAILABLE", liveVerified: true }));
});

test("unknown suggestion responses remain failed after frontend merge mapping", () => {
  assert.equal(isSuggestionCheckFailed({ liveVerified: false, checkFailed: false }), true);
  assert.equal(isSuggestionCheckFailed({ liveVerified: true, checkFailed: false }), false);
});

test("recommended alternative eligibility requires live verified availability", () => {
  assert.equal(isVerifiedAvailable({ status: "AVAILABLE", liveVerified: true }), true);
  assert.equal(isVerifiedAvailable({ status: "AVAILABLE", liveVerified: false }), false);
  assert.equal(isVerifiedAvailable({ status: "NOTAVAILABLE", liveVerified: true }), false);
});

test("preview and live request signals have a bounded timeout", async () => {
  const controller = new AbortController();
  const signal = boundedSearchSignal(controller.signal, 5);
  await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
  assert.equal(signal.aborted, true);
});
