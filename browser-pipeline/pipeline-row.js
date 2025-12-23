// Row class for FQS-to-ABC pipeline
// Represents a single row with all pipeline columns

/**
 * Row class representing a single row in the pipeline
 * All columns are initialized with default values
 */
export class Row {
	constructor(data = {}) {
		// Core columns (from flatten stage)
		this.source = data.source || '';           // 'lyrics', 'pitches', 'abchdr', 'counter'
		this.block = this._coerceNumber(data.block); // number (1-based) or ''
		this.meas = this._coerceNumber(data.meas);   // number (1-based, 0 for pickup) or ''
		this.beat = this._coerceNumber(data.beat);   // number (1-based) or ''
		this.sub = this._coerceNumber(data.sub);     // number (1-based) or ''
		this.total = this._coerceNumber(data.total); // number or ''
		this.type = data.type || '';               // 'Syllable', 'Special', 'Pitch', 'KeySig', 'Barline', 'BeatDur', 'ABCHeader', 'Counter'
		this.value = data.value || '';             // string
		this.dur = this._coerceNumber(data.dur);   // number or ''
		this.mod = data.mod || '';                 // string

		// Pitch columns
		this.pitch_idx = this._coerceNumber(data.pitch_idx); // number or ''
		this.pitch_note = data.pitch_note || '';   // string (a-g)
		this.pitch_acc = data.pitch_acc || '';     // string ('#', '##', '&', '&&', '%', '')
		this.pitch_oct = this._coerceNumber(data.pitch_oct); // number (absolute octave) or string (shifts) or ''
		this.pitch_alt = this._coerceNumber(data.pitch_alt); // integer (-2, -1, 0, 1, 2) or ''

		// Layout columns (added by layout stage)
		this.x = this._coerceNumber(data.x);       // number (monospace character widths) or ''
		// Future: this.y, this.staff_y, this.color

		// ABC columns (added by prep stage)
		this.abc0 = data.abc0 || '';               // string
		this.abc = data.abc || '';                 // string

		// Validate numeric fields
		this._validateNumbers();
	}

	/**
	 * Coerce value to number if possible, otherwise return original
	 */
	_coerceNumber(value) {
		if (value === '' || value === undefined || value === null) return '';
		if (typeof value === 'number') return value;
		const num = Number(value);
		return isNaN(num) ? value : num;
	}

	/**
	 * Validate numeric fields are actually numbers
	 */
	_validateNumbers() {
		const numericFields = ['block', 'meas', 'beat', 'sub', 'total', 'dur', 'pitch_idx', 'pitch_oct', 'pitch_alt', 'x'];
		for (const field of numericFields) {
			if (this[field] !== '' && typeof this[field] !== 'number') {
				this[field] = '';
			}
		}
	}

	/**
	 * Compare this row with another row
	 * @param {Row} other - Row to compare with
	 * @param {Object} options - Comparison options
	 * @param {Array} options.ignoreColumns - Columns to ignore in comparison
	 * @param {number} options.tolerance - Allowable difference for numeric values
	 * @returns {boolean} True if rows are equal within tolerance
	 */
	equals(other, options = {}) {
		if (!(other instanceof Row)) return false;

		const ignoreColumns = options.ignoreColumns || [];
		const tolerance = options.tolerance || 0;

		// Compare all columns
		const columns = [
			'source', 'block', 'meas', 'beat', 'sub', 'total', 'type', 'value',
			'dur', 'mod', 'pitch_idx', 'pitch_note', 'pitch_acc', 'pitch_oct',
			'pitch_alt', 'x', 'abc0', 'abc'
		];

		for (const col of columns) {
			if (ignoreColumns.includes(col)) continue;

			const a = this[col];
			const b = other[col];

			// Handle numeric comparison with tolerance
			if (typeof a === 'number' && typeof b === 'number') {
				if (Math.abs(a - b) > tolerance) return false;
			}
			// Handle string/number mixed comparison
			else if (typeof a === 'number' && typeof b === 'string') {
				const bNum = Number(b);
				if (isNaN(bNum) || Math.abs(a - bNum) > tolerance) return false;
			}
			else if (typeof a === 'string' && typeof b === 'number') {
				const aNum = Number(a);
				if (isNaN(aNum) || Math.abs(aNum - b) > tolerance) return false;
			}
			// Standard equality for strings/other
			else if (a !== b) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Find differences between this row and another row
	 * @param {Row} other - Row to compare with
	 * @param {Array} ignoreColumns - Columns to ignore
	 * @returns {Array} Array of difference objects
	 */
	findDifferences(other, ignoreColumns = []) {
		const diffs = [];
		const columns = [
			'source', 'block', 'meas', 'beat', 'sub', 'total', 'type', 'value',
			'dur', 'mod', 'pitch_idx', 'pitch_note', 'pitch_acc', 'pitch_oct',
			'pitch_alt', 'x', 'abc0', 'abc'
		];

		for (const col of columns) {
			if (ignoreColumns.includes(col)) continue;

			const a = this[col];
			const b = other[col];

			if (a !== b) {
				diffs.push({
					column: col,
					actual: a,
					expected: b,
					type: typeof a
				});
			}
		}

		return diffs;
	}

	/**
	 * Convert row to plain object
	 * @returns {Object} Plain object representation
	 */
	toJSON() {
		return {
			source: this.source,
			block: this.block,
			meas: this.meas,
			beat: this.beat,
			sub: this.sub,
			total: this.total,
			type: this.type,
			value: this.value,
			dur: this.dur,
			mod: this.mod,
			pitch_idx: this.pitch_idx,
			pitch_note: this.pitch_note,
			pitch_acc: this.pitch_acc,
			pitch_oct: this.pitch_oct,
			pitch_alt: this.pitch_alt,
			x: this.x,
			abc0: this.abc0,
			abc: this.abc
		};
	}

	/**
	 * Create Row from plain object
	 * @param {Object} json - Plain object
	 * @returns {Row} New Row instance
	 */
	static fromJSON(json) {
		return new Row(json);
	}

	/**
	 * Create a copy of this row
	 * @returns {Row} New Row instance with same data
	 */
	clone() {
		return new Row(this.toJSON());
	}
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { Row };
}
