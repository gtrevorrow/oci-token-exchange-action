import {
  jest,
  expect,
  describe,
  test,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { CLIPlatform } from "../platforms/cli";
import { PlatformConfig } from "../platforms/types";

describe("CLIPlatform", () => {
  let mockConfig: PlatformConfig;
  let platform: CLIPlatform;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    if (!originalEnv) {
      originalEnv = process.env;
    }
    // Reset environment while preserving original values for other suites
    process.env = { ...originalEnv };

    mockConfig = {
      platformType: "local",
    };

    platform = new CLIPlatform(mockConfig);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetAllMocks();
  });

  describe("getInput", () => {
    test("should integrate with resolveInput and handle required parameter validation", () => {
      // Test basic integration with resolveInput (covered in types.test.ts)
      process.env.TEST_INPUT = "test-value";
      expect(platform.getInput("test_input")).toBe("test-value");

      // Test CLIPlatform-specific required parameter handling
      expect(platform.getInput("non_existing")).toBe("");
      expect(() => platform.getInput("required_input", true)).toThrow(
        "Input required and not supplied: required_input",
      );
      expect(() => platform.getInput("oci_home", true)).toThrow(
        "Input required and not supplied: oci_home",
      );
    });
  });

  describe("getOIDCToken", () => {
    test("should read the local platform token from LOCAL_OIDC_TOKEN", async () => {
      process.env.LOCAL_OIDC_TOKEN = "test-token-value";
      const token = await platform.getOIDCToken();
      expect(token).toBe("test-token-value");
    });

    test("should read the GitLab platform token from CI_JOB_JWT_V2", async () => {
      const gitlabPlatform = new CLIPlatform({
        platformType: "gitlab",
      });
      process.env.CI_JOB_JWT_V2 = "gitlab-token";

      await expect(gitlabPlatform.getOIDCToken()).resolves.toBe("gitlab-token");
    });

    test("should read the Bitbucket platform token from BITBUCKET_STEP_OIDC_TOKEN", async () => {
      const bitbucketPlatform = new CLIPlatform({
        platformType: "bitbucket",
      });
      process.env.BITBUCKET_STEP_OIDC_TOKEN = "bitbucket-token";

      await expect(bitbucketPlatform.getOIDCToken()).resolves.toBe(
        "bitbucket-token",
      );
    });

    test("should throw when the local platform token environment variable is not set", async () => {
      await expect(platform.getOIDCToken()).rejects.toThrow(
        "LOCAL_OIDC_TOKEN environment variable not found",
      );
    });
  });

  describe("isDebug", () => {
    test("should return true when DEBUG=true", () => {
      process.env.DEBUG = "true";
      expect(platform.isDebug()).toBe(true);
    });

    test("should return false when DEBUG is not set", () => {
      expect(platform.isDebug()).toBe(false);
    });

    test("should return false when DEBUG has any other value", () => {
      process.env.DEBUG = "yes";
      expect(platform.isDebug()).toBe(false);
    });
  });
});
