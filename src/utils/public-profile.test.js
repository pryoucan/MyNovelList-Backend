import test from "node:test";
import assert from "node:assert/strict";
import { presentPublicUser } from "./public-profile.js";

test("public profile omits account and contact fields", () => {
  const createdAt = new Date("2026-01-01T00:00:00Z");
  const user = {
    id: "private-id",
    username: "Reader",
    role: "USER",
    avatarKey: "private-key",
    createdAt,
    email: "reader@example.com",
    phoneNumber: "+10000000000",
    password: "secret-hash",
    isEmailVerified: true,
  };

  assert.deepEqual(presentPublicUser(user, "signed-avatar-url"), {
    username: "Reader",
    role: "USER",
    avatar: "signed-avatar-url",
    createdAt,
  });
});
