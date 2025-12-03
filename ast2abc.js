#!/usr/bin/env node

import { convertToABC } from './tutorial/js/abc-converter.js';
import { readFileSync } from 'fs';

// Read AST JSON from stdin (use /dev/stdin for compatibility)
const input = readFileSync('/dev/stdin', 'utf-8');

try {
	const ast = JSON.parse(input);
	const abc = convertToABC(ast);
	console.log(abc);
} catch (e) {
	console.error('Error converting AST to ABC:', e.message);
	process.exit(1);
}
