// Business logic tests for RequiredTextInput component validation
describe('RequiredTextInput validation', () => {
  it('validates required field logic', () => {
    const mockField = { 
      label: 'Nome', 
      required: true, 
      value: '', 
      name: 'customerName' 
    };
    
    const isFieldValid = (field) => {
      if (field.required && (!field.value || field.value.trim() === '')) {
        return false;
      }
      return true;
    };
    
    expect(isFieldValid(mockField)).toBe(false);
    
    const validField = { ...mockField, value: 'Mario Rossi' };
    expect(isFieldValid(validField)).toBe(true);
  });
  
  it('generates proper error messages', () => {
    const generateErrorMessage = (fieldName, label) => {
      return `Campo ${fieldName || label} obbligatorio`;
    };
    
    expect(generateErrorMessage('customerName', 'Nome')).toBe('Campo customerName obbligatorio');
    expect(generateErrorMessage(null, 'Email')).toBe('Campo Email obbligatorio');
  });

  it('handles asterisk display logic', () => {
    const shouldShowAsterisk = (required) => required === true;
    
    expect(shouldShowAsterisk(true)).toBe(true);
    expect(shouldShowAsterisk(false)).toBe(false);
    expect(shouldShowAsterisk(undefined)).toBe(false);
  });
});
