# System Patterns

## Architecture Overview
miniFQS follows a modular, web-centric architecture with clear separation between parsing, layout, and rendering. The system is designed to be lightweight and dependency-free, using vanilla JavaScript and web standards.

## Core Components

### 1. Parser System (fqs.pegjs → parser.js)
- **Pattern**: PEG.js grammar definition compiled to a pure JavaScript parser.
- **Input**: FQS text notation (multiline string).
- **Output**: Abstract Syntax Tree (AST) representing the musical score.
- **Error Handling**: Detailed syntax error reporting with line/column information.
- **Key Design**: The grammar is defined in a declarative PEG syntax, then compiled to an efficient parser.

### 2. Layout Engine (layout.js)
- **Pattern**: Procedural layout algorithm that converts AST to rendering commands.
- **Input**: AST from parser.
- **Output**: Array of drawing commands (lines, text) with coordinates and styles.
- **Key Algorithms**:
  - **Beat Tuple Processing**: Handles rhythmic subdivisions and syllable alignment.
  - **Pitch Calculation**: Uses LilyPond-style pitch determination with octave tracking.
  - **Staff Layout**: Positions notes relative to staff lines based on pitch and accidentals.
  - **Accidental State Management**: Tracks key signatures and measure-level accidentals.

### 3. Rendering System (mini-fqs.js)
- **Pattern**: Custom Web Component with Shadow DOM encapsulation.
- **Input**: FQS text via attribute or property.
- **Output**: SVG rendering inside component's shadow DOM.
- **Lifecycle**:
  1. Attribute/property change triggers `render()`.
  2. `render()` calls parser, then layout, then generates SVG elements.
  3. SVG is injected into shadow DOM container.
  4. Custom event `fqs-load` dispatched with dimensions.

### 4. Tutorial System (tutorial/)
- **Pattern**: Static HTML with dynamic JavaScript for example synchronization and JSON-driven data.
- **Data Flow**: FQS examples stored in `tutorial/examples.json` (organized by sections), dynamically loaded and rendered.
- **JavaScript**: `tutorial.js` fetches JSON, generates example containers with four columns (FQS Syntax, miniFQS Rendering, ABC Notation & Playback, ABC Code).
- **Design**: Centralized data storage for easy maintenance and extension, with dynamic generation eliminating redundant HTML.

### 5. FQS-to-ABC Pipeline System
- **Pattern**: Modular Unix-style pipeline of command-line utilities, each performing a single transformation.
- **Pipeline Stages**:
  1. **fqs2ast.js**: Parses FQS text to AST (JSON)
  2. **ast2flat.js**: Flattens AST to tabular TSV format for debugging and processing
  3. **pitch-octaves.js**: Calculates absolute octaves using LilyPond Rule
  4. **map-pitches.js**: Maps pitch information to lyric attacks
  5. **abcprep.js**: Adds ABC header rows and columns to TSV
  6. **abcmeter.js**: Adds meter (time signature) changes and L (unit note length) directives
  7. **abckeysig.js**: Adds key signatures and barlines in ABC format
  8. **abcnotes.js**: Converts pitch/rhythm to ABC note syntax with tuplet handling
  9. **abcgen.js**: Generates final ABC notation string
- **Design Philosophy**: Each stage reads from stdin and writes to stdout, enabling flexible composition and debugging.
- **Data Format**: Intermediate stages use TSV (tab-separated values) for human/AI inspection and processing.
- **Recent Improvements**:
  - **Tuplet handling**: `abcnotes.js` now correctly adds `(N)` prefixes for odd subdivisions in simple meter (L:1/4) but not in compound meter (L:1/8)
  - **L directive support**: `abcmeter.js` detects unit note length changes from BeatDur rows and adds `[L:...]` directives
  - **Meter calculation**: `abcmeter.js` correctly counts beats for compound meter (L:1/8) by counting actual subdivisions
  - **Directive preservation**: `abcnotes.js` preserves existing `[L:...]` and `[M:...]` directives when adding note strings
  - **Redundant key suppression**: `abckeysig.js` only outputs inline key signatures when the key actually changes

### 6. fqspipe.js Command-Line Wrapper
- **Pattern**: Convenience wrapper that orchestrates the full pipeline with a unified interface.
- **Features**:
  - Runs full pipeline by default (FQS → ABC notation)
  - Supports stopping at intermediate stages for debugging (`--stop=STAGE`)
  - Provides help documentation (`-h` option) showing all pipeline components
  - Accepts input from file or stdin
  - Proper error handling with exit codes
- **Implementation**: Uses Node.js child processes to pipe output between stages, maintaining proper stream handling and error propagation.
- **Usage Pattern**: `node fqspipe.js [OPTIONS] [FILE]` or `node fqspipe.js < input.fqs`

## Data Flow Patterns

### Score Processing Pipeline
```
FQS Text → Parser (AST) → Layout Engine (Commands) → SVG Generation → DOM
```

### FQS-to-ABC Conversion Pipeline
```
FQS Text → fqs2ast.js (AST JSON) → ast2flat.js (TSV) → pitch-octaves.js (TSV) → map-pitches.js (TSV) → abcprep.js (TSV) → abcmeter.js (TSV) → abckeysig.js (TSV) → abcnotes.js (TSV) → abcgen.js (ABC)
```

### Tutorial Example Pipeline
```
examples.json (structured data) → tutorial.js (dynamic generation) → HTML Example Containers (4 columns) → mini-fqs & abcjs rendering
```

### fqspipe.js Pipeline Orchestration
```
Input (FQS) → Stage 1 (parse) → Stage 2 (flat) → ... → Stage N (stop point) → Output (JSON/TSV/ABC)
```

### State Management
- **Parser**: Stateless, pure function `parse(text)`.
- **Layout**: Stateful within a score (tracking pitch context, accidental state).
- **Component**: Manages its own score text and re-renders on changes.
- **Tutorial**: Loads example data once, generates example containers, initializes rendering and ABC notation for each.

### Error Handling Pattern
- **Parser Errors**: Thrown as `SyntaxError` with location info.
- **Layout Errors**: Caught and displayed as error message in component.
- **Tutorial Errors**: JSON loading errors or example generation failures logged to console with user-friendly messages.
- **User Feedback**: Error messages shown in red box within component.

## Design Patterns in Use

### 1. Custom Element Pattern
- `<mini-fqs>` extends `HTMLElement`.
- Uses Shadow DOM for style encapsulation.
- Observable attribute `score` triggers re-render.

### 2. Builder Pattern (Layout)
- Layout engine builds an array of drawing commands.
- Each command is a simple object with type and properties.

### 3. State Machine Pattern (AlterationState)
- Tracks accidentals within a measure.
- Resets at each barline.
- Combines key signature with explicit accidentals.

### 4. Strategy Pattern (Pitch Calculation)
- Different algorithms for pitch placement (LilyPond rules).
- Octave shift handling via `^` and `/` modifiers.

### 5. Observer Pattern (Tutorial)
- JavaScript observes DOM and initializes examples after load.
- Copy buttons are dynamically injected and manage their own state (for both FQS and ABC code).
- ABCjs integration waits for library load and then renders standard notation and MIDI controls.

### 6. Pipeline Pattern (FQS-to-ABC Conversion)
- Each stage performs a single transformation and passes output to next stage.
- Enables debugging by stopping at intermediate points (`--stop=STAGE`).
- Follows Unix philosophy: "Write programs that do one thing and do it well."

## Integration Patterns

### Module Dependencies
```
mini-fqs.js → parser.js, layout.js
tutorial/index.html → tutorial/js/tutorial.js, ../mini-fqs.js
fqspipe.js → fqs2ast.js, ast2flat.js, pitch-octaves.js, map-pitches.js, abcprep.js, abcmeter.js, abckeysig.js, abcnotes.js, abcgen.js
```

### Build Process
- Manual regeneration of parser.js from fqs.pegjs (when grammar changes).
- No complex build system; simple HTTP server suffices for development.

## Key Technical Decisions

### 1. PEG.js over Handwritten Parser
- **Reason**: Formal grammar specification, maintainable, good error messages.
- **Trade-off**: Larger generated parser file.

### 2. SVG over Canvas
- **Reason**: Scalable, styleable, easier debugging.
- **Trade-off**: DOM overhead for complex scores.

### 3. Vanilla JavaScript over Framework
- **Reason**: Minimal dependencies, faster load, easier integration.
- **Trade-off**: More boilerplate for component lifecycle.

### 4. Shadow DOM for Encapsulation
- **Reason**: Style isolation, predictable rendering.
- **Trade-off**: More complex styling inheritance.

## Performance Considerations

### Parsing Performance
- PEG.js parser is efficient for typical score sizes (single vocal lines).
- Parsing happens synchronously but is fast enough for interactive editing.

### Rendering Performance
- SVG rendering is acceptable for single-line scores.
- Could become slow for multi-part scores (future consideration).

### Memory Usage
- Minimal, as most data structures are temporary during rendering.
- AST and layout commands are discarded after SVG generation.

## Scalability Patterns

### Horizontal Scaling (More Features)
- Grammar extensions for new notation elements.
- Layout engine extensions for additional symbols.
- Tutorial additions for new concepts.

### Vertical Scaling (Larger Scores)
- Current design optimized for single-line scores.
- Multi-part scores would require significant architecture changes.

## Testing Patterns

### Grammar Testing
- `validate-parser.html` provides interactive testing of the parser.
- Example scores in tutorial serve as test cases.

### Integration Testing
- Manual testing by rendering example scores.
- Visual verification against expected output.

## Development Guidelines

### File Size Management
- **200-line limit**: Source files should be kept under approximately 200 lines to ensure reliable editing with the DeepSeek Chat LLM.
- **Modular decomposition**: When files approach or exceed 200 lines, split them into smaller, focused modules.
- **Logical grouping**: Split files based on functional cohesion (e.g., helper functions vs. main logic, parsing vs. processing).
- **Import/export patterns**: Use ES modules (`import`/`export`) for clean separation between modules.
- **Documentation**: Each new module should have clear JSDoc comments explaining its purpose and interface.

### Code Organization Patterns
- **Single responsibility**: Each module should have a clear, focused purpose.
- **Pure functions**: Prefer pure functions over stateful classes where possible.
- **Consistent interfaces**: Modules should expose clean, well-documented APIs.
- **Error handling**: Each module should handle its own errors or propagate them clearly.

This system patterns document captures the architectural decisions and patterns that make miniFQS work, providing a blueprint for understanding and extending the system.
