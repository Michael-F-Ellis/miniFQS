// miniFQS Tutorial JavaScript
// Additional functionality for the tutorial pages

document.addEventListener('DOMContentLoaded', function () {
	// Initialize FQS examples from data attributes
	function initializeFQSExamples() {
		const examples = document.querySelectorAll('.example[data-fqs-code]');

		examples.forEach(example => {
			const fqsCode = example.getAttribute('data-fqs-code');

			// Populate code display
			const codeElement = example.querySelector('.fqs-source');
			if (codeElement) {
				codeElement.textContent = fqsCode;
			}

			// Populate mini-fqs element
			const renderElement = example.querySelector('.fqs-render');
			if (renderElement) {
				renderElement.setAttribute('score', fqsCode);
			}
		});
	}

	// Smooth scrolling for navigation links
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

	// Highlight active navigation section
	function highlightActiveNav() {
		const sections = document.querySelectorAll('section');
		const navLinks = document.querySelectorAll('nav a[href^="#"]');

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

	// Copy code functionality for FQS examples
	const codeBlocks = document.querySelectorAll('.fqs-code pre');

	codeBlocks.forEach(block => {
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
        `;

		block.style.position = 'relative';
		block.appendChild(copyButton);

		block.addEventListener('mouseenter', () => {
			copyButton.style.opacity = '1';
		});

		block.addEventListener('mouseleave', () => {
			copyButton.style.opacity = '0';
		});

		copyButton.addEventListener('click', async () => {
			const code = block.textContent;
			try {
				await navigator.clipboard.writeText(code);
				copyButton.textContent = 'Copied!';
				setTimeout(() => {
					copyButton.textContent = 'Copy';
				}, 2000);
			} catch (err) {
				console.error('Failed to copy code: ', err);
				copyButton.textContent = 'Failed';
				setTimeout(() => {
					copyButton.textContent = 'Copy';
				}, 2000);
			}
		});
	});

	// Auto-resize mini-fqs elements based on content
	function resizeMiniFQSElements() {
		const miniFQSElements = document.querySelectorAll('mini-fqs');

		miniFQSElements.forEach(element => {
			element.addEventListener('fqs-load', function (e) {
				const container = this.shadowRoot.querySelector('#container');
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

	resizeMiniFQSElements();

	// Add keyboard navigation
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

	// Print-friendly styles for PDF generation
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
        }
    `;
	document.head.appendChild(printStyle);

	// Initialize FQS examples
	initializeFQSExamples();

	console.log('miniFQS Tutorial JavaScript loaded successfully');
});
