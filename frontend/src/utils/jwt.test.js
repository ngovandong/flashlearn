import { resolveAuthUser } from "./jwt";

describe("resolveAuthUser", () => {
  test("returns explicit user payload when present", () => {
    const user = { id: "1", name: "Ada" };
    expect(resolveAuthUser({ access: "token", user })).toEqual(user);
  });

  test("returns null when payload has no user and no access token", () => {
    expect(resolveAuthUser({})).toBeNull();
  });
});
