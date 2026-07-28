/**
 * Copyright (c) 2021, 2025 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
import type { ConfigInputs } from "../types";

export interface PlatformLogger {
  debug(message: string): void;
  info(message: string): void;
  warning(message: string): void;
  error(message: string): void;
}

export interface OIDCTokenOptions {
  [key: string]: unknown;
}

export interface Platform {
  getInput(name: string, required?: boolean): string;
  setOutput(name: string, value: string): void;
  setFailed(message: string): void;
  isDebug(): boolean;
  logger: PlatformLogger;
  configure(config: Partial<ConfigInputs>): void;
  getOIDCToken(options?: OIDCTokenOptions): Promise<string>;
}

export interface PlatformConfig {
  platformType?: string;
}

/**
 * Resolve an input name from various environment variable conventions.
 */
export function resolveInput(name: string): string {
  return (
    process.env[name.toUpperCase()] ||
    process.env[`INPUT_${name.toUpperCase()}`] ||
    process.env[`OCI_${name.toUpperCase()}`] ||
    process.env[`OIDC_${name.toUpperCase()}`] ||
    ""
  );
}
