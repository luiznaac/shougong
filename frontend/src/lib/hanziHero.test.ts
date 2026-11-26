import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client.ts";
import { SYNC_UNAVAILABLE_MESSAGE, connectErrorMessage, isSessionExpired } from "./hanziHero.ts";

describe("isSessionExpired", () => {
  it("recognises the reconnect-required code the sync maps an expired session to", () => {
    expect(
      isSessionExpired(new ApiError(409, "session expired", "hanzihero_reconnect_required")),
    ).toBe(true);
  });

  it("does not treat another HanziHero 409 or a generic failure as an expiry", () => {
    expect(isSessionExpired(new ApiError(409, "not connected", "hanzihero_not_connected"))).toBe(
      false,
    );
    expect(isSessionExpired(new ApiError(502, "unreachable", "hanzihero_unavailable"))).toBe(false);
    expect(isSessionExpired(new Error("boom"))).toBe(false);
  });
});

describe("SYNC_UNAVAILABLE_MESSAGE", () => {
  it("names the transient outage without leaking the backend's English detail", () => {
    expect(SYNC_UNAVAILABLE_MESSAGE).toBe(
      "Não foi possível falar com o HanziHero agora. Tente de novo em instantes.",
    );
  });
});

describe("connectErrorMessage", () => {
  it("explains a rejected login when the backend reports bad credentials", () => {
    expect(connectErrorMessage(new ApiError(400, "HanziHero rejected the credentials"))).toBe(
      "E-mail/usuário ou senha incorretos. Verifique e tente de novo.",
    );
  });

  it("falls back to an unavailable message for any other failure", () => {
    expect(connectErrorMessage(new ApiError(502, "HanziHero is unreachable"))).toBe(
      "Não foi possível falar com o HanziHero agora. Tente de novo em instantes.",
    );
    expect(connectErrorMessage(new Error("boom"))).toBe(
      "Não foi possível falar com o HanziHero agora. Tente de novo em instantes.",
    );
  });
});
