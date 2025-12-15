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
 * Get the next pitch element from the pitch queue, skipping non-pitch elements.
 * @param {Array<Object>} pitchQueue - array of pitch elements
 * @param {number} index - current index
 * @returns {Object} {elem: pitch element or null, newIndex: next index}
 */
function getNextPitch(pitchQueue, index) {
	while (index < pitchQueue.length && pitchQueue[index].type !== 'Pitch') {
		index++;
	}
	if (index >= pitchQueue.length) {
		return { elem: null, newIndex: index };
	}
	return { elem: pitchQueue[index], newIndex: index + 1 };
}

/**
 * Check if a segment is an attack (syllable or asterisk).
 * @param {Object} seg - segment object
 * @returns {boolean} true if the segment is an attack
 */
function isAttackSegment(seg) {
	return seg.type === 'Syllable' || (seg.type === 'Special' && seg.value === '*');
}

/**
 * Find the next attack or rest in the segments array.
 * @param {Array<Object>} segments - array of segment objects
 * @param {number} startIndex - index to start searching from
 * @returns {number} index of next attack or rest, or -1 if not found
 */
function findNextAttack(segments, startIndex) {
	for (let i = startIndex; i < segments.length; i++) {
		if (isAttackSegment(segments[i]) || (segments[i].type === 'Special' && segments[i].value === ';')) {
			return i;
		}
	}
	return -1;
}

/**
 * Compute the duration in beats between two positions.
 * @param {Object} start - object with beat, subdivisionIndex, subdivisionDuration
 * @param {Object} end - object with beat, subdivisionIndex, subdivisionDuration
 * @returns {number} duration in beats
 */
function computeDuration(start, end) {
	let startBeat = start.beat + (start.subdivisionIndex * start.subdivisionDuration);
	let endBeat = end.beat + (end.subdivisionIndex * end.subdivisionDuration);
	return endBeat - startBeat;
}

/**
 * Convert a decimal duration to a fraction with denominator up to 64.
 * @param {number} decimal - duration in beats as decimal
 * @returns {Array<number>} [numerator, denominator]
 */
function toFraction(decimal) {
	const tolerance = 1.0e-6;
	let numerator = 1, denominator = 1;
	let fraction = decimal;
	while (Math.abs(fraction - Math.round(fraction)) > tolerance && denominator < 64) {
		denominator++;
		numerator = Math.round(fraction * denominator);
		fraction = numerator / denominator;
	}
	return [Math.round(numerator), Math.round(denominator)];
}

/**
 * Convert a duration in beats to ABC notation.
 * @param {number} durationInBeats - duration in beats (quarter notes)
 * @returns {string} ABC duration suffix
 */
function convertDurationToABC(durationInBeats) {
	if (durationInBeats === 1) return '';
	if (durationInBeats === 0.5) return '/2';
	if (durationInBeats === 0.25) return '/4';
	if (durationInBeats === 0.75) return '3/4';
	if (durationInBeats === 1.5) return '3/2';
	if (durationInBeats === 2) return '2';
	// For other durations, use fraction
	let frac = toFraction(durationInBeats);
	if (frac[1] === 1) return frac[0].toString();
	return frac[0] + '/' + frac[1];
}

/**
 * Process a measure (array of BeatTuples) and return ABC tokens for that measure.
 * This new implementation handles dotted rhythms by analyzing subdivisions within beats.
 * @param {Array<Object>} measureBeats - BeatTuples in the measure
 * @param {Array<Object>} pitchQueue - pitch elements (Pitch, Barline, KeySignature)
 * @param {number} pitchIndex - current index in pitchQueue
 * @param {Object} prevPitchState - previous pitch state for LilyPond rule
 * @returns {Object} {tokens: Array<string>, newPitchIndex: number, newPrevPitchState: Object}
 */
function processMeasure(measureBeats, pitchQueue, pitchIndex, prevPitchState) {
	// Pass 1: Flatten segments
	let segments = [];
	let currentBeat = 0;
	for (let beat of measureBeats) {
		let subdivisionsInBeat = beat.content.length;
		let subdivisionDuration = beat.duration / subdivisionsInBeat;
		for (let j = 0; j < beat.content.length; j++) {
			let seg = beat.content[j];
			segments.push({
				type: seg.type,
				value: seg.value,
				beat: currentBeat,
				subdivisionIndex: j,
				subdivisionDuration: subdivisionDuration
			});
		}
		currentBeat += beat.duration;
	}

	// Pass 2: Build tokens
	let tokens = [];
	let pendingAttack = null;
	let segIndex = 0;
	while (segIndex < segments.length) {
		let seg = segments[segIndex];
		if (seg.type === 'Special' && seg.value === ';') {
			// Rest: finalize any pending attack and add a rest
			if (pendingAttack) {
				let duration = computeDuration(pendingAttack, seg);
				let { elem: pitchElem } = getNextPitch(pitchQueue, pendingAttack.pitchIndex);
				if (!pitchElem) {
					console.error('Not enough pitches');
					break;
				}
				let currentPitch = calculatePitch(pitchElem, prevPitchState);
				prevPitchState = currentPitch;
				let abcPitch = convertAbsolutePitch(currentPitch.letter, currentPitch.octave, pitchElem.accidental);
				tokens.push(abcPitch + convertDurationToABC(duration));
				pendingAttack = null;
			}
			// Rest duration: until the next attack or end of measure
			let restStart = seg;
			let nextAttackIndex = findNextAttack(segments, segIndex + 1);
			let restEnd;
			if (nextAttackIndex !== -1) {
				restEnd = segments[nextAttackIndex];
				segIndex = nextAttackIndex;
			} else {
				restEnd = { beat: currentBeat, subdivisionIndex: 0, subdivisionDuration: 0 };
				segIndex = segments.length;
			}
			let restDuration = computeDuration(restStart, restEnd);
			tokens.push('z' + convertDurationToABC(restDuration));
		}
		else if (isAttackSegment(seg)) {
			if (pendingAttack) {
				// Finalize pending attack
				let duration = computeDuration(pendingAttack, seg);
				let { elem: pitchElem } = getNextPitch(pitchQueue, pendingAttack.pitchIndex);
				if (!pitchElem) {
					console.error('Not enough pitches');
					break;
				}
				let currentPitch = calculatePitch(pitchElem, prevPitchState);
				prevPitchState = currentPitch;
				let abcPitch = convertAbsolutePitch(currentPitch.letter, currentPitch.octave, pitchElem.accidental);
				tokens.push(abcPitch + convertDurationToABC(duration));
			}
			// Start new attack
			let { elem: pitchElem, newIndex: newPitchIndex } = getNextPitch(pitchQueue, pitchIndex);
			if (!pitchElem) {
				console.error('Not enough pitches');
				break;
			}
			pendingAttack = {
				beat: seg.beat,
				subdivisionIndex: seg.subdivisionIndex,
				subdivisionDuration: seg.subdivisionDuration,
				pitchIndex: pitchIndex
			};
			pitchIndex = newPitchIndex;
			segIndex++;
		}
		else if (seg.type === 'Special' && seg.value === '-') {
			// Dash: extends the pending attack, so we just skip and let the duration accumulate
			segIndex++;
		}
		else {
			// Other segments (like '=') are ignored for now
			segIndex++;
		}
	}

	// If there's a pending attack at the end of the measure, finalize it
	if (pendingAttack) {
		let duration = computeDuration(pendingAttack, { beat: currentBeat, subdivisionIndex: 0, subdivisionDuration: 0 });
		let { elem: pitchElem } = getNextPitch(pitchQueue, pendingAttack.pitchIndex);
		if (pitchElem) {
			let currentPitch = calculatePitch(pitchElem, prevPitchState);
			prevPitchState = currentPitch;
			let abcPitch = convertAbsolutePitch(currentPitch.letter, currentPitch.octave, pitchElem.accidental);
			tokens.push(abcPitch + convertDurationToABC(duration));
		}
	}

	return { tokens, newPitchIndex: pitchIndex, newPrevPitchState: prevPitchState };
}

// =============================================================================
// Main Conversion Function
// =============================================================================

/**
 * Calculate the total beats in a measure (array of BeatTuples).
 * @param {Array<Object>} measureBeats - BeatTuples in the measure
 * @returns {number} total beats
 */
function measureDuration(measureBeats) {
	let total = 0;
	for (let beat of measureBeats) {
		total += beat.duration;
	}
	return total;
}

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
		} else {
			// Infer meter from the first measure's total beats
			// Group lyric items by measures to get the first measure
			let firstMeasureBeats = [];
			for (const item of block.lyrics) {
				if (item.type === 'Barline') {
					break;
				}
				firstMeasureBeats.push(item);
			}
			if (firstMeasureBeats.length > 0) {
				let totalBeats = measureDuration(firstMeasureBeats);
				meter = `${totalBeats}/4`;
			}
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

// Expose convertToABC globally for browser pipeline
if (typeof window !== 'undefined') {
	window.convertToABC = convertToABC;
	console.log('convertToABC function exposed globally for browser pipeline');
}
