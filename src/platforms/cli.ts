/**
 * Copyright (c) 2021, 2025 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
import {
  Platform,
  PlatformLogger,
  PlatformConfig,
  resolveInput,
} from "./types";

export class CLIPlatform implements Platform {
  private readonly _logger: PlatformLogger = {
    debug: (message: string) => {
      if (this.isDebug()) console.debug(message);
    },
    info: (message: string) => console.log(message),
    warning: (message: string) => console.warn(message),
    error: (message: string) => console.error(message),
  };

  constructor(private config: PlatformConfig) {}

  getInput(name: string, required = false): string {
    const value = resolveInput(name);
    if (required && !value) {
      throw new Error(`Input required and not supplied: ${name}`);
    }
    return value;
  }

  setOutput(name: string, value: string): void {
    console.log(`${name}=${value}`);
  }

  setFailed(message: string): void {
    console.error(message);
  }

  isDebug(): boolean {
    return process.env.DEBUG === "true";
  }

  async getOIDCToken(_audience: string): Promise<string> {
    if (this.config.tokenEnvVar) {
      const token = process.env[this.config.tokenEnvVar];
      if (!token) {
        throw new Error(
          `${this.config.tokenEnvVar} environment variable not found`,
        );
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
