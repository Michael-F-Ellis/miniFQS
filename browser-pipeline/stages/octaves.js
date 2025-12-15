// Stage 3: Calculate absolute octaves using LilyPond Rule
// Adapts pitch-octaves.js functionality for browser use

import { PITCH_INDEX, calculatePitch } from '../utils.js';

/**
 * Calculate absolute octaves for all pitches
 * @param {Array<Object>} rows - Rows from flattenStage
 * @returns {Array<Object>} Rows with pitch_oct populated
 */
export function octavesStage(rows) {
	// Create a copy of rows to avoid mutation
	const newRows = rows.map(row => ({ ...row }));

	// State for pitch calculation
	let currentBlock = null;
	let prevPitchState = { letter: 'c', octave: 4 }; // Start at C4 (middle C)
	let blockStartsWithDash = {}; // Track which blocks start with a dash

	// First pass: analyze all rows to detect block starts with dashes
	for (const row of newRows) {
		const block = row.block || '';
		const source = row.source || '';
		const type = row.type || '';
		const value = row.value || '';

		// Check if this is the first lyric row in a block and it's a dash
		if (source === 'lyrics' && !blockStartsWithDash.hasOwnProperty(block)) {
			blockStartsWithDash[block] = (type === 'Special' && value === '-');
		}
	}

	// Second pass: calculate octaves for pitch rows with proper block transition logic
	currentBlock = null;
	prevPitchState = { letter: 'c', octave: 4 };

	for (const row of newRows) {
		const block = row.block || '';
		const source = row.source || '';

		// Handle block transitions
		if (block !== currentBlock) {
			currentBlock = block;
			// Check if this block starts with a dash
			if (blockStartsWithDash[block]) {
				// Block starts with dash: carry over previous pitch state
				// Don't reset prevPitchState
			} else {
				// Block doesn't start with dash: reset to C4
				prevPitchState = { letter: 'c', octave: 4 };
			}
		}

		// Process pitch rows
		if (source === 'pitches' && row.type === 'Pitch') {
			const note = row.pitch_note || '';
			if (note) {
				const pitch = {
					note: note.toLowerCase(),
					octaveShifts: row.pitch_oct || '',
					accidental: row.pitch_acc || ''
				};

				// Calculate octave
				const calculated = calculatePitch(pitch, prevPitchState);
				prevPitchState = calculated;

				// Update the row
				row.pitch_oct = calculated.octave.toString();
			}
		}
	}

	return newRows;
}

/**
 * Get octave statistics for debugging
 * @param {Array<Object>} rows - Rows from octavesStage
 * @returns {Object} Statistics about octaves
 */
export function getOctaveStats(rows) {
	const stats = {
		totalPitches: 0,
		octaveRange: { min: Infinity, max: -Infinity },
		octaveCounts: {},
		blockStats: {}
	};

	for (const row of rows) {
		if (row.source === 'pitches' && row.type === 'Pitch' && row.pitch_oct) {
			const octave = parseInt(row.pitch_oct, 10);
			stats.totalPitches++;

			// Update range
			if (octave < stats.octaveRange.min) stats.octaveRange.min = octave;
			if (octave > stats.octaveRange.max) stats.octaveRange.max = octave;

			// Count octaves
			stats.octaveCounts[octave] = (stats.octaveCounts[octave] || 0) + 1;

			// Per-block stats
			const block = row.block || 'unknown';
			if (!stats.blockStats[block]) {
				stats.blockStats[block] = {
					count: 0,
					octaves: []
				};
			}
			stats.blockStats[block].count++;
			stats.blockStats[block].octaves.push(octave);
		}
	}

	// Clean up infinite values
	if (stats.octaveRange.min === Infinity) stats.octaveRange.min = 0;
	if (stats.octaveRange.max === -Infinity) stats.octaveRange.max = 0;

	return stats;
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { octavesStage, getOctaveStats };
}
