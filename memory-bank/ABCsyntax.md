Here is a concise, authoritative description of the ABC notation syntax for notes in a single-part melody, based on the ABC Standard v2.1.

This document is formatted for use in an AI context (e.g., as a system prompt or context file) to guide the translation of other formats into valid ABC.

***

# ABC Notation Note Syntax (Single Part)

This document describes the syntax for representing notes, pitches, lengths, and groupings in a single-part melody using the **ABC Music Notation Standard v2.1**.

## 1. Pitch
Pitch is represented by a letter `A` through `G`, optionally modified by octave indicators and accidentals.

### Base Octaves
ABC is case-sensitive. The two base octaves are:
*   **Lower Octave:** Capital letters `C` through `B` (typically ranges from C3 to B3).
*   **Upper Octave:** Lowercase letters `c` through `b` (typically ranges from C4/Middle C to B4).

| ABC       | C    | D    | E    | F    | G    | A    | B    | c      | d    | e    | f    | g    | a    | b    |
| :-------- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :----- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Pitch** | C3   | D3   | E3   | F3   | G3   | A3   | B3   | **C4** | D4   | E4   | F4   | G4   | A4   | B4   |

### Octave Modifiers
To reach higher or lower octaves, append marks **after** the note letter:
*   `'` (apostrophe): Raises pitch by one octave. (e.g., `c'` is C5).
*   `,` (comma): Lowers pitch by one octave. (e.g., `C,` is C2).
*   **Stacking:** Modifiers can be stacked. `c''` is C6; `C,,` is C1.

### Accidentals
Accidentals are placed **immediately before** the note letter.
*   `^` : Sharp (♯)
*   `_` : Flat (♭)
*   `=` : Natural (♮) — *forces a natural, overriding key signature*
*   `^^` : Double Sharp (𝄪)
*   `__` : Double Flat (𝄫)

**Example:** `^C` (C#3), `_d'` (Db5), `=B` (B natural).

---

## 2. Note Length (Duration)
Note duration is relative to the **unit note length** defined in the header by the `L:` field (e.g., `L:1/8`).

### Multipliers
Append a number **after** the note (and octave modifiers) to multiply its length.
*   `C` : 1 × unit length.
*   `C2` : 2 × unit length.
*   `C3` : 3 × unit length.
*   `C4` : 4 × unit length.

### Dividers
Append a slash `/` **after** the note to divide its length.
*   `C/` or `C/2` : ½ × unit length.
*   `C/4` or `C//` : ¼ × unit length.
*   `C3/4` : ¾ × unit length (dotted note).

### Broken Rhythm
Used to represent dotted pairs (long-short or short-long).
*   `A > B` : `A3/2 B1/2` (dotted A, short B).
*   `A < B` : `A1/2 B3/2` (short A, dotted B).
*   `>>` : Double dotted (7/4 length followed by 1/4 length).

---

## 3. Rests and Spacing
*   `z` : A rest. It follows the same duration rules as notes (e.g., `z4`, `z/2`).
*   `x` : An "invisible" rest (holds time but draws nothing).
*   `Z` : Multi-measure rest (e.g., `Z4` rests for 4 measures).

---

## 4. Grouping and Beaming
*   **Beaming:** Notes written effectively without spaces are beamed together.
    *   `ABC` : Three notes beamed together.
*   **Breaking Beams:** A space between notes breaks the beam.
    *   `A B C` : Three separate (unbeamed) notes.

---

## 5. Ties and Slurs
*   **Tie:** A hyphen `-` placed **immediately after** a note connects it to the next note of the same pitch.
    *   `c2- c` : A half note tied to a quarter note (assuming L:1/4).
*   **Slur:** Parentheses `( ... )` enclose the notes to be slurred.
    *   `(ABC)` : Slur over three notes.
    *   `(` and `)` must be placed adjacent to the first and last notes respectively.

---

## 6. Tuplets
Tuplets are denoted by `(p` put before a group of `p` notes.
*   `(3` : Triplet (put 3 notes into the time of 2).
    *   Example: `(3ABC`
*   **General Syntax:** `(p:q:r` means "put `p` notes into the time of `q` for the next `r` notes".

---

## 7. Chords and Unisons
Although for a single melody line, chords (double stops) are written by enclosing notes in brackets `[...]`.
*   `[CE]` : C and E played simultaneously.
*   Duration modifiers affect the whole chord if placed outside: `[CE]2`.

---

## 8. Grace Notes
Grace notes are enclosed in curly braces `{...}` immediately before the main note.
*   `{G}A` : A single G grace note leading into A.
*   `{^c}d` : A C-sharp grace note leading into D.

---

## 9. Decorations (Ornaments)
Standard decorations are indicated by symbols or the `!...!` syntax placed before the note.
*   `.` : Staccato (e.g., `.C`)
*   `~` : Irish Roll (e.g., `~C`)
*   `H` : Fermata (e.g., `HC`)
*   `L` : Accent/Emphasis (e.g., `LC`)
*   **v2.1 Standard:** `!trill!`, `!fermata!`, `!mordent!` (e.g., `!trill!c`).

---

## 10. Summary of Order
The strict order of symbols for a single note event is:
1.  **Grace Notes** (`{...}`)
2.  **Decorations** (`.` or `!...!`)
3.  **Accidental** (`^`, `_`, `=`)
4.  **Note Pitch** (`A-G`, `a-g`)
5.  **Octave Modifier** (`'`, `,`)
6.  **Duration** (`2`, `/2`)
7.  **Tie** (`-`)

**Example:** `!trill!{g}^c'3/2-`
*   Trill decoration (`!trill!`)
*   Grace note (`{g}`)
*   Sharp accidental (`^`)
*   Pitch C (`c`)
*   Octave up (`'`)
*   Dotted duration (`3/2`)
*   Tie (`-`)
  

Here is the additional section on changing meter within a measure, formatted to match the previous document.

***

## 11. Inline Meter Changes
To change the time signature (meter) within the body of a tune, use the `M:` field enclosed in square brackets `[...]`.

*   **Syntax:** `[M:meter]` placed immediately before the notes it affects.
*   **Placement:** This tag can be placed anywhere in the line. It is most commonly placed immediately after a bar line.
*   **Examples:**
    *   `[M:2/4]` : Switch to 2/4 time.
    *   `[M:C|]` : Switch to Cut time (2/2).
    *   `[M:9/8]` : Switch to 9/8 compound time.

**Example usage:**
`c2 d2 | [M:3/4] e2 d2 c2 | [M:4/4] G4`
*(Two beats of 4/4 [implied], switch to 3/4 for one measure, switch back to 4/4).*

Here is the additional section on pickup notes (anacrusis).

***

## 12. Pickup Notes (Anacrusis)
Pickup notes are handled implicitly by writing a partial measure at the very beginning of the tune body.

*   **Syntax:** Write the pickup note(s) immediately after the header, **before** the first bar line `|`.
*   **No Special Tag:** There is no specific command to declare a pickup; ABC software automatically identifies it because the duration is less than a full measure (as defined by `M:`).
*   **Ending:** It is standard musical practice (though not strictly enforced by all ABC parsers) to shorten the final measure of the piece so that the pickup + final measure equals one full measure.

**Example:**
`M:4/4`
`L:1/4`
`D | G2 G2 A2 A2 | B4 z2`
*   The initial `D` is a one-beat pickup.
*   The first **full** measure begins after the first `|`.
*   (Optional but recommended: The final measure contains only 3 beats to balance the pickup).