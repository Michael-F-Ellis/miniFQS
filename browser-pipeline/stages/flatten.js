// Stage 2: Flatten AST to tabular row format
// Adapts ast2flat.js functionality for browser use

import { createRow } from '../utils.js';

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

	// Add counter value to first row if present
	let counterAdded = false;

	for (const item of block.lyrics) {
		if (item.type === 'Barline') {
			// Output a barline row
			const row = createRow({
				source: 'lyrics',
				block: blockIdx,
				meas: measure,
				beat: '',
				sub: '',
				type: 'Barline',
				value: '|',
				dur: '',
				mod: '',
				pitch_idx: '',
				pitch_note: '',
				pitch_acc: '',
				pitch_oct: ''
			});
			// Add counter value to first row of block if not already added
			if (!counterAdded && block.counter) {
				row.counter = block.counter;
				counterAdded = true;
			}
			rows.push(row);

			// Move to next measure
			measure++;
			beatInMeasure = 1;
		}
		else if (item.type === 'BeatDuration') {
			// Output a beat duration row (from lyric line directive [4.] or [4])
			const value = `[${item.duration}${item.dotted ? '.' : ''}]`;
			const row = createRow({
				source: 'lyrics',
				block: blockIdx,
				meas: measure, // current measure
				beat: '',
				sub: '',
				type: 'BeatDur',
				value: value,
				dur: '',
				mod: '',
				pitch_idx: '',
				pitch_note: '',
				pitch_acc: '',
				pitch_oct: ''
			});
			// Add counter value to first row of block if not already added
			if (!counterAdded && block.counter) {
				row.counter = block.counter;
				counterAdded = true;
			}
			rows.push(row);
			// Beat duration directive doesn't affect beat counting
		}
		else if (item.type === 'BeatTuple') {
			const dur = item.duration;
			const subdivisions = item.content.length;

			for (let subIdx = 0; subIdx < subdivisions; subIdx++) {
				const segment = item.content[subIdx];
				const sub = subIdx + 1; // 1-based subdivision

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

				const row = createRow({
					source: 'lyrics',
					block: blockIdx,
					meas: measure,
					beat: beatInMeasure,
					sub: sub,
					type: type,
					value: value,
					dur: dur,
					mod: item.modifier || '',
					pitch_idx: '',
					pitch_note: '',
					pitch_acc: '',
					pitch_oct: ''
				});
				// Add counter value to first row of block if not already added
				if (!counterAdded && block.counter) {
					row.counter = block.counter;
					counterAdded = true;
				}
				rows.push(row);
			}

			// Update beat counter
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
export function flattenStage(ast) {
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

/**
 * Convert rows to TSV format for debugging
 * @param {Array<Object>} rows - Rows from flattenStage
 * @returns {string} TSV string
 */
export function rowsToTSV(rows) {
	if (!rows || rows.length === 0) {
		return '';
	}

	// Get headers from first row
	const headers = Object.keys(rows[0]);

	// Build TSV
	const lines = [
		headers.join('\t'), // Header row
		...rows.map(row => headers.map(header => row[header] || '').join('\t'))
	];

	return lines.join('\n');
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { flattenStage, rowsToTSV };
}
