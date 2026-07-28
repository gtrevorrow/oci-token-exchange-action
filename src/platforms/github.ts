/**
 * Copyright (c) 2021, 2025 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
import * as core from "@actions/core";
import type { ConfigInputs } from "../types";
import { OIDCTokenOptions, Platform, PlatformLogger } from "./types";

const DEFAULT_OIDC_AUDIENCE = "https://cloud.oracle.com";

export class GitHubPlatform implements Platform {
  private oidcAudience?: string;

  private readonly _logger: PlatformLogger = {
    debug: (message: string) => core.debug(message),
    info: (message: string) => core.info(message),
    warning: (message: string) => core.warning(message),
    error: (message: string) => core.error(message),
  };

  getInput(name: string, required = false): string {
    return core.getInput(name, { required });
  }

  setOutput(name: string, value: string): void {
    core.setOutput(name, value);
  }

  setFailed(message: string): void {
    core.setFailed(message);
  }

  isDebug(): boolean {
    return core.isDebug();
  }

  configure(config: Partial<ConfigInputs>): void {
    this.oidcAudience =
      typeof config.oidc_audience === "string"
        ? config.oidc_audience.trim() || undefined
        : undefined;
  }

  async getOIDCToken(options?: OIDCTokenOptions): Promise<string> {
    const requestedAudience =
      typeof options?.audience === "string"
        ? options.audience.trim() || undefined
        : this.oidcAudience;
    const token = await core.getIDToken(
      requestedAudience || DEFAULT_OIDC_AUDIENCE,
    );
    if (!token) {
      throw new Error("Failed to get OIDC token from GitHub Actions");
    }
    return token;
  }

  get logger(): PlatformLogger {
    return this._logger;
  }
}
