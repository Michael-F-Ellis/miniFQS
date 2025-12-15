// Node.js validation test for browser pipeline
// Uses validation-suite.json to test browser pipeline against expected output

import { parse } from '../parser.js';
import { fqsToABC, getStageTSV } from './index.js';

// Make parse function globally available for parseStage
global.parse = parse;

// Load validation suite
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const validationSuite = JSON.parse(readFileSync(join(__dirname, '..', 'validation-suite.json'), 'utf8'));

/**
 * Normalize ABC string for comparison
 * - Collapse multiple spaces to single space
 * - Trim whitespace from ends
 * - Normalize line endings to \n
 * - Remove empty lines
 */
function normalizeABC(abc) {
	if (!abc) return '';
	return abc
		.replace(/\r\n/g, '\n')           // Normalize line endings
		.replace(/\r/g, '\n')             // Handle Mac line endings
		.split('\n')
		.map(line => line.trim())         // Trim each line
		.filter(line => line.length > 0)  // Remove empty lines
		.join('\n')                       // Rejoin with single newlines
		.replace(/\s+/g, ' ')             // Collapse multiple spaces
		.trim();
}

/**
 * Compare two ABC strings with tolerance for whitespace differences
 */
function compareABC(actual, expected) {
	const normalizedActual = normalizeABC(actual);
	const normalizedExpected = normalizeABC(expected);
	return normalizedActual === normalizedExpected;
}

/**
 * Run validation tests
 */
async function runValidationTests() {
	console.log('============================================================');
	console.log('Browser Pipeline Validation Test');
	console.log('============================================================');
	console.log(`Suite: ${validationSuite.description}`);
	console.log(`Version: ${validationSuite.version}`);
	console.log(`Created: ${validationSuite.created}`);
	console.log(`Tests: ${validationSuite.tests.length}`);
	console.log('============================================================\n');

	let passed = 0;
	let failed = 0;
	const failures = [];

	for (const test of validationSuite.tests) {
		console.log(`▶ ${test.name} (${test.category})`);
		console.log(`  ${test.title}`);
		console.log(`  ${test.description}`);

		try {
			const result = await fqsToABC(test.fqs, { autoTitle: false });

			if (!result.success) {
				console.log(`  ✗ FAILED - Pipeline error: ${result.error}`);
				failed++;
				failures.push({
					name: test.name,
					error: `Pipeline error: ${result.error}`,
					actual: '',
					expected: test.expected_abc
				});
				continue;
			}

			const matches = compareABC(result.abcNotation, test.expected_abc);

			if (matches) {
				console.log(`  ✓ PASS`);
				passed++;
			} else {
				console.log(`  ✗ FAIL - Output mismatch`);
				console.log(`    Expected (normalized):\n${normalizeABC(test.expected_abc)}`);
				console.log(`    Actual (normalized):\n${normalizeABC(result.abcNotation)}`);
				failed++;
				failures.push({
					name: test.name,
					error: 'Output mismatch',
					actual: result.abcNotation,
					expected: test.expected_abc
				});
			}

			// Show stats for debugging
			if (!matches) {
				console.log(`    Stats:`);
				console.log(`    - Parse valid: ${result.stats.parse?.valid}`);
				console.log(`    - Flattened rows: ${result.stats.flatten?.rows}`);
				console.log(`    - Octaves calculated: ${result.stats.octaves?.totalPitches || 0}`);
				console.log(`    - Mapped attacks: ${result.stats.map?.attackRows || 0}`);
				console.log(`    - Generated ABC length: ${result.abcNotation?.length || 0} chars`);
			}

		} catch (error) {
			console.log(`  ✗ EXCEPTION - ${error.message}`);
			failed++;
			failures.push({
				name: test.name,
				error: `Exception: ${error.message}`,
				actual: '',
				expected: test.expected_abc
			});
		}

		console.log(); // Empty line between tests
	}

	// Summary
	console.log('============================================================');
	console.log('SUMMARY');
	console.log('============================================================');
	console.log(`Total: ${validationSuite.tests.length}`);
	console.log(`Passed: ${passed}`);
	console.log(`Failed: ${failed}`);

	if (failed === 0) {
		console.log('\n✅ All tests passed!');
	} else {
		console.log(`\n❌ ${failed} test(s) failed:`);
		for (const failure of failures) {
			console.log(`\n  ${failure.name}: ${failure.error}`);
			if (failure.actual && failure.expected) {
				console.log(`  Expected:\n${failure.expected}`);
				console.log(`  Actual:\n${failure.actual}`);
			}
		}
	}

	return { passed, failed, failures };
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runValidationTests().catch(error => {
		console.error('Fatal error:', error);
		process.exit(1);
	});
}

// Export for use in other scripts
export { runValidationTests, normalizeABC, compareABC };
