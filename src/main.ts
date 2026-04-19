/**
 * Copyright (c) 2021, 2025 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
import * as fs from "fs/promises";
import * as path from "path";
import os from "os";
import crypto from "crypto";
import axios from "axios";
import { Platform, PlatformConfig } from "./platforms/types";
import { GitHubPlatform } from "./platforms/github";
import { CLIPlatform } from "./platforms/cli";
import {
  TokenExchangeConfig,
  OciConfig,
  ConfigInputs,
  UpstTokenResponse,
  TokenExchangeError,
} from "./types";
import { resolveInput } from "./platforms/types";

const CLI_PLATFORMS = new Set(["gitlab", "bitbucket", "local"]);

function resolvePlatformType(): string {
  return (
    resolveInput("ci_platform") ||
    resolveInput("platform") ||
    process.env.PLATFORM ||
    "github"
  );
}

// Create platform instance based on environment
function createPlatform(platformType: string): Platform {
  if (platformType !== "github" && !CLI_PLATFORMS.has(platformType)) {
    throw new Error(`Unsupported platform: ${platformType}`);
  }

  return platformType === "github"
    ? new GitHubPlatform()
    : new CLIPlatform({ platformType });
}

// Generate RSA key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

async function delay(count: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1000 * count));
}

// Encode public key in a format the OCI token exchange endpoint expects
function encodePublicKeyToBase64(): string {
  return publicKey.export({ type: "spki", format: "der" }).toString("base64");
}

// Calculate the fingerprint of the OCI API public key
function calcFingerprint(publicKey: crypto.KeyObject): string {
  const publicKeyData = publicKey.export({ type: "spki", format: "der" });
  const hash = crypto.createHash("MD5");
  hash.update(publicKeyData);
  return hash
    .digest("hex")
    .replace(/(.{2})/g, "$1:")
    .slice(0, -1);
}

// Function to validate URLs
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (_) {
    return false;
  }
}

type TokenSummary =
  | {
    kind: "jwt";
    length: number;
    header?: Record<string, unknown>;
    payload?: Record<string, unknown>;
    signature_present: boolean;
  }
  | {
    kind: "opaque";
    length: number;
  };

function summarizeJwtPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const safePayload: Record<string, unknown> = {
    iss: payload.iss,
    aud: payload.aud,
    exp: payload.exp,
    iat: payload.iat,
  };

  if (typeof payload.sub === "string") {
    safePayload.sub = `${payload.sub.substring(0, 10)}...`;
  }

  if (typeof payload.exp === "number") {
    safePayload.expires_at = new Date(payload.exp * 1000).toISOString();
  }

  if (typeof payload.iat === "number") {
    safePayload.issued_at = new Date(payload.iat * 1000).toISOString();
  }

  return safePayload;
}

function summarizeToken(token: string): TokenSummary {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { kind: "opaque", length: token.length };
  }

  const headerStr = Buffer.from(parts[0], "base64").toString("utf8");
  const payloadStr = Buffer.from(parts[1], "base64").toString("utf8");
  let header: Record<string, unknown> | undefined;
  let payload: Record<string, unknown> | undefined;

  try {
    header = JSON.parse(headerStr);
  } catch {
    header = undefined;
  }

  try {
    const parsedPayload = JSON.parse(payloadStr);
    if (parsedPayload && typeof parsedPayload === "object") {
      payload = summarizeJwtPayload(parsedPayload as Record<string, unknown>);
    }
  } catch {
    payload = undefined;
  }

  return {
    kind: "jwt",
    length: token.length,
    header,
    payload,
    signature_present: parts[2].length > 0,
  };
}

// Function to exchange JWT for OCI UPST token
export async function tokenExchangeJwtToUpst(
  platform: Platform,
  {
    tokenExchangeURL,
    clientCred,
    ociPublicKey,
    subjectToken,
    retryCount,
    currentAttempt = 0,
  }: TokenExchangeConfig,
): Promise<UpstTokenResponse> {
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization: `Basic ${clientCred}`,
  };

  const data = {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    requested_token_type: "urn:oci:token-type:oci-upst",
    public_key: ociPublicKey,
    subject_token: subjectToken,
    subject_token_type: "jwt",
  };
  // Debug log redacts token contents while still providing helpful metadata.
  const redactedRequest = {
    ...data,
    subject_token: summarizeToken(subjectToken),
  };
  platform.logger.debug(
    "Token Exchange Request Data (redacted): " +
    JSON.stringify(redactedRequest),
  );

  try {
    const response = await axios.post(tokenExchangeURL, data, { headers });
    const responseToken =
      response.data && typeof response.data.token === "string"
        ? summarizeToken(response.data.token)
        : undefined;
    platform.logger.debug(
      "Token Exchange Response (redacted): " +
      JSON.stringify({
        ...response.data,
        token: responseToken,
      }),
    );
    return response.data; // auto wrapped in a Promise
  } catch (error) {
    const attemptCounter = currentAttempt ? currentAttempt : 0;
    if (retryCount > 0 && attemptCounter < retryCount) {
      platform.logger.warning(
        `Token exchange failed, retrying ... (${retryCount - attemptCounter} retries left)`,
      );
      await delay(attemptCounter + 1);
      return tokenExchangeJwtToUpst(platform, {
        // Promise flattening
        tokenExchangeURL,
        clientCred,
        ociPublicKey,
        subjectToken: subjectToken,
        retryCount,
        currentAttempt: attemptCounter + 1,
      });
    } else {
      platform.logger.error(
        "Failed to exchange JWT for UPST after multiple attempts",
      );
      if (error instanceof Error) {
        throw new TokenExchangeError(
          `Token exchange failed: ${error.message}`,
          error,
        );
      } else {
        throw new TokenExchangeError(
          "Token exchange failed with an unknown error",
        );
      }
    }
  }
}

/**
 * Merge existing OCI config content by removing old profile section ( if exists )
 * and appending a new profile block.
 */
function mergeOciConfig(
  existingRaw: string,
  profileName: string,
  profileObject: Record<string, string>,
): string {
  const lines = existingRaw.split("\n");
  const filtered: string[] = [];
  let inTargetSectionToRemove = false; // True if current lines are part of a section to be removed

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("[")) {
      // This line is a section header
      if (trimmedLine === `[${profileName}]`) {
        inTargetSectionToRemove = true; // This section matches the target, so we'll skip its lines
      } else {
        inTargetSectionToRemove = false; // This is a different section, stop skipping
        filtered.push(line); // Add this (different) section header line
      }
    } else {
      // This line is not a section header (it's content or a comment or blank)
      if (!inTargetSectionToRemove) {
        // If not currently in a target section to remove, add the line,
        // but only if it's not blank (to maintain original behavior for other sections).
        if (trimmedLine !== "") {
          filtered.push(line);
        }
      }
      // If inTargetSectionToRemove is true, we do nothing (skip the line)
    }
  }

  const merged = filtered.length ? filtered.join("\n") + "\n" : "";
  const newSection =
    `[${profileName}]\n` +
    Object.entries(profileObject)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") +
    "\n";
  return merged + newSection;
}

/**
 * Write data to a file atomically and optionally set file permissions.
 * Uses a temporary file and atomic rename to prevent partial writes or corruption.
 */
async function writeAndChmod(
  filePath: string,
  data: string,
  perms?: string,
): Promise<void> {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmpPath = path.join(
    dir,
    `.${base}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );

  // Write to temp file with permissions if specified
  await fs.writeFile(tmpPath, data, {
    mode: perms ? parseInt(perms, 8) : undefined,
  });

  // Atomic rename
  await fs.rename(tmpPath, filePath);
}

export async function configureOciCli(
  platform: Platform,
  config: OciConfig,
): Promise<void> {
  try {
    // Determine home directory for OCI config
    const home = config.ociHome || os.homedir();
    if (!home) {
      throw new TokenExchangeError(
        "OCI home directory is not defined; set oci_home input or OCI_HOME",
      );
    }

    // Normalize file paths for OCI configuration
    const ociConfigDir: string = path.resolve(path.join(home, ".oci"));
    const ociConfigFile: string = path.resolve(
      path.join(ociConfigDir, "config"),
    );
    // Use the OCI CLI session layout for profile-specific key and token material.
    const profileName = config.ociProfile;
    if (!profileName) {
      throw new TokenExchangeError(
        "OCI profile is not defined; set oci_profile input or OCI_PROFILE",
      );
    }
    // Allow existing profile naming patterns while blocking path traversal and separators.
    if (
      profileName === "." ||
      profileName === ".." ||
      profileName.includes("/") ||
      profileName.includes("\\")
    ) {
      throw new TokenExchangeError(
        "Invalid oci_profile. Path separators and traversal segments are not allowed.",
      );
    }
    // Ensure required OCI parameters are provided
    if (!config.ociTenancy) {
      throw new TokenExchangeError("OCI tenancy is not defined");
    }
    if (!config.ociRegion) {
      throw new TokenExchangeError("OCI region is not defined");
    }

    const sessionsDir: string = path.resolve(
      path.join(ociConfigDir, "sessions"),
    );
    const profileDir: string = path.resolve(
      path.join(sessionsDir, profileName),
    );
    const ociPrivateKeyFile: string = path.resolve(
      path.join(profileDir, "private_key.pem"),
    );
    const ociPublicKeyFile: string = path.resolve(
      path.join(profileDir, "public_key.pem"),
    );
    const upstTokenFile: string = path.resolve(path.join(profileDir, "token"));

    platform.logger.debug(`OCI Config Dir: ${ociConfigDir}`);

    // Prepare profile object for INI
    const profileObject = {
      user: "not used",
      fingerprint: config.ociFingerprint,
      key_file: ociPrivateKeyFile,
      tenancy: config.ociTenancy,
      region: config.ociRegion,
      security_token_file: upstTokenFile,
    };

    platform.logger.debug(`Preparing OCI config for profile [${profileName}]`);

    try {
      await fs.mkdir(ociConfigDir, { recursive: true });
      await fs.mkdir(sessionsDir, { recursive: true });
      await fs.mkdir(profileDir, { recursive: true });
    } catch (error) {
      throw new TokenExchangeError("Failed to create OCI Config folder", error);
    }

    // Export and validate keys first
    const privateKeyPem = config.privateKey.export({
      type: "pkcs1",
      format: "pem",
    });
    const publicKeyPem = config.publicKey.export({
      type: "spki",
      format: "pem",
    });

    if (!privateKeyPem || typeof privateKeyPem !== "string") {
      throw new Error("Private key export failed or invalid type");
    }
    if (!publicKeyPem || typeof publicKeyPem !== "string") {
      throw new Error("Public key export failed or invalid type");
    }
    if (!config.upstToken || typeof config.upstToken !== "string") {
      throw new Error("Session token is undefined or invalid type");
    }
    if (!profileObject || typeof profileObject !== "object") {
      throw new Error("OCI config is undefined or invalid type");
    }

    platform.logger.debug("Validated all file contents before writing");
    // Build and write all files using helpers
    try {
      const existingRaw = await fs
        .readFile(ociConfigFile, "utf-8")
        .catch(() => "");
      const finalContent = mergeOciConfig(
        existingRaw,
        profileName,
        profileObject,
      );
      // Write config with secure permissions
      await writeAndChmod(ociConfigFile, finalContent, "600");
      platform.logger.debug(
        `Set permissions 600 on OCI config file ${ociConfigFile}`,
      );
      // Write keys and token
      await writeAndChmod(ociPrivateKeyFile, privateKeyPem, "600");
      await writeAndChmod(ociPublicKeyFile, publicKeyPem);
      await writeAndChmod(upstTokenFile, config.upstToken, "600");
    } catch (err) {
      throw new TokenExchangeError(
        "Failed to write OCI configuration files",
        err instanceof Error ? err : undefined,
      );
    }
  } catch (error) {
    platform.setFailed(`Failed to configure OCI CLI: ${error}`);
    throw error;
  }
}

// Update debugPrintJWTToken to properly handle different token formats
function debugPrintJWTToken(platform: Platform, token: string) {
  if (platform.isDebug()) {
    const summary = summarizeToken(token);
    if (summary.kind === "jwt") {
      platform.logger.debug(
        `JWT Token received (length: ${summary.length} characters)`,
      );
      platform.logger.debug(`JWT Header: ${JSON.stringify(summary.header)}`);
      platform.logger.debug(
        `JWT Payload (safe parts): ${JSON.stringify(summary.payload)}`,
      );
      platform.logger.debug(
        `JWT Signature present: ${summary.signature_present ? "Yes" : "No"}`,
      );
    } else {
      platform.logger.debug(
        `JWT Token received (opaque format, length: ${summary.length} characters)`,
      );
    }
  }
}

// Main function now creates a local platform instance and passes it to subfunctions
export async function main(): Promise<void> {
  const platformType = resolvePlatformType();
  if (platformType !== "github" && !CLI_PLATFORMS.has(platformType)) {
    throw new Error(`Unsupported platform: ${platformType}`);
  }
  const platform: Platform = createPlatform(platformType);
  try {
    const config = [
      "oidc_client_identifier",
      "domain_base_url",
      "oci_tenancy",
      "oci_region",
      "oidc_audience",
      "oci_home",
      "oci_profile",
      "retry_count",
    ].reduce<Partial<ConfigInputs>>(
      (accumulated, currentInput) => ({
        ...accumulated,
        [currentInput]: platform.getInput(
          currentInput,
          currentInput !== "oidc_audience" &&
            currentInput !== "oci_home" &&
            currentInput !== "oci_profile" &&
            currentInput !== "retry_count",
        ),
      }),
      {},
    ) as ConfigInputs;

    platform.configure(config);

    const retryCount = parseInt(config.retry_count || "0");
    if (isNaN(retryCount) || retryCount < 0) {
      throw new Error("retry_count must be a non-negative number");
    }

    // Validate the tokenExchangeURL
    const testUrl = `${config.domain_base_url}/oauth2/v1/token`;
    // Debug throw removed; proceed with normal execution
    if (!isValidUrl(testUrl)) {
      throw new Error("Invalid domain_base_url provided");
    }

    const idToken = await platform.getOIDCToken();
    platform.logger.debug(`Token obtained from ${platformType}`);

    debugPrintJWTToken(platform, idToken);

    // Calculate the fingerprint of the public key
    const ociFingerprint: string = calcFingerprint(publicKey);

    // Get the B64 encoded public key DER
    const publicKeyB64: string = encodePublicKeyToBase64();
    platform.logger.debug(`Public Key B64: ${publicKeyB64}`);

    //Exchange platform OIDC token for OCI UPST
    const upstToken: UpstTokenResponse = await tokenExchangeJwtToUpst(
      platform,
      {
        tokenExchangeURL: `${config.domain_base_url}/oauth2/v1/token`,
        clientCred: Buffer.from(config.oidc_client_identifier).toString(
          "base64",
        ),
        ociPublicKey: publicKeyB64,
        subjectToken: idToken,
        retryCount,
      },
    );
    platform.logger.info(`OCI issued a Session Token `);

    // Resolve OCI home and profile, falling back to environment or defaults
    const resolvedOciHome =
      config.oci_home || process.env.OCI_HOME || process.env.HOME || os.homedir();
    if (!resolvedOciHome) {
      throw new Error(
        "OCI home directory is not defined; set oci_home input or OCI_HOME/HOME",
      );
    }
    const resolvedOciProfile =
      config.oci_profile || process.env.OCI_PROFILE || "DEFAULT";
    const ociConfig: OciConfig = {
      ociHome: resolvedOciHome,
      ociProfile: resolvedOciProfile,
      privateKey,
      publicKey,
      upstToken: upstToken.token,
      ociFingerprint,
      ociTenancy: config.oci_tenancy,
      ociRegion: config.oci_region,
    };

    await configureOciCli(platform, ociConfig);
    const ociConfigDir = path.resolve(path.join(resolvedOciHome, ".oci"));
    const sessionsDir = path.resolve(path.join(ociConfigDir, "sessions"));
    const profileDir = path.resolve(
      path.join(sessionsDir, resolvedOciProfile),
    );
    platform.logger.info(
      `OCI CLI has been configured to use the session token`,
    );

    platform.setOutput(
      "oci_config_path",
      path.resolve(path.join(ociConfigDir, "config")),
    );
    platform.setOutput(
      "oci_session_token_path",
      path.resolve(path.join(profileDir, "token")),
    );
    platform.setOutput(
      "oci_private_key_path",
      path.resolve(path.join(profileDir, "private_key.pem")),
    );
    // Add success output
    platform.setOutput("configured", "true");

    // Error Handling
  } catch (error) {
    if (error instanceof TokenExchangeError) {
      platform.setFailed(`Token exchange failed: ${error.message}`);
      if (error.cause) {
        platform.logger.debug(`Cause: ${error.cause}`);
      }
    } else {
      platform.setFailed(
        `Action failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
    throw error;
  }
}

if (require.main === module) {
  main();
}

// Re-export the types for convenience
export { TokenExchangeError, TokenExchangeConfig, OciConfig };
