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
 * Convert FQS pitch to ABC pitch with octave
 * @param {Object} pitch - FQS pitch object {note: 'c', accidental: '#', octaveShifts: '^'}
 * @param {number} baseOctave - The base octave (default 4 for middle C)
 * @returns {string} ABC pitch (e.g., "c'", "^f", "=B")
 */
function convertPitch(pitch, baseOctave = 4) {
	if (!pitch) {
		return '';
	}

	let abcNote = PITCH_BASE[pitch.note] || pitch.note.toUpperCase();
	let octave = baseOctave;

	// Adjust octave based on note position (simplified)
	// In FQS, the staff shows G3 to G4, so we map:
	// G3 -> G, A3 -> A, B3 -> B, C4 -> c, D4 -> d, E4 -> e, F4 -> f, G4 -> g
	// This is a simplification; we'll use a lookup table
	const noteToOctaveOffset = {
		'c': 0,  // C4 -> c
		'd': 0,  // D4 -> d
		'e': 0,  // E4 -> e
		'f': 0,  // F4 -> f
		'g': 0,  // G4 -> g
		'a': 0,  // A4 -> a
		'b': 0   // B4 -> b
	};

	// Apply octave shifts
	if (pitch.octaveShifts) {
		for (const shift of pitch.octaveShifts) {
			if (shift === '^') octave++;
			if (shift === '/') octave--;
		}
	}

	// Convert to ABC notation
	// ABC uses: , for lower octave, ' for higher octave
	// Middle C is c
	// Below middle C: C, B,, etc.
	// Above middle C: c', d', etc.
	let abcPitch = abcNote;

	if (octave > 4) {
		abcPitch = abcPitch.toLowerCase();
		for (let i = 4; i < octave; i++) {
			abcPitch += "'";
		}
	} else if (octave < 4) {
		abcPitch = abcPitch.toUpperCase();
		for (let i = octave; i < 4; i++) {
			abcPitch += ",";
		}
	} else {
		// octave 4
		if (abcNote >= 'A' && abcNote <= 'G') {
			// For octave 4, notes from C4 to B4: c, d, e, f, g, a, b
			abcPitch = abcNote.toLowerCase();
		}
	}

	// Add accidental
	let accidental = '';
	if (pitch.accidental) {
		switch (pitch.accidental) {
			case '#': accidental = '^'; break;
			case '&': accidental = '_'; break;
			case '##': accidental = '^^'; break;
			case '&&': accidental = '__'; break;
			case '%': accidental = '='; break;
			default: accidental = '';
		}
	}

	return accidental + abcPitch;
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

		// We need to combine lyrics and pitches
		// This is a simplified version - we'll just extract the melody from pitches
		// ignoring lyrics for now

		const pitchElements = block.pitches.elements || [];
		let abcNotes = [];

		for (const element of pitchElements) {
			if (element.type === 'Pitch') {
				const abcPitch = convertPitch(element);
				abcNotes.push(abcPitch);
			} else if (element.type === 'Barline') {
				abcNotes.push('|');
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
