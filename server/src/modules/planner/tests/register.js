// Test bootstrap: transpile TypeScript on the fly (no type-check) for node:test.
process.env.TS_NODE_TRANSPILE_ONLY = 'true';
require('ts-node/register');
