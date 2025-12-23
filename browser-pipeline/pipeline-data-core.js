// PipelineData core class for FQS-to-ABC pipeline
// Manages collections of Row objects with comparison methods

import { Row } from './pipeline-row.js';

/**
 * PipelineData class representing a collection of rows
 */
export class PipelineData {
	constructor(rows = []) {
		this.rows = rows.map(r => r instanceof Row ? r : new Row(r));
		this.metadata = {
			version: '1.0',
			created: new Date().toISOString(),
			rowCount: this.rows.length
		};
	}

	/**
	 * Compare with sparse expected rows
	 * @param {Array} expected - Array of sparse row objects (only columns that matter)
	 * @param {Object} options - Comparison options
	 * @returns {Object} Comparison result
	 */
	matchesSparse(expected, options = {}) {
		const matchOrder = options.matchOrder !== false;
		const ignoreColumns = options.ignoreColumns || [];
		const tolerance = options.tolerance || 0;
		const keyColumns = options.keyColumns || ['block', 'meas', 'beat', 'sub', 'source'];

		if (matchOrder) {
			// Compare row by row in order
			if (this.rows.length !== expected.length) {
				return {
					match: false,
					reason: `Row count mismatch: ${this.rows.length} vs ${expected.length}`,
					details: {
						actualCount: this.rows.length,
						expectedCount: expected.length
					}
				};
			}

			for (let i = 0; i < this.rows.length; i++) {
				const actualRow = this.rows[i];
				const expectedSparse = expected[i];

				// Create a full Row from sparse expected data
				const expectedRow = new Row(expectedSparse);

				if (!actualRow.equals(expectedRow, { ignoreColumns, tolerance })) {
					const differences = actualRow.findDifferences(expectedRow, ignoreColumns);
					return {
						match: false,
						reason: `Row ${i} mismatch`,
						details: {
							rowIndex: i,
							actual: actualRow.toJSON(),
							expected: expectedRow.toJSON(),
							differences: differences
						}
					};
				}
			}

			return { match: true };
		} else {
			// Unordered comparison - match by key columns
			const unmatchedExpected = [...expected];
			const unmatchedActual = [...this.rows];
			const matches = [];

			for (let i = 0; i < unmatchedExpected.length; i++) {
				const expectedSparse = unmatchedExpected[i];
				const expectedRow = new Row(expectedSparse);

				// Find matching actual row by key columns
				let matchIndex = -1;
				for (let j = 0; j < unmatchedActual.length; j++) {
					const actualRow = unmatchedActual[j];

					// Check if key columns match
					let keysMatch = true;
					for (const key of keyColumns) {
						if (actualRow[key] !== expectedRow[key]) {
							keysMatch = false;
							break;
						}
					}

					if (keysMatch && actualRow.equals(expectedRow, { ignoreColumns, tolerance })) {
						matchIndex = j;
						break;
					}
				}

				if (matchIndex >= 0) {
					matches.push({
						expectedIndex: i,
						actualIndex: matchIndex,
						row: unmatchedActual[matchIndex].toJSON()
					});
					unmatchedExpected.splice(i, 1);
					unmatchedActual.splice(matchIndex, 1);
					i--; // Adjust index after removal
				}
			}

			if (unmatchedExpected.length === 0 && unmatchedActual.length === 0) {
				return { match: true, matches: matches };
			} else {
				return {
					match: false,
					reason: `Unmatched rows: ${unmatchedExpected.length} expected, ${unmatchedActual.length} actual`,
					details: {
						unmatchedExpected: unmatchedExpected.map(r => new Row(r).toJSON()),
						unmatchedActual: unmatchedActual.map(r => r.toJSON()),
						matches: matches
					}
				};
			}
		}
	}

	/**
	 * Filter rows by predicate
	 * @param {Function} predicate - Function returning boolean
	 * @returns {PipelineData} New PipelineData with filtered rows
	 */
	filter(predicate) {
		return new PipelineData(this.rows.filter(predicate));
	}

	/**
	 * Find rows by block
	 * @param {number} block - Block number
	 * @returns {PipelineData} Rows for specified block
	 */
	findByBlock(block) {
		return this.filter(r => r.block === block);
	}

	/**
	 * Find rows by source
	 * @param {string} source - Source type ('lyrics', 'pitches', 'abchdr', 'counter')
	 * @returns {PipelineData} Rows for specified source
	 */
	findBySource(source) {
		return this.filter(r => r.source === source);
	}

	/**
	 * Find rows by type
	 * @param {string} type - Row type
	 * @returns {PipelineData} Rows for specified type
	 */
	findByType(type) {
		return this.filter(r => r.type === type);
	}

	/**
	 * Group rows by key function
	 * @param {Function} fn - Function returning group key
	 * @returns {Map} Map of key -> array of rows
	 */
	groupBy(fn) {
		const groups = new Map();
		for (const row of this.rows) {
			const key = fn(row);
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key).push(row);
		}
		return groups;
	}

	/**
	 * Group rows by beat
	 * @returns {Map} Map of "block-meas-beat" -> array of rows
	 */
	groupByBeat() {
		return this.groupBy(r => `${r.block}-${r.meas}-${r.beat}`);
	}

	/**
	 * Group rows by measure
	 * @returns {Map} Map of "block-meas" -> array of rows
	 */
	groupByMeasure() {
		return this.groupBy(r => `${r.block}-${r.meas}`);
	}

	/**
	 * Convert to plain object for JSON serialization
	 * @returns {Object} Plain object representation
	 */
	toJSON() {
		return {
			metadata: this.metadata,
			rows: this.rows.map(r => r.toJSON())
		};
	}

	/**
	 * Create PipelineData from JSON
	 * @param {Object} json - JSON object
	 * @returns {PipelineData} New PipelineData instance
	 */
	static fromJSON(json) {
		const data = new PipelineData(json.rows || []);
		data.metadata = { ...data.metadata, ...(json.metadata || {}) };
		return data;
	}

	/**
	 * Create a copy of this PipelineData
	 * @returns {PipelineData} New PipelineData instance with same data
	 */
	clone() {
		return new PipelineData(this.rows.map(r => r.clone()));
	}
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { PipelineData };
}
