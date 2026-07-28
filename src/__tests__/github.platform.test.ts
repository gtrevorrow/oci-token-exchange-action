import {
  jest,
  expect,
  describe,
  test,
  beforeEach,
} from "@jest/globals";

const mockCore = {
  debug: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  getInput: jest.fn<(name: string, options?: { required?: boolean }) => string>(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  isDebug: jest.fn<() => boolean>(),
  getIDToken: jest.fn<(audience?: string) => Promise<string>>(),
};

jest.mock("@actions/core", () => mockCore);

import { GitHubPlatform } from "../platforms/github";

describe("GitHubPlatform", () => {
  let platform: GitHubPlatform;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCore.getIDToken.mockResolvedValue("mock-github-token");
    mockCore.getInput.mockReturnValue("");
    mockCore.isDebug.mockReturnValue(false);
    platform = new GitHubPlatform();
  });

  describe("getOIDCToken", () => {
    test("should request a token with the default audience when none is configured", async () => {
      await expect(platform.getOIDCToken()).resolves.toBe("mock-github-token");

      expect(mockCore.getIDToken).toHaveBeenCalledWith(
        "https://cloud.oracle.com",
      );
    });

    test("should use configured oidc_audience when options do not override it", async () => {
      platform.configure({ oidc_audience: "https://configured.example.com" });

      await expect(platform.getOIDCToken()).resolves.toBe("mock-github-token");

      expect(mockCore.getIDToken).toHaveBeenCalledWith(
        "https://configured.example.com",
      );
    });

    test("should fall back to the default audience when configured oidc_audience is blank", async () => {
      platform.configure({ oidc_audience: "   " });

      await expect(platform.getOIDCToken()).resolves.toBe("mock-github-token");

      expect(mockCore.getIDToken).toHaveBeenCalledWith(
        "https://cloud.oracle.com",
      );
    });

    test("should prefer options.audience over configured oidc_audience", async () => {
      platform.configure({ oidc_audience: "https://configured.example.com" });

      await expect(
        platform.getOIDCToken({ audience: "https://override.example.com" }),
      ).resolves.toBe("mock-github-token");

      expect(mockCore.getIDToken).toHaveBeenCalledWith(
        "https://override.example.com",
      );
    });

    test("should fall back to the default audience when options.audience is blank", async () => {
      platform.configure({ oidc_audience: "https://configured.example.com" });

      await expect(
        platform.getOIDCToken({ audience: "   " }),
      ).resolves.toBe("mock-github-token");

      expect(mockCore.getIDToken).toHaveBeenCalledWith(
        "https://cloud.oracle.com",
      );
    });

    test("should throw when GitHub Actions does not return a token", async () => {
      mockCore.getIDToken.mockResolvedValue("");

      await expect(platform.getOIDCToken()).rejects.toThrow(
        "Failed to get OIDC token from GitHub Actions",
      );
    });
  });

  describe("core passthroughs", () => {
    test("should delegate getInput to @actions/core", () => {
      mockCore.getInput.mockReturnValue("value");

      expect(platform.getInput("example", true)).toBe("value");
      expect(mockCore.getInput).toHaveBeenCalledWith("example", {
        required: true,
      });
    });

    test("should delegate setOutput to @actions/core", () => {
      platform.setOutput("configured", "true");

      expect(mockCore.setOutput).toHaveBeenCalledWith("configured", "true");
    });

    test("should delegate setFailed to @actions/core", () => {
      platform.setFailed("boom");

      expect(mockCore.setFailed).toHaveBeenCalledWith("boom");
    });

    test("should delegate isDebug to @actions/core", () => {
      mockCore.isDebug.mockReturnValue(true);

      expect(platform.isDebug()).toBe(true);
      expect(mockCore.isDebug).toHaveBeenCalled();
    });
  });
});
