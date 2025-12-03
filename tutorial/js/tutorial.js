// miniFQS Tutorial JavaScript
// Additional functionality for the tutorial pages

import { initializeABCForTutorial } from './abcjs-integration.js';

// Extract title from FQS code (first non-empty line)
function extractTitleFromFQSCode(fqsCode) {
	if (!fqsCode) return 'Untitled Example';
	const lines = fqsCode.split('\n').filter(line => line.trim().length > 0);
	return lines.length > 0 ? lines[0].trim() : 'Untitled Example';
}

// Load examples from JSON file
async function loadExamples() {
	try {
		const response = await fetch('examples.json');
		if (!response.ok) {
			throw new Error(`Failed to load examples.json: ${response.status} ${response.statusText}`);
		}
		const data = await response.json();
		console.log('Loaded examples data:', data);
		return data;
	} catch (error) {
		console.error('Error loading examples:', error);
		// Return minimal structure as fallback
		return { sections: [] };
	}
}

// Initialize FQS examples from JSON data
async function initializeFQSExamples() {
	const examplesData = await loadExamples();

	// Create a map of section IDs to examples for quick lookup
	const examplesBySection = {};
	examplesData.sections.forEach(section => {
		examplesBySection[section.id] = section.examples || [];
	});

	// Get all example containers
	const exampleContainers = document.querySelectorAll('.examples-container[data-section]');

	exampleContainers.forEach(container => {
		const sectionId = container.getAttribute('data-section');
		const examples = examplesBySection[sectionId] || [];

		// Clear container
		container.innerHTML = '';

		if (examples.length === 0) {
			container.innerHTML = '<div class="example-placeholder"><p>No examples available for this section yet.</p></div>';
			return;
		}

		// Create an example div for each example
		examples.forEach(example => {
			const fqsCode = example.fqsCode;
			const title = extractTitleFromFQSCode(fqsCode);

			const exampleDiv = document.createElement('div');
			exampleDiv.className = 'example';
			// Note: We no longer use data-fqs-code attribute as the primary source
			// but we'll keep it for backward compatibility if needed
			exampleDiv.setAttribute('data-fqs-code', fqsCode);

			// Create the four columns
			const columns = [
				{ className: 'fqs-code', title: 'FQS Syntax', content: createFQSCodeColumn(fqsCode) },
				{ className: 'rendering', title: 'miniFQS Rendering', content: createRenderingColumn(fqsCode, title) },
				{ className: 'abc-column', title: 'ABC Notation & Playback', content: createABCColumnPlaceholder() },
				{ className: 'abc-code', title: 'ABC Code', content: createABCCodeColumnPlaceholder() }
			];

			columns.forEach(col => {
				const columnDiv = document.createElement('div');
				columnDiv.className = col.className;

				const heading = document.createElement('h4');
				heading.textContent = col.title;
				columnDiv.appendChild(heading);

				if (col.content) {
					columnDiv.appendChild(col.content);
				}

				exampleDiv.appendChild(columnDiv);
			});

			container.appendChild(exampleDiv);
		});
	});

	console.log(`Initialized ${exampleContainers.length} example containers from JSON`);
}

// Create FQS code column
function createFQSCodeColumn(fqsCode) {
	const pre = document.createElement('pre');
	const code = document.createElement('code');
	code.className = 'fqs-source';
	code.textContent = fqsCode;
	pre.appendChild(code);
	return pre;
}

// Create rendering column with mini-fqs element
function createRenderingColumn(fqsCode, title) {
	const miniFQS = document.createElement('mini-fqs');
	miniFQS.className = 'fqs-render';
	miniFQS.setAttribute('score', fqsCode);
	miniFQS.setAttribute('title', title);
	return miniFQS;
}

// Create placeholder for ABC column (will be populated by abcjs-integration.js)
function createABCColumnPlaceholder() {
	const div = document.createElement('div');
	div.className = 'abc-container';
	// Will be populated by abcjs-integration.js
	return div;
}

// Create placeholder for ABC code column (will be populated by abcjs-integration.js)
function createABCCodeColumnPlaceholder() {
	const pre = document.createElement('pre');
	const code = document.createElement('code');
	code.className = 'abc-source';
	// Will be populated by abcjs-integration.js
	pre.appendChild(code);
	return pre;
}

// Smooth scrolling for navigation links
function setupSmoothScrolling() {
	const navLinks = document.querySelectorAll('nav a[href^="#"]');

	navLinks.forEach(link => {
		link.addEventListener('click', function (e) {
			e.preventDefault();

			const targetId = this.getAttribute('href');
			const targetElement = document.querySelector(targetId);

			if (targetElement) {
				const offsetTop = targetElement.offsetTop - 80; // Account for sticky nav

				window.scrollTo({
					top: offsetTop,
					behavior: 'smooth'
				});
			}
		});
	});
}

// Highlight active navigation section
function setupActiveNavHighlight() {
	const sections = document.querySelectorAll('section');
	const navLinks = document.querySelectorAll('nav a[href^="#"]');

	function highlightActiveNav() {
		let currentSection = '';

		sections.forEach(section => {
			const sectionTop = section.offsetTop - 100;
			const sectionHeight = section.clientHeight;

			if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
				currentSection = '#' + section.getAttribute('id');
			}
		});

		navLinks.forEach(link => {
			link.classList.remove('active');
			if (link.getAttribute('href') === currentSection) {
				link.classList.add('active');
			}
		});
	}

	// Add active class styling
	const style = document.createElement('style');
	style.textContent = `
        nav a.active {
            background-color: var(--secondary-color) !important;
            color: white !important;
        }
    `;
	document.head.appendChild(style);

	// Initial highlight and scroll event listener
	highlightActiveNav();
	window.addEventListener('scroll', highlightActiveNav);
}

// Copy code functionality for FQS examples
function setupCopyButtons() {
	// Use event delegation for dynamically created elements
	document.addEventListener('click', async (e) => {
		const copyButton = e.target.closest('.copy-button');
		if (!copyButton) return;

		const codeBlock = copyButton.closest('pre');
		if (!codeBlock) return;

		const code = codeBlock.textContent;
		try {
			await navigator.clipboard.writeText(code);
			const originalText = copyButton.textContent;
			copyButton.textContent = 'Copied!';
			setTimeout(() => {
				copyButton.textContent = originalText;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy code: ', err);
			copyButton.textContent = 'Failed';
			setTimeout(() => {
				copyButton.textContent = 'Copy';
			}, 2000);
		}
	});

	// Also add copy buttons to existing code blocks
	const codeBlocks = document.querySelectorAll('.fqs-code pre, .abc-code pre');

	codeBlocks.forEach(block => {
		if (block.querySelector('.copy-button')) return; // Already has a button

		const copyButton = document.createElement('button');
		copyButton.textContent = 'Copy';
		copyButton.className = 'copy-button';
		copyButton.style.cssText = `
            position: absolute;
            top: 0.5rem;
            right: 0.5rem;
            background: #495057;
            color: white;
            border: none;
            padding: 0.25rem 0.5rem;
            border-radius: 3px;
            font-size: 0.8rem;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 10;
        `;

		block.style.position = 'relative';
		block.appendChild(copyButton);

		block.addEventListener('mouseenter', () => {
			copyButton.style.opacity = '1';
		});

		block.addEventListener('mouseleave', () => {
			copyButton.style.opacity = '0';
		});
	});
}

// Auto-resize mini-fqs elements based on content
function setupMiniFQSResizing() {
	const observer = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			if (mutation.type === 'childList' || mutation.type === 'attributes') {
				const miniFQSElements = document.querySelectorAll('mini-fqs');
				miniFQSElements.forEach(element => {
					element.addEventListener('fqs-load', function (e) {
						const container = this.shadowRoot?.querySelector('#container');
						if (container && container.firstChild) {
							const svg = container.querySelector('svg');
							if (svg) {
								// Set a reasonable max height for tutorial examples
								svg.style.maxHeight = '200px';
							}
						}
					});
				});
			}
		});
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['score']
	});
}

// Add keyboard navigation
function setupKeyboardNavigation() {
	document.addEventListener('keydown', function (e) {
		if (e.altKey) {
			const sections = document.querySelectorAll('section');
			let currentIndex = -1;

			sections.forEach((section, index) => {
				const rect = section.getBoundingClientRect();
				if (rect.top >= 0 && rect.top < window.innerHeight / 2) {
					currentIndex = index;
				}
			});

			if (e.key === 'ArrowDown' && currentIndex < sections.length - 1) {
				e.preventDefault();
				sections[currentIndex + 1].scrollIntoView({ behavior: 'smooth' });
			} else if (e.key === 'ArrowUp' && currentIndex > 0) {
				e.preventDefault();
				sections[currentIndex - 1].scrollIntoView({ behavior: 'smooth' });
			}
		}
	});
}

// Print-friendly styles for PDF generation
function setupPrintStyles() {
	const printStyle = document.createElement('style');
	printStyle.textContent = `
        @media print {
            nav, footer {
                display: none;
            }
            
            .example {
                break-inside: avoid;
                page-break-inside: avoid;
            }
            
            section {
                box-shadow: none;
                border: 1px solid #ccc;
            }
            
            .rendering mini-fqs {
                border: 1px solid #000;
            }
            
            .abc-code pre {
                background-color: white !important;
                color: black !important;
                border: 1px solid #ccc;
            }
        }
    `;
	document.head.appendChild(printStyle);
}

// Main initialization
document.addEventListener('DOMContentLoaded', async function () {
	console.log('miniFQS Tutorial JavaScript loading...');

	// Setup all functionality
	setupSmoothScrolling();
	setupActiveNavHighlight();
	setupCopyButtons();
	setupMiniFQSResizing();
	setupKeyboardNavigation();
	setupPrintStyles();

	// Initialize FQS examples from JSON
	await initializeFQSExamples();

	// Initialize ABC rendering for all examples
	try {
		initializeABCForTutorial();
	} catch (error) {
		console.error('Error initializing ABC for tutorial:', error);
	}

	console.log('miniFQS Tutorial JavaScript loaded successfully');
});

// Export functions for testing
export {
	extractTitleFromFQSCode,
	loadExamples,
	initializeFQSExamples
};
