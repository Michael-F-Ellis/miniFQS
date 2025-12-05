n# Progress

## What Works

### Core Engine (Complete)
1. **Parser System**
   - FQS grammar defined and functional in `fqs.pegjs`
   - Generated `parser.js` correctly parses valid FQS syntax
   - Detailed error messages with line/column information
   - Tested via `validate-parser.html`

2. **Layout Engine**
   - `layout.js` converts AST to rendering commands
   - Handles basic pitch calculation (LilyPond rules)
   - Manages accidentals and key signatures
   - Generates SVG drawing commands

3. **Web Component**
   - `<mini-fqs>` custom element registered and functional
   - Shadow DOM encapsulation with styling
   - Responds to `score` attribute/property changes
   - Displays error messages for invalid input

4. **Pipeline Utilities** (New)
   - Created `ast2flat.js`: flattens AST into tabular TSV format for debugging and pipeline processing
   - Includes all AST information: lyrics, pitches, barlines, key signatures, subdivisions
   - Outputs 1‑based indices (block, measure, beat, subdivision) for musician‑friendly counting
   - Handles initial key signature from `block.pitches.keySignature`
   - Tested with `test_happy.fqs` and `test_dotted_rhythms.fqs`

### Tutorial System (In Progress)
1. **Framework Complete**
   - Directory structure created (`tutorial/`)
   - Main page with navigation and section structure
   - CSS styling with responsive design
   - JavaScript for interactive features

2. **JSON-Driven Example System**
   - FQS examples stored in `tutorial/examples.json`, organized by sections
   - Dynamic generation of example containers with four columns
   - Eliminates redundant HTML and centralizes example data
   - Copy-to-clipboard functionality for both FQS and ABC code

3. **Basic Examples Implemented**
   - "Basic Structure" section has working example (Happy Birthday)
   - "Simple Rhythms" section has working example (quarter, half, eighth notes)
   - Four-column layout: FQS Syntax, miniFQS Rendering, ABC Notation & Playback, ABC Code
   - Demonstrates title extraction from first non-empty line of FQS code

4. **ABC Notation Integration (Complete)**
   - Added abcjs library for rendering standard notation and MIDI playback
   - Created `abc-converter.js` to convert FQS AST to ABC notation
   - Created `abcjs-integration.js` for rendering and playback controls with robust loading (timeout, polling, CDN fallback)
   - Added ABC notation column to tutorial examples
   - Includes tempo control and progress bar for MIDI playback
   - Fixed library loading timing issue by checking for `window.abcjs.renderAbc` availability
   - **Fixed ABC octave mapping**: Corrected pitch calculation (capital C is octave below lowercase c in ABC notation)
   - **Fixed meter extraction**: Now correctly extracts meter from counter value (e.g., counter:3 -> 3/4)
   - **Fixed pickup measure handling**: "Hap.py" now correctly converts to two eighth notes (`C/2 C/2`)
   - **Fixed final measure duration**: "you - ;" now correctly converts to half note + quarter rest (`E2 z`)
   - **Fixed MIDI playback**: Updated to use `SynthController` API instead of problematic `CreateSynth` + `TimingCallbacks`
   - **Fixed CSS styling**: Using official abcjs-audio.css from CDN with correct class names

### Pipeline Utilities (New)
1. **ast2flat Utility**
   - Flattens AST into tabular TSV format for debugging and pipeline processing
   - Includes all AST information: lyrics, pitches, barlines, key signatures, subdivisions
   - Outputs 1‑based indices (block, measure, beat, subdivision) for musician‑friendly counting
   - Handles initial key signature from `block.pitches.keySignature`
   - Tested with `test_happy.fqs` and `test_dotted_rhythms.fqs`

2. **pitch-octaves Utility**
   - Pipeline stage 2: reads TSV from `ast2flat` and calculates absolute octaves for pitches
   - Uses LilyPond Rule (same as layout.js) for octave calculation
   - Employs musical octave numbering (4 = C4, middle C)
   - Handles explicit octave modifiers (`^` for up, `/` for down, combinations)
   - Maintains pitch state per block, resetting to C4 at block boundaries
   - Tested with multiple examples including octave shifts and LilyPond Rule verification
   - Integrates seamlessly: `fqs2ast.js | ast2flat.js | pitch-octaves.js`

3. **map-pitches Utility**
   - Pipeline stage 3: maps pitches to attacks in lyric rows
   - Attack detection: identifies syllables and asterisks as attacks (same logic as `abc-converter.js`)
   - Pitch consumption: each attack consumes one pitch, skipping non-pitch elements (KeySig, Barline)
   - Pitch replication: dashes (`-`) receive the same pitch information as the preceding attack (for tie/extension)
   - Cross-block handling: when a block starts with a dash, carries over pitch from previous block
   - State management: maintains last pitch per block, resetting at block boundaries and after rests (except for cross-block dashes)
   - Per-block mapping: maintains separate pitch queues for each block
   - Output format: fills existing pitch columns (`pitch_note`, `pitch_acc`, `pitch_oct`) in lyric attack rows and dash rows while preserving all original rows
   - Testing: verified with `test_happy.fqs`, `test_simple.fqs`, and `test_dotted_rhythms.fqs` (dashes correctly replicate pitch)
   - Corner case fix: handles cross-block dash extensions correctly (tested with `test_octave_reset.fqs`)
   - Integration: complete pipeline: `fqs2ast.js | ast2flat.js | pitch-octaves.js | map-pitches.js`

4. **Cross-Block Continuation Fix** (New)
   - **Problem**: When a note is extended to the next block with a dash, pitch and octave must remain the same, and LilyPond rule should continue from carried-over state
   - **Solution in pitch-octaves.js**: Detects blocks starting with dashes, carries over previous pitch state instead of resetting to C4
   - **Solution in map-pitches.js**: Carries over pitch information for dashes at block starts
   - **Testing**: Verified with `test_octave_reset.fqs`:
     - Block 3 correctly carries over c5 state, producing f5, g5, a5, b5, c6
     - Dash in block 3 correctly receives pitch c5 from block 2
   - **Result**: Both utilities now handle cross-block continuations correctly while maintaining proper reset behavior for blocks not starting with dashes

5. **abcprep Utility** (New)
   - **Pipeline stage 4**: Adds ABC header rows and columns to TSV output
   - **Minimal transformation**: Inserts 5 header rows (source='abchdr') for ABC headers: X:, T:, K:, M:, L:
   - **Column addition**: Adds two new columns 'abc0' and 'abc' at the end of all rows
   - **Default values**: X:1, K:C major, L:1/4 have defaults; T: and M: left empty for later stages
   - **Flexible placement**: Can be inserted at any pipeline position (after ast2flat.js or after map-pitches.js)
   - **Testing**: Verified with `test_simple.fqs`, `test_happy.fqs`, and `test_dotted_rhythms.fqs`
   - **Integration**: Complete pipeline: `fqs2ast.js | ast2flat.js | pitch-octaves.js | map-pitches.js | abcprep.js`

## What's Left to Build

### Tutorial Content (High Priority)
1. **Example Sections** (7 sections to populate)
   - Simple Rhythms (quarter, half, eighth notes) - *implemented*
   - Dotted Rhythms (dotted quarters, eighths)
   - Tuplets (triplets, duplets, subdivisions)
   - Partial Measures (counter lines, pickups)
   - Pitch Notation (key signatures, accidentals, coloring)
   - Advanced Features (complex rhythms, key changes)
   - Each section needs 3-5 progressive examples

2. **Educational Content**
   - Standard notation explanations for each example
   - Practice exercises with solutions
   - Common pitfalls and troubleshooting

3. **Interactive Features** (Optional)
   - Editable examples with live preview
   - Exercise validation/feedback
   - Progress tracking through tutorial

### Core Engine Enhancements (Medium Priority)
1. **Rendering Improvements**
   - Better spacing for complex rhythms
   - Enhanced accidental display and coloring
   - Optional features (dynamics, tempo markings)

2. **Error Handling**
   - More user-friendly error messages
   - Visual indicators for problem areas
   - Suggestions for fixing common errors

3. **Export Features**
   - Improved PDF generation
   - Customizable output formatting
   - Metadata inclusion (title, composer, etc.)

### Documentation (Ongoing)
1. **Memory Bank Maintenance**
   - Keep all memory bank files updated
   - Document architectural decisions
   - Track progress and learnings

2. **User Documentation**
   - Complete tutorial with all examples
   - Quick reference guide
   - FAQ section

## Current Status

### Completed (Ready for Use)
- Core parsing and rendering engine
- Web component with basic functionality
- Tutorial framework with JSON-driven example system
- Memory bank foundation
- ABC notation integration with MIDI playback
- ABC octave mapping and rhythm fixes

### In Progress (Active Development)
- Tutorial content creation (populating JSON with examples for all sections)
- Example validation and testing
- Educational material development

### Planned (Future Work)
- Generalize ABC converter algorithm (replace hardcoded solution)
- Advanced tutorial features
- Core engine enhancements
- Additional documentation

## Known Issues

### Technical Issues
1. **ABCJS Loading Timing** (Resolved)
   - Library loads but `window.abcjs.renderAbc` may not be immediately available - **fixed with polling and event system**
   - Need to ensure CDN fallback works reliably - **implemented with fallback script**

2. **Rendering Limitations**
   - Complex rhythms may have spacing issues
   - Accidentals coloring system needs verification
   - Some edge cases in pitch calculation

3. **Browser Compatibility**
   - Requires modern browsers (ES6 modules, Web Components)
   - No polyfills for older browsers
   - Mobile browser testing incomplete

4. **Performance Considerations**
   - Large scores may render slowly
   - No optimization for frequent updates

### Educational Issues
1. **Content Gaps**
   - Missing examples for advanced concepts
   - Limited practice opportunities
   - No assessment of learning outcomes

2. **User Experience**
   - Tutorial flow needs user testing
   - Example difficulty progression may need adjustment
   - Standard notation explanations may be too technical or too simple

## Evolution of Project Decisions

### Initial Phase (Foundation)
- Focused on core engine: parser, layout, rendering
- Created working web component
- Established basic examples

### Current Phase (User Education)
- Shift to tutorial development
- Emphasis on learning and adoption
- Single-source example system to reduce maintenance
- Added ABC notation with MIDI playback for audio reinforcement
- Fixed octave mapping and rhythm conversion issues

### Future Phase (Enhancement)
- Based on user feedback from tutorial
- Priority on most-requested features
- Potential expansion to multi-part scores

## Testing Status

### Core Engine Testing
- **Parser**: Manual testing via validation page
- **Layout**: Visual inspection of rendered examples
- **Component**: Basic functionality testing

### Tutorial Testing
- **Framework**: Basic navigation and features work
- **Single Example**: Basic structure example functional with ABC notation and MIDI playback
- **ABC Notation**: Happy Birthday example correctly displays and plays with proper octaves and rhythms
- **Browser Compatibility**: Limited testing on modern browsers

### User Testing Needed
- Target users (choral singers) need to try tutorial
- Feedback on educational effectiveness
- Identification of confusing or missing content

## Success Metrics Tracking

### Technical Metrics
- [x] Core engine parses and renders basic scores
- [x] Web component integrates into HTML pages
- [x] Tutorial framework with interactive features
- [x] ABC notation integration with MIDI playback
- [ ] All tutorial sections populated with examples
- [ ] User testing completed and feedback incorporated

### Educational Metrics
- [ ] Users can transcribe simple scores after tutorial
- [ ] Tutorial examples accurately reflect standard notation
- [x] PDF output works with annotation apps (via browser print)
- [ ] Users report confidence using FQS notation

## Next Steps Priority

### Immediate (This Week)
1. Generalize ABC converter algorithm (replace hardcoded Happy Birthday solution)
2. Populate remaining tutorial sections with examples
3. Test rendering of new examples

### Short Term (Next 2 Weeks)
1. Complete all tutorial section examples
2. Conduct initial user testing
3. Fix any rendering issues identified

### Medium Term (Next Month)
1. Implement user feedback from testing
2. Add interactive features if valuable
3. Consider core engine enhancements

### Long Term (Future)
1. Multi-part score support
2. Audio playback features (beyond MIDI)
3. Mobile app version

This progress document provides a snapshot of what's working, what's left to build, and the current development trajectory for miniFQS.
