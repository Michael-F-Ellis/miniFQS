# Browser Pipeline Design Document

## Analysis Summary

Based on examining all pipeline utilities, here's what each stage does:

### 1. **fqs2ast.js** - Parse FQS text to AST
- **Core logic**: Calls `parse()` from `parser.js` (PEG.js generated)
- **Browser compatibility**: Already works in browser (parser.js is ES module)
- **Adaptation needed**: Remove Node.js stdin/stdout, export function

### 2. **ast2flat.js** - Flatten AST to tabular format
- **Core logic**: `flattenLyrics()` and `flattenPitches()` functions
- **Output format**: TSV rows with columns: source, block, meas, beat, sub, total, type, value, dur, mod, pitch_idx, pitch_note, pitch_acc, pitch_oct
- **Browser adaptation**: Convert to return array of objects instead of TSV

### 3. **pitch-octaves.js** - Calculate absolute octaves using LilyPond Rule
- **Core logic**: `calculatePitch()` function (same as layout.js)
- **State management**: Tracks previous pitch per block, handles cross-block dashes
- **Browser adaptation**: Pure function operating on row arrays

### 4. **map-pitches.js** - Map pitch information to lyric attacks
- **Core logic**: `isAttackRow()`, `isConsumablePitch()`, pitch queue management
- **State management**: Per-block pitch queues, dash replication, cross-block pitch carryover
- **Browser adaptation**: Pure function operating on row arrays

### 5. **abcprep.js** - Add ABC header rows and columns
- **Core logic**: Adds 5 header rows (X:, T:, K:, M:, L:) and abc0/abc columns
- **Browser adaptation**: Simple array manipulation

### 6. **abcbeat.js** - Process beat duration and set L: (unit note length)
- **Core logic**: `parseBeatDuration()`, `beatDurationToL()`, directive placement
- **Browser adaptation**: Pure function operating on row arrays

### 7. **abcmeter.js** - Add meter (time signature) changes
- **Core logic**: `calculateMeasureBeats()`, `beatsToMeter()`, meter change detection
- **Complexities**: Handles compound meter (L:1/8), multi-block files
- **Browser adaptation**: Pure function, needs careful block-measure key handling

### 8. **abckeysig.js** - Add key signatures and barlines in ABC format
- **Core logic**: `convertKeySignature()`, key signature change detection
- **Browser adaptation**: Pure function with KEY_SIGNATURE_MAP

### 9. **abcnotes.js** - Convert pitch/rhythm to ABC note syntax
- **Core logic**: `processBeatGroup()`, tuplet detection, accidental mapping, pitch octave conversion
- **Complexities**: Tuplet prefixes, compound meter handling, duration calculation
- **Browser adaptation**: Most complex stage, but pure function

### 10. **abcgen.js** - Generate final ABC notation string
- **Core logic**: Concatenates headers and music body, handles block boundaries
- **Browser adaptation**: Simple string concatenation

## Row Data Structure Design

Instead of TSV strings, we'll use JavaScript objects:

```javascript
{
  source: 'lyrics' | 'pitches' | 'abchdr',
  block: number | string,
  meas: number | string,
  beat: number | string,
  sub: number | string,
  total: number | string,
  type: 'Syllable' | 'Special' | 'Pitch' | 'KeySig' | 'Barline' | 'BeatDur' | 'ABCHeader' | 'Unknown',
  value: string,
  dur: number | string,
  mod: string,
  pitch_idx: number | string,
  pitch_note: string,
  pitch_acc: string,
  pitch_oct: number | string,
  abc0: string,
  abc: string
}
```

## Pipeline API Design

### Core Pipeline Object

```javascript
const fqsPipeline = {
  // Configuration
  config: {
    debug: false,
    emitTSV: false  // Only for debugging
  },

  // Stage implementations (pure functions)
  stages: {
    parse: (fqsText) => AST,
    flat: (ast) => Row[],
    octaves: (rows) => Row[],
    map: (rows) => Row[],
    prep: (rows) => Row[],
    beat: (rows) => Row[],
    meter: (rows) => Row[],
    keysig: (rows) => Row[],
    notes: (rows) => Row[],
    generate: (rows) => string
  },

  // Helper methods
  run: (fqsText, options = {}) => {
    // Run pipeline with optional stopping point
    // options.stopAt, options.debug, etc.
  },

  // Debug utilities
  debug: {
    toTSV: (rows) => string,
    fromTSV: (tsv) => Row[],
    validate: (fqsText, expectedABC) => boolean
  },

  // Error handling
  errors: {
    format: 'command-line', // Match command-line error format
    lastError: null
  }
};
```

### Stage Function Signatures

1. **parse(fqsText: string): Object**
   - Input: FQS text string
   - Output: AST object
   - Throws: Parser errors with location info

2. **flat(ast: Object): Row[]**
   - Input: AST from parse()
   - Output: Array of row objects
   - Columns: source, block, meas, beat, sub, total, type, value, dur, mod, pitch_idx, pitch_note, pitch_acc, pitch_oct

3. **octaves(rows: Row[]): Row[]**
   - Input: Rows from flat()
   - Output: Rows with pitch_oct populated
   - Updates: pitch_oct column with absolute octave numbers

4. **map(rows: Row[]): Row[]**
   - Input: Rows from octaves()
   - Output: Rows with pitch info mapped to lyric attacks
   - Updates: pitch_note, pitch_acc, pitch_oct in lyric rows

5. **prep(rows: Row[]): Row[]**
   - Input: Rows from map()
   - Output: Rows with ABC headers and abc0/abc columns
   - Adds: 5 header rows, abc0 and abc columns

6. **beat(rows: Row[]): Row[]**
   - Input: Rows from prep()
   - Output: Rows with L: directives in abc0
   - Updates: abc0 column with [L:...] directives

7. **meter(rows: Row[]): Row[]**
   - Input: Rows from beat()
   - Output: Rows with M: directives in abc0
   - Updates: abc0 column with [M:...] directives

8. **keysig(rows: Row[]): Row[]**
   - Input: Rows from meter()
   - Output: Rows with key signatures and barlines in abc0
   - Updates: abc0 column with [K:...] and | 

9. **notes(rows: Row[]): Row[]**
   - Input: Rows from keysig()
   - Output: Rows with ABC note syntax in abc0
   - Updates: abc0 column with note strings

10. **generate(rows: Row[]): string**
    - Input: Rows from notes()
    - Output: Complete ABC notation string
    - Returns: String with headers and music body

### Error Handling Design

- Each stage throws errors with descriptive messages
- Error format matches command-line: `Error: [stage] - message`
- Pipeline.run() catches and wraps errors with stage context
- Debug mode provides detailed error info

### Performance Considerations

1. **Immutable arrays**: Each stage returns new array (simpler debugging)
2. **Optional TSV**: Only generate TSV when debug.emitTSV = true
3. **Batch processing**: Process all rows at once (not streaming)
4. **Memory usage**: Row objects are lightweight

## Implementation Strategy

### Phase 1: Create Core Stage Functions
1. Extract/rewrite each stage as pure function
2. Test each function in isolation with test suite
3. Ensure identical output to command-line version

### Phase 2: Build Pipeline Object
1. Implement stage chaining
2. Add run() method with stop-at-stage capability
3. Add debug utilities

### Phase 3: Integration Testing
1. Test against validation-suite.json
2. Verify output matches command-line exactly
3. Add browser-based test runner

## Key Technical Decisions

1. **Data immutability**: Start with new arrays, optimize later if needed
2. **Error format**: Match command-line format for consistency
3. **TSV optional**: Only emit for debugging
4. **Parser compatibility**: Use same parser.js as browser component

## Next Steps

1. Begin implementing core stage functions
2. Create test harness for each stage
3. Build pipeline integration
