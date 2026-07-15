import { performRefresh } from "@/auth/refresh";
import { secureStorage } from "@/auth/secureStore";

jest.mock("@/auth/secureStore", () => ({
  secureStorage: {
    getRefreshToken: jest.fn(),
    setRefreshToken: jest.fn(),
    clear: jest.fn(),
  },
}));

const mockedStore = secureStorage as jest.Mocked<typeof secureStorage>;

function fakeClient(response: unknown) {
  return { post: jest.fn().mockResolvedValue({ data: response }) } as any;
}

describe("performRefresh", () => {
  beforeEach(() => jest.clearAllMocks());

  it("throws when there is no stored refresh token", async () => {
    mockedStore.getRefreshToken.mockResolvedValue(null);
    await expect(performRefresh(fakeClient({}))).rejects.toThrow(
      "No stored refresh token"
    );
  });

  it("sends the stored token in the body and returns the new access token", async () => {
    mockedStore.getRefreshToken.mockResolvedValue("old-refresh");
    const client = fakeClient({ access: "new-access" });
    const result = await performRefresh(client);
    expect(client.post).toHaveBeenCalledWith("users/refresh/", {
      refresh: "old-refresh",
    });
    expect(result.access).toBe("new-access");
  });

  it("persists a rotated refresh token when the server returns one", async () => {
    mockedStore.getRefreshToken.mockResolvedValue("old-refresh");
    const client = fakeClient({ access: "new-access", refresh: "rotated" });
    const result = await performRefresh(client);
    expect(mockedStore.setRefreshToken).toHaveBeenCalledWith("rotated");
    expect(result.refresh).toBe("rotated");
  });
});
