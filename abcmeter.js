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
	const measureBeats = new Map(); // measure -> max beat number

	for (const row of rows) {
		if (row.source === 'lyrics' && row.meas && row.beat) {
			const measure = parseInt(row.meas);
			const beat = parseInt(row.beat); // Use beat column, not total

			if (!measureBeats.has(measure)) {
				measureBeats.set(measure, beat);
			} else {
				// Update if this beat number is larger
				const current = measureBeats.get(measure);
				if (beat > current) {
					measureBeats.set(measure, beat);
				}
			}
		}
	}

	// Convert to array
	const result = [];
	for (const [measure, maxBeat] of measureBeats.entries()) {
		result.push({ measure, beats: maxBeat });
	}

	// Sort by measure number
	result.sort((a, b) => a.measure - b.measure);
	return result;
}

/**
 * Determine meter string from beat count
 * @param {number} beats - Number of beats in measure
 * @returns {string} ABC meter string (e.g., "4/4", "5/4", "3/4")
 */
function beatsToMeter(beats) {
	// Common time signatures
	if (beats === 4) return '4/4';
	if (beats === 3) return '3/4';
	if (beats === 2) return '2/4';
	if (beats === 6) return '6/8';
	if (beats === 9) return '9/8';
	if (beats === 12) return '12/8';

	// For other beat counts, assume quarter note beats
	return `${beats}/4`;
}

/**
 * Find the first lyric row of a measure
 * @param {Array<Object>} rows - All TSV rows
 * @param {number} measure - Measure number
 * @returns {number} Index of first lyric row in the measure, or -1 if not found
 */
function findFirstLyricRowInMeasure(rows, measure) {
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		if (row.source === 'lyrics' && row.meas && parseInt(row.meas) === measure) {
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

	// Determine default meter (from first measure)
	const defaultMeter = beatsToMeter(measureBeats[0].beats);

	// Update M: header row if it exists
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		if (row.source === 'abchdr' && row.value === 'M:') {
			// Set default meter in M: header
			row.abc0 = defaultMeter;
			break;
		}
	}

	// Add meter changes for subsequent measures with different beat counts
	for (let i = 1; i < measureBeats.length; i++) {
		const prev = measureBeats[i - 1];
		const curr = measureBeats[i];

		if (curr.beats !== prev.beats) {
			const meter = beatsToMeter(curr.beats);
			const firstRowIndex = findFirstLyricRowInMeasure(rows, curr.measure);

			if (firstRowIndex !== -1) {
				// Prepend meter change to abc0 column
				const row = rows[firstRowIndex];
				const currentAbc0 = row.abc0 || '';
				row.abc0 = `M:${meter} ${currentAbc0}`.trim();
			}
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
