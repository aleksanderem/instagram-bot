import { describe, expect, it } from "vitest";
import { findAccountByAnyId } from "./db.js";

const account = (instagramId: string, igUserId: string | null) => ({
  instagram_id: instagramId,
  ig_user_id: igUserId,
  username: "dobrze_eu",
  encrypted_access_token: "x",
  created_at: "2026-09-14T00:00:00.000Z",
  updated_at: "2026-09-14T00:00:00.000Z"
});

describe("findAccountByAnyId", () => {
  const accounts = { "28223724180619255": account("28223724180619255", "17841464783600697") };

  it("finds the account by the id it is stored under", () => {
    expect(findAccountByAnyId(accounts, "28223724180619255")?.username).toBe("dobrze_eu");
  });

  it("finds the account by the Instagram user id used in webhooks", () => {
    expect(findAccountByAnyId(accounts, "17841464783600697")?.username).toBe("dobrze_eu");
  });

  it("returns nothing for an unknown id", () => {
    expect(findAccountByAnyId(accounts, "404")).toBeUndefined();
  });
});
