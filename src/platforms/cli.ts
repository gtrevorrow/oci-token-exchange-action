import { Platform, PlatformLogger, PlatformConfig } from './types';

export class CLIPlatform implements Platform {
  private readonly _logger: PlatformLogger = {
    debug: (message: string) => console.debug(message),
    info: (message: string) => console.log(message),
    warning: (message: string) => console.warn(message),
    error: (message: string) => console.error(message)
  };

  constructor(private config: PlatformConfig) {}

  getInput(name: string, required = false): string {
    const value = process.env[`INPUT_${name.toUpperCase()}`] || '';
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
    return process.env.DEBUG === 'true';
  }

  async getOIDCToken(audience: string): Promise<string> {
    if (this.config.tokenEnvVar) {
      const token = process.env[this.config.tokenEnvVar];
      if (!token) {
        throw new Error(`${this.config.tokenEnvVar} environment variable not found`);
      }
      return token;
    }
    throw new Error('No OIDC token configuration available');
  }

  get logger(): PlatformLogger {
    return this._logger;
  }
}
