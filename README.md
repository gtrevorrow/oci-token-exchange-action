# OCI Token Exchange

## Table of Contents

- [Installation](#installation)
  - [As GitHub Action](#as-github-action)
  - [As CLI Tool](#as-cli-tool)
- [Usage](#usage)
  - [GitHub Actions](#github-actions)
  - [GitLab CI](#gitlab-ci)
    - [Option 1: Building from Source](#option-1-building-from-source)
    - [Option 2: Using npm Package](#option-2-using-npm-package)
  - [Bitbucket Pipelines](#bitbucket-pipelines)
    - [Option 1: Building from Source](#option-1-building-from-source-1)
    - [Option 2: Using npm Package](#option-2-using-npm-package-1)
  - [Standalone CLI Usage](#standalone-cli-usage)
  - [Debugging](#debugging)
- [Environment Variables / Github Secrets](#environment-variables--github-secrets)
  - [Environment Variable Handling](#environment-variable-handling)
- [How it Works](#how-it-works)
- [Semantic Versioning](#semantic-versioning)
- [License](#license)
- [Contributing](#contributing)

# OCI Token Exchange

A tool to exchange OIDC tokens for [OCI session tokens](https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/clitoken.htm), supporting multiple CI/CD platforms:
- GitHub Actions
- GitLab CI
- Bitbucket Pipelines

## Installation

### As GitHub Action

To use this tool as a step in your GitHub Actions workflow, reference it using a specific Git tag, commit SHA, or branch. The following options are available, managed automatically by the release workflow:

*   **`@vX` (e.g., `@v1`) - Recommended:** Points to the latest stable release within a specific major version (e.g., the latest `v1.x.y`). This tag is automatically updated upon new releases, allowing you to receive compatible updates and bug fixes without breaking changes.
*   **`@vX.Y.Z` (e.g., `@v1.1.0`) - Specific Version:** Pins the action to an exact release version created by semantic-release. Use this if you need absolute stability and want to control updates manually.
*   **`@<full-commit-sha>` - Highest Integrity Pinning:** Pins to a single immutable commit. Use this for high-assurance production pipelines and strict supply-chain controls.
*   **`@latest` - Latest Release:** Points to the most recent release. This tag is automatically updated upon new releases by the release workflow.
*   **`@main` - Bleeding Edge (Not Recommended):** Runs the action directly from the latest commit on the `main` branch. This is unstable and should generally be avoided in production workflows.

Pinning guidance:
*   Use `@<full-commit-sha>` for regulated or high-risk production environments where no automatic movement is acceptable.
*   Use `@vX.Y.Z` when you want stable behavior with controlled, manual upgrades.
*   Use `@vX` when you want automatic non-breaking updates within a major version.

```yaml
# Recommended: Use the major version tag for automatic compatible updates
- uses: gtrevorrow/oci-token-exchange-action@v1

# Alternative: Pin to a specific version (e.g., v1.1.0)
# - uses: gtrevorrow/oci-token-exchange-action@v1.1.0 

# Highest integrity: Pin to an exact commit SHA
# - uses: gtrevorrow/oci-token-exchange-action@<full-commit-sha>

# Alternative: Use the latest release
# - uses: gtrevorrow/oci-token-exchange-action@latest
```

### As CLI Tool
```bash
npm install -g @gtrevorrow/oci-token-exchange

# Install a specific version globally (e.g., 1.2.3)
npm install -g @gtrevorrow/oci-token-exchange@1.2.3

# Install a version with a specific tag (e.g., beta)
npm install -g @gtrevorrow/oci-token-exchange@beta
```

## Usage

### GitHub Actions
```yaml
- uses: gtrevorrow/oci-token-exchange-action@v1
  with:
    # ci_platform: 'github' # Optional: Defaults to 'github'. Other values: 'gitlab', 'bitbucket', 'local' (though 'github' is typical for Actions)
    oidc_client_identifier: ${{ secrets.OIDC_CLIENT_IDENTIFIER }} 
    domain_base_url: ${{ vars.DOMAIN_BASE_URL }} 
    oci_tenancy: ${{ secrets.OCI_TENANCY }}
    oci_region: ${{ secrets.OCI_REGION }}
    # Optional: Custom base folder for OCI config (.oci) directory
    # oci_home: ${{ secrets.OCI_HOME }}
    # Optional: Name of the OCI CLI profile to create. Defaults to 'DEFAULT'.
    # oci_profile: 'DEFAULT' 
    # Optional: Number of retry attempts. Defaults to '0'.
    # retry_count: '0'
    
```

### GitLab CI

#### Option 1: Building from Source

This example clones the repository, builds the CLI, and then runs it.

```yaml
# Use these YAML anchors to setup common tasks
.oci_setup: &oci_setup |
  curl -LO https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh
  bash install.sh --accept-all-defaults
  source ~/.bashrc

.clone_build_cli: &clone_build_cli |
  git clone https://github.com/gtrevorrow/oci-token-exchange-action.git
  cd oci-token-exchange-action
  npm ci
  npm run build:cli

deploy:
  script:
    # Install OCI CLI
    - *oci_setup
    
    # Clone and build the token exchange CLI
    - *clone_build_cli
    
    # Export token from GitLab CI
    - export CI_JOB_JWT_V2="$(cat $CI_JOB_JWT_FILE)"
    
    # Run the built CLI
    - |
      cd dist &&
      PLATFORM=gitlab \
      OIDC_CLIENT_IDENTIFIER=${OIDC_CLIENT_IDENTIFIER} \
  DOMAIN_BASE_URL=${DOMAIN_BASE_URL} \
      OCI_TENANCY=${OCI_TENANCY} \
      OCI_REGION=${OCI_REGION} \
      RETRY_COUNT=3 \
      node cli.js
    
    # Verify OCI CLI configuration works
    - cd ../..
    - oci os ns get
  
  # Run only on main branch
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
  
  # Configure OIDC token for GitLab
  id_tokens:
    ID_TOKEN:
      aud: https://cloud.oracle.com/gitlab
```

#### Option 2: Using npm Package

This example installs the CLI tool directly from npm.

```yaml
# Use these YAML anchors to setup common tasks
.oci_setup: &oci_setup |
  curl -LO https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh
  bash install.sh --accept-all-defaults
  source ~/.bashrc

deploy_npm:
  script:
    # Install OCI CLI
    - *oci_setup
    
    # Install the token exchange CLI from npm
    - npm install -g @gtrevorrow/oci-token-exchange
    
    # Export token from GitLab CI
    - export CI_JOB_JWT_V2="$(cat $CI_JOB_JWT_FILE)"
    
    # Run the installed CLI
    - |
      PLATFORM=gitlab \
      OIDC_CLIENT_IDENTIFIER=${OIDC_CLIENT_IDENTIFIER} \
  DOMAIN_BASE_URL=${DOMAIN_BASE_URL} \
      OCI_TENANCY=${OCI_TENANCY} \
      OCI_REGION=${OCI_REGION} \
      RETRY_COUNT=3 \
      oci-token-exchange
    
    # Verify OCI CLI configuration works
    - oci os ns get
  
  # Run only on main branch
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
  
  # Configure OIDC token for GitLab
  id_tokens:
    ID_TOKEN:
      aud: https://cloud.oracle.com/gitlab
```

### Bitbucket Pipelines

#### Option 1: Building from Source

This example clones the repository, builds the CLI, and then runs it.

```yaml
image: node:20

pipelines:
  default:
    - step:
        name: Setup OCI CLI with OIDC Token Exchange (Build from Source)
        oidc: true  # Enable OIDC for Bitbucket
        script:
          # Setup OCI CLI
          - curl -LO https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh
          - bash install.sh --accept-all-defaults
          - export PATH=$PATH:/root/bin
          
          # Clone and build the token exchange CLI from GitHub
          - git clone https://github.com/gtrevorrow/oci-token-exchange-action.git
          - cd oci-token-exchange-action
          - npm ci
          - npm run build:cli
          
          # Run the built CLI for token exchange
          - >
            cd dist &&
            export PLATFORM=bitbucket &&
            export OIDC_CLIENT_IDENTIFIER=${OIDC_CLIENT_IDENTIFIER} &&
            export DOMAIN_BASE_URL=${DOMAIN_BASE_URL} &&
            export OCI_TENANCY=${OCI_TENANCY} &&
            export OCI_REGION=${OCI_REGION} &&
            export RETRY_COUNT=3
          - node cli.js || exit 1
          
          # Verify OCI CLI works with generated token
          - cd ../..
          - oci os ns get
        
        # Preserve credentials for subsequent steps
        artifacts:
          - ".oci/**"
          - "private_key.pem"
          - "public_key.pem"
          - "session"
```

#### Option 2: Using npm Package

This example installs the CLI tool directly from npm.

```yaml
image: node:20

pipelines:
  default:
    - step:
        name: Setup OCI CLI with OIDC Token Exchange (npm Package)
        oidc: true  # Enable OIDC for Bitbucket
        script:
          # Setup OCI CLI
          - curl -LO https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh
          - bash install.sh --accept-all-defaults
          - export PATH=$PATH:/root/bin
          
          # Install the token exchange CLI from npm
          - npm install -g @gtrevorrow/oci-token-exchange
          
          # Run the installed CLI for token exchange
          - >
            export PLATFORM=bitbucket &&
            export OIDC_CLIENT_IDENTIFIER=${OIDC_CLIENT_IDENTIFIER} &&
            export DOMAIN_BASE_URL=${DOMAIN_BASE_URL} &&
            export OCI_TENANCY=${OCI_TENANCY} &&
            export OCI_REGION=${OCI_REGION} &&
            export RETRY_COUNT=3
          - oci-token-exchange || exit 1
          
          # Verify OCI CLI works with generated token
          - oci os ns get
        
        # Preserve credentials for subsequent steps
        artifacts:
          - ".oci/**"
          - "private_key.pem"
          - "public_key.pem"
          - "session"
```

### Standalone CLI Usage
```bash
# Install globally
npm install -g @gtrevorrow/oci-token-exchange

# Run with required environment variables
export LOCAL_OIDC_TOKEN="your.jwt.token"
# Optional: set custom OCI config home
export OCI_HOME="/custom/home"
# Optional: set custom OCI CLI profile name (defaults to 'DEFAULT')
export OCI_PROFILE="myprofile"
PLATFORM=local \
OIDC_CLIENT_IDENTIFIER=your-client-identifier \
DOMAIN_BASE_URL=https://your-domain.identity.oraclecloud.com \
OCI_TENANCY=your-tenancy-ocid \
OCI_REGION=your-region \
oci-token-exchange

# Use the configured OCI CLI
oci os ns get
```

### Debugging

**GitHub Actions**

- Add a repository or environment secret named `ACTIONS_STEP_DEBUG` with the value `true`, then reference it in the workflow (`env: ACTIONS_STEP_DEBUG: ${{ secrets.ACTIONS_STEP_DEBUG }}`). This enables the built-in debug channel that the action checks via `core.isDebug()`.
- Optional: set `ACTIONS_RUNNER_DEBUG` to `true` (also via secret) when you need runner-level tracing.

**CLI / other runners**

Set the `DEBUG` environment variable to `true` before invoking the tool:

```bash
export DEBUG=true
```

This produces verbose logs (requests/responses, file paths, etc.) to simplify troubleshooting.

## Environment Variables / Github Secrets 

The action supports flexible environment variable naming to make it easier to use across different platforms:

| Variable | Alternate Names | Description | Required |
|----------|----------------|-------------|----------|
| `OIDC_CLIENT_IDENTIFIER` | `INPUT_OIDC_CLIENT_IDENTIFIER` | The `client_id:client_secret` string for your confidential OAuth client application. This string is the content used for HTTP Basic Authentication (prior to Base64 encoding), as typically used with the OAuth 2.0 client credentials grant type. The action/tool handles the Base64 encoding. This client application must be registered in the OCI IAM domain and listed in the `oauthClients` attribute of your Identity Propagation Trust policy. This identifies the application making the token exchange request. The client credential derived from this identifier is used to validate the client performing the token exchange. It's important to understand that this is not analogous to a static, long-lived API key; you cannot authenticate and authorize calls to OCI APIs using these client credentials directly. Instead, it serves as an additional layer of protection (in addition to the impersonation rules defined in the trust policy) to ensure that only authorized clients can perform a token exchange. This is especially relevant in contexts like GitHub Actions, where all repositories share a single OCI OIDC provider that signs the tokens it issues with the same private key (i.e., the signing key is not unique per repository or workflow). GitHub Action input: `oidc_client_identifier`. CLI env var: `OIDC_CLIENT_IDENTIFIER`. | Yes |
| `DOMAIN_BASE_URL` | `INPUT_DOMAIN_BASE_URL` | Base URL of OCI Identity Domain. GitHub Action input: `domain_base_url`. CLI env var: `DOMAIN_BASE_URL`. | Yes |
| `OCI_TENANCY` | `INPUT_OCI_TENANCY` | OCI tenancy OCID. GitHub Action input: `oci_tenancy`. CLI env var: `OCI_TENANCY`. | Yes |
| `OCI_REGION` | `INPUT_OCI_REGION` | OCI region identifier. GitHub Action input: `oci_region`. CLI env var: `OCI_REGION`. | Yes |
| `PLATFORM` | `INPUT_CI_PLATFORM` | CI platform. The action resolves `ci_platform` first, then falls back to `PLATFORM`. Use `ci_platform` in GitHub Actions and `PLATFORM` for CLI/non-GitHub runners (`github`, `gitlab`, `bitbucket`, or `local`). | No (default: `github`) |
| `RETRY_COUNT` | `INPUT_RETRY_COUNT` | Number of retry attempts. GitHub Action input: `retry_count`. CLI env var: `RETRY_COUNT`. | No (default: `0`) |
| `LOCAL_OIDC_TOKEN` | - | OIDC token when using `PLATFORM=local` (CLI only). | Yes, when platform=local |
| `CI_JOB_JWT_V2` | - | GitLab CI JWT token (used when `PLATFORM=gitlab` for CLI). | Yes, when platform=gitlab |
| `BITBUCKET_STEP_OIDC_TOKEN` | - | Bitbucket OIDC token (used when `PLATFORM=bitbucket` for CLI). | Yes, when platform=bitbucket |
| `DEBUG` | - | Enable debug output (CLI env var). | No (default: `false`) |

For GitHub Actions, prefer the `ci_platform` input. For GitLab, Bitbucket, and local CLI usage, set `PLATFORM` together with the platform-specific token environment variable.
| `OCI_HOME` | `INPUT_OCI_HOME` | Base folder for OCI config (.oci) directory. GitHub Action input: `oci_home`. CLI env var: `OCI_HOME`. | No |
| `OCI_PROFILE` | `INPUT_OCI_PROFILE` | Name of the OCI CLI profile to create. Defaults to 'DEFAULT'. | No |

### Environment Variable Handling

Variables can be provided in two ways:

1. **GitHub Actions Format**: Variables in the format `INPUT_VARIABLE_NAME` (used by GitHub Actions)
2. **Standard Format**: Plain environment variables matching the exact names listed above

The GitHub Action automatically maps variables from GitHub's format to the standard format, but if you're using the CLI directly, use the variable names exactly as shown above.

## How it Works

1. Generates an RSA key pair 
2. Requests a GitHub OIDC JWT token
3. Exchanges the JWT for an OCI UPST token
4. Configures the OCI CLI with the obtained credentials

## Semantic Versioning

This project uses [semantic-release](https://github.com/semantic-release/semantic-release) for automated versioning and publishing.  
**For details on the build and release process, see [CONTRIBUTING.md](./CONTRIBUTING.md).**

## License

This action is licensed under the [Universal Permissive License v1.0 (UPL-1.0)](LICENSE.txt).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
