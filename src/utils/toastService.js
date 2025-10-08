// Very small toast service: simple pub/sub to let non-UI code request a global toast.
let _listeners = [];

export function listen(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(l => l !== fn); };
}

export function showToast(message, type = 'success') {
  try {
    _listeners.forEach(fn => {
      try { fn({ message, type }); } catch (e) { /* ignore listener errors */ }
    });
  } catch (e) { /* no-op */ }
}

export default { listen, showToast };
