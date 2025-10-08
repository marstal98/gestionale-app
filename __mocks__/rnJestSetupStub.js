// Stub di setup Jest per RN: definisce minimi global richiesti
if (typeof global.__DEV__ === 'undefined') global.__DEV__ = true;
if (typeof global.performance === 'undefined') {
  global.performance = { now: () => Date.now() };
}
module.exports = {};