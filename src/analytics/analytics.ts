/**
 * Anonymous usage counts, off unless the build is given a GoatCounter code.
 *
 * GoatCounter sets no cookies and stores no personal data, so there is no
 * consent banner to build. With no code configured nothing is loaded and
 * every call is a no-op, which is also how tests and local builds run.
 *
 * Events are named like paths, `run/start/daily`, so the dashboard groups
 * them without any setup.
 */
export interface Analytics {
  readonly enabled: boolean;
  track(event: string): void;
}

interface GoatCounter {
  count(vars: { path: string; title?: string; event?: boolean }): void;
}

declare global {
  interface Window {
    goatcounter?: GoatCounter;
  }
}

const OFF: Analytics = { enabled: false, track: () => undefined };

/** Events held while the script loads; if it never does, the rest are dropped. */
const MAX_QUEUED = 50;

/** Site codes are subdomains; anything else is refused rather than injected. */
const CODE_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function createAnalytics(code: string | undefined): Analytics {
  if (code === undefined || !CODE_PATTERN.test(code) || typeof document === 'undefined') {
    return OFF;
  }

  const queue: string[] = [];
  const send = (event: string): void => {
    window.goatcounter?.count({ path: event, title: event, event: true });
  };

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://gc.zgo.at/count.js';
  script.dataset['goatcounter'] = `https://${code}.goatcounter.com/count`;
  script.addEventListener('load', () => {
    for (const event of queue.splice(0)) send(event);
  });
  document.head.append(script);

  return {
    enabled: true,
    track(event: string): void {
      if (window.goatcounter !== undefined) send(event);
      else if (queue.length < MAX_QUEUED) queue.push(event);
    },
  };
}
