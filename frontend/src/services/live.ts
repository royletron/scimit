import { RequestLog } from '../types/scim';

// One shared EventSource for every subscriber (requests table, nav pulse, directory refresh).
type Listener = (log: RequestLog) => void;
const listeners = new Set<Listener>();
let source: EventSource | null = null;

export function subscribeLive(listener: Listener) {
  listeners.add(listener);
  if (!source) {
    source = new EventSource('/api/logs/stream'); // reconnects on its own if the server restarts
    source.onmessage = (e) => {
      const log = JSON.parse(e.data) as RequestLog;
      listeners.forEach((l) => l(log));
    };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      source?.close();
      source = null;
    }
  };
}
