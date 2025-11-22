const fs = require('fs');
const peggy = require('peggy');

const grammarFile = 'grammar.pegjs'; // Your grammar filename
const outputFile = 'parser.js';

try {
	console.log(`Reading grammar from ${grammarFile}...`);
	const grammar = fs.readFileSync(grammarFile, 'utf8');

	console.log('Compiling parser...');
	const source = peggy.generate(grammar, {
		output: 'source',
		format: 'umd', // Universal Module Definition (works in Node and Browser)
		exportVar: 'fqsParser', // Global variable name for browser
	});

	fs.writeFileSync(outputFile, source);
	console.log(`✅ Success! Parser written to ${outputFile}`);
} catch (e) {
	console.error('❌ Build Failed:', e.message);
	if (e.location) console.error(e.location);
}