// Advanced test utilities for comprehensive business logic testing
// Created by: World-class developer approach for enterprise-grade testing

export const testHelpers = {
  // Order validation utilities
  validateOrderStructure: (order) => {
    const requiredFields = ['id', 'customerName', 'total', 'items'];
    return requiredFields.every(field => order.hasOwnProperty(field));
  },

  // Field validation engine
  validateRequiredField: (field) => {
    if (field.required && (!field.value || field.value.trim() === '')) {
      return {
        isValid: false,
        error: `Campo ${field.name || field.label} obbligatorio`
      };
    }
    return { isValid: true, error: null };
  },

  // Cart calculation engine
  calculateCartTotal: (items) => {
    return items.reduce((sum, item) => {
      const itemTotal = (item.price || 0) * (item.quantity || 0);
      return sum + itemTotal;
    }, 0);
  },

  // Mock data generators for consistent testing
  mockOrder: (overrides = {}) => ({
    id: 1,
    customerName: 'Mario Rossi',
    total: 100,
    items: [],
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...overrides
  }),

  mockCartItem: (overrides = {}) => ({
    id: 1,
    name: 'Prodotto Test',
    price: 10,
    quantity: 1,
    ...overrides
  }),

  // Error handling test utilities
  mockApiError: (statusCode = 500, message = 'Server Error') => ({
    status: statusCode,
    message,
    timestamp: new Date().toISOString()
  })
};

export const businessLogic = {
  // Order processing logic
  processOrder: (orderData) => {
    if (!orderData.items || orderData.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }
    
    const total = testHelpers.calculateCartTotal(orderData.items);
    
    return {
      ...orderData,
      total,
      status: 'processed',
      processedAt: new Date().toISOString()
    };
  },

  // Field validation with business rules
  validateForm: (fields) => {
    const errors = {};
    let isValid = true;

    fields.forEach(field => {
      const validation = testHelpers.validateRequiredField(field);
      if (!validation.isValid) {
        errors[field.name || field.label] = validation.error;
        isValid = false;
      }
    });

    return { isValid, errors };
  }
};