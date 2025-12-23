// PipelineData utility methods
// Additional functionality for PipelineData class

import { PipelineData } from './pipeline-data-core.js';
import { Row } from './pipeline-row.js';

/**
 * Convert PipelineData to TSV format for debugging
 * @param {PipelineData} pipelineData - PipelineData instance
 * @returns {string} TSV string
 */
export function toTSV(pipelineData) {
	if (!pipelineData.rows || pipelineData.rows.length === 0) return '';

	// Get all column names from first row
	const firstRow = pipelineData.rows[0];
	const headers = Object.keys(firstRow.toJSON());

	// Build TSV lines
	const lines = [
		headers.join('\t'),
		...pipelineData.rows.map(row => headers.map(h => row[h] || '').join('\t'))
	];

	return lines.join('\n');
}

/**
 * Create PipelineData from TSV
 * @param {string} tsv - TSV string
 * @returns {PipelineData} New PipelineData instance
 */
export function fromTSV(tsv) {
	const lines = tsv.trim().split('\n');
	if (lines.length === 0) return new PipelineData();

	const headers = lines[0].split('\t');
	const rows = [];

	for (let i = 1; i < lines.length; i++) {
		const values = lines[i].split('\t');
		const rowData = {};

		for (let j = 0; j < headers.length; j++) {
			if (j < values.length) {
				rowData[headers[j]] = values[j];
			}
		}

		rows.push(new Row(rowData));
	}

	return new PipelineData(rows);
}

/**
 * Get statistics about the PipelineData
 * @param {PipelineData} pipelineData - PipelineData instance
 * @returns {Object} Statistics object
 */
export function getStats(pipelineData) {
	const stats = {
		totalRows: pipelineData.rows.length,
		bySource: {},
		byType: {},
		blockCount: 0,
		measureCount: 0,
		pitchStats: {
			total: 0,
			octaveRange: { min: Infinity, max: -Infinity },
			alterationCounts: { '-2': 0, '-1': 0, '0': 0, '1': 0, '2': 0 }
		},
		layoutStats: {
			rowsWithX: 0,
			xRange: { min: Infinity, max: -Infinity }
		},
		abcStats: {
			rowsWithAbc0: 0,
			rowsWithAbc: 0
		}
	};

	const blocks = new Set();
	const measures = new Set();

	for (const row of pipelineData.rows) {
		// Count by source
		stats.bySource[row.source] = (stats.bySource[row.source] || 0) + 1;

		// Count by type
		stats.byType[row.type] = (stats.byType[row.type] || 0) + 1;

		// Track blocks and measures
		if (row.block !== '') {
			blocks.add(row.block);
			if (row.meas !== '') {
				measures.add(`${row.block}-${row.meas}`);
			}
		}

		// Pitch statistics
		if (row.pitch_note) {
			stats.pitchStats.total++;

			// Octave range
			if (typeof row.pitch_oct === 'number') {
				stats.pitchStats.octaveRange.min = Math.min(stats.pitchStats.octaveRange.min, row.pitch_oct);
				stats.pitchStats.octaveRange.max = Math.max(stats.pitchStats.octaveRange.max, row.pitch_oct);
			}

			// Alteration counts
			if (typeof row.pitch_alt === 'number') {
				const altKey = row.pitch_alt.toString();
				if (stats.pitchStats.alterationCounts.hasOwnProperty(altKey)) {
					stats.pitchStats.alterationCounts[altKey]++;
				}
			}
		}

		// Layout statistics
		if (typeof row.x === 'number') {
			stats.layoutStats.rowsWithX++;
			stats.layoutStats.xRange.min = Math.min(stats.layoutStats.xRange.min, row.x);
			stats.layoutStats.xRange.max = Math.max(stats.layoutStats.xRange.max, row.x);
		}

		// ABC statistics
		if (row.abc0) stats.abcStats.rowsWithAbc0++;
		if (row.abc) stats.abcStats.rowsWithAbc++;
	}

	stats.blockCount = blocks.size;
	stats.measureCount = measures.size;

	// Clean up infinite values
	if (stats.pitchStats.octaveRange.min === Infinity) {
		stats.pitchStats.octaveRange.min = 0;
		stats.pitchStats.octaveRange.max = 0;
	}

	if (stats.layoutStats.xRange.min === Infinity) {
		stats.layoutStats.xRange.min = 0;
		stats.layoutStats.xRange.max = 0;
	}

	return stats;
}

/**
 * Validate PipelineData for common issues
 * @param {PipelineData} pipelineData - PipelineData instance
 * @returns {Object} Validation result with errors and warnings
 */
export function validate(pipelineData) {
	const errors = [];
	const warnings = [];

	// Check for required columns
	const requiredColumns = ['source', 'block', 'type'];
	for (const row of pipelineData.rows) {
		for (const col of requiredColumns) {
			if (row[col] === undefined || row[col] === '') {
				errors.push(`Row missing required column '${col}': ${JSON.stringify(row.toJSON())}`);
			}
		}

		// Validate pitch_alt range
		if (typeof row.pitch_alt === 'number' && (row.pitch_alt < -2 || row.pitch_alt > 2)) {
			errors.push(`Row has invalid pitch_alt value ${row.pitch_alt}: ${JSON.stringify(row.toJSON())}`);
		}

		// Validate source values
		const validSources = ['lyrics', 'pitches', 'abchdr', 'counter'];
		if (row.source && !validSources.includes(row.source)) {
			warnings.push(`Row has unknown source '${row.source}': ${JSON.stringify(row.toJSON())}`);
		}
	}

	// Check for duplicate rows (by key columns)
	const seen = new Set();
	for (const row of pipelineData.rows) {
		const key = `${row.source}-${row.block}-${row.meas}-${row.beat}-${row.sub}`;
		if (seen.has(key)) {
			warnings.push(`Duplicate row detected: ${key}`);
		}
		seen.add(key);
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
		errorCount: errors.length,
		warningCount: warnings.length
	};
}

/**
 * Merge multiple PipelineData objects
 * @param {...PipelineData} pipelineDataArray - PipelineData instances to merge
 * @returns {PipelineData} Merged PipelineData
 */
export function merge(...pipelineDataArray) {
	const allRows = [];
	for (const pd of pipelineDataArray) {
		allRows.push(...pd.rows.map(r => r.clone()));
	}
	return new PipelineData(allRows);
}

/**
 * Sort PipelineData rows
 * @param {PipelineData} pipelineData - PipelineData instance
 * @param {Function} comparator - Comparator function
 * @returns {PipelineData} Sorted PipelineData
 */
export function sort(pipelineData, comparator) {
	const sortedRows = [...pipelineData.rows].sort(comparator);
	return new PipelineData(sortedRows);
}

/**
 * Default comparator for sorting rows by natural order
 * @param {Row} a - First row
 * @param {Row} b - Second row
 * @returns {number} Comparison result
 */
export function defaultComparator(a, b) {
	// Sort by: block, meas, beat, sub, source
	if (a.block !== b.block) return (a.block || 0) - (b.block || 0);
	if (a.meas !== b.meas) return (a.meas || 0) - (b.meas || 0);
	if (a.beat !== b.beat) return (a.beat || 0) - (b.beat || 0);
	if (a.sub !== b.sub) return (a.sub || 0) - (b.sub || 0);

	// Then by source order: abchdr, lyrics, pitches, counter
	const sourceOrder = { 'abchdr': 0, 'lyrics': 1, 'pitches': 2, 'counter': 3 };
	return (sourceOrder[a.source] || 4) - (sourceOrder[b.source] || 4);
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		toTSV,
		fromTSV,
		getStats,
		validate,
		merge,
		sort,
		defaultComparator
	};
}
