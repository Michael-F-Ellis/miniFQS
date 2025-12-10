#!/usr/bin/env node

/**
 * abcgen.js - Final pipeline stage to generate ABC notation from TSV
 * 
 * Reads TSV from stdin, generates proper ABC notation with headers and music body.
 * 
 * Input: TSV from abcnotes.js (with abc0 column populated)
 * Output: ABC notation string with proper headers and no duplicate barlines
 */

import { createInterface } from 'readline';

async function main() {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: false
	});

	let headers = [];
	let rows = [];
	let lineNumber = 0;

	// Read all lines
	for await (const line of rl) {
		if (lineNumber === 0) {
			// First line is header
			headers = line.split('\t');
		} else {
			// Parse data row
			const values = line.split('\t');
			const row = {};
			headers.forEach((header, i) => {
				row[header] = values[i] || '';
			});
			rows.push(row);
		}
		lineNumber++;
	}

	// Build headers and music body separately
	let headersABC = '';
	let musicBody = '';
	let currentBlock = '';
	let blockContent = '';

	for (const row of rows) {
		const source = row.source || '';
		const block = row.block || '1'; // Default to '1' if missing

		// Handle header rows (source='abchdr')
		if (source === 'abchdr') {
			const headerFlag = row.value || '';
			const headerValue = row.abc0 || '';

			// Skip empty T: header (no title)
			if (headerFlag === 'T:' && !headerValue) {
				continue;
			}

			// Add header with newline
			headersABC += `${headerFlag}${headerValue}\n`;
		}
		// Handle lyric rows (source='lyrics') - this is the music body
		else if (source === 'lyrics') {
			const abc0 = row.abc0 || '';
			if (abc0.trim() === '') continue;

			// Check if block changed
			if (block !== currentBlock) {
				// If we have accumulated content for previous block, add it to musicBody
				if (blockContent) {
					// Clean up the block content
					let cleaned = blockContent.replace(/\s+/g, ' ').trim();
					// Remove space before barlines
					cleaned = cleaned.replace(/\s+\|/g, '|');
					// Add space after barlines (unless at end of string or followed by another barline)
					cleaned = cleaned.replace(/\|(?!\||$)/g, '| ');
					// Remove double spaces
					cleaned = cleaned.replace(/\s+/g, ' ').trim();

					// Add to musicBody with newline
					musicBody += cleaned + '\n';
					blockContent = '';
				}
				currentBlock = block;
			}

			// Add the ABC content to blockContent
			blockContent += abc0.trim() + ' ';
		}
		// Skip pitch rows (source='pitches') to avoid duplicate barlines
		// Other sources are ignored
	}

	// Add the last block's content
	if (blockContent) {
		let cleaned = blockContent.replace(/\s+/g, ' ').trim();
		cleaned = cleaned.replace(/\s+\|/g, '|');
		cleaned = cleaned.replace(/\|(?!\||$)/g, '| ');
		cleaned = cleaned.replace(/\s+/g, ' ').trim();
		musicBody += cleaned;
	}

	// Combine headers and music body
	const abcNotation = headersABC + musicBody;

	// Output the ABC notation
	console.log(abcNotation);
}

main().catch(err => {
	console.error('Error in abcgen.js:', err.message);
	process.exit(1);
});
