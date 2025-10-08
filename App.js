import 'react-native-gesture-handler';
import React, { useContext, useRef } from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Provider as PaperProvider, DefaultTheme } from "react-native-paper";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AuthProvider, AuthContext } from "./src/context/AuthContext";
import { buildHeaders } from './src/utils/api';
import { SUPERADMIN_EMAIL } from './src/config';
import { SyncProvider } from './src/context/SyncContext';
import { StatusBar, View, ActivityIndicator, Text } from "react-native";
import GlobalLoadingOverlay from "./src/components/GlobalLoadingOverlay";
import FloatingToast from './src/components/FloatingToast';
import { listen as listenToasts } from './src/utils/toastService';
import AdminAccessRequestsScreen from "./src/screens/AdminAccessRequestsScreen";
import { useDeepLinkHandler, parseTokenFromUrl } from './src/components/DeepLinkHandler';


// Schermate
import LoginScreen from "./src/screens/LoginScreen";
import ResetPasswordScreen from "./src/screens/ResetPasswordScreen";
import RequestAccessScreen from "./src/screens/RequestAccessScreen";
import AcceptInviteScreen from "./src/screens/AcceptInviteScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import UsersScreen from "./src/screens/UsersScreen";
import OrdersScreen from "./src/screens/OrdersScreen";
import ProductsScreen from "./src/screens/ProductsScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// 🔹 Tema personalizzato basato su DefaultTheme
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "#7E57C2",
    background: "#FFFFFF",
    text: "#222222",
    placeholder: "#555555",
  },
};

// 🔹 Tabs Admin
function AdminTabs({ pendingCount = 0, onPendingCountChange = () => {} }) {
  const { user } = useContext(AuthContext);
  const userEmail = (user?.email || '').toString().toLowerCase().trim();
  const superEmail = (SUPERADMIN_EMAIL || '').toString().toLowerCase().trim();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: "#7E57C2",
        tabBarInactiveTintColor: "#999",
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === "Home") iconName = "home";
          else if (route.name === "Prodotti") iconName = "basket";
          else if (route.name === "Utenti") iconName = "account-group";
          else if (route.name === "Ordini") iconName = "package-variant-closed";
          else if (route.name === "Impostazioni") iconName = "cog";
          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
      })}
      initialRouteName="Home"
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Prodotti" component={ProductsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Utenti" component={UsersScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Ordini" component={OrdersScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Impostazioni" component={SettingsScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

// Super admin sees an extra tab for access requests management
function SuperAdminTabs({ pendingCount = 0, onPendingCountChange }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: "#7E57C2",
        tabBarInactiveTintColor: "#999",
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === "Home") iconName = "home";
          else if (route.name === "Prodotti") iconName = "basket";
          else if (route.name === "Utenti") iconName = "account-group";
          else if (route.name === "Ordini") iconName = "package-variant-closed";
          else if (route.name === "Richieste") iconName = "email-alert";
          else if (route.name === "Impostazioni") iconName = "cog";
          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
      })}
      initialRouteName="Home"
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Prodotti" component={ProductsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Utenti" component={UsersScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Ordini" component={OrdersScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Richieste" options={{ headerShown: false, tabBarBadge: pendingCount > 0 ? pendingCount : undefined }}>
        {props => <AdminAccessRequestsScreen {...props} onPendingCountChange={onPendingCountChange} />}
      </Tab.Screen>
      <Tab.Screen name="Impostazioni" component={SettingsScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

function EmployeeTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={DashboardScreen} />
    </Tab.Navigator>
  );
}

function CustomerTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Prodotti" component={ProductsScreen} />
    </Tab.Navigator>
  );
}

// 🔹 Decide cosa mostrare in base a login/ruolo
function RootNavigator() {
  const { user, loading, token } = useContext(AuthContext);
  const [pendingCount, setPendingCount] = React.useState(0);

  React.useEffect(() => {
    const fetchPending = async () => {
      try {
        if (!token) return;
        const res = await fetch(`${require('./src/config').API_URL}/access-requests`, { headers: buildHeaders(token) });
        const data = await res.json().catch(() => []);
        if (res.ok && Array.isArray(data)) {
          setPendingCount(data.filter(d => d.status === 'pending').length);
        }
      } catch (e) {
        console.warn('Could not fetch pending count', e);
      }
    };
    fetchPending();
    // optional: poll every 30s
    const id = setInterval(fetchPending, 30000);
    return () => clearInterval(id);
  }, [token]);

  if (loading) return null; // puoi metterci uno SplashScreen o ActivityIndicator

  // DEBUG: show current user info in Metro console to verify superadmin detection
  try { console.log('[RootNavigator] user:', { email: user?.email, role: user?.role }); } catch (e) {}

  // If token exists but user object is temporarily missing (e.g. recovering from storage
  // or between login/logout transitions), render a lightweight loading placeholder instead
  // of immediately showing the login stack. Rendering the login stack in this transient
  // state caused the bottom navbar to disappear after quick logout/login sequences.
  if (!user && token) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#7E57C2" />
        <Text style={{ marginTop: 12, color: '#666' }}>Caricamento utente...</Text>
      </View>
    );
  }

  // If no user and no token, show unauthenticated stack
  if (!user) {
    return (
      <Stack.Navigator>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="RequestAccess" component={RequestAccessScreen} options={{ title: 'Richiedi accesso' }} />
        <Stack.Screen name="AcceptInvite" component={AcceptInviteScreen} options={{ title: 'Accetta invito' }} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Reset password' }} />
      </Stack.Navigator>
    );
  }

  // Defensive: if user exists but is missing critical fields, navigate to Login to re-authenticate
  const safeEmail = (user?.email || '').toString().toLowerCase().trim();
  const safeRole = (user?.role || '').toString().toLowerCase().trim();
  if (!safeEmail || !safeRole) {
    // fallback: render login stack so the app doesn't render broken tabs
    return (
      <Stack.Navigator>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="RequestAccess" component={RequestAccessScreen} options={{ title: 'Richiedi accesso' }} />
        <Stack.Screen name="AcceptInvite" component={AcceptInviteScreen} options={{ title: 'Accetta invito' }} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Reset password' }} />
      </Stack.Navigator>
    );
  }

  // Wrap tabs in a stack so we can push modal screens like NewOrder
  // If the logged-in user's email matches SUPERADMIN_EMAIL, show SuperAdminTabs
  const userEmail = (user?.email || '').toString().toLowerCase().trim();
  const superEmail = (SUPERADMIN_EMAIL || '').toString().toLowerCase().trim();
  const isSuperAdmin = userEmail && superEmail && userEmail === superEmail;

  const Tabs = user.role === 'admin'
    ? (isSuperAdmin ? (props) => <SuperAdminTabs {...props} pendingCount={pendingCount} onPendingCountChange={setPendingCount} /> : (props) => <AdminTabs {...props} pendingCount={pendingCount} onPendingCountChange={setPendingCount} />)
    : user.role === 'employee'
      ? EmployeeTabs
      : CustomerTabs;

  return (
    <Stack.Navigator initialRouteName="MainTabs">
      {/* Dashboard alias to support navigation to 'Dashboard' name */}
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Reset password' }} />
      <Stack.Screen name="MainTabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="NewOrder" component={require('./src/screens/NewOrderScreen').default} options={{ title: 'Nuovo ordine' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  const navigationRef = createNavigationContainerRef();

  // Global deep-link listener — routes to AcceptInvite or AdminAccessRequests
  useDeepLinkHandler((url) => {
    try {
      if (!navigationRef.isReady()) return;
      const parsed = url || '';
      // accept-invite?token=...
      if (parsed.includes('accept-invite')) {
        const token = parseTokenFromUrl(parsed);
        if (token) navigationRef.navigate('AcceptInvite', { token });
        return;
      }
      // admin access link: gestionexus://admin/access-request?id=123 or path admin/access-request
      if (parsed.includes('admin/access-request') || parsed.includes('/admin/access-requests/')) {
        // extract id param
        const match = parsed.match(/[?&]id=(\d+)/);
        const id = match ? match[1] : null;
        if (id) {
          // navigate to the nested tab 'Richieste' inside MainTabs and pass id
          try {
            navigationRef.navigate('MainTabs', { screen: 'Richieste', params: { id } });
          } catch (e) {
            console.warn('Deep-link navigate to Richieste failed', e);
          }
        }
      }
    } catch (e) {
      console.warn('DeepLink routing error', e);
    }
  });

  return (
    <AuthProvider>
      <SyncProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <StatusBar
          backgroundColor="transparent"
          barStyle="dark-content" // icone scure → elegante su sfondo chiaro
          translucent
        />
        <NavigationContainer ref={navigationRef}>
          <RootNavigator />
        </NavigationContainer>
        {/* Global toast host: subscribe to toastService */}
        <ToastHost />
        {/* overlay globale per processi di auth (login) */}
        <AuthContext.Consumer>
          {({ authProcessing }) => <GlobalLoadingOverlay visible={authProcessing} />}
        </AuthContext.Consumer>
        </PaperProvider>
      </GestureHandlerRootView>
      </SyncProvider>
    </AuthProvider>
  );
}

function ToastHost() {
  const [toast, setToast] = React.useState({ visible: false, message: '', type: 'success' });
  React.useEffect(() => {
    const unsub = listenToasts(({ message, type }) => {
      setToast({ visible: true, message, type });
      // hide after FloatingToast lifecycle calls onHide via internal timer
    });
    return () => unsub();
  }, []);

  return <FloatingToast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast({ ...toast, visible: false })} />;
}
