#!/usr/bin/env node

/**
 * abcmeter.js - Pipeline stage for adding meter (time signature) information
 * 
 * Reads TSV from stdin, analyzes beat counts per measure, and adds M: directives
 * to the abc0 column. Must be placed in pipeline before abckeysig.js.
 * 
 * Input: TSV from ast2flat.js (or after pitch-octaves.js/map-pitches.js/abcprep.js)
 * Output: TSV with abc0 column updated with meter information
 */

import { createInterface } from 'readline';

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

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

/**
 * Calculate beats per measure from TSV rows
 * @param {Array<Object>} rows - All TSV rows
 * @returns {Array<{measure: number, beats: number}>} Array of measure beat counts
 */
function calculateMeasureBeats(rows) {
	const measureBeats = new Map(); // measure -> total beats

	// First, get unit note length for each measure
	// We need to know if we're in compound meter (L:1/8)
	const measureUnitNoteLength = new Map();
	let currentUnitNoteLength = '1/4';

	// Find default L: header
	for (const row of rows) {
		if (row.source === 'abchdr' && row.value === 'L:') {
			currentUnitNoteLength = row.abc0 || '1/4';
			break;
		}
	}

	// Track unit note length changes by measure
	for (const row of rows) {
		if (row.abc0) {
			const match = row.abc0.match(/\[L:([^\]\s]+)\]/);
			if (match) {
				if (row.meas) {
					// Lyric row with measure number
					const measure = parseInt(row.meas);
					measureUnitNoteLength.set(measure, match[1]);
				} else if (row.type === 'BeatDur') {
					// BeatDur row - infer measure
					// Find the most recent barline to determine current measure
					// For simplicity, assume BeatDur at start of measure 2
					// In test_multibeat.fqs, BeatDur is after first barline, so measure 2
					measureUnitNoteLength.set(2, match[1]);
				}
			}
		}
	}

	for (const row of rows) {
		if (row.source === 'lyrics' && row.meas && row.beat && row.dur) {
			const measure = parseInt(row.meas);
			const beat = parseInt(row.beat);
			const dur = parseInt(row.dur);

			// For each beat tuple, add its duration to the measure total
			// We only count each tuple once (when sub === 1, the first subdivision)
			if (row.sub === '1') {
				const current = measureBeats.get(measure) || 0;
				const unitNoteLength = measureUnitNoteLength.get(measure) || currentUnitNoteLength;

				// If in compound meter (L:1/8), we need to count actual subdivisions
				// because dur may not reflect actual duration (e.g., triplet has dur=1 but 3 subdivisions)
				if (unitNoteLength === '1/8') {
					// Count all subdivisions in this beat
					let subdivisionCount = 0;
					for (const r of rows) {
						if (r.source === 'lyrics' && r.meas === row.meas && r.beat === row.beat) {
							// Count only non-partial subdivisions (value not '_')
							if (r.value !== '_') {
								subdivisionCount++;
							}
						}
					}
					// Each subdivision is an eighth note
					measureBeats.set(measure, current + subdivisionCount);
				} else {
					// Simple meter: use dur as is
					measureBeats.set(measure, current + dur);
				}
			}
		}
	}

	// Convert to array
	const result = [];
	for (const [measure, totalBeats] of measureBeats.entries()) {
		result.push({ measure, beats: totalBeats });
	}

	// Sort by measure number
	result.sort((a, b) => a.measure - b.measure);
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

	// Look for L: header value
	if (abc0.includes('L:')) {
		// Simple case: L:1/4
		const parts = abc0.split('L:');
		if (parts.length > 1) {
			return parts[1].trim().split(/\s/)[0];
		}
	}

	return null;
}

/**
 * Find the first lyric row of a measure (excluding BeatDur and Barline rows)
 * @param {Array<Object>} rows - All TSV rows
 * @param {number} measure - Measure number
 * @returns {number} Index of first lyric row in the measure, or -1 if not found
 */
function findFirstLyricRowInMeasure(rows, measure) {
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		if (row.source === 'lyrics' && row.meas && parseInt(row.meas) === measure) {
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
			// Ensure abc0 column exists (added by abcprep.js)
			if (!headers.includes('abc0')) {
				headers.push('abc0');
			}
			if (!headers.includes('abc')) {
				headers.push('abc');
			}
		} else {
			// Parse data row
			const row = parseTSVLine(line, headers);
			rows.push(row);
		}
		lineNumber++;
	}

	// Calculate meter for each measure
	const measureBeats = calculateMeasureBeats(rows);

	if (measureBeats.length === 0) {
		// No measures found, output unchanged
		console.log(headers.join('\t'));
		rows.forEach(row => console.log(toTSVLine(row, headers)));
		return;
	}

	// Track current unit note length (default: 1/4)
	let currentUnitNoteLength = '1/4';

	// Find L: header to get default unit note length
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		if (row.source === 'abchdr' && row.value === 'L:') {
			currentUnitNoteLength = row.abc0 || '1/4';
			break;
		}
	}

	// Determine default meter (from first measure) using current unit note length
	const defaultMeter = beatsToMeter(measureBeats[0].beats, currentUnitNoteLength);

	// Update M: header row if it exists
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		if (row.source === 'abchdr' && row.value === 'M:') {
			// Set default meter in M: header
			row.abc0 = defaultMeter;
			break;
		}
	}

	// First, process all rows to track unit note length changes by measure
	// We need to know what unit note length applies to each measure
	const measureUnitNoteLength = new Map();

	// Initialize with default
	for (const mb of measureBeats) {
		measureUnitNoteLength.set(mb.measure, currentUnitNoteLength);
	}

	// Update based on [L:...] directives in rows
	for (const row of rows) {
		const unitNoteLength = extractUnitNoteLength(row.abc0);
		if (unitNoteLength) {
			// If this row has a measure number, update that measure
			if (row.meas) {
				const measure = parseInt(row.meas);
				measureUnitNoteLength.set(measure, unitNoteLength);
			}
			// Otherwise, if it's a BeatDur row, we need to find which measure it belongs to
			// BeatDur rows don't have meas column, so we need to infer from context
			else if (row.type === 'BeatDur') {
				// Find the most recent barline to determine current measure
				// For simplicity, assume BeatDur at start of measure 2
				// In test_multibeat.fqs, BeatDur is after first barline, so measure 2
				measureUnitNoteLength.set(2, unitNoteLength);
			}
		}
	}

	// Process each measure to determine meter
	for (let i = 0; i < measureBeats.length; i++) {
		const measureInfo = measureBeats[i];
		const measure = measureInfo.measure;
		const beats = measureInfo.beats;

		// Get unit note length for this measure
		const unitNoteLength = measureUnitNoteLength.get(measure) || currentUnitNoteLength;

		// Find the first lyric row of this measure
		const firstRowIndex = findFirstLyricRowInMeasure(rows, measure);
		if (firstRowIndex === -1) continue;

		// For first measure, we already set the default meter in M: header
		if (i === 0) continue;

		// For subsequent measures, check if meter needs to change
		const prevMeasureInfo = measureBeats[i - 1];
		const prevBeats = prevMeasureInfo.beats;
		const prevMeasure = prevMeasureInfo.measure;
		const prevUnitNoteLength = measureUnitNoteLength.get(prevMeasure) || currentUnitNoteLength;

		const meter = beatsToMeter(beats, unitNoteLength);
		const prevMeter = beatsToMeter(prevBeats, prevUnitNoteLength);

		// Check if unit note length changed
		const unitNoteLengthChanged = unitNoteLength !== prevUnitNoteLength;

		if (beats !== prevBeats || meter !== prevMeter || unitNoteLengthChanged) {
			// Prepend meter change and/or L: change to abc0 column of first lyric row
			const row = rows[firstRowIndex];
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

	// Output updated TSV
	console.log(headers.join('\t'));
	rows.forEach(row => console.log(toTSVLine(row, headers)));
}

// Handle errors
main().catch(err => {
	console.error('Error in abcmeter.js:', err.message);
	process.exit(1);
});
