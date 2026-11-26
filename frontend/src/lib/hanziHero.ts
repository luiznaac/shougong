import { ApiError } from "../api/client.ts";

const CREDENTIALS_MESSAGE = "E-mail/usuário ou senha incorretos. Verifique e tente de novo.";
const UNAVAILABLE_MESSAGE =
  "Não foi possível falar com o HanziHero agora. Tente de novo em instantes.";

/**
 * Plain-language copy for a failed connect attempt. The backend's `400` means it
 * rejected the login; every other failure (unreachable host, changed login page)
 * is a transient or upstream problem the learner cannot act on, so its raw
 * English detail is never shown.
 */
export function connectErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 400) return CREDENTIALS_MESSAGE;
  return UNAVAILABLE_MESSAGE;
}

/**
 * Whether a sync failed because HanziHero rejected the stored session. The
 * backend maps that to a distinct `hanzihero_reconnect_required` problem code
 * (HTTP 409), which tells us to drop the learner back on the connect step.
 */
export function isSessionExpired(error: unknown): boolean {
  return error instanceof ApiError && error.code === "hanzihero_reconnect_required";
}

/**
 * Plain-language copy for a sync failure that is not an expired session. The raw
 * upstream detail stays hidden; every such failure reads as a transient outage
 * the learner can retry.
 */
export const SYNC_UNAVAILABLE_MESSAGE = UNAVAILABLE_MESSAGE;
