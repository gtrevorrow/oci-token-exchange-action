import { Platform, PlatformLogger } from "./types";
export declare class GitHubPlatform implements Platform {
    private readonly _logger;
    getInput(name: string, required?: boolean): string;
    setOutput(name: string, value: string): void;
    setFailed(message: string): void;
    isDebug(): boolean;
    getOIDCToken(audience: string): Promise<string>;
    get logger(): PlatformLogger;
}
