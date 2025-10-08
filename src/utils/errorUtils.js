// Helper to produce a safe, user-facing error message from server response objects.
// Per requisito: non esporre mai il messaggio raw del server all'utente.
export function safeMessageFromData(data, fallback = 'Errore') {
  try {
    if (!data) return fallback;
    // If server intentionally signals mapping_required, return sentinel so caller can handle it
    if (data === 'mapping_required') return 'mapping_required';
    if (data.mappingRequired === true || data.error === 'mapping_required') return 'mapping_required';

    // Otherwise never return raw data.error. Return the fallback message.
    return fallback;
  } catch (e) {
    // On any unexpected shape, fall back to generic message
    return fallback;
  }
}

export default safeMessageFromData;
