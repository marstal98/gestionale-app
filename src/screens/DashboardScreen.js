import React, { useContext, useEffect, useState, useLayoutEffect } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Text, IconButton, Button, useTheme } from "react-native-paper";
import { AuthContext } from "../context/AuthContext";
import { buildHeaders } from '../utils/api';
import { SyncContext } from '../context/SyncContext';
import StatCard from "../components/StatCard";
import MiniBarChart from "../components/MiniBarChart";
import QuickList from "../components/QuickList";
import TopMetrics from "../components/TopMetrics";
import RecentOrdersCard from "../components/RecentOrdersCard";
import BackendIntegrationTest from "../components/BackendIntegrationTest";
import { API_URL } from "../config";
import { 
  useResponsive, 
  wp, 
  hp, 
  getSpacing, 
  getComponentSize, 
  scaleFontSize, 
  createResponsiveStyles,
  getGridLayout 
} from '../utils/responsive';

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useContext(AuthContext);
  const theme = useTheme();
  const [stats, setStats] = useState({ users: 0, orders: 0, inProgress: 0, completed: 0 });
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [lowStock, setLowStock] = useState([]);

  // mock fetch - replace with real API calls if available
  const { token } = useContext(AuthContext);
  const { refreshKey } = useContext(SyncContext);
  const { isTablet, deviceType } = useResponsive();
  const gridLayout = getGridLayout();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [uRes, oRes, pRes] = await Promise.all([
          fetch(`${API_URL}/users`, { headers: buildHeaders(token) }),
          fetch(`${API_URL}/orders`, { headers: buildHeaders(token) }),
          fetch(`${API_URL}/products`, { headers: buildHeaders(token) }),
        ]);

        const uDataRaw = uRes.ok ? await uRes.json() : [];
  const oDataRaw = oRes.ok ? await oRes.json() : [];
  const pDataRaw = pRes.ok ? await pRes.json() : [];
        // normalize API responses which sometimes return { ok:true, data: [...] }
        const usersData = Array.isArray(uDataRaw) ? uDataRaw : (uDataRaw?.data || []);
        const ordersData = Array.isArray(oDataRaw) ? oDataRaw : (oDataRaw?.data || []);

        // stats
        const totalUsers = Array.isArray(usersData) ? usersData.length : 0;
        const totalOrders = Array.isArray(ordersData) ? ordersData.length : 0;
        // per-status counts
        const countByStatus = { draft: 0, pending: 0, in_progress: 0, completed: 0 };
        if (Array.isArray(ordersData)) {
          for (const o of ordersData) {
            const s = (o.status || '').toString();
            if (s === 'draft') countByStatus.draft += 1;
            else if (s === 'pending') countByStatus.pending += 1;
            else if (s === 'in_progress') countByStatus.in_progress += 1;
            else if (s === 'completed') countByStatus.completed += 1;
            // other statuses ignored for summary
          }
        }
        const completed = countByStatus.completed;
        const inProgress = countByStatus.in_progress;

        // build last 30 days counts for chart using per-order bucketing
        const buckets = Array.from({ length: 30 }).map(() => 0);
        const today = new Date();
        const todayStart = new Date(today);
        todayStart.setHours(0,0,0,0);
        const msPerDay = 24 * 60 * 60 * 1000;

        if (Array.isArray(ordersData)) {
          for (const o of ordersData) {
            const dateStr = o.createdAt || o.created_at || o.created || o.createdAtAt || null;
            if (!dateStr) continue;
            const d = new Date(dateStr);
            if (Number.isNaN(d.getTime())) continue;
            // difference in whole days from todayStart
            const diff = Math.floor((todayStart - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / msPerDay);
            // diff = 0 means order is today, diff = 1 yesterday, ..., diff = 29 -> 29 days ago
            if (diff >= 0 && diff < 30) {
              // index: oldest (29 days ago) -> newest (0 days ago)
              const idx = 29 - diff;
              buckets[idx] = (buckets[idx] || 0) + 1;
            }
          }
        }

        // debug log: show counts and buckets
        try { console.log('[Dashboard] orders:', Array.isArray(ordersData) ? ordersData.length : 0, 'buckets:', buckets); } catch (e) {}

  // compute simple revenue metric (sum of order.total where present)
  const revenue = Array.isArray(ordersData) ? ordersData.reduce((s, it) => s + (Number(it.total) || 0), 0) : 0;
  setStats({ users: totalUsers, orders: totalOrders, draft: countByStatus.draft, pending: countByStatus.pending, inProgress, completed, revenue, last30: buckets });

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
            .slice(0,6);
          setRecentOrders(recentO);
        }

        // Low stock products (threshold: <= 5)
        const productsData = Array.isArray(pDataRaw) ? pDataRaw : (pDataRaw?.data || []);
        if (Array.isArray(productsData)) {
          const low = productsData
            .filter(p => typeof p.stock === 'number' && p.stock <= 50) // only show up to 50
            .map(p => ({ ...p }))
            .sort((a,b) => a.stock - b.stock)
            .slice(0,6)
            .map(p => {
              let color = '#4CAF50'; // green (basso)
              if (p.stock <= 5) color = '#E53935'; // red critical
              else if (p.stock <= 20) color = '#FB8C00'; // amber medium
              return { title: p.name || `Prod ${p.id}`, meta: `Disponibilità: ${p.stock}`, metaColor: color };
            });
          setLowStock(low);
        }

      } catch (err) {
        console.error('Errore caricamento dashboard:', err);
      }
    };

    loadData();
  }, [token, refreshKey]);

  // Stili responsive
  const responsiveStyles = createResponsiveStyles(({ isTablet, getSpacing, scaleFontSize, getComponentSize }) => ({
    container: {
      flex: 1,
      backgroundColor: '#F9F9FB'
    },
    contentContainer: {
      padding: getSpacing(16),
      paddingTop: getSpacing(48),
      maxWidth: isTablet ? wp(90) : '100%',
      alignSelf: 'center',
      width: '100%'
    },
    headerRow: {
      flexDirection: isTablet ? 'row' : 'column',
      alignItems: isTablet ? 'center' : 'flex-start',
      marginBottom: getSpacing(12),
      justifyContent: 'space-between'
    },
    headerContent: {
      flex: 1
    },
    title: {
      fontSize: scaleFontSize(20),
      fontWeight: '700',
      marginBottom: getSpacing(4),
      paddingTop: getSpacing(12)
    },
    subtitle: {
      color: '#666',
      fontSize: scaleFontSize(14),
      marginBottom: isTablet ? 0 : getSpacing(8)
    },
    section: {
      marginBottom: getSpacing(18)
    },
    sectionTitle: {
      fontWeight: '700',
      marginBottom: getSpacing(8),
      fontSize: scaleFontSize(16)
    },
    buttonsContainer: {
      flexDirection: isTablet ? 'row' : 'column',
      gap: getSpacing(8)
    },
    button: {
      marginTop: getSpacing(8),
      flex: isTablet ? 1 : undefined
    },
    gridContainer: {
      flexDirection: isTablet ? 'row' : 'column',
      gap: getSpacing(16)
    },
    gridItem: {
      flex: isTablet ? 1 : undefined
    }
  }));

  // Admin layout
  if (user?.role === 'admin') {
    return (
      <ScrollView 
        style={responsiveStyles.container} 
        contentContainerStyle={responsiveStyles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={responsiveStyles.headerRow}>
          <View style={responsiveStyles.headerContent}>
            <Text style={responsiveStyles.title}>Benvenuto, {user?.name}</Text>
            <Text style={responsiveStyles.subtitle}>Panoramica rapida delle attività</Text>
          </View>
          <IconButton
            icon="logout-variant"
            size={getComponentSize('iconSize')}
            iconColor={theme.colors.primary}
            onPress={logout}
            accessibilityLabel="Logout"
          />
        </View>

        <View style={responsiveStyles.section}>
          <TopMetrics metrics={stats} />
        </View>

        <View style={responsiveStyles.section}>
          <Text style={responsiveStyles.sectionTitle}>Andamento ordini (ultimi 30 giorni)</Text>
          <MiniBarChart data={stats?.last30 || []} />
        </View>

        <View style={responsiveStyles.section}>
          <RecentOrdersCard orders={recentOrders} />
        </View>

        <View style={responsiveStyles.gridContainer}>
          <View style={responsiveStyles.gridItem}>
            <QuickList title="Prodotti a basso stock" items={lowStock} />
          </View>
          
          {isTablet && <View style={responsiveStyles.gridItem}>
            <QuickList title="Ultimi utenti" items={recentUsers} />
          </View>}
        </View>

        {!isTablet && <View style={responsiveStyles.section}>
          <QuickList title="Ultimi utenti" items={recentUsers} />
        </View>}

        <View style={responsiveStyles.section}>
          <View style={responsiveStyles.buttonsContainer}>
            <Button 
              mode="outlined" 
              icon="test-tube" 
              onPress={() => navigation.navigate('BackendTest')}
              style={responsiveStyles.button}
            >
              Test Integrazione Backend
            </Button>
            
            <Button 
              mode="outlined" 
              icon="bell-ring" 
              onPress={() => navigation.navigate('NotificationTest')}
              style={responsiveStyles.button}
            >
              🔔 Test Notifiche Push
            </Button>
          </View>
        </View>

      </ScrollView>
    );
  }

  // Employee layout
  if (user?.role === 'employee') {
    return (
      <ScrollView 
        style={responsiveStyles.container} 
        contentContainerStyle={responsiveStyles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={responsiveStyles.headerRow}>
          <View style={responsiveStyles.headerContent}>
            <Text style={responsiveStyles.title}>Ciao {user?.name} 👋</Text>
          </View>
          <IconButton
            icon="logout-variant"
            size={getComponentSize('iconSize')}
            iconColor={theme.colors.primary}
            onPress={logout}
            accessibilityLabel="Logout"
          />
        </View>

        <View style={responsiveStyles.section}>
          <Text style={responsiveStyles.sectionTitle}>Ordini assegnati a te</Text>
          <QuickList items={[{ title: '#2001', meta: 'Scadenza: domani - In corso' }, { title: '#1999', meta: 'Scadenza: 3 giorni - In corso' }]} />
        </View>

        <View style={responsiveStyles.section}>
          <Text style={responsiveStyles.sectionTitle}>Task giornalieri</Text>
          <QuickList items={[{ title: 'Controllo spedizioni', meta: 'Oggi' }, { title: 'Verifica stock', meta: 'Oggi' }]} />
        </View>

        <View style={responsiveStyles.section}>
          <Text style={responsiveStyles.sectionTitle}>Ordini chiusi recentemente</Text>
          <MiniBarChart data={[2,3,1,4,2,3,5]} color="#4CAF50" />
        </View>
      </ScrollView>
    );
  }

  // Customer layout
  return (
    <ScrollView 
      style={responsiveStyles.container} 
      contentContainerStyle={responsiveStyles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={responsiveStyles.headerRow}>
        <View style={responsiveStyles.headerContent}>
          <Text style={responsiveStyles.title}>Ciao {user?.name} 👋</Text>
        </View>
        <IconButton
          icon="logout-variant"
          size={getComponentSize('iconSize')}
          iconColor={theme.colors.primary}
          onPress={logout}
          accessibilityLabel="Logout"
        />
      </View>

      <View style={responsiveStyles.section}>
        <Text style={responsiveStyles.sectionTitle}>I miei ordini recenti</Text>
        <QuickList items={[{ title: '#3001', meta: 'In corso' }, { title: '#2999', meta: 'Completato' }]} />
      </View>

      <Button 
        mode="contained" 
        icon="plus" 
        style={[responsiveStyles.button, { marginBottom: getSpacing(12) }]}
      >
        Nuovo ordine
      </Button>

      <View style={responsiveStyles.section}>
        <Text style={responsiveStyles.sectionTitle}>Notifiche</Text>
        <QuickList items={[{ title: 'Offerta 10% su ordini > 100€', meta: 'Scadenza: 30/09' }]} />
      </View>
    </ScrollView>
  );
}

// Stili rimossi - ora usati responsiveStyles inline
