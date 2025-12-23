// Stage 4: Calculate pitch alterations as integers (-2, -1, 0, 1, 2)
// Implements precedence: explicit accidental → measure accidental → key signature

import { accidentalToInteger, getKeySignatureAlteration, isBarlineRow } from '../utils.js';

/**
 * AlterationState class tracks alteration state within a measure
 */
class AlterationState {
	constructor() {
		// Current key signature
		this.currentKeySig = 'K0'; // Default: C major

		// Measure-level alterations: Map of note+octave -> alteration
		this.measureAlterations = new Map();

		// Track current measure number
		this.currentMeasure = null;
	}

	/**
	 * Set the current key signature
	 * @param {string} keySig - Key signature string (e.g., 'K#4', 'K&3', 'K0')
	 */
	setKeySignature(keySig) {
		this.currentKeySig = keySig;
		// Key signature change resets measure alterations
		this.measureAlterations.clear();
	}

	/**
	 * Start a new measure
	 * @param {number} measure - Measure number
	 */
	startMeasure(measure) {
		if (measure !== this.currentMeasure) {
			this.currentMeasure = measure;
			this.measureAlterations.clear();
		}
	}

	/**
	 * Get alteration for a note based on precedence rules
	 * @param {string} note - Pitch letter (a-g)
	 * @param {number} octave - Absolute octave
	 * @param {string} explicitAcc - Explicit accidental ('#', '##', '&', '&&', '%', '')
	 * @returns {number} Integer alteration (-2, -1, 0, 1, 2)
	 */
	getAlteration(note, octave, explicitAcc) {
		// 1. Explicit accidental overrides everything
		if (explicitAcc && explicitAcc !== '') {
			const alt = accidentalToInteger(explicitAcc);
			// Store this alteration for the measure
			this._storeMeasureAlteration(note, octave, alt);
			return alt;
		}

		// 2. Check if this note was modified previously in this measure
		const measureAlt = this._getMeasureAlteration(note, octave);
		if (measureAlt !== null) {
			return measureAlt;
		}

		// 3. Fallback to Key Signature
		return getKeySignatureAlteration(this.currentKeySig, note);
	}

	/**
	 * Store an alteration for the current measure
	 * @param {string} note - Pitch letter
	 * @param {number} octave - Absolute octave
	 * @param {number} alteration - Integer alteration
	 */
	_storeMeasureAlteration(note, octave, alteration) {
		const key = `${note}-${octave}`;
		this.measureAlterations.set(key, alteration);
	}

	/**
	 * Get alteration from current measure
	 * @param {string} note - Pitch letter
	 * @param {number} octave - Absolute octave
	 * @returns {number|null} Alteration or null if not found
	 */
	_getMeasureAlteration(note, octave) {
		const key = `${note}-${octave}`;
		return this.measureAlterations.has(key) ? this.measureAlterations.get(key) : null;
	}
}

/**
 * Calculate pitch alterations for all rows
 * @param {Array<Row>} rows - Rows from octaves stage
 * @returns {Array<Row>} Rows with pitch_alt populated
 */
export function alterationsStage(rows) {
	// Create a copy of rows
	const newRows = rows.map(row => {
		// If row has clone method, use it; otherwise create a shallow copy
		if (row && typeof row.clone === 'function') {
			return row.clone();
		}
		return { ...row };
	});

	// State for alteration calculation
	const alterationState = new AlterationState();
	let currentBlock = null;
	let currentMeasure = null;

	// First pass: identify key signatures and barlines
	for (const row of newRows) {
		const block = row.block || '';
		const source = row.source || '';
		const type = row.type || '';
		const value = row.value || '';

		// Handle block transitions
		if (block !== currentBlock) {
			currentBlock = block;
			alterationState.measureAlterations.clear();
			currentMeasure = null;
		}

		// Update key signature
		if (source === 'pitches' && type === 'KeySig') {
			alterationState.setKeySignature(value);
		}

		// Update measure on barlines
		if (isBarlineRow(row)) {
			const meas = row.meas || '';
			if (meas !== '') {
				currentMeasure = meas;
				alterationState.startMeasure(currentMeasure);
			}
		}

		// Set current measure for non-barline rows
		if (row.meas !== '' && row.meas !== undefined) {
			currentMeasure = row.meas;
			alterationState.startMeasure(currentMeasure);
		}
	}

	// Reset for second pass
	alterationState.measureAlterations.clear();
	currentBlock = null;
	currentMeasure = null;

	// Second pass: calculate alterations
	for (const row of newRows) {
		const block = row.block || '';
		const source = row.source || '';
		const type = row.type || '';
		const value = row.value || '';

		// Handle block transitions
		if (block !== currentBlock) {
			currentBlock = block;
			alterationState.measureAlterations.clear();
			currentMeasure = null;
		}

		// Update key signature
		if (source === 'pitches' && type === 'KeySig') {
			alterationState.setKeySignature(value);
		}

		// Update measure on barlines
		if (isBarlineRow(row)) {
			const meas = row.meas || '';
			if (meas !== '') {
				currentMeasure = meas;
				alterationState.startMeasure(currentMeasure);
			}
		}

		// Set current measure for non-barline rows
		if (row.meas !== '' && row.meas !== undefined) {
			currentMeasure = row.meas;
			alterationState.startMeasure(currentMeasure);
		}

		// Calculate alteration for pitch rows
		if ((source === 'pitches' && type === 'Pitch') ||
			(source === 'lyrics' && row.pitch_note)) {
			const note = row.pitch_note || '';
			const octave = typeof row.pitch_oct === 'number' ? row.pitch_oct : 4;
			const explicitAcc = row.pitch_acc || '';

			if (note) {
				const alteration = alterationState.getAlteration(note, octave, explicitAcc);
				row.pitch_alt = alteration;
			}
		}
	}

	return newRows;
}

/**
 * Get alteration statistics for debugging
 * @param {Array<Row>} rows - Rows from alterationsStage
 * @returns {Object} Statistics about alterations
 */
export function getAlterationStats(rows) {
	const stats = {
		totalPitches: 0,
		alterationCounts: { '-2': 0, '-1': 0, '0': 0, '1': 0, '2': 0 },
		byKeySignature: {},
		byBlock: {}
	};

	let currentKeySig = 'K0';

	for (const row of rows) {
		// Track key signatures
		if (row.source === 'pitches' && row.type === 'KeySig') {
			currentKeySig = row.value || 'K0';
			if (!stats.byKeySignature[currentKeySig]) {
				stats.byKeySignature[currentKeySig] = { total: 0, alterations: { '-2': 0, '-1': 0, '0': 0, '1': 0, '2': 0 } };
			}
		}

		// Count pitch alterations
		if ((row.source === 'pitches' && row.type === 'Pitch') ||
			(row.source === 'lyrics' && row.pitch_note)) {
			if (typeof row.pitch_alt === 'number') {
				stats.totalPitches++;

				const altKey = row.pitch_alt.toString();
				if (stats.alterationCounts.hasOwnProperty(altKey)) {
					stats.alterationCounts[altKey]++;
				}

				// Count by key signature
				if (stats.byKeySignature[currentKeySig]) {
					stats.byKeySignature[currentKeySig].total++;
					stats.byKeySignature[currentKeySig].alterations[altKey]++;
				}

				// Count by block
				const block = row.block || 'unknown';
				if (!stats.byBlock[block]) {
					stats.byBlock[block] = { total: 0, alterations: { '-2': 0, '-1': 0, '0': 0, '1': 0, '2': 0 } };
				}
				stats.byBlock[block].total++;
				stats.byBlock[block].alterations[altKey]++;
			}
		}
	}

	return stats;
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { alterationsStage, getAlterationStats };
}
