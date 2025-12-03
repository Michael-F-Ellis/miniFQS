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
 * Convert a beat with multiple attacks (all asterisks or syllables) to ABC string.
 * @param {number} N - number of attacks in the beat
 * @param {Array<string>} notes - array of ABC pitch strings (without duration)
 * @returns {string} ABC string for the beat (without spaces between notes)
 */
function convertMultipleAttacks(N, notes) {
	// If only one attack, it's a quarter note (no duration suffix)
	if (N === 1) {
		return notes[0];
	}
	// powers of two: 2,4,8,16,...
	const isPowerOfTwo = (n) => n > 0 && (n & (n - 1)) === 0;

	if (isPowerOfTwo(N)) {
		let duration = '/' + N;
		return notes.map(note => note + duration).join('');
	} else {
		// Find greatest power of two less than N
		let M = 2;
		while (M * 2 <= N) {
			M *= 2;
		}
		let duration = '/' + M;
		let noteStr = notes.map(note => note + duration).join('');
		return `(${N}${noteStr}`;
	}
}

/**
 * Process a measure (array of BeatTuples) and return ABC tokens for that measure.
 * @param {Array<Object>} measureBeats - BeatTuples in the measure
 * @param {Array<Object>} pitchQueue - pitch elements (Pitch, Barline, KeySignature)
 * @param {number} pitchIndex - current index in pitchQueue
 * @param {Object} prevPitchState - previous pitch state for LilyPond rule
 * @returns {Object} {tokens: Array<string>, newPitchIndex: number, newPrevPitchState: Object}
 */
function processMeasure(measureBeats, pitchQueue, pitchIndex, prevPitchState) {
	let tokens = [];
	let i = 0;
	while (i < measureBeats.length) {
		let beat = measureBeats[i];
		let firstSeg = beat.content[0];
		// Determine if this beat is an attack (syllable or asterisk)
		let isAttackBeat = false;
		let numAttacks = 0;
		if (firstSeg.type === 'Syllable') {
			isAttackBeat = true;
			numAttacks = beat.content.length; // each syllable is an attack
		} else if (firstSeg.type === 'Special' && firstSeg.value === '*') {
			isAttackBeat = true;
			// Count all asterisks in the beat (they are consecutive in the content array)
			numAttacks = beat.content.filter(seg => seg.type === 'Special' && seg.value === '*').length;
		}
		if (isAttackBeat) {
			// Look ahead for consecutive dash beats to extend the duration of the last attack
			let duration = 1; // each attack beat contributes 1 beat
			let j = i + 1;
			while (j < measureBeats.length &&
				measureBeats[j].content.length === 1 &&
				measureBeats[j].content[0].type === 'Special' &&
				measureBeats[j].content[0].value === '-') {
				duration++;
				j++;
			}
			// For multiple attacks in a beat (e.g., "Hap.py"), the beat is already subdivided.
			// The duration applies to the entire beat, but each subdivision gets a fraction.
			// However, in FQS, a dash after a multi-attack beat would be a separate beat, which is not allowed.
			// We'll assume dash extension only applies when numAttacks === 1.
			// For numAttacks > 1, the beat is already filled with subdivisions, and dashes would be separate beats (unlikely).
			// We'll ignore dashes for multi-attack beats for now.
			if (numAttacks === 1) {
				// Single attack (syllable or asterisk) possibly extended by dashes
				// Consume a pitch
				if (pitchIndex >= pitchQueue.length) {
					console.error('Not enough pitches');
					break;
				}
				let pitchElem = pitchQueue[pitchIndex++];
				while (pitchElem && pitchElem.type !== 'Pitch') {
					pitchElem = pitchQueue[pitchIndex++];
				}
				let currentPitch = calculatePitch(pitchElem, prevPitchState);
				prevPitchState = currentPitch;
				let abcPitch = convertAbsolutePitch(currentPitch.letter, currentPitch.octave, pitchElem.accidental);
				let durationStr = duration === 1 ? '' : duration.toString();
				tokens.push(abcPitch + durationStr);
				i = j;
			} else {
				// Multiple attacks in a single beat (e.g., "Hap.py")
				// Each attack gets a fraction of the beat. No dash extension.
				let notes = [];
				for (let k = 0; k < numAttacks; k++) {
					if (pitchIndex >= pitchQueue.length) {
						console.error('Not enough pitches');
						break;
					}
					let pitchElem = pitchQueue[pitchIndex++];
					while (pitchElem && pitchElem.type !== 'Pitch') {
						pitchElem = pitchQueue[pitchIndex++];
					}
					let currentPitch = calculatePitch(pitchElem, prevPitchState);
					prevPitchState = currentPitch;
					let abcPitch = convertAbsolutePitch(currentPitch.letter, currentPitch.octave, pitchElem.accidental);
					notes.push(abcPitch);
				}
				let beatStr = convertMultipleAttacks(numAttacks, notes);
				tokens.push(beatStr);
				i++;
			}
		}
		// Rest beat
		else if (firstSeg.type === 'Special' && firstSeg.value === ';') {
			tokens.push('z');
			i++;
		}
		// Dash beat (should have been consumed by attack lookahead)
		else if (firstSeg.type === 'Special' && firstSeg.value === '-') {
			console.warn('Dash beat without preceding attack in measure');
			i++;
		}
		// Other specials (like '=') ignored
		else {
			console.warn(`Unhandled beat type: ${firstSeg.type} value: ${firstSeg.value}`);
			i++;
		}
	}
	return { tokens, newPitchIndex: pitchIndex, newPrevPitchState: prevPitchState };
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

	// Process each block
	ast.blocks.forEach((block, blockIndex) => {
		if (block.type !== 'Block') {
			return;
		}

		// Get key signature from the block's pitch line
		const keySig = block.pitches.keySignature;
		lines.push(convertKeySignature(keySig));

		// Determine meter from counter, default to 4/4
		let meter = '4/4';
		if (block.counter && block.counter.value) {
			meter = `${block.counter.value}/4`;
		}
		lines.push(`M:${meter}`);
		lines.push('L:1/4'); // Default unit note length (quarter note)

		const pitchElements = block.pitches.elements || [];
		let abcTokens = [];

		// Initialize previous pitch state: virtual C4 (layout octave 0)
		let prevPitchState = { letter: 'c', octave: 0 };
		let pitchIndex = 0;

		// Group lyric items by measures (using barlines as separators)
		let measures = [];
		let currentMeasure = [];
		for (const item of block.lyrics) {
			if (item.type === 'Barline') {
				if (currentMeasure.length > 0) {
					measures.push(currentMeasure);
					currentMeasure = [];
				}
				// We'll add the barline later as a token
			} else {
				currentMeasure.push(item);
			}
		}
		// If there's a partial measure at the end (should not happen with valid FQS)
		if (currentMeasure.length > 0) {
			measures.push(currentMeasure);
		}

		// Process each measure
		for (let m = 0; m < measures.length; m++) {
			const measureBeats = measures[m];
			const result = processMeasure(measureBeats, pitchElements, pitchIndex, prevPitchState);
			abcTokens.push(...result.tokens);
			pitchIndex = result.newPitchIndex;
			prevPitchState = result.newPrevPitchState;
			// Add a barline after each measure (the FQS lyric line ends with a barline)
			abcTokens.push('|');
		}

		// Add the notes line
		if (abcTokens.length > 0) {
			lines.push(abcTokens.join(' '));
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
