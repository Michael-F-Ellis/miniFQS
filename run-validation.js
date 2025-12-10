#!/usr/bin/env node

import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Normalize whitespace for comparison
 * - Preserve essential newlines (at least one per FQS block)
 * - Allow minor whitespace differences otherwise
 */
function normalizeForComparison(text) {
	if (!text) return '';

	// Split into lines and trim trailing whitespace
	const lines = text.split('\n').map(line => line.trimEnd());

	// Remove completely empty lines at the end
	while (lines.length > 0 && lines[lines.length - 1] === '') {
		lines.pop();
	}

	// Join back with newlines
	return lines.join('\n');
}

/**
 * Compare two ABC outputs, allowing minor whitespace differences
 */
function compareABC(actual, expected) {
	const normalizedActual = normalizeForComparison(actual);
	const normalizedExpected = normalizeForComparison(expected);

	return {
		match: normalizedActual === normalizedExpected,
		actual: normalizedActual,
		expected: normalizedExpected
	};
}

/**
 * Run a single test through fqspipe.js
 */
function runTest(fqsContent, stopStage = null) {
	try {
		// Write to temporary file
		const tempFile = 'temp_validation_test.fqs';
		writeFileSync(tempFile, fqsContent);

		// Build command
		let command = 'node fqspipe.js';
		if (stopStage) {
			command += ` --stop=${stopStage}`;
		}
		command += ` ${tempFile}`;

		// Run fqspipe.js
		const output = execSync(command, {
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'pipe']
		});

		// Clean up temp file
		try {
			unlinkSync(tempFile);
		} catch (e) {
			// Ignore cleanup errors
		}

		return {
			success: true,
			output: output.trim()
		};
	} catch (error) {
		return {
			success: false,
			error: error.message,
			output: error.stdout ? error.stdout.toString().trim() : '',
			stderr: error.stderr ? error.stderr.toString().trim() : ''
		};
	}
}

/**
 * Parse command line arguments
 */
function parseArgs() {
	const args = {
		testName: null,
		stopStage: null,
		verbose: false,
		help: false
	};

	for (let i = 2; i < process.argv.length; i++) {
		const arg = process.argv[i];

		if (arg === '-h' || arg === '--help') {
			args.help = true;
		} else if (arg === '-v' || arg === '--verbose') {
			args.verbose = true;
		} else if (arg.startsWith('--test=')) {
			args.testName = arg.substring(7);
		} else if (arg.startsWith('--stop=')) {
			args.stopStage = arg.substring(7);
		} else if (arg.startsWith('-')) {
			console.error(`Error: Unknown option ${arg}`);
			process.exit(2);
		} else {
			console.error(`Error: Unexpected argument ${arg}`);
			process.exit(2);
		}
	}

	return args;
}

/**
 * Print help message
 */
function printHelp() {
	console.log(`Usage: node run-validation.js [OPTIONS]
    
Run FQS validation tests from validation-suite.json.

Options:
  -h, --help           Show this help message
  -v, --verbose        Show detailed output for each test
  --test=NAME          Run only the specified test (by name)
  --stop=STAGE         Stop pipeline at specified stage for debugging
  
Pipeline Stages (for --stop option):
  parse      - Stop after parsing (AST JSON)
  flat       - Stop after flattening AST to TSV
  octaves    - Stop after calculating octaves
  map        - Stop after mapping pitches to attacks
  prep       - Stop after adding ABC headers
  meter      - Stop after adding meter changes
  keysig     - Stop after adding key signatures
  notes      - Stop after converting to ABC note syntax
  generate   - Stop at final ABC generation (default)

Examples:
  node run-validation.js                    # Run all tests
  node run-validation.js --test=simple_rhythm_example  # Run single test
  node run-validation.js --stop=flat        # Stop at intermediate stage
  node run-validation.js --verbose          # Show detailed output
`);
}

/**
 * Main function
 */
async function main() {
	const args = parseArgs();

	if (args.help) {
		printHelp();
		process.exit(0);
	}

	// Load validation suite
	console.log('Loading validation suite...');
	const suiteData = JSON.parse(readFileSync('validation-suite.json', 'utf-8'));

	console.log(`Validation Suite v${suiteData.version}`);
	console.log(`Description: ${suiteData.description}`);
	console.log(`Created: ${suiteData.created}`);
	console.log(`Tests: ${suiteData.tests.length}`);

	// Filter tests if --test option is used
	let testsToRun = suiteData.tests;
	if (args.testName) {
		testsToRun = suiteData.tests.filter(test => test.name === args.testName);
		if (testsToRun.length === 0) {
			console.error(`Error: Test "${args.testName}" not found`);
			process.exit(1);
		}
		console.log(`Running only test: ${args.testName}`);
	}

	console.log(`\nRunning ${testsToRun.length} test(s)...\n`);

	let passed = 0;
	let failed = 0;
	const failures = [];

	for (const test of testsToRun) {
		console.log(`▶ ${test.name} (${test.category})`);
		if (args.verbose) {
			console.log(`  Title: ${test.title}`);
			console.log(`  Description: ${test.description}`);
		}

		// Run the test
		const result = runTest(test.fqs, args.stopStage);

		if (!result.success) {
			console.log(`  ❌ FAILED - Pipeline error: ${result.error}`);
			failed++;
			failures.push({
				test: test.name,
				error: result.error,
				output: result.output
			});
			continue;
		}

		// Compare output if we're not stopping at an intermediate stage
		if (!args.stopStage) {
			const comparison = compareABC(result.output, test.expected_abc);

			if (comparison.match) {
				console.log(`  ✓ PASS`);
				passed++;
			} else {
				console.log(`  ❌ FAIL - Output mismatch`);
				if (args.verbose) {
					console.log(`  Expected:\n${comparison.expected}`);
					console.log(`  Actual:\n${comparison.actual}`);
				} else {
					console.log(`  Expected: ${comparison.expected.split('\n')[0]}...`);
					console.log(`  Actual: ${comparison.actual.split('\n')[0]}...`);
				}
				failed++;
				failures.push({
					test: test.name,
					expected: comparison.expected,
					actual: comparison.actual
				});
			}
		} else {
			// When stopping at intermediate stage, just show output
			console.log(`  ⚡ STOPPED at ${args.stopStage}`);
			if (args.verbose) {
				console.log(`  Output:\n${result.output}`);
			}
			passed++; // Count as passed since we're not comparing
		}

		console.log(); // Empty line between tests
	}

	// Print summary
	console.log('='.repeat(60));
	console.log('SUMMARY');
	console.log('='.repeat(60));
	console.log(`Total: ${testsToRun.length}`);
	console.log(`Passed: ${passed}`);
	console.log(`Failed: ${failed}`);

	if (failed > 0) {
		console.log(`\nFAILURES:`);
		failures.forEach(f => {
			console.log(`  • ${f.test}: ${f.error || 'Output mismatch'}`);
		});
		process.exit(1);
	} else {
		console.log(`\n✅ All tests passed!`);
		process.exit(0);
	}
}

// Run main function
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch(error => {
		console.error('Fatal error:', error);
		process.exit(1);
	});
}

export default main;
