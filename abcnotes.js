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
 * Process a beat group (rows with same block, measure, beat)
 * @param {Array<Object>} beatRows - Rows in the beat group
 * @returns {Array<Object>} Updated rows with abc0 populated
 */
function processBeatGroup(beatRows) {
	if (beatRows.length === 0) return beatRows;

	// Count subdivisions N
	const N = beatRows.length;

	// Determine tuplet prefix
	let tupletPrefix = '';
	if (N > 1 && N % 2 !== 0) {
		tupletPrefix = `(${N}`;
	}

	// Determine duration denominator
	let durationDenom;
	if (isPowerOfTwo(N)) {
		durationDenom = N;
	} else {
		durationDenom = largestPowerOfTwoLessThan(N);
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

		// Duration (omit if denominator is 1, which means quarter note with L:1/4)
		if (durationDenom !== 1) {
			noteStr += `/${durationDenom}`;
		}

		noteStrings.push(noteStr);
	}

	// Concatenate all notes in the beat without spaces
	const beatABC = noteStrings.join('');

	// Store in abc0 of first row, leave others empty
	beatRows[0].abc0 = beatABC;

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

		const updatedRows = processBeatGroup(beatRows);

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
