import type { ConfigInputs } from "../types";
import { OIDCTokenOptions, Platform, PlatformLogger } from "./types";
export declare class GitHubPlatform implements Platform {
    private oidcAudience?;
    private readonly _logger;
    getInput(name: string, required?: boolean): string;
    setOutput(name: string, value: string): void;
    setFailed(message: string): void;
    isDebug(): boolean;
    configure(config: Partial<ConfigInputs>): void;
    getOIDCToken(options?: OIDCTokenOptions): Promise<string>;
    get logger(): PlatformLogger;
}
