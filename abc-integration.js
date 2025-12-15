// ABC Integration for main app
// Combines browser-pipeline with ABCJS rendering and MIDI playback

// =============================================================================
// ABCJS Loading and Setup
// =============================================================================

/**
 * Wait for ABCJS library to load
 * @returns {Promise} Resolves when ABCJS is ready
 */
async function waitForABCJS() {
	return new Promise((resolve, reject) => {
		// Check if already loaded
		if (window.ABCJS && typeof window.ABCJS.renderAbc === 'function') {
			resolve();
			return;
		}

		// Set timeout
		const timeout = setTimeout(() => {
			reject(new Error('Timeout waiting for ABCJS to load'));
		}, 5000);

		// Poll for ABCJS
		const pollInterval = setInterval(() => {
			if (window.ABCJS && typeof window.ABCJS.renderAbc === 'function') {
				clearTimeout(timeout);
				clearInterval(pollInterval);
				resolve();
			}
		}, 100);
	});
}

// =============================================================================
// FQS to ABC Conversion using Browser Pipeline
// =============================================================================

/**
 * Convert FQS text to ABC notation using browser-pipeline
 * @param {string} fqsText - FQS notation text
 * @returns {Object} Result object with success, abc, and error properties
 */
async function convertFQSToABC(fqsText) {
	try {
		// Try the modular pipeline first
		try {
			const pipelineModule = await import('./browser-pipeline/index.js');
			const result = await pipelineModule.fqsToABC(fqsText);
			return {
				success: result.success,
				abc: result.abcNotation,
				error: result.error,
				stats: result.stats
			};
		} catch (importError) {
			console.warn('Modular pipeline failed, trying fallback:', importError.message);
		}

		// Fall back to old pipeline if available
		if (window.fqsPipeline && window.fqsPipeline.runPipeline) {
			const result = window.fqsPipeline.runPipeline(fqsText);
			return {
				success: result.success,
				abc: result.abc,
				error: result.error,
				stats: {}
			};
		}

		// Try to use global parse and convertToABC functions (from tutorial)
		if (typeof parse === 'function' && typeof convertToABC === 'function') {
			const ast = parse(fqsText);
			const abc = convertToABC(ast);
			return {
				success: true,
				abc: abc,
				error: null,
				stats: {}
			};
		}

		throw new Error('No ABC conversion method available');
	} catch (error) {
		return {
			success: false,
			abc: '',
			error: error.message,
			stats: {}
		};
	}
}

// =============================================================================
// ABC Rendering and Playback
// =============================================================================

/**
 * Render ABC notation in a container
 * @param {string} abcNotation - ABC notation string
 * @param {HTMLElement} container - DOM element to render into
 * @returns {Object|null} ABCJS visual object or null on error
 */
async function renderABCNotation(abcNotation, container) {
	try {
		await waitForABCJS();

		// Clear container
		container.innerHTML = '';

		// Create div for ABC rendering
		const abcDiv = document.createElement('div');
		abcDiv.className = 'abc-rendering';
		container.appendChild(abcDiv);

		// Render ABC notation
		const visualObjArray = window.ABCJS.renderAbc(abcDiv, abcNotation, {
			responsive: 'resize',
			scale: 0.8,
			paddingtop: 0,
			paddingbottom: 0,
			paddingleft: 0,
			paddingright: 0
		});

		return visualObjArray[0] || null;
	} catch (error) {
		console.error('Error rendering ABC notation:', error);
		container.innerHTML = `<div class="error">Error rendering ABC notation: ${error.message}</div>`;
		return null;
	}
}

/**
 * Setup MIDI playback for ABC visual object
 * @param {Object} visualObj - ABCJS visual object
 * @param {HTMLElement} container - Container for playback controls
 */
function setupMIDIPlayback(visualObj, container) {
	if (!visualObj || !window.ABCJS.synth || !window.ABCJS.synth.SynthController) {
		container.innerHTML = '<div class="error">MIDI playback not available</div>';
		return;
	}

	// Clear container
	container.innerHTML = '';

	// Create controls container with abcjs expected class
	const controlsDiv = document.createElement('div');
	controlsDiv.className = 'abcjs-inline-audio';
	container.appendChild(controlsDiv);

	// Create synth controller
	const synthControl = new window.ABCJS.synth.SynthController();

	// Load controls
	synthControl.load(controlsDiv, null, {
		displayLoop: true,
		displayRestart: true,
		displayPlay: true,
		displayProgress: true,
		displayWarp: true
	});

	// Set tune
	synthControl.setTune(visualObj, false)
		.then(() => {
			console.log('Audio loaded for playback');
		})
		.catch(error => {
			console.error('Error loading audio:', error);
			controlsDiv.innerHTML = `<div class="error">Failed to load audio: ${error.message}</div>`;
		});
}

// =============================================================================
// Main App Integration
// =============================================================================

/**
 * Update ABC notation display for the main app
 * @param {string} fqsText - FQS text from editor
 * @param {Object} elements - DOM elements for ABC display
 */
async function updateABCNotation(fqsText, elements) {
	const {
		container,
		sourceCode,
		playback,
		error
	} = elements;

	// Clear previous state
	container.innerHTML = '<div class="loading">Converting to ABC notation...</div>';
	if (sourceCode) sourceCode.textContent = '';
	if (playback) playback.innerHTML = '';
	if (error) {
		error.style.display = 'none';
		error.textContent = '';
	}

	try {
		// Convert FQS to ABC
		const result = await convertFQSToABC(fqsText);

		if (!result.success) {
			throw new Error(result.error || 'Failed to convert FQS to ABC');
		}

		// Update source code if element exists
		if (sourceCode) {
			sourceCode.textContent = result.abc;
		}

		// Render ABC notation
		const visualObj = await renderABCNotation(result.abc, container);

		// Setup MIDI playback if visual object was created
		if (visualObj && playback) {
			setupMIDIPlayback(visualObj, playback);
		}

		return {
			success: true,
			abc: result.abc,
			visualObj
		};
	} catch (err) {
		console.error('Error updating ABC notation:', err);

		// Show error
		container.innerHTML = '<div class="error">Failed to generate ABC notation</div>';
		if (error) {
			error.style.display = 'block';
			error.textContent = `Error: ${err.message}`;
		}

		return {
			success: false,
			error: err.message
		};
	}
}

/**
 * Initialize ABC integration for the main app
 * @returns {Object} API for ABC integration
 */
function initABCIntegration() {
	// Get DOM elements
	const abcContainer = document.getElementById('abc-container');
	const abcSourceCode = document.getElementById('abc-source-code');
	const abcPlayback = document.getElementById('abc-playback');
	const abcError = document.getElementById('abc-error');
	const toggleSourceBtn = document.getElementById('toggle-abc-source');
	const abcSource = document.getElementById('abc-source');

	if (!abcContainer) {
		console.error('ABC container not found');
		return null;
	}

	// Setup source code toggle
	if (toggleSourceBtn && abcSource) {
		let sourceVisible = false;
		toggleSourceBtn.addEventListener('click', () => {
			sourceVisible = !sourceVisible;
			abcSource.style.display = sourceVisible ? 'block' : 'none';
			toggleSourceBtn.textContent = sourceVisible ? 'Hide Source' : 'Show Source';
		});
	}

	// Return API
	return {
		update: (fqsText) => updateABCNotation(fqsText, {
			container: abcContainer,
			sourceCode: abcSourceCode,
			playback: abcPlayback,
			error: abcError
		}),

		getElements: () => ({
			container: abcContainer,
			sourceCode: abcSourceCode,
			playback: abcPlayback,
			error: abcError,
			toggleBtn: toggleSourceBtn,
			source: abcSource
		}),

		renderABC: renderABCNotation,
		setupPlayback: setupMIDIPlayback,
		convertFQS: convertFQSToABC
	};
}

// =============================================================================
// Export
// =============================================================================

if (typeof module !== 'undefined' && module.exports) {
	// Node.js export
	module.exports = {
		waitForABCJS,
		convertFQSToABC,
		renderABCNotation,
		setupMIDIPlayback,
		updateABCNotation,
		initABCIntegration
	};
} else {
	// Browser export
	window.abcIntegration = {
		waitForABCJS,
		convertFQSToABC,
		renderABCNotation,
		setupMIDIPlayback,
		updateABCNotation,
		initABCIntegration
	};
}

// Auto-initialize if in browser
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => {
			window.abcIntegrationAPI = initABCIntegration();
		});
	} else {
		setTimeout(() => {
			window.abcIntegrationAPI = initABCIntegration();
		}, 100);
	}
}
