import { FreshOnShow } from "./fresh-on-show";

/** In a tab page: refreshes it in the background when it showed from the router's cache (ADR 0075). */
export function FreshPage() {
  // eslint-disable-next-line react-hooks/purity -- a server render, once per request
  return <FreshOnShow at={Date.now()} />;
}
