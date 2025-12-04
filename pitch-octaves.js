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
// Pitch Calculation Functions (LilyPond Rule)
// =============================================================================

// Map letter to numeric index for LilyPond Rule (same as in layout.js)
const PITCH_INDEX = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };

/**
 * Calculate the octave of a pitch relative to the previous pitch using LilyPond Rule.
 * This replicates the logic from layout.js's calculatePitch function, but uses
 * musical octave numbering where 4 = C4 (middle C).
 * @param {Object} current - FQS pitch object {note: 'c', octaveShifts: '^'}
 * @param {Object} prev - Previous pitch state {letter: 'c', octave: 4} where octave is musical octave (4 = C4)
 * @returns {Object} {letter, octave} where octave is musical octave (4 = C4)
 */
function calculatePitch(current, prev) {
	let letter = current.note;
	let octave = prev.octave;

	// LilyPond Rule
	const prevIdx = PITCH_INDEX[prev.letter];
	const currIdx = PITCH_INDEX[letter];
	const diff = currIdx - prevIdx;

	if (diff > 3) octave--;
	else if (diff < -3) octave++;

	// Explicit Modifiers
	if (current.octaveShifts) {
		for (let char of current.octaveShifts) {
			if (char === '^') octave++;
			if (char === '/') octave--;
		}
	}

	return { letter, octave };
}

/**
 * Parse a pitch row into a pitch object
 * @param {Array<string>} fields - TSV row fields
 * @param {Array<string>} headers - column headers
 * @returns {Object|null} pitch object or null if not a pitch row
 */
function parsePitchRow(fields, headers) {
	// Create a map of field name to index
	const fieldMap = {};
	headers.forEach((header, index) => {
		fieldMap[header] = index;
	});

	// Check if this is a pitch row
	if (fields[fieldMap.source] !== 'pitches' || fields[fieldMap.type] !== 'Pitch') {
		return null;
	}

	const note = fields[fieldMap.pitch_note] || '';
	if (!note) return null;

	return {
		note: note.toLowerCase(),
		octaveShifts: fields[fieldMap.pitch_oct] || '',
		accidental: fields[fieldMap.pitch_acc] || '',
		// Store the row index for updating later
		rowIndex: -1 // will be set by caller
	};
}

/**
 * Update the pitch_oct field in a row
 * @param {Array<string>} fields - TSV row fields
 * @param {Array<string>} headers - column headers
 * @param {number} octave - musical octave (4 = C4)
 */
function updatePitchOctave(fields, headers, octave) {
	const pitchOctIndex = headers.indexOf('pitch_oct');
	if (pitchOctIndex !== -1) {
		fields[pitchOctIndex] = octave.toString();
	}
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
		const outputRows = [lines[0]]; // Keep header as-is

		// State for pitch calculation
		let currentBlock = null;
		let prevPitchState = { letter: 'c', octave: 4 }; // Start at C4 (middle C)
		let pitchRows = []; // Store pitch rows for processing

		// First pass: collect pitch rows and their positions
		for (let i = 1; i < lines.length; i++) {
			const fields = lines[i].split('\t');
			const block = fields[headers.indexOf('block')] || '';

			// Reset pitch state when block changes
			if (block !== currentBlock) {
				currentBlock = block;
				prevPitchState = { letter: 'c', octave: 4 }; // Reset to C4 for new block
			}

			const pitch = parsePitchRow(fields, headers);
			if (pitch) {
				pitch.rowIndex = i;
				pitch.fields = fields;
				pitch.block = block;
				pitchRows.push(pitch);
			}

			// Store the row for later output
			outputRows.push(fields);
		}

		// Second pass: calculate octaves for pitch rows
		currentBlock = null;
		prevPitchState = { letter: 'c', octave: 4 };

		for (const pitch of pitchRows) {
			// Reset pitch state when block changes
			if (pitch.block !== currentBlock) {
				currentBlock = pitch.block;
				prevPitchState = { letter: 'c', octave: 4 };
			}

			// Calculate octave
			const calculated = calculatePitch(pitch, prevPitchState);
			prevPitchState = calculated;

			// Update the row in outputRows
			updatePitchOctave(outputRows[pitch.rowIndex], headers, calculated.octave);

			if (debug) {
				console.error(`Debug: Pitch ${pitch.note} with shifts "${pitch.octaveShifts}" -> octave ${calculated.octave}`, {
					block: pitch.block,
					prevLetter: prevPitchState.letter,
					prevOctave: prevPitchState.octave
				});
			}
		}

		// Output all rows
		outputRows.forEach(row => {
			if (Array.isArray(row)) {
				outputRow(row);
			} else {
				console.log(row); // Header line
			}
		});
	});
}

// =============================================================================
// Main Execution
// =============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
	processTSV();
}

export default processTSV;
