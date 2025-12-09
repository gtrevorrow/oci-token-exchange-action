/**
 * Copyright (c) 2021, 2025 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
export interface PlatformLogger {
    debug(message: string): void;
    info(message: string): void;
    warning(message: string): void;
    error(message: string): void;
}
export interface Platform {
    getInput(name: string, required?: boolean): string;
    setOutput(name: string, value: string): void;
    setFailed(message: string): void;
    isDebug(): boolean;
    logger: PlatformLogger;
    getOIDCToken(audience: string): Promise<string>;
}
export interface PlatformConfig {
    tokenEnvVar?: string;
    audience: string;
}
/**
 * Resolve an input name from various environment variable conventions.
 */
export declare function resolveInput(name: string): string;
