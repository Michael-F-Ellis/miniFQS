// layout.js

// ---------------------------------------------------------
// CONSTANTS & LOOKUP TABLES
// ---------------------------------------------------------

// Vertical Offsets for specific Pitch/Accidental combos (From FQS Pitch.js)
const V_OFFSETS = {
    "𝄪a": 1, "♮b": 1, "♭c": 13,
    "♯a": 2, "♭b": 2, "𝄫c": 14,
    "𝄪g": 3, "♮a": 3, "𝄫b": 3,
    "♯g": 4, "♭a": 4,
    "𝄪f": 5.6, "♮g": 5, "𝄫a": 5,
    "𝄪e": 6, "♯f": 6.6, "♭g": 6,
    "♯e": 7, "♮f": 7.6, "𝄫g": 7,
    "𝄪d": 8, "♮e": 8, "♭f": 8.6,
    "♯d": 9, "♭e": 9, "𝄫f": 9.6,
    "𝄪c": 10, "♮d": 10, "𝄫e": 10,
    "𝄪b": -1, "♯c": 11, "♭d": 11,
    "♯b": 0, "♮c": 12, "𝄫d": 12,
};

// Map letter to numeric index for LilyPond Rule
const PITCH_INDEX = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };

// Standard Key Signature Definition (Sharps/Flats order)
const SHARPS_ORDER = ['f', 'c', 'g', 'd', 'a', 'e', 'b'];
const FLATS_ORDER = ['b', 'e', 'a', 'd', 'g', 'c', 'f'];

// ---------------------------------------------------------
// HELPER CLASSES
// ---------------------------------------------------------

class AlterationState {
    constructor(keySig) {
        this.keySig = keySig || { accidental: null, count: 0 };
        this.measures = {}; // reset per measure
        this.currentMeasure = {};
    }

    resetMeasure() {
        this.currentMeasure = {};
    }

    // Determine the effective accidental for a note in a specific octave
    getAccidental(letter, octave, explicitAcc) {
        const id = `${letter}${octave}`;

        // 1. Explicit accidental overrides everything and sticks for the measure
        if (explicitAcc) {
            this.currentMeasure[id] = explicitAcc;
            return explicitAcc;
        }

        // 2. Check if this note was modified previously in this measure
        if (this.currentMeasure[id]) {
            return this.currentMeasure[id];
        }

        // 3. Fallback to Key Signature
        // Check if letter is in the active set of sharps/flats
        if (this.keySig.accidental === '#') {
            const affected = SHARPS_ORDER.slice(0, this.keySig.count);
            if (affected.includes(letter)) return '#';
        } else if (this.keySig.accidental === '&') {
            const affected = FLATS_ORDER.slice(0, this.keySig.count);
            if (affected.includes(letter)) return '&';
        }

        // 4. Natural by default
        return '%';
    }
}

// ---------------------------------------------------------
// MAIN LAYOUT FUNCTION
// ---------------------------------------------------------

// Globals for simple visualization
const CONFIG = {
    fontWidth: 12,
    fontHeight: 20,
    octaveHeight: 20 * 3.5, // Space between octave lines
    baseY: 100 // Top margin
};

function layoutScore(ast) {
    const renderCommands = [];
    let currentY = CONFIG.baseY;

    if (ast.blocks) {
        ast.blocks.forEach(block => {
            const blockRender = layoutBlock(block, currentY);
            renderCommands.push(...blockRender.commands);
            currentY += blockRender.height + 50; // Padding between blocks
        });
    }

    // Return both the commands AND the final calculated height
    return {
        commands: renderCommands,
        height: currentY + 50 // Add a little bottom padding
    };
}

function layoutBlock(block, startY) {
    const commands = [];

    // -- 1. Setup Grid & State --
    const fontW = CONFIG.fontWidth;
    const fontH = CONFIG.fontHeight;

    // We need to flatten the lyric line to get X-coordinates
    // AND consume the pitch line simultaneously.

    // Prepare Pitch Queue
    const pitchElements = flattenPitchLine(block.pitches);
    let pitchIdx = 0;

    // State for Pitch Logic
    let prevPitch = { letter: 'c', octave: 0 }; // Default start
    const alterations = new AlterationState(block.pitches.keySignature);

    // State for Counter
    let counterVal = 1;
    if (block.counter) counterVal = block.counter.value;

    // State for Rendering
    let currentX = 50; // Left Margin
    const rowPitchY = startY;
    const rowLyricY = startY + (fontH * 4); // Room for 3 staff lines
    const rowCounterY = rowLyricY + fontH + 5;

    // Draw Staff Lines (Reference Octaves 1, 0, -1)
    // Center Line is Octave 0 G. 
    // Y coords generally go Down as value increases, but SVG Y goes Down.
    // Let's align rowPitchY to roughly the top of the drawing area.

    // Reference Lines: G+12 (Octave 1), G (Octave 0), G-12 (Octave -1)
    // We'll draw 3 grey lines.
    const centerLineY = rowPitchY + (fontH * 2); // Arbitrary center
    [-1, 0, 1].forEach(offset => {
        // Simple visual reference lines
        // Note: FQS uses svg lines. We will just emit line commands
        const y = centerLineY - (offset * fontH);
        commands.push({
            type: 'line', x1: 50, y1: y, x2: 1000, y2: y, stroke: '#eee' // Placeholder width
        });
    });

    // -- 2. Traverse Lyrics --
    const items = block.lyrics; // This is the array of BeatTuples or Barlines

    items.forEach(item => {

        // --- HANDLE BARLINE ---
        if (item.type === 'Barline') {
            // Draw Barline
            commands.push({
                type: 'line',
                x1: currentX + (fontW / 2), y1: rowPitchY - fontH,
                x2: currentX + (fontW / 2), y2: rowCounterY,
                stroke: '#ccc'
            });

            // Handle Pitch Logic for Barline
            // Consume a pitch element if it is a barline
            if (pitchElements[pitchIdx] && pitchElements[pitchIdx].type === 'Barline') {
                pitchIdx++;
            }

            // Reset Counter & Accidentals
            counterVal = 1;
            alterations.resetMeasure();

            currentX += fontW; // Space for barline
            return;
        }

        // --- HANDLE BEAT TUPLE ---
        if (item.type === 'BeatTuple') {
            const startX = currentX;
            const content = item.content; // Array of TextSegment or Special
            const duration = item.duration; // e.g., 2 for "2word"

            // 1. Calculate Width of this beat
            // Every character in content counts as 1 font-width.
            let charCount = 0;
            const charPositions = []; // Store relative index for counter placement

            content.forEach(segment => {
                const text = segment.value;
                for (let i = 0; i < text.length; i++) {
                    charPositions.push(currentX + (i * fontW));
                }
                charCount += text.length;
                currentX += (text.length * fontW);
            });

            // Add spacing after beat
            currentX += fontW;

            // 2. Render Counter (Linear Interpolation for Multi-beat)
            // If duration is 1, just draw '1' at start.
            // If duration is 2, draw '1' at start, '2' halfway through.
            const totalPixelWidth = charCount * fontW;

            for (let b = 0; b < duration; b++) {
                // Where does beat (b) fall?
                // Fraction = b / duration
                // Pixel Offset = Fraction * totalPixelWidth
                const beatX = startX + ((b / duration) * totalPixelWidth);

                // Adjustment: Center the number under the character slot
                const centeredX = beatX + (fontW / 2) - (fontW / 4); // rough visual tweak

                commands.push({
                    type: 'text',
                    x: centeredX,
                    y: rowCounterY,
                    text: (counterVal + b).toString(),
                    color: '#999',
                    font: 'italic 10px sans-serif'
                });
            }
            counterVal += duration;

            // 3. Render Lyric & Pitch Characters
            let localCharIdx = 0;

            content.forEach(segment => {
                const str = segment.value;

                // --- LYRIC RENDERING (Iterate chars) ---
                for (let i = 0; i < str.length; i++) {
                    const char = str[i];
                    const charX = startX + (localCharIdx * fontW);

                    let lyricColor = 'black';
                    // FQS Logic: Specials are Grey unless they are the start of a beat.
                    // Since 'segment' is inside a tuple, and we are iterating segments:
                    // Only the very first character of the very first segment in a BeatTuple 
                    // is strictly the "Start of the Beat".
                    // However, simplified logic: Text is Black. Specials are Grey unless index 0 of the tuple.

                    // Note: We don't have the global tuple index here easily, but we know 
                    // if it's the first segment of the content array?
                    // Let's stick to the previous simple logic for now:
                    if (segment.type === 'Special') {
                        // If it's the first char of the beat (startX), it's black?
                        // localCharIdx 0 relative to this tuple means start of beat.
                        if (localCharIdx === 0) lyricColor = 'black';
                        else lyricColor = '#ccc';
                    } else {
                        lyricColor = 'black';
                    }

                    commands.push({
                        type: 'text',
                        x: charX,
                        y: rowLyricY,
                        text: char,
                        color: lyricColor,
                        font: '16px monospace'
                    });
                    localCharIdx++;
                }

                // --- PITCH RENDERING (Per Segment) ---
                // FIX: Only assign pitches to ATTACKS.
                // Attacks are: Syllables (Text) or Melismas (*).
                // Rests (;), Holds (-), and Double-holds (=) do NOT consume a pitch.

                const isAttack = (segment.type === 'Syllable') || (segment.value === '*');

                // Calculate the X position for the pitch (aligned with start of segment)
                // Note: We need to calculate offset based on previous chars in this tuple
                // We can infer it from startX + (width of previous segments).
                // Easier way: localCharIdx is currently at the END of this segment.
                // Subtract length to get start.
                const segmentStartIdx = localCharIdx - str.length;
                const segmentX = startX + (segmentStartIdx * fontW);

                if (isAttack) {
                    const pElem = pitchElements[pitchIdx];

                    if (pElem && pElem.type === 'Pitch') {

                        // 1. Calculate Octave (LilyPond Rule)
                        const calculated = calculatePitch(pElem, prevPitch);
                        prevPitch = { letter: calculated.letter, octave: calculated.octave };

                        // 2. Determine Accidental Color & Symbol
                        const explicitAcc = pElem.accidental;
                        let effectiveAcc = alterations.getAccidental(calculated.letter, calculated.octave, explicitAcc);

                        let color = 'black';
                        let displayChar = calculated.letter;

                        if (effectiveAcc === '#') color = 'red';
                        if (effectiveAcc === '&') color = 'blue';
                        if (effectiveAcc === '##') color = 'orange';
                        if (effectiveAcc === '&&') color = 'green';

                        // 3. Calculate Y Position
                        const symbolMap = { '#': '♯', '&': '♭', '%': '♮', '##': '𝄪', '&&': '𝄫' };
                        const accSymbol = symbolMap[effectiveAcc] || '♮';

                        const lookupKey = accSymbol + calculated.letter;
                        const vOffset = V_OFFSETS[lookupKey];

                        if (vOffset !== undefined) {
                            const gOffset = 7;
                            const octaveShift = calculated.octave * fontH;
                            let yPos = centerLineY - octaveShift;
                            yPos += (gOffset + vOffset) * (fontH / 12);
                            yPos -= fontH;

                            commands.push({
                                type: 'text',
                                x: segmentX,
                                y: yPos,
                                text: displayChar,
                                color: color,
                                font: 'bold 16px sans-serif'
                            });
                        }

                        pitchIdx++; // Consume the pitch
                    }
                }

                // Note: If pElem is a Barline, it is handled in the main loop, 
                // or if we need strict sync, we could check here. 
                // For now, the main loop handles explicit pitch-line barlines.
            });

            // Iterate Segments again to place Pitches
            // The Pitch X should align with the FIRST character of the segment.
            let segmentXOffset = 0;
            content.forEach(segment => {
                const segmentX = startX + (segmentXOffset * fontW);

                // Is this segment an event that takes a pitch?
                // TextSegment -> Yes.
                // Special -> Yes.

                const pElem = pitchElements[pitchIdx];
                if (pElem && pElem.type === 'Pitch') {

                    // 1. Calculate Octave (LilyPond Rule)
                    const calculated = calculatePitch(pElem, prevPitch);
                    prevPitch = { letter: calculated.letter, octave: calculated.octave };

                    // 2. Determine Accidental Color & Symbol
                    const explicitAcc = pElem.accidental; // #, &, %, ##, && or null
                    let effectiveAcc = alterations.getAccidental(calculated.letter, calculated.octave, explicitAcc);

                    let color = 'black';
                    let displayChar = calculated.letter;

                    if (effectiveAcc === '#') color = 'red';
                    if (effectiveAcc === '&') color = 'blue';
                    if (effectiveAcc === '##') color = 'orange';
                    if (effectiveAcc === '&&') color = 'green';

                    // 3. Calculate Y Position
                    // Use V_OFFSETS lookup
                    // Construct key: e.g., "♯a" or "♮b"
                    const symbolMap = { '#': '♯', '&': '♭', '%': '♮', '##': '𝄪', '&&': '𝄫' };
                    const accSymbol = symbolMap[effectiveAcc] || '♮'; // Default natural for lookup if none

                    // Note: The V_OFFSETS table relies on specific keys.
                    // If effectiveAcc is '%', we look up "♮a".
                    // If effectiveAcc is implicitly natural (null in table?), we assume "♮".

                    const lookupKey = accSymbol + calculated.letter;
                    const vOffset = V_OFFSETS[lookupKey];

                    if (vOffset !== undefined) {
                        const gOffset = 7;
                        // Formula from Pitch.js:
                        // y += (gOffset + vOffsets) * (fontheight / 12)
                        // centerLineY is our "y0".

                        // Octave Shift: -1 octave means LOWER (Higher Y).
                        const octaveShift = calculated.octave * fontH;

                        // We subtract octaveShift because +Octave means Up (Lower Y)
                        let yPos = centerLineY - octaveShift;

                        yPos += (gOffset + vOffset) * (fontH / 12);

                        // Move up relative to baseline (svg text draws from bottom)
                        // FQS renderer seems to draw text centered or baseline. 
                        // Let's assume baseline adjustment:
                        yPos -= fontH;

                        commands.push({
                            type: 'text',
                            x: segmentX,
                            y: yPos,
                            text: displayChar,
                            color: color,
                            font: 'bold 16px sans-serif'
                        });
                    }

                    pitchIdx++;
                } else if (pElem && pElem.type === 'Barline') {
                    // Should be handled by main loop, but if sync is off, consume.
                    // pitchIdx++; 
                }

                segmentXOffset += segment.value.length;
            });
        }
    });

    return { commands, height: rowCounterY - startY };
}

// ---------------------------------------------------------
// LOGIC HELPERS
// ---------------------------------------------------------

function flattenPitchLine(pitchLineData) {
    if (!pitchLineData || !pitchLineData.elements) return [];
    // The parser returns key sig, then elements.
    // Elements can be Barline, KeySig (mid-line), or Pitch.
    return pitchLineData.elements;
}

function calculatePitch(current, prev) {
    // Current has: note, octaveShifts (string "^" or "/"), accidental
    // Prev has: letter, octave

    let letter = current.note;
    let octave = prev.octave;

    // LilyPond Rule
    const prevIdx = PITCH_INDEX[prev.letter];
    const currIdx = PITCH_INDEX[letter];
    const diff = currIdx - prevIdx;

    if (diff > 3) octave--;
    else if (diff < -3) octave++;

    // Explicit Modifiers
    if (current.octaveShifts) {
        for (let char of current.octaveShifts) {
            if (char === '^') octave++;
            if (char === '/') octave--;
        }
    }

    return { letter, octave };
}

// Export for browser
window.FQSLayout = { layoutScore };