const semanticRelease = require('semantic-release');

async function main() {
  try {
    let releaseFunction = semanticRelease;

    if (typeof releaseFunction !== 'function') {
      if (releaseFunction && typeof releaseFunction.default === 'function') {
        releaseFunction = releaseFunction.default;
      } else {
        throw new TypeError('Failed to obtain a callable function from the semantic-release module.');
      }
    }

    const result = await releaseFunction({
      // Explicitly pass branch and repositoryUrl if needed, though usually auto-detected.
      // branches: process.env.GITHUB_REF_NAME, // or specific branch like 'main'
      // repositoryUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}.git`,
      
      // Add this: Redirect semantic-release's internal logs to stderr
      // This ensures that only the JSON result from this script goes to stdout.
      stdout: process.stderr,
      // stderr: process.stderr, // This is the default for semantic-release errors, can be explicit.

    });

    if (result) {
      // A release was published, print the JSON result to stdout
      // This will be captured in semantic-release-output.json by the workflow

      
      console.log(JSON.stringify(result, null, 2));
      // process.exitCode will be 0 by default (success)
    } else {
      // No release was published. stdout will be empty.
      // Log to stderr so it doesn't interfere with output file if this script's stdout is captured.
elop
      // This will be captured in semantic-release-error.log by the workflow

      console.error('No release published by semantic-release (programmatic run).');
      process.exitCode = 2; // Explicit exit code for "no release"
    }
  } catch (error) {
    // An error occurred during semantic-release execution.

    // This will be captured in semantic-release-error.log by the workflow
    console.error('Semantic Release programmatic run failed:', error);
    process.exitCode = 1; // Indicate failure;
  }
}

main();
