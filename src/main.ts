/**
 * Copyright (c) 2021, 2024 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */

import * as io from '@actions/io';
import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';
import crypto from 'crypto';
import axios from 'axios';

// Generate RSA key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

async function delay(count: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 1000 * count));
}

// Encode public key in a format teh OCI token exchange endpoint expects
function encodePublicKeyToBase64(): string {
  return publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
}

//Calc OCI Domain Authorization Server confidential token exchange app client credential 
function validateClientCredentials(clientId: string, clientSecret: string): void {
  if (clientId == null || clientSecret == null) {
    throw new Error('Client ID and Client Secret must not be null or undefined');
  }
  
  if (clientId.trim() === '' || clientSecret.trim() === '') {
    throw new Error('Client ID and Client Secret must not be empty');
  }

  if (clientId.length < 8 || clientSecret.length < 16) {
    throw new Error('Client ID must be at least 8 characters and Client Secret must be at least 16 characters');
  }

  const validPattern = /^[a-zA-Z0-9._-]+$/;
  if (!validPattern.test(clientId) || !validPattern.test(clientSecret)) {
    throw new Error('Client credentials can only contain alphanumeric characters, dots, underscores and hyphens');
  }
}

function calcClientCreds(clientId: string, clientSecret: string): string {
  validateClientCredentials(clientId, clientSecret);
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

// Calculate the fingerprint of the OCI API public key
function calcFingerprint(publicKey: crypto.KeyObject): string {
  const publicKeyData = publicKey.export({ type: 'spki', format: 'der' });
  const hash = crypto.createHash('MD5');
  hash.update(publicKeyData);
  return hash.digest('hex').replace(/(.{2})/g, '$1:').slice(0, -1);
}

// Debug print JWT token to the console
function debugPrintJWTToken(token: string) {
  if (core.isDebug()) {
    const tokenParts = token.split('.');
    core.debug(`JWT Header: ${Buffer.from(tokenParts[0], 'base64').toString('utf8')}`);
    core.debug(`JWT Payload: ${Buffer.from(tokenParts[1], 'base64').toString('utf8')}`);
  }
}

// Debug print message to the console
function debugPrint(message: string) {
  if (core.isDebug()) {
    core.debug(message);  // Replace console.debug with core.debug
  }
}

// Configure OCI CLI with the UPST token
export async function configureOciCli(privateKey: crypto.KeyObject,
  publicKey: crypto.KeyObject,
  upstToken: string,
  ociFingerprint: string,
  ociTenancy: string,
  ociRegion: string): Promise<void> {
  try {
    // Setup OCI CLI configuration on the GitHub runner
    const home: string = process.env.HOME || '';
    if (!home) {
      throw new Error('HOME environment variable is not defined');
    }
    const ociConfigDir: string = path.join(home, '.oci');
    const ociConfigFile: string = path.join(ociConfigDir, 'config');
    const ociPrivateKeyFile: string = path.join(home, 'private_key.pem');
    const ociPublicKeyFile: string = path.join(home, 'public_key.pem');
    const upstTokenFile: string = path.join(home, 'session');

    debugPrint(`OCI Config Dir: ${ociConfigDir}`);

    const ociConfig: string = `[DEFAULT]
    user='not used'
    fingerprint=${ociFingerprint}
    key_file=${ociPrivateKeyFile}
    tenancy=${ociTenancy}
    region=${ociRegion}
    security_token_file=${upstTokenFile}
    `;

    // Ensure the OCI config directory exists
    await io.mkdirP(ociConfigDir);

    if (!fs.existsSync(ociConfigDir)) {
      throw new Error('Unable to create OCI Config folder');
    }
    core.debug(`Created OCI Config folder: ${ociConfig}`);

    // Write the OCI config file
    fs.writeFileSync(ociConfigFile, ociConfig);

    // Write the private key to a file at a location refrenced in the OCI ClI config file
    fs.writeFileSync(
      ociPrivateKeyFile,
      privateKey.export({ type: 'pkcs1', format: 'pem' }) as string
    );

    // Set the appropriate permissions for the private key file
    fs.chmodSync(ociPrivateKeyFile, '600');

    fs.writeFileSync(
      ociPublicKeyFile,
      publicKey.export({ type: 'spki', format: 'pem' }) as string
    );

    // Write the UPST/ Session Token to a file
    fs.writeFileSync(upstTokenFile, upstToken);
  } catch (error) {
    core.setFailed(`Failed to configure OCI CLI: ${error}`);
    throw error;
  }
}

// Encapsulates the REST call to the OCI Domain OAuth token endpoint to exchange a GitHub OIDC ID Token for an OCI UPS token
async function tokenExchangeJwtToUpst(tokenExchangeURL: string, clientCred: string, ociPublicKey: string, subjectToken: string, retryCount: number, currentAttempt?: number): Promise<any> {
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${clientCred}`
  };
  const data = {
    'grant_type': 'urn:ietf:params:oauth:grant-type:token-exchange',
    'requested_token_type': 'urn:oci:token-type:oci-upst',
    'public_key': ociPublicKey,
    'subject_token': subjectToken,
    'subject_token_type': 'jwt'
  };
  core.debug('Token Exchange Request Data: ' + JSON.stringify(data));
  try {
    const response = await axios.post(tokenExchangeURL, data, { headers: headers });
    return response.data;
  } catch (error) {
    const attemptCounter = currentAttempt ? currentAttempt : 0;
    if (retryCount > 0 && retryCount >= attemptCounter ) {
      core.warning(`Token exchange failed, retrying ... (${retryCount - attemptCounter - 1} retries left)`);
      await delay(attemptCounter+1)
      return tokenExchangeJwtToUpst(tokenExchangeURL, clientCred, ociPublicKey, subjectToken, retryCount, attemptCounter + 1);
    } else {
      core.error('Failed to exchange JWT for UPST after multiple attempts');
      if (error instanceof Error) {
        throw new Error(`Token exchange failed: ${error.message}`);
      } else {
        throw new Error('Token exchange failed with an unknown error');
      }
    }
  }
}

  // Main function implements the control logic for the action
  export async function main(): Promise<void> {
    try {
      // Input Handling
      const oidcClientIdentifier: string = core.getInput('oidc_client_identifier', { required: true });
      const domainBaseURL: string = core.getInput('domain_base_url', { required: true });
      const ociTenancy: string = core.getInput('oci_tenancy', { required: true });
      const ociRegion: string = core.getInput('oci_region', { required: true });
      const retryCount: number = parseInt(core.getInput('retry_count', { required: false }));

      // Get github OIDC JWT token
      const idToken: string = await core.getIDToken("https://cloud.oracle.com");
      if (!idToken) {
        throw new Error('Unable to obtain OIDC token');
      }

      debugPrintJWTToken(idToken);

      // Calculate the fingerprint of the public key
      const ociFingerprint: string = calcFingerprint(publicKey);

      // Get the B64 encoded public key DER
      let publicKeyB64: string = encodePublicKeyToBase64();
      core.debug(`Public Key B64: ${publicKeyB64}`);

      //Exchange JWT to UPST
      let upstToken: UpstTokenResponse = await tokenExchangeJwtToUpst(`${domainBaseURL}/oauth2/v1/token`, Buffer.from(oidcClientIdentifier).toString('base64'), publicKeyB64, idToken, retryCount);
      core.info(`OCI issued a Session Token`);

      //Setup the OCI cli/sdk on the github runner with the UPST token
      await configureOciCli(privateKey, publicKey, upstToken.token, ociFingerprint, ociTenancy, ociRegion);
      core.info(`OCI CLI has been configured to use the session token`);

      // Error Handling
    } catch (error) {
      core.setFailed(`Action failed with error: ${error}`);
    }
  }

  if (require.main === module) {
    main();
  }

