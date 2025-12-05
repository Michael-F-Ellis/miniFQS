#!/usr/bin/env node

// =============================================================================
// Configuration and Helper Functions
// =============================================================================

// Parse command line arguments
const args = process.argv.slice(2);
const debug = args.includes('--debug');

/**
 * Escape a string for TSV: replace tabs and newlines with spaces
 * @param {string} str - input string
 * @returns {string} escaped string
 */
function escapeTSV(str) {
	if (str === null || str === undefined) {
		return '';
	}
	return String(str).replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ');
}

/**
 * Convert a value to a TSV-safe string
 * @param {any} value - value to convert
 * @returns {string} TSV-safe string
 */
function tsvValue(value) {
	if (value === null || value === undefined) {
		return '';
	}
	return escapeTSV(String(value));
}

/**
 * Output a row as TSV
 * @param {Array<string>} fields - array of field values
 */
function outputRow(fields) {
	console.log(fields.map(f => tsvValue(f)).join('\t'));
}

// =============================================================================
// ABC Header Definitions
// =============================================================================

/**
 * Generate the ABC header rows to be inserted.
 * Each row has source='abchdr', type='ABCHeader', value='X:', 'T:', etc.
 * The 'abc0' column contains default values where appropriate.
 * @returns {Array<Array<string>>} Array of row field arrays
 */
function generateABCHeaderRows() {
	// Define the header rows in order
	return [
		// X:1 (tune number)
		['abchdr', '', '', '', '', '', 'ABCHeader', 'X:', '', '', '', '', '', '', '1', ''],
		// T: (title - empty, to be filled later)
		['abchdr', '', '', '', '', '', 'ABCHeader', 'T:', '', '', '', '', '', '', '', ''],
		// K:C major (default key signature)
		['abchdr', '', '', '', '', '', 'ABCHeader', 'K:', '', '', '', '', '', '', 'C major', ''],
		// M: (meter - empty, to be filled from FQS counter)
		['abchdr', '', '', '', '', '', 'ABCHeader', 'M:', '', '', '', '', '', '', '', ''],
		// L:1/4 (default unit note length)
		['abchdr', '', '', '', '', '', 'ABCHeader', 'L:', '', '', '', '', '', '', '1/4', '']
	];
}

// =============================================================================
// Main Processing Function
// =============================================================================

function processTSV() {
	// Read TSV from stdin
	let input = '';
	process.stdin.setEncoding('utf8');
	process.stdin.on('readable', () => {
		let chunk;
		while ((chunk = process.stdin.read()) !== null) {
			input += chunk;
		}
	});

	process.stdin.on('end', () => {
		const lines = input.split('\n').filter(line => line.trim() !== '');
		if (lines.length === 0) {
			return;
		}

		// Parse headers
		const headers = lines[0].split('\t');

		// Add the two new columns to headers
		const newHeaders = [...headers, 'abc0', 'abc'];

		// Generate ABC header rows (these have the same number of columns as newHeaders)
		const abcHeaderRows = generateABCHeaderRows();

		// Output the modified header
		outputRow(newHeaders);

		// Output the ABC header rows
		abcHeaderRows.forEach(row => {
			// Ensure row has correct number of columns (pad with empty strings if needed)
			while (row.length < newHeaders.length) {
				row.push('');
			}
			outputRow(row);
		});

		// Process and output all existing rows
		for (let i = 1; i < lines.length; i++) {
			const fields = lines[i].split('\t');
			// Add the two new empty columns to each existing row
			const newFields = [...fields, '', ''];
			// Pad with empty strings if needed (shouldn't be necessary but safe)
			while (newFields.length < newHeaders.length) {
				newFields.push('');
			}
			outputRow(newFields);
		}
	});
}

// =============================================================================
// Main Execution
// =============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
	processTSV();
}

export default processTSV;
