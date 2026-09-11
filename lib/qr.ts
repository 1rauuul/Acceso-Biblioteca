import { VALID_QR_TOKENS } from "./constants";

/**
 * Validates a decoded QR code string to ensure it is an official
 * access code for this library.
 *
 * Accepts:
 * 1. Predefined access tokens (e.g. "BIBLIOTECA_ACCESO", "ACCESO_BIBLIOTECA").
 * 2. URLs originating from the same host/app (e.g. window.location.origin, localhost, domain).
 * 3. URLs containing an access query parameter (e.g. "?access=biblioteca" or "?action=entry").
 */
export function isValidLibraryQr(rawCode: string | null | undefined): boolean {
  if (!rawCode) return false;
  const trimmed = rawCode.trim();
  if (!trimmed) return false;

  const upper = trimmed.toUpperCase();

  // Check known token strings
  for (const token of VALID_QR_TOKENS) {
    if (upper === token || upper.includes(token)) {
      return true;
    }
  }

  // Check if it is a valid URL matching this installation
  try {
    const parsedUrl = new URL(trimmed);

    // If running in browser, compare hostname or origin
    if (typeof window !== "undefined") {
      const currentHost = window.location.hostname.toLowerCase();
      const scannedHost = parsedUrl.hostname.toLowerCase();

      // Allow exact host match or localhost/127.0.0.1 in dev
      if (
        scannedHost === currentHost ||
        (currentHost === "localhost" && scannedHost === "127.0.0.1") ||
        (currentHost === "127.0.0.1" && scannedHost === "localhost")
      ) {
        return true;
      }
    }

    // Check URL parameters for access intent
    const action = parsedUrl.searchParams.get("action");
    const access = parsedUrl.searchParams.get("access");
    if (action === "entry" || access === "biblioteca" || access === "library") {
      return true;
    }

    // Check pathname containing /entrada or /acceso
    if (
      parsedUrl.pathname.endsWith("/entrada") ||
      parsedUrl.pathname.endsWith("/acceso")
    ) {
      return true;
    }
  } catch {
    // Not a URL
  }

  return false;
}
