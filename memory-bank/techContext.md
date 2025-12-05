# Technical Context

## Technology Stack

### Core Technologies
- **JavaScript (ES6+)**: Primary implementation language, using ES modules for code organization.
- **HTML5/CSS3**: For web interface and tutorial presentation.
- **SVG (Scalable Vector Graphics)**: For musical notation rendering.
- **Web Components**: Custom Elements v1 and Shadow DOM for component encapsulation.

### Development Tools
- **PEG.js**: Parser generator for the FQS grammar.
- **Node.js**: For running PEG.js and development server.
- **Python 3**: Simple HTTP server for local development (`python3 -m http.server`).
- **Git**: Version control, hosted on GitHub.

### Build and Deployment
- **No build step required** for core functionality (pure ES modules).
- **Parser generation**: Manual step when grammar changes: `npx pegjs -o parser.js fqs.pegjs`.
- **Deployment**: Static file hosting (GitHub Pages, Netlify, or any web server).

## Development Environment

### Setup Instructions
1. Clone repository: `git clone https://github.com/Michael-F-Ellis/miniFQS.git`
2. No package installation required (zero dependencies).
3. Run local server: `python3 -m http.server 8000`
4. Open browser to `http://localhost:8000/`

### File Structure
```
miniFQS/
├── fqs.pegjs          # Grammar definition (PEG.js)
├── parser.js          # Generated parser (do not edit directly)
├── fqs2ast.js         # Command-line utility: FQS text to AST (JSON)
├── ast2flat.js        # Command-line utility: AST to flattened TSV table
├── pitch-octaves.js   # Pipeline stage: calculate absolute octaves for pitches
├── map-pitches.js     # Pipeline stage: map pitches to lyric attacks
├── abcprep.js         # Pipeline stage: add ABC header rows and columns
├── ast2abc.js         # Command-line utility: AST to ABC notation (currently mothballed)
├── layout.js          # Layout engine (ES module)
├── mini-fqs.js        # Web component (ES module)
├── index.html         # Main demo page
├── validate-parser.html # Parser testing page
├── build.js           # Optional build script (not currently used)
├── tutorial/          # Tutorial system
│   ├── index.html    # Main tutorial page
│   ├── css/          # Tutorial styles
│   ├── js/           # Tutorial JavaScript
│   ├── examples.json # JSON file containing all tutorial examples
│   └── examples/     # Individual example pages (future, optional)
└── memory-bank/      # Project documentation
    ├── projectbrief.md
    ├── productContext.md
    ├── systemPatterns.md
    ├── techContext.md
    ├── activeContext.md
    └── progress.md
```

## Technical Constraints

### Browser Compatibility
- **Target**: Modern browsers (Chrome 61+, Firefox 60+, Safari 10.1+, Edge 79+).
- **Requirements**: ES6 module support, Custom Elements v1, Shadow DOM.
- **Fallbacks**: No support for older browsers; users must upgrade.

### Performance Constraints
- **Parsing**: Must handle typical vocal lines (up to 100 measures) in under 100ms.
- **Rendering**: SVG generation should be fast enough for interactive editing.
- **Bundle Size**: No external dependencies; total JS < 100KB.

### Security Considerations
- **No server-side component**: All processing happens in browser.
- **No user data storage**: Scores are transient (can be saved as text files).
- **No external network requests**: Fully self-contained.

## Code Standards and Conventions

### JavaScript Style
- **Modules**: Use ES6 module syntax (`import`/`export`).
- **Classes**: Use class syntax for object-oriented code.
- **Functions**: Prefer arrow functions for callbacks, regular functions for methods.
- **Naming**: camelCase for variables/functions, PascalCase for classes, UPPER_CASE for constants.

### HTML/CSS Conventions
- **Semantic HTML**: Use appropriate sectioning elements.
- **CSS Custom Properties**: Use CSS variables for theming.
- **BEM-like naming**: For tutorial CSS, use descriptive class names.

### Documentation
- **Code comments**: JSDoc for public APIs, inline comments for complex logic.
- **Memory bank**: Keep documentation updated as system evolves.
- **Tutorial examples**: Each example should be clear and focused.

## Dependencies and Versioning

### Zero Runtime Dependencies
- The core engine has no external dependencies.
- PEG.js is a development dependency only (for parser generation).

### Version Compatibility
- **PEG.js**: Version 5.0.6 (specified in parser.js header).
- **Web Components**: Native browser implementation, no polyfills.

### Upgrade Strategy
- **Browser features**: Use feature detection if needed in future.
- **PEG.js**: Regenerate parser when updating PEG.js version.
- **Tutorial content**: Manual updates as FQS syntax evolves.

## Testing Strategy

### Manual Testing
- `validate-parser.html`: Interactive parser testing.
- Visual inspection of rendered examples.
- Browser compatibility testing on target browsers.

### Automated Testing (Future)
- Unit tests for parser and layout engine.
- Visual regression tests for rendering.
- Integration tests for web component.

## Development Workflow

### Typical Development Cycle
1. **Grammar changes**: Edit `fqs.pegjs`, regenerate `parser.js`.
2. **Layout changes**: Modify `layout.js` algorithms.
3. **Component changes**: Update `mini-fqs.js` web component.
4. **Tutorial updates**: Add examples to `tutorial/` directory.
5. **Documentation**: Update memory bank files.

### Code Review Considerations
- **Parser changes**: Verify grammar modifications don't break existing scores.
- **Layout changes**: Check rendering accuracy against standard notation.
- **Tutorial changes**: Ensure examples are pedagogically sound.

## Deployment and Distribution

### Distribution Methods
1. **GitHub Pages**: Automatic deployment from `gh-pages` branch.
2. **NPM package**: Potential future distribution as web component.
3. **CDN**: Could be hosted on jsDelivr or unpkg.

### Versioning Strategy
- **Semantic versioning**: MAJOR.MINOR.PATCH for releases.
- **Git tags**: Mark releases with version tags.
- **Changelog**: Document changes between versions.

## Troubleshooting Guide

### Common Issues
1. **Parser errors**: Check FQS syntax, ensure barlines are present.
2. **Rendering issues**: Verify browser supports Web Components and Shadow DOM.
3. **Module errors**: Ensure using ES module compatible server (not `file://` protocol).

### Debugging Tips
- Use browser dev tools to inspect component shadow DOM.
- Check console for parser errors.
- Validate FQS syntax with `validate-parser.html`.

This technical context provides developers with the necessary information to understand, contribute to, and extend the miniFQS system.
