import { useEffect } from 'react';
import * as Linking from 'expo-linking';

// Simple helper to parse incoming deep links and call a handler
export function useDeepLinkHandler(onLink) {
  useEffect(() => {
    const getInitial = async () => {
      const initial = await Linking.getInitialURL();
      if (initial) onLink(initial);
    };
    getInitial();

    const sub = Linking.addEventListener('url', e => onLink(e.url));

    return () => {
      try { sub.remove(); } catch (e) { /* ignore for RN versions */ }
    };
  }, [onLink]);
}

export function parseTokenFromUrl(url) {
  try {
    const parsed = Linking.parse(url);
    // Linking.parse returns { path, queryParams }
    return parsed?.queryParams?.token || null;
  } catch (e) {
    return null;
  }
}
