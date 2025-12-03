import { parse } from './parser.js';
import { convertToABC } from './tutorial/js/abc-converter.js';

const fqsCode = `Simple Example

Hap.py | birth day  to | you - ; |
K&1 cc  | d c f  | e  |
counter: 3`;

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
