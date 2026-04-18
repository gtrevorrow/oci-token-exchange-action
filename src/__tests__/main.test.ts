import {
  jest,
  expect,
  describe,
  it,
  test,
  beforeEach,
  afterEach,
} from "@jest/globals";
import * as fs from "fs/promises";
import * as crypto from "crypto";
import os from "os";
import { configureOciCli, OciConfig } from "../main";
import { MockPlatform } from "./test-utils";

jest.mock("fs/promises", () => {
  const mockFs = {
    writeFile: jest.fn<() => Promise<void>>(),
    readFile: jest.fn<() => Promise<string>>(),
    access: jest.fn<() => Promise<void>>(),
    mkdir: jest.fn<() => Promise<void>>(),
    chmod: jest.fn<() => Promise<void>>(),
    rename: jest.fn<() => Promise<void>>(),
  };

  // Set up return values with proper typing
  mockFs.writeFile.mockResolvedValue(undefined);
  mockFs.readFile.mockRejectedValue(new Error("File not found"));
  mockFs.access.mockResolvedValue(undefined);
  mockFs.mkdir.mockResolvedValue(undefined);
  mockFs.chmod.mockResolvedValue(undefined);
  mockFs.rename.mockResolvedValue(undefined);

  return mockFs;
});

jest.mock("path", () => {
  // Normalize path joins in tests so expectations remain OS-agnostic
  const actualPath = jest.requireActual<typeof import("path")>("path");
  return {
    dirname: actualPath.dirname,
    basename: actualPath.basename,
    resolve: jest.fn().mockImplementation((...parts) => parts.join("/")),
    join: jest.fn().mockImplementation((...parts) => parts.join("/")),
  };
});

describe("main.ts", () => {
  let mockPlatform: MockPlatform;
  let testConfig: OciConfig;
  let testKeyPair: crypto.KeyPairSyncResult<string, string>;
  let originalHome: string | undefined;

  beforeEach(() => {
    mockPlatform = new MockPlatform();

    // Generate actual RSA keys for testing
    testKeyPair = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs1", format: "pem" },
    });

    // Create proper RSA keys that will work with pkcs1 format
    testConfig = {
      privateKey: crypto.createPrivateKey(testKeyPair.privateKey),
      publicKey: crypto.createPublicKey(testKeyPair.publicKey),
      upstToken: "test-token",
      ociFingerprint: "test-fingerprint",
      ociTenancy: "test-tenancy",
      ociRegion: "test-region",
      ociHome: "/mock/home",
      ociProfile: "DEFAULT",
    };

    originalHome = process.env.HOME;
    process.env.HOME = "/mock/home";
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    if (typeof originalHome === "string") {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
  });

  describe("configureOciCli", () => {
    it("should create OCI configuration successfully", async () => {
      await configureOciCli(mockPlatform, testConfig);

      expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining(".oci"), {
        recursive: true,
      });
      // configureOciCli writes config, key, session, and public key artifacts
      expect(fs.writeFile).toHaveBeenCalledTimes(4);
      expect(fs.chmod).not.toHaveBeenCalled();
    });

    const errorTestCases: [string, () => void, string][] = [
      [
        "should throw error if OCI home is undefined and homedir cannot be resolved",
        () => {
          // Simulate missing resolved OCI home
          delete testConfig.ociHome;
          jest.spyOn(os, "homedir").mockReturnValue("");
        },
        "OCI home directory is not defined",
      ],
      [
        "should handle directory creation failure",
        () => {
          (
            fs.mkdir as jest.MockedFunction<typeof fs.mkdir>
          ).mockRejectedValueOnce(new Error("Permission denied"));
        },
        "Failed to create OCI Config folder",
      ],
      [
        "should handle file write errors",
        () => {
          (
            fs.writeFile as jest.MockedFunction<typeof fs.writeFile>
          ).mockRejectedValueOnce(new Error("Write failed"));
        },
        "Failed to write OCI configuration files",
      ],
    ];

    test.each(errorTestCases)(
      "%s",
      async (description: string, setup: () => void, expectedError: string) => {
        setup();
        await expect(configureOciCli(mockPlatform, testConfig)).rejects.toThrow(
          expectedError,
        );
      },
    );

    it("should fallback to os.homedir when OCI home input is empty", async () => {
      testConfig.ociHome = "";
      jest.spyOn(os, "homedir").mockReturnValue("/os/home");

      await configureOciCli(mockPlatform, testConfig);

      expect(os.homedir).toHaveBeenCalled();
    });

    it("should reject oci_profile with path separators", async () => {
      testConfig.ociProfile = "../bad-profile";

      await expect(configureOciCli(mockPlatform, testConfig)).rejects.toThrow(
        "Invalid oci_profile",
      );
    });

    it("should allow compatible oci_profile names with spaces and dots", async () => {
      testConfig.ociProfile = "Team Prod.1";

      await expect(
        configureOciCli(mockPlatform, testConfig),
      ).resolves.toBeUndefined();
    });

    it("should write correct OCI config content", async () => {
      await configureOciCli(mockPlatform, testConfig);

      const writeCalls = (
        fs.writeFile as jest.MockedFunction<typeof fs.writeFile>
      ).mock.calls;
      const configCall = writeCalls.find((call) =>
        String(call[0]).includes("/.config.tmp"),
      );

      expect(configCall).toBeDefined();
      const content = configCall![1] as string;

      expect(content).toContain("[DEFAULT]");
      expect(content).toContain("fingerprint=test-fingerprint");
      expect(content).toContain("tenancy=test-tenancy");
      expect(content).toContain("region=test-region");
      expect(content).toContain("private_key.pem");
      expect(content).toContain("session");
    });

    const profileTestCases: [string, string | undefined][] = [
      [
        "should create custom profile with full content when specified",
        "CUSTOM",
      ],
      [
        "should create DEFAULT profile with full content when not specified",
        undefined,
      ],
    ];

    test.each(profileTestCases)(
      "%s",
      async (description: string, profile: string | undefined) => {
        const expectedProfileName = profile || "DEFAULT";
        if (profile) {
          testConfig.ociProfile = profile;
        }

        await configureOciCli(mockPlatform, testConfig);

        const writeCalls = (
          fs.writeFile as jest.MockedFunction<typeof fs.writeFile>
        ).mock.calls;
        const configCall = writeCalls.find((call) =>
          String(call[0]).includes("/.config.tmp"),
        );
        const content = configCall![1] as string;

        // Split config into profiles based on headers like [PROFILE_NAME]
        const profiles = content.trim().split(/\n(?=\[)/);
        const targetProfile = profiles.find((p) =>
          p.startsWith(`[${expectedProfileName}]`),
        );

        expect(targetProfile).toBeDefined();

        // Check each key-value pair within the target profile block
        expect(targetProfile).toContain(`fingerprint=test-fingerprint`);
        expect(targetProfile).toContain(`tenancy=test-tenancy`);
        expect(targetProfile).toContain(`region=test-region`);
        expect(targetProfile).toContain(
          `key_file=/mock/home/.oci/${expectedProfileName}/private_key.pem`,
        );
        expect(targetProfile).toContain(
          `security_token_file=/mock/home/.oci/${expectedProfileName}/session`,
        );
      },
    );

    it("should create profile-specific directories and files", async () => {
      testConfig.ociProfile = "TESTPROF";
      await configureOciCli(mockPlatform, testConfig);

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining("/TESTPROF"),
        { recursive: true },
      );

      const renameCalls = (
        fs.rename as jest.MockedFunction<typeof fs.rename>
      ).mock.calls;
      expect(
        renameCalls.some((call) =>
          String(call[1]).endsWith("TESTPROF/private_key.pem"),
        ),
      ).toBe(true);
      expect(
        renameCalls.some((call) =>
          String(call[1]).endsWith("TESTPROF/session"),
        ),
      ).toBe(true);
    });

    it("should create config with custom profile when none exists", async () => {
      testConfig.ociProfile = "CUSTOM";

      await configureOciCli(mockPlatform, testConfig);

      const writeCalls = (
        fs.writeFile as jest.MockedFunction<typeof fs.writeFile>
      ).mock.calls;
      const configCall = writeCalls.find((call) =>
        String(call[0]).includes("/.config.tmp"),
      );
      const content = configCall![1] as string;

      expect(content).toContain("[CUSTOM]");
      expect(content).toContain("fingerprint=test-fingerprint");
      expect(content).toContain("tenancy=test-tenancy");
      expect(content).toContain("region=test-region");
    });

    it("should append new custom profile to existing config", async () => {
      // Mock existing config file content
      (fs.readFile as jest.MockedFunction<typeof fs.readFile>)
        .mockResolvedValueOnce(`
[DEFAULT]
user=ocid1.user.oc1..existing
fingerprint=existing:fingerprint
tenancy=ocid1.tenancy.oc1..existing
region=us-phoenix-1
key_file=/home/user/.oci/DEFAULT/private_key.pem
session_token_file=/home/user/.oci/DEFAULT/session

`);

      testConfig.ociProfile = "NEWPROFILE";

      await configureOciCli(mockPlatform, testConfig);

      const writeCalls = (
        fs.writeFile as jest.MockedFunction<typeof fs.writeFile>
      ).mock.calls;
      const configCall = writeCalls.find((call) =>
        String(call[0]).includes("/.config.tmp"),
      );
      const content = configCall![1] as string;

      // Should contain both profiles
      expect(content).toContain("[DEFAULT]");
      expect(content).toContain("user=ocid1.user.oc1..existing");
      expect(content).toContain("[NEWPROFILE]");
      expect(content).toContain("fingerprint=test-fingerprint");
      expect(content).toContain("tenancy=test-tenancy");
      expect(content).toContain("region=test-region");
    });

    it("should replace existing profile section", async () => {
      // Mock existing config with the same profile we're going to create
      (fs.readFile as jest.MockedFunction<typeof fs.readFile>)
        .mockResolvedValueOnce(`
[DEFAULT]
user=ocid1.user.oc1..olddefault
fingerprint=old:fingerprint
tenancy=ocid1.tenancy.oc1..old
region=us-ashburn-1
key_file=/home/user/.oci/DEFAULT/old_private_key.pem
session_token_file=/home/user/.oci/DEFAULT/old_session

[OTHER]
user=ocid1.user.oc1..other
fingerprint=other:fingerprint
tenancy=ocid1.tenancy.oc1..other
region=us-phoenix-1

`);

      // Use DEFAULT profile (same as existing)
      testConfig.ociProfile = "DEFAULT";

      await configureOciCli(mockPlatform, testConfig);

      const writeCalls = (
        fs.writeFile as jest.MockedFunction<typeof fs.writeFile>
      ).mock.calls;
      const configCall = writeCalls.find((call) =>
        String(call[0]).includes("/.config.tmp"),
      );
      const content = configCall![1] as string;

      // Should contain updated DEFAULT and preserve OTHER
      expect(content).toContain("[DEFAULT]");
      expect(content).toContain("fingerprint=test-fingerprint"); // Updated
      expect(content).toContain("tenancy=test-tenancy"); // Updated
      expect(content).toContain("region=test-region"); // Updated
      expect(content).not.toContain("old:fingerprint"); // Old value removed
      expect(content).not.toContain("ocid1.tenancy.oc1..old"); // Old value removed

      // Should preserve OTHER profile unchanged
      expect(content).toContain("[OTHER]");
      expect(content).toContain("user=ocid1.user.oc1..other");
      expect(content).toContain("other:fingerprint");
    });
  });
});
