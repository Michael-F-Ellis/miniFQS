

***

### Context Summary: miniFQS Project

**Project Name:** miniFQS
**Goal:** A web-based text-to-music renderer for single line  notationn with melody and lyrics (FQS format).
**Architecture:** Single Page Application using a custom Web Component, a PeggyJS parser, and a dedicated Layout Engine (ES Modules).

#### 1. Language Specification (FQS)
*   **Structure:** Title -> Blocks. Blocks consist of `LyricLine` (Rhythm) and `PitchLine` (Melody/Key).
*   **Grid Logic:** 1-to-1 mapping between Articulation Events in Lyrics and Pitch Elements.
*   **Key Syntax:**
    *   **Lyrics:** Text (syllables), `.` (subdivision), `*` (melisma), `;` (rest), `-` (hold).
    *   **Pitches:** `[a-g]`, Accidentals (`#`, `&`, `##`, `&&`, `%`), Octave Shifts (`^` up, `/` down).
    *   **Constraint:** Music lines must end with a barline `|`.
*   **Rendering Theory:**
    *   **Pitch Placement:** Chromatic vertical spacing (SVG), not diatonic.
    *   **Octaves:** Calculated automatically via the "LilyPond Rule" (closest interval < 4th) relative to the previous note, unless explicit `^`/`/` modifiers are used.
    *   **Colors:** Sharps (Red), Flats (Blue), Naturals (Black), DblSharps (Orange), DblFlats (Green).

#### 2. Architecture & Modules
*   **`fqs.pegjs` (Grammar):**
    *   Compiles via `build.js` to `parser.js` (ES Module).
    *   Enforces strict barlines at end of lines.
    *   Parses Lyrics into BeatTuples and Pitches into PitchElements.
*   **`layout.js` (Engine):**
    *   Input: AST. Output: JSON Render Commands + Dimensions (`width`, `height`).
    *   Logic: Flattens timeline. Assigns pitches **only** to Attacks (Syllables/Melismas), skipping Rests/Holds.
    *   Scaling: Tracks `maxScoreWidth` to support auto-scaling viewboxes.
    *   Staff: 3-line grid (Octaves +1, 0, -1).
*   **`mini-fqs.js` (Web Component):**
    *   Tag: `<mini-fqs>`.
    *   Shadow DOM: Isolated styles. Enforces `Courier New` to match layout metrics.
    *   Logic: Handles property shadowing (race conditions on load). Renders SVG based on Layout commands.
*   **`index.html` (App):**
    *   Split-view Editor (Textarea + Component).
    *   File I/O (Open/Save `.mfqs`).
    *   Print Styles (Hides editor/toolbar, full-width score).

#### 3. Current Status & Constraints
*   **Status:** Functional v1.0. Renders correctly, auto-scales width, centers titles, handles multi-block scores.
*   **Constraint:** `layout.js` assumes a specific font width (12px) for calculations.
*   **Constraint:** The Parser requires strict matching of Lyric Event Count vs Pitch Count.

***

**Instruction for next session:**
We are continuing development on miniFQS. Above is the project context. Below are the current source files: (`fqs.pegjs`, `build.js`, `layout.js`, `mini-fqs.js`, and `index.html`). Please ingest this state.

I've found it productive to ask you to paraphrase my prompts in the manner of a skilled human listener and ask clarifying questions as needed. Please do this throughout the chat before generating code. 