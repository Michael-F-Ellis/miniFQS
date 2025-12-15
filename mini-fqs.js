import { parse } from './parser.js';
import { layoutScore } from './layout.js';

console.log('mini-fqs module loaded');

// Expose parse function globally for browser pipeline
if (typeof window !== 'undefined') {
    window.parse = parse;
    console.log('parse function exposed globally for browser pipeline');
}

class MiniFQS extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._score = '';
        this._config = {};
    }

    static get observedAttributes() {
        return ['score'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'score' && oldValue !== newValue) {
            this._score = newValue;
            this.render();
        }
    }

    get score() { return this._score; }
    set score(val) {
        this._score = val;
        this.render();
    }

    connectedCallback() {
        if (this.hasOwnProperty('score')) {
            let value = this.score;
            delete this.score;
            this.score = value;
        }
        if (!this._score && this.hasAttribute('score')) {
            this._score = this.getAttribute('score');
        }
        this.render();
    }

    preprocess() {
        // For interactive editing, we need to make sure the parser
        // receives grammatically correct input whenever possible.
        // Since the parser requires lyric and pitch lines to have a barline
        // as the last non-whitespace char, we will scan this._score
        // and append a barline when one isn't present.

        let processedScore = this._score;
        const lines = processedScore.split('\n');
        const newLines = [];
        let titleFound = false;

        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine) {
                newLines.push(trimmedLine); // preserve empty lines
                return;
            }
            if (!titleFound) {
                newLines.push(trimmedLine);
                titleFound = true;
                return;
            }
            if (trimmedLine.startsWith('counter:')) {
                newLines.push(trimmedLine);
                return;
            }
            // If we get to here, it's a lyric or pitch line.
            // Check if the last non-whitespace character is a barline '|'
            const lastChar = trimmedLine.slice(-1);
            if (lastChar !== '|') {
                // Append a barline if missing
                newLines.push(trimmedLine + ' |');
            } else {
                newLines.push(trimmedLine);
            }
        });

        // Update _score only if changes were made
        const newScore = newLines.join('\n');
        if (newScore !== this._score) {
            this._score = newScore;
            console.log("Score preprocessed: Barlines added.");
        }
    }
    render() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    background: #fff;
                    font-family: 'Courier New', monospace;
                    overflow-x: auto;
                    border: 1px solid #eee;
                }
                svg { display: block; }
                .error { color: #d32f2f; background: #fdecea; padding: 10px; white-space: pre-wrap; }
            </style>
            <div id="container"></div>
        `;
        const container = this.shadowRoot.getElementById('container');

        if (!this._score || this._score.trim() === '') {
            return;
        }

        try {
            this.preprocess();
            const ast = parse(this._score);
            const layoutData = layoutScore(ast);

            const viewBoxWidth = layoutData.width + 50;
            const viewBoxHeight = layoutData.height;

            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", "100%");
            svg.setAttribute("viewBox", `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
            svg.setAttribute("preserveAspectRatio", "xMinYMin meet");

            layoutData.commands.forEach(cmd => {
                if (cmd.type === 'line') {
                    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    line.setAttribute("x1", cmd.x1);
                    line.setAttribute("y1", cmd.y1);
                    line.setAttribute("x2", cmd.x2);
                    line.setAttribute("y2", cmd.y2);
                    line.setAttribute("stroke", cmd.stroke);
                    line.setAttribute("stroke-width", 1);
                    svg.appendChild(line);
                } else if (cmd.type === 'text') {
                    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    text.setAttribute("x", cmd.x);
                    text.setAttribute("y", cmd.y);
                    text.setAttribute("fill", cmd.color);
                    text.style.font = cmd.font;

                    // NEW: Handle Text Anchor (Centering)
                    if (cmd.anchor) {
                        text.setAttribute("text-anchor", cmd.anchor);
                    }

                    text.textContent = cmd.text;
                    svg.appendChild(text);
                }
            });

            container.appendChild(svg);

            this.dispatchEvent(new CustomEvent('fqs-load', {
                bubbles: true,
                detail: { height: viewBoxHeight, width: viewBoxWidth }
            }));

        } catch (e) {
            console.error(e);
            const errDiv = document.createElement('div');
            errDiv.className = 'error';
            errDiv.textContent = `Error: ${e.message}`;
            if (e.location) {
                errDiv.textContent += `\nLine: ${e.location.start.line}`;
            }
            container.appendChild(errDiv);
        }
    }
}

customElements.define('mini-fqs', MiniFQS);
