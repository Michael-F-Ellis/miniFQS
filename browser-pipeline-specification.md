# Browser Pipeline Specification

## Overview
The FQS-to-ABC browser pipeline is a modular system that converts FQS (Friendly Quick Score) notation to ABC notation through a series of transformation stages. Each stage processes rows (JavaScript objects) and adds/modifies columns.

## Pipeline Stages in Order

### 1. **parse** (`browser-pipeline/stages/parse.js`)
- **Description**: Parses FQS text into an Abstract Syntax Tree (AST)
- **Input**: FQS text string
- **Output**: AST object
- **Reads columns**: None (raw text input)
- **Writes columns**: None (creates AST structure)
- **Key transformations**: Validates syntax, builds hierarchical structure

### 2. **flatten** (`browser-pipeline/stages/flatten.js`)
- **Description**: Flattens AST into tabular row format
- **Input**: AST from parse stage
- **Output**: Array of row objects
- **Reads columns**: None (reads AST structure)
- **Writes columns**: 
  - `source`: 'lyrics' or 'pitches'
  - `block`: Block number (1-based)
  - `meas`: Measure number (1-based, 0 for pickup)
  - `beat`: Beat within measure (1-based)
  - `sub`: Subdivision within beat (1-based)
  - `type`: 'Syllable', 'Special', 'Pitch', 'KeySig', 'Barline', 'BeatDur'
  - `value`: Text value or symbol
  - `dur`: Beat duration (from BeatTuple)
  - `mod`: Modifier (e.g., '^' for octave up)
  - `pitch_idx`: Index in pitch sequence
  - `pitch_note`: Pitch letter (for pitch rows)
  - `pitch_acc`: Accidental (for pitch rows)
  - `pitch_oct`: Octave shifts (for pitch rows)
- **Key transformations**: Converts hierarchical AST to flat table, separates lyrics and pitches

### 3. **octaves** (`browser-pipeline/stages/octaves.js`)
- **Description**: Calculates absolute octaves using LilyPond Rule
- **Input**: Rows from flatten stage
- **Output**: Rows with pitch_oct populated
- **Reads columns**: 
  - `source`: 'pitches'
  - `type`: 'Pitch'
  - `pitch_note`: Pitch letter
  - `pitch_oct`: Octave shifts (e.g., '^', '/')
  - `block`: For block transition logic
- **Writes columns**:
  - `pitch_oct`: Absolute octave number (4 = C4, middle C)
- **Key transformations**: Applies LilyPond Rule for octave calculation, handles cross-block dashes

### 4. **alterations** (`browser-pipeline/stages/alterations.js`) *NEW STAGE*
- **Description**: Calculates pitch alterations as integers (-2, -1, 0, 1, 2) based on precedence rules
- **Input**: Rows from octaves stage
- **Output**: Rows with pitch_alt populated
- **Reads columns**:
  - `source`: 'pitches' and 'lyrics'
  - `type`: 'Pitch', 'KeySig', 'Barline'
  - `value`: Key signature string (e.g., 'K#4', 'K&3', 'K0')
  - `pitch_note`: Pitch letter
  - `pitch_acc`: Explicit accidental ('#', '##', '&', '&&', '%', '')
  - `pitch_oct`: Absolute octave
  - `block`, `meas`: For measure-level alteration tracking
- **Writes columns**:
  - `pitch_alt`: Integer alteration (-2, -1, 0, 1, 2)
- **Key transformations**: Implements precedence: explicit accidental → measure accidental → key signature, tracks alterations per measure, resets at barlines and key signature changes

### 5. **map** (`browser-pipeline/stages/map.js`)
- **Description**: Maps pitch information to lyric attacks and dashes
- **Input**: Rows from octaves stage
- **Output**: Rows with pitch info in lyric rows
- **Reads columns**:
  - `source`: 'lyrics' and 'pitches'
  - `type`: 'Pitch', 'Syllable', 'Special'
  - `value`: '*' (attack), '-' (dash), ';' (rest)
  - `block`: For pitch queue per block
  - `pitch_note`, `pitch_acc`, `pitch_oct`: From pitch rows
- **Writes columns** (in lyric rows):
  - `pitch_note`: Pitch letter (copied from pitch row)
  - `pitch_acc`: Accidental (copied from pitch row)
  - `pitch_oct`: Absolute octave (copied from pitch row)
- **Key transformations**: Consumes pitches for attacks, replicates pitches for dashes, handles cross-block continuations

### 6. **layout** (`browser-pipeline/stages/layout.js`) *NEW STAGE*
- **Description**: Calculates X positions for rendering (Y positions deferred to renderer)
- **Input**: Rows from map stage
- **Output**: Rows with x column added
- **Reads columns**:
  - `source`: 'lyrics'
  - `block`, `meas`, `beat`, `sub`: For positioning
  - `type`, `value`: For character width calculation
  - `pitch_note`, `pitch_acc`, `pitch_oct`: For potential future Y calculation
- **Writes columns**:
  - `x`: Horizontal position (in monospace character widths, 1 = one character width)
  - (Optional: `y`, `staff_y`, `color` for future renderer integration)
- **Key transformations**: Calculates character positions based on beat structure and layout rules

### 7. **prep** (`browser-pipeline/stages/prep.js`)
- **Description**: Adds ABC header rows and abc0/abc columns
- **Input**: Rows from layout stage
- **Output**: Rows with ABC headers and empty abc0/abc columns
- **Reads columns**: None (structural transformation)
- **Writes columns**:
  - `abc0`: ABC notation string (initially empty)
  - `abc`: Alternative ABC string (initially empty)
  - Adds 5 header rows with source='abchdr', type='ABCHeader'
- **Key transformations**: Inserts ABC headers (X:, T:, K:, M:, L:), adds abc0/abc columns

### 8. **beat** (`browser-pipeline/stages/beat.js`)
- **Description**: Processes beat duration and sets L: (unit note length)
- **Input**: Rows from prep stage
- **Output**: Rows with L: directives in abc0
- **Reads columns**:
  - `type`: 'BeatDur'
  - `value`: '[4.]' or '[4]' beat duration
  - `block`, `meas`: For directive placement
- **Writes columns**:
  - `abc0`: Adds [L:...] directives for unit note length changes
- **Key transformations**: Converts FQS beat duration to ABC L: directive, places directives at measure starts

### 9. **meter** (`browser-pipeline/stages/meter.js`)
- **Description**: Adds meter (time signature) changes
- **Input**: Rows from beat stage
- **Output**: Rows with M: directives in abc0
- **Reads columns**:
  - `block`, `meas`, `beat`: For beat counting
  - `dur`: Beat duration for measure calculation
  - `type`: 'BeatDur' for unit note length detection
- **Writes columns**:
  - `abc0`: Adds [M:...] directives for meter changes
- **Key transformations**: Calculates beats per measure, detects meter changes, places M: directives

### 10. **keysig** (`browser-pipeline/stages/keysig.js`)
- **Description**: Adds key signatures and barlines in ABC format
- **Input**: Rows from meter stage
- **Output**: Rows with key signatures and barlines in abc0
- **Reads columns**:
  - `type`: 'KeySig' (from pitch rows)
  - `value`: 'K#6', 'K&3', 'K0', etc.
  - `source`: 'lyrics' for barline placement
- **Writes columns**:
  - `abc0`: Adds [K:...] for key signature changes, '|' for barlines
- **Key transformations**: Converts FQS key signatures to ABC format, places inline key signatures at measure boundaries

### 11. **notes** (`browser-pipeline/stages/notes.js`)
- **Description**: Converts pitch/rhythm to ABC note syntax
- **Input**: Rows from keysig stage
- **Output**: Rows with ABC note strings in abc0
- **Reads columns**:
  - `block`, `meas`, `beat`, `sub`: For beat grouping
  - `type`, `value`: For attack/rest/dash detection
  - `pitch_note`, `pitch_acc`, `pitch_oct`: For pitch conversion
  - `dur`: Beat duration
  - `abc0`: Existing directives (L:, M:, K:)
- **Writes columns**:
  - `abc0`: Adds ABC note strings (e.g., 'C', '^C/2', '(3C/2D/2E/2')
- **Key transformations**: Groups subdivisions into beats, creates tuplets, maps accidentals, converts pitches to ABC notation

### 12. **optimize** (`browser-pipeline/stages/optimize.js`)
- **Description**: Optimizes tied notes to dotted notes where possible
- **Input**: Rows from notes stage
- **Output**: Rows with optimized ABC notation in abc0
- **Reads columns**:
  - `abc0`: ABC note strings
  - `block`, `meas`, `beat`: For beat group analysis
- **Writes columns**:
  - `abc0`: Replaces tied sequences with dotted notes (e.g., 'C -C' → 'C2')
- **Key transformations**: Applies heuristics to convert tied quarter notes to dotted notes

### 13. **generate** (`browser-pipeline/stages/generate.js`)
- **Description**: Generates final ABC notation string from rows
- **Input**: Rows from optimize stage
- **Output**: Complete ABC notation string
- **Reads columns**:
  - `source`: 'abchdr' for headers, 'lyrics' for music body
  - `value`: Header flags (X:, T:, K:, M:, L:)
  - `abc0`: Header values and note strings
- **Writes columns**: None (returns string)
- **Key transformations**: Concatenates headers and music body, adds newlines at block boundaries, formats final ABC output

## Column Reference

### Core Columns (present from flatten stage):
- `source`: 'lyrics', 'pitches', 'abchdr'
- `block`: Block number (1-based)
- `meas`: Measure number (1-based, 0 for pickup)
- `beat`: Beat within measure (1-based)
- `sub`: Subdivision within beat (1-based)
- `type`: 'Syllable', 'Special', 'Pitch', 'KeySig', 'Barline', 'BeatDur', 'ABCHeader'
- `value`: Text value or symbol
- `dur`: Beat duration (from BeatTuple)
- `mod`: Modifier

### Pitch Columns (added/modified by various stages):
- `pitch_idx`: Index in pitch sequence (flatten)
- `pitch_note`: Pitch letter (flatten → map)
- `pitch_acc`: Accidental (flatten → map)
- `pitch_oct`: Octave shifts → absolute octave (flatten → octaves → map)
- `pitch_alt`: Integer alteration (-2, -1, 0, 1, 2) (alterations → map)

### Layout Columns (added by layout stage):
- `x`: Horizontal position (in monospace character widths)
- (Future: `y`, `staff_y`, `color`)

### ABC Columns (added by prep stage and modified by later stages):
- `abc0`: Primary ABC notation string (notes, directives, barlines)
- `abc`: Alternative ABC string (currently unused)

## Data Flow

```
FQS Text
    ↓ parse
AST
    ↓ flatten
Rows [source, block, meas, beat, sub, type, value, dur, mod, pitch_*]
    ↓ octaves
Rows [pitch_oct updated]
    ↓ alterations
Rows [pitch_alt added]
    ↓ map
Rows [pitch_* copied to lyric rows]
    ↓ layout
Rows [x added]
    ↓ prep
Rows [abc0, abc columns added + header rows]
    ↓ beat
Rows [abc0: L: directives added]
    ↓ meter
Rows [abc0: M: directives added]
    ↓ keysig
Rows [abc0: K: directives and barlines added]
    ↓ notes
Rows [abc0: ABC note strings added]
    ↓ optimize
Rows [abc0: tied notes optimized to dotted notes]
    ↓ generate
ABC Notation String
```

## State Management

Several stages maintain state across rows:
- **octaves**: Tracks previous pitch for LilyPond Rule, handles block transitions
- **map**: Maintains pitch queue per block, tracks last pitch for dash replication
- **meter**: Tracks beats per measure across blocks
- **notes**: Tracks current unit note length (L:) across beats

## Error Handling

Each stage throws errors with descriptive messages. The main `fqsToABC()` function catches errors and returns a result object with `success: false` and `error` message.

## Testing

The pipeline is validated against `validation-suite.json` which contains test cases with FQS input and expected ABC output. All tests must pass after any pipeline changes.

## Future Extensions

1. **Y position calculation**: Could be added to layout stage or deferred to renderer
2. **Color coding**: For accidentals (red sharps, blue flats) in visualization
3. **Additional layout columns**: `staff_y`, `glyph`, `accidental_x_offset`
4. **Render command generation**: Alternative output format for SVG rendering
