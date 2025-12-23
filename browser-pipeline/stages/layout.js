// Stage 6: Calculate X positions for layout
// Calculates X positions for lyric elements, pitch letters, and counter values

import { isCounterRow } from '../utils.js';

/**
 * LayoutState class tracks layout state for X position calculation
 */
class LayoutState {
	constructor() {
		// Current X position (monospace character widths)
		this.currentX = 0;

		// Block and measure tracking
		this.currentBlock = null;
		this.currentMeasure = null;
		this.currentBeat = null;

		// Beat duration for proportional spacing
		this.beatDuration = 1;

		// Counter tracking for tuples
		this.counterIndex = 0;
		this.countersInBeat = 0;
	}

	/**
	 * Reset for new block
	 * @param {number} block - Block number
	 */
	startBlock(block) {
		this.currentBlock = block;
		this.currentX = 0;
		this.currentMeasure = null;
		this.currentBeat = null;
		this.beatDuration = 1;
		this.counterIndex = 0;
		this.countersInBeat = 0;
	}

	/**
	 * Start new measure
	 * @param {number} measure - Measure number
	 */
	startMeasure(measure) {
		if (measure !== this.currentMeasure) {
			this.currentMeasure = measure;
			this.currentBeat = null;
			this.beatDuration = 1;
			this.counterIndex = 0;
			this.countersInBeat = 0;
		}
	}

	/**
	 * Start new beat
	 * @param {number} beat - Beat number
	 * @param {number} duration - Beat duration (default: 1)
	 */
	startBeat(beat, duration = 1) {
		if (beat !== this.currentBeat) {
			this.currentBeat = beat;
			this.beatDuration = duration;
			this.counterIndex = 0;
			this.countersInBeat = 0;
		}
	}

	/**
	 * Calculate X position for a lyric element
	 * @param {string} value - Character value
	 * @returns {number} X position
	 */
	calculateLyricX(value) {
		// Each character occupies 1 unit width
		const x = this.currentX;
		this.currentX += 1;
		return x;
	}

	/**
	 * Calculate X position for a counter value
	 * @returns {number} X position
	 */
	calculateCounterX() {
		// For tuples: space counters proportionally within beat
		if (this.beatDuration > 1 && this.countersInBeat > 0) {
			// Proportional spacing for tuples
			const proportion = this.counterIndex / this.beatDuration;
			const x = this.currentX - 1 + proportion; // Start from previous position
			this.counterIndex++;
			this.countersInBeat++;
			return x;
		} else {
			// Regular counter (same as lyric)
			const x = this.currentX;
			this.currentX += 1;
			this.counterIndex++;
			this.countersInBeat++;
			return x;
		}
	}

	/**
	 * Calculate X position for a pitch letter
	 * @returns {number} X position (aligned with corresponding lyric)
	 */
	calculatePitchX() {
		// Pitch letters align with lyric positions
		// Use current X position (same as where lyric would be)
		return this.currentX;
	}

	/**
	 * Handle barline (reset X for new measure)
	 */
	handleBarline() {
		// Barline doesn't advance X position
		// X position resets at start of next measure
	}

	/**
	 * Handle beat duration change
	 * @param {number} duration - New beat duration
	 */
	updateBeatDuration(duration) {
		this.beatDuration = duration;
	}
}

/**
 * Calculate X positions for all rows
 * @param {Array<Row>} rows - Rows from map stage
 * @returns {Array<Row>} Rows with x column populated
 */
export function layoutStage(rows) {
	// Create a copy of rows
	const newRows = rows.map(row => {
		// If row has clone method, use it; otherwise create a shallow copy
		if (row && typeof row.clone === 'function') {
			return row.clone();
		}
		return { ...row };
	});

	// State for layout calculation
	const layoutState = new LayoutState();

	for (const row of newRows) {
		const block = row.block || '';
		const meas = row.meas || '';
		const beat = row.beat || '';
		const source = row.source || '';
		const type = row.type || '';
		const value = row.value || '';
		const dur = typeof row.dur === 'number' ? row.dur : 1;

		// Handle block transitions
		if (block !== '' && block !== layoutState.currentBlock) {
			layoutState.startBlock(block);
		}

		// Handle measure transitions
		if (meas !== '' && meas !== layoutState.currentMeasure) {
			layoutState.startMeasure(meas);
		}

		// Handle beat transitions
		if (beat !== '' && beat !== layoutState.currentBeat) {
			layoutState.startBeat(beat, dur);
		}

		// Update beat duration if specified
		if (type === 'BeatDur') {
			layoutState.updateBeatDuration(dur);
		}

		// Calculate X position based on row type
		let x = null;

		if (source === 'lyrics') {
			if (type === 'Barline') {
				layoutState.handleBarline();
				// Barline X position is current X (doesn't advance)
				x = layoutState.currentX;
			} else {
				x = layoutState.calculateLyricX(value);
			}
		} else if (source === 'pitches' && type === 'Pitch') {
			x = layoutState.calculatePitchX();
		} else if (isCounterRow(row)) {
			x = layoutState.calculateCounterX();
		} else if (source === 'abchdr') {
			// Headers don't get X positions (or could be 0)
			x = 0;
		}

		// Set X position if calculated
		if (x !== null) {
			row.x = x;
		}
	}

	return newRows;
}

/**
 * Get layout statistics for debugging
 * @param {Array<Row>} rows - Rows from layoutStage
 * @returns {Object} Statistics about layout
 */
export function getLayoutStats(rows) {
	const stats = {
		totalRows: rows.length,
		rowsWithX: 0,
		bySource: {},
		xRange: { min: Infinity, max: -Infinity },
		blockStats: {}
	};

	let currentBlock = null;
	let blockStartX = 0;

	for (const row of rows) {
		const source = row.source || '';
		const block = row.block || '';
		const x = typeof row.x === 'number' ? row.x : null;

		// Track by source
		stats.bySource[source] = (stats.bySource[source] || 0) + 1;

		// Track X positions
		if (x !== null) {
			stats.rowsWithX++;
			stats.xRange.min = Math.min(stats.xRange.min, x);
			stats.xRange.max = Math.max(stats.xRange.max, x);

			// Track block transitions
			if (block !== currentBlock) {
				currentBlock = block;
				blockStartX = x;
				if (!stats.blockStats[block]) {
					stats.blockStats[block] = {
						startX: x,
						endX: x,
						rows: 0,
						rowsWithX: 0
					};
				}
			}

			// Update block stats
			if (stats.blockStats[block]) {
				stats.blockStats[block].endX = x;
				stats.blockStats[block].rows++;
				stats.blockStats[block].rowsWithX++;
			}
		}
	}

	// Clean up infinite values
	if (stats.xRange.min === Infinity) {
		stats.xRange.min = 0;
		stats.xRange.max = 0;
	}

	return stats;
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { layoutStage, getLayoutStats };
}
