import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Dimensions, Text } from "react-native";
import { Portal } from "react-native-paper";

const { width } = Dimensions.get("window");

export default function FloatingToast({ visible, message, onHide, type = "success" }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    const TOAST_DURATION = 2000; // 2 seconds for all toasts
    if (visible) {
      // Animazione entrata
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Dopo TOAST_DURATION sparisce
      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          onHide?.();
        });
      }, TOAST_DURATION);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  // colori e emoji per tipo
  const typeMap = {
    success: { color: "#7E57C2", emoji: "✅" },
    error: { color: "#E53935", emoji: "⚠️" },
    info: { color: "#1E88E5", emoji: "ℹ️" },
  };

  const { color, emoji } = typeMap[type] || typeMap.success;

  return (
    <Portal>
      <Animated.View
        style={[
          styles.toast,
          {
            backgroundColor: color,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Text style={styles.text}>{emoji} {message}</Text>
      </Animated.View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    top: 40,
    left: width * 0.08,
    right: width * 0.08,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 20,
    elevation: 99,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    alignItems: "center",
  },
  text: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
