import React, { useContext } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Provider as PaperProvider, DefaultTheme } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AuthProvider, AuthContext } from "./src/context/AuthContext";
import { StatusBar } from "react-native";
import GlobalLoadingOverlay from "./src/components/GlobalLoadingOverlay";


// Schermate
import LoginScreen from "./src/screens/LoginScreen";
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
function AdminTabs() {
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
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Prodotti" component={ProductsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Utenti" component={UsersScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Ordini" component={OrdersScreen} options={{ headerShown: false }} />
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
  const { user, loading } = useContext(AuthContext);

  if (loading) return null; // puoi metterci uno SplashScreen o ActivityIndicator

  if (!user) {
    return (
      <Stack.Navigator>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    );
  }

  if (user.role === "admin") return <AdminTabs />;
  if (user.role === "employee") return <EmployeeTabs />;
  return <CustomerTabs />;
}

export default function App() {
  return (
    <AuthProvider>
      <PaperProvider theme={theme}>
        <StatusBar
          backgroundColor="transparent"
          barStyle="dark-content" // icone scure → elegante su sfondo chiaro
          translucent
        />
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
        {/* overlay globale per processi di auth (login) */}
        <AuthContext.Consumer>
          {({ authProcessing }) => <GlobalLoadingOverlay visible={authProcessing} />}
        </AuthContext.Consumer>
      </PaperProvider>
    </AuthProvider>
  );
}
