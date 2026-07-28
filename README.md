# OCI Token Exchange

## Table of Contents

- [Installation](#installation)
  - [As GitHub Action](#as-github-action)
  - [As CLI Tool](#as-cli-tool)
- [Migrating from v1 to v2](#migrating-from-v1-to-v2)
- [Usage](#usage)
  - [Inputs And Outputs](#inputs-and-outputs)
  - [GitHub Actions](#github-actions)
  - [GitLab CI](#gitlab-ci)
  - [Bitbucket Pipelines](#bitbucket-pipelines)
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

*   **`@vX` (e.g., `@v2`) - Recommended:** Points to the latest stable release within a specific major version (e.g., the latest `v2.x.y`). This tag is automatically updated upon new releases, allowing you to receive compatible updates and bug fixes without breaking changes.
*   **`@vX.Y.Z` (e.g., `@v2.0.0`) - Specific Version:** Pins the action to an exact release version created by semantic-release. Use this if you need absolute stability and want to control updates manually.
*   **`@<full-commit-sha>` - Highest Integrity Pinning:** Pins to a single immutable commit. Use this for high-assurance production pipelines and strict supply-chain controls.
*   **`@latest` - Latest Release:** Points to the most recent release. This tag is automatically updated upon new releases by the release workflow.
*   **`@main` - Bleeding Edge (Not Recommended):** Runs the action directly from the latest commit on the `main` branch. This is unstable and should generally be avoided in production workflows.

Pinning guidance:
*   Use `@<full-commit-sha>` for regulated or high-risk production environments where no automatic movement is acceptable.
*   Use `@vX.Y.Z` when you want stable behavior with controlled, manual upgrades.
*   Use `@vX` when you want automatic non-breaking updates within a major version.

```yaml
# Recommended: Use the major version tag for automatic compatible updates
- uses: gtrevorrow/oci-token-exchange-action@v2

# Alternative: Pin to a specific version (e.g., v2.0.0)
# - uses: gtrevorrow/oci-token-exchange-action@v2.0.0

# Highest integrity: Pin to an exact commit SHA
# - uses: gtrevorrow/oci-token-exchange-action@<full-commit-sha>

# Alternative: Use the latest release
# - uses: gtrevorrow/oci-token-exchange-action@latest
```

### As CLI Tool
```bash
npm install -g @gtrevorrow/oci-token-exchange

# Install the published release tag you want to use.
# Replace <release-tag> with your chosen release tag or version.
npm install -g @gtrevorrow/oci-token-exchange@<release-tag>
```

Stable releases are published with the `latest` npm dist-tag. Major-family
dist-tags such as `major-v1` and `major-v2` are maintained manually after a
release. For an immutable installation, use an exact package version.

## Migrating from v1 to v2

For most users, the only required change is the release tag. Existing consumers
pinned to the GitHub Action `@v1` or npm `major-v1` remain on v1.2.2.

### GitHub Actions

Test the immutable v2 release first:

```yaml
- uses: gtrevorrow/oci-token-exchange-action@v2.0.0
```

After validation, follow compatible v2 updates with:

```yaml
- uses: gtrevorrow/oci-token-exchange-action@v2
```

The standard action inputs are unchanged.

### npm CLI, GitLab CI, and Bitbucket Pipelines

Test the immutable package version first:

```bash
npm install @gtrevorrow/oci-token-exchange@2.0.0
```

After validation, follow compatible v2 updates with:

```bash
npm install @gtrevorrow/oci-token-exchange@major-v2
```

The standard GitLab and Bitbucket environment variables are unchanged.

### Library API changes

Consumers importing the package API must apply these renames:

- `tokenExchangeJwtToUpst` to `tokenExchange`
- `UpstTokenResponse` to `TokenExchangeResponse`
- `OciConfig.upstToken` to `OciConfig.sessionToken`

### OCI profile validation

`oci_profile` values containing path separators are now rejected. Replace such
values with a safe profile name such as `DEFAULT` or `CI` before upgrading.

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
| `oidc_audience` | `OIDC_AUDIENCE` | `INPUT_OIDC_AUDIENCE` | No | `https://cloud.oracle.com` | Audience requested when GitHub Actions mints the OIDC token. This is only used for the GitHub platform. |
| `oci_home` | `OCI_HOME` | `INPUT_OCI_HOME` | No | `OCI_HOME`, then `HOME`, then OS home directory | Base home folder under which the tool creates the `.oci` directory. Do not pass the `.oci` directory itself. |
| `oci_profile` | `OCI_PROFILE` | `INPUT_OCI_PROFILE` | No | `DEFAULT` | OCI CLI profile name to create or update. |
| `retry_count` | `RETRY_COUNT` | `INPUT_RETRY_COUNT` | No | `0` | Number of retry attempts for token exchange failures. |
| `res_type` | `RES_TYPE` | `INPUT_RES_TYPE` | No | - | Resource type for RPST token exchange, for example `ref_github`. If `res_type` is configured, the tool requests an RPST; otherwise it requests a UPST. |
| `rpst_exp` | `RPST_EXP` | `INPUT_RPST_EXP` | No | - | Optional RPST expiration in integer minutes. |

If `rpst_exp` is configured, `res_type` must also be configured. If `res_type` is not configured, UPST remains the default.

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

Variable resolution differs between GitHub Actions and CLI/non-GitHub usage:

1. GitHub Actions path:
   `GitHubPlatform` uses `@actions/core.getInput(...)`, which reads the GitHub Actions input values exposed through `INPUT_*`.
   For example, `with: oci_region: ...` is read as `INPUT_OCI_REGION`.

2. CLI / non-GitHub path:
   `CLIPlatform` uses `resolveInput(...)`, which checks values in this order:
   - plain environment variable such as `PLATFORM`, `OCI_HOME`, or `RETRY_COUNT`
   - GitHub-style environment variable such as `INPUT_CI_PLATFORM`
   - `OCI_*` prefixed environment variable
   - `OIDC_*` prefixed environment variable

3. Input-specific fallbacks:
   Some values have additional runtime fallbacks after input resolution.
   For example, `oci_home` falls back to `HOME` and then the OS home directory.

### GitHub Actions

Use the example below together with the [Inputs and Outputs](#inputs-and-outputs) reference above.

```yaml
- uses: gtrevorrow/oci-token-exchange-action@v2
  with:
    # ci_platform: 'github' # Optional: Defaults to 'github'. Other values: 'gitlab', 'bitbucket', 'local' (though 'github' is typical for Actions)
    oidc_client_identifier: ${{ secrets.OIDC_CLIENT_IDENTIFIER }} 
    domain_base_url: ${{ vars.DOMAIN_BASE_URL }} 
    oci_tenancy: ${{ secrets.OCI_TENANCY }}
    oci_region: ${{ secrets.OCI_REGION }}
    # Optional: Audience requested when GitHub mints the OIDC token
    # oidc_audience: 'https://cloud.oracle.com'
    # Optional: Custom base home folder under which the action creates .oci
    # oci_home: ${{ secrets.OCI_HOME }}
    # Optional: Name of the OCI CLI profile to create. Defaults to 'DEFAULT'.
    # oci_profile: 'DEFAULT' 
    # Optional: Number of retry attempts. Defaults to '0'.
    # retry_count: '0'
    
```

### GitLab CI

This example follows the working setup in [.gitlab-ci.yml](.gitlab-ci.yml).
Replace `<release-tag>` with the published release tag or version you want to
use. The package is installed without modifying the consumer project's manifest,
the GitLab ID token is mapped to `CI_JOB_JWT_V2`, and the installed binary runs with `npx --no-install`.

```yaml
image: node:24

variables:
  HUSKY: "0"

.oci_setup: &oci_setup |
  # Docker runners should only need Python 3 + venv support in the job image.
  # Shell runners must provide python3 and python3 -m venv on the host.
  python3 -m venv .oci-cli
  . .oci-cli/bin/activate
  python -m pip install --upgrade pip
  pip install oci-cli

deploy:
  script:
    - *oci_setup

    - npm install --no-save @gtrevorrow/oci-token-exchange@<release-tag>

    - export CI_JOB_JWT_V2="$ID_TOKEN"

    - |
      PLATFORM=gitlab \
      OIDC_CLIENT_IDENTIFIER=${OIDC_CLIENT_IDENTIFIER} \
      DOMAIN_BASE_URL=${DOMAIN_BASE_URL} \
      OCI_TENANCY=${OCI_TENANCY} \
      OCI_REGION=${OCI_REGION} \
      OCI_HOME=${CI_PROJECT_DIR} \
      OCI_PROFILE=${OCI_PROFILE} \
      RETRY_COUNT=${RETRY_COUNT:-3} \
      npx --no-install oci-token-exchange

    - oci --auth security_token --config-file "$CI_PROJECT_DIR/.oci/config" --profile "${OCI_PROFILE:-DEFAULT}" os ns get

  rules:
    - if: $CI_COMMIT_BRANCH == "develop"

  id_tokens:
    ID_TOKEN:
      aud: https://cloud.oracle.com/
```

### Bitbucket Pipelines

This example follows the working setup in [bitbucket-pipelines.yml](bitbucket-pipelines.yml).
Replace `<release-tag>` with the published release tag or version you want to
use. Both pipelines invoke the locally installed package with `npx --no-install`
and explicitly verify the generated OCI configuration.

```yaml
image: node:24

pipelines:
  default:
    - step:
        name: Setup OCI CLI with OIDC Token Exchange
        oidc: true
        script:
          - curl -LO https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh
          - bash install.sh --accept-all-defaults
          - export PATH=$PATH:/root/bin
          - npm install --no-save @gtrevorrow/oci-token-exchange@<release-tag>
          - |
            PLATFORM=bitbucket \
            OIDC_CLIENT_IDENTIFIER=${OIDC_CLIENT_IDENTIFIER} \
            DOMAIN_BASE_URL=${DOMAIN_BASE_URL} \
            OCI_TENANCY=${OCI_TENANCY} \
            OCI_REGION=${OCI_REGION} \
            OCI_HOME=${BITBUCKET_CLONE_DIR} \
            OCI_PROFILE=${OCI_PROFILE} \
            RETRY_COUNT=${RETRY_COUNT:-3} \
            npx --no-install oci-token-exchange
          - oci --auth security_token --config-file "$BITBUCKET_CLONE_DIR/.oci/config" --profile "${OCI_PROFILE:-DEFAULT}" os ns get
        artifacts:
          - ".oci/**"
          - "private_key.pem"
          - "public_key.pem"
          - "session"

  branches:
    main:
      - step:
          name: Setup OCI CLI with Published Package (Production)
          oidc: true
          script:
            - curl -LO https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh
            - bash install.sh --accept-all-defaults
            - export PATH=$PATH:/root/bin
            - npm install --no-save @gtrevorrow/oci-token-exchange@<release-tag>
            - |
              PLATFORM=bitbucket \
              OIDC_CLIENT_IDENTIFIER=${OIDC_CLIENT_IDENTIFIER} \
              DOMAIN_BASE_URL=${DOMAIN_BASE_URL} \
              OCI_TENANCY=${OCI_TENANCY} \
              OCI_REGION=${OCI_REGION} \
              OCI_HOME=${BITBUCKET_CLONE_DIR} \
              OCI_PROFILE=${OCI_PROFILE} \
              RETRY_COUNT=${RETRY_COUNT:-3} \
              npx --no-install oci-token-exchange
            - oci --auth security_token --config-file "$BITBUCKET_CLONE_DIR/.oci/config" --profile "${OCI_PROFILE:-DEFAULT}" os ns get
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
3. Exchanges the JWT for an OCI UPST token, or an RPST token when `res_type` is configured
4. Configures the OCI CLI with the obtained credentials

## Semantic Versioning

This project uses [semantic-release](https://github.com/semantic-release/semantic-release) for automated versioning and publishing.  
**For details on the build and release process, see [CONTRIBUTING.md](./CONTRIBUTING.md).**

## License

This action is licensed under the [Universal Permissive License v1.0 (UPL-1.0)](LICENSE.txt).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
