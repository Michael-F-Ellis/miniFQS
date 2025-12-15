// Node.js test script for browser pipeline
// Loads parser first, then tests the pipeline

import { parse } from '../parser.js';
import { fqsToABC } from './index.js';

// Make parse function globally available for parseStage
global.parse = parse;

// Test FQS examples
const testExamples = [
	{
		name: 'Simple example',
		fqs: `Happy birthday to you
Hap.py | birth day  to | you - ; |
K&1 cc  | d c f  | e  |`
	},
	{
		name: 'Test with beat duration',
		fqs: `Test Beat Duration
Test [4.] | c d e f |
K0 c d e f |`
	},
	{
		name: 'Test with key signature',
		fqs: `Test in D major
| d e f# g |
K#2 d e f# g |`
	}
];

async function runTests() {
	console.log('Testing browser pipeline in Node.js...\n');

	for (const example of testExamples) {
		console.log(`=== ${example.name} ===`);
		console.log(`FQS input:\n${example.fqs}\n`);

		try {
			const result = await fqsToABC(example.fqs);

			if (result.success) {
				console.log('✓ Success!');
				console.log(`ABC output:\n${result.abcNotation}\n`);

				// Show some stats
				console.log('Stats:');
				console.log(`- Parse valid: ${result.stats.parse?.valid}`);
				console.log(`- Flattened rows: ${result.stats.flatten?.rows}`);
				console.log(`- Octaves calculated: ${result.stats.octaves?.totalPitches || 0}`);
				console.log(`- Mapped attacks: ${result.stats.map?.attackRows || 0}`);
				console.log(`- Generated ABC length: ${result.stats.generate?.abcLength || 0} chars\n`);
			} else {
				console.log('✗ Failed!');
				console.log(`Error: ${result.error}\n`);
			}
		} catch (error) {
			console.log('✗ Exception!');
			console.log(`Error: ${error.message}\n`);
		}
	}

	console.log('=== End of tests ===');
}

// Run tests
runTests().catch(console.error);
