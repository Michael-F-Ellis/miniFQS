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

/**
 * Convert FQS key signature to ABC header format (no brackets)
 * @param {string} fqsKey - FQS key signature value
 * @returns {string} ABC header key signature (e.g., 'C major', 'F# major', 'Eb major')
 */
function convertKeySignatureHeader(fqsKey) {
	const abcKey = KEY_SIGNATURE_MAP[fqsKey];
	if (!abcKey) {
		if (debug) {
			console.error(`Debug: Unknown key signature '${fqsKey}', defaulting to C major`);
		}
		return 'C major';
	}
	return `${abcKey} major`;
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

		// Collect all rows for processing
		const rows = [];
		for (let i = 1; i < lines.length; i++) {
			rows.push(lines[i].split('\t'));
		}

		// Collect key signatures in order
		const keySignatures = [];
		for (let i = 0; i < rows.length; i++) {
			const fields = rows[i];
			const type = fields[fieldMap.type] || '';
			const value = fields[fieldMap.value] || '';
			if (type === 'KeySig') {
				keySignatures.push({
					index: i,
					fqsKey: value,
					abcInline: convertKeySignature(value),
					abcHeader: convertKeySignatureHeader(value)
				});
			}
		}

		if (debug) {
			console.error(`Debug: Found ${keySignatures.length} key signatures`);
		}

		// Process first key signature (place in K: header row)
		if (keySignatures.length > 0) {
			const firstKeySig = keySignatures[0];
			// Find K: header row
			for (let i = 0; i < rows.length; i++) {
				const fields = rows[i];
				const source = fields[fieldMap.source] || '';
				const value = fields[fieldMap.value] || '';
				if (source === 'abchdr' && value === 'K:') {
					fields[fieldMap.abc0] = firstKeySig.abcHeader;
					if (debug) {
						console.error(`Debug: Set K: header to '${firstKeySig.abcHeader}'`);
					}
					break;
				}
			}
		}

		// Collect lyric barlines in order
		const lyricBarlines = [];
		for (let i = 0; i < rows.length; i++) {
			const fields = rows[i];
			const source = fields[fieldMap.source] || '';
			const type = fields[fieldMap.type] || '';
			if (source === 'lyrics' && type === 'Barline') {
				lyricBarlines.push({
					index: i,
					fields: fields
				});
			}
		}

		if (debug) {
			console.error(`Debug: Found ${lyricBarlines.length} lyric barlines`);
		}

		// Process subsequent key signatures (attach to lyric barlines in order)
		// First key signature (k=0) already handled (K: header)
		// For each remaining key signature, attach to corresponding barline only if key changes
		// Key signature k (1-based) attaches to barline k-1 (0-based)
		let currentKey = keySignatures.length > 0 ? keySignatures[0].abcInline : '[K:C major]';

		for (let k = 1; k < keySignatures.length; k++) {
			const keySig = keySignatures[k];
			const barlineIndex = k - 1; // first subsequent key -> first barline, second -> second, etc.

			// Only output inline key signature if key actually changes
			if (keySig.abcInline !== currentKey) {
				if (barlineIndex < lyricBarlines.length) {
					const barline = lyricBarlines[barlineIndex];
					const barlineFields = barline.fields;
					// Append key signature to barline: "| [K:X major]"
					const currentAbc0 = barlineFields[fieldMap.abc0] || '';
					if (currentAbc0 === '|' || currentAbc0 === '') {
						barlineFields[fieldMap.abc0] = `| ${keySig.abcInline}`;
					} else {
						// If barline already has something, append with space
						barlineFields[fieldMap.abc0] = `${currentAbc0} ${keySig.abcInline}`;
					}
					if (debug) {
						console.error(`Debug: Attached ${keySig.abcInline} to barline at row ${barline.index + 2} (key changed)`);
					}
				} else {
					if (debug) {
						console.error(`Debug: No barline available for key signature ${keySig.fqsKey} (index ${k})`);
					}
				}
				// Update current key
				currentKey = keySig.abcInline;
			} else {
				// Key hasn't changed, skip this inline key signature
				if (debug) {
					console.error(`Debug: Skipping redundant key signature ${keySig.fqsKey} (same as current key)`);
				}
			}
		}

		// Process barlines (for rows without key signatures)
		for (let i = 0; i < rows.length; i++) {
			const fields = rows[i];
			const type = fields[fieldMap.type] || '';
			const value = fields[fieldMap.value] || '';
			const source = fields[fieldMap.source] || '';

			if (type === 'Barline') {
				// Only set if abc0 is empty (not already set by key signature attachment)
				const currentAbc0 = fields[fieldMap.abc0] || '';
				if (currentAbc0 === '') {
					fields[fieldMap.abc0] = value; // value should be '|'
					if (debug && value !== '|') {
						console.error(`Debug: Barline with unexpected value '${value}'`);
					}
				}
			}
		}

		// Output header unchanged
		outputRow(headers);

		// Output all rows
		for (let i = 0; i < rows.length; i++) {
			outputRow(rows[i]);
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
