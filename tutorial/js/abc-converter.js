// ABC Converter for miniFQS
// Converts miniFQS AST to ABC notation for rendering and playback

// =============================================================================
// Constants and Mappings
// =============================================================================

// Key signature mapping: FQS -> ABC
// FQS: K#2 -> D major, K&3 -> Eb major, K0 -> C major
const KEY_SIGNATURE_MAP = {
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

// Pitch mapping: FQS note to ABC note (without octave)
// We assume FQS lower octave runs from G3 to G4, so initial 'c' maps to middle C (C4)
// ABC uses: C,, (C2) to c'' (C6) approximately
// We'll map FQS note letters to ABC base note letters, then adjust octave
const PITCH_BASE = {
	'c': 'C',
	'd': 'D',
	'e': 'E',
	'f': 'F',
	'g': 'G',
	'a': 'A',
	'b': 'B'
};

// =============================================================================
// Helper Functions
// =============================================================================

// Map letter to numeric index for LilyPond Rule (same as in layout.js)
const PITCH_INDEX = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };

/**
 * Calculate the octave of a pitch relative to the previous pitch using LilyPond Rule.
 * This replicates the logic from layout.js's calculatePitch function.
 * @param {Object} current - FQS pitch object {note: 'c', octaveShifts: '^'}
 * @param {Object} prev - Previous pitch state {letter: 'c', octave: 0} where octave is layout octave (0 = C4)
 * @returns {Object} {letter, octave} where octave is layout octave
 */
function calculatePitch(current, prev) {
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

/**
 * Convert FQS key signature to ABC key signature
 * @param {Object} keySig - FQS key signature object {accidental: '#', count: 2} or {accidental: null, count: 0}
 * @returns {string} ABC key signature (e.g., "K:D major")
 */
function convertKeySignature(keySig) {
	if (!keySig) {
		return 'K:C major';
	}

	const keyStr = `K${keySig.accidental || ''}${keySig.count}`;
	const abcKey = KEY_SIGNATURE_MAP[keyStr];

	if (abcKey) {
		return `K:${abcKey} major`;
	}

	// Fallback
	return 'K:C major';
}

/**
 * Convert an absolute pitch (note + layout octave) to ABC notation.
 * Layout octave: 0 corresponds to C4, 1 to C5, -1 to C3, etc.
 * In ABC: C4 is 'C', C5 is 'c', C6 is 'c'', C3 is 'C,', C2 is 'C,,', etc.
 * @param {string} note - Note letter (lowercase a-g)
 * @param {number} layoutOctave - The octave number from calculatePitch
 * @param {string} accidental - FQS accidental ('#', '&', '##', '&&', '%')
 * @returns {string} ABC pitch string (e.g., "C", "c'", "^f", "_B,")
 */
function convertAbsolutePitch(note, layoutOctave, accidental) {
	// Convert note to uppercase base letter
	let abcNote = note.toUpperCase();

	// Map layout octave to absolute octave
	let abcPitch;
	if (layoutOctave > 0) {
		// Above C4: lowercase plus apostrophes (C5 = c, C6 = c', etc.)
		abcPitch = abcNote.toLowerCase();
		// Number of apostrophes = layoutOctave - 1
		for (let i = 0; i < layoutOctave - 1; i++) {
			abcPitch += "'";
		}
	} else if (layoutOctave < 0) {
		// Below C4: uppercase plus commas (C3 = C,, C2 = C,,, etc.)
		abcPitch = abcNote;
		// Number of commas = -layoutOctave
		for (let i = 0; i < -layoutOctave; i++) {
			abcPitch += ",";
		}
	} else {
		// Exactly C4: uppercase
		abcPitch = abcNote;
	}

	// Add accidental
	let abcAccidental = '';
	if (accidental) {
		switch (accidental) {
			case '#': abcAccidental = '^'; break;
			case '&': abcAccidental = '_'; break;
			case '##': abcAccidental = '^^'; break;
			case '&&': abcAccidental = '__'; break;
			case '%': abcAccidental = '='; break;
			default: abcAccidental = '';
		}
	}

	return abcAccidental + abcPitch;
}

/**
 * Convert FQS rhythm to ABC duration
 * @param {Array} content - Array of syllables and specials in a beat
 * @returns {string} ABC duration suffix (e.g., "/2", "", "/4")
 */
function getDurationFromContent(content) {
	if (!content || !Array.isArray(content)) {
		return '';
	}

	// Count the number of attacks (syllables and '*')
	let attackCount = 0;
	for (const segment of content) {
		if (segment.type === 'Syllable' || (segment.type === 'Special' && segment.value === '*')) {
			attackCount++;
		}
	}

	// Map to ABC duration
	// Assuming quarter note beat (L:1/4)
	if (attackCount === 0) {
		return ''; // rest or sustain
	} else if (attackCount === 1) {
		return ''; // quarter note
	} else if (attackCount === 2) {
		return '/2'; // two eighth notes
	} else if (attackCount === 3) {
		// Could be triplet or three sixteenths? We'll assume triplet for now
		return '/3'; // Actually ABC uses (3 for triplet, but duration is /2 with (3
	} else if (attackCount === 4) {
		return '/4'; // four sixteenth notes
	} else {
		// More than 4: use smallest denominator
		return `/${attackCount * 2}`; // e.g., 5 attacks -> /10 (quintuplet sixteenths?)
	}
}

/**
 * Check if a segment is an attack (consumes a pitch)
 * @param {Object} segment - Syllable or Special segment
 * @returns {boolean}
 */
function isAttack(segment) {
	return segment.type === 'Syllable' || (segment.type === 'Special' && segment.value === '*');
}

// =============================================================================
// Main Conversion Function
// =============================================================================

/**
 * Convert miniFQS AST to ABC notation
 * @param {Object} ast - The miniFQS AST
 * @returns {string} ABC notation string
 */
export function convertToABC(ast) {
	if (!ast || ast.type !== 'Score') {
		console.error('Invalid AST passed to convertToABC');
		return '';
	}

	const lines = [];

	// Header
	lines.push('X:1');
	lines.push(`T:${ast.title || 'Untitled'}`);
	lines.push('M:4/4'); // Default meter - we'll need to extract from rhythm
	lines.push('L:1/4'); // Default unit note length (quarter note)

	// Process each block
	ast.blocks.forEach((block, blockIndex) => {
		if (block.type !== 'Block') {
			return;
		}

		// Get key signature from the block's pitch line
		const keySig = block.pitches.keySignature;
		lines.push(convertKeySignature(keySig));

		const pitchElements = block.pitches.elements || [];
		let abcNotes = [];

		// Initialize previous pitch state: virtual C4 (layout octave 0)
		let prevPitchState = { letter: 'c', octave: 0 };

		for (const element of pitchElements) {
			if (element.type === 'Pitch') {
				// Calculate the current pitch's octave using LilyPond rule
				const currentPitch = calculatePitch(element, prevPitchState);
				// Convert to ABC notation
				const abcPitch = convertAbsolutePitch(
					currentPitch.letter,
					currentPitch.octave,
					element.accidental
				);
				abcNotes.push(abcPitch);
				// Update previous pitch state for next calculation
				prevPitchState = currentPitch;
			} else if (element.type === 'Barline') {
				abcNotes.push('|');
				// Note: octave state continues across barlines
			}
		}

		// Add the notes line
		if (abcNotes.length > 0) {
			lines.push(abcNotes.join(' '));
		}
	});

	// If no blocks, add a dummy line
	if (ast.blocks.length === 0) {
		lines.push('K:C major');
		lines.push('C D E F | G A B c');
	}

	return lines.join('\n');
}

/**
 * Debug function to log AST structure
 * @param {Object} ast - The miniFQS AST
 */
export function debugAST(ast) {
	console.log('AST structure:', JSON.stringify(ast, null, 2));
}

// =============================================================================
// Export
// =============================================================================

export default {
	convertToABC,
	debugAST
};
