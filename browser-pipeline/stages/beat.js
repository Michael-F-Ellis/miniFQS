// Stage 6: Process beat duration and set L: (unit note length)
// Adapts abcbeat.js functionality for browser use

/**
 * Map beat duration to ABC L: (unit note length) value
 * @param {number} duration - Beat duration (1, 2, 4, 8, etc.)
 * @param {boolean} dotted - Whether the beat is dotted
 * @returns {string} ABC L: value (e.g., "1/4", "1/8", etc.)
 */
function beatDurationToL(duration, dotted) {
	// Default: quarter note (B4)
	if (duration === 4 && !dotted) return '1/4';

	// Handle dotted durations
	if (dotted) {
		switch (duration) {
			case 1: return '1/2';  // B1. (dotted whole = 3 halves)
			case 2: return '1/4';  // B2. (dotted half = 3 quarters)
			case 4: return '1/8';  // B4. (dotted quarter = 3 eighths)
			case 8: return '1/16'; // B8. (dotted eighth = 3 sixteenths)
			default: return '1/4'; // fallback
		}
	}

	// Handle non-dotted durations
	switch (duration) {
		case 1: return '1/1';  // B1 (whole note)
		case 2: return '1/2';  // B2 (half note)
		case 4: return '1/4';  // B4 (quarter note)
		case 8: return '1/8';  // B8 (eighth note)
		default: return '1/4'; // fallback to quarter note
	}
}

/**
 * Parse beat duration from value string (e.g., "[4]", "[4.]")
 * @param {string} value - Beat duration value string
 * @returns {Object|null} Object with duration and dotted properties, or null if invalid
 */
function parseBeatDuration(value) {
	// Handle syntax: [4], [4.]
	if (value.startsWith('[') && value.endsWith(']')) {
		const inner = value.slice(1, -1); // Remove brackets
		const match = inner.match(/^(\d+)(\.)?$/);
		if (!match) return null;

		const duration = parseInt(match[1]);
		const dotted = match[2] === '.';

		return { duration, dotted };
	}

	return null;
}

/**
 * Process beat duration and update L: headers
 * @param {Array<Object>} rows - Rows from prepStage
 * @returns {Array<Object>} Rows with abc0 updated with L: directives
 */
export function beatStage(rows) {
	// Create a copy of rows
	const newRows = rows.map(row => ({ ...row }));

	// Track current beat duration (default: B4 - quarter note)
	let currentBeatDuration = { duration: 4, dotted: false };
	let currentL = beatDurationToL(4, false); // Default L:1/4

	// Track if we've set the default L: header
	let defaultLSet = false;

	// Track current measure for BeatDur placement
	let currentMeasure = 1;
	let lastBarlineIndex = -1;

	// Process rows to update L: headers based on beat duration
	for (let i = 0; i < newRows.length; i++) {
		const row = newRows[i];

		// Track measure changes via barlines
		if (row.source === 'lyrics' && row.type === 'Barline') {
			// Barline indicates end of current measure
			// Next lyric row will be in next measure
			lastBarlineIndex = i;
		}

		// Handle BeatDur elements
		if (row.type === 'BeatDur') {
			const beatInfo = parseBeatDuration(row.value);
			if (beatInfo) {
				currentBeatDuration = beatInfo;
				currentL = beatDurationToL(beatInfo.duration, beatInfo.dotted);

				// Add [L:...] to the first lyric row of the current measure
				// Find the next lyric row after the last barline (or start of piece)
				// that has a beat (i.e., not a barline)
				let targetRowIndex = -1;
				for (let j = Math.max(lastBarlineIndex + 1, 0); j < newRows.length; j++) {
					const candidate = newRows[j];
					if (candidate.source === 'lyrics' && candidate.meas && candidate.beat) {
						targetRowIndex = j;
						break;
					}
				}

				if (targetRowIndex !== -1) {
					const targetRow = newRows[targetRowIndex];
					// Prepend [L:...] to existing abc0 content
					const currentAbc0 = targetRow.abc0 || '';
					targetRow.abc0 = `[L:${currentL}] ${currentAbc0}`.trim();
				}
				// Don't set abc0 on the BeatDur row itself
			}
		}

		// Handle ABC header rows (source='abchdr')
		if (row.source === 'abchdr' && row.value === 'L:') {
			// Update the L: header with current beat duration
			row.abc0 = currentL;
			defaultLSet = true;
		}
	}

	// If no L: header was found (shouldn't happen with prepStage), add one
	if (!defaultLSet) {
		// Find the L: header row or create one
		let foundLHeader = false;
		for (let i = 0; i < newRows.length; i++) {
			const row = newRows[i];
			if (row.source === 'abchdr' && row.value === 'L:') {
				row.abc0 = currentL;
				foundLHeader = true;
				break;
			}
		}

		// If no L: header exists, add one (shouldn't happen with prepStage)
		if (!foundLHeader) {
			newRows.unshift({
				source: 'abchdr',
				block: '',
				meas: '',
				beat: '',
				sub: '',
				total: '',
				type: 'ABCHeader',
				value: 'L:',
				dur: '',
				mod: '',
				pitch_idx: '',
				pitch_note: '',
				pitch_acc: '',
				pitch_oct: '',
				abc0: currentL,
				abc: ''
			});
		}
	}

	return newRows;
}

/**
 * Get beat duration statistics
 * @param {Array<Object>} rows - Rows from beatStage
 * @returns {Object} Statistics about beat durations
 */
export function getBeatStats(rows) {
	const stats = {
		totalBeatDurs: 0,
		durations: {},
		currentL: '1/4',
		hasBeatChanges: false
	};

	let currentL = '1/4';

	for (const row of rows) {
		if (row.type === 'BeatDur') {
			stats.totalBeatDurs++;
			const beatInfo = parseBeatDuration(row.value);
			if (beatInfo) {
				const durationKey = `${beatInfo.duration}${beatInfo.dotted ? '.' : ''}`;
				stats.durations[durationKey] = (stats.durations[durationKey] || 0) + 1;

				const newL = beatDurationToL(beatInfo.duration, beatInfo.dotted);
				if (newL !== currentL) {
					stats.hasBeatChanges = true;
					currentL = newL;
				}
			}
		}

		if (row.source === 'abchdr' && row.value === 'L:' && row.abc0) {
			stats.currentL = row.abc0;
		}
	}

	return stats;
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { beatStage, beatDurationToL, parseBeatDuration, getBeatStats };
}
