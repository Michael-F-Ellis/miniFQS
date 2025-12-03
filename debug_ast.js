import { parse } from './parser.js';

const fqsCode = `Simple Rhythm Example

* - - - | * - * - | * * * * | ** ** ***  **** |
K0   c | cc | cccc   | cc cc ccc cccc  |`;

try {
	const ast = parse(fqsCode);
	console.log(JSON.stringify(ast, null, 2));
} catch (error) {
	console.error('Error:', error);
}
