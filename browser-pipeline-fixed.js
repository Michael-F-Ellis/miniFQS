// Browser Pipeline for FQS-to-ABC Conversion
// ES Module implementation of the command-line pipeline for browser use

// =============================================================================
// Constants and Shared Utilities
// =============================================================================

// Key signature mapping: FQS -> ABC (major key equivalent)
// Same mapping as in abc-converter.js and abckeysig.js
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

// Pitch index for LilyPond Rule (same as in layout.js and pitch-octaves.js)
const PITCH_INDEX = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };

// =============================================================================
// Row Data Structure
// =============================================================================

/**
 * Create a new row object with default values
 * @param {Object} overrides - Property values to override defaults
 * @returns {Object} Row object
 */
function createRow(overrides = {}) {
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
// Stage 1: Parse (fqs2ast.js)
// =============================================================================

/**
 * Parse FQS text to AST
 * @param {string} fqsText - FQS notation text
 * @returns {Object} AST object
 * @throws {Error} If parsing fails
 */
function parseStage(fqsText) {
	// Note: This assumes parser.js is available as an ES module
	// In browser context, we need to import it differently
	// For now, we'll assume parse function is available globally or will be injected
	throw new Error('parseStage: Parser not yet integrated. Need to import parse from parser.js');
}

// =============================================================================
// Stage 2: Flatten AST (ast2flat.js)
// =============================================================================

/**
 * Flatten lyrics from a block into rows
 * @param {number} blockIdx - 1-based block index
 * @param {Object} block - the block object
 * @returns {Array<Object>} Array of row objects
 */
function flattenLyrics(blockIdx, block) {
	const rows = [];
	// Determine starting measure: if counter exists, start at 0 (pickup), else 1
	let measure = block.counter ? 0 : 1;
	let beatInMeasure = 1; // 1-based beat within current measure
	let totalBeats = 0;   // cumulative beats from start of block

	for (const item of block.lyrics) {
		if (item.type === 'Barline') {
			// Output a barline row
			rows.push(createRow({
				source: 'lyrics',
				block: blockIdx,
				meas: measure,
				beat: '',
				sub: '',
				total: 0,
				type: 'Barline',
				value: '|',
				dur: '',
				mod: '',
				pitch_idx: '',
				pitch_note: '',
				pitch_acc: '',
				pitch_oct: ''
			}));

			// Move to next measure
			measure++;
			beatInMeasure = 1;
			// totalBeats remains unchanged (barline doesn't add beats)
		}
		else if (item.type === 'BeatDuration') {
			// Output a beat duration row (from lyric line directive [4.] or [4])
			const value = `[${item.duration}${item.dotted ? '.' : ''}]`;
			rows.push(createRow({
				source: 'lyrics',
				block: blockIdx,
				meas: measure, // current measure
				beat: '',
				sub: '',
				total: 0,
				type: 'BeatDur',
				value: value,
				dur: '',
				mod: '',
				pitch_idx: '',
				pitch_note: '',
				pitch_acc: '',
				pitch_oct: ''
			}));
			// Beat duration directive doesn't affect beat counting
		}
		else if (item.type === 'BeatTuple') {
			const dur = item.duration;
			const subdivisions = item.content.length;
			const subDur = dur / subdivisions;

			for (let subIdx = 0; subIdx < subdivisions; subIdx++) {
				const segment = item.content[subIdx];
				const sub = subIdx + 1; // 1-based subdivision
				const total = totalBeats + (subIdx * subDur);

				// Determine type and value
				let type, value;
				if (segment.type === 'Special') {
					type = 'Special';
					value = segment.value;
				} else if (segment.type === 'Syllable') {
					type = 'Syllable';
					value = segment.value;
				} else {
					type = 'Unknown';
					value = '';
				}

				rows.push(createRow({
					source: 'lyrics',
					block: blockIdx,
					meas: measure,
					beat: beatInMeasure,
					sub: sub,
					total: total.toFixed(3),
					type: type,
					value: value,
					dur: dur,
					mod: item.modifier || '',
					pitch_idx: '',
					pitch_note: '',
					pitch_acc: '',
					pitch_oct: ''
				}));
			}

			// Update counters
			totalBeats += dur;
			beatInMeasure += dur;
		}
	}

	return rows;
}

/**
 * Flatten pitches from a block into rows
 * @param {number} blockIdx - 1-based block index
 * @param {Object} block - the block object
 * @returns {Array<Object>} Array of row objects
 */
function flattenPitches(blockIdx, block) {
	const rows = [];

	// First, include the initial key signature from block.pitches.keySignature
	const keySig = block.pitches.keySignature;
	if (keySig && keySig.type === 'KeySignature') {
		const value = `K${keySig.accidental || ''}${keySig.count}`;
		rows.push(createRow({
			source: 'pitches',
			block: blockIdx,
			meas: '',
			beat: '',
			sub: '',
			total: 0,
			type: 'KeySig',
			value: value,
			dur: '',
			mod: '',
			pitch_idx: '',
			pitch_note: '',
			pitch_acc: '',
			pitch_oct: ''
		}));
	}

	// Then process the pitch elements array (which may contain pitches, barlines, key signatures)
	const pitchElements = block.pitches.elements || [];
	for (let pitchIdx = 0; pitchIdx < pitchElements.length; pitchIdx++) {
		const elem = pitchElements[pitchIdx];

		let type, value;
		if (elem.type === 'Pitch') {
			type = 'Pitch';
			value = elem.note;
		} else if (elem.type === 'Barline') {
			type = 'Barline';
			value = '|';
		} else if (elem.type === 'KeySignature') {
			type = 'KeySig';
			value = `K${elem.accidental || ''}${elem.count}`;
		} else if (elem.type === 'BeatDuration') {
			type = 'BeatDur';
			value = `B${elem.duration}${elem.dotted ? '.' : ''}`;
		} else {
			type = 'Unknown';
			value = '';
		}

		rows.push(createRow({
			source: 'pitches',
			block: blockIdx,
			meas: '',
			beat: '',
			sub: '',
			total: 0,
			type: type,
			value: value,
			dur: '',
			mod: '',
			pitch_idx: pitchIdx,
			pitch_note: elem.note || '',
			pitch_acc: elem.accidental || '',
			pitch_oct: elem.octaveShifts || ''
		}));
	}

	return rows;
}

/**
 * Flatten AST to tabular row format
 * @param {Object} ast - AST from parseStage
 * @returns {Array<Object>} Array of row objects
 * @throws {Error} If AST is invalid
 */
function flatStage(ast) {
	if (!ast || ast.type !== 'Score') {
		throw new Error('Invalid AST: expected Score object');
	}

	const allRows = [];

	// Process each block
	ast.blocks.forEach((block, blockIdx) => {
		if (block.type !== 'Block') {
			return;
		}

		const blockNum = blockIdx + 1; // 1-based

		// Flatten lyrics and pitches
		const lyricRows = flattenLyrics(blockNum, block);
		const pitchRows = flattenPitches(blockNum, block);

		// Combine rows for this block
		allRows.push(...lyricRows, ...pitchRows);
	});

	return allRows;
}

// =============================================================================
// Stage 3: Calculate Octaves (pitch-octaves.js)
// =============================================================================

/**
 * Calculate the octave of a pitch relative to the previous pitch using LilyPond Rule.
 * @param {Object} current - FQS pitch object {note: 'c', octaveShifts: '^'}
 * @param {Object} prev - Previous pitch state {letter: 'c', octave: 4} where octave is musical octave (4 = C4)
 * @returns {Object} {letter, octave} where octave is musical octave (4 = C4)
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
 * Calculate absolute octaves for all pitches
 * @param {Array<Object>} rows - Rows from flatStage
 * @returns {Array<Object>} Rows with pitch_oct populated
 */
function octavesStage(rows) {
	// Create a copy of rows to avoid mutation
	const newRows = rows.map(row => ({ ...row }));

	// State for pitch calculation
	let currentBlock = null;
	let prevPitchState = { letter: 'c', octave: 4 }; // Start at C4 (middle C)
	let blockStartsWithDash = {}; // Track which blocks start with a dash

	// First pass: analyze all rows to detect block starts with dashes
	for (const row of newRows) {
		const block = row.block || '';
		const source = row.source || '';
		const type = row.type || '';
		const value = row.value || '';

		// Check if this is the first lyric row in a block and it's a dash
		if (source === 'lyrics' && !blockStartsWithDash.hasOwnProperty(block)) {
			blockStartsWithDash[block] = (type === 'Special' && value === '-');
		}
	}

	// Second pass: calculate octaves for pitch rows with proper block transition logic
	currentBlock = null;
	prevPitchState = { letter: 'c', octave: 4 };

	for (const row of newRows) {
		const block = row.block || '';
		const source = row.source || '';

		// Handle block transitions
		if (block !== currentBlock) {
			currentBlock = block;
			// Check if this block starts with a dash
			if (blockStartsWithDash[block]) {
				// Block starts with dash: carry over previous pitch state
				// Don't reset prevPitchState
			} else {
				// Block doesn't start with dash: reset to C4
				prevPitchState = { letter: 'c', octave: 4 };
			}
		}

		// Process pitch rows
		if (source === 'pitches' && row.type === 'Pitch') {
			const note = row.pitch_note || '';
			if (note) {
				const pitch = {
					note: note.toLowerCase(),
					octaveShifts: row.pitch_oct || '',
					accidental: row.pitch_acc || ''
				};

				// Calculate octave
				const calculated = calculatePitch(pitch, prevPitchState);
				prevPitchState = calculated;

				// Update the row
				row.pitch_oct = calculated.octave.toString();
			}
		}
	}

	return newRows;
}

// =============================================================================
// Stage 4: Map Pitches to Attacks (map-pitches.js)
// =============================================================================

/**
 * Check if a lyric row represents an attack (syllable or asterisk).
 * @param {Object} row - Row object
 * @returns {boolean} true if the row is an attack
 */
function isAttackRow(row) {
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
 * Check if a pitch row is a consumable pitch (not KeySig or Barline).
 * @param {Object} row - Row object
 * @returns {boolean} true if the row is a consumable pitch
 */
function isConsumablePitch(row) {
	if (row.source !== 'pitches') {
		return false;
	}
	const type = row.type;
	return type === 'Pitch';
}

/**
 * Map pitch information to lyric attacks and dashes
 * @param {Array<Object>} rows - Rows from octavesStage
 * @returns {Array<Object>} Rows with pitch info mapped to lyric rows
 */
function mapStage(rows) {
	// Create a copy of rows to avoid mutation
	const newRows = rows.map(row => ({ ...row }));

	// State for pitch mapping
	let currentBlock = null;
	let pitchQueue = []; // Store pitches for current block
	let lastPitchFields = null; // Store pitch fields of the most recent attack
	let lastPitchByBlock = {}; // Store last pitch for each block (for cross-block dashes)
	let blockStartsWithDash = {}; // Track which blocks start with a dash
	let previousBlock = null; // Track previous block for cross-block transitions

	// First, collect pitches per block
	const blockPitches = {};
	for (const row of newRows) {
		const block = row.block || '';
		const source = row.source || '';
		const type = row.type || '';

		if (source === 'pitches' && type === 'Pitch') {
			if (!blockPitches[block]) {
				blockPitches[block] = [];
			}
			blockPitches[block].push(row);
		}
	}

	// Detect which blocks start with a dash
	for (const row of newRows) {
		const block = row.block || '';
		const source = row.source || '';
		const type = row.type || '';
		const value = row.value || '';

		if (source === 'lyrics' && !blockStartsWithDash.hasOwnProperty(block)) {
			blockStartsWithDash[block] = (type === 'Special' && value === '-');
		}
	}

	// Map pitches to attacks and replicate to dashes
	for (const row of newRows) {
		const block = row.block || '';
		const source = row.source || '';
		const type = row.type || '';
		const value = row.value || '';

		// Handle block transitions
		if (block !== currentBlock) {
			previousBlock = currentBlock;
			currentBlock = block;
			pitchQueue = blockPitches[block] || [];

			// Check if this block starts with a dash
			if (blockStartsWithDash[block]) {
				// Block starts with dash: carry over last pitch from previous block if available
				if (previousBlock && lastPitchByBlock[previousBlock]) {
					lastPitchFields = lastPitchByBlock[previousBlock];
				} else {
					lastPitchFields = null;
				}
			} else {
				// Block doesn't start with dash: reset last pitch
				lastPitchFields = null;
			}
		}

		// Only process lyric rows
		if (source === 'lyrics') {
			if (isAttackRow(row)) {
				// This is an attack, consume next pitch
				if (pitchQueue.length > 0) {
					const pitch = pitchQueue.shift();
					// Copy pitch information
					row.pitch_note = pitch.pitch_note;
					row
