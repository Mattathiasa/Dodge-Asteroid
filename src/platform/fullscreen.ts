/**
 * Fullscreen, with the WebKit-prefixed fallback iOS still needs.
 *
 * On a phone this is what reclaims the browser chrome for the play field, so
 * it is offered wherever the platform actually supports it rather than being
 * assumed present.
 */
interface WebkitDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
}

interface WebkitElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
}

export function isFullscreenSupported(element: HTMLElement): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as WebkitDocument;
  const el = element as WebkitElement;
  return (
    (document.fullscreenEnabled || doc.webkitFullscreenElement !== undefined) &&
    (typeof element.requestFullscreen === 'function' ||
      typeof el.webkitRequestFullscreen === 'function')
  );
}

export function isFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as WebkitDocument;
  return (document.fullscreenElement ?? doc.webkitFullscreenElement ?? null) !== null;
}

/** Enters or leaves fullscreen. Rejections are swallowed: the user can decline. */
export async function toggleFullscreen(element: HTMLElement): Promise<void> {
  const doc = document as WebkitDocument;
  const el = element as WebkitElement;
  try {
    if (isFullscreen()) {
      if (typeof document.exitFullscreen === 'function') await document.exitFullscreen();
      else if (doc.webkitExitFullscreen !== undefined) await doc.webkitExitFullscreen();
      return;
    }
    if (typeof element.requestFullscreen === 'function') await element.requestFullscreen();
    else if (el.webkitRequestFullscreen !== undefined) await el.webkitRequestFullscreen();
  } catch {
    // Declined, or disallowed outside a user gesture.
  }
}
