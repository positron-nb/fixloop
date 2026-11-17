/** Scheduled (hourly, Amazon EventBridge) SLA sweep. */
import { getService, log } from './runtime';

export const handler = async () => {
  try {
    const svc = await getService();
    return await svc.sweep();
  } catch (e) {
    log.error('sla sweep failed', { error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
};
