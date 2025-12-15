// Test script for browser pipeline
import { fqsToABC, getStageTSV } from './index.js';

// Test FQS examples
const testExamples = [
	{
		name: 'Simple example',
		fqs: `Happy birthday to you
| c d e f | g a b c' |`
	},
	{
		name: 'Test with beat duration',
		fqs: `Test [4.]
| c d e f |`
	},
	{
		name: 'Test with key signature',
		fqs: `K#2
Test in D major
| d e f# g |`
	}
];

async function runTests() {
	console.log('Testing browser pipeline...\n');

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

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
	// Node.js environment
	runTests().catch(console.error);
} else {
	// Browser environment - export for use in browser console
	window.testPipeline = runTests;
	window.fqsToABC = fqsToABC;
	console.log('Pipeline test functions loaded. Use testPipeline() to run tests.');
}
