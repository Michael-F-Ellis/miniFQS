// Shared utilities for browser pipeline
// Constants and helper functions used across multiple stages

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

// =============================================================================
// Row Data Structure
// =============================================================================

/**
 * Create a new row object with default values
 * @param {Object} overrides - Property values to override defaults
 * @returns {Object} Row object
 */
export function createRow(overrides = {}) {
	const defaultRow = {
		source: '',
		block: '',
		meas: '',
		beat: '',
		sub: '',
		total: '',
		type: '',
		value: '',
		dur: '',
		mod: '',
		pitch_idx: '',
		pitch_note: '',
		pitch_acc: '',
		pitch_oct: '',
		abc0: '',
		abc: ''
	};
	return { ...defaultRow, ...overrides };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a lyric row represents an attack (syllable or asterisk).
 * @param {Object} row - Row object
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
