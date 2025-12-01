// abcjs Integration for miniFQS Tutorial
// Handles rendering of ABC notation and MIDI playback

import { parse } from '../../parser.js';
import { convertToABC } from './abc-converter.js';

// Global variables for MIDI control
let currentAudioContext = null;
let currentSynth = null;
let isPlaying = false;
let currentTempo = 120;

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
 * Render ABC notation for a given FQS code
 * @param {string} fqsCode - The FQS code to convert and render
 * @param {HTMLElement} container - The DOM element to render into
 * @returns {Object} The ABCJS visual object
 */
export async function renderABCFromFQS(fqsCode, container) {
	try {
		// Wait for abcjs to be available
		await waitForABCJS();

		// Parse the FQS code to AST
		const ast = parse(fqsCode);

		// Convert AST to ABC notation
		const abcNotation = convertToABC(ast);

		// Clear container
		container.innerHTML = '';

		// Create a div for the ABC notation rendering
		const abcDiv = document.createElement('div');
		abcDiv.className = 'abc-notation';
		container.appendChild(abcDiv);

		// Render the ABC notation
		const visualObj = window.ABCJS.renderAbc(abcDiv, abcNotation, {
			responsive: 'resize',
			scale: 0.8
		});

		// Also store the ABC notation for potential debugging
		const debugPre = document.createElement('pre');
		debugPre.className = 'abc-source';
		debugPre.textContent = abcNotation;
		debugPre.style.display = 'none';
		container.appendChild(debugPre);

		console.log('ABC notation generated:', abcNotation);
		return visualObj;

	} catch (error) {
		console.error('Error rendering ABC:', error);
		container.innerHTML = `<div class="error">Error rendering ABC notation: ${error.message}</div>`;
		return null;
	}
}

/**
 * Setup MIDI playback for a given ABC notation
 * @param {string} abcNotation - The ABC notation string
 * @param {HTMLElement} container - The container for the playback controls
 * @returns {Object} The timing callbacks object
 */
export function setupMIDIPlayback(abcNotation, container) {
	// Clear any existing controls
	container.innerHTML = '';

	// Create playback controls
	const controlsDiv = document.createElement('div');
	controlsDiv.className = 'playback-controls';

	// Play button
	const playButton = document.createElement('button');
	playButton.className = 'play-button';
	playButton.textContent = 'Play';
	playButton.addEventListener('click', () => togglePlayback(abcNotation, playButton, progressBar));

	// Stop button
	const stopButton = document.createElement('button');
	stopButton.className = 'stop-button';
	stopButton.textContent = 'Stop';
	stopButton.addEventListener('click', stopPlayback);

	// Tempo control
	const tempoDiv = document.createElement('div');
	tempoDiv.className = 'tempo-control';
	tempoDiv.innerHTML = `
        <label for="tempo">Tempo: <span class="tempo-value">${currentTempo}</span> BPM</label>
        <input type="range" id="tempo" min="40" max="200" value="${currentTempo}" class="tempo-slider">
    `;

	// Progress bar
	const progressBar = document.createElement('div');
	progressBar.className = 'playback-progress';
	progressBar.innerHTML = '<div class="progress-bar"></div>';

	controlsDiv.appendChild(playButton);
	controlsDiv.appendChild(stopButton);
	controlsDiv.appendChild(tempoDiv);
	controlsDiv.appendChild(progressBar);
	container.appendChild(controlsDiv);

	// Add tempo slider event listener
	const tempoSlider = tempoDiv.querySelector('.tempo-slider');
	const tempoValue = tempoDiv.querySelector('.tempo-value');
	tempoSlider.addEventListener('input', (e) => {
		currentTempo = parseInt(e.target.value);
		tempoValue.textContent = currentTempo;
	});

	// Return the controls container for potential further manipulation
	return controlsDiv;
}

// =============================================================================
// MIDI Playback Control Functions
// =============================================================================

/**
 * Toggle playback of ABC notation
 * @param {string} abcNotation - The ABC notation to play
 * @param {HTMLElement} playButton - The play button element
 * @param {HTMLElement} progressBar - The progress bar container
 */
function togglePlayback(abcNotation, playButton, progressBar) {
	if (isPlaying) {
		stopPlayback();
		playButton.textContent = 'Play';
	} else {
		startPlayback(abcNotation, progressBar);
		playButton.textContent = 'Pause';
	}
}

/**
 * Start MIDI playback
 * @param {string} abcNotation - The ABC notation to play
 * @param {HTMLElement} progressBar - The progress bar container
 */
function startPlayback(abcNotation, progressBar) {
	// Stop any existing playback
	stopPlayback();

	// Create new audio context
	currentAudioContext = new (window.AudioContext || window.webkitAudioContext)();
	currentSynth = new window.ABCJS.synth.CreateSynth();

	// Set up timing callbacks for progress bar
	const timingCallbacks = new window.ABCJS.synth.TimingCallbacks(currentAudioContext, {
		eventCallback: function (event) {
			if (event.type === 'beat' && event.beatNumber !== undefined) {
				updateProgressBar(progressBar, event.beatNumber, event.totalBeats);
			}
		}
	});

	// Set up the synth
	currentSynth.init({
		audioContext: currentAudioContext,
		visualObj: window.ABCJS.renderAbc("*", abcNotation)[0],
		millisecondsPerMeasure: 60000 / currentTempo * 4, // Assuming 4/4 time
	}).then(() => {
		isPlaying = true;
		currentSynth.start();
		timingCallbacks.start();
	}).catch(error => {
		console.error('Error starting synth:', error);
		isPlaying = false;
	});
}

/**
 * Stop MIDI playback
 */
function stopPlayback() {
	if (currentSynth) {
		currentSynth.stop();
		currentSynth = null;
	}
	if (currentAudioContext) {
		currentAudioContext.close();
		currentAudioContext = null;
	}
	isPlaying = false;

	// Reset all play buttons
	document.querySelectorAll('.play-button').forEach(button => {
		button.textContent = 'Play';
	});
}

/**
 * Update the progress bar during playback
 * @param {HTMLElement} progressBar - The progress bar container
 * @param {number} currentBeat - The current beat number
 * @param {number} totalBeats - The total number of beats
 */
function updateProgressBar(progressBar, currentBeat, totalBeats) {
	const bar = progressBar.querySelector('.progress-bar');
	if (bar && totalBeats > 0) {
		const percentage = (currentBeat / totalBeats) * 100;
		bar.style.width = `${percentage}%`;
	}
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

		// Create a new column for ABC notation
		const abcColumn = document.createElement('div');
		abcColumn.className = 'abc-column';

		// Add heading
		const heading = document.createElement('h4');
		heading.textContent = 'ABC Notation & Playback';
		abcColumn.appendChild(heading);

		// Create container for ABC rendering
		const abcContainer = document.createElement('div');
		abcContainer.className = 'abc-container';
		abcColumn.appendChild(abcContainer);

		// Try to render ABC notation
		// Try to render ABC notation
		renderABCFromFQS(fqsCode, abcContainer)
			.then((visualObj) => {
				// If successful, add playback controls
				if (visualObj) {
					const playbackContainer = document.createElement('div');
					playbackContainer.className = 'playback-container';
					abcColumn.appendChild(playbackContainer);

					// Get ABC notation from the hidden pre element
					const abcNotation = abcContainer.querySelector('.abc-source').textContent;
					setupMIDIPlayback(abcNotation, playbackContainer);
				}
			})
			.catch(error => {
				console.error('Error initializing ABC for example:', error);
				abcContainer.innerHTML = `<div class="error">Failed to render ABC notation: ${error.message}</div>`;
			});

		// Insert the ABC column after the rendering column
		const renderingColumn = example.querySelector('.rendering');
		if (renderingColumn) {
			renderingColumn.parentNode.insertBefore(abcColumn, renderingColumn.nextSibling);
		} else {
			// Fallback: append to the example
			example.appendChild(abcColumn);
		}
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
	renderABCFromFQS,
	setupMIDIPlayback,
	initializeABCForTutorial,
	toggleABCSource,
	debugABC
};
