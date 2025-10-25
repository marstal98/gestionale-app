import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/apiService';

// Hook per gestire lo stato delle chiamate API
export const useApi = (endpoint, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { immediate = true, dependencies = [] } = options;

  const execute = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);
      
      let result;
      if (typeof endpoint === 'function') {
        result = await endpoint(...args);
      } else {
        result = await apiService.request(endpoint);
      }
      
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate, ...dependencies]);

  return { data, loading, error, execute, refetch: execute };
};

// Hook specifico per prodotti
export const useProducts = () => {
  return useApi(() => apiService.getProducts());
};

// Hook specifico per ordini
export const useOrders = () => {
  return useApi(() => apiService.getOrders());
};

// Hook specifico per utenti
export const useUsers = () => {
  return useApi(() => apiService.getUsers());
};

// Hook per gestire l'autenticazione
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    try {
      setLoading(true);
      const response = await apiService.login(email, password);
      setUser(response.user);
      setIsAuthenticated(true);
      return response;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await apiService.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  const register = async (userData) => {
    try {
      setLoading(true);
      const response = await apiService.register(userData);
      return response;
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    isAuthenticated,
    loading,
    login,
    logout,
    register,
  };
};

// Hook per gestire le operazioni CRUD
export const useCrud = (entityName) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Map entity names to API methods
  const apiMethods = {
    products: {
      getAll: () => apiService.getProducts(),
      create: (data) => apiService.createProduct(data),
      update: (id, data) => apiService.updateProduct(id, data),
      delete: (id) => apiService.deleteProduct(id),
    },
    orders: {
      getAll: () => apiService.getOrders(),
      create: (data) => apiService.createOrder(data),
      update: (id, data) => apiService.updateOrder(id, data),
      delete: (id) => apiService.deleteOrder(id),
    },
    users: {
      getAll: () => apiService.getUsers(),
      create: (data) => apiService.createUser(data),
      update: (id, data) => apiService.updateUser(id, data),
      delete: (id) => apiService.deleteUser(id),
    },
  };

  const methods = apiMethods[entityName];

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await methods.getAll();
      setItems(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const create = async (data) => {
    try {
      setLoading(true);
      const newItem = await methods.create(data);
      setItems(prev => [...prev, newItem]);
      return newItem;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const update = async (id, data) => {
    try {
      setLoading(true);
      const updatedItem = await methods.update(id, data);
      setItems(prev => prev.map(item => item.id === id ? updatedItem : item));
      return updatedItem;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    try {
      setLoading(true);
      await methods.delete(id);
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [entityName]);

  return {
    items,
    loading,
    error,
    fetchAll,
    create,
    update,
    remove,
    refetch: fetchAll,
  };
};

// Hook per testare la connessione al backend
export const useBackendHealth = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkHealth = async () => {
    try {
      setChecking(true);
      const health = await apiService.healthCheck();
      setIsConnected(health);
      return health;
    } catch {
      setIsConnected(false);
      return false;
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
    // Check every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return { isConnected, checking, checkHealth };
};