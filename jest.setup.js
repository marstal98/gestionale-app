// Use the built-in matchers from @testing-library/react-native v12+
import '@testing-library/react-native/extend-expect';

// Silence native modules (no-op in our manual mock environment)
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}));
