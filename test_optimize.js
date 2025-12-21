import { fqsToABC } from './browser-pipeline/index.js';
import fs from 'fs';

async function test() {
	const fqsText = fs.readFileSync('test_dotted_rhythms.fqs', 'utf8');

	console.log('Testing optimizeTiesStage with test_dotted_rhythms.fqs');
	console.log('FQS input:');
	console.log(fqsText);
	console.log('\n---\n');

	const result = await fqsToABC(fqsText);

	if (result.success) {
		console.log('Success! ABC output:');
		console.log(result.abcNotation);

		console.log('\nOptimization stats:');
		console.log(result.stats.optimize);

		// Check if we have dotted notes
		const hasDottedNotes = result.abcNotation.includes('3/4') || result.abcNotation.includes('3/2') || result.abcNotation.includes('3');
		console.log('\nHas dotted notes:', hasDottedNotes);

		// Expected output (from user):
		// X:1
		// T:*
		// K:C major
		// M:3/4
		// L:1/4
		// C3/4C/4 C -C/2C/2| [M:4/4] C3 C|

		console.log('\nExpected output should have:');
		console.log('C3/4C/4 (dotted eighth + sixteenth)');
		console.log('C -C/2C/2 (quarter tied to eighth + eighth)');
		console.log('C3 C (dotted half + quarter)');
	} else {
		console.error('Error:', result.error);
	}
}

test().catch(err => {
	console.error('Test failed:', err);
	process.exit(1);
});
