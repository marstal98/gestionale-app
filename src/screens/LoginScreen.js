import React, { useState, useContext } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { TextInput, Button, Text } from "react-native-paper";
import FloatingToast from "../components/FloatingToast";
import { AuthContext } from "../context/AuthContext";
import { API_URL, MIN_LOGIN_SPINNER_MS } from "../config";
import { ActivityIndicator } from "react-native-paper";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState("error");

  const { login, setAuthProcessing } = useContext(AuthContext);

  const handleLogin = async () => {
  const minDuration = MIN_LOGIN_SPINNER_MS; // ms
    let start = Date.now();
    // Validazioni client-side
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setToastMsg("Inserisci un'email valida");
      setToastType("error");
      setToastVisible(true);
      return;
    }

    if (!password || password.length < 8) {
      setToastMsg("La password deve avere almeno 8 caratteri");
      setToastType("error");
      setToastVisible(true);
      return;
    }

    try {
      setLoading(true);
      setAuthProcessing(true);
      // start counting from when spinner becomes visible
      start = Date.now();
      console.log("Invio login a:", `${API_URL}/auth/login`);

      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      console.log("Status:", response.status);

      const data = await response.json();
      console.log("Risposta:", data);

      if (!response.ok) {
        // wait the minimum before hiding spinner and showing error
        const elapsed = Date.now() - start;
        if (elapsed < minDuration) {
          await new Promise((r) => setTimeout(r, minDuration - elapsed));
        }
        setToastMsg(data.error || "Credenziali non valide");
        setToastType("error");
        setToastVisible(true);
        return;
      }

      // success: wait remaining time, then call login (which may navigate away)
      const elapsedSuccess = Date.now() - start;
      if (elapsedSuccess < minDuration) {
        await new Promise((r) => setTimeout(r, minDuration - elapsedSuccess));
      }

      // Ensure we await login but also guard against unexpected errors
      try {
        await login(data);
      } catch (innerErr) {
        console.error("Errore durante login():", innerErr);
        setToastMsg("Errore interno durante l'accesso");
        setToastType("error");
        setToastVisible(true);
      }

    } catch (err) {
      console.error("Errore fetch:", err);
      const elapsedErr = Date.now() - start;
      if (elapsedErr < minDuration) {
        await new Promise((r) => setTimeout(r, minDuration - elapsedErr));
      }
      setToastMsg("Impossibile connettersi al server");
      setToastType("error");
      setToastVisible(true);
    } finally {
      // Always clear loading/authProcessing in a finally block
      setLoading(false);
      setAuthProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Accedi</Text>

      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        mode="outlined"
        style={styles.input}
      />

      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        mode="outlined"
        style={styles.input}
      />

      <Button
        mode="contained"
        onPress={handleLogin}
        loading={loading}
        disabled={loading}
        style={styles.button}
      >
        Accedi
      </Button>
      {/* Loading overlay */}
      {loading && (
        <Animated.View style={styles.loadingOverlay} pointerEvents="auto">
          <View style={styles.loadingCard}>
            <ActivityIndicator animating={true} size={48} color="#7E57C2" />
            <Text style={{ marginTop: 12, fontWeight: "600", color: "#333" }}>Accesso in corso...</Text>
          </View>
        </Animated.View>
      )}
      <FloatingToast
        visible={toastVisible}
        message={toastMsg}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#fff" },
  title: { fontSize: 26, fontWeight: "600", textAlign: "center", marginBottom: 30 },
  input: { marginBottom: 15 },
  button: { marginTop: 20 },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  loadingCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
});
