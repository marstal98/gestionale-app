import React, { useState, useContext, useCallback } from "react";
import { View, StyleSheet, Animated, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { TextInput, Button, Text, IconButton, Portal, Dialog, Paragraph, ActivityIndicator } from "react-native-paper";
import RequiredTextInput from '../components/RequiredTextInput';
import { showToast } from '../utils/toastService';
import { AuthContext } from "../context/AuthContext";
import { API_URL, MIN_LOGIN_SPINNER_MS } from "../config";
// consolidated imports above
import { useDeepLinkHandler, parseTokenFromUrl } from '../components/DeepLinkHandler';
import { safeMessageFromData } from '../utils/errorUtils';
import PasswordInput from '../components/PasswordInput';
import { 
  useResponsive, 
  wp, 
  hp, 
  getSpacing, 
  getComponentSize, 
  scaleFontSize, 
  createResponsiveStyles 
} from '../utils/responsive';

export default function LoginScreen({ navigation, route }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [helpVisible, setHelpVisible] = useState(false);

  const { login, setAuthProcessing } = useContext(AuthContext);
  const { isTablet, deviceType } = useResponsive();

  // deep link handler: if app opened with gestionexus://accept-invite?token=... navigate
  const handleLink = useCallback((url) => {
    try {
      const token = parseTokenFromUrl(url);
      if (token) {
        // navigate to AcceptInvite and pass token
        // we use navigation by exposing it via props? LoginScreen is a direct stack screen and receives navigation implicitly
        navigation.navigate('AcceptInvite', { token });
      }
    } catch (e) {
      console.warn('Deep link parse error', e);
    }
  }, [navigation]);

  useDeepLinkHandler(handleLink);

  const handleLogin = async () => {
  const minDuration = MIN_LOGIN_SPINNER_MS; // ms
    let start = Date.now();
    // Validazioni client-side
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showToast("Inserisci un'email valida", 'error');
      return;
    }

    if (!password || password.length < 8) {
      showToast("La password deve avere almeno 8 caratteri", 'error');
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
        const safe = safeMessageFromData(data, "Credenziali non valide");
        showToast(safe, 'error');
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
        // If came from a deep-link wanting to open AdminAccessRequests, and user is admin
        // after successful login, let the app show the default tabs (Home) —
        // deep-link handling will route to Richieste if appropriate when the app is opened via link.
      } catch (innerErr) {
        console.error("Errore durante login():", innerErr);
        showToast("Errore interno durante l'accesso", 'error');
      }

    } catch (err) {
      console.error("Errore fetch:", err);
      const elapsedErr = Date.now() - start;
      if (elapsedErr < minDuration) {
        await new Promise((r) => setTimeout(r, minDuration - elapsedErr));
      }
      showToast("Impossibile connettersi al server", 'error');
    } finally {
      // Always clear loading/authProcessing in a finally block
      setLoading(false);
      setAuthProcessing(false);
    }
  };

  const handleForgot = async () => {
    if (!forgotEmail) {
      showToast('Inserisci l\'email', 'error'); return;
    }
    try {
      const res = await fetch(`${API_URL}/auth/request-reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: forgotEmail }) });
      if (res.ok) {
        showToast('Se l\'email esiste, riceverai le istruzioni.', 'success'); setForgotVisible(false); setForgotEmail('');
      } else {
        const b = await res.json().catch(() => ({}));
        const safe = safeMessageFromData(b || {}, 'Errore');
        showToast(safe, 'error');
      }
  } catch (e) { console.error('Forgot error', e); showToast('Impossibile contattare il server', 'error'); }
  };

  const responsiveStyles = createResponsiveStyles(({ isTablet, getSpacing, getComponentSize, scaleFontSize }) => ({
    container: {
      flex: 1,
      backgroundColor: "#fff",
      padding: getSpacing(20),
      justifyContent: "center",
      alignItems: "center"
    },
    formContainer: {
      width: isTablet ? wp(60) : wp(90),
      maxWidth: isTablet ? 500 : 400,
      alignSelf: "center"
    },
    title: {
      fontSize: scaleFontSize(26),
      fontWeight: "600",
      textAlign: "center",
      marginBottom: getSpacing(30),
      color: "#333"
    },
    input: {
      marginBottom: getSpacing(15),
      height: getComponentSize('inputHeight')
    },
    button: {
      marginTop: getSpacing(20),
      height: getComponentSize('buttonHeight'),
      justifyContent: 'center'
    },
    buttonsRow: {
      flexDirection: isTablet ? 'row' : 'column',
      justifyContent: 'center',
      alignItems: 'center',
      marginVertical: getSpacing(10),
      flexWrap: 'wrap'
    },
    buttonGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: getSpacing(5)
    },
    spacer: {
      width: getSpacing(12)
    }
  }));

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={responsiveStyles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={responsiveStyles.formContainer}>
          <Text style={responsiveStyles.title}>Accedi</Text>

          <RequiredTextInput
            label="Email"
            name="Email"
            required
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            style={responsiveStyles.input}
          />

          <PasswordInput 
            label="Password" 
            value={password} 
            onChangeText={setPassword} 
            required 
            style={responsiveStyles.input} 
          />

          <View style={responsiveStyles.buttonsRow}>
            <View style={responsiveStyles.buttonGroup}>
              <Button onPress={() => setForgotVisible(true)} mode="text">
                Hai dimenticato la password?
              </Button>
              {isTablet && <View style={responsiveStyles.spacer} />}
            </View>
            
            <View style={responsiveStyles.buttonGroup}>
              <Button onPress={() => navigation.navigate('RequestAccess')} mode="text">
                Richiedi accesso
              </Button>
              <TouchableOpacity 
                accessibilityLabel="Spiegazione modalità accesso" 
                onPress={() => setHelpVisible(true)} 
                style={{ marginLeft: 6 }}
              >
                <IconButton 
                  icon="help-circle-outline" 
                  size={getComponentSize('iconSize')} 
                  iconColor="#7E57C2" 
                  accessibilityLabel="Aiuto accesso" 
                />
              </TouchableOpacity>
            </View>
          </View>

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={responsiveStyles.button}
          >
            Accedi
          </Button>
        </View>
      </ScrollView>
      
      {/* Loading overlay */}
      {loading && (
        <Animated.View style={styles.loadingOverlay} pointerEvents="auto">
          <View style={styles.loadingCard}>
            <ActivityIndicator animating={true} size={48} color="#7E57C2" />
            <Text style={{ marginTop: 12, fontWeight: "600", color: "#333" }}>Accesso in corso...</Text>
          </View>
        </Animated.View>
      )}
      
      <Portal>
        <Dialog visible={forgotVisible} onDismiss={() => setForgotVisible(false)}>
          <Dialog.Title>Reset password</Dialog.Title>
          <Dialog.Content>
            <RequiredTextInput label="Email" name="Email" required value={forgotEmail} onChangeText={setForgotEmail} keyboardType="email-address" onInvalid={(n) => { showToast(`Campo ${n} obbligatorio`, 'error'); }} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setForgotVisible(false)}>Annulla</Button>
            <Button onPress={handleForgot}>Invia</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={helpVisible} onDismiss={() => setHelpVisible(false)} style={{ padding: 8 }}>
          <Dialog.Title style={{ fontSize: 20, fontWeight: '700' }}>Come funziona l'accesso</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={{ marginBottom: 8 }}>Questa applicazione è usata dai clienti e dal personale interno. Non c'è un form di registrazione pubblico per motivi di sicurezza e per gestire gli accessi centralmente.</Paragraph>
            <Paragraph style={{ fontWeight: '700', marginBottom: 6 }}>Modalità per ottenere le credenziali</Paragraph>
            <Paragraph>1) Se lavori per un'azienda, chiedi all'amministratore della tua azienda di aggiungerti. Riceverai un invito via email con istruzioni.</Paragraph>
            <Paragraph>2) Se non sei registrato, usa il pulsante "Richiedi accesso" per inviare una richiesta al team: ti risponderemo indicando come procedere.</Paragraph>
            <Paragraph style={{ marginTop: 8, fontStyle: 'italic' }}>Inserisci qui l'email associata al tuo profilo (es. aziendale) e usa la password ricevuta o impostata tramite la procedura di reset.</Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setHelpVisible(false)}>Chiudi</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
