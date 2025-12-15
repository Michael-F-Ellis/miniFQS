// abcjs Integration for miniFQS Tutorial
// Handles rendering of ABC notation and MIDI playback

import { parse } from '../../parser.js';
import { convertToABC as oldConvertToABC } from './abc-converter.js';

// Make parse available globally for the pipeline
if (typeof window !== 'undefined') {
	window.parse = parse;
	window.convertToABC = oldConvertToABC;
}

// =============================================================================
// Helper Functions for Loading ABCJS
// =============================================================================

/**
 * Wait for the abcjs library to be loaded.
 * Since we are using a local file, it should load almost immediately.
 * This function checks if abcjs is already available, and if not, waits for the
 * 'abcjsLoaded' event that is dispatched by the script tag in index.html.
 * It also includes a polling fallback in case the event doesn't fire.
 * @returns {Promise} Resolves when abcjs is available, rejects on timeout or error.
 */
async function waitForABCJS() {
	console.log('[waitForABCJS] Starting to wait for abcjs...');

	// If abcjs is already available and has the renderAbc method, return immediately
	if (window.ABCJS && typeof window.ABCJS.renderAbc === 'function') {
		console.log('[waitForABCJS] ABCJS already available with renderAbc, returning immediately');
		return Promise.resolve();
	}

	console.log('[waitForABCJS] abcjs not available or missing renderAbc, setting up listeners and polling');

	// Otherwise, wait for the abcjsLoaded event with polling fallback
	return new Promise((resolve, reject) => {
		// Increased timeout for local file (5000ms to be safe for slow connections)
		const timeout = setTimeout(() => {
			console.error('[waitForABCJS] Timeout waiting for ABCJS to load. Check that the file "lib/abcjs-basic-min.js" exists and is accessible.');
			console.log('[waitForABCJS] window.ABCJS type:', typeof window.ABCJS);
			if (window.ABCJS) {
				console.log('[waitForABCJS] window.ABCJS keys:', Object.keys(window.ABCJS));
			}
			console.log('[waitForABCJS] Checking if script tag exists:', document.querySelector('script[src*="abcjs-basic-min.js"]'));
			reject(new Error('Timeout waiting for ABCJS to load. Check that the file "lib/abcjs-basic-min.js" exists and is accessible.'));
		}, 5000); // 5000ms timeout for local file

		// Primary method: listen for the custom event
		const onLoaded = () => {
			console.log('[waitForABCJS] abcjsLoaded event received, checking for renderAbc');
			// After the event, check if the library is really ready
			if (window.ABCJS && typeof window.ABCJS.renderAbc === 'function') {
				console.log('[waitForABCJS] ABCJS is ready with renderAbc');
				clearTimeout(timeout);
				clearInterval(pollInterval);
				resolve();
			} else {
				console.log('[waitForABCJS] abcjsLoaded event fired but window.ABCJS.renderAbc is not yet available, continuing to poll');
			}
		};

		const onError = (event) => {
			console.error('[waitForABCJS] abcjsError event received:', event.detail);
			clearTimeout(timeout);
			clearInterval(pollInterval);
			reject(new Error(event.detail || 'Failed to load ABCJS library. Check the file "lib/abcjs-basic-min.js".'));
		};

		// Check if the event has already been dispatched (by checking a global flag set by the script tag)
		if (window.abcjsLoadedFlag === true) {
			console.log('[waitForABCJS] abcjsLoadedFlag is true, checking if library is ready');
			if (window.ABCJS && typeof window.ABCJS.renderAbc === 'function') {
				console.log('[waitForABCJS] Library is ready');
				clearTimeout(timeout);
				resolve();
				return;
			} else {
				console.log('[waitForABCJS] Flag is true but library not ready, continuing to wait');
			}
		}

		window.addEventListener('abcjsLoaded', onLoaded, { once: true });
		window.addEventListener('abcjsError', onError, { once: true });

		// Fallback: poll for abcjs every 100ms
		const pollInterval = setInterval(() => {
			if (window.ABCJS && typeof window.ABCJS.renderAbc === 'function') {
				console.log('[waitForABCJS] Polling detected ABCJS is now available with renderAbc');
				clearTimeout(timeout);
				clearInterval(pollInterval);
				window.removeEventListener('abcjsLoaded', onLoaded);
				window.removeEventListener('abcjsError', onError);
				resolve();
			} else if (window.ABCJS) {
				// ABCJS is defined but missing renderAbc? Log for debugging
				console.log('[waitForABCJS] Polling: window.ABCJS exists but renderAbc is not a function, keys:', Object.keys(window.ABCJS));
			}
			// Reduced logging to avoid console spam
		}, 100);
	});
}

// =============================================================================
// ABC Rendering Functions
// =============================================================================

/**
 * Get ABC notation string from FQS code
 * @param {string} fqsCode - The FQS code to convert
 * @returns {string} ABC notation string
 */
export function getABCNotation(fqsCode) {
	try {
		// First try to use the pipeline if available
		if (typeof window !== 'undefined' && window.fqsPipeline && window.fqsPipeline.runPipeline) {
			const result = window.fqsPipeline.runPipeline(fqsCode);
			if (result.success) {
				return result.abc;
			} else {
				console.warn('Pipeline failed, falling back to old converter:', result.error);
			}
		}

		// Fall back to old converter
		const ast = parse(fqsCode);
		return oldConvertToABC(ast);
	} catch (error) {
		console.error('Error converting FQS to ABC notation:', error);
		return `Error: ${error.message}`;
	}
}

/**
 * Render ABC notation for a given FQS code
 * @param {string} fqsCode - The FQS code to convert and render
 * @param {HTMLElement} container - The DOM element to render into
 * @param {string} abcNotation - Optional ABC notation string (if already computed)
 * @returns {Object} The ABCJS visual object (first tune)
 */
export async function renderABCFromFQS(fqsCode, container, abcNotation = null) {
	try {
		// Wait for abcjs to be available
		await waitForABCJS();

		// Get ABC notation if not provided
		if (!abcNotation) {
			abcNotation = getABCNotation(fqsCode);
		}

		// Clear container
		container.innerHTML = '';

		// Create a div for the ABC notation rendering
		const abcDiv = document.createElement('div');
		abcDiv.className = 'abc-notation';
		container.appendChild(abcDiv);

		// Render the ABC notation and get the first tune's visual object
		const visualObjArray = window.ABCJS.renderAbc(abcDiv, abcNotation, {
			responsive: 'resize',
			scale: 0.8
		});
		const visualObj = visualObjArray[0];

		console.log('ABC notation generated:', abcNotation);
		return visualObj;

	} catch (error) {
		console.error('Error rendering ABC:', error);
		container.innerHTML = `<div class="error">Error rendering ABC notation: ${error.message}</div>`;
		return null;
	}
}

/**
 * Setup MIDI playback for a given ABC visual object
 * @param {Object} visualObj - The ABCJS visual object (first tune from renderAbc)
 * @param {HTMLElement} container - The container for the playback controls
 */
export function setupMIDIPlayback(visualObj, container) {
	// Clear any existing controls
	container.innerHTML = '';

	// Create a div for the synth controls (with the class abcjs expects)
	const controlsDiv = document.createElement('div');
	controlsDiv.className = 'abcjs-inline-audio';
	container.appendChild(controlsDiv);

	// Check if SynthController is available
	if (!window.ABCJS.synth.SynthController) {
		console.error('ABCJS SynthController is not available. Make sure you are using the correct version of abcjs that includes the synth module.');
		controlsDiv.innerHTML = '<div class="error">MIDI playback not available. Check abcjs version.</div>';
		return;
	}

	// Create the synth controller
	const synthControl = new window.ABCJS.synth.SynthController();

	// The synth control needs to be loaded into a container (the controlsDiv)
	// The second parameter is the cursor control (optional) - we can pass null.
	synthControl.load(controlsDiv, null, {
		displayLoop: true,
		displayRestart: true,
		displayPlay: true,
		displayProgress: true,
		displayWarp: true
	});

	// Set the tune for the synth control
	synthControl.setTune(visualObj, false)
		.then(function (response) {
			console.log("Audio loaded for playback");
		})
		.catch(function (error) {
			console.error("Error loading audio:", error);
			controlsDiv.innerHTML = `<div class="error">Failed to load audio: ${error.message}</div>`;
		});
}

// =============================================================================
// Tutorial Integration Functions
// =============================================================================

/**
 * Initialize ABC rendering for all tutorial examples
 * This function should be called after the tutorial examples are set up
 */
export function initializeABCForTutorial() {
	// Find all example containers
	const examples = document.querySelectorAll('.example[data-fqs-code]');

	examples.forEach(example => {
		// Get the FQS code from the data attribute
		const fqsCode = example.getAttribute('data-fqs-code');

		// Get the existing abc-column and abc-code elements
		const abcColumn = example.querySelector('.abc-column');
		const abcContainer = abcColumn ? abcColumn.querySelector('.abc-container') : null;
		const abcCodeElement = example.querySelector('.abc-code code.abc-source');

		// If the required elements don't exist, log error and skip
		if (!abcContainer || !abcCodeElement) {
			console.error('Missing required elements for ABC rendering in example:', example);
			return;
		}

		// Generate ABC notation
		const abcNotation = getABCNotation(fqsCode);

		// Populate the ABC code column
		abcCodeElement.textContent = abcNotation;

		// Try to render ABC notation in the visual container
		renderABCFromFQS(fqsCode, abcContainer, abcNotation)
			.then((visualObj) => {
				// If successful, add playback controls
				if (visualObj) {
					const playbackContainer = document.createElement('div');
					playbackContainer.className = 'playback-container';

					// Insert playback container after the abc-container
					abcContainer.parentNode.insertBefore(playbackContainer, abcContainer.nextSibling);

					// Setup MIDI playback with the visual object
					setupMIDIPlayback(visualObj, playbackContainer);
				}
			})
			.catch(error => {
				console.error('Error initializing ABC for example:', error);
				abcContainer.innerHTML = `<div class="error">Failed to render ABC notation: ${error.message}</div>`;
			});
	});

	console.log(`Initialized ABC rendering for ${examples.length} examples`);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Show/hide ABC source code for debugging
 * @param {boolean} show - Whether to show the source code
 */
export function toggleABCSource(show) {
	const sources = document.querySelectorAll('.abc-source');
	sources.forEach(source => {
		source.style.display = show ? 'block' : 'none';
	});
}

/**
 * Log ABC notation for debugging
 * @param {string} fqsCode - The FQS code to debug
 */
export function debugABC(fqsCode) {
	try {
		const ast = parse(fqsCode);
		const abcNotation = convertToABC(ast);
		console.log('FQS Code:', fqsCode);
		console.log('ABC Notation:', abcNotation);
		console.log('AST:', ast);
		return abcNotation;
	} catch (error) {
		console.error('Debug error:', error);
		return null;
	}
}

// =============================================================================
// Export
// =============================================================================

export default {
	getABCNotation,
	renderABCFromFQS,
	setupMIDIPlayback,
	initializeABCForTutorial,
	toggleABCSource,
	debugABC
};
