"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIPlatform = void 0;
class CLIPlatform {
    constructor(config) {
        this.config = config;
        this._logger = {
            debug: (message) => console.debug(message),
            info: (message) => console.log(message),
            warning: (message) => console.warn(message),
            error: (message) => console.error(message)
        };
    }
    getInput(name, required = false) {
        // First check for GitHub Actions style input variable
        const inputValue = process.env[`INPUT_${name.toUpperCase()}`];
        // Then check for direct environment variable (using common naming conventions)
        const directValue = process.env[name.toUpperCase()] ||
            process.env[`OCI_${name.toUpperCase()}`] ||
            process.env[`OIDC_${name.toUpperCase()}`];
        const value = inputValue || directValue || '';
        if (required && !value) {
            throw new Error(`Input required and not supplied: ${name}`);
        }
        return value;
    }
    setOutput(name, value) {
        console.log(`::set-output name=${name}::${value}`);
    }
    setFailed(message) {
        console.error(message);
        process.exit(1);
    }
    isDebug() {
        return process.env.DEBUG === 'true';
    }
    async getOIDCToken(audience) {
        if (this.config.tokenEnvVar) {
            const token = process.env[this.config.tokenEnvVar];
            if (!token) {
                throw new Error(`${this.config.tokenEnvVar} environment variable not found`);
            }
            // Do not log the token here
            return token;
        }
        throw new Error('No OIDC token configuration available');
    }
    get logger() {
        return this._logger;
    }
}
exports.CLIPlatform = CLIPlatform;
