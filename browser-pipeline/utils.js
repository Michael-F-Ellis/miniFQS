// Shared utilities for browser pipeline
// Constants and helper functions used across multiple stages

import { Row } from './pipeline-row.js';

// =============================================================================
// Constants
// =============================================================================

// Key signature mapping: FQS -> ABC (major key equivalent)
export const KEY_SIGNATURE_MAP = {
	// Sharps
	'K#1': 'G',
	'K#2': 'D',
	'K#3': 'A',
	'K#4': 'E',
	'K#5': 'B',
	'K#6': 'F#',
	'K#7': 'C#',
	// Flats
	'K&1': 'F',
	'K&2': 'Bb',
	'K&3': 'Eb',
	'K&4': 'Ab',
	'K&5': 'Db',
	'K&6': 'Gb',
	'K&7': 'Cb',
	// Neutral
	'K0': 'C'
};

// Pitch index for LilyPond Rule
export const PITCH_INDEX = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };

// Alteration mapping: FQS accidental -> integer
export const ALTERATION_MAP = {
	'#': 1,
	'##': 2,
	'&': -1,
	'&&': -2,
	'%': 0,
	'': 0  // No accidental
};

// Reverse alteration mapping: integer -> ABC accidental
export const INTEGER_TO_ABC_ACCIDENTAL = {
	'-2': '__',
	'-1': '_',
	'0': '',
	'1': '^',
	'2': '^^'
};

// =============================================================================
// Row Data Structure
// =============================================================================

/**
 * Create a new Row instance with default values
 * @param {Object} overrides - Property values to override defaults
 * @returns {Row} Row instance
 */
export function createRow(overrides = {}) {
	return new Row(overrides);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a lyric row represents an attack (syllable or asterisk).
 * @param {Row|Object} row - Row object or Row instance
 * @returns {boolean} true if the row is an attack
 */
export function isAttackRow(row) {
	if (row.source !== 'lyrics') {
		return false;
	}
	const type = row.type;
	const value = row.value || '';

	// Syllable is always an attack
	if (type === 'Syllable') {
		return true;
	}
	// Special: asterisk is an attack
	if (type === 'Special' && value === '*') {
		return true;
	}
	return false;
}

/**
 * Calculate the octave of a pitch relative to the previous pitch using LilyPond Rule.
 * @param {Object} current - FQS pitch object {note: 'c', octaveShifts: '^'}
 * @param {Object} prev - Previous pitch state {letter: 'c', octave: 4} where octave is musical octave (4 = C4)
 * @returns {Object} {letter, octave} where octave is musical octave (4 = C4)
 */
export function calculatePitch(current, prev) {
	let letter = current.note;
	let octave = prev.octave;

	// LilyPond Rule
	const prevIdx = PITCH_INDEX[prev.letter];
	const currIdx = PITCH_INDEX[letter];
	const diff = currIdx - prevIdx;

	if (diff > 3) octave--;
	else if (diff < -3) octave++;

	// Explicit Modifiers
	if (current.octaveShifts) {
		for (let char of current.octaveShifts) {
			if (char === '^') octave++;
			if (char === '/') octave--;
		}
	}

	return { letter, octave };
}

// =============================================================================
// Alteration Helper Functions
// =============================================================================

/**
 * Convert FQS accidental to integer alteration
 * @param {string} fqsAcc - FQS accidental ('#', '##', '&', '&&', '%', '')
 * @returns {number} Integer alteration (-2, -1, 0, 1, 2)
 */
export function accidentalToInteger(fqsAcc) {
	return ALTERATION_MAP[fqsAcc] !== undefined ? ALTERATION_MAP[fqsAcc] : 0;
}

/**
 * Convert integer alteration to ABC accidental
 * @param {number} alteration - Integer alteration (-2, -1, 0, 1, 2)
 * @returns {string} ABC accidental string
 */
export function integerToABCAccidental(alteration) {
	const key = alteration.toString();
	return INTEGER_TO_ABC_ACCIDENTAL[key] || '';
}

/**
 * Get key signature alteration for a note
 * @param {string} keySig - Key signature string (e.g., 'K#4', 'K&3', 'K0')
 * @param {string} note - Pitch letter (a-g)
 * @returns {number} Integer alteration for this note in this key
 */
export function getKeySignatureAlteration(keySig, note) {
	// Default: C major (no sharps or flats)
	if (!keySig || keySig === 'K0') return 0;

	// Parse key signature
	const isSharp = keySig.includes('#');
	const isFlat = keySig.includes('&');
	const count = parseInt(keySig.slice(2)) || 0;

	// Circle of fifths order for sharps: F C G D A E B
	const sharpOrder = ['f', 'c', 'g', 'd', 'a', 'e', 'b'];
	// Circle of fifths order for flats: B E A D G C F (reverse of sharps)
	const flatOrder = ['b', 'e', 'a', 'd', 'g', 'c', 'f'];

	if (isSharp && count > 0) {
		// Sharps: first count notes in sharpOrder get +1
		const sharpNotes = sharpOrder.slice(0, count);
		return sharpNotes.includes(note.toLowerCase()) ? 1 : 0;
	} else if (isFlat && count > 0) {
		// Flats: first count notes in flatOrder get -1
		const flatNotes = flatOrder.slice(0, count);
		return flatNotes.includes(note.toLowerCase()) ? -1 : 0;
	}

	return 0;
}

/**
 * Check if a row is a barline
 * @param {Row|Object} row - Row object
 * @returns {boolean} True if row is a barline
 */
export function isBarlineRow(row) {
	return row.type === 'Barline' || (row.source === 'lyrics' && row.value === '|');
}

/**
 * Check if a row is a counter row
 * @param {Row|Object} row - Row object
 * @returns {boolean} True if row is a counter
 */
export function isCounterRow(row) {
	return row.type === 'Counter' || (row.source === 'counter');
}

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Create a standardized error object for pipeline stages
 * @param {string} stage - Stage name
 * @param {string} message - Error message
 * @param {Error} originalError - Original error object (optional)
 * @returns {Object} Standardized error object
 */
export function createPipelineError(stage, message, originalError = null) {
	return {
		stage,
		message,
		timestamp: Date.now(),
		originalError: originalError ? {
			message: originalError.message,
			stack: originalError.stack
		} : null
	};
}

// =============================================================================
// Performance Measurement
// =============================================================================

/**
 * Create a performance measurement object for a stage
 * @param {string} name - Stage name
 * @param {number} startTime - Performance.now() start time
 * @param {number} endTime - Performance.now() end time
 * @param {boolean} success - Whether stage succeeded
 * @returns {Object} Performance measurement object
 */
export function createStageMeasurement(name, startTime, endTime, success) {
	return {
		name,
		duration: endTime - startTime,
		success,
		startTime,
		endTime
	};
}
