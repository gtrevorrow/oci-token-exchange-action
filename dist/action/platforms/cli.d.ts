/**
 * Copyright (c) 2021, 2025 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
import { Platform, PlatformLogger, PlatformConfig } from "./types";
export declare class CLIPlatform implements Platform {
    private config;
    private readonly _logger;
    constructor(config: PlatformConfig);
    getInput(name: string, required?: boolean): string;
    setOutput(name: string, value: string): void;
    setFailed(message: string): void;
    isDebug(): boolean;
    getOIDCToken(_audience: string): Promise<string>;
    get logger(): PlatformLogger;
}
