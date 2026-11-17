export type SearchOrderItem = {
  status: string;
  liveVerified?: boolean;
  badges?: string[];
};

export function shouldStartDomainSearch(activeQuery: string | null, active: boolean, nextQuery: string) {
  return !(active && activeQuery === nextQuery);
}

export function isCurrentDomainSearch(latestSearchId: number, searchId: number, aborted: boolean) {
  return latestSearchId === searchId && !aborted;
}

export function domainSearchRank(item: SearchOrderItem) {
  if ((item.badges || []).includes("EXACT_MATCH")) return -1;
  if (item.status === "AVAILABLE" && item.liveVerified === true) return 0;
  if (item.liveVerified === true) return 1;
  if (item.status === "PREVIEW") return 2;
  return 3;
}

export function isSuggestionCheckFailed(item: { liveVerified?: boolean; checkFailed?: boolean }) {
  return item.liveVerified !== true || Boolean(item.checkFailed);
}

export function isVerifiedAvailable(item: { status?: string; liveVerified?: boolean } | undefined) {
  return item?.status === "AVAILABLE" && item.liveVerified === true;
}

export function boundedSearchSignal(parent: AbortSignal, timeoutMs: number) {
  return AbortSignal.any([parent, AbortSignal.timeout(timeoutMs)]);
}
