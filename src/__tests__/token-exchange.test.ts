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

  it("should successfully exchange JWT for RPST when res_type is configured", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { token: "mocked-rpst-token" },
    });

    const rpstConfig = {
      ...testConfig,
      rpstResourceType: "ref_github",
    };

    const result = await tokenExchangeJwtToUpst(mockPlatform, rpstConfig);

    expect(result).toEqual({ token: "mocked-rpst-token" });
    expect(mockedAxios.post).toHaveBeenCalledWith(
      testConfig.tokenExchangeURL,
      {
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        requested_token_type: "urn:oci:token-type:oci-rpst",
        public_key: testConfig.ociPublicKey,
        subject_token: testConfig.subjectToken,
        subject_token_type: "jwt",
        res_type: "ref_github",
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${testConfig.clientCred}`,
        },
      },
    );
  });

  it("should include rpst_exp when configured for RPST", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { token: "mocked-rpst-token" },
    });

    await tokenExchangeJwtToUpst(mockPlatform, {
      ...testConfig,
      rpstResourceType: "ref_github",
      rpstExpiration: "60",
    });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      testConfig.tokenExchangeURL,
      expect.objectContaining({
        requested_token_type: "urn:oci:token-type:oci-rpst",
        res_type: "ref_github",
        rpst_exp: "60",
      }),
      expect.any(Object),
    );
  });

  it("should require res_type when rpst_exp is configured", async () => {
    await expect(
      tokenExchangeJwtToUpst(mockPlatform, {
        ...testConfig,
        rpstExpiration: "60",
      }),
    ).rejects.toThrow("RPST token exchange requires res_type");
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("should reject a non-integer RPST expiration", async () => {
    await expect(
      tokenExchangeJwtToUpst(mockPlatform, {
        ...testConfig,
        rpstResourceType: "ref_github",
        rpstExpiration: "one hour",
      }),
    ).rejects.toThrow("rpst_exp must be a positive integer number of minutes");
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("should redact tokens in debug logs", async () => {
    const jwtHeader = Buffer.from(
      JSON.stringify({ alg: "RS256", typ: "JWT" }),
    ).toString("base64");
    const jwtPayload = Buffer.from(
      JSON.stringify({
        iss: "https://issuer.example.com",
        aud: "https://cloud.oracle.com",
        exp: 1700000000,
        iat: 1699990000,
        sub: "user@example.com",
      }),
    ).toString("base64");
    const jwtToken = `${jwtHeader}.${jwtPayload}.signature`;

    testConfig.subjectToken = jwtToken;

    mockedAxios.post.mockResolvedValueOnce({
      data: { token: jwtToken },
    });

    await tokenExchangeJwtToUpst(mockPlatform, testConfig);

    const debugCalls = (mockPlatform.logger.debug as jest.Mock).mock.calls.map(
      (call) => String(call[0]),
    );

    const requestLog = debugCalls.find((message) =>
      message.includes("Token Exchange Request Data (redacted)"),
    );
    expect(requestLog).toBeDefined();
    expect(requestLog).not.toContain(jwtToken);

    const requestPayloadJson = requestLog?.split(": ").slice(1).join(": ");
    const requestPayload = JSON.parse(requestPayloadJson || "{}");
    expect(requestPayload.subject_token.kind).toBe("jwt");
    expect(requestPayload.subject_token.signature_present).toBe(true);
    expect(requestPayload.subject_token.length).toBe(jwtToken.length);

    const responseLog = debugCalls.find((message) =>
      message.includes("Token Exchange Response (redacted)"),
    );
    expect(responseLog).toBeDefined();
    expect(responseLog).not.toContain(jwtToken);
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
