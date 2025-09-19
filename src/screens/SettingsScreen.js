import React from "react";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Impostazioni ⚙️</Text>
      <Text>Qui ci saranno le opzioni di configurazione.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 15,
    color: "#222",
  },
});
