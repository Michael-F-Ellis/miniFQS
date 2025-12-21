// Stage 11: Optimize tied notes to dotted notes where appropriate
// Applies heuristics from DottedVsTie.md to improve notation readability

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
 * Optimize tied notes in a beat group
 * @param {Array<Object>} beatRows - Rows in a beat group
 * @param {string} unitNoteLength - Current unit note length (e.g., "1/4")
 * @param {string} meter - Current meter (e.g., "4/4")
 * @param {number} beatNumber - Beat number (1-indexed)
 * @returns {Array<Object>} Updated rows with abc column populated
 */
function optimizeBeatGroup(beatRows, unitNoteLength, meter, beatNumber) {
	if (beatRows.length === 0) return beatRows;

	// Group rows into tied sequences
	const sequences = [];
	let currentSequence = [];

	for (let i = 0; i < beatRows.length; i++) {
		const row = beatRows[i];
		const value = row.value || '';
		const abc0 = row.abc0 || '';

		// Check if this is a rest
		if (value === ';') {
			// End current sequence if any
			if (currentSequence.length > 0) {
				sequences.push([...currentSequence]);
				currentSequence = [];
			}
			// Rest is its own sequence
			sequences.push([row]);
			continue;
		}

		// Check if this is an attack or tie
		if (value === '*' || value === '-') {
			// Check if we should start a new sequence
			if (value === '*' || currentSequence.length === 0) {
				// End previous sequence if any
				if (currentSequence.length > 0) {
					sequences.push([...currentSequence]);
				}
				currentSequence = [row];
			} else {
				// Continue current sequence if same pitch
				const prevRow = currentSequence[currentSequence.length - 1];
				const samePitch = prevRow.pitch_note === row.pitch_note &&
					prevRow.pitch_acc === row.pitch_acc &&
					prevRow.pitch_oct === row.pitch_oct;

				if (samePitch && value === '-') {
					currentSequence.push(row);
				} else {
					// Different pitch or not a tie
					sequences.push([...currentSequence]);
					currentSequence = [row];
				}
			}
		} else {
			// Other value (barline, etc.)
			if (currentSequence.length > 0) {
				sequences.push([...currentSequence]);
				currentSequence = [];
			}
			sequences.push([row]);
		}
	}

	// Add last sequence if any
	if (currentSequence.length > 0) {
		sequences.push([...currentSequence]);
	}

	// Process each sequence
	const optimizedRows = [];

	for (const sequence of sequences) {
		if (sequence.length === 0) continue;

		const firstRow = sequence[0];
		const value = firstRow.value || '';

		// Handle non-note rows (barlines, directives, etc.)
		if (value !== '*' && value !== '-' && value !== ';') {
			// Copy abc0 to abc
			sequence.forEach(row => {
				row.abc = row.abc0 || '';
				optimizedRows.push(row);
			});
			continue;
		}

		// Handle rests
		if (value === ';') {
			// For now, just copy rest as-is
			// TODO: Optimize tied rests
			sequence.forEach(row => {
				row.abc = row.abc0 || '';
				optimizedRows.push(row);
			});
			continue;
		}

		// Handle tied sequences
		if (sequence.length > 1 && sequence.every(r => r.value === '-' || r.value === '*')) {
			// Calculate total duration
			let totalDuration = 0;
			for (const row of sequence) {
				const duration = calculateDuration(row.abc0, unitNoteLength);
				totalDuration += duration;
			}

			// Check if this is a dotted note duration
			// Common dotted durations: 1.5, 0.75, 0.375, etc.
			// But in ABC notation with L:1/4:
			// - Dotted half = 3 (C3)
			// - Dotted quarter = 1.5 (C3/2)
			// - Dotted eighth = 0.75 (C3/4)
			// - Dotted sixteenth = 0.375 (C3/8)

			// Find the best dotted representation
			const unitDenominator = parseInt(unitNoteLength.split('/')[1]);
			let optimizedABC = null;

			// Check for dotted eighth + sixteenth pattern (3+1 sixteenths)
			if (Math.abs(totalDuration - 0.75) < 0.01 && sequence.length === 3) {
				// Three tied sixteenths -> dotted eighth
				// Check beat boundary
				const startSub = parseInt(sequence[0].sub) || 1;
				const subdivisionsPerBeat = beatRows.length;
				const startBeatFraction = beatNumber - 1 + (startSub - 1) / subdivisionsPerBeat;

				if (!wouldCrossBeatBoundary(startBeatFraction, 0.75, meter)) {
					// Create dotted eighth
					const pitch = firstRow.pitch_note || '';
					const octave = parseInt(firstRow.pitch_oct) || 4;
					const accidental = firstRow.pitch_acc || '';

					// Convert pitch to ABC
					let pitchStr = pitch.toUpperCase();
					if (octave === 5) pitchStr = pitch.toLowerCase();
					else if (octave > 5) pitchStr = pitch.toLowerCase() + "'".repeat(octave - 5);
					else if (octave < 4) pitchStr = pitch.toUpperCase() + ",".repeat(4 - octave);

					// Add accidental
					let accStr = '';
					if (accidental === '#') accStr = '^';
					else if (accidental === '##') accStr = '^^';
					else if (accidental === '&') accStr = '_';
					else if (accidental === '&&') accStr = '__';
					else if (accidental === '%') accStr = '=';

					optimizedABC = `${accStr}${pitchStr}3/4`;
				}
			}
			// Check for dotted quarter + eighth pattern (3+2 eighths)
			else if (Math.abs(totalDuration - 1.5) < 0.01 && sequence.length === 3) {
				// Three tied eighths -> dotted quarter
				const startSub = parseInt(sequence[0].sub) || 1;
				const subdivisionsPerBeat = beatRows.length;
				const startBeatFraction = beatNumber - 1 + (startSub - 1) / subdivisionsPerBeat;

				if (!wouldCrossBeatBoundary(startBeatFraction, 1.5, meter)) {
					const pitch = firstRow.pitch_note || '';
					const octave = parseInt(firstRow.pitch_oct) || 4;
					const accidental = firstRow.pitch_acc || '';

					let pitchStr = pitch.toUpperCase();
					if (octave === 5) pitchStr = pitch.toLowerCase();
					else if (octave > 5) pitchStr = pitch.toLowerCase() + "'".repeat(octave - 5);
					else if (octave < 4) pitchStr = pitch.toUpperCase() + ",".repeat(4 - octave);

					let accStr = '';
					if (accidental === '#') accStr = '^';
					else if (accidental === '##') accStr = '^^';
					else if (accidental === '&') accStr = '_';
					else if (accidental === '&&') accStr = '__';
					else if (accidental === '%') accStr = '=';

					optimizedABC = `${accStr}${pitchStr}3/2`;
				}
			}
			// Check for dotted half + quarter pattern (3+1 quarters)
			else if (Math.abs(totalDuration - 3) < 0.01 && sequence.length === 3) {
				// Three tied quarters -> dotted half
				const startSub = parseInt(sequence[0].sub) || 1;
				const subdivisionsPerBeat = beatRows.length;
				const startBeatFraction = beatNumber - 1 + (startSub - 1) / subdivisionsPerBeat;

				if (!wouldCrossBeatBoundary(startBeatFraction, 3, meter)) {
					const pitch = firstRow.pitch_note || '';
					const octave = parseInt(firstRow.pitch_oct) || 4;
					const accidental = firstRow.pitch_acc || '';

					let pitchStr = pitch.toUpperCase();
					if (octave === 5) pitchStr = pitch.toLowerCase();
					else if (octave > 5) pitchStr = pitch.toLowerCase() + "'".repeat(octave - 5);
					else if (octave < 4) pitchStr = pitch.toUpperCase() + ",".repeat(4 - octave);

					let accStr = '';
					if (accidental === '#') accStr = '^';
					else if (accidental === '##') accStr = '^^';
					else if (accidental === '&') accStr = '_';
					else if (accidental === '&&') accStr = '__';
					else if (accidental === '%') accStr = '=';

					optimizedABC = `${accStr}${pitchStr}3`;
				}
			}

			if (optimizedABC) {
				// Apply optimization to first row
				const firstRowCopy = { ...firstRow };
				firstRowCopy.abc = optimizedABC;
				optimizedRows.push(firstRowCopy);

				// Skip the other rows in the sequence (they're absorbed into the dotted note)
				// But we need to handle any following note in the same beat
				// This will be handled by the next sequence
			} else {
				// No optimization, copy abc0 to abc
				sequence.forEach(row => {
					row.abc = row.abc0 || '';
					optimizedRows.push(row);
				});
			}
		} else {
			// Single note or non-optimizable sequence
			sequence.forEach(row => {
				row.abc = row.abc0 || '';
				optimizedRows.push(row);
			});
		}
	}

	return optimizedRows;
}

/**
 * Optimize tied notes to dotted notes where appropriate
 * @param {Array<Object>} rows - Rows from notesStage
 * @returns {Array<Object>} Rows with abc column populated with optimized notation
 */
export function optimizeTiesStage(rows) {
	// Create a copy of rows
	const newRows = rows.map(row => ({ ...row, abc: '' }));

	// Get default unit note length and meter from headers
	let defaultUnitNoteLength = '1/4';
	let defaultMeter = '4/4';

	for (const row of newRows) {
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

	for (const row of newRows) {
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
		for (const row of newRows) {
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

		// Update the rows in newRows
		for (const optimizedRow of optimizedBeatRows) {
			// Find the index of this row in newRows
			const index = newRows.findIndex(r =>
				r.source === optimizedRow.source &&
				r.block === optimizedRow.block &&
				r.meas === optimizedRow.meas &&
				r.beat === optimizedRow.beat &&
				r.sub === optimizedRow.sub &&
				r.value === optimizedRow.value
			);

			if (index !== -1) {
				newRows[index] = optimizedRow;
			}
		}
	}

	// For non-lyric rows, copy abc0 to abc
	for (const row of newRows) {
		if (!row.abc && row.abc0) {
			row.abc = row.abc0;
		}
	}

	return newRows;
}

/**
 * Get optimization statistics
 * @param {Array<Object>} rows - Rows from optimizeTiesStage
 * @returns {Object} Statistics about optimizations
 */
export function getOptimizationStats(rows) {
	const stats = {
		totalNotes: 0,
		tiedSequences: 0,
		optimizedSequences: 0,
		dottedNotesCreated: 0,
		beatBoundaryViolations: 0
	};

	// Count notes with abc column
	for (const row of rows) {
		if (row.source === 'lyrics' && row.abc) {
			stats.totalNotes++;

			// Check for dotted notes in abc
			if (row.abc.match(/\d/)) {
				stats.dottedNotesCreated++;
			}

			// Check for ties in abc0 (original)
			if (row.abc0 && row.abc0.includes('-')) {
				stats.tiedSequences++;
			}
		}
	}

	return stats;
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { optimizeTiesStage, getOptimizationStats };
}
