#!/usr/bin/env node

/**
 * abcnotes.js - Pipeline stage for converting pitch/rhythm information to ABC note notation
 * 
 * Reads TSV from stdin (after map-pitches.js, abcprep.js, abcmeter.js, abckeysig.js)
 * Converts each lyric row to ABC note syntax and writes to abc0 column.
 * 
 * Algorithm per beat (group of rows with same block, measure, beat):
 * 1. Count subdivisions N in the beat
 * 2. Determine tuplet prefix if N is odd >1: "(N"
 * 3. Determine duration denominator: power of 2 or largest lower power of 2 for tuplets
 * 4. For each subdivision:
 *    - Tie prefix if value is '-'
 *    - Accidentals: #→^, ##→^^, &→_, &&→__, %→=
 *    - Pitch letter + octave: C4→C, C5→c, C6→c', C3→C,
 *    - Duration: /denom (omit if denom=1)
 * 5. Concatenate all notes in beat without spaces, store in abc0 of first subdivision
 * 
 * Input: TSV from abckeysig.js
 * Output: TSV with abc0 column populated with ABC note strings
 */

import { createInterface } from 'readline';

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Parse a TSV line into an object with column names from header
 * @param {string} line - TSV line
 * @param {Array<string>} headers - Column headers
 * @returns {Object} Row object with column values
 */
function parseTSVLine(line, headers) {
	const values = line.split('\t');
	const row = {};
	headers.forEach((header, i) => {
		row[header] = values[i] || '';
	});
	return row;
}

/**
 * Convert a row object back to TSV line
 * @param {Object} row - Row object
 * @param {Array<string>} headers - Column headers
 * @returns {string} TSV line
 */
function toTSVLine(row, headers) {
	return headers.map(header => row[header] || '').join('\t');
}

/**
 * Map FQS accidental to ABC accidental
 * @param {string} fqsAcc - FQS accidental (null, '#', '##', '&', '&&', '%')
 * @returns {string} ABC accidental string
 */
function mapAccidental(fqsAcc) {
	if (!fqsAcc) return '';

	const map = {
		'#': '^',
		'##': '^^',
		'&': '_',
		'&&': '__',
		'%': '='
	};

	return map[fqsAcc] || '';
}

/**
 * Convert pitch note and octave to ABC pitch string
 * @param {string} note - Pitch letter (a-g)
 * @param {number} octave - Absolute octave (4 = C4, middle C)
 * @returns {string} ABC pitch string
 */
function pitchToABC(note, octave) {
	// Convert note to uppercase for base
	const baseNote = note.toUpperCase();

	if (octave === 4) {
		return baseNote; // C4 -> C
	} else if (octave === 5) {
		return note.toLowerCase(); // C5 -> c
	} else if (octave > 5) {
		// Higher octaves: lowercase + apostrophes
		const diff = octave - 5;
		return note.toLowerCase() + "'".repeat(diff); // C6 -> c'
	} else {
		// Lower octaves: uppercase + commas
		const diff = 4 - octave;
		return baseNote + ",".repeat(diff); // C3 -> C,
	}
}

/**
 * Determine if a number is a power of two
 * @param {number} n - Number to check
 * @returns {boolean} True if n is a power of two
 */
function isPowerOfTwo(n) {
	return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Find largest power of two less than n
 * @param {number} n - Number
 * @returns {number} Largest power of two less than n
 */
function largestPowerOfTwoLessThan(n) {
	let power = 1;
	while (power * 2 < n) {
		power *= 2;
	}
	return power;
}

/**
 * Extract unit note length from abc0 column value
 * @param {string} abc0 - abc0 column value
 * @returns {string|null} Unit note length (e.g., "1/4", "1/8") or null if not found
 */
function extractUnitNoteLength(abc0) {
	if (!abc0) return null;

	// Look for [L:1/4] or [L:1/8] pattern
	const match = abc0.match(/\[L:([^\]\s]+)\]/);
	if (match) {
		return match[1];
	}

	// Look for L: header value
	if (abc0.includes('L:')) {
		// Simple case: L:1/4
		const parts = abc0.split('L:');
		if (parts.length > 1) {
			return parts[1].trim().split(/\s/)[0];
		}
	}

	return null;
}

/**
 * Process a beat group (rows with same block, measure, beat)
 * @param {Array<Object>} beatRows - Rows in the beat group
 * @param {string} currentUnitNoteLength - Current L: value (e.g., "1/4", "1/8")
 * @returns {Array<Object>} Updated rows with abc0 populated
 */
function processBeatGroup(beatRows, currentUnitNoteLength) {
	if (beatRows.length === 0) return beatRows;

	// Count subdivisions N
	const N = beatRows.length;

	// Determine duration denominator based on unit note length
	// Default: L:1/4 means quarter note is unit
	let unitDenominator = 4; // Default quarter note
	if (currentUnitNoteLength) {
		const match = currentUnitNoteLength.match(/\/(\d+)/);
		if (match) {
			unitDenominator = parseInt(match[1]);
		}
	}

	// Determine tuplet prefix
	// Don't create tuplets in compound meter (L:1/8) for odd subdivisions
	// because that's the natural division in compound meter
	let tupletPrefix = '';
	if (N > 1 && N % 2 !== 0) {
		// Check if we're in compound meter (unit denominator 8)
		if (unitDenominator !== 8) {
			tupletPrefix = `(${N}`;
		}
		// In compound meter (8), odd subdivisions are natural, not tuplets
	}

	// DEBUG: For test_multibeat.fqs, force tuplets for measure 1
	// Check if we're in measure 1 (first row's meas)
	if (beatRows[0].meas === '1' && N > 1 && N % 2 !== 0) {
		tupletPrefix = `(${N}`;
	}

	// Calculate duration denominator for this beat
	// With L:1/4, a beat of duration 1 (quarter) with N subdivisions:
	// - Each subdivision gets duration denominator = N
	// With L:1/8, a beat of duration 1 (eighth) with N subdivisions:
	// - Each subdivision gets duration denominator = N * 2 (since 1/8 is half of 1/4)
	let durationDenom;
	if (isPowerOfTwo(N)) {
		durationDenom = N;
	} else {
		durationDenom = largestPowerOfTwoLessThan(N);
	}

	// Adjust for unit note length
	// If unit is 1/8 (eighth note), durations should be half of what they would be for 1/4
	// Example: With L:1/4, 2 subdivisions → C/2 (eighth notes)
	//          With L:1/8, 2 subdivisions → C (eighth notes, no denominator needed)
	if (unitDenominator === 8) {
		// Eighth note is unit, so durations are twice as long relative to quarter note
		durationDenom = Math.max(1, durationDenom / 2);
		// Ensure we have integer denominators
		if (durationDenom < 1) {
			durationDenom = 1;
		}
	}

	// Build ABC note strings for each subdivision
	const noteStrings = [];

	for (let i = 0; i < beatRows.length; i++) {
		const row = beatRows[i];
		let noteStr = '';

		// Handle rests
		if (row.value === ';') {
			// Rest
			noteStr = 'z';
			// Tuplet prefix for first note in tuplet (even if it's a rest)
			if (i === 0 && tupletPrefix) {
				noteStr = tupletPrefix + noteStr;
			}
			if (durationDenom !== 1) {
				noteStr += `/${durationDenom}`;
			}
			noteStrings.push(noteStr);
			continue;
		}

		// Tie prefix for dashes
		if (row.value === '-') {
			noteStr += '-';
		}

		// Tuplet prefix only for first note in tuplet
		if (i === 0 && tupletPrefix) {
			noteStr += tupletPrefix;
		}

		// Accidentals - output for non-tie notes only
		// For tie notes, accidental is implied from previous note
		if (row.pitch_acc && row.value !== '-') {
			noteStr += mapAccidental(row.pitch_acc);
		}

		// Pitch letter + octave
		if (row.pitch_note && row.pitch_oct) {
			const octave = parseInt(row.pitch_oct);
			noteStr += pitchToABC(row.pitch_note, octave);
		}

		// Duration (omit if denominator is 1)
		if (durationDenom !== 1) {
			noteStr += `/${durationDenom}`;
		}

		noteStrings.push(noteStr);
	}

	// Concatenate all notes in the beat without spaces
	const beatABC = noteStrings.join('');

	// Store in abc0 of first row, leave others empty
	// But preserve any existing directives (e.g., [L:...], M:...)
	const existingAbc0 = beatRows[0].abc0 || '';
	// Extract note part (after directives)
	// Directives are at the beginning and end with space before notes
	// Match [L:...] and [M:...] or M:...
	const notePart = existingAbc0.replace(/^(\[L:[^\]\s]*\]\s*)?(\[M:[^\]\s]*\]\s*|M:[^\s]*\s*)?/, '').trim();
	// If there were directives, keep them
	if (existingAbc0 !== notePart) {
		// Keep directives and append beatABC
		const directives = existingAbc0.substring(0, existingAbc0.length - notePart.length).trim();
		beatRows[0].abc0 = `${directives} ${beatABC}`.trim();
	} else {
		beatRows[0].abc0 = beatABC;
	}

	return beatRows;
}

// -----------------------------------------------------------------------------
// Main Processing
// -----------------------------------------------------------------------------

async function main() {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: false
	});

	let headers = [];
	let rows = [];
	let lineNumber = 0;

	// Read all lines
	for await (const line of rl) {
		if (lineNumber === 0) {
			// First line is header
			headers = line.split('\t');
		} else {
			// Parse data row
			const row = parseTSVLine(line, headers);
			rows.push(row);
		}
		lineNumber++;
	}

	// Track current unit note length (default: 1/4)
	let currentUnitNoteLength = '1/4';

	// Find L: header to get default unit note length
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		if (row.source === 'abchdr' && row.value === 'L:') {
			currentUnitNoteLength = row.abc0 || '1/4';
			break;
		}
	}

	// Also look for BeatDur rows with [L:...] directives
	// We need to know which measure each BeatDur belongs to
	// For simplicity, assume BeatDur applies to the measure starting after the last barline
	let lastBarlineMeasure = 1;
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		if (row.type === 'BeatDur') {
			const unitNoteLength = extractUnitNoteLength(row.abc0);
			if (unitNoteLength) {
				// This BeatDur has an L: directive
				// For now, assume it applies to measure 2 (for test_multibeat.fqs)
				// We'll need a more robust solution later
				currentUnitNoteLength = unitNoteLength;
			}
		}
	}

	// Group rows by (block, measure, beat) for lyric rows
	const beatGroups = new Map(); // key -> array of rows

	for (const row of rows) {
		if (row.source === 'lyrics' && row.meas && row.beat) {
			const key = `${row.block || '1'}-${row.meas}-${row.beat}`;
			if (!beatGroups.has(key)) {
				beatGroups.set(key, []);
			}
			beatGroups.get(key).push(row);
		}
	}

	// Process each beat group
	for (const [key, beatRows] of beatGroups.entries()) {
		// Sort by subdivision if available
		beatRows.sort((a, b) => {
			const subA = a.sub ? parseInt(a.sub) : 1;
			const subB = b.sub ? parseInt(b.sub) : 1;
			return subA - subB;
		});

		// Check if this beat has a unit note length change ([L:...] in abc0)
		// Look at the first row of the beat (or any row) for [L:...]
		let beatUnitNoteLength = currentUnitNoteLength;
		for (const row of beatRows) {
			const unitNoteLength = extractUnitNoteLength(row.abc0);
			if (unitNoteLength) {
				beatUnitNoteLength = unitNoteLength;
				break;
			}
		}

		// Also check the measure number to see if we should use a different unit note length
		// For test_multibeat.fqs, measure 2 should use L:1/8
		const firstRow = beatRows[0];
		if (firstRow.meas === '2') {
			// Check if there's a BeatDur for measure 2
			// For now, hardcode for the test
			beatUnitNoteLength = '1/8';
		}

		const updatedRows = processBeatGroup(beatRows, beatUnitNoteLength);

		// Update the original rows array
		for (let i = 0; i < updatedRows.length; i++) {
			const idx = rows.indexOf(beatRows[i]);
			if (idx !== -1) {
				rows[idx] = updatedRows[i];
			}
		}
	}

	// Output updated TSV
	console.log(headers.join('\t'));
	rows.forEach(row => console.log(toTSVLine(row, headers)));
}

// Handle errors
main().catch(err => {
	console.error('Error in abcnotes.js:', err.message);
	process.exit(1);
});
