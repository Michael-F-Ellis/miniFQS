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
// Attack Detection and Pitch Mapping Functions
// =============================================================================

/**
 * Check if a lyric row represents an attack (syllable or asterisk).
 * Based on isAttackSegment from abc-converter.js.
 * @param {Array<string>} fields - TSV row fields
 * @param {Object} fieldMap - mapping from column name to index
 * @returns {boolean} true if the row is an attack
 */
function isAttackRow(fields, fieldMap) {
	if (fields[fieldMap.source] !== 'lyrics') {
		return false;
	}
	const type = fields[fieldMap.type];
	const value = fields[fieldMap.value] || '';

	// Syllable is always an attack
	if (type === 'Syllable') {
		return true;
	}
	// Special: asterisk is an attack
	if (type === 'Special' && value === '*') {
		return true;
	}
	return false;
}

/**
 * Check if a pitch row is a consumable pitch (not KeySig or Barline).
 * @param {Array<string>} fields - TSV row fields
 * @param {Object} fieldMap - mapping from column name to index
 * @returns {boolean} true if the row is a consumable pitch
 */
function isConsumablePitch(fields, fieldMap) {
	if (fields[fieldMap.source] !== 'pitches') {
		return false;
	}
	const type = fields[fieldMap.type];
	return type === 'Pitch';
}

/**
 * Get the next consumable pitch from the pitch rows.
 * @param {Array<Array<string>>} allRows - all TSV rows
 * @param {Object} fieldMap - mapping from column name to index
 * @param {number} pitchIndex - current index in allRows
 * @returns {Object} {fields: pitch row fields, index: new pitch index} or null
 */
function getNextPitch(allRows, fieldMap, pitchIndex) {
	while (pitchIndex < allRows.length) {
		const fields = allRows[pitchIndex];
		if (isConsumablePitch(fields, fieldMap)) {
			return { fields, index: pitchIndex + 1 };
		}
		pitchIndex++;
	}
	return null;
}

/**
 * Copy pitch information from a pitch row to a lyric row.
 * @param {Array<string>} lyricFields - lyric row fields (modified in place)
 * @param {Array<string>} pitchFields - pitch row fields
 * @param {Object} fieldMap - mapping from column name to index
 */
function copyPitchInfo(lyricFields, pitchFields, fieldMap) {
	// Copy pitch_note, pitch_acc, pitch_oct from pitch row to lyric row
	const pitchNoteIdx = fieldMap.pitch_note;
	const pitchAccIdx = fieldMap.pitch_acc;
	const pitchOctIdx = fieldMap.pitch_oct;

	if (pitchNoteIdx !== undefined && pitchNoteIdx < pitchFields.length) {
		lyricFields[pitchNoteIdx] = pitchFields[pitchNoteIdx];
	}
	if (pitchAccIdx !== undefined && pitchAccIdx < pitchFields.length) {
		lyricFields[pitchAccIdx] = pitchFields[pitchAccIdx];
	}
	if (pitchOctIdx !== undefined && pitchOctIdx < pitchFields.length) {
		lyricFields[pitchOctIdx] = pitchFields[pitchOctIdx];
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
		const fieldMap = {};
		headers.forEach((header, index) => {
			fieldMap[header] = index;
		});

		// Store all rows for processing
		const allRows = [];
		for (let i = 0; i < lines.length; i++) {
			allRows.push(lines[i].split('\t'));
		}

		// State for pitch mapping
		let currentBlock = null;
		let pitchIndex = 1; // Start after header row
		let pitchQueue = []; // Store pitches for current block
		let warnings = [];

		// First pass: collect pitches per block
		const blockPitches = {};
		for (let i = 1; i < allRows.length; i++) {
			const fields = allRows[i];
			const block = fields[fieldMap.block] || '';
			const source = fields[fieldMap.source] || '';
			const type = fields[fieldMap.type] || '';

			if (source === 'pitches' && type === 'Pitch') {
				if (!blockPitches[block]) {
					blockPitches[block] = [];
				}
				blockPitches[block].push({
					fields: fields,
					index: i
				});
			}
		}

		// Second pass: map pitches to attacks and replicate to dashes
		let lastPitchFields = null; // Store pitch fields of the most recent attack
		let lastPitchByBlock = {}; // Store last pitch for each block (for cross-block dashes)
		let blockStartsWithDash = {}; // Track which blocks start with a dash
		let previousBlock = null; // Track previous block for cross-block transitions

		// First, detect which blocks start with a dash
		for (let i = 1; i < allRows.length; i++) {
			const fields = allRows[i];
			const block = fields[fieldMap.block] || '';
			const source = fields[fieldMap.source] || '';
			const type = fields[fieldMap.type] || '';
			const value = fields[fieldMap.value] || '';

			if (source === 'lyrics' && !blockStartsWithDash.hasOwnProperty(block)) {
				blockStartsWithDash[block] = (type === 'Special' && value === '-');
			}
		}

		for (let i = 1; i < allRows.length; i++) {
			const fields = allRows[i];
			const block = fields[fieldMap.block] || '';
			const source = fields[fieldMap.source] || '';
			const type = fields[fieldMap.type] || '';
			const value = fields[fieldMap.value] || '';

			// Handle block transitions
			if (block !== currentBlock) {
				previousBlock = currentBlock;
				currentBlock = block;
				pitchQueue = blockPitches[block] || [];

				// Check if this block starts with a dash
				if (blockStartsWithDash[block]) {
					// Block starts with dash: carry over last pitch from previous block if available
					if (previousBlock && lastPitchByBlock[previousBlock]) {
						lastPitchFields = lastPitchByBlock[previousBlock];
						if (debug) {
							const pitchNote = lastPitchFields[fieldMap.pitch_note] || '';
							const pitchOct = lastPitchFields[fieldMap.pitch_oct] || '';
							console.error(`Debug: Block ${block} starts with dash, carrying over pitch ${pitchNote}${pitchOct} from block ${previousBlock}`);
						}
					} else {
						lastPitchFields = null;
						if (debug) {
							console.error(`Debug: Block ${block} starts with dash but no previous pitch available`);
						}
					}
				} else {
					// Block doesn't start with dash: reset last pitch
					lastPitchFields = null;
				}

				if (debug && block) {
					console.error(`Debug: Block ${block} has ${pitchQueue.length} pitches, starts with dash: ${blockStartsWithDash[block]}`);
				}
			}

			// Only process lyric rows
			if (source === 'lyrics') {
				if (isAttackRow(fields, fieldMap)) {
					// This is an attack, consume next pitch
					if (pitchQueue.length > 0) {
						const pitch = pitchQueue.shift();
						copyPitchInfo(fields, pitch.fields, fieldMap);
						lastPitchFields = pitch.fields; // Remember this pitch for dashes
						// Store this pitch for the current block
						lastPitchByBlock[block] = pitch.fields;

						if (debug) {
							const pitchNote = pitch.fields[fieldMap.pitch_note] || '';
							const pitchOct = pitch.fields[fieldMap.pitch_oct] || '';
							console.error(`Debug: Mapped attack "${value}" to pitch ${pitchNote}${pitchOct} in block ${block}`);
						}
					} else {
						warnings.push(`Warning: No pitch available for attack "${value}" in block ${block}`);
						lastPitchFields = null; // No pitch available
					}
				} else if (type === 'Special' && value === '-') {
					// Dash: replicate pitch from last attack if available
					if (lastPitchFields) {
						copyPitchInfo(fields, lastPitchFields, fieldMap);
						if (debug) {
							const pitchNote = lastPitchFields[fieldMap.pitch_note] || '';
							const pitchOct = lastPitchFields[fieldMap.pitch_oct] || '';
							console.error(`Debug: Replicated pitch ${pitchNote}${pitchOct} to dash in block ${block}`);
						}
					} else {
						// No preceding attack with pitch (should not happen in valid FQS)
						if (debug) {
							console.error(`Debug: Dash with no preceding attack pitch in block ${block}`);
						}
					}
				} else if (type === 'Special' && value === ';') {
					// Rest: reset last pitch (rest doesn't extend previous note)
					lastPitchFields = null;
				}
				// Other lyric rows (barlines, equals signs) don't affect last pitch
			}
		}

		// Output warnings if any
		if (warnings.length > 0) {
			warnings.forEach(warning => console.error(warning));
		}

		// Output all rows (including modified lyric rows)
		outputRow(headers);
		for (let i = 1; i < allRows.length; i++) {
			outputRow(allRows[i]);
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
