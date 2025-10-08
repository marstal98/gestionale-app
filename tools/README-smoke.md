Smoke test for gestionale-clean backend

This folder contains a minimal smoke test script to quickly exercise the local backend.

Files
- smoke-test.js: Node script that performs a few GET/POST requests against API endpoints.

Usage
1. From the repository root run:
   node tools/smoke-test.js

2. To use authentication (if endpoints require it), set TOKEN and API_URL env vars:
   $env:API_URL = 'http://localhost:3000'; $env:TOKEN = '<your-jwt>' ; node tools/smoke-test.js

Notes
- The script uses `node-fetch`. Recent Node versions (>=18) include a global fetch; if your Node version is older, install node-fetch locally:
  npm install node-fetch@2

- The script is intentionally conservative: it won't print raw full responses when they are large (it truncates output), and it treats non-JSON responses as text.

- If you want the script to assert strict success/failure and exit with non-zero on failures, I can update it to perform assertions and return a non-zero exit code for failing checks.
