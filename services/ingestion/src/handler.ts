import { syncBrandwatchWindow } from "./index";

type EventBridgeEvent = {
  agencyId?: string;
  from?: string;
  to?: string;
};

export const handler = async (event: EventBridgeEvent = {}) => {
  const now = new Date();
  const to = event.to ?? now.toISOString();
  const from = event.from ?? new Date(now.getTime() - 5 * 60 * 1000).toISOString();

  return syncBrandwatchWindow({
    agencyId: event.agencyId ?? "pr-central",
    from,
    to
  });
};
