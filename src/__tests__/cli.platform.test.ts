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

  beforeEach(() => {
    // Reset environment before each test
    process.env = {};

    mockConfig = {
      audience: "test-audience",
      tokenEnvVar: "TEST_TOKEN_VAR",
    };

    platform = new CLIPlatform(mockConfig);
  });

  afterEach(() => {
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
    test("should return token from configured environment variable", async () => {
      process.env.TEST_TOKEN_VAR = "test-token-value";
      const token = await platform.getOIDCToken(mockConfig.audience);
      expect(token).toBe("test-token-value");
    });

    test("should throw error when token environment variable is not set", async () => {
      await expect(platform.getOIDCToken("test-audience")).rejects.toThrow(
        "TEST_TOKEN_VAR environment variable not found",
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
