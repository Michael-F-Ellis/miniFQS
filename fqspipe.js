#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { argv, stdin, stdout, stderr, exit } from 'process';
import { Readable } from 'stream';

// =============================================================================
// Configuration
// =============================================================================

const PIPELINE_STAGES = [
	{ name: 'parse', script: 'fqs2ast.js', output: 'json', description: 'Parse FQS text to AST (JSON)' },
	{ name: 'flat', script: 'ast2flat.js', output: 'tsv', description: 'Flatten AST to tabular TSV format' },
	{ name: 'octaves', script: 'pitch-octaves.js', output: 'tsv', description: 'Calculate absolute octaves using LilyPond Rule' },
	{ name: 'map', script: 'map-pitches.js', output: 'tsv', description: 'Map pitch information to lyric attacks' },
	{ name: 'prep', script: 'abcprep.js', output: 'tsv', description: 'Add ABC header rows and columns' },
	{ name: 'beat', script: 'abcbeat.js', output: 'tsv', description: 'Process beat duration and set L: (unit note length)' },
	{ name: 'meter', script: 'abcmeter.js', output: 'tsv', description: 'Add meter (time signature) changes' },
	{ name: 'keysig', script: 'abckeysig.js', output: 'tsv', description: 'Add key signatures and barlines in ABC format' },
	{ name: 'notes', script: 'abcnotes.js', output: 'tsv', description: 'Convert pitch/rhythm to ABC note syntax' },
	{ name: 'generate', script: 'abcgen.js', output: 'abc', description: 'Generate final ABC notation string' }
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Print help message and exit
 */
function printHelp() {
	console.log(`Usage: node fqspipe.js [OPTIONS] [FILE]
    
Convert FQS notation to ABC notation through a modular pipeline.

Options:
  -h, --help           Show this help message
  --stop=STAGE         Stop pipeline at specified stage and output intermediate format
                       (useful for debugging)

Pipeline Stages (in order):`);

	PIPELINE_STAGES.forEach((stage, index) => {
		console.log(`  ${index + 1}. ${stage.name.padEnd(10)} - ${stage.description}`);
		console.log(`       Output: ${stage.output.toUpperCase()}`);
	});

	console.log(`
Examples:
  node fqspipe.js input.fqs           # Convert FQS to ABC (full pipeline)
  node fqspipe.js < input.fqs         # Read from stdin
  node fqspipe.js --stop=flat input.fqs # Stop after flattening AST to TSV
  node fqspipe.js --stop=notes input.fqs # Stop before final ABC generation
  
Exit Codes:
  0 - Success
  1 - General error
  2 - Invalid command-line arguments
  3 - Pipeline stage failed
`);
	exit(0);
}

/**
 * Parse command-line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
	const args = {
		inputFile: null,
		stopStage: null,
		help: false
	};

	for (let i = 2; i < argv.length; i++) {
		const arg = argv[i];

		if (arg === '-h' || arg === '--help') {
			args.help = true;
		} else if (arg.startsWith('--stop=')) {
			args.stopStage = arg.substring(7);
		} else if (arg.startsWith('-')) {
			stderr.write(`Error: Unknown option ${arg}\n`);
			exit(2);
		} else {
			// First non-option argument is input file
			if (args.inputFile === null) {
				args.inputFile = arg;
			} else {
				stderr.write(`Error: Unexpected argument ${arg}\n`);
				exit(2);
			}
		}
	}

	return args;
}

/**
 * Validate stop stage argument
 * @param {string} stageName - Stage name to validate
 * @returns {Object} Stage object if valid, null otherwise
 */
function validateStage(stageName) {
	const stage = PIPELINE_STAGES.find(s => s.name === stageName);
	if (!stage) {
		stderr.write(`Error: Invalid stage '${stageName}'. Valid stages are:\n`);
		PIPELINE_STAGES.forEach(s => stderr.write(`  ${s.name}\n`));
		return null;
	}
	return stage;
}

/**
 * Run a pipeline stage
 * @param {string} script - Script filename
 * @param {ReadableStream} inputStream - Input stream
 * @returns {Promise<ReadableStream>} Output stream
 */
function runStage(script, inputStream) {
	return new Promise((resolve, reject) => {
		const child = spawn('node', [script], {
			stdio: ['pipe', 'pipe', 'pipe']
		});

		// Pipe input to child
		inputStream.pipe(child.stdin);

		// Collect stderr for error reporting
		let errorOutput = '';
		child.stderr.on('data', (data) => {
			errorOutput += data.toString();
		});

		child.on('close', (code) => {
			if (code !== 0) {
				reject(new Error(`Stage ${script} failed with exit code ${code}: ${errorOutput}`));
			}
			// Note: We don't resolve here because we need to resolve with the stdout stream immediately
		});

		child.on('error', (err) => {
			reject(new Error(`Failed to start stage ${script}: ${err.message}`));
		});

		// Resolve immediately with child's stdout stream
		resolve(child.stdout);
	});
}

/**
 * Read input from file or stdin
 * @param {string|null} inputFile - Input filename or null for stdin
 * @returns {ReadableStream} Input stream
 */
function getInputStream(inputFile) {
	if (inputFile) {
		try {
			const input = readFileSync(inputFile, 'utf-8');
			const stream = new Readable();
			stream.push(input);
			stream.push(null); // EOF
			return stream;
		} catch (err) {
			stderr.write(`Error reading file ${inputFile}: ${err.message}\n`);
			exit(1);
		}
	} else {
		// Use stdin
		return stdin;
	}
}

// =============================================================================
// Main Function
// =============================================================================

async function main() {
	// Parse command-line arguments
	const args = parseArgs();

	// Handle help request
	if (args.help) {
		printHelp();
	}

	// Validate stop stage if specified
	let stopStageIndex = PIPELINE_STAGES.length - 1; // Default: last stage
	if (args.stopStage) {
		const stage = validateStage(args.stopStage);
		if (!stage) {
			exit(2);
		}
		stopStageIndex = PIPELINE_STAGES.findIndex(s => s.name === args.stopStage);
	}

	// Get input stream
	const inputStream = getInputStream(args.inputFile);

	try {
		// Create an array to hold all child processes
		const children = [];

		// Start the first stage
		let currentStream = inputStream;

		for (let i = 0; i <= stopStageIndex; i++) {
			const stage = PIPELINE_STAGES[i];
			const child = spawn('node', [stage.script]);

			// Pipe current stream to child's stdin
			currentStream.pipe(child.stdin);

			// Collect stderr for error reporting
			let errorOutput = '';
			child.stderr.on('data', (data) => {
				errorOutput += data.toString();
			});

			// Handle child errors
			child.on('error', (err) => {
				stderr.write(`Failed to start stage ${stage.script}: ${err.message}\n`);
				exit(3);
			});

			// Store child for cleanup
			children.push({ child, stage: stage.name, errorOutput });

			// Move to next stream
			currentStream = child.stdout;
		}

		// Pipe final output to stdout
		currentStream.pipe(stdout);

		// Wait for all children to complete
		await new Promise((resolve, reject) => {
			let completed = 0;
			let hasError = false;

			children.forEach(({ child, stage, errorOutput }) => {
				child.on('close', (code) => {
					completed++;

					if (code !== 0 && !hasError) {
						hasError = true;
						stderr.write(`Stage ${stage} failed with exit code ${code}: ${errorOutput}\n`);
						// Kill other children
						children.forEach(({ child: c }) => {
							if (!c.killed) c.kill();
						});
						reject(new Error(`Pipeline stage ${stage} failed`));
					}

					if (completed === children.length && !hasError) {
						resolve();
					}
				});
			});
		});

	} catch (err) {
		stderr.write(`Pipeline error: ${err.message}\n`);
		exit(3);
	}
}

// Run main function
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch(err => {
		stderr.write(`Unexpected error: ${err.message}\n`);
		exit(1);
	});
}

export default main;
