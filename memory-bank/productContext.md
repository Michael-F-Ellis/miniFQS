# Product Context

## Why miniFQS Exists
Choral singers often need to extract their individual vocal parts from full scores for focused practice and performance preparation. Traditional methods involve photocopying, manual transcription, or using complex notation software that may be overkill for simple part extraction. miniFQS addresses this gap by providing a lightweight, text-based notation system that is easy to learn and use.

## Problems Solved
1. **Complexity Overhead**: Full-featured music notation software requires significant learning and setup for simple part transcription.
2. **Accessibility**: Not all singers have access to or can afford professional notation software.
3. **Portability**: Text-based scores are easily stored, shared, and edited with any text editor.
4. **Annotation Compatibility**: PDFs generated from miniFQS work seamlessly with popular annotation apps like forScore and MobileSheets.

## How It Should Work
1. **User Experience**:
   - Choral singers open the tutorial to learn FQS syntax through progressive examples.
   - They transcribe their vocal part from a printed score into FQS text format.
   - They use the mini-fqs web component to visualize and verify their transcription.
   - They print or save as PDF for annotation in their preferred app.

2. **Workflow Integration**:
   - Learning phase: Tutorial with side-by-side examples (FQS syntax, rendered output, standard notation).
   - Transcription phase: Text editor for writing FQS, browser for real-time rendering.
   - Output phase: Browser print to PDF, import into annotation app.

## User Experience Goals
- **Intuitive Learning**: Tutorial designed for musicians who read standard notation, focusing on translation between systems.
- **Immediate Feedback**: Real-time rendering as users type FQS code.
- **Practical Output**: Clean, printer-friendly PDFs optimized for digital annotation.
- **Progressive Complexity**: Tutorial examples start with simple rhythms and progress to advanced features.

## Success Criteria
- A choral singer with no prior FQS experience can transcribe a simple vocal line after completing the tutorial.
- The transcribed part renders accurately and matches the original score.
- The PDF output is clear and usable in annotation apps without reformatting.

## Stakeholders
- **Primary Users**: Choral singers (amateur and professional)
- **Secondary Users**: Music educators, choir directors
- **Influencers**: Music technology enthusiasts, open-source contributors

## Competitive Landscape
- **Traditional Software**: Finale, Sibelius, MuseScore (complex, feature-rich)
- **Lightweight Alternatives**: LilyPond (text-based but complex syntax), online notation tools
- **Differentiators**: miniFQS focuses exclusively on single-line part transcription with minimal syntax, designed specifically for choral singers' workflow.

## Evolution of Requirements
- Initially focused on core transcription functionality
- Currently expanding tutorial for user education
- Future considerations: multi-part scores, audio playback, mobile apps

This product context emphasizes the practical, user-centered design of miniFQS as a specialized tool for a specific musical workflow.
