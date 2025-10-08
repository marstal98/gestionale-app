// Custom transformer to lightly strip Flow/Type-ish annotations in problematic RN jest files
// before passing to babel-jest (from jest-expo preset).
const fs = require('fs');
const { transformSync } = require('@babel/core');

// Simple regex-based stripping: this is NOT a full parser but enough for RN jest helper files.
function stripFlowLike(src) {
  return src
    // remove inline type casts `(expr as Type)` -> `(expr)`
    .replace(/\(([^()]+?)\s+as\s+[_A-Za-z0-9.<>{},\[\]?|& ]+\)/g, '($1)')
    // remove function param type annotations `name: Type` inside parens
    .replace(/([,(]\s*[A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*[_A-Za-z0-9.<>{},\[\]?|& ]+(?=\s*[,)])/g, '$1')
    // remove return type annotations `): Type {` -> `) {`
    .replace(/\)\s*:\s*[_A-Za-z0-9.<>{},\[\]?|& ]+\s*\{/g, ') {')
    // remove Flow type param on function name `function name<T>(` -> `function name(`
    .replace(/function(\s+[A-Za-z0-9_$]+)\s*<[^>]+>\s*\(/g, 'function$1(')
    // remove generic on arrow functions `<T>(` at start of param list
    .replace(/<[^>]+>\s*\(/g, '(');
}

module.exports = {
  process(src, filename, jestOptions) {
    if (filename.includes('react-native') && filename.includes('jest') && filename.endsWith('mock.js')) {
      src = stripFlowLike(src);
    }
    const result = transformSync(src, {
      filename,
      presets: ['babel-preset-expo', '@babel/preset-flow'],
      plugins: ['@babel/plugin-transform-flow-strip-types'],
      babelrc: false,
      configFile: false,
      compact: true,
    });
    return result || { code: src };
  },
};
