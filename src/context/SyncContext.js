import React, { createContext, useState, useCallback } from 'react';

export const SyncContext = createContext({
  refreshKey: 0,
  triggerRefresh: () => {},
});

export const SyncProvider = ({ children }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  return (
    <SyncContext.Provider value={{ refreshKey, triggerRefresh }}>
      {children}
    </SyncContext.Provider>
  );
};
