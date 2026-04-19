/**
 * Copyright (c) 2021, 2025 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
import {
  OIDCTokenOptions,
  Platform,
  PlatformLogger,
  PlatformConfig,
  resolveInput,
} from "./types";

export class CLIPlatform implements Platform {
  private static readonly TOKEN_ENV_VARS: Record<string, string> = {
    gitlab: "CI_JOB_JWT_V2",
    bitbucket: "BITBUCKET_STEP_OIDC_TOKEN",
    local: "LOCAL_OIDC_TOKEN",
  };

  private readonly _logger: PlatformLogger = {
    debug: (message: string) => {
      if (this.isDebug()) console.debug(message);
    },
    info: (message: string) => console.log(message),
    warning: (message: string) => console.warn(message),
    error: (message: string) => console.error(message),
  };

  constructor(private config: PlatformConfig) {}

  private get tokenEnvVar(): string | undefined {
    return this.config.platformType
      ? CLIPlatform.TOKEN_ENV_VARS[this.config.platformType]
      : undefined;
  }

  getInput(name: string, required = false): string {
    const value = resolveInput(name);
    if (required && !value) {
      throw new Error(`Input required and not supplied: ${name}`);
    }
    return value;
  }

  setOutput(name: string, value: string): void {
    console.log(`::set-output name=${name}::${value}`);
  }

  setFailed(message: string): void {
    console.error(message);
    process.exit(1);
  }

  isDebug(): boolean {
    return process.env.DEBUG === "true";
  }

  configure(): void {}

  async getOIDCToken(_options?: OIDCTokenOptions): Promise<string> {
    const tokenEnvVar = this.tokenEnvVar;
    if (tokenEnvVar) {
      const token = process.env[tokenEnvVar];
      if (!token) {
        throw new Error(`${tokenEnvVar} environment variable not found`);
      }
      // Do not log the token here
      return token;
    }
    throw new Error("No OIDC token configuration available");
  }

  get logger(): PlatformLogger {
    return this._logger;
  }
}
