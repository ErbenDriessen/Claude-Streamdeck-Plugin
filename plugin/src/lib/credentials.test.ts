import { describe, it, expect } from "vitest";
import { parseCredentials, readCredentials } from "./credentials.js";

describe("parseCredentials", () => {
  it("extracts the access token + expiry from claudeAiOauth", () => {
    const text = JSON.stringify({ claudeAiOauth: { accessToken: "abc", expiresAt: 1700, refreshToken: "ref" } });
    expect(parseCredentials(text)).toEqual({ accessToken: "abc", expiresAt: 1700, refreshToken: "ref" });
  });
  it("returns null when no access token", () => {
    expect(parseCredentials(JSON.stringify({ claudeAiOauth: {} }))).toBeNull();
  });
  it("returns null on malformed json", () => {
    expect(parseCredentials("not json")).toBeNull();
  });
});

describe("readCredentials", () => {
  it("returns null for a missing path", () => {
    expect(readCredentials("/no/such/.credentials.json")).toBeNull();
  });
});
