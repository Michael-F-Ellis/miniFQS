// Minimal Browser Pipeline for FQS-to-ABC Conversion
// Core stages only - simplified for initial integration

// =============================================================================
// Stage 1: Parse (fqs2ast.js) - placeholder
// =============================================================================
function parseStage(fqsText) {
	throw new Error('parseStage: Parser not yet integrated');
}

// =============================================================================
// Stage 2: Flatten AST (ast2flat.js) - simplified
// =============================================================================
function flatStage(ast) {
	if (!ast || ast.type !== 'Score') {
		throw new Error('Invalid AST: expected Score object');
	}

	// Simplified: just return empty array for now
	return [];
}

// =============================================================================
// Stage 3: Calculate Octaves (pitch-octaves.js) - simplified
// =============================================================================
function octavesStage(rows) {
	// Simplified: just return rows unchanged
	return rows.map(row => ({ ...row }));
}

// =============================================================================
// Stage 4: Map Pitches to Attacks (map-pitches.js) - simplified
// =============================================================================
function mapStage(rows) {
	// Simplified: just return rows unchanged
	return rows.map(row => ({ ...row }));
}

// =============================================================================
// Stage 5: Add ABC Headers (abcprep.js) - simplified
// =============================================================================
function prepStage(rows) {
	// Add abc0 column
	const newRows = rows.map(row => ({ ...row, abc0: '' }));

	// Add minimal headers
	const headerRows = [
		{ source: 'abchdr', type: 'ABCHeader', value: 'X:', abc0: '1' },
		{ source: 'abchdr', type: 'ABCHeader', value: 'K:', abc0: 'C major' },
		{ source: 'abchdr', type: 'ABCHeader', value: 'M:', abc0: '4/4' },
		{ source: 'abchdr', type: 'ABCHeader', value: 'L:', abc0: '1/4' }
	];

	return [...headerRows, ...newRows];
}

// =============================================================================
// Stage 6: Process Beat Duration (abcbeat.js) - simplified
// =============================================================================
function beatStage(rows) {
	// Simplified: just return rows unchanged
	return rows.map(row => ({ ...row }));
}

// =============================================================================
// Stage 7: Add Meter Changes (abcmeter.js) - simplified
// =============================================================================
function meterStage(rows) {
	// Simplified: just return rows unchanged
	return rows.map(row => ({ ...row }));
}

// =============================================================================
// Stage 8: Add Key Signatures (abckeysig.js) - simplified
// =============================================================================
function keysigStage(rows) {
	// Simplified: just return rows unchanged
	return rows.map(row => ({ ...row }));
}

// =============================================================================
// Stage 9: Convert to ABC Notes (abcnotes.js) - simplified
// =============================================================================
function notesStage(rows) {
	// Simplified: just return rows unchanged
	return rows.map(row => ({ ...row }));
}

// =============================================================================
// Stage 10: Generate ABC Notation (abcgen.js) - simplified
// =============================================================================
function generateStage(rows) {
	// Build headers and music body
	let headersABC = '';
	let musicBody = '';

	for (const row of rows) {
		if (row.source === 'abchdr') {
			headersABC += `${row.value}${row.abc0}\n`;
		} else if (row.source === 'lyrics' && row.abc0) {
			musicBody += row.abc0 + ' ';
		}
	}

	// Clean up music body
	musicBody = musicBody.replace(/\s+/g, ' ').trim();

	return headersABC + musicBody;
}

// =============================================================================
// Main Pipeline Runner
// =============================================================================
function runPipeline(fqsText) {
	try {
		// Stage 1: Parse
		const ast = parseStage(fqsText);

		// Stage 2: Flatten
		const flatRows = flatStage(ast);

		// Stage 3: Calculate octaves
		const octaveRows = octavesStage(flatRows);

		// Stage 4: Map pitches
		const mappedRows = mapStage(octaveRows);

		// Stage 5: Add ABC headers
		const prepRows = prepStage(mappedRows);

		// Stage 6: Process beat duration
		const beatRows = beatStage(prepRows);

		// Stage 7: Add meter changes
		const meterRows = meterStage(beatRows);

		// Stage 8: Add key signatures
		const keysigRows = keysigStage(meterRows);

		// Stage 9: Convert to ABC notes
		const noteRows = notesStage(keysigRows);

		// Stage 10: Generate ABC notation
		const abcNotation = generateStage(noteRows);

		return {
			success: true,
			abc: abcNotation,
			error: null
		};
	} catch (error) {
		return {
			success: false,
			abc: '',
			error: error.message
		};
	}
}

// =============================================================================
// Export for browser use
// =============================================================================
if (typeof module !== 'undefined' && module.exports) {
	// Node.js export
	module.exports = { runPipeline };
} else {
	// Browser export
	window.fqsPipeline = { runPipeline };
}
