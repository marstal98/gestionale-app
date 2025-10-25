import React from 'react';
import { Dimensions, PixelRatio } from 'react-native';

// Ottieni le dimensioni dello schermo
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Definizione dei breakpoint per diversi dispositivi
export const BREAKPOINTS = {
  small: 320,    // Telefoni piccoli
  medium: 375,   // Telefoni standard
  large: 414,    // Telefoni grandi
  tablet: 768,   // Tablet
  desktop: 1024  // Desktop/Tablet grandi
};

// Tipologie di dispositivi
export const DEVICE_TYPES = {
  PHONE_SMALL: 'phone_small',
  PHONE_MEDIUM: 'phone_medium', 
  PHONE_LARGE: 'phone_large',
  TABLET: 'tablet',
  DESKTOP: 'desktop'
};

// Determina il tipo di dispositivo corrente
export const getDeviceType = () => {
  if (SCREEN_WIDTH < BREAKPOINTS.small) return DEVICE_TYPES.PHONE_SMALL;
  if (SCREEN_WIDTH < BREAKPOINTS.medium) return DEVICE_TYPES.PHONE_MEDIUM;
  if (SCREEN_WIDTH < BREAKPOINTS.large) return DEVICE_TYPES.PHONE_LARGE;
  if (SCREEN_WIDTH < BREAKPOINTS.tablet) return DEVICE_TYPES.TABLET;
  return DEVICE_TYPES.DESKTOP;
};

// Controlla se è un tablet
export const isTablet = () => {
  return SCREEN_WIDTH >= BREAKPOINTS.tablet;
};

// Controlla se è un telefono
export const isPhone = () => {
  return SCREEN_WIDTH < BREAKPOINTS.tablet;
};

// Funzioni per dimensioni responsive
export const wp = (percentage) => {
  const value = (percentage * SCREEN_WIDTH) / 100;
  return Math.round(PixelRatio.roundToNearestPixel(value));
};

export const hp = (percentage) => {
  const value = (percentage * SCREEN_HEIGHT) / 100;
  return Math.round(PixelRatio.roundToNearestPixel(value));
};

// Dimensioni responsive per font
export const scaleFontSize = (size) => {
  const scale = SCREEN_WIDTH / 320; // Base 320px
  const newSize = size * scale;
  
  if (isTablet()) {
    return Math.round(PixelRatio.roundToNearestPixel(newSize * 1.2)); // Aumenta per tablet
  }
  
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Spaziature responsive
export const getSpacing = (base = 16) => {
  const deviceType = getDeviceType();
  
  switch (deviceType) {
    case DEVICE_TYPES.PHONE_SMALL:
      return base * 0.8;
    case DEVICE_TYPES.PHONE_MEDIUM:
      return base;
    case DEVICE_TYPES.PHONE_LARGE:
      return base * 1.1;
    case DEVICE_TYPES.TABLET:
      return base * 1.5;
    case DEVICE_TYPES.DESKTOP:
      return base * 2;
    default:
      return base;
  }
};

// Dimensioni responsive per componenti comuni
export const getComponentSize = (component) => {
  const deviceType = getDeviceType();
  
  const sizes = {
    [DEVICE_TYPES.PHONE_SMALL]: {
      buttonHeight: 40,
      inputHeight: 45,
      headerHeight: 56,
      tabBarHeight: 60,
      iconSize: 20,
      cardPadding: 12,
      borderRadius: 8
    },
    [DEVICE_TYPES.PHONE_MEDIUM]: {
      buttonHeight: 45,
      inputHeight: 50,
      headerHeight: 60,
      tabBarHeight: 65,
      iconSize: 24,
      cardPadding: 16,
      borderRadius: 10
    },
    [DEVICE_TYPES.PHONE_LARGE]: {
      buttonHeight: 48,
      inputHeight: 52,
      headerHeight: 64,
      tabBarHeight: 68,
      iconSize: 26,
      cardPadding: 18,
      borderRadius: 12
    },
    [DEVICE_TYPES.TABLET]: {
      buttonHeight: 52,
      inputHeight: 56,
      headerHeight: 72,
      tabBarHeight: 75,
      iconSize: 28,
      cardPadding: 24,
      borderRadius: 14
    },
    [DEVICE_TYPES.DESKTOP]: {
      buttonHeight: 56,
      inputHeight: 60,
      headerHeight: 80,
      tabBarHeight: 80,
      iconSize: 32,
      cardPadding: 32,
      borderRadius: 16
    }
  };
  
  return sizes[deviceType][component] || sizes[DEVICE_TYPES.PHONE_MEDIUM][component];
};

// Layout responsive per griglie
export const getGridLayout = () => {
  const deviceType = getDeviceType();
  
  switch (deviceType) {
    case DEVICE_TYPES.PHONE_SMALL:
      return { columns: 1, maxWidth: '100%' };
    case DEVICE_TYPES.PHONE_MEDIUM:
      return { columns: 1, maxWidth: '100%' };
    case DEVICE_TYPES.PHONE_LARGE:
      return { columns: 2, maxWidth: '100%' };
    case DEVICE_TYPES.TABLET:
      return { columns: 2, maxWidth: '90%' };
    case DEVICE_TYPES.DESKTOP:
      return { columns: 3, maxWidth: '80%' };
    default:
      return { columns: 1, maxWidth: '100%' };
  }
};

// Orientamento
export const getOrientation = () => {
  return SCREEN_WIDTH > SCREEN_HEIGHT ? 'landscape' : 'portrait';
};

// Dimensioni dello schermo
export const getScreenDimensions = () => ({
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  deviceType: getDeviceType(),
  isTablet: isTablet(),
  isPhone: isPhone(),
  orientation: getOrientation()
});

// Hook per rilevare cambiamenti di orientamento
export const useResponsive = () => {
  const [dimensions, setDimensions] = React.useState(() => getScreenDimensions());
  
  React.useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({
        width: window.width,
        height: window.height,
        deviceType: getDeviceType(),
        isTablet: window.width >= BREAKPOINTS.tablet,
        isPhone: window.width < BREAKPOINTS.tablet,
        orientation: window.width > window.height ? 'landscape' : 'portrait'
      });
    });
    
    return () => subscription?.remove();
  }, []);
  
  return dimensions;
};

// Stili responsive comuni
export const createResponsiveStyles = (styles) => {
  const deviceType = getDeviceType();
  
  if (typeof styles === 'function') {
    return styles({
      deviceType,
      isTablet: isTablet(),
      isPhone: isPhone(),
      wp,
      hp,
      getSpacing,
      getComponentSize,
      scaleFontSize
    });
  }
  
  return styles;
};