// Main browser pipeline wrapper
// Orchestrates all stages of FQS to ABC conversion

import { parseStage, validateAST } from './stages/parse.js';
import { flattenStage, rowsToTSV } from './stages/flatten.js';
import { octavesStage, getOctaveStats } from './stages/octaves.js';
import { mapStage, getMappingStats } from './stages/map.js';
import { prepStage, extractTitle, updateTitle } from './stages/prep.js';
import { beatStage, getBeatStats } from './stages/beat.js';
import { meterStage, getMeterStats } from './stages/meter.js';
import { keysigStage, getKeysigStats } from './stages/keysig.js';
import { notesStage, getNoteStats } from './stages/notes.js';
import { generateStage, generateTSV, getGenerationStats } from './stages/generate.js';

/**
 * Main pipeline function: convert FQS text to ABC notation
 * @param {string} fqsText - FQS notation text
 * @param {Object} options - Pipeline options
 * @returns {Object} Result object with ABC notation and intermediate data
 */
export async function fqsToABC(fqsText, options = {}) {
	const result = {
		success: false,
		abcNotation: '',
		error: null,
		stats: {},
		intermediate: {}
	};

	try {
		// Stage 1: Parse FQS text to AST
		const ast = parseStage(fqsText);
		result.intermediate.ast = ast;
		result.stats.parse = { valid: validateAST(ast) };

		// Stage 2: Flatten AST to tabular rows
		const flattenedRows = flattenStage(ast);
		result.intermediate.flattened = flattenedRows;
		result.stats.flatten = { rows: flattenedRows.length };

		// Stage 3: Calculate absolute octaves
		const octaveRows = octavesStage(flattenedRows);
		result.intermediate.octaves = octaveRows;
		result.stats.octaves = getOctaveStats(octaveRows);

		// Stage 4: Map pitch information to lyric attacks
		const mappedRows = mapStage(octaveRows);
		result.intermediate.mapped = mappedRows;
		result.stats.map = getMappingStats(mappedRows);

		// Stage 5: Add ABC headers and columns
		const prepRows = prepStage(mappedRows);
		result.intermediate.prep = prepRows;
		result.stats.prep = { rows: prepRows.length };

		// Extract and update title if needed
		const title = extractTitle(prepRows);
		if (title && options.autoTitle !== false) {
			const titledRows = updateTitle(prepRows, title);
			result.intermediate.prep = titledRows;
		}

		// Stage 6: Process beat duration
		const beatRows = beatStage(result.intermediate.prep);
		result.intermediate.beat = beatRows;
		result.stats.beat = getBeatStats(beatRows);

		// Stage 7: Add meter information
		const meterRows = meterStage(beatRows);
		result.intermediate.meter = meterRows;
		result.stats.meter = getMeterStats(meterRows);

		// Stage 8: Add key signatures and barlines
		const keysigRows = keysigStage(meterRows);
		result.intermediate.keysig = keysigRows;
		result.stats.keysig = getKeysigStats(keysigRows);

		// Stage 9: Convert to ABC note syntax
		const noteRows = notesStage(keysigRows);
		result.intermediate.notes = noteRows;
		result.stats.notes = getNoteStats(noteRows);

		// Stage 10: Generate ABC notation
		const abcNotation = generateStage(noteRows);
		result.abcNotation = abcNotation;
		result.stats.generate = getGenerationStats(noteRows);

		result.success = true;
	} catch (error) {
		result.error = error.message;
		result.success = false;
	}

	return result;
}

/**
 * Get TSV representation of intermediate stage
 * @param {string} stageName - Stage name (e.g., 'flattened', 'octaves', 'mapped', etc.)
 * @param {Object} pipelineResult - Result from fqsToABC
 * @returns {string} TSV string or empty string if stage not found
 */
export function getStageTSV(stageName, pipelineResult) {
	if (!pipelineResult.intermediate || !pipelineResult.intermediate[stageName]) {
		return '';
	}
	return generateTSV(pipelineResult.intermediate[stageName]);
}

/**
 * Get all available stage names
 * @returns {Array<string>} Array of stage names
 */
export function getStageNames() {
	return [
		'ast',
		'flattened',
		'octaves',
		'mapped',
		'prep',
		'beat',
		'meter',
		'keysig',
		'notes'
	];
}

/**
 * Run a single stage for debugging
 * @param {string} stageName - Stage name
 * @param {Array<Object>} inputRows - Input rows
 * @returns {Array<Object>} Output rows
 * @throws {Error} If stage not found
 */
export function runSingleStage(stageName, inputRows) {
	switch (stageName) {
		case 'parse':
			throw new Error('parse stage requires FQS text, not rows');
		case 'flatten':
			return flattenStage(inputRows);
		case 'octaves':
			return octavesStage(inputRows);
		case 'map':
			return mapStage(inputRows);
		case 'prep':
			return prepStage(inputRows);
		case 'beat':
			return beatStage(inputRows);
		case 'meter':
			return meterStage(inputRows);
		case 'keysig':
			return keysigStage(inputRows);
		case 'notes':
			return notesStage(inputRows);
		case 'generate':
			throw new Error('generate stage returns ABC string, not rows');
		default:
			throw new Error(`Unknown stage: ${stageName}`);
	}
}

// Export individual stages for advanced usage
export {
	parseStage,
	flattenStage,
	octavesStage,
	mapStage,
	prepStage,
	beatStage,
	meterStage,
	keysigStage,
	notesStage,
	generateStage
};

// Export utility functions
export {
	validateAST,
	rowsToTSV,
	generateTSV,
	extractTitle,
	updateTitle,
	getOctaveStats,
	getMappingStats,
	getBeatStats,
	getMeterStats,
	getKeysigStats,
	getNoteStats,
	getGenerationStats
};

// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
	module.exports = {
		fqsToABC,
		getStageTSV,
		getStageNames,
		runSingleStage,
		parseStage,
		flattenStage,
		octavesStage,
		mapStage,
		prepStage,
		beatStage,
		meterStage,
		keysigStage,
		notesStage,
		generateStage,
		validateAST,
		rowsToTSV,
		generateTSV,
		extractTitle,
		updateTitle,
		getOctaveStats,
		getMappingStats,
		getBeatStats,
		getMeterStats,
		getKeysigStats,
		getNoteStats,
		getGenerationStats
	};
}
