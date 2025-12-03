import { parse } from './parser.js';
import { convertToABC } from './tutorial/js/abc-converter.js';

const fqsCode = `Simple Rhythm Example

* - - - | * - * - | * * * * | ** ** ***  **** |
K0   c | cc | cccc   | cc cc ccc cccc  |`;

console.log('Parsing FQS code:');
console.log(fqsCode);
console.log('\n---\n');

try {
	const ast = parse(fqsCode);
	console.log('AST parsed successfully');
	const abc = convertToABC(ast);
	console.log('ABC notation generated:');
	console.log(abc);
} catch (error) {
	console.error('Error:', error);
}
