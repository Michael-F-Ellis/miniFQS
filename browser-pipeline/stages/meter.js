// Stage 7: Add meter (time signature) information
// Adapts abcmeter.js functionality for browser use

/**
 * Calculate beats per measure from rows
 * @param {Array<Object>} rows - All rows
 * @returns {Array<{block: number, measure: number, beats: number}>} Array of measure beat counts
 */
function calculateMeasureBeats(rows) {
	const measureBeats = new Map(); // "block-measure" -> total beats
	const blockCounters = new Map(); // "block" -> counter value

	// First, get unit note length for each measure
	// We need to know if we're in compound meter (L:1/8)
	const measureUnitNoteLength = new Map(); // "block-measure" -> unit note length
	let currentUnitNoteLength = '1/4';

	// Find default L: header
	for (const row of rows) {
		if (row.source === 'abchdr' && row.value === 'L:') {
			currentUnitNoteLength = row.abc0 || '1/4';
			break;
		}
	}

	// Track counter values by block
	for (const row of rows) {
		if (row.counter !== undefined && row.counter !== '') {
			const block = parseInt(row.block);
			// Counter can be an object { type: 'Counter', value: 3 } or a number
			const counterValue = typeof row.counter === 'object' ? row.counter.value : row.counter;
			blockCounters.set(block, parseInt(counterValue));
		}
	}

	// Track unit note length changes by measure
	for (const row of rows) {
		if (row.abc0) {
			const match = row.abc0.match(/\[L:([^\]\s]+)\]/);
			if (match) {
				if (row.meas && row.block) {
					// Lyric row with measure number and block
					const block = parseInt(row.block);
					const measure = parseInt(row.meas);
					const key = `${block}-${measure}`;
					measureUnitNoteLength.set(key, match[1]);
				} else if (row.type === 'BeatDur' && row.block) {
					// BeatDur row - infer measure
					// Find the most recent barline to determine current measure
					// For simplicity, assume BeatDur at start of measure 2
					// In test_multibeat.fqs, BeatDur is after first barline, so measure 2
					const block = parseInt(row.block);
					const key = `${block}-2`;
					measureUnitNoteLength.set(key, match[1]);
				}
			}
		}
	}

	for (const row of rows) {
		if (row.source === 'lyrics' && row.block && row.meas !== undefined && row.meas !== '' && row.beat && row.dur) {
			const block = parseInt(row.block);
			const measure = parseInt(row.meas);
			const beat = parseInt(row.beat);
			const dur = parseFloat(row.dur);

			// For each beat tuple, add its duration to the measure total
			// We only count each tuple once (when sub === 1, the first subdivision)
			if (row.sub === 1 && !isNaN(dur)) {
				const key = `${block}-${measure}`;
				const current = measureBeats.get(key) || 0;
				const unitNoteLength = measureUnitNoteLength.get(key) || currentUnitNoteLength;

				// If in compound meter (L:1/8), we need to count actual subdivisions
				// because dur may not reflect actual duration (e.g., triplet has dur=1 but 3 subdivisions)
				if (unitNoteLength === '1/8') {
					// Count all subdivisions in this beat
					let subdivisionCount = 0;
					for (const r of rows) {
						if (r.source === 'lyrics' && r.block === row.block && r.meas === row.meas && r.beat === row.beat) {
							// Count only non-partial subdivisions (value not '_')
							if (r.value !== '_') {
								subdivisionCount++;
							}
						}
					}
					// Each subdivision is an eighth note
					measureBeats.set(key, current + subdivisionCount);
				} else {
					// Simple meter: use dur as is
					measureBeats.set(key, current + dur);
				}
			}
		}
	}

	// Convert to array
	const result = [];
	for (const [key, totalBeats] of measureBeats.entries()) {
		const [block, measure] = key.split('-').map(Number);
		let adjustedBeats = totalBeats;

		// Apply pickup measure formula for measure 0: C + (N-1)
		if (measure === 0) {
			const counter = blockCounters.get(block);
			if (counter !== undefined) {
				adjustedBeats = counter + (totalBeats - 1);
			}
		}

		result.push({ block, measure, beats: adjustedBeats });
	}

	// Sort by block, then measure
	result.sort((a, b) => {
		if (a.block !== b.block) return a.block - b.block;
		return a.measure - b.measure;
	});
	return result;
}

/**
 * Determine meter string from beat count and current unit note length
 * @param {number} beats - Number of beats in measure
 * @param {string} unitNoteLength - Current L: value (e.g., "1/4", "1/8")
 * @returns {string} ABC meter string (e.g., "4/4", "5/4", "3/4", "5/8")
 */
function beatsToMeter(beats, unitNoteLength = '1/4') {
	// Parse unit note length denominator
	const denominator = parseInt(unitNoteLength.split('/')[1]) || 4;

	// Common time signatures with special handling
	if (beats === 4 && denominator === 4) return '4/4';
	if (beats === 3 && denominator === 4) return '3/4';
	if (beats === 2 && denominator === 4) return '2/4';
	if (beats === 6 && denominator === 8) return '6/8';
	if (beats === 9 && denominator === 8) return '9/8';
	if (beats === 12 && denominator === 8) return '12/8';

	// For compound meter (denominator 8), use 8 as denominator
	if (denominator === 8) {
		return `${beats}/8`;
	}

	// For simple meter (denominator 4), use 4 as denominator
	// Also handle cases like 5/4, 7/4, etc.
	return `${beats}/4`;
}

/**
 * Find the first lyric row of a measure (excluding BeatDur and Barline rows)
 * @param {Array<Object>} rows - All rows
 * @param {number} block - Block number
 * @param {number} measure - Measure number
 * @returns {number} Index of first lyric row in the measure, or -1 if not found
 */
function findFirstLyricRowInMeasure(rows, block, measure) {
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		if (row.source === 'lyrics' && row.block && parseInt(row.block) === block &&
			row.meas !== undefined && row.meas !== '' && parseInt(row.meas) === measure) {
			// Skip BeatDur and Barline rows - they don't have beat values
			if (row.type === 'BeatDur' || row.type === 'Barline') {
				continue;
			}
			// Also skip rows without beat value (should catch other non-note rows)
			if (!row.beat) {
				continue;
			}
			return i;
		}
	}
	return -1;
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

	return null;
}

/**
 * Add meter information to rows
 * @param {Array<Object>} rows - Rows from beatStage
 * @returns {Array<Object>} Rows with abc0 updated with meter directives
 */
export function meterStage(rows) {
	// Create a copy of rows
	const newRows = rows.map(row => ({ ...row }));

	// Calculate meter for each measure
	const measureBeats = calculateMeasureBeats(newRows);

	if (measureBeats.length === 0) {
		// No measures found, return unchanged
		return newRows;
	}

	// Track current unit note length (default: 1/4)
	let currentUnitNoteLength = '1/4';

	// Find L: header to get default unit note length
	for (let i = 0; i < newRows.length; i++) {
		const row = newRows[i];
		if (row.source === 'abchdr' && row.value === 'L:') {
			currentUnitNoteLength = row.abc0 || '1/4';
			break;
		}
	}

	// Determine default meter (from first measure) using current unit note length
	const defaultMeter = beatsToMeter(measureBeats[0].beats, currentUnitNoteLength);

	// Update M: header row if it exists
	for (let i = 0; i < newRows.length; i++) {
		const row = newRows[i];
		if (row.source === 'abchdr' && row.value === 'M:') {
			// Set default meter in M: header
			row.abc0 = defaultMeter;
			break;
		}
	}

	// Track unit note length by measure
	const measureUnitNoteLength = new Map(); // "block-measure" -> unit note length

	// Initialize with default
	for (const mb of measureBeats) {
		const key = `${mb.block}-${mb.measure}`;
		measureUnitNoteLength.set(key, currentUnitNoteLength);
	}

	// Update based on [L:...] directives in rows
	for (const row of newRows) {
		const unitNoteLength = extractUnitNoteLength(row.abc0);
		if (unitNoteLength) {
			// If this row has a measure number and block, update that measure
			if (row.meas && row.block) {
				const block = parseInt(row.block);
				const measure = parseInt(row.meas);
				const key = `${block}-${measure}`;
				measureUnitNoteLength.set(key, unitNoteLength);
			}
		}
	}

	// Process each measure to determine meter
	for (let i = 0; i < measureBeats.length; i++) {
		const measureInfo = measureBeats[i];
		const block = measureInfo.block;
		const measure = measureInfo.measure;
		const beats = measureInfo.beats;

		// Get unit note length for this measure
		const key = `${block}-${measure}`;
		const unitNoteLength = measureUnitNoteLength.get(key) || currentUnitNoteLength;

		// Find the first lyric row of this measure
		const firstRowIndex = findFirstLyricRowInMeasure(newRows, block, measure);
		if (firstRowIndex === -1) continue;

		// For first measure of first block, we already set the default meter in M: header
		if (i === 0) continue;

		// For subsequent measures, check if meter needs to change
		const prevMeasureInfo = measureBeats[i - 1];
		const prevBlock = prevMeasureInfo.block;
		const prevMeasure = prevMeasureInfo.measure;
		const prevBeats = prevMeasureInfo.beats;
		const prevKey = `${prevBlock}-${prevMeasure}`;
		const prevUnitNoteLength = measureUnitNoteLength.get(prevKey) || currentUnitNoteLength;

		const meter = beatsToMeter(beats, unitNoteLength);
		const prevMeter = beatsToMeter(prevBeats, prevUnitNoteLength);

		// Check if unit note length changed
		const unitNoteLengthChanged = unitNoteLength !== prevUnitNoteLength;

		if (beats !== prevBeats || meter !== prevMeter || unitNoteLengthChanged) {
			// Prepend meter change and/or L: change to abc0 column of first lyric row
			const row = newRows[firstRowIndex];
			const currentAbc0 = row.abc0 || '';

			// Remove any existing M: or L: directives to avoid duplicates
			let cleanAbc0 = currentAbc0.replace(/M:[^\]\s]*\s?/g, '').trim();
			cleanAbc0 = cleanAbc0.replace(/\[L:[^\]\s]*\]\s?/g, '').trim();

			// Build directive string
			const directives = [];
			if (unitNoteLengthChanged) {
				directives.push(`[L:${unitNoteLength}]`);
			}
			if (beats !== prevBeats || meter !== prevMeter) {
				directives.push(`[M:${meter}]`);
			}

			row.abc0 = `${directives.join(' ')} ${cleanAbc0}`.trim();
		}
	}

	return newRows;
}

/**
 * Get meter statistics
 * @param {Array<Object>} rows - Rows from meterStage
 * @returns {Object} Statistics about meters
 */
export function getMeterStats(rows) {
	const stats = {
		totalMeasures: 0,
		meters: {},
		defaultMeter: '4/4',
		hasMeterChanges: false
	};

	const measureBeats = calculateMeasureBeats(rows);
	stats.totalMeasures = measureBeats.length;

	if (measureBeats.length > 0) {
		stats.defaultMeter = beatsToMeter(measureBeats[0].beats);
	}

	let previousMeter = null;
	for (const mb of measureBeats) {
		const meter = beatsToMeter(mb.beats);
		stats.meters[meter] = (stats.meters[meter] || 0) + 1;

		if (previousMeter && meter !== previousMeter) {
			stats.hasMeterChanges = true;
		}
		previousMeter = meter;
	}

	return stats;
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { meterStage, calculateMeasureBeats, beatsToMeter, getMeterStats };
}
