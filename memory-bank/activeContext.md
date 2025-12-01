# Active Context

## Current Focus
The primary focus is on **tutorial development and user education**. The core miniFQS engine is functional, and current efforts are directed toward creating an effective learning resource for choral singers to understand and use the FQS notation system.

## Recent Changes (Last Development Cycle)

### 1. Tutorial System Implementation
- **Created directory structure**: `tutorial/` with subdirectories for CSS, JS, examples, and assets.
- **Built main tutorial page**: `tutorial/index.html` with navigation, introduction, and section placeholders.
- **Implemented single-source example system**: FQS code stored in `data-fqs-code` attributes, dynamically populated to both code display and rendering elements.
- **Added interactive features**: Copy buttons, smooth scrolling, active navigation highlighting, keyboard navigation.

### 2. ABC Notation Integration
- **Integrated abcjs library**: Added abcjs-basic-min.js for rendering standard notation and MIDI playback.
- **Created ABC converter**: `abc-converter.js` converts FQS AST to ABC notation.
- **Built robust loading system**: `abcjs-integration.js` handles library loading with timeout, polling, and CDN fallback.
- **Enhanced error handling**: Improved error messages and debugging for abcjs loading issues.
- **Fixed library loading**: Resolved timing issues where the library loaded but the `renderAbc` method wasn't immediately available.

### 3. Technical Improvements
- **Refactored example synchronization**: Eliminated redundant FQS code duplication by using data attributes and JavaScript initialization.
- **Enhanced styling**: Professional CSS with responsive design, print-friendly styles for PDF generation.
- **Added JavaScript functionality**: Tutorial-specific features while maintaining separation from core engine.

### 4. Documentation
- **Established memory bank**: Created initial project brief and supporting context documents.
- **Updated project structure**: Documented current state and future directions.

## Active Decisions and Considerations

### 1. Tutorial Pedagogy
- **Progressive learning**: Starting with basic structure, moving to simple rhythms, dotted rhythms, tuplets, partial measures, pitch notation, and advanced features.
- **Audience focus**: Experienced choral singers who read standard notation, emphasizing translation between systems.
- **Example format**: Three-column layout (FQS syntax, miniFQS rendering, standard notation explanation).

### 2. Technical Architecture
- **Single-source examples**: Using `data-fqs-code` attributes to maintain consistency between code display and rendering.
- **Zero dependencies**: Tutorial uses vanilla JavaScript, no frameworks or libraries.
- **Print optimization**: CSS media queries for clean PDF output suitable for annotation apps.

### 3. Development Workflow
- **Iterative development**: Building tutorial framework first, then adding progressive examples.
- **User feedback loop**: Planning to test tutorial with target users (choral singers) for clarity and effectiveness.
- **Documentation同步**: Keeping memory bank updated as tutorial evolves.

## Next Immediate Steps

### 1. Populate Tutorial Examples
- Add concrete examples for each tutorial section (basic structure through advanced features).
- Ensure examples demonstrate key concepts with clear standard notation translations.
- Test each example for accurate rendering and educational value.

### 2. Enhance Tutorial Features
- Consider adding interactive editing: Allow users to modify FQS code and see real-time updates.
- Add exercise sections: Provide practice opportunities with feedback.
- Improve mobile responsiveness: Ensure tutorial works well on tablets (common for music annotation).

### 3. Testing and Validation
- User testing: Have choral singers work through the tutorial and provide feedback.
- Rendering validation: Verify all examples render correctly across target browsers.
- PDF output testing: Ensure printed/saved PDFs work well with forScore, MobileSheets, etc.

## Active Challenges

### 1. Educational Effectiveness
- Ensuring the tutorial effectively teaches FQS syntax to musicians familiar with standard notation.
- Balancing simplicity with completeness: Covering enough to be useful without overwhelming.
- Providing adequate practice and reinforcement.

### 2. Technical Integration
- Maintaining synchronization between example code and rendering as tutorial expands.
- Ensuring the tutorial remains fast and responsive as more examples are added.
- Supporting both learning and reference use cases.

### 3. Content Creation
- Creating musically meaningful examples that demonstrate real-world usage.
- Providing accurate standard notation equivalents for each example.
- Sequencing examples in a pedagogically sound progression.

## Important Patterns and Preferences

### 1. Development Patterns
- **Data-driven design**: Store example content in HTML attributes, render with JavaScript.
- **Progressive enhancement**: Core content works without JavaScript, enhanced with interactivity.
- **Style encapsulation**: Tutorial styles don't interfere with mini-fqs component styles.

### 2. Project Preferences
- **Minimalism**: Avoid feature creep; focus on core transcription use case.
- **Quality over quantity**: Fewer, well-explained examples are better than many confusing ones.
- **User-centered design**: Prioritize the choral singer's workflow and needs.

### 3. Documentation Standards
- **Memory bank discipline**: Update documentation with each significant change.
- **Clear examples**: Each tutorial example should have a specific learning objective.
- **Consistent formatting**: Maintain consistent structure across all tutorial sections.

## Learnings and Project Insights

### 1. User Needs
- Choral singers value quick transcription over full-score notation features.
- PDF compatibility with annotation apps is a critical requirement.
- Musicians appreciate seeing the relationship between text notation and standard notation.

### 2. Technical Insights
- PEG.js provides excellent error messages for syntax learning.
- SVG rendering is sufficient for single-line scores and offers styling flexibility.
- Web Components work well for encapsulating musical notation rendering.

### 3. Educational Insights
- Side-by-side comparison (FQS, rendering, standard notation) is effective for translation.
- Progressive examples build confidence and understanding.
- Copy functionality encourages experimentation with the notation.

## Dependencies and Blockers

### 1. Content Creation
- Need to create musically appropriate examples for each tutorial section.
- Require verification of standard notation equivalents for accuracy.
- May benefit from input from music educators on pedagogical approach.

### 2. Technical Dependencies
- None external; all tools and libraries are already in place.
- Browser compatibility is a consideration for tutorial delivery.

### 3. Resource Constraints
- Time for creating comprehensive example content.
- Access to target users for testing and feedback.

This active context captures the current state of development, guiding decisions and priorities for the ongoing tutorial implementation.
