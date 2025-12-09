import { Platform } from "./platforms/types";
import { TokenExchangeConfig, OciConfig, UpstTokenResponse, TokenExchangeError } from "./types";
export declare function tokenExchangeJwtToUpst(platform: Platform, { tokenExchangeURL, clientCred, ociPublicKey, subjectToken, retryCount, currentAttempt, }: TokenExchangeConfig): Promise<UpstTokenResponse>;
export declare function configureOciCli(platform: Platform, config: OciConfig): Promise<void>;
export declare function main(): Promise<void>;
export { TokenExchangeError, TokenExchangeConfig, OciConfig };
