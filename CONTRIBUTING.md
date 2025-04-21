# Contributing to this repository

## Table of Contents

- [Opening issues](#opening-issues)
- [Pre-requisites for code or documentation submissions](#pre-requisites-for-code-or-documentation-submissions)
- [Commit messages](#commit-messages)
- [Build, Test, Versioning and Release Process](#build-test-and-versioning)
  - [Build & Test](#build--test)
  - [Versioning & Release](#versioning--release)
    - [Release Types](#release-types)
- [Development and Release Workflow](#development-and-release-workflow)
- [Pull request process](#pull-request-process)
- [Code of conduct](#code-of-conduct)

# Contributing to this repository

We welcome your contributions! There are multiple ways to contribute, even if you're not a developer.

## Opening issues

If you think you've found a security vulnerability, do not open a GitHub issue. Instead, follow the instructions in our security policy.

To report a bug or request an enhancement that is not related to a security vulnerability, open a GitHub issue. When filing a bug, remember that the better written the bug is, the easier and more likely it is to be reproduced and fixed.

## Pre-requisites for code or documentation submissions

Before we can review or accept any source code or documentation-related contribution, you will need to digitally sign the [Oracle Contributor Agreement (OCA)](https://oca.opensource.oracle.com/) using the OCA Signing Service. This only needs to be done once, so if you've signed it for another repository or project, there is no need to sign again.

All your commit messages must include the following line using the same name and email address you used to sign the OCA:

```
Signed-off-by: Your Name <you@example.org>
```

This can be automatically added to pull requests by committing with --sign-off or -s, e.g.

```
git commit --signoff
```

We can only accept pull requests from contributors who have been verified as having signed the OCA.

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/) and is Commitizen friendly.

**Commit message format:**
```
<type>(<scope>): <short description>
```
- **type**: One of `feat`, `fix`, `perf`, `refactor`, `docs`, `style`, `test`, `chore`, `build`, `ci`
- **scope**: *(optional but recommended)* The part of the codebase affected (e.g. `core`, `cli`, `github`, `config`, etc.)
- **short description**: A concise summary of the change

**Examples:**
```
feat(cli): add support for Bitbucket OIDC tokens
fix(core): handle missing environment variables gracefully
docs(readme): clarify installation instructions
```

- Use `!` after the type or scope for breaking changes, e.g. `feat(cli)!: drop Node 16 support`
- The scope should match the affected module, platform, or feature area.
- All commit messages must include a `Signed-off-by` line as described above.

**Commit message checks:**  
A commit message hook will automatically check your commit message for Conventional Commits compliance. If your message does not comply, the commit will be rejected with an explanation.

If you already have Commitizen installed, you can run `git cz ...` instead of `git commit ...` and Commitizen will make sure your commit message is in the right format and provides all the necessary information.

**To create a commit message interactively, run:**
```
npm run commit
```
or
```
npx cz
```
This will guide you through the Conventional Commits format.

The commit message hook will analyze your commit message and report anything that needs to be fixed. For example:

```
$ git commit -m "Updated the contribution guide."
⧗   input: Updated the contribution guide.
✖   subject may not be empty [subject-empty]
✖   type may not be empty [type-empty]
⚠   message must be signed off [Signed-off-by]

✖   found 2 problems, 1 warnings
ⓘ   Get help: https://github.com/oracle-actions/.github/blob/main/CONTRIBUTING.md#commit-messages

husky - commit-msg hook exited with code 1 (error)
```

If you have any questions, please check the Conventional Commits FAQ, start a discussion or open an issue.

## Build, Test and Versioning

This project uses a modern, automated build and release system powered by TypeScript, Jest, and [semantic-release](https://github.com/semantic-release/semantic-release).

### Build & Test

- **Build:**  
  Run `npm run build` to compile TypeScript sources to `dist/`.
- **Lint & Format:**  
  Run `npm run lint` and `npm run format:check` to check code style.
- **Test:**  
  Run `npm test` to execute all Jest tests.

### Versioning & Release

This project follows [Semantic Versioning](https://semver.org/) and uses [semantic-release](https://github.com/semantic-release/semantic-release) for automated version management and publishing.

#### Release Types

- **MAJOR:** Breaking changes (`feat!` or `BREAKING CHANGE:` in commit)
- **MINOR:** New features (`feat`)
- **PATCH:** Bug fixes and improvements (`fix`, `perf`, `refactor`)
- **No Release:** `docs`, `style`, `test`, `chore`, `build`, `ci` do not trigger a release

## Development and Release Workflow

The project follows a structured process from development to production, using a `develop` branch for integration and a `main` branch for releases.

1. **Development Phase:**
   - Create a feature branch from `develop`:  
     `git checkout -b feature/my-feature`
   - Make your changes
   - Run tests locally: `npm test`
   - Commit changes: `git commit -m "feat: add new feature"` following the [Conventional Commits](https://www.conventionalcommits.org/) format
   - Push to your feature branch: `git push origin feature/my-feature`

2. **Integration to Develop:**
   - Create a [pull request](#pull-request-process) targeting the `develop` branch.
   - Address review comments and ensure all checks pass.
   - Squash commits if necessary to maintain a clean history.
   - After approval, a repository maintainer will merge your pull request into `develop`.
   - Verify all tests pass on the `develop` branch.

3. **Creating a Release:**
   - Create a [pull request](#pull-request-process) from `develop` to `main`.
   - This PR represents a release candidate.
   - A repository maintainer will run final verification on the release candidate.
   - Once approved, a repository maintainer will merge the pull request to `main`.
   - **Important:** Use either **"Create a merge commit"** or **"Rebase and merge"**. Do **NOT** use "Squash and merge", as this will prevent `semantic-release` from correctly determining the version and generating release notes.
   - Merging to `main` will automatically trigger the `release.yml` workflow.
   - `semantic-release` will then:
     - Analyze the commits on `main` since the last release tag.
     - Determine the appropriate next version number based on conventional commits.
     - Generate release notes automatically from commit messages.
     - Create a GitHub release and a corresponding version tag (e.g., `v1.1.0`).
     - Publish the package to npm with the calculated version.

4. **Test Publishing:**  
   For test releases, use the `.github/workflows/test-publish.yml` workflow, which can be triggered manually from the Actions tab. Test packages are published to npm with a tag like `1.2.3-YYYYMMDD-beta`.

   To install a package published with a specific tag (e.g., `beta`):
   ```bash
   npm install @gtrevorrow/oci-token-exchange@beta
   ```

**Notes:**
- All publishing is handled by CI; do not publish manually.
- Only merge to `main` when ready for release.
- **Initial Workflow Setup:** For manually triggered workflows (`workflow_dispatch`) like `test-publish.yml` to appear in the GitHub Actions UI, the workflow file must first exist in the default branch (`main`). You may need to merge a minimal version of the file into `main` initially. Subsequent development and testing can then occur on branches like `develop` by manually triggering the workflow and selecting the desired branch in the UI.
- See the [README](./README.md) for user installation and usage instructions.


## Pull request process

1. Ensure there is an issue created to track and discuss the fix or enhancement you intend to submit.
2. Fork this repository
3. Create a branch in your fork to implement the changes. We recommend using the issue number as part of your branch name, e.g. `1234-fixes`
4. Ensure that any documentation is updated with the changes that are required by your change.
5. Submit the pull request. Do not leave the pull request blank. Explain exactly what your changes are meant to do and provide simple steps on how to validate your changes. Ensure that you reference the issue you created as well.
6. We will assign the pull request to specific people for review before it is merged.

## Code of conduct

Our Code of Conduct is adapted from the Contributor Covenant, version 1.4, available at https://www.contributor-covenant.org/version/1/4/code-of-conduct.html.