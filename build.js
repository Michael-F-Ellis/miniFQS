import fs from 'fs';
import peggy from 'peggy';

const grammarFile = 'fqs.pegjs'; // Ensure this matches your actual grammar filename
const outputFile = 'parser.js';

try {
  console.log(`Reading grammar from ${grammarFile}...`);
  const grammar = fs.readFileSync(grammarFile, 'utf8');

  console.log('Compiling parser to ES Module...');
  const source = peggy.generate(grammar, {
    output: 'source',
    format: 'es', // Changed from 'umd' to 'es' for module support
  });

  fs.writeFileSync(outputFile, source);
  console.log(`✅ Success! Parser written to ${outputFile}`);
} catch (e) {
  console.error('❌ Build Failed:', e.message);
  if (e.location) console.error(e.location);
}
