// Helper to build fetch headers including Authorization only when token is present
export function buildHeaders(token, extra = {}) {
  const headers = { ...extra };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export default { buildHeaders };
