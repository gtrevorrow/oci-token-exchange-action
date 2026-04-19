/**
 * Copyright (c) 2021, 2025 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
import { OIDCTokenOptions, Platform, PlatformLogger, PlatformConfig } from "./types";
export declare class CLIPlatform implements Platform {
    private config;
    private static readonly TOKEN_ENV_VARS;
    private readonly _logger;
    constructor(config: PlatformConfig);
    private get tokenEnvVar();
    getInput(name: string, required?: boolean): string;
    setOutput(name: string, value: string): void;
    setFailed(message: string): void;
    isDebug(): boolean;
    configure(): void;
    getOIDCToken(_options?: OIDCTokenOptions): Promise<string>;
    get logger(): PlatformLogger;
}
