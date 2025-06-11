const semanticRelease = require('semantic-release');
const { Writable } = require('stream');

// A stream to capture/mute semantic-release's own stdout logs.
// We want to control what this script outputs to its actual stdout.
const MutedStream = class extends Writable {
  constructor(options) {
    super(options);
    this.content = ''; // Buffer to capture logs if needed for debugging
  }
  _write(chunk, encoding, callback) {
    // Accumulate the logs.
    // To debug what semantic-release is logging, you can uncomment the next line:
    // process.stderr.write(`[SR Internal Log] ${chunk.toString()}`);
    this.content += chunk.toString();
    callback();
  }
};

async function run() {
  const mutedStdout = new MutedStream();
  // semantic-release's stderr will be directed to this script's stderr.
  const semanticReleaseStderr = process.stderr;

  try {
    const result = await semanticRelease(
      {
        // Semantic Release configuration options.
        // These are typically loaded from .releaserc.json, .releaserc.js, 
        // or package.json#release. No need to duplicate them here if they 
        // are in a config file (e.g., branches, plugins).
      },
      {
        // Environment in which to run semantic-release
        env: process.env,
        cwd: process.cwd(),
        stdout: mutedStdout,    // Pass the muted stream to semantic-release for its stdout
        stderr: semanticReleaseStderr, // Route semantic-release's stderr to this script's stderr
      }
    );

    if (result) {
      // A release was published.
      // Output ONLY the JSON result to this script's actual stdout.
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      process.exit(0); // Exit code 0 for success (release published)
    } else {
      // No release was published (e.g., no relevant commits).
      process.stderr.write('Semantic-release determined no release was necessary.\n');
      process.exit(2); // Exit code 2 for no release
    }
  } catch (error) {
    process.stderr.write('Semantic-release execution failed.\n');
    
    // Log the error object itself for more details
    process.stderr.write('Error: ' + error.toString() + '\n');
    if (error.stack) {
      process.stderr.write('Stack trace:\n' + error.stack + '\n');
    }
    
    // Semantic-release might provide additional details in error.message, error.details,
    // or an array of errors.
    if (error.name && error.message) {
        process.stderr.write(`Error Name: ${error.name}\n`);
        // Error message is already part of error.toString(), but can be logged again if needed.
        // process.stderr.write(`Error Message: ${error.message}\n`);
    }
    if (error.details) {
        process.stderr.write(`Error Details: ${error.details}\n`);
    }
    if (Array.isArray(error.errors)) {
        process.stderr.write('Individual errors reported by semantic-release:\n');
        error.errors.forEach(err => {
            process.stderr.write(`- ${err.message || JSON.stringify(err)}\n`);
        });
    }

    // If you want to see the logs captured by MutedStream when an error occurs:
    // process.stderr.write('Captured semantic-release internal stdout logs during run:\n');
    // process.stderr.write(mutedStdout.content + '\n');

    process.exit(1); // Exit code 1 for error
  }
}

run();
