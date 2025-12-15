// Stage 5: Add ABC header rows and columns
// Adapts abcprep.js functionality for browser use

import { createRow } from '../utils.js';

/**
 * Generate the ABC header rows to be inserted.
 * Each row has source='abchdr', type='ABCHeader', value='X:', 'T:', etc.
 * The 'abc0' column contains default values where appropriate.
 * @returns {Array<Object>} Array of row objects
 */
function generateABCHeaderRows() {
	// Define the header rows in order
	return [
		// X:1 (tune number)
		createRow({
			source: 'abchdr',
			type: 'ABCHeader',
			value: 'X:',
			abc0: '1'
		}),
		// T: (title - empty, to be filled later)
		createRow({
			source: 'abchdr',
			type: 'ABCHeader',
			value: 'T:',
			abc0: ''
		}),
		// K:C major (default key signature)
		createRow({
			source: 'abchdr',
			type: 'ABCHeader',
			value: 'K:',
			abc0: 'C major'
		}),
		// M: (meter - empty, to be filled from FQS counter)
		createRow({
			source: 'abchdr',
			type: 'ABCHeader',
			value: 'M:',
			abc0: ''
		}),
		// L:1/4 (default unit note length)
		createRow({
			source: 'abchdr',
			type: 'ABCHeader',
			value: 'L:',
			abc0: '1/4'
		})
	];
}

/**
 * Add ABC headers and abc0/abc columns to rows
 * @param {Array<Object>} rows - Rows from mapStage
 * @returns {Array<Object>} Rows with ABC headers and abc0/abc columns
 */
export function prepStage(rows) {
	// Create a copy of rows with abc0 and abc columns added
	const newRows = rows.map(row => ({
		...row,
		abc0: '',
		abc: ''
	}));

	// Generate ABC header rows
	const abcHeaderRows = generateABCHeaderRows();

	// Combine headers with data rows
	return [...abcHeaderRows, ...newRows];
}

/**
 * Extract title from rows (from first block's title)
 * @param {Array<Object>} rows - Rows from prepStage
 * @returns {string} Title or empty string
 */
export function extractTitle(rows) {
	// Look for the first row with source='lyrics' and type='Syllable' or 'Special'
	// that's in the first block and has a non-empty value
	for (const row of rows) {
		if (row.source === 'lyrics' && row.block === 1) {
			const type = row.type || '';
			const value = row.value || '';

			if ((type === 'Syllable' || type === 'Special') && value.trim() !== '') {
				// This is likely part of the title
				// For now, return the first non-empty value
				// A more sophisticated implementation would collect all title parts
				return value.trim();
			}
		}
	}
	return '';
}

/**
 * Update title in ABC header rows
 * @param {Array<Object>} rows - Rows from prepStage
 * @param {string} title - Title to set
 * @returns {Array<Object>} Updated rows
 */
export function updateTitle(rows, title) {
	const newRows = rows.map(row => {
		if (row.source === 'abchdr' && row.value === 'T:') {
			return {
				...row,
				abc0: title
			};
		}
		return row;
	});
	return newRows;
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { prepStage, extractTitle, updateTitle };
}
