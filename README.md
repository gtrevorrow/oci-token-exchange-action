# OCI Token Exchange

## Table of Contents

- [Installation](#installation)
  - [As GitHub Action](#as-github-action)
  - [As CLI Tool](#as-cli-tool)
- [Usage](#usage)
  - [Inputs And Outputs](#inputs-and-outputs)
  - [GitHub Actions](#github-actions)
  - [GitLab CI](#gitlab-ci)
    - [Option 1: Building from Source](#option-1-building-from-source)
    - [Option 2: Using npm Package](#option-2-using-npm-package)
  - [Bitbucket Pipelines](#bitbucket-pipelines)
    - [Option 1: Building from Source](#option-1-building-from-source-1)
    - [Option 2: Using npm Package](#option-2-using-npm-package-1)
  - [Standalone CLI Usage](#standalone-cli-usage)
  - [Debugging](#debugging)
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

### Inputs and Outputs

Use this section as the source of truth for:
- GitHub Action `with:` inputs
- Their mapped `INPUT_*` names and CLI environment variable names
- Platform-specific token variables for GitLab, Bitbucket, and local CLI usage
- Debug-related environment variables
- Action outputs

### Inputs

| Action Input | CLI / Env Var | GitHub `INPUT_*` Var | Required | Default | Notes |
|-------------|---------------|----------------------|----------|---------|-------|
| `ci_platform` | `PLATFORM` | `INPUT_CI_PLATFORM` | No | `github` | Supported values: `github`, `gitlab`, `bitbucket`, `local`. For GitHub Actions, `ci_platform` is the canonical input. For non-GitHub usage, `PLATFORM` remains the backward-compatible alias. |
| `oidc_client_identifier` | `OIDC_CLIENT_IDENTIFIER` | `INPUT_OIDC_CLIENT_IDENTIFIER` | Yes | - | OCI IAM confidential client in `client_id:client_secret` form. |
| `domain_base_url` | `DOMAIN_BASE_URL` | `INPUT_DOMAIN_BASE_URL` | Yes | - | OCI Identity Domain base URL, for example `https://idcs-xxxxxxxxxxxx.identity.oraclecloud.com`. |
| `oci_tenancy` | `OCI_TENANCY` | `INPUT_OCI_TENANCY` | Yes | - | OCI tenancy OCID. |
| `oci_region` | `OCI_REGION` | `INPUT_OCI_REGION` | Yes | - | OCI region identifier, for example `us-ashburn-1`. |
| `oci_home` | `OCI_HOME` | `INPUT_OCI_HOME` | No | `OCI_HOME`, then `HOME`, then OS home directory | Base folder where the tool creates the `.oci` directory. |
| `oci_profile` | `OCI_PROFILE` | `INPUT_OCI_PROFILE` | No | `DEFAULT` | OCI CLI profile name to create or update. |
| `retry_count` | `RETRY_COUNT` | `INPUT_RETRY_COUNT` | No | `0` | Number of retry attempts for token exchange failures. |

### Platform Token Variables

| Platform | Variable | Required When | Notes |
|----------|----------|---------------|-------|
| GitHub Actions | GitHub runtime OIDC token | `ci_platform=github` | No manual token env var is required; the action requests the token from the GitHub runtime. |
| GitLab CI | `CI_JOB_JWT_V2` | `PLATFORM=gitlab` | In the examples below, map your `id_tokens` value into `CI_JOB_JWT_V2` before invoking the CLI. |
| Bitbucket Pipelines | `BITBUCKET_STEP_OIDC_TOKEN` | `PLATFORM=bitbucket` | Provided by Bitbucket when `oidc: true` is enabled for the step. |
| Local / standalone CLI | `LOCAL_OIDC_TOKEN` | `PLATFORM=local` | Provide your own OIDC token for local testing or custom runners. |

### Outputs

| Output | Description |
|--------|-------------|
| `configured` | Set to `true` when configuration completes successfully. |
| `oci_config_path` | Absolute path to the generated OCI config file. |
| `oci_session_token_path` | Absolute path to the generated OCI session token file. |
| `oci_private_key_path` | Absolute path to the generated private key file. |

### Debug Variables

| Context | Variable | Notes |
|---------|----------|-------|
| GitHub Actions | `ACTIONS_STEP_DEBUG` | Enables the built-in debug channel used by the action runtime. |
| GitHub Actions | `ACTIONS_RUNNER_DEBUG` | Optional runner-level tracing. |
| CLI / other runners | `DEBUG` | Set to `true` to enable verbose CLI logging. |

### Variable Resolution

The tool accepts values in this order:
1. GitHub Action input name such as `ci_platform`
2. GitHub-style environment variable such as `INPUT_CI_PLATFORM`
3. Plain environment variable such as `PLATFORM`, `OCI_HOME`, or `RETRY_COUNT`
4. Input-specific fallbacks such as `HOME` or the OS home directory for `oci_home`

### GitHub Actions

Use the example below together with the [Inputs and Outputs](#inputs-and-outputs) reference above.

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

This example builds the CLI from the checked-out repository and then runs it.
It is written to reflect typical GitLab Docker-runner usage. If you use a shell
runner instead, the host must already provide `node`, `npm`, `python3`, and
`python3 -m venv`.

See [Inputs and Outputs](#inputs-and-outputs) for the full environment variable contract and required GitLab token mapping.

```yaml
image: node:20

.oci_setup: &oci_setup |
  python3 -m venv .oci-cli
  . .oci-cli/bin/activate
  python -m pip install --upgrade pip
  pip install oci-cli

variables:
  HUSKY: "0"

deploy:
  script:
    # Install OCI CLI
    - *oci_setup
    
    # Build the token exchange CLI from the checked-out commit
    - npm ci
    - npm run build:cli
    
    # Map the GitLab ID token to the variable the CLI expects
    - export CI_JOB_JWT_V2="$ID_TOKEN"
    
    # Run the built CLI
    - |
      PLATFORM=gitlab \
      OIDC_CLIENT_IDENTIFIER=${OIDC_CLIENT_IDENTIFIER} \
      DOMAIN_BASE_URL=${DOMAIN_BASE_URL} \
      OCI_TENANCY=${OCI_TENANCY} \
      OCI_REGION=${OCI_REGION} \
      OCI_HOME=${CI_PROJECT_DIR} \
      OCI_PROFILE=${OCI_PROFILE:-DEFAULT} \
      RETRY_COUNT=${RETRY_COUNT:-3} \
      node dist/cli.js
    
    # Verify OCI CLI configuration works
    - oci --auth security_token --config-file "$CI_PROJECT_DIR/.oci/config" --profile "${OCI_PROFILE:-DEFAULT}" os ns get
  
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
  
  id_tokens:
    ID_TOKEN:
      aud: https://cloud.oracle.com/gitlab
```

#### Option 2: Using npm Package

This example installs the CLI tool directly from npm.

```yaml
image: node:20

.oci_setup: &oci_setup |
  python3 -m venv .oci-cli
  . .oci-cli/bin/activate
  python -m pip install --upgrade pip
  pip install oci-cli

variables:
  HUSKY: "0"

deploy_npm:
  script:
    # Install OCI CLI
    - *oci_setup
    
    # Install the token exchange CLI from npm
    - npm install -g @gtrevorrow/oci-token-exchange
    
    # Map the GitLab ID token to the variable the CLI expects
    - export CI_JOB_JWT_V2="$ID_TOKEN"
    
    # Run the installed CLI
    - |
      PLATFORM=gitlab \
      OIDC_CLIENT_IDENTIFIER=${OIDC_CLIENT_IDENTIFIER} \
      DOMAIN_BASE_URL=${DOMAIN_BASE_URL} \
      OCI_TENANCY=${OCI_TENANCY} \
      OCI_REGION=${OCI_REGION} \
      OCI_HOME=${CI_PROJECT_DIR} \
      OCI_PROFILE=${OCI_PROFILE:-DEFAULT} \
      RETRY_COUNT=${RETRY_COUNT:-3} \
      oci-token-exchange
    
    # Verify OCI CLI configuration works
    - oci --auth security_token --config-file "$CI_PROJECT_DIR/.oci/config" --profile "${OCI_PROFILE:-DEFAULT}" os ns get
  
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
  
  id_tokens:
    ID_TOKEN:
      aud: https://cloud.oracle.com/gitlab
```

### Bitbucket Pipelines

#### Option 1: Building from Source

This example clones the repository, builds the CLI, and then runs it.

See [Inputs and Outputs](#inputs-and-outputs) for the full environment variable contract and Bitbucket OIDC token requirement.

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

See [Inputs and Outputs](#inputs-and-outputs) for the complete CLI environment variable reference.

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
