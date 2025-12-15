// Browser Pipeline for FQS-to-ABC Conversion
// Wraps the existing abc-converter.js functionality with a pipeline interface

// =============================================================================
// Main Pipeline Function
// =============================================================================

/**
 * Convert FQS text to ABC notation using the existing converter
 * @param {string} fqsText - FQS notation text
 * @returns {Object} Result object with success, abc, and error properties
 */
function runPipeline(fqsText) {
	try {
		// Try multiple ways to get the parse function
		let parseFunc;

		// 1. Check if parse is available globally (from mini-fqs.js or other scripts)
		if (typeof parse === 'function') {
			parseFunc = parse;
		}
		// 2. Check if window.parse is available (from tutorial)
		else if (typeof window !== 'undefined' && typeof window.parse === 'function') {
			parseFunc = window.parse;
		}
		// 3. Check if we're in a module context with parser.js imported
		else if (typeof window !== 'undefined' && window.parserModule && window.parserModule.parse) {
			parseFunc = window.parserModule.parse;
		}
		// 4. Try to import dynamically (for ES modules)
		else {
			// This won't work in all browsers, but we try
			console.warn('parse function not found globally, pipeline will use fallback');
			throw new Error('Parser not available. Make sure parser.js is loaded.');
		}

		// Parse FQS to AST
		const ast = parseFunc(fqsText);

		// Try multiple ways to get the convertToABC function
		let convertFunc;

		// 1. Check if convertToABC is available globally
		if (typeof convertToABC === 'function') {
			convertFunc = convertToABC;
		}
		// 2. Check if window.convertToABC is available (from tutorial)
		else if (typeof window !== 'undefined' && typeof window.convertToABC === 'function') {
			convertFunc = window.convertToABC;
		}
		// 3. Check if we're in tutorial context
		else if (typeof window !== 'undefined' && window.abcConverterModule && window.abcConverterModule.convertToABC) {
			convertFunc = window.abcConverterModule.convertToABC;
		}
		else {
			throw new Error('ABC converter not available. Make sure abc-converter.js is loaded.');
		}

		// Convert AST to ABC
		const abcNotation = convertFunc(ast);

		return {
			success: true,
			abc: abcNotation,
			error: null,
			ast: ast
		};
	} catch (error) {
		return {
			success: false,
			abc: '',
			error: error.message,
			ast: null
		};
	}
}

/**
 * Debug function to show pipeline stages
 * @param {string} fqsText - FQS notation text
 * @returns {Object} Debug information
 */
function debugPipeline(fqsText) {
	const stages = [];

	try {
		// Try multiple ways to get the parse function (same as runPipeline)
		let parseFunc;
		if (typeof parse === 'function') {
			parseFunc = parse;
		} else if (typeof window !== 'undefined' && typeof window.parse === 'function') {
			parseFunc = window.parse;
		} else if (typeof window !== 'undefined' && window.parserModule && window.parserModule.parse) {
			parseFunc = window.parserModule.parse;
		} else {
			throw new Error('Parser not available. Make sure parser.js is loaded.');
		}

		// Try multiple ways to get the convertToABC function (same as runPipeline)
		let convertFunc;
		if (typeof convertToABC === 'function') {
			convertFunc = convertToABC;
		} else if (typeof window !== 'undefined' && typeof window.convertToABC === 'function') {
			convertFunc = window.convertToABC;
		} else if (typeof window !== 'undefined' && window.abcConverterModule && window.abcConverterModule.convertToABC) {
			convertFunc = window.abcConverterModule.convertToABC;
		} else {
			throw new Error('ABC converter not available. Make sure abc-converter.js is loaded.');
		}

		// Stage 1: Parse
		stages.push({
			name: 'parse',
			start: performance.now()
		});
		const ast = parseFunc(fqsText);
		stages[0].end = performance.now();
		stages[0].result = ast;
		stages[0].duration = stages[0].end - stages[0].start;

		// Stage 2: Convert to ABC
		stages.push({
			name: 'convert',
			start: performance.now()
		});
		const abc = convertFunc(ast);
		stages[1].end = performance.now();
		stages[1].result = abc;
		stages[1].duration = stages[1].end - stages[1].start;

		return {
			success: true,
			stages: stages,
			ast: ast,
			abc: abc
		};
	} catch (error) {
		return {
			success: false,
			error: error.message,
			stages: stages
		};
	}
}

// =============================================================================
// Export for browser use
// =============================================================================

if (typeof module !== 'undefined' && module.exports) {
	// Node.js export
	module.exports = { runPipeline, debugPipeline };
} else {
	// Browser export
	window.fqsPipeline = { runPipeline, debugPipeline };
}

// =============================================================================
// Integration with existing mini-fqs component
// =============================================================================

/**
 * Patch the mini-fqs component to use the pipeline for ABC conversion
 * This can be called after both mini-fqs.js and this pipeline are loaded
 */
function patchMiniFQS() {
	if (typeof customElements === 'undefined') {
		console.warn('Custom Elements not supported');
		return;
	}

	const MiniFQS = customElements.get('mini-fqs');
	if (!MiniFQS) {
		console.warn('mini-fqs component not found');
		return;
	}

	// Store original render method
	const originalRender = MiniFQS.prototype.render;

	// Patch render method to also generate ABC
	MiniFQS.prototype.render = function () {
		// Call original render
		originalRender.call(this);

		// Also generate ABC if pipeline is available
		if (this._score && this._score.trim() !== '') {
			try {
				const result = runPipeline(this._score);
				if (result.success) {
					// Dispatch event with ABC notation
					this.dispatchEvent(new CustomEvent('fqs-abc-generated', {
						bubbles: true,
						detail: { abc: result.abc }
					}));
				}
			} catch (e) {
				// Silently fail - ABC generation is optional
				console.debug('ABC generation failed:', e.message);
			}
		}
	};

	console.log('mini-fqs component patched with ABC pipeline');
}

// Auto-patch if in browser context
if (typeof window !== 'undefined' && typeof customElements !== 'undefined') {
	// Wait for DOM to be ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', patchMiniFQS);
	} else {
		setTimeout(patchMiniFQS, 100);
	}
}
