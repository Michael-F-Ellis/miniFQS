// Stage 4: Map pitch information to lyric attacks
// Adapts map-pitches.js functionality for browser use

import { isAttackRow } from '../utils.js';

/**
 * Map pitch information to lyric attacks and dashes
 * @param {Array<Object>} rows - Rows from octavesStage
 * @returns {Array<Object>} Rows with pitch info mapped to lyric rows
 */
export function mapStage(rows) {
	// Create a copy of rows to avoid mutation
	const newRows = rows.map(row => ({ ...row }));

	// State for pitch mapping
	let currentBlock = null;
	let pitchQueue = []; // Store pitches for current block
	let lastPitchFields = null; // Store pitch fields of the most recent attack
	let lastPitchByBlock = {}; // Store last pitch for each block (for cross-block dashes)
	let blockStartsWithDash = {}; // Track which blocks start with a dash
	let previousBlock = null; // Track previous block for cross-block transitions

	// First, collect pitches per block
	const blockPitches = {};
	for (const row of newRows) {
		const block = row.block || '';
		const source = row.source || '';
		const type = row.type || '';

		if (source === 'pitches' && type === 'Pitch') {
			if (!blockPitches[block]) {
				blockPitches[block] = [];
			}
			blockPitches[block].push(row);
		}
	}

	// Detect which blocks start with a dash
	for (const row of newRows) {
		const block = row.block || '';
		const source = row.source || '';
		const type = row.type || '';
		const value = row.value || '';

		if (source === 'lyrics' && !blockStartsWithDash.hasOwnProperty(block)) {
			blockStartsWithDash[block] = (type === 'Special' && value === '-');
		}
	}

	// Map pitches to attacks and replicate to dashes
	for (const row of newRows) {
		const block = row.block || '';
		const source = row.source || '';
		const type = row.type || '';
		const value = row.value || '';

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
				} else {
					lastPitchFields = null;
				}
			} else {
				// Block doesn't start with dash: reset last pitch
				lastPitchFields = null;
			}
		}

		// Only process lyric rows
		if (source === 'lyrics') {
			if (isAttackRow(row)) {
				// This is an attack, consume next pitch
				if (pitchQueue.length > 0) {
					const pitch = pitchQueue.shift();
					// Copy pitch information
					row.pitch_note = pitch.pitch_note;
					row.pitch_acc = pitch.pitch_acc;
					row.pitch_oct = pitch.pitch_oct;
					lastPitchFields = pitch; // Remember this pitch for dashes
					// Store this pitch for the current block
					lastPitchByBlock[block] = pitch;
				} else {
					// No pitch available
					lastPitchFields = null;
				}
			} else if (type === 'Special' && value === '-') {
				// Dash: replicate pitch from last attack if available
				if (lastPitchFields) {
					row.pitch_note = lastPitchFields.pitch_note;
					row.pitch_acc = lastPitchFields.pitch_acc;
					row.pitch_oct = lastPitchFields.pitch_oct;
				}
				// If no last pitch, leave pitch fields empty
			}
			// Other lyric types (Barline, BeatDur) don't get pitch info
		}
	}

	return newRows;
}

/**
 * Check if a pitch row is consumable (not a barline or key signature)
 * @param {Object} row - Row object
 * @returns {boolean} true if the row is a consumable pitch
 */
export function isConsumablePitch(row) {
	if (row.source !== 'pitches') {
		return false;
	}
	const type = row.type || '';
	return type === 'Pitch';
}

/**
 * Get mapping statistics for debugging
 * @param {Array<Object>} rows - Rows from mapStage
 * @returns {Object} Statistics about pitch mapping
 */
export function getMappingStats(rows) {
	const stats = {
		totalLyricRows: 0,
		attackRows: 0,
		dashRows: 0,
		rowsWithPitch: 0,
		unmappedAttacks: 0,
		blockStats: {}
	};

	for (const row of rows) {
		if (row.source === 'lyrics') {
			stats.totalLyricRows++;

			const type = row.type || '';
			const value = row.value || '';

			if (isAttackRow(row)) {
				stats.attackRows++;
				if (row.pitch_note) {
					stats.rowsWithPitch++;
				} else {
					stats.unmappedAttacks++;
				}
			} else if (type === 'Special' && value === '-') {
				stats.dashRows++;
				if (row.pitch_note) {
					stats.rowsWithPitch++;
				}
			}

			// Per-block stats
			const block = row.block || 'unknown';
			if (!stats.blockStats[block]) {
				stats.blockStats[block] = {
					lyrics: 0,
					attacks: 0,
					dashes: 0,
					withPitch: 0
				};
			}
			stats.blockStats[block].lyrics++;
			if (isAttackRow(row)) stats.blockStats[block].attacks++;
			if (type === 'Special' && value === '-') stats.blockStats[block].dashes++;
			if (row.pitch_note) stats.blockStats[block].withPitch++;
		}
	}

	return stats;
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { mapStage, isConsumablePitch, getMappingStats };
}
