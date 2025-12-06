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
// Key Signature Conversion
// =============================================================================

// Key signature mapping: FQS -> ABC (major key equivalent)
// Same mapping as in abc-converter.js
const KEY_SIGNATURE_MAP = {
	// Sharps
	'K#1': 'G',
	'K#2': 'D',
	'K#3': 'A',
	'K#4': 'E',
	'K#5': 'B',
	'K#6': 'F#',
	'K#7': 'C#',
	// Flats
	'K&1': 'F',
	'K&2': 'Bb',
	'K&3': 'Eb',
	'K&4': 'Ab',
	'K&5': 'Db',
	'K&6': 'Gb',
	'K&7': 'Cb',
	// Neutral
	'K0': 'C'
};

/**
 * Convert FQS key signature to ABC inline key signature
 * @param {string} fqsKey - FQS key signature value (e.g., 'K#6', 'K&3', 'K0')
 * @returns {string} ABC inline key signature (e.g., '[K:F# major]', '[K:Eb major]', '[K:C major]')
 */
function convertKeySignature(fqsKey) {
	const abcKey = KEY_SIGNATURE_MAP[fqsKey];
	if (!abcKey) {
		if (debug) {
			console.error(`Debug: Unknown key signature '${fqsKey}', defaulting to C major`);
		}
		return '[K:C major]';
	}
	return `[K:${abcKey} major]`;
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
		const fieldMap = {};
		headers.forEach((header, index) => {
			fieldMap[header] = index;
		});

		// Ensure abc0 column exists (should be added by abcprep)
		if (fieldMap.abc0 === undefined) {
			console.error('Error: abc0 column not found. Run abcprep.js first.');
			process.exit(1);
		}

		// Output header unchanged
		outputRow(headers);

		// Process each data row
		for (let i = 1; i < lines.length; i++) {
			const fields = lines[i].split('\t');
			const type = fields[fieldMap.type] || '';
			const value = fields[fieldMap.value] || '';

			// Handle barlines and key signatures
			if (type === 'Barline') {
				// Barline: copy '|' to abc0 column
				fields[fieldMap.abc0] = value; // value should be '|'
				if (debug && value !== '|') {
					console.error(`Debug: Barline with unexpected value '${value}'`);
				}
			} else if (type === 'KeySig') {
				// Key signature: convert to ABC inline format
				const abcKeySig = convertKeySignature(value);
				fields[fieldMap.abc0] = abcKeySig;
				if (debug) {
					console.error(`Debug: Converted ${value} -> ${abcKeySig}`);
				}
			}
			// Other rows: leave abc0 unchanged (may be empty or contain default values from abcprep)

			// Output the row
			outputRow(fields);
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
