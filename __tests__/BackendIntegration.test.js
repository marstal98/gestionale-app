// Mock Platform prima di importare i moduli che lo usano
jest.mock('react-native', () => require('../__mocks__/react-native.js'));

import apiService from '../src/services/apiService';

// Test suite per l'integrazione Backend
describe('Backend Integration Tests', () => {
  let originalFetch;

  beforeAll(() => {
    // Salva la fetch originale
    originalFetch = global.fetch;
  });

  afterAll(() => {
    // Ripristina la fetch originale
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    // Reset token per ogni test
    apiService.setToken(null);
  });

  describe('API Service', () => {
    it('configura correttamente la base URL', () => {
      expect(apiService.baseURL).toBeDefined();
      expect(apiService.baseURL).toContain('api');
    });

    it('imposta correttamente il token di autenticazione', () => {
      const testToken = 'test-jwt-token';
      apiService.setToken(testToken);
      expect(apiService.token).toBe(testToken);
    });

    it('rimuove il token durante il logout', async () => {
      apiService.setToken('test-token');
      await apiService.logout();
      expect(apiService.token).toBeNull();
    });
  });

  describe('API Requests con Mock', () => {
    beforeEach(() => {
      // Mock fetch per i test
      global.fetch = jest.fn();
    });

    it('effettua chiamate GET correttamente', async () => {
      const mockResponse = { products: [{ id: 1, name: 'Test Product' }] };
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await apiService.getProducts();
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/products'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      
      expect(result).toEqual(mockResponse);
    });

    it('invia correttamente il token di autorizzazione', async () => {
      const testToken = 'Bearer test-token';
      apiService.setToken(testToken);
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: [] }),
      });

      await apiService.getUsers();
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${testToken}`,
          }),
        })
      );
    });

    it('gestisce correttamente gli errori HTTP', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not Found' }),
      });

      await expect(apiService.getProducts()).rejects.toThrow('Not Found');
    });

    it('effettua chiamate POST con body JSON', async () => {
      const productData = { name: 'New Product', price: 29.99 };
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, ...productData }),
      });

      await apiService.createProduct(productData);
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/products'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(productData),
        })
      );
    });

    it('effettua chiamate PUT per aggiornamenti', async () => {
      const updateData = { name: 'Updated Product' };
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, ...updateData }),
      });

      await apiService.updateProduct(1, updateData);
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/products/1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData),
        })
      );
    });

    it('effettua chiamate DELETE', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await apiService.deleteProduct(1);
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/products/1'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('Endpoints Specifici', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('testa login con credenziali', async () => {
      const mockAuthResponse = {
        token: 'jwt-token',
        user: { id: 1, email: 'test@example.com', role: 'admin' }
      };
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAuthResponse,
      });

      const result = await apiService.login('test@example.com', 'password');
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password'
          }),
        })
      );
      
      expect(result).toEqual(mockAuthResponse);
      expect(apiService.token).toBe('jwt-token');
    });

    it('testa creazione ordine', async () => {
      const orderData = {
        customerId: 1,
        items: [{ productId: 1, quantity: 2, unitPrice: 29.99 }],
        total: 59.98
      };
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, ...orderData }),
      });

      await apiService.createOrder(orderData);
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/orders'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(orderData),
        })
      );
    });

    it('testa cancellazione ordine', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cancelled: true }),
      });

      await apiService.cancelOrder(123);
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/orders/123/cancel'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('testa assegnazione ordine', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, assignedToId: 456 }),
      });

      await apiService.assignOrder(123, 456);
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/orders/123/assign'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ assignedToId: 456 }),
        })
      );
    });

    it('testa cambio stato ordine', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, status: 'completed' }),
      });

      await apiService.updateOrderStatus(123, 'completed');
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/orders/123/status'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ status: 'completed' }),
        })
      );
    });
  });

  describe('Health Check', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('restituisce true quando backend è disponibile', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
      });

      const isHealthy = await apiService.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('restituisce false quando backend non è disponibile', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const isHealthy = await apiService.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('Integration con Discount Utils', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('applica sconto a un ordine', async () => {
      const discountData = {
        type: 'percentage',
        value: 20
      };
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          orderId: 123, 
          originalTotal: 100, 
          discountAmount: 20, 
          finalTotal: 80 
        }),
      });

      const result = await apiService.applyDiscount(123, discountData);
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/orders/123/discount'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(discountData),
        })
      );
      
      expect(result.finalTotal).toBe(80);
      expect(result.discountAmount).toBe(20);
    });
  });

  describe('Scenari di Errore', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('gestisce errori di rete', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      await expect(apiService.getProducts()).rejects.toThrow('Failed to fetch');
    });

    it('gestisce errori 401 Unauthorized', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      await expect(apiService.getUsers()).rejects.toThrow('Unauthorized');
    });

    it('gestisce errori 500 Internal Server Error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' }),
      });

      await expect(apiService.getProducts()).rejects.toThrow('Internal Server Error');
    });
  });
});