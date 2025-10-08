// Custom transformer to strip Flow style type annotations from react-native/jest internal helper files
// without touching the rest of the codebase. This avoids parser errors in Jest when encountering
// mixed Flow constructs (e.g. callback: number => void) plus TS assertions.
// Scope: only applies when filename includes 'react-native/jest/'.

const fs = require('fs');
const path = require('path');
const babelJest = require('babel-jest');

// Pre-build a babel transformer using the existing project babel config
const baseTransformer = babelJest.createTransformer();

function stripFlowLike(code) {
  // Remove function parameter flow annotations of the form `param: Something` inside object method/value definitions
  // and in function signatures used in the RN jest setup, plus return type annotations like `): Type {`.
  // This is a conservative regex set; we purposely do NOT try to fully parse Flow.

  let transformed = code;

  // 1. Remove parameter annotations `identifier: Type` inside parentheses but keep default values if present.
  transformed = transformed.replace(/([,(]\s*)([a-zA-Z_$][\w$]*)(\s*):\s*[^,)=]+/g, '$1$2');

  // 2. Remove return type annotations before method bodies `) : Type {` or `): Type {`.
  transformed = transformed.replace(/\)\s*:\s*[^{]+\{/g, '){');

  // 3. Remove standalone type alias lines that could appear (not critical, safe fallback)
  transformed = transformed.replace(/^type\s+[^;]+;?$/gm, '');

  return transformed;
}

module.exports = {
  process(src, filename, jestOptions) {
    if (filename.includes(path.join('react-native', 'jest'))) {
      const stripped = stripFlowLike(src);
      return baseTransformer.process(stripped, filename, jestOptions);
    }
    return baseTransformer.process(src, filename, jestOptions);
  },
};
