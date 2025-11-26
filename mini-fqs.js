import { parse } from './parser.js';
import { layoutScore } from './layout.js';

console.log('mini-fqs module loaded');

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

    render() {
        // 1. Setup Shadow DOM
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

        // 2. Empty Check
        if (!this._score || this._score.trim() === '') {
            return;
        }

        try {
            // 3. Parse
            const ast = parse(this._score);
            
            // 4. Layout
            const layoutData = layoutScore(ast);
            
            // 5. Calculate Auto-Scaling ViewBox
            // layoutData.width includes the left margin (50).
            // We add 50 to create a symmetrical Right Margin.
            // This ensures the content is centered within the viewbox with margins.
            const viewBoxWidth = layoutData.width + 50; 
            const viewBoxHeight = layoutData.height;

            // 6. Render SVG
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", "100%");
            // We do not set fixed height; we let aspect ratio handle it, 
            // OR set it if we want to force scroll. 
            // Since we want "Scale to Fit", we rely on viewBox.
            // However, SVG usually needs height or it collapses.
            // If we want "width=100%", height should be auto? 
            // SVG doesn't strictly support "height: auto" like img.
            // But if we set viewBox, it has an intrinsic ratio.
            
            // We set the viewBox defining the coordinate system
            svg.setAttribute("viewBox", `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
            
            // This forces the SVG to scale uniformly to fit the container width
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