#!/usr/bin/env node

import { main } from './main';

// Map environment variables to GitHub Actions input format
// This mapping provides flexibility for users to follow different naming conventions
const envVarMappings: Record<string, string> = {
  // Standard CLI env vars
  PLATFORM: 'platform',
  OIDC_CLIENT_IDENTIFIER: 'oidc_client_identifier',
  DOMAIN_BASE_URL: 'domain_base_url',
  OCI_TENANCY: 'oci_tenancy',
  OCI_REGION: 'oci_region',
  RETRY_COUNT: 'retry_count',
  
  // Support for directly providing GitHub Actions style input vars
  // This prevents needless remapping if already in correct format
  INPUT_PLATFORM: 'platform',
  INPUT_OIDC_CLIENT_IDENTIFIER: 'oidc_client_identifier',
  INPUT_DOMAIN_BASE_URL: 'domain_base_url',
  INPUT_OCI_TENANCY: 'oci_tenancy',
  INPUT_OCI_REGION: 'oci_region',
  INPUT_RETRY_COUNT: 'retry_count'
};

// Set environment variables in GitHub Actions format only if not already set
Object.entries(envVarMappings).forEach(([envVar, inputName]) => {
  const value = process.env[envVar];
  if (value && !process.env[`INPUT_${inputName.toUpperCase()}`]) {
    process.env[`INPUT_${inputName.toUpperCase()}`] = value;
  }
});

// Enable debug mode via environment variable
if (process.env.DEBUG === 'true') {
  console.log('Debug mode enabled');
  console.log('Environment variables mapped:');
  Object.entries(envVarMappings).forEach(([envVar, inputName]) => {
    if (process.env[envVar]) {
      console.log(`${envVar} → INPUT_${inputName.toUpperCase()}`);
    }
  });
}

// Run the main function
main().catch(error => {
  console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});
