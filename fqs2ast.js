#!/usr/bin/env node

import { parse } from './parser.js';
import { readFileSync } from 'fs';

// Read FQS from stdin
const input = readFileSync(process.stdin.fd, 'utf-8');

try {
	const ast = parse(input);
	console.log(JSON.stringify(ast, null, 2));
} catch (e) {
	console.error('Error parsing FQS:', e.message);
	process.exit(1);
}
