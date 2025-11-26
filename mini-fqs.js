import { parse } from './parser.js';
import { layoutScore } from './layout.js';

console.log('mini-fqs module loaded'); // Debug 1

class MiniFQS extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._score = '';
        this._config = {};
        console.log('MiniFQS Constructor'); // Debug 2
    }

    static get observedAttributes() {
        return ['score'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        console.log(`Attribute changed: ${name}`); // Debug 3
        if (name === 'score' && oldValue !== newValue) {
            this._score = newValue;
            this.render();
        }
    }

    get score() { return this._score; }
    set score(val) {
        console.log('Score setter called'); // Debug 4
        this._score = val;
        this.render();
    }

    connectedCallback() {
        console.log('ConnectedCallback'); // Debug 5
        this.render();
    }

    render() {
        console.log('Render starting...'); // Debug 6

        // 1. Setup Shadow DOM
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    background: #fff;
                    font-family: 'Courier New', monospace;
                    overflow-x: auto;
                    border: 2px solid blue; /* VISUAL DEBUG: Force a border */
                    min-height: 50px;       /* VISUAL DEBUG: Force height */
                }
                svg { display: block; background: #fafafa; }
                .error { color: red; padding: 10px; border: 1px solid red; }
            </style>
            <div id="container"></div>
        `;
        const container = this.shadowRoot.getElementById('container');

        // 2. Empty Check
        if (!this._score || this._score.trim() === '') {
            console.log('Render: Empty score, returning.');
            return;
        }

        try {
            // 3. Parse
            console.log('Render: Parsing...');
            const ast = parse(this._score);
            console.log('Render: Parse success', ast);

            // 4. Layout
            console.log('Render: Layout starting...');
            // Check if layoutScore is actually a function
            if (typeof layoutScore !== 'function') {
                throw new Error(`layoutScore is not a function. It is: ${typeof layoutScore}`);
            }
            
            const layoutData = layoutScore(ast);
            console.log('Render: Layout success', layoutData);

            // 5. Render SVG
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", "100%");
            svg.setAttribute("height", layoutData.height);
            svg.setAttribute("viewBox", `0 0 800 ${layoutData.height}`);
            
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
            console.log('Render: SVG Appended');

        } catch (e) {
            console.error('Render Error:', e);
            const errDiv = document.createElement('div');
            errDiv.className = 'error';
            errDiv.textContent = `Error: ${e.message}`;
            container.appendChild(errDiv);
        }
    }
}

customElements.define('mini-fqs', MiniFQS);