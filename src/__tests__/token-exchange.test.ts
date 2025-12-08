import { jest, expect, describe, it, test, beforeEach, beforeAll, afterAll } from "@jest/globals";
import axios from "axios";
import {
  TokenExchangeConfig,
  TokenExchangeError,
  tokenExchangeJwtToUpst,
} from "../main";
import * as crypto from "crypto";
import { MockPlatform } from "./test-utils";

// Mock axios
jest.mock("axios");

// Use jest.Mocked for axios to get correct typings
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("tokenExchangeJwtToUpst", () => {
  let mockPlatform: MockPlatform;
  let testConfig: TokenExchangeConfig;
  let setTimeoutSpy: jest.SpiedFunction<typeof global.setTimeout>;

  beforeAll(() => {
    // Mock delay by immediately invoking the callback and returning a dummy Timeout
    setTimeoutSpy = jest
      .spyOn(global, "setTimeout")
      .mockImplementation((callback: () => void) => {
        callback();
        return {} as unknown as NodeJS.Timeout;
      });
  });

  afterAll(() => {
    setTimeoutSpy.mockRestore();
  });

  beforeEach(() => {
    mockPlatform = new MockPlatform();

    // Generate a public key for testing
    const { publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs1", format: "pem" },
    });

    // Export the public key as base64 for the test
    const publicKeyDer = crypto
      .createPublicKey(publicKey)
      .export({
        type: "spki",
        format: "der",
      })
      .toString("base64");

    testConfig = {
      tokenExchangeURL: "https://test.oracle.com/oauth2/v1/token",
      clientCred: "dGVzdC1jbGllbnQtaWQ=", // Base64 encoded test client ID
      ociPublicKey: publicKeyDer,
      subjectToken: "test-jwt-token",
      retryCount: 3,
    };

    // Reset axios mocks
    jest.clearAllMocks();
    mockedAxios.post.mockReset();
  });

  it("should successfully exchange JWT for UPST", async () => {
    // Setup axios mock to return a successful response
    mockedAxios.post.mockResolvedValueOnce({
      data: { token: "mocked-upst-token" },
    });

    // Call the function
    const result = await tokenExchangeJwtToUpst(mockPlatform, testConfig);

    // Verify results
    expect(result).toEqual({ token: "mocked-upst-token" });

    // Check that axios was called with the right parameters
    expect(mockedAxios.post).toHaveBeenCalledWith(
      testConfig.tokenExchangeURL,
      {
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        requested_token_type: "urn:oci:token-type:oci-upst",
        public_key: testConfig.ociPublicKey,
        subject_token: testConfig.subjectToken,
        subject_token_type: "jwt",
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${testConfig.clientCred}`,
        },
      },
    );

    // Verify log calls
    expect(mockPlatform.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Token Exchange Request Data"),
    );
    expect(mockPlatform.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Token Exchange Response"),
    );
  });

  it("should retry on failure if retries are available", async () => {
    // Setup axios mock to fail on first call then succeed
    mockedAxios.post
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        data: { token: "mocked-upst-token-after-retry" },
      });

    // Call the function
    const result = await tokenExchangeJwtToUpst(mockPlatform, testConfig);

    // Verify results
    expect(result).toEqual({ token: "mocked-upst-token-after-retry" });

    // Check that axios was called twice
    expect(mockedAxios.post).toHaveBeenCalledTimes(2);

    // Verify log warning for retry
    expect(mockPlatform.logger.warning).toHaveBeenCalledWith(
      expect.stringContaining("retrying"),
    );
  });

  const errorTestCases: [string, number, boolean, string][] = [
    [
      "should throw TokenExchangeError after exhausting retries",
      1,
      true,
      "API rate limit exceeded",
    ],
    [
      "should include the original error message in TokenExchangeError",
      0,
      false,
      "Network timeout error",
    ],
    [
      "should handle HTTP error responses correctly",
      2,
      true,
      "Unauthorized access",
    ],
  ];

  test.each(errorTestCases)(
    "%s",
    async (
      description: string,
      retryCount: number,
      shouldThrowTokenExchangeError: boolean,
      errorMessage: string,
    ) => {
      const mockError = new Error(errorMessage);
      mockedAxios.post.mockRejectedValue(mockError);

      const quickTestConfig = { ...testConfig, retryCount };

      if (shouldThrowTokenExchangeError) {
        await expect(
          tokenExchangeJwtToUpst(mockPlatform, quickTestConfig),
        ).rejects.toThrow(TokenExchangeError);
      } else {
        await expect(
          tokenExchangeJwtToUpst(mockPlatform, quickTestConfig),
        ).rejects.toThrow(errorMessage);
      }
    },
  );

  it("should handle network timeout errors by throwing the original error", async () => {
    const timeoutError = new Error("Request timeout");
    timeoutError.name = "ETIMEDOUT";
    mockedAxios.post.mockRejectedValue(timeoutError);

    const noRetryConfig = { ...testConfig, retryCount: 0 };
    await expect(
      tokenExchangeJwtToUpst(mockPlatform, noRetryConfig),
    ).rejects.toThrow("Request timeout");
  });
});
