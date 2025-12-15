// Stage 10: Generate ABC notation from rows
// Adapts abcgen.js functionality for browser use

/**
 * Generate ABC notation from rows
 * @param {Array<Object>} rows - Rows from notesStage
 * @returns {string} Complete ABC notation
 */
export function generateStage(rows) {
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

	return abcNotation;
}

/**
 * Generate TSV from rows (for debugging)
 * @param {Array<Object>} rows - Rows from any stage
 * @returns {string} TSV string
 */
export function generateTSV(rows) {
	if (!rows || rows.length === 0) {
		return '';
	}

	// Get all unique headers from all rows
	const headers = new Set();
	for (const row of rows) {
		Object.keys(row).forEach(key => headers.add(key));
	}
	const headerArray = Array.from(headers);

	// Build TSV
	const lines = [
		headerArray.join('\t'), // Header row
		...rows.map(row => headerArray.map(header => {
			const val = row[header];
			// Convert null/undefined to empty string, but keep 0 as "0"
			if (val == null) return '';
			return String(val);
		}).join('\t'))
	];

	return lines.join('\n');
}

/**
 * Get generation statistics
 * @param {Array<Object>} rows - Rows from generateStage
 * @returns {Object} Statistics about the generated ABC
 */
export function getGenerationStats(rows) {
	const stats = {
		totalRows: rows.length,
		headerRows: 0,
		lyricRows: 0,
		pitchRows: 0,
		abcLength: 0,
		blocks: new Set()
	};

	const abcNotation = generateStage(rows);
	stats.abcLength = abcNotation.length;

	for (const row of rows) {
		const source = row.source || '';
		const block = row.block || '';

		if (source === 'abchdr') stats.headerRows++;
		else if (source === 'lyrics') stats.lyricRows++;
		else if (source === 'pitches') stats.pitchRows++;

		if (block) stats.blocks.add(block);
	}

	stats.blocks = Array.from(stats.blocks);

	return stats;
}

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { generateStage, generateTSV, getGenerationStats };
}
