/**
 * optimize-core.js - Core optimization logic for tied notes
 * 
 * Contains the main optimizeBeatGroup function for converting tied sequences to dotted notes
 */

import {
	calculateDuration,
	wouldCrossBeatBoundary
} from './optimize-helpers.js';

/**
 * Optimize tied notes in a beat group
 * @param {Array<Object>} beatRows - Rows in a beat group
 * @param {string} unitNoteLength - Current unit note length (e.g., "1/4")
 * @param {string} meter - Current meter (e.g., "4/4")
 * @param {number} beatNumber - Beat number (1-indexed)
 * @returns {Array<Object>} Updated rows with abc column populated
 */
export function optimizeBeatGroup(beatRows, unitNoteLength, meter, beatNumber) {
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

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { optimizeBeatGroup };
}
