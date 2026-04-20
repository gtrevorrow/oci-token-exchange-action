import { Platform } from "./platforms/types";
import { TokenExchangeConfig, OciConfig, TokenExchangeResponse, TokenExchangeError } from "./types";
export declare function tokenExchange(platform: Platform, { tokenExchangeURL, clientCred, ociPublicKey, subjectToken, retryCount, rpstResourceType, rpstExpiration, currentAttempt, }: TokenExchangeConfig): Promise<TokenExchangeResponse>;
export declare function configureOciCli(platform: Platform, config: OciConfig): Promise<void>;
export declare function main(): Promise<void>;
export { TokenExchangeError, TokenExchangeConfig, OciConfig };
