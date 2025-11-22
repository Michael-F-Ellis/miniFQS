{
  function flatten(arr) {
    return arr.flat(Infinity);
  }
}

// =============================================================================
// 1. Top Level Structure
//    A score consists of a title block followed by one of more music
//    blocks. Each music block corresponds to a line of music in a
//    a vocal score, i.e. lyrics and pitches. Blocks are separated
//    by one or more blank lines.
// =============================================================================

Score
  = title:TitleBlock
    sep:BlockSeparator
    blocks:MusicBlock|1.., BlockSeparator| EmptyLines
    
    {
      return {
        type: "Score",
        title: title,
        blocks: blocks
      };
    }
    
// The folowing is a valid Score for Happy Birthday in Eb major.
// ---------------------------------------------------------------------
/*
Happy Birthday

Hap.py | birth day to | you -; Hap.py | birth day to | you -; Hap.py |
K&3 bb | c b e | d bb | c b ^f | e bb |
counter: 3

birth day dear | NAME * Hap.py | birth day to | you=* - - |
K&3 ^b g e | d c ^aa | g e f | e - - |

*/
// --------------------------------------------------------------------

// The first block in every score is the title block.
TitleBlock
  // Peeks for Newline, consumes everything up to it
  = line:(!Newline c:. { return c; })+ 
    { return line.join("").trim(); }

// Music blocks define a single line of lyrics with pitches.
// A optional counter line is needed if the line begins with
// a partial measure.
MusicBlock
  = lyrics:LyricLine EOL
    pitches:PitchLine
    counter:(EOL c:CounterLine { return c; })?
    {
      return {
        type: "Block",
        lyrics: lyrics,
        pitches: pitches,
        counter: counter || null
      };
    }

// =============================================================================
// 2. Lyric Line
// =============================================================================

// The lyric line is the first line of every music block. It contains the lyric
// a line of music annotated with special characters that define the intended 
// mensuraton and rhythm.
LyricLine
  = items:(
      _ m:Barline _ { return m; }
    / _ t:BeatTuple _ { return t; }
  )+
  { return items; }

// A BeatTuple contains the syllables and rhythm to be sung over one or more
// beats. Most BeatTuples span a single beat.  Multi-beat tuples are prefixed with
// an integer greater than 1.
BeatTuple
  = MultiBeatTuplet
  / SingleBeatTuple

// We need to extract the leading integer from multi-beat tuplets.
MultiBeatTuplet
  = duration:Integer
    content:BeatContent
    {
      return {
        type: "BeatTuple",
        duration: duration,
        content: content,
        modifier: null
      };
    }

SingleBeatTuple
  = content:BeatContent
    modifier:"_"?
    {
      return {
        type: "BeatTuple",
        duration: 1,   // 1 by definition
        content: content,
        modifier: modifier
      };
    }

// A Beat contains syllables and special chars that define the 
// subdivisions of the beat.  
BeatContent
  = head:(TextSegment / SpecialSegment)
    tail:BeatTail*
    { return [head, ...tail]; }

// There may be a dot separator and another syllable 
// at the start of the next
// part of the beat.  Hence, we check for that before
// checking for an asterisk, hyphen, semicolon or underscore. 
BeatTail
  = "." text:TextSegment { return text; }
  / special:SpecialSegment { return special; }
  / text:TextSegment { return text; } // might be unneeded

// A syllable is a sequence of alpha characters.  Note:
// This should be re-written to support unicode alpha chars.
// We'll need to make sure to include a single quote or apostrophe
// to allow English possessives, plurals and contractions.
TextSegment
  = chars:[^ \t\n\r.|*_;\-=0-9]+ 
    { return { type: "Syllable", value: chars.join("") }; }

// Exactly one of: asterisk, underscore, semicolon, equal or hyphen.
SpecialSegment
  = char:[*_;=-] 
    { 
      if (char === "=") return { type: "Special", value: "=" };
      return { type: "Special", value: char }; 
    }

// =============================================================================
// 3. Pitch Line
// =============================================================================
// A pitch begins with a key signature followed by pitches and barlines.
// TODO: Support changing key signature at the beginning of any measure.
PitchLine
  = key:KeySignature 
    _ 
    elements:PitchElement*
    {
      return {
        type: "PitchLine",
        keySignature: key,
        elements: elements
      };
    }

// A key signature is a capital 'K' followed by an accidental sign (# or &)
// and a count of the sharps or flats, e.g.  K0 is C major, K#2 is D major, K&3 is 
// Eb major. Note that we permit putting the sharp or flat before or after the
// count.

KeySignature
  = "K" 
    type:(
      "0" { return { type: '%', count: 0 }}
    / sig:[#&] count:[1-7] { return { type: sig, count: parseInt(count) }; }
    / count:[1-7] sig:[#&] { return { type: sig, count: parseInt(count) }; }
    )

PitchElement
  = _ bar:Barline _ { return bar; }
  / _ pitch:Pitch _ { return pitch; }

// A pitch is one of 'abcdefg' optionally preceded by one or two accidentals
// optionally preceded by an octave shift, e.g. '^^#a'
Pitch
  = octave:OctaveShift*
    acc:Accidental?
    note:[a-g]
    {
      return {
        type: "Pitch",
        note: note,
        accidental: acc || null,
        octaveShifts: octave.join("")
      };
    }

// FIX: Changed from [^/] (Not Slash) to [/^] (Slash or Caret)
OctaveShift = [/^]

Accidental = DblSharp / DblFlat / Sharp / Flat / Natural

Natural 
  = "%"

Sharp
  = "#"

DblSharp
  = "##"

Flat
  = "&"

DblFlat
  = "&&"
  
// =============================================================================
// 4. Counter Line & General Tokens
// =============================================================================

CounterLine
  = "counter:" _ val:Integer
    { return { type: "Counter", value: val }; }

Barline
  = "|" { return { type: "Barline" }; }

// =============================================================================
// 5. Primitives & Whitespace
// =============================================================================

Integer "integer"
  = [0-9]+ { return parseInt(text(), 10); }

BlockSeparator
  = Newline  EmptyLines

EOL
  = Newline+
  
EmptyLines
  = [ \t\r\n]*

Newline
  = [\n\r]

_ "whitespace"
  = [ \t]*