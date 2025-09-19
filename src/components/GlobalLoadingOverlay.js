import React from "react";
import { View, StyleSheet } from "react-native";
import { ActivityIndicator, Text } from "react-native-paper";

export default function GlobalLoadingOverlay({ visible }) {
  if (!visible) return null;

  // Render without Portal to avoid potential internal Portal/React issues
  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.card}>
        <ActivityIndicator animating={true} size={56} color="#7E57C2" />
        <Text style={styles.text}>Accesso in corso...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
  },
  text: { marginTop: 12, color: "#333", fontWeight: "600" },
});
