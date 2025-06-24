/**
 * Copyright (c) 2021, 2025 Oracle and/or its affiliates.
 * Licensed under the Universal Permissive License v1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
import crypto from "crypto";
/**
 * Configuration for token exchange operation
 */
export interface TokenExchangeConfig {
    /**
     * URL of the token exchange endpoint
     */
    tokenExchangeURL: string;
    /**
     * Base64-encoded client credentials
     */
    clientCred: string;
    /**
     * Base64-encoded DER format of the OCI public key
     */
    ociPublicKey: string;
    /**
     * JWT token to be exchanged
     */
    subjectToken: string;
    /**
     * Number of retry attempts for token exchange
     */
    retryCount: number;
    /**
     * Current attempt number (used internally for retries)
     */
    currentAttempt?: number;
}
/**
 * Configuration for the OCI CLI setup
 */
export interface OciConfig {
    /**
     * Custom home directory for OCI config. Defaults to $HOME if not set.
     */
    ociHome?: string;
    /**
     * Profile name header for OCI config. Defaults to 'DEFAULT'.
     */
    ociProfile?: string;
    /**
     * Private key used for OCI authentication
     */
    privateKey: crypto.KeyObject;
    /**
     * Public key used for OCI authentication
     */
    publicKey: crypto.KeyObject;
    /**
     * User principal security token obtained from token exchange
     */
    upstToken: string;
    /**
     * Fingerprint of the public key
     */
    ociFingerprint: string;
    /**
     * OCI tenancy OCID
     */
    ociTenancy: string;
    /**
     * OCI region identifier
     */
    ociRegion: string;
}
/**
 * Input configuration for the CLI/Action
 */
export interface ConfigInputs {
    oidc_client_identifier: string;
    domain_base_url: string;
    oci_tenancy: string;
    oci_region: string;
    /**
     * Base folder for OCI config (.oci) directory. Defaults to $HOME.
     */
    oci_home?: string;
    /**
     * Name of the OCI CLI profile to create. Defaults to 'DEFAULT'.
     */
    oci_profile?: string;
    /**
     * Number of retry attempts for token exchange. Defaults to 0.
     */
    retry_count?: string;
}
/**
 * Response from token exchange operation
 */
export interface UpstTokenResponse {
    /**
     * The exchanged UPST token
     */
    token: string;
}
/**
 * Custom error class for token exchange errors
 */
export declare class TokenExchangeError extends Error {
    readonly cause?: unknown | undefined;
    /**
     * Creates a new TokenExchangeError
     * @param message Error message
     * @param cause Underlying cause of the error
     */
    constructor(message: string, cause?: unknown | undefined);
}
