/**
 * optimize-helpers.js - Helper functions for tied note optimization
 * 
 * Shared helper functions used by optimizeTies.js and browser-pipeline/stages/optimize.js
 */

/**
 * Extract unit note length from abc0 column value
 * @param {string} abc0 - abc0 column value
 * @returns {string|null} Unit note length (e.g., "1/4", "1/8") or null if not found
 */
export function extractUnitNoteLength(abc0) {
	if (!abc0) return null;

	// Look for [L:1/4] or [L:1/8] pattern
	const match = abc0.match(/\[L:([^\]\s]+)\]/);
	if (match) {
		return match[1];
	}

	return null;
}

/**
 * Extract meter from abc0 column value
 * @param {string} abc0 - abc0 column value
 * @returns {string|null} Meter (e.g., "4/4", "3/4", "6/8") or null if not found
 */
export function extractMeter(abc0) {
	if (!abc0) return null;

	// Look for [M:...] pattern
	const match = abc0.match(/\[M:([^\]\s]+)\]/);
	if (match) {
		return match[1];
	}

	// Look for M: header value
	if (abc0.includes('M:')) {
		const parts = abc0.split('M:');
		if (parts.length > 1) {
			return parts[1].trim().split(/\s/)[0];
		}
	}

	return null;
}

/**
 * Parse duration denominator from ABC note string
 * @param {string} noteStr - ABC note string (e.g., "C/4", "C", "C3/4")
 * @returns {number} Duration denominator (1 for whole note, 4 for quarter, etc.)
 */
export function parseDurationDenominator(noteStr) {
	if (!noteStr) return 1;

	// Check for explicit duration like C3/4 or C/4
	// First check for dotted note with denominator: C3/4
	const dottedMatch = noteStr.match(/(\d+)\/(\d+)$/);
	if (dottedMatch) {
		return parseInt(dottedMatch[2]);
	}

	// Check for simple denominator: C/4
	const simpleMatch = noteStr.match(/\/(\d+)$/);
	if (simpleMatch) {
		return parseInt(simpleMatch[1]);
	}

	// Default: no denominator means duration 1 (whole note relative to L:)
	return 1;
}

/**
 * Calculate duration in "L units" for a note
 * @param {string} noteStr - ABC note string
 * @param {string} unitNoteLength - Unit note length (e.g., "1/4")
 * @returns {number} Duration in units (e.g., 0.25 for sixteenth with L:1/4)
 */
export function calculateDuration(noteStr, unitNoteLength) {
	if (!noteStr) return 0;

	// Parse unit denominator from unitNoteLength (e.g., "1/4" -> 4)
	const unitMatch = unitNoteLength.match(/\/(\d+)/);
	if (!unitMatch) return 0;
	const unitDenominator = parseInt(unitMatch[1]);

	// Parse note duration denominator
	const noteDenominator = parseDurationDenominator(noteStr);

	// Calculate duration ratio
	// With L:1/4 (unitDenominator=4):
	// - C (no denominator) = 1 whole note = 4 quarters = 4 units
	// - C/4 = quarter note = 1 unit
	// - C/8 = eighth note = 0.5 units
	const duration = unitDenominator / noteDenominator;

	// Check for dotted note (number before slash or at end)
	const dottedMatch = noteStr.match(/(\d+)(?:\/|$)/);
	if (dottedMatch) {
		const dottedValue = parseInt(dottedMatch[1]);
		// Dotted note duration = base duration * 1.5
		// But ABC notation: C3 = dotted half (when L:1/4, half=2, dotted=3)
		// Actually C3 means duration 3 (in L units)
		// So we should use the dotted value directly
		return dottedValue;
	}

	return duration;
}

/**
 * Check if a duration would cross a beat boundary
 * @param {number} startBeat - Starting beat (1-indexed, can be fractional)
 * @param {number} duration - Duration in beats
 * @param {string} meter - Meter (e.g., "4/4", "3/4")
 * @returns {boolean} True if would cross a beat boundary in a problematic way
 */
export function wouldCrossBeatBoundary(startBeat, duration, meter) {
	const endBeat = startBeat + duration;

	// Parse meter
	const meterMatch = meter.match(/(\d+)\/(\d+)/);
	if (!meterMatch) return false;
	const numerator = parseInt(meterMatch[1]);
	const denominator = parseInt(meterMatch[2]);

	// For simple meters (denominator 4), check each beat boundary
	if (denominator === 4) {
		// Check each whole beat boundary
		for (let beat = Math.ceil(startBeat); beat < endBeat; beat++) {
			// In 4/4, also check the imaginary barline between beats 2 and 3
			if (numerator === 4 && beat === 2.5) {
				// Crossing the middle of 4/4 measure
				return true;
			}
			// Crossing any whole beat boundary
			if (beat % 1 === 0 && beat <= numerator) {
				return true;
			}
		}
	}
	// For compound meters (denominator 8), check main beat boundaries
	else if (denominator === 8) {
		// In 6/8, main beats are at 1 and 4 (dotted quarters)
		// Each main beat = 3 eighth notes
		const mainBeatInterval = 3; // in eighth notes
		for (let beat = Math.ceil(startBeat * 3); beat < endBeat * 3; beat++) {
			if (beat % mainBeatInterval === 0) {
				return true;
			}
		}
	}

	return false;
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		extractUnitNoteLength,
		extractMeter,
		parseDurationDenominator,
		calculateDuration,
		wouldCrossBeatBoundary
	};
}
