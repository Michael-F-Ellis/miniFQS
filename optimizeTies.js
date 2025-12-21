#!/usr/bin/env node

/**
 * optimizeTies.js - Command-line utility to optimize tied notes to dotted notes
 * 
 * Reads TSV from stdin (after notes.js)
 * Applies optimization heuristics from DottedVsTie.md
 * Writes TSV with abc column populated with optimized notation
 */

import { createInterface } from 'readline';

// -----------------------------------------------------------------------------
// Helper Functions (copied from browser-pipeline/stages/optimize.js)
// -----------------------------------------------------------------------------

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

	return null;
}

/**
 * Extract meter from abc0 column value
 * @param {string} abc0 - abc0 column value
 * @returns {string|null} Meter (e.g., "4/4", "3/4", "6/8") or null if not found
 */
function extractMeter(abc0) {
	if (!abc0) return null;

	// Look for [M:...] pattern
	const match = abc0.match(/\[M:([^\]\s]+)\]/);
	if (match) {
		return match[1];
	}

	// Look for M: header value
	if (abc0.includes('M:')) {
		const parts = abc0.split('M:');
		if (parts.length > 1) {
			return parts[1].trim().split(/\s/)[0];
		}
	}

	return null;
}

/**
 * Parse duration denominator from ABC note string
 * @param {string} noteStr - ABC note string (e.g., "C/4", "C", "C3/4")
 * @returns {number} Duration denominator (1 for whole note, 4 for quarter, etc.)
 */
function parseDurationDenominator(noteStr) {
	if (!noteStr) return 1;

	// Check for explicit duration like C3/4 or C/4
	// First check for dotted note with denominator: C3/4
	const dottedMatch = noteStr.match(/(\d+)\/(\d+)$/);
	if (dottedMatch) {
		return parseInt(dottedMatch[2]);
	}

	// Check for simple denominator: C/4
	const simpleMatch = noteStr.match(/\/(\d+)$/);
	if (simpleMatch) {
		return parseInt(simpleMatch[1]);
	}

	// Default: no denominator means duration 1 (whole note relative to L:)
	return 1;
}

/**
 * Calculate duration in "L units" for a note
 * @param {string} noteStr - ABC note string
 * @param {string} unitNoteLength - Unit note length (e.g., "1/4")
 * @returns {number} Duration in units (e.g., 0.25 for sixteenth with L:1/4)
 */
function calculateDuration(noteStr, unitNoteLength) {
	if (!noteStr) return 0;

	// Parse unit denominator from unitNoteLength (e.g., "1/4" -> 4)
	const unitMatch = unitNoteLength.match(/\/(\d+)/);
	if (!unitMatch) return 0;
	const unitDenominator = parseInt(unitMatch[1]);

	// Parse note duration denominator
	const noteDenominator = parseDurationDenominator(noteStr);

	// Calculate duration ratio
	// With L:1/4 (unitDenominator=4):
	// - C (no denominator) = 1 whole note = 4 quarters = 4 units
	// - C/4 = quarter note = 1 unit
	// - C/8 = eighth note = 0.5 units
	const duration = unitDenominator / noteDenominator;

	// Check for dotted note (number before slash or at end)
	const dottedMatch = noteStr.match(/(\d+)(?:\/|$)/);
	if (dottedMatch) {
		const dottedValue = parseInt(dottedMatch[1]);
		// Dotted note duration = base duration * 1.5
		// But ABC notation: C3 = dotted half (when L:1/4, half=2, dotted=3)
		// Actually C3 means duration 3 (in L units)
		// So we should use the dotted value directly
		return dottedValue;
	}

	return duration;
}

/**
 * Check if a duration would cross a beat boundary
 * @param {number} startBeat - Starting beat (1-indexed, can be fractional)
 * @param {number} duration - Duration in beats
 * @param {string} meter - Meter (e.g., "4/4", "3/4")
 * @returns {boolean} True if would cross a beat boundary in a problematic way
 */
function wouldCrossBeatBoundary(startBeat, duration, meter) {
	const endBeat = startBeat + duration;

	// Parse meter
	const meterMatch = meter.match(/(\d+)\/(\d+)/);
	if (!meterMatch) return false;
	const numerator = parseInt(meterMatch[1]);
	const denominator = parseInt(meterMatch[2]);

	// For simple meters (denominator 4), check each beat boundary
	if (denominator === 4) {
		// Check each whole beat boundary
		for (let beat = Math.ceil(startBeat); beat < endBeat; beat++) {
			// In 4/4, also check the imaginary barline between beats 2 and 3
			if (numerator === 4 && beat === 2.5) {
				// Crossing the middle of 4/4 measure
				return true;
			}
			// Crossing any whole beat boundary
			if (beat % 1 === 0 && beat <= numerator) {
				return true;
			}
		}
	}
	// For compound meters (denominator 8), check main beat boundaries
	else if (denominator === 8) {
		// In 6/8, main beats are at 1 and 4 (dotted quarters)
		// Each main beat = 3 eighth notes
		const mainBeatInterval = 3; // in eighth notes
		for (let beat = Math.ceil(startBeat * 3); beat < endBeat * 3; beat++) {
			if (beat % mainBeatInterval === 0) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Parse ABC note string into individual note tokens
 * @param {string} abcString - ABC note string (e.g., "C/4-C/4-C/4C/4")
 * @returns {Array<Object>} Array of note tokens with properties
 */
function parseABCNotes(abcString) {
	if (!abcString) return [];

	const tokens = [];
	let i = 0;
	const length = abcString.length;

	while (i < length) {
		let token = '';
		let isNote = false;
		let isRest = false;

		// Check for tuplet prefix
		if (abcString[i] === '(') {
			// Tuplet prefix like "(3"
			let tuplet = '(';
			i++;
			while (i < length && /\d/.test(abcString[i])) {
				tuplet += abcString[i];
				i++;
			}
			token = tuplet;
			tokens.push({ type: 'tuplet', value: token });
			continue;
		}

		// Check for tie
		if (abcString[i] === '-') {
			token = '-';
			i++;
			tokens.push({ type: 'tie', value: token });
			continue;
		}

		// Check for rest
		if (abcString[i] === 'z') {
			token = 'z';
			i++;
			isRest = true;
			isNote = true;
		}
		// Check for accidental
		else if (abcString[i] === '^' || abcString[i] === '_' || abcString[i] === '=') {
			// Single accidental
			token = abcString[i];
			i++;
			// Check for double accidental
			if (i < length && abcString[i] === abcString[i - 1]) {
				token += abcString[i];
				i++;
			}
			// Now get the pitch
			while (i < length && /[a-gA-G]/.test(abcString[i])) {
				token += abcString[i];
				i++;
			}
			isNote = true;
		}
		// Check for pitch
		else if (/[a-gA-G]/.test(abcString[i])) {
			while (i < length && /[a-gA-G,'`,]/.test(abcString[i])) {
				token += abcString[i];
				i++;
			}
			isNote = true;
		}

		// Check for duration
		if (isNote && i < length && abcString[i] === '/') {
			token += '/';
			i++;
			while (i < length && /\d/.test(abcString[i])) {
				token += abcString[i];
				i++;
			}
		}
		// Check for dotted duration (number without slash)
		else if (isNote && i < length && /\d/.test(abcString[i])) {
			while (i < length && /\d/.test(abcString[i])) {
				token += abcString[i];
				i++;
			}
		}

		if (token) {
			if (isRest) {
				tokens.push({ type: 'rest', value: token });
			} else if (isNote) {
				tokens.push({ type: 'note', value: token });
			} else {
				tokens.push({ type: 'unknown', value: token });
			}
		} else {
			// Skip unknown character
			i++;
		}
	}

	return tokens;
}

/**
 * Optimize ABC note string by converting tied sequences to dotted notes
 * @param {string} abcString - Original ABC note string
 * @param {string} unitNoteLength - Unit note length (e.g., "1/4")
 * @param {string} meter - Meter (e.g., "4/4")
 * @param {number} beatNumber - Beat number (1-indexed)
 * @param {number} startSub - Starting subdivision (1-indexed)
 * @param {number} subdivisionsPerBeat - Total subdivisions in beat
 * @returns {string} Optimized ABC string
 */
function optimizeABCString(abcString, unitNoteLength, meter, beatNumber, startSub, subdivisionsPerBeat) {
	if (!abcString) return abcString;

	// Parse into tokens
	const tokens = parseABCNotes(abcString);
	if (tokens.length === 0) return abcString;

	// Group tokens into sequences
	const sequences = [];
	let currentSequence = [];

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];

		if (token.type === 'tie') {
			// Tie continues current sequence
			if (currentSequence.length > 0) {
				currentSequence.push(token);
			}
			// If no current sequence, start one with just a tie? This shouldn't happen
		} else if (token.type === 'note' || token.type === 'rest') {
			// Check if previous token was a tie
			if (i > 0 && tokens[i - 1].type === 'tie') {
				// This note is tied to previous note
				currentSequence.push(token);
			} else {
				// Start new sequence
				if (currentSequence.length > 0) {
					sequences.push([...currentSequence]);
				}
				currentSequence = [token];
			}
		} else if (token.type === 'tuplet') {
			// Tuplet starts a new sequence
			if (currentSequence.length > 0) {
				sequences.push([...currentSequence]);
			}
			currentSequence = [token];
		} else {
			// Other token (unknown)
			if (currentSequence.length > 0) {
				sequences.push([...currentSequence]);
				currentSequence = [];
			}
			sequences.push([token]);
		}
	}

	// Add last sequence
	if (currentSequence.length > 0) {
		sequences.push([...currentSequence]);
	}

	// Process each sequence
	const optimizedTokens = [];

	for (const sequence of sequences) {
		if (sequence.length === 0) continue;

		// Check if this is a tied sequence (starts with note, has ties, ends with note)
		const firstToken = sequence[0];
		if (firstToken.type === 'note' || firstToken.type === 'rest') {
			// Count ties and notes in sequence
			let noteCount = 0;
			let tieCount = 0;
			for (const token of sequence) {
				if (token.type === 'note' || token.type === 'rest') noteCount++;
				if (token.type === 'tie') tieCount++;
			}

			// If we have ties and multiple notes, check for optimization
			if (tieCount > 0 && noteCount > 1) {
				// Calculate total duration
				let totalDuration = 0;
				for (const token of sequence) {
					if (token.type === 'note' || token.type === 'rest') {
						const duration = calculateDuration(token.value, unitNoteLength);
						totalDuration += duration;
					}
				}

				// Check for dotted note patterns
				let optimizedNote = null;

				// Check for dotted eighth + sixteenth pattern (3+1 sixteenths)
				if (Math.abs(totalDuration - 0.75) < 0.01 && noteCount === 3) {
					// Three tied sixteenths -> dotted eighth
					// Check beat boundary
					const startBeatFraction = beatNumber - 1 + (startSub - 1) / subdivisionsPerBeat;

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

						// Get default unit note length and meter from headers
						let defaultUnitNoteLength = '1/4';
						let defaultMeter = '4/4';

						for (const row of rows) {
							if (row.source === 'abchdr') {
								if (row.value === 'L:') {
									defaultUnitNoteLength = row.abc0 || '1/4';
								} else if (row.value === 'M:') {
									defaultMeter = row.abc0 || '4/4';
								}
							}
						}

						// Group rows by (block, measure, beat) for lyric rows
						const beatGroups = new Map(); // key -> array of rows

						for (const row of rows) {
							if (row.source === 'lyrics' && row.meas !== undefined && row.meas !== '' && row.beat) {
								const key = `${row.block || '1'}-${row.meas}-${row.beat}`;
								if (!beatGroups.has(key)) {
									beatGroups.set(key, []);
								}
								beatGroups.get(key).push(row);
							}
						}

						// Process each beat group
						for (const [key, beatRows] of beatGroups.entries()) {
							// Parse key to get block, measure, beat
							const [block, meas, beat] = key.split('-').map(Number);

							// Get unit note length and meter for this measure
							let unitNoteLength = defaultUnitNoteLength;
							let meter = defaultMeter;

							// Look for measure-specific directives in the rows
							for (const row of beatRows) {
								const abc0 = row.abc0 || '';
								const extractedUnit = extractUnitNoteLength(abc0);
								const extractedMeter = extractMeter(abc0);

								if (extractedUnit) unitNoteLength = extractedUnit;
								if (extractedMeter) meter = extractedMeter;
							}

							// Also check for meter changes in the measure
							// Look for rows with [M:...] in abc0
							for (const row of rows) {
								if (row.source === 'lyrics' && row.meas === meas.toString()) {
									const abc0 = row.abc0 || '';
									const extractedMeter = extractMeter(abc0);
									if (extractedMeter) meter = extractedMeter;
								}
							}

							// Sort beat rows by subdivision
							beatRows.sort((a, b) => {
								const subA = a.sub ? parseInt(a.sub) : 1;
								const subB = b.sub ? parseInt(b.sub) : 1;
								return subA - subB;
							});

							// Optimize this beat group
							const optimizedBeatRows = optimizeBeatGroup(beatRows, unitNoteLength, meter, beat);

							// Update the rows in rows array
							for (const optimizedRow of optimizedBeatRows) {
								// Find the index of this row in rows
								const index = rows.findIndex(r =>
									r.source === optimizedRow.source &&
									r.block === optimizedRow.block &&
									r.meas === optimizedRow.meas &&
									r.beat === optimizedRow.beat &&
									r.sub === optimizedRow.sub &&
									r.value === optimizedRow.value
								);

								if (index !== -1) {
									rows[index] = optimizedRow;
								}
							}
						}

						// For non-lyric rows, copy abc0 to abc
						for (const row of rows) {
							if (!row.abc && row.abc0) {
								row.abc = row.abc0;
							}
						}

						// Output header
						console.log(headers.join('\t'));

						// Output rows
						for (const row of rows) {
							console.log(toTSVLine(row, headers));
						}
					}

					// Run main
					main().catch(err => {
						console.error('Error:', err);
						process.exit(1);
					});
