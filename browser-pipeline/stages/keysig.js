// Stage 8: Add key signatures and barlines in ABC format
// Adapts abckeysig.js functionality for browser use

import { KEY_SIGNATURE_MAP } from '../utils.js';

/**
 * Convert FQS key signature to ABC inline key signature
 * @param {string} fqsKey - FQS key signature value (e.g., 'K#6', 'K&3', 'K0')
 * @returns {string} ABC inline key signature (e.g., '[K:F# major]', '[K:Eb major]', '[K:C major]')
 */
function convertKeySignature(fqsKey) {
	const abcKey = KEY_SIGNATURE_MAP[fqsKey];
	if (!abcKey) {
		console.warn(`Unknown key signature '${fqsKey}', defaulting to C major`);
		return '[K:C major]';
	}
	return `[K:${abcKey} major]`;
}

/**
 * Convert FQS key signature to ABC header format (no brackets)
 * @param {string} fqsKey - FQS key signature value
 * @returns {string} ABC header key signature (e.g., 'C major', 'F# major', 'Eb major')
 */
function convertKeySignatureHeader(fqsKey) {
	const abcKey = KEY_SIGNATURE_MAP[fqsKey];
	if (!abcKey) {
		console.warn(`Unknown key signature '${fqsKey}', defaulting to C major`);
		return 'C major';
	}
	return `${abcKey} major`;
}

/**
 * Add key signatures and barlines to rows
 * @param {Array<Object>} rows - Rows from meterStage
 * @returns {Array<Object>} Rows with abc0 updated with key signatures and barlines
 */
export function keysigStage(rows) {
	// Create a copy of rows
	const newRows = rows.map(row => ({ ...row }));

	// Collect key signatures in order
	const keySignatures = [];
	for (let i = 0; i < newRows.length; i++) {
		const row = newRows[i];
		if (row.type === 'KeySig') {
			keySignatures.push({
				index: i,
				fqsKey: row.value,
				abcInline: convertKeySignature(row.value),
				abcHeader: convertKeySignatureHeader(row.value)
			});
		}
	}

	// Process first key signature (place in K: header row)
	if (keySignatures.length > 0) {
		const firstKeySig = keySignatures[0];
		// Find K: header row
		for (let i = 0; i < newRows.length; i++) {
			const row = newRows[i];
			if (row.source === 'abchdr' && row.value === 'K:') {
				row.abc0 = firstKeySig.abcHeader;
				break;
			}
		}
	}

	// Collect lyric barlines in order
	const lyricBarlines = [];
	for (let i = 0; i < newRows.length; i++) {
		const row = newRows[i];
		if (row.source === 'lyrics' && row.type === 'Barline') {
			lyricBarlines.push({
				index: i,
				row: row
			});
		}
	}

	// Process subsequent key signatures (attach to lyric barlines in order)
	// First key signature (k=0) already handled (K: header)
	// For each remaining key signature, attach to corresponding barline only if key changes
	// Key signature k (1-based) attaches to barline k-1 (0-based)
	let currentKey = keySignatures.length > 0 ? keySignatures[0].abcInline : '[K:C major]';

	for (let k = 1; k < keySignatures.length; k++) {
		const keySig = keySignatures[k];
		const barlineIndex = k - 1; // first subsequent key -> first barline, second -> second, etc.

		// Only output inline key signature if key actually changes
		if (keySig.abcInline !== currentKey) {
			if (barlineIndex < lyricBarlines.length) {
				const barline = lyricBarlines[barlineIndex];
				const barlineRow = barline.row;
				// Append key signature to barline: "| [K:X major]"
				const currentAbc0 = barlineRow.abc0 || '';
				if (currentAbc0 === '|' || currentAbc0 === '') {
					barlineRow.abc0 = `| ${keySig.abcInline}`;
				} else {
					// If barline already has something, append with space
					barlineRow.abc0 = `${currentAbc0} ${keySig.abcInline}`;
				}
			}
			// Update current key
			currentKey = keySig.abcInline;
		}
		// Key hasn't changed, skip this inline key signature
	}

	// Process barlines (for rows without key signatures)
	for (let i = 0; i < newRows.length; i++) {
		const row = newRows[i];
		if (row.type === 'Barline') {
			// Only set if abc0 is empty (not already set by key signature attachment)
			const currentAbc0 = row.abc0 || '';
			if (currentAbc0 === '') {
				row.abc0 = row.value; // value should be '|'
			}
		}
	}

	return newRows;
}

/**
 * Get key signature statistics
 * @param {Array<Object>} rows - Rows from keysigStage
 * @returns {Object} Statistics about key signatures
 */
export function getKeysigStats(rows) {
	const stats = {
		totalKeySigs: 0,
		keySignatures: [],
		currentKey: 'C major',
		hasKeyChanges: false
	};

	const keySignatures = [];
	for (const row of rows) {
		if (row.type === 'KeySig') {
			stats.totalKeySigs++;
			const abcKey = convertKeySignatureHeader(row.value);
			keySignatures.push(abcKey);
		}
	}

	if (keySignatures.length > 0) {
		stats.keySignatures = keySignatures;
		stats.currentKey = keySignatures[0];
		stats.hasKeyChanges = keySignatures.some((key, i) => i > 0 && key !== keySignatures[i - 1]);
	}

	return stats;
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { keysigStage, convertKeySignature, convertKeySignatureHeader, getKeysigStats };
}
