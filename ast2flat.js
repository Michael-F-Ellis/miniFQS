#!/usr/bin/env node

// =============================================================================
// Configuration and Helper Functions
// =============================================================================

// Parse command line arguments
const args = process.argv.slice(2);
const debug = args.includes('--debug');

/**
 * Escape a string for TSV: replace tabs and newlines with spaces
 * @param {string} str - input string
 * @returns {string} escaped string
 */
function escapeTSV(str) {
	if (str === null || str === undefined) {
		return '';
	}
	return String(str).replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ');
}

/**
 * Convert a value to a TSV-safe string
 * @param {any} value - value to convert
 * @returns {string} TSV-safe string
 */
function tsvValue(value) {
	if (value === null || value === undefined) {
		return '';
	}
	return escapeTSV(String(value));
}

/**
 * Output a row as TSV
 * @param {Array<string>} fields - array of field values
 */
function outputRow(fields) {
	console.log(fields.map(f => tsvValue(f)).join('\t'));
}

// =============================================================================
// Flattening Functions
// =============================================================================

/**
 * Flatten lyrics from a block into rows
 * @param {number} blockIdx - 1-based block index
 * @param {Object} block - the block object
 * @param {Array<Array<string>>} rows - array to accumulate rows
 */
function flattenLyrics(blockIdx, block, rows) {
	// Determine starting measure: if counter exists, start at 0 (pickup), else 1
	let measure = block.counter ? 0 : 1;
	let beatInMeasure = 1; // 1-based beat within current measure
	let totalBeats = 0;   // cumulative beats from start of block

	for (const item of block.lyrics) {
		if (item.type === 'Barline') {
			// Output a barline row
			rows.push([
				'lyrics',            // source
				blockIdx,            // block
				measure,             // meas
				'',                  // beat
				'',                  // sub
				0,                   // total (not meaningful for barline)
				'Barline',           // type
				'|',                 // value
				'',                  // dur
				'',                  // mod
				'',                  // pitch_idx
				'',                  // pitch_note
				'',                  // pitch_acc
				'',                  // pitch_oct
				debug ? JSON.stringify(item) : '' // raw
			]);

			// Move to next measure
			measure++;
			beatInMeasure = 1;
			// totalBeats remains unchanged (barline doesn't add beats)
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

				rows.push([
					'lyrics',            // source
					blockIdx,            // block
					measure,             // meas
					beatInMeasure,       // beat (starting beat of the tuple)
					sub,                 // sub
					total.toFixed(3),    // total
					type,                // type
					value,               // value
					dur,                 // dur (beat duration)
					item.modifier || '', // mod
					'',                  // pitch_idx (filled later)
					'',                  // pitch_note
					'',                  // pitch_acc
					'',                  // pitch_oct
					debug ? JSON.stringify(segment) : '' // raw
				]);
			}

			// Update counters
			totalBeats += dur;
			beatInMeasure += dur;
		}
	}
}

/**
 * Flatten pitches from a block into rows
 * @param {number} blockIdx - 1-based block index
 * @param {Object} block - the block object
 * @param {Array<Array<string>>} rows - array to accumulate rows
 */
function flattenPitches(blockIdx, block, rows) {
	// First, include the initial key signature from block.pitches.keySignature
	const keySig = block.pitches.keySignature;
	if (keySig && keySig.type === 'KeySignature') {
		const value = `K${keySig.accidental || ''}${keySig.count}`;
		rows.push([
			'pitches',           // source
			blockIdx,            // block
			'',                  // meas
			'',                  // beat
			'',                  // sub
			0,                   // total
			'KeySig',            // type
			value,               // value
			'',                  // dur
			'',                  // mod
			'',                  // pitch_idx (not applicable)
			'',                  // pitch_note
			'',                  // pitch_acc
			'',                  // pitch_oct
			debug ? JSON.stringify(keySig) : '' // raw
		]);
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
		} else {
			type = 'Unknown';
			value = '';
		}

		rows.push([
			'pitches',           // source
			blockIdx,            // block
			'',                  // meas
			'',                  // beat
			'',                  // sub
			0,                   // total
			type,                // type
			value,               // value
			'',                  // dur
			'',                  // mod
			pitchIdx,            // pitch_idx (0-based)
			elem.note || '',     // pitch_note
			elem.accidental || '', // pitch_acc
			elem.octaveShifts || '', // pitch_oct
			debug ? JSON.stringify(elem) : '' // raw
		]);
	}
}

// =============================================================================
// Main Function
// =============================================================================

function main() {
	// Read AST from stdin
	let input = '';
	process.stdin.setEncoding('utf8');
	process.stdin.on('readable', () => {
		let chunk;
		while ((chunk = process.stdin.read()) !== null) {
			input += chunk;
		}
	});

	process.stdin.on('end', () => {
		let ast;
		try {
			ast = JSON.parse(input);
		} catch (e) {
			console.error('Error parsing AST JSON:', e.message);
			process.exit(1);
		}

		if (!ast || ast.type !== 'Score') {
			console.error('Invalid AST: expected Score object');
			process.exit(1);
		}

		// Output header
		outputRow([
			'source',
			'block',
			'meas',
			'beat',
			'sub',
			'total',
			'type',
			'value',
			'dur',
			'mod',
			'pitch_idx',
			'pitch_note',
			'pitch_acc',
			'pitch_oct',
			...(debug ? ['raw'] : [])
		]);

		// Process each block
		ast.blocks.forEach((block, blockIdx) => {
			if (block.type !== 'Block') {
				return;
			}

			const rows = [];
			const blockNum = blockIdx + 1; // 1-based

			// Flatten lyrics and pitches
			flattenLyrics(blockNum, block, rows);
			flattenPitches(blockNum, block, rows);

			// Output all rows for this block
			rows.forEach(row => outputRow(row));
		});
	});
}

// Run main
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

export default main;
