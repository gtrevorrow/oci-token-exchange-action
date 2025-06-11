const semanticRelease = require('semantic-release');

async function main() {
  try {
    // Pass default options; semantic-release will use configuration from .releaserc.json or package.json
    // Ensure GITHUB_TOKEN and NPM_TOKEN are available in the environment for semantic-release to use.
    const result = await semanticRelease({
      // Explicitly pass branch and repositoryUrl if needed, though usually auto-detected.
      // branches: process.env.GITHUB_REF_NAME, // or specific branch like 'main'
      // repositoryUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}.git`,
    });

    if (result) {
      // A release was published, print the JSON result to stdout
      // This includes objects like 'lastRelease', 'commits', 'nextRelease', 'releases'.
      console.log(JSON.stringify(result, null, 2));
    } else {
      // No release was published. stdout will be empty.
      // Log to stderr so it doesn't interfere with output file if this script's stdout is captured.
      console.error('No release published by semantic-release (programmatic run).');
    }
  } catch (error) {
    // An error occurred during semantic-release execution.
    console.error('Semantic Release programmatic run failed:', error);
    process.exitCode = 1; // Indicate failure; the shell command's `|| true` in the workflow will handle this.
  }
}

main();
