#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Find all test_*.fqs files in the current directory
 */
function findTestFiles() {
	const files = readdirSync('.');
	return files.filter(file => file.startsWith('test_') && file.endsWith('.fqs'));
}

/**
 * Extract title from FQS content (first non-empty line)
 */
function extractTitle(fqsContent) {
	const lines = fqsContent.split('\n');
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed && !trimmed.startsWith('//')) {
			return trimmed;
		}
	}
	return 'Untitled';
}

/**
 * Convert title to snake_case name
 */
function titleToName(title) {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

/**
 * Determine category based on test content and filename
 */
function determineCategory(filename, fqsContent) {
	const lowerContent = fqsContent.toLowerCase();

	if (filename.includes('simple')) return 'basic';
	if (filename.includes('happy')) return 'melody';
	if (filename.includes('rhythm')) return 'rhythm';
	if (filename.includes('dotted')) return 'rhythm';
	if (filename.includes('multibeat')) return 'meter';
	if (filename.includes('multiblock')) return 'structure';
	if (filename.includes('octave')) return 'pitch';
	if (filename.includes('keysig')) return 'key_signature';
	if (filename.includes('largescore')) return 'performance';

	// Fallback based on content analysis
	if (lowerContent.includes('tuplet') || lowerContent.includes('***')) return 'rhythm';
	if (lowerContent.includes('key') || lowerContent.includes('k#')) return 'key_signature';
	if (lowerContent.includes('octave') || lowerContent.includes('^') || lowerContent.includes('/')) return 'pitch';

	return 'general';
}

/**
 * Run FQS through fqspipe.js and capture output
 */
function runFQSPipe(fqsContent) {
	try {
		// Write to temporary file
		const tempFile = 'temp_test.fqs';
		writeFileSync(tempFile, fqsContent);

		// Run fqspipe.js
		const output = execSync(`node fqspipe.js ${tempFile}`, {
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
			output: error.stdout ? error.stdout.toString().trim() : ''
		};
	}
}

/**
 * Normalize whitespace in ABC output
 * - Preserve at least one newline per FQS block (for abcjs)
 * - Allow minor whitespace differences otherwise
 */
function normalizeABC(abc) {
	// Split into lines
	const lines = abc.split('\n');

	// Remove trailing whitespace from each line
	const trimmedLines = lines.map(line => line.trimEnd());

	// Join back with newlines, preserving the structure
	return trimmedLines.join('\n');
}

/**
 * Main function
 */
async function main() {
	console.log('Collecting FQS test files...');

	const testFiles = findTestFiles();
	console.log(`Found ${testFiles.length} test files:`, testFiles);

	const tests = [];

	for (const filename of testFiles) {
		console.log(`\nProcessing ${filename}...`);

		try {
			// Read FQS content
			const fqsContent = readFileSync(filename, 'utf-8').trim();

			// Extract metadata
			const title = extractTitle(fqsContent);
			const name = titleToName(title);
			const category = determineCategory(filename, fqsContent);

			// Run through pipeline
			console.log(`  Running through fqspipe.js...`);
			const result = runFQSPipe(fqsContent);

			if (!result.success) {
				console.log(`  ❌ Failed: ${result.error}`);
				tests.push({
					name,
					title,
					description: `${title} - ${category.replace('_', ' ')} test`,
					category,
					fqs: fqsContent,
					expected_abc: '',
					status: 'fail',
					error: result.error
				});
				continue;
			}

			// Normalize ABC output
			const normalizedABC = normalizeABC(result.output);

			console.log(`  ✓ Success`);

			// Create test object
			tests.push({
				name,
				title,
				description: `${title} - ${category.replace('_', ' ')} test`,
				category,
				fqs: fqsContent,
				expected_abc: normalizedABC,
				status: 'pass'
			});

		} catch (error) {
			console.log(`  ❌ Error processing ${filename}: ${error.message}`);
		}
	}

	// Create validation suite object
	const validationSuite = {
		version: '1.0',
		description: 'FQS to ABC validation test suite',
		created: new Date().toISOString().split('T')[0],
		tests: tests
	};

	// Write to JSON file
	const outputFile = 'validation-suite.json';
	writeFileSync(outputFile, JSON.stringify(validationSuite, null, 2));

	console.log(`\n✅ Created ${outputFile} with ${tests.length} tests`);
	console.log(`\nSummary:`);
	const passCount = tests.filter(t => t.status === 'pass').length;
	const failCount = tests.filter(t => t.status === 'fail').length;
	console.log(`  Pass: ${passCount}`);
	console.log(`  Fail: ${failCount}`);

	if (failCount > 0) {
		console.log(`\nFailing tests:`);
		tests.filter(t => t.status === 'fail').forEach(t => {
			console.log(`  - ${t.name}: ${t.error || 'Unknown error'}`);
		});
		process.exit(1);
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
