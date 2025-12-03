# Project Brief: miniFQS

## Project Overview
miniFQS is a lightweight web-based system for choral part transcription using a custom text-based notation format. It enables musicians to transcribe vocal parts from standard notation into a simple text format that can be rendered visually and exported for use in annotation apps like forScore or MobileSheets.

## Core Purpose
To provide choral singers with a streamlined method for:
- Transcribing individual vocal parts from full scores
- Creating study materials for practice and performance
- Generating PDFs suitable for digital annotation
- Learning and applying FQS (Formal Query System) musical notation

## Key Features
1. **Text-Based Notation**: Custom FQS syntax for representing musical scores
2. **Web Component**: Custom HTML element `<mini-fqs>` for inline rendering
3. **PEG.js Parser**: Robust parsing of FQS syntax with error handling
4. **SVG Rendering**: Visual representation of musical notation
5. **Interactive Tutorial**: Progressive learning guide for choral singers

## Technical Architecture
- **Frontend**: Vanilla JavaScript with ES Modules
- **Parser**: PEG.js grammar (fqs.pegjs) generating parser.js
- **Layout Engine**: Custom layout.js for score visualization
- **Web Component**: CustomElement API with Shadow DOM
- **Build System**: Simple build.js for development

## Current State
### Completed Components
1. **Core Engine**: Parser, layout, and rendering system functional
2. **Web Component**: `<mini-fqs>` element with attribute binding
3. **Example Files**: index.html and validate-parser.html demonstrate usage
4. **Tutorial Framework**: Basic structure with single-source example system

### Recent Development
- Created interactive tutorial (`tutorial/` directory)
- Implemented JSON-driven example system (`tutorial/examples.json`) for centralized data management
- Added professional styling and JavaScript functionality with four-column layout (FQS Syntax, miniFQS Rendering, ABC Notation & Playback, ABC Code)
- Established memory bank documentation system

## Target Audience
- **Primary**: Experienced choral singers familiar with standard notation
- **Secondary**: Music educators and choir directors
- **Use Case**: Personal part transcription for study and performance preparation

## Learning Objectives
For users to understand:
1. FQS syntax structure (title, lyric lines, pitch lines, counters)
2. Rhythm representation (beats, tuplets, dotted rhythms)
3. Pitch notation (key signatures, accidentals, octave shifts)
4. Partial measures and counter lines
5. Exporting for PDF annotation

## Technical Dependencies
- Modern web browsers with ES Module support
- No external libraries (pure JavaScript)
- HTTP server for local development

## Development Philosophy
- **Simplicity**: Minimal dependencies, straightforward implementation
- **Accessibility**: Clear documentation, progressive learning
- **Practicality**: Focus on real-world choral transcription needs
- **Maintainability**: Clean code structure with memory bank documentation

## Success Metrics
1. Users can successfully transcribe their vocal parts
2. Tutorial provides clear translation from standard to FQS notation
3. Generated PDFs work well with annotation apps
4. System handles common choral music scenarios

## Known Limitations
- Currently focused on single-line melodies (individual vocal parts)
- Limited to Western musical notation conventions
- Browser-based only (no native mobile apps)

## Future Considerations
- Multi-part score rendering
- Audio playback of transcribed parts
- Import/export to MusicXML or other formats
- Mobile app version
- Community examples library

## Project Structure
```
miniFQS/
├── core/              # Core engine files
│   ├── fqs.pegjs     # Grammar definition
│   ├── parser.js     # Generated parser
│   ├── layout.js     # Rendering engine
│   └── mini-fqs.js   # Web component
├── tutorial/          # Learning materials
│   ├── index.html    # Main tutorial
│   ├── css/          # Styling
│   ├── js/           # Interactive features
│   └── examples/     # Progressive examples
├── examples/          # Usage examples
│   ├── index.html    # Basic demo
│   └── validate-parser.html # Parser testing
└── memory-bank/      # Project documentation
    └── projectbrief.md # This file
```

## Development Workflow
1. Edit grammar in `fqs.pegjs`
2. Regenerate parser with PEG.js
3. Test with validation examples
4. Update tutorial with new features
5. Document changes in memory bank

This brief captures the essential understanding of miniFQS as a tool for choral singers to bridge the gap between standard musical notation and practical, annotatable digital scores.
