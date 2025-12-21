#!/usr/bin/env node

/**
 * optimizeTies.js - Command-line utility to optimize tied notes to dotted notes
 * 
 * Reads TSV from stdin (after notes.js)
 * Applies optimization heuristics from DottedVsTie.md
 * Writes TSV with abc column populated with optimized notation
 */

import { createInterface } from 'readline';
import {
	extractUnitNoteLength,
	extractMeter
} from './optimize-helpers.js';
import { optimizeBeatGroup } from './optimize-core.js';

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
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch(err => {
		console.error('Error:', err);
		process.exit(1);
	});
}
