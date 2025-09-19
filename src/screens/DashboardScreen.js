import React, { useContext, useEffect, useState, useLayoutEffect } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, IconButton, Button, useTheme } from "react-native-paper";
import { AuthContext } from "../context/AuthContext";
import StatCard from "../components/StatCard";
import MiniBarChart from "../components/MiniBarChart";
import QuickList from "../components/QuickList";
import { API_URL } from "../config";

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useContext(AuthContext);
  const theme = useTheme();
  const [stats, setStats] = useState({ users: 0, orders: 0, inProgress: 0, completed: 0 });
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  // mock fetch - replace with real API calls if available
  const { token } = useContext(AuthContext);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [uRes, oRes] = await Promise.all([
          fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/orders`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const usersData = uRes.ok ? await uRes.json() : [];
        const ordersData = oRes.ok ? await oRes.json() : [];

        // stats
        const totalUsers = Array.isArray(usersData) ? usersData.length : 0;
        const totalOrders = Array.isArray(ordersData) ? ordersData.length : 0;
        // count completed vs in progress (best-effort based on status field)
        const completed = Array.isArray(ordersData)
          ? ordersData.filter((o) => (o.status || '').toString().toLowerCase().includes('complet')).length
          : 0;
        const inProgress = totalOrders - completed;

        setStats({ users: totalUsers, orders: totalOrders, inProgress, completed });

        // recent users - take latest by createdAt if present
        if (Array.isArray(usersData)) {
          const recent = [...usersData]
            .sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0,5)
            .map(u => ({ title: u.name || u.email || 'Utente', meta: u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '' }));
          setRecentUsers(recent);
        }

        if (Array.isArray(ordersData)) {
          const recentO = [...ordersData]
            .sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
            .slice(0,5)
            .map(o => ({ title: `#${o.id || o.orderNumber || o._id || 'N/A'}`, meta: o.status || '' }));
          setRecentOrders(recentO);
        }

      } catch (err) {
        console.error('Errore caricamento dashboard:', err);
      }
    };

    loadData();
  }, [token]);

  // Admin layout
  // set logout icon in header
  // header hidden by navigator options (no top navigation on Home)

  if (user?.role === 'admin') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingTop: 48 }}>
        <View style={[styles.headerRow, { alignItems: 'center' }] }>
          <Text style={styles.title}>Ciao {user?.name} 👋</Text>
          <IconButton
            icon="logout-variant"
            size={24}
            color={theme.colors.primary}
            onPress={logout}
            accessibilityLabel="Logout"
            style={{ marginLeft: 'auto' }}
          />
        </View>

        <View style={[styles.row, styles.section]}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <StatCard title="Totale utenti" value={stats.users} />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <StatCard title="Totale ordini" value={stats.orders} />
          </View>
        </View>

        <View style={[styles.row, styles.section]}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <StatCard title="In corso" value={stats.inProgress} color="#FFC107" />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <StatCard title="Completati" value={stats.completed} color="#4CAF50" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={{ fontWeight: '700', marginBottom: 8 }}>Andamento ordini (ultimi 30 giorni)</Text>
          <MiniBarChart data={[3,5,2,6,8,4,7,5,6,8,4,6,7,8,5,4,3,5,6,7,8,6,5,4,3,2,5,6,4,7]} />
        </View>

        {/* quick buttons removed as requested */}

        <View style={styles.section}>
          <QuickList title="Ultimi utenti" items={recentUsers} />
        </View>

        <View style={styles.section}>
          <QuickList title="Ultimi ordini" items={recentOrders} />
        </View>

      </ScrollView>
    );
  }

  // Employee layout
  if (user?.role === 'employee') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingTop: 48 }}>
        <Text style={styles.title}>Ciao {user?.name} 👋</Text>

        <View style={styles.section}>
          <Text style={{ fontWeight: '700', marginBottom: 8 }}>Ordini assegnati a te</Text>
          <QuickList items={[{ title: '#2001', meta: 'Scadenza: domani - In corso' }, { title: '#1999', meta: 'Scadenza: 3 giorni - In corso' }]} />
        </View>

        <View style={styles.section}>
          <Text style={{ fontWeight: '700' }}>Task giornalieri</Text>
          <QuickList items={[{ title: 'Controllo spedizioni', meta: 'Oggi' }, { title: 'Verifica stock', meta: 'Oggi' }]} />
        </View>

        <View style={styles.section}>
          <Text style={{ fontWeight: '700', marginBottom: 8 }}>Ordini chiusi recentemente</Text>
          <MiniBarChart data={[2,3,1,4,2,3,5]} color="#4CAF50" />
        </View>
      </ScrollView>
    );
  }

  // Customer layout
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingTop: 48 }}>
      <Text style={styles.title}>Ciao {user?.name} 👋</Text>

      <View style={styles.section}>
        <Text style={{ marginBottom: 12 }}>I miei ordini recenti</Text>
        <QuickList items={[{ title: '#3001', meta: 'In corso' }, { title: '#2999', meta: 'Completato' }]} />
      </View>

      <Button mode="contained" icon="plus" style={{ marginBottom: 12 }}>Nuovo ordine</Button>

      <View style={styles.section}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Notifiche</Text>
        <QuickList items={[{ title: 'Offerta 10% su ordini > 100€', meta: 'Scadenza: 30/09' }]} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9FB' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16, paddingTop: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  row: { flexDirection: 'row', marginBottom: 16 },
  section: { marginBottom: 18 }
});
