import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client.ts";
import { connectErrorMessage } from "./hanziHero.ts";

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
