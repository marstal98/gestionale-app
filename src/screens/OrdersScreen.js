import React, { useContext, useEffect, useState, useRef, useMemo } from "react";
import { useFocusEffect } from '@react-navigation/native';
import { View, StyleSheet, FlatList, StatusBar, TouchableOpacity, Animated } from "react-native";
import { Text, Card, Button, Portal, Dialog, TextInput, FAB, IconButton, Chip, Badge, useTheme, ActivityIndicator } from "react-native-paper";
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { Swipeable } from 'react-native-gesture-handler';
import SearchInput from '../components/SearchInput';
import FloatingToast from '../components/FloatingToast';
import AssigneePicker from '../components/AssigneePicker';
import OrdersFilterModal from '../components/OrdersFilterModal';
import { AuthContext } from "../context/AuthContext";
import { SyncContext } from "../context/SyncContext";
import { API_URL } from "../config";

export default function OrdersScreen({ navigation }) {
  const { token, user } = useContext(AuthContext);
  const { triggerRefresh, refreshKey } = useContext(SyncContext);
  // store raw server items here and derive `orders` (active vs trash) from it
  const [apiItems, setApiItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [apiRawCount, setApiRawCount] = useState(null);
  const [apiRawSample, setApiRawSample] = useState([]);
  const [apiRawSampleDetails, setApiRawSampleDetails] = useState([]);
  const [apiRawSampleFull, setApiRawSampleFull] = useState([]);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const [pickerVisible, setPickerVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({ status: [], customers: [], assignees: [] });
  const [showTrash, setShowTrash] = useState(false); // Cestino mode: show deleted orders
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exporting, setExporting] = useState(false);

  const activeFiltersCount = (() => {
    let c = 0;
    if (appliedFilters.status && appliedFilters.status.length > 0) c += appliedFilters.status.length;
    if (appliedFilters.customers && appliedFilters.customers.length > 0) c += appliedFilters.customers.length;
    if (appliedFilters.assignees && appliedFilters.assignees.length > 0) c += appliedFilters.assignees.length;
    return c;
  })();

  const theme = useTheme();
  const badgeScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (activeFiltersCount > 0) {
      Animated.sequence([
        Animated.timing(badgeScale, { toValue: 1.25, duration: 140, useNativeDriver: true }),
        Animated.spring(badgeScale, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
    }
  }, [activeFiltersCount, badgeScale]);

  // order form
  const [showDialog, setShowDialog] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]); // [{productId, quantity}]
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]); // array of selected order ids for bulk actions
  const [bulkDeleteDialogVisible, setBulkDeleteDialogVisible] = useState(false);
  const swipeableRefs = useRef(new Map());
  const autoClearAttemptRef = useRef(false);
  const latestFetchRef = useRef(0);

  const fetchData = async () => {
    // allow explicit override to fetch only deleted or only active orders
    // signature: fetchData(overrideShowTrash, showLoading = true)
    const effectiveShowTrash = (typeof arguments[0] !== 'undefined') ? arguments[0] : showTrash;
    const showLoading = (typeof arguments[1] !== 'undefined') ? arguments[1] : true;
    return await (async () => {
      const fetchId = ++latestFetchRef.current;
      try {
        if (showLoading) setLoading(true);
        const ordersUrl = `${API_URL}/orders${effectiveShowTrash ? '?deleted=true' : '?deleted=false'}`;
        const [oRes, pRes] = await Promise.all([
          fetch(ordersUrl, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/products`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        const oData = await oRes.json();
        const pData = await pRes.json();
        if (oRes.ok) {
          const rawArr = Array.isArray(oData) ? oData : (oData?.data || []);
          // debug: expose raw API results counts/samples (ids + details)
          try {
            setApiRawCount(rawArr.length);
            const sample = rawArr.slice(0,5);
            setApiRawSample(sample.map(a => a.id));
            setApiRawSampleDetails(sample.map(a => ({ id: a.id, status: a.status || null, deletedAt: a.deletedAt || null })));
            setApiRawSampleFull(sample);
          } catch(e){}
          let arr = rawArr;
          // dev-only logging to investigate missing counts in Orders screen
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            try {
              console.debug('fetchData: oRes.ok=', oRes.ok, 'rawArr.length=', rawArr.length, 'search=', String(search), 'appliedFilters=', JSON.stringify(appliedFilters));
              console.debug('fetchData: sample ids=', rawArr.slice(0,5).map(a => a.id));
            } catch (e) { /* ignore logging errors */ }
          }
          // enforce exclusive view: trash shows only deleted, active shows only non-deleted
          if (effectiveShowTrash) arr = arr.filter(a => !!a.deletedAt);
          else arr = arr.filter(a => !a.deletedAt);

          // If the API returned items but client filters/search removed all of them,
          // auto-clear search and filters once and force Active view so user sees created items.
          if (rawArr.length > 0 && arr.length === 0 && !autoClearAttemptRef.current) {
            console.warn('fetchData: API returned items but client filters excluded them; auto-clearing search/filters and forcing Active view');
            autoClearAttemptRef.current = true;
            try { setSearch(''); } catch (e) {}
            try { setAppliedFilters({ status: [], customers: [], assignees: [] }); } catch (e) {}
            try { setShowTrash(false); } catch (e) {}
            const forced = rawArr.filter(a => !a.deletedAt);
            if (typeof __DEV__ !== 'undefined' && __DEV__) {
              try { console.debug('fetchData: auto-clear forced - forcing orders.length =', forced.length); } catch(e){}
            }
            // ensure this response is still the latest before applying
            if (fetchId === latestFetchRef.current) {
              // keep raw items and rely on derived filter to compute orders
              setApiItems(rawArr);
              // if a detail dialog is open for a specific order, refresh it from the latest raw array
              try {
                if (selectedOrder && selectedOrder.id) {
                  const fresh = rawArr.find(a => String(a.id) === String(selectedOrder.id));
                  if (fresh) {
                    console.debug('OrdersScreen: updating selectedOrder from fetchData with fresh total', fresh.total, 'id', fresh.id);
                    setSelectedOrder(fresh);
                  }
                }
              } catch (e) { /* ignore */ }
            } else {
              if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('fetchData: Ignoring forced result from stale fetch', fetchId, 'current', latestFetchRef.current);
            }
          } else {
            // normal path
            if (typeof __DEV__ !== 'undefined' && __DEV__) {
              try { console.debug('fetchData: normal path - setting orders.length =', arr.length); } catch(e){}
            }
            if (fetchId === latestFetchRef.current) {
              setApiItems(rawArr);
              try {
                if (selectedOrder && selectedOrder.id) {
                  const fresh = rawArr.find(a => String(a.id) === String(selectedOrder.id));
                  if (fresh) setSelectedOrder(fresh);
                }
              } catch (e) { /* ignore */ }
              if (arr.length > 0) autoClearAttemptRef.current = false; // reset attempt on success
            } else {
              if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('fetchData: Ignoring normal result from stale fetch', fetchId, 'current', latestFetchRef.current);
            }
          }
        }
        if (pRes.ok) setProducts(Array.isArray(pData) ? pData : (pData?.data || []));
        try {
          const uRes = await fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } });
          if (uRes.ok) {
            const uData = await uRes.json();
            setUsersList(Array.isArray(uData) ? uData : (uData?.data || []));
          }
        } catch (e) { /* ignore */ }
      } catch (err) {
        console.error('Errore fetch orders/products', err);
      } finally { if (showLoading) setLoading(false); }
    })();
  };

  // Bulk restore selected orders (used when viewing Cestino)
  const handleBulkRestore = async () => {
    if (!selectedIds || selectedIds.length === 0) return;
    try {
      const promises = selectedIds.map(id => fetch(`${API_URL}/orders/${id}/restore`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }));
      const results = await Promise.all(promises);
      let ok = 0;
      const errors = [];
      for (const r of results) {
        if (r.ok) ok += 1; else {
          const e = await parseErrorResponse(r).catch(() => ({ error: `HTTP ${r.status}` }));
          errors.push(e.error || `HTTP ${r.status}`);
        }
      }
      setToast({ visible: true, message: `Ripristinati ${ok} / ${selectedIds.length} ordini`, type: ok === selectedIds.length ? 'success' : 'warning' });
    } catch (e) {
      console.error('Bulk restore error', e);
      setToast({ visible: true, message: 'Errore durante il ripristino multiplo', type: 'error' });
    } finally {
      setSelectionMode(false);
      setSelectedIds([]);
      fetchData(); try { triggerRefresh(); } catch (e) {}
    }
  };

  // helper to safely parse error responses (try JSON then fallback to text)
  const parseErrorResponse = async (res) => {
    const out = { status: res?.status || null, error: null, raw: null };
    try {
      const json = await res.json();
      // if json has error field return it
      out.error = (json && (json.error || json.message)) ? (json.error || json.message) : JSON.stringify(json);
      out.raw = json;
      return out;
    } catch (e) {
      try {
        const txt = await res.text();
        out.error = txt || `HTTP ${res.status}`;
        out.raw = txt;
        return out;
      } catch (e2) {
        out.error = `HTTP ${res?.status || '??'}`;
        return out;
      }
    }
  };

  useEffect(() => { if (token) fetchData(); }, [token, refreshKey]);

  // helper to change order status via API
  const changeOrderStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/status`, { method: 'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: newStatus }) });
      if (res.ok) {
        return true;
      }
      const err = await parseErrorResponse(res);
      setToast({ visible: true, message: err.error || 'Errore', type: 'error' });
    } catch (e) { console.error(e); }
    return false;
  };

  const handleConfirmOrder = async () => {
    if (!selectedOrder) return;
    const ok = await changeOrderStatus(selectedOrder.id, 'pending');
    if (ok) { selectedOrder.status = 'pending'; setSelectedOrder({ ...selectedOrder }); fetchData(); try { triggerRefresh(); } catch(e){} }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    const ok = await changeOrderStatus(selectedOrder.id, 'cancelled');
    if (ok) { selectedOrder.status = 'cancelled'; setSelectedOrder({ ...selectedOrder }); fetchData(); try { triggerRefresh(); } catch(e){} }
  };

  const handleTakeInCharge = async () => {
    if (!selectedOrder) return;
    const ok = await changeOrderStatus(selectedOrder.id, 'in_progress');
    if (ok) { selectedOrder.status = 'in_progress'; setSelectedOrder({ ...selectedOrder }); fetchData(); try { triggerRefresh(); } catch(e){} }
  };

  const handleCompleteOrder = async () => {
    if (!selectedOrder) return;
    const ok = await changeOrderStatus(selectedOrder.id, 'completed');
    if (ok) { selectedOrder.status = 'completed'; setSelectedOrder({ ...selectedOrder }); fetchData(); try { triggerRefresh(); } catch(e){} }
  };

  // derive visible `orders` from `apiItems` depending on showTrash
  const ordersDerived = useMemo(() => {
    try {
      if (showTrash) return apiItems.filter(a => !!a.deletedAt);
      return apiItems.filter(a => !a.deletedAt);
    } catch (e) { return []; }
  }, [apiItems, showTrash]);

  const filteredOrders = ordersDerived.filter(o => {
    // base search (normalize input: trim, lower, strip stray surrounding quotes)
    if (search) {
      const s = (String(search || '')).toLowerCase().trim().replace(/^\"+|\"+$/g, '');
      if (s.length > 0) {
        if (!(String(o.id).includes(s) || (o.customer?.name || o.customer?.email || '').toLowerCase().includes(s) || (o.status || '').toLowerCase().includes(s))) return false;
      }
    }
    // status filter (combinable)
    if (appliedFilters.status && appliedFilters.status.length > 0) {
      if (!appliedFilters.status.includes(o.status)) return false;
    }
    // customers multi-select: support 'unassigned' token (robust string comparison)
    if (appliedFilters.customers && appliedFilters.customers.length > 0) {
      const hasUnassignedCust = appliedFilters.customers.some(x => String(x) === 'unassigned');
      const custIds = appliedFilters.customers.filter(c => String(c) !== 'unassigned').map(String);
      if (o.customerId) {
        const oid = String(o.customerId);
        if (custIds.length > 0) {
          if (!custIds.includes(oid)) return false;
        } else {
          // only 'unassigned' was selected -> this order has customer, so exclude
          return false;
        }
      } else {
        if (!hasUnassignedCust) return false;
      }
    }

    // assignees multi-select: support 'unassigned' token (robust string comparison)
    if (appliedFilters.assignees && appliedFilters.assignees.length > 0) {
      const hasUnassigned = appliedFilters.assignees.some(x => String(x) === 'unassigned');
      const otherIds = appliedFilters.assignees.filter(a => String(a) !== 'unassigned').map(String);
      if (o.assignedToId) {
        const aid = String(o.assignedToId);
        if (otherIds.length > 0) {
          if (!otherIds.includes(aid)) return false;
        } else {
          // only 'unassigned' was selected -> this order has assignee, so exclude
          return false;
        }
      } else {
        if (!hasUnassigned) return false;
      }
    }
    return true;
  });

  const statusLabel = (s) => {
    switch ((s || '').toString()) {
      case 'draft': return 'Bozza';
      case 'pending': return 'In attesa';
      case 'in_progress': return 'Assegnato / In corso';
      case 'completed': return 'Completato';
      case 'cancelled': return 'Annullato';
      default: return s || '';
    }
  };

  // dev-only trace of apiItems and derived counts to debug persistent zero in UI
  useEffect(() => {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      try {
        console.debug('DEV TRACE: apiItems.length=', apiItems.length, 'ordersDerived.length=', ordersDerived.length, 'filteredOrders.length=', filteredOrders.length, 'search=', String(search), 'appliedFilters=', JSON.stringify(appliedFilters), 'showTrash=', showTrash);
      } catch (e) {}
    }
  }, [apiItems, ordersDerived.length, filteredOrders.length, search, appliedFilters, showTrash]);

  const getStatusColor = (s) => {
    switch ((s || '').toString()) {
      case 'draft': return '#9E9E9E'; // grey
      case 'pending': return '#FB8C00'; // orange
      case 'in_progress': return '#1976D2'; // blue
      case 'completed': return '#2E7D32'; // green
      case 'cancelled': return '#E53935'; // red
      default: return '#616161';
    }
  };

  // refetch on navigation params change (used after creating an order)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // when returning to this screen (e.g. from NewOrder) ensure we show Active orders
      setShowTrash(false);
  // clear search and filters to avoid stray characters or residual filters hiding results
  setSearch('');
  setAppliedFilters({ status: [], customers: [], assignees: [] });
      // show loading to make refresh visible to user
      fetchData(false, true);
      // If we currently have a selectedOrder open, refresh its details as well so totals reflect recent edits
      (async () => {
        try {
          if (selectedOrder && selectedOrder.id) {
            const r = await fetch(`${API_URL}/orders/${selectedOrder.id}`, { headers: { Authorization: `Bearer ${token}` } });
            console.debug('OrdersScreen: focus fetch selectedOrder status', r.status, 'id', selectedOrder.id);
            if (r.ok) {
              const fresh = await r.json();
              console.debug('OrdersScreen: focus fetched selected order total', fresh.total, 'id', fresh.id);
              setSelectedOrder(fresh);
            }
          }
        } catch (e) { console.debug('OrdersScreen: error fetching selectedOrder on focus', e); }
      })();
    });
    return unsubscribe;
  }, [navigation]);

  const toggleSelectProduct = (prod) => {
    const existing = selectedItems.find(i => i.productId === prod.id);
    if (existing) {
      setSelectedItems(selectedItems.filter(i => i.productId !== prod.id));
    } else {
      setSelectedItems([...selectedItems, { productId: prod.id, quantity: 1 }]);
    }
  };

  const changeQty = (productId, qty) => {
    // coerce to integer
    const q = Number.isNaN(parseInt(qty, 10)) ? 0 : parseInt(qty, 10);
    setSelectedItems(selectedItems.map(i => i.productId === productId ? { ...i, quantity: q } : i));
  };

  const createOrder = async () => {
    if (selectedItems.length === 0) return;
    try {
      const res = await fetch(`${API_URL}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ items: selectedItems }) });
  if (res.ok) {
    // parse created order and show it immediately
    let created = null;
    try { created = await res.json(); } catch (e) { /* ignore parse error */ }
    // normalize created payload if wrapped
    const createdOrder = (created && created.id) ? created : (created?.data || created?.order || null);
    setShowDialog(false);
    setSelectedItems([]);
    // ensure we show active orders and display loading so user sees the new order
    setShowTrash(false);
    // clear search and filters so the newly created order is visible
    setSearch('');
    setAppliedFilters({ status: [], customers: [], assignees: [] });
    // if we have the created order from the response, insert it immediately so user sees it
    if (createdOrder && createdOrder.id) {
      setApiItems(prev => {
        try {
          if (prev.some(o => String(o.id) === String(createdOrder.id))) return prev;
          return [createdOrder, ...prev];
        } catch (e) { return prev; }
      });
      // open details for the created order so the user sees it right away
      setSelectedOrder(createdOrder);
      setShowDialog(true);
    }
    // still trigger a full refetch (visible) to sync state
    await fetchData(false, true);
    try { triggerRefresh(); } catch (e) { }
  }
  else { const err = await parseErrorResponse(res); setToast({ visible: true, message: err.error || 'Errore', type: 'error' }); }
    } catch (err) { console.error(err); }
  };

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      // initial fetch shows loader
      fetchData(undefined, true);
      // background polling: less frequent and do not display loader to avoid frequent spinner
      const iv = setInterval(() => {
        if (mounted) fetchData(undefined, false);
      }, 15000);
      return () => { mounted = false; clearInterval(iv); };
    }, [token, refreshKey])
  );

  return (
    <View style={[styles.container, { paddingTop: 48 }]}>
      <StatusBar backgroundColor="transparent" barStyle="dark-content" translucent />

      <View style={{ paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <SearchInput placeholder="Cerca ordini (numero, cliente, stato)" value={search} onChangeText={setSearch} />
          </View>
          <IconButton icon="filter-variant" onPress={() => setFilterVisible(true)} accessibilityLabel="Filtri" disabled={loading} />
        </View>

        {/* Second row: mode toggles */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
          <Button
            mode={!showTrash ? 'contained' : 'outlined'}
            compact
            disabled={loading}
            onPress={async () => { setShowTrash(false); setSelectionMode(false); setSelectedIds([]); await fetchData(false); }}
            style={{ marginRight: 6 }}
          >
            Attivi
          </Button>
          <Button
            mode={showTrash ? 'contained' : 'outlined'}
            compact
            disabled={loading}
            onPress={async () => { setShowTrash(true); setSelectionMode(false); setSelectedIds([]); await fetchData(true); }}
          >
            Cestino
          </Button>
          {loading ? <ActivityIndicator size={18} style={{ marginLeft: 8 }} /> : null}
        </View>

        {/* Selection action bar (shown when in selection mode) */}
        {selectionMode && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 2 }}>
            <Text style={{ fontWeight: '600' }}>{selectedIds.length} selezionati</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Select / Deselect All for currently visible orders */}
              <Button onPress={() => {
                try {
                  const visibleIds = (filteredOrders || []).map(o => o.id);
                  if (!visibleIds || visibleIds.length === 0) return;
                  const allSelected = visibleIds.every(id => selectedIds.includes(id));
                  if (allSelected) {
                    // deselect visible
                    setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
                  } else {
                    // select all visible in addition to any previously selected outside view
                    setSelectedIds(prev => Array.from(new Set([ ...(prev || []), ...visibleIds ])));
                  }
                } catch (e) { console.debug('SelectAll error', e); }
              }}>{
                ((filteredOrders || []).length > 0 && (filteredOrders || []).every(o => selectedIds.includes(o.id))) ? 'Deseleziona tutto' : 'Seleziona tutto'
              }</Button>
              <View style={{ width: 8 }} />
              <Button onPress={() => { setSelectionMode(false); setSelectedIds([]); }}>Annulla</Button>
              <Button onPress={() => setBulkDeleteDialogVisible(true)} color="#E53935">Elimina</Button>
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', marginTop: 8, flexWrap: 'wrap' }}>
          {appliedFilters.status.map(s => (
            <Chip key={`st-${s}`} style={{ marginRight: 6, marginBottom:6 }} onClose={() => setAppliedFilters(prev => ({ ...prev, status: prev.status.filter(x => x !== s) }))}>
              {statusLabel(s)}
            </Chip>
          ))}
          {appliedFilters.customers && appliedFilters.customers.map(cid => {
            if (cid === 'unassigned') {
              return (
                <Chip key={`cu-unassigned`} style={{ marginRight: 6, marginBottom:6 }} onClose={() => setAppliedFilters(prev => ({ ...prev, customers: prev.customers.filter(x => String(x) !== 'unassigned') }))}>
                  Non assegnati
                </Chip>
              );
            }
            const c = usersList.find(u => u.id === cid) || {};
            return (
              <Chip key={`cu-${cid}`} style={{ marginRight: 6, marginBottom:6 }} onClose={() => setAppliedFilters(prev => ({ ...prev, customers: prev.customers.filter(x => String(x) !== String(cid)) }))}>
                {c.name || `Cliente ${cid}`}
              </Chip>
            );
          })}
          {appliedFilters.assignees && appliedFilters.assignees.map(aid => {
            if (aid === 'unassigned') {
              return (
                <Chip key="as-unassigned" style={{ marginRight:6, marginBottom:6 }} onClose={() => setAppliedFilters(prev => ({ ...prev, assignees: prev.assignees.filter(x => String(x) !== 'unassigned') }))}>
                  Non assegnati
                </Chip>
              );
            }
            const a = usersList.find(u => u.id === aid) || {};
            return (
              <Chip key={`as-${aid}`} style={{ marginRight: 6, marginBottom:6 }} onClose={() => setAppliedFilters(prev => ({ ...prev, assignees: prev.assignees.filter(x => String(x) !== String(aid)) }))}>
                {a.name || `Assegnato a ${aid}`}
              </Chip>
            );
          })}
        </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 2 }}>
                <Text>Totale ordini: {ordersDerived.length}</Text>
                <Text>Mostrati: {filteredOrders.length}</Text>
              </View>
        {/* debug block removed */}
      </View>

      <OrdersFilterModal visible={filterVisible} onDismiss={() => setFilterVisible(false)} onApply={(f) => setAppliedFilters(f)} users={usersList} initial={appliedFilters} />

      <FlatList
        data={filteredOrders}
        keyExtractor={o => o.id.toString()}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
  renderItem={({item}) => {
          // helper handlers per riga
          const handleCompleteRow = async () => {
            // close the swipeable immediately so the row returns to place
            try { swipeableRefs.current.get(item.id)?.close(); } catch (e) {}
            const ok = await changeOrderStatus(item.id, 'completed');
            if (ok) { fetchData(); try { triggerRefresh(); } catch(e){} }
          };
          const handleAssignRow = async () => {
            // close swipeable and open the assignee picker for this order
            try { swipeableRefs.current.get(item.id)?.close(); } catch (e) {}
            setSelectedOrder(item);
            setPickerVisible(true);
          };
          const handleDeleteRow = async () => {
            try { swipeableRefs.current.get(item.id)?.close(); } catch (e) {}
            setOrderToDelete(item);
            setDeleteDialogVisible(true);
          };
          const handleRestoreRow = async () => {
            try { swipeableRefs.current.get(item.id)?.close(); } catch (e) {}
            try {
              const res = await fetch(`${API_URL}/orders/${item.id}/restore`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
              if (res.ok) {
                setToast({ visible: true, message: 'Ordine ripristinato', type: 'success' });
                fetchData(); try { triggerRefresh(); } catch(e){}
              } else {
                const err = await parseErrorResponse(res);
                setToast({ visible: true, message: err.error || 'Errore ripristino', type: 'error' });
              }
            } catch (e) { console.error('Restore error', e); setToast({ visible: true, message: 'Errore ripristino', type: 'error' }); }
          };
          const handleSendRow = async () => {
            try { swipeableRefs.current.get(item.id)?.close(); } catch (e) {}
            const ok = await changeOrderStatus(item.id, 'pending');
            if (ok) { fetchData(); try { triggerRefresh(); } catch(e){} }
          };

          // right actions component for Swipeable
          const RightActions = () => (
            <View style={styles.rightActionsContainer}>
              {showTrash ? (
                // In Cestino: show Restore and Permanent Delete
                <>
                  <IconButton icon="restore" size={28} onPress={handleRestoreRow} accessibilityLabel="Ripristina ordine" />
                  <IconButton icon="delete-forever" size={28} color="#E53935" onPress={handleDeleteRow} accessibilityLabel="Elimina definitivamente" />
                </>
              ) : (
                // Normal actions
                <>
                  {/* Complete: visible unless order is completed/cancelled */}
                  {item.status !== 'completed' && item.status !== 'cancelled' && ( (user?.role === 'admin') || (user?.role === 'employee' && item.assignedToId === user.id) ) && (
                    <IconButton icon="check" size={28} color="#2e7d32" onPress={handleCompleteRow} accessibilityLabel="Segna come completato" />
                  )}
                  {/* Assign: visible only to admin */}
                  {user?.role === 'admin' && item.status !== 'completed' && item.status !== 'cancelled' && (
                    <IconButton icon="account-switch" size={28} onPress={handleAssignRow} accessibilityLabel="Cambia assegnatario" />
                  )}
                  {/* Send (draft -> pending): visible for drafts and not for completed/cancelled */}
                  {item.status === 'draft' && ( (user?.role === 'admin') || (user?.role === 'customer' && user.id === item.customerId) ) && (
                    <IconButton icon="arrow-right" size={28} onPress={handleSendRow} accessibilityLabel="Invia ordine" />
                  )}
                  {/* Delete: admin can delete any order; customer can delete own drafts */}
                  {((user?.role === 'admin') || (user?.role === 'customer' && user.id === item.customerId && item.status === 'draft')) && (
                    <IconButton icon="delete" size={28} color="#E53935" onPress={handleDeleteRow} accessibilityLabel="Elimina ordine" />
                  )}
                </>
              )}
            </View>
          );

          return (
            <Swipeable
              ref={(r) => { if (r) swipeableRefs.current.set(item.id, r); else swipeableRefs.current.delete(item.id); }}
              renderRightActions={(progress, dragX) => <RightActions />}
            >
              <Card
                style={[{ marginBottom: 12 }, selectedIds.includes(item.id) ? { borderWidth: 2, borderColor: theme.colors.primary } : {}, item.deletedAt ? { opacity: 0.65, backgroundColor: '#fff7f7' } : {} ]}
                onPress={() => {
                  if (selectionMode) {
                    // toggle selection
                    setSelectedIds(prev => prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]);
                  } else {
                    setSelectedOrder(item); setShowDialog(true);
                  }
                }}
                onLongPress={() => {
                  // enter selection mode and select this item
                  setSelectionMode(true);
                  setSelectedIds(prev => prev.includes(item.id) ? prev : [...prev, item.id]);
                }}
              >
                <Card.Content>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontWeight: '600' }}>#{item.id}</Text>
                      {item.status === 'draft' && !item.deletedAt ? (
                        <IconButton
                          icon="pencil"
                          size={20}
                          onPress={() => {
                            const ord = {
                              id: item.id,
                              items: (item.items || []).map(it => ({ productId: it.productId, quantity: it.quantity })),
                              customerId: item.customerId || null,
                              assignedToId: item.assignedToId || null,
                            };
                            // use parent navigator (stack) to open NewOrder screen, same behavior as FAB
                            try {
                              if (navigation?.getParent) navigation.getParent().navigate('NewOrder', { order: ord });
                              else navigation.navigate('NewOrder', { order: ord });
                            } catch (e) {
                              // fallback
                              navigation.navigate('NewOrder', { order: ord });
                            }
                          }}
                          accessibilityLabel="Modifica bozza"
                        />
                      ) : null}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                      <Text style={styles.statusBadgeText}>{statusLabel(item.status)}</Text>
                    </View>
                  </View>
                  <Text style={{ marginTop: 6 }}>Totale: €{Number(item.total).toFixed(2)}</Text>
                  <Text>Cliente: {item.customer?.name || 'Cliente non assegnato'}</Text>
                  <Text>Assegnatario: {item.assignedTo ? item.assignedTo.name : 'Non assegnato'}</Text>
                  {item.deletedAt ? <Text style={{ color: '#b71c1c', fontWeight: '700', marginTop: 6 }}>Eliminato: {new Date(item.deletedAt).toLocaleString()}</Text> : null}
                </Card.Content>
              </Card>
            </Swipeable>
          );
        }}
      />

      {/* Floating New Order FAB for allowed roles */}
      {(user?.role === 'customer' || user?.role === 'admin') && (
        <FAB icon="plus" style={styles.fabOrder} onPress={() => navigation?.getParent ? navigation.getParent().navigate('NewOrder') : null} color="white" />
      )}

      {user?.role === 'admin' && (
        <FAB icon="file-export" style={styles.leftFabBottom} onPress={() => setShowExportDialog(true)} color="#fff" disabled={loading} />
      )}

      <Portal>
        <Dialog visible={showExportDialog} onDismiss={() => setShowExportDialog(false)}>
          <Dialog.Title>Esporta ordini</Dialog.Title>
          <Dialog.Content>
            <Text>Scegli il formato di esportazione per gli ordini filtrati (verranno esportati {filteredOrders.length} ordini):</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowExportDialog(false)}>Annulla</Button>
            <Button onPress={async () => {
              setShowExportDialog(false);
              setExporting(true);
              try {
                // CSV export
                const rows = [];
                const header = ['id','total','customer','assignee','status','createdAt'];
                rows.push(header.join(','));
                filteredOrders.forEach(o => {
                  const cust = o.customer?.name ? `"${String(o.customer.name).replace(/"/g,'""')}"` : '';
                  const ass = o.assignedTo?.name ? `"${String(o.assignedTo.name).replace(/"/g,'""')}"` : '';
                  const line = [
                    String(o.id),
                    String(o.total),
                    cust,
                    ass,
                    `"${String(o.status || '')}"`,
                    `"${new Date(o.createdAt).toISOString()}"`
                  ].join(',');
                  rows.push(line);
                });
                const csv = rows.join('\n');
                const fname = `orders_export_${Date.now()}.csv`;
                const path = FileSystem.documentDirectory + fname;
                await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
                await Sharing.shareAsync(path);
              } catch (err) {
                console.error('Export CSV error', err);
              } finally { setExporting(false); }
            }}>CSV</Button>
            <Button onPress={async () => {
              setShowExportDialog(false);
              setExporting(true);
              try {
                // Build simple HTML for PDF
                let html = `<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ddd;padding:8px;text-align:left;}th{background:#f4f4f4;}</style></head><body><h3>Ordini esportati</h3><table><thead><tr><th>ID</th><th>Totale</th><th>Cliente</th><th>Assegnatario</th><th>Stato</th><th>Creato</th></tr></thead><tbody>`;
                filteredOrders.forEach(o => {
                  const cust = o.customer?.name ? String(o.customer.name) : '';
                  const ass = o.assignedTo?.name ? String(o.assignedTo.name) : '';
                  html += `<tr><td>${o.id}</td><td>€${Number(o.total).toFixed(2)}</td><td>${cust}</td><td>${ass}</td><td>${o.status || ''}</td><td>${new Date(o.createdAt).toLocaleString()}</td></tr>`;
                });
                html += `</tbody></table></body></html>`;
                const { uri } = await Print.printToFileAsync({ html });
                if (uri) await Sharing.shareAsync(uri);
              } catch (err) { console.error('Export PDF error', err); }
              finally { setExporting(false); }
            }}>PDF</Button>
          </Dialog.Actions>
        </Dialog>
        {/* If creating a new order (customer) show the product selection dialog */}
        {user?.role === 'customer' && (
          <Dialog visible={showDialog && !selectedOrder} onDismiss={() => setShowDialog(false)}>
            <Dialog.Title>Seleziona prodotti</Dialog.Title>
            <Dialog.Content>
              {products.map(p => {
                const sel = selectedItems.find(i => i.productId === p.id);
                let error = '';
                if (sel) {
                  if (!Number.isInteger(sel.quantity) || sel.quantity <= 0) error = 'Quantità minima 1';
                  else if (typeof p.stock === 'number' && sel.quantity > p.stock) error = `Massimo ${p.stock} disponibili`;
                }

                return (
                  <View key={p.id} style={{ marginBottom:8 }}>
                    <Text>{p.name} - €{p.price} (Disponibile: {p.stock})</Text>
                    <Button mode={sel ? 'contained' : 'outlined'} onPress={() => toggleSelectProduct(p)} style={{ marginTop:6 }}>{sel ? 'Selezionato' : 'Seleziona'}</Button>
                    {sel && (
                      <>
                        <TextInput
                          label="Quantità"
                          value={String(sel.quantity)}
                          onChangeText={(t) => changeQty(p.id, t)}
                          keyboardType="numeric"
                        />
                        {error ? <Text style={{ color: 'red', marginTop: 4 }}>{error}</Text> : null}
                      </>
                    )}
                  </View>
                );
              })}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowDialog(false)}>Annulla</Button>
              <Button onPress={createOrder} disabled={selectedItems.length === 0 || selectedItems.some(si => {
                const prod = products.find(p => p.id === si.productId);
                if (!prod) return true;
                if (!Number.isInteger(si.quantity) || si.quantity <= 0) return true;
                if (typeof prod.stock === 'number' && si.quantity > prod.stock) return true;
                return false;
              })}>Crea</Button>
            </Dialog.Actions>
          </Dialog>
        )}

        {/* Order details dialog shown when selectedOrder is set */}
        <Dialog visible={!!selectedOrder} onDismiss={() => { setSelectedOrder(null); setShowDialog(false); }} style={{ position: 'relative', maxHeight: 600, width: '90%', alignSelf: 'center' }}>
          {/* absolute close button placed slightly above and to the right */}
          <TouchableOpacity
            onPress={() => { setSelectedOrder(null); setShowDialog(false); }}
            accessibilityLabel="Chiudi"
            style={[styles.closeButton, styles.closeButtonAbsolute]}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Dialog.Title>
            <Text style={{ fontSize: 18 }}>Dettagli ordine #{selectedOrder?.id}</Text>
          </Dialog.Title>
          <Dialog.Content>
            {selectedOrder ? (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ marginRight: 8 }}>Status:</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedOrder.status) }]}>
                    <Text style={styles.statusBadgeText}>{statusLabel(selectedOrder.status)}</Text>
                  </View>
                </View>
                <Text style={{ flexWrap: 'wrap' }}>Cliente: {selectedOrder.customer?.name || '—'}</Text>
                <Text style={{ flexWrap: 'wrap' }}>Creato: {new Date(selectedOrder.createdAt).toLocaleString()}</Text>
                <Text style={{ marginTop: 8, fontWeight: '700' }}>Articoli:</Text>
                {selectedOrder.items && selectedOrder.items.map((it) => {
                  const prod = products.find(p => p.id === it.productId) || {};
                  return (
                    <View key={it.id} style={{ marginTop: 6 }}>
                      <Text style={{ flexWrap: 'wrap' }}>{prod.name || `Prodotto ${it.productId}`} — Qtà: {it.quantity} — Prezzo unitario: €{(typeof it.unitPrice === 'number') ? it.unitPrice.toFixed(2) : it.unitPrice} — Subtotale: €{(it.quantity * it.unitPrice).toFixed(2)}</Text>
                    </View>
                  );
                })}
                <Text style={{ marginTop: 8, fontWeight: '700' }}>Totale ordine: €{Number(selectedOrder.total).toFixed(2)}</Text>
                {selectedOrder.notes ? <Text style={{ marginTop: 8, flexWrap: 'wrap' }}>Note: {selectedOrder.notes}</Text> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <Text style={{ flex: 1, flexWrap: 'wrap' }}>Assegnato a: {selectedOrder.assignedTo ? selectedOrder.assignedTo.name : '—'}</Text>
                  {user?.role === 'admin' && selectedOrder.assignedTo && (
                    <IconButton icon="close" size={20} onPress={async () => {
                      try {
                        const res = await fetch(`${API_URL}/orders/${selectedOrder.id}/assign`, { method: 'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ assignedToId: null }) });
                          if (res.ok) {
                          selectedOrder.assignedTo = null;
                          selectedOrder.assignedToId = null;
                          setSelectedOrder({ ...selectedOrder });
                          fetchData();
                          try { triggerRefresh(); } catch (e) {}
                          } else {
                          const err = await parseErrorResponse(res); setToast({ visible: true, message: err.error || 'Errore rimozione assegnatario', type: 'error' });
                        }
                      } catch (e) { console.error(e); }
                    }} accessibilityLabel="Rimuovi assegnatario" />
                  )}
                </View>
              </View>
            ) : null}
          </Dialog.Content>
            {/* keep dialog actions minimal (only implicit close via X). */}
            <Dialog.Actions style={{ paddingHorizontal: 8 }} />
            {/* Assignee picker for assigning orders (opened by swipe action) */}
            <AssigneePicker visible={pickerVisible} onDismiss={() => setPickerVisible(false)} users={usersList} onSelect={async (u) => {
              if (!selectedOrder) { setPickerVisible(false); return; }
              try {
                const res = await fetch(`${API_URL}/orders/${selectedOrder.id}/assign`, { method: 'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ assignedToId: u.id }) });
                if (res.ok) {
                  // update local selectedOrder
                  selectedOrder.assignedTo = u;
                  selectedOrder.assignedToId = u.id;
                  // when assigning, backend may set status to in_progress
                  const body = await parseErrorResponse(res);
                  try { swipeableRefs.current.get(selectedOrder.id)?.close(); } catch(e) {}
                  // refetch list
                  setSelectedOrder({ ...selectedOrder });
                  fetchData();
                  try { triggerRefresh(); } catch (e) {}
                } else {
                  const err = await parseErrorResponse(res); setToast({ visible: true, message: err.error || 'Errore assegnazione', type: 'error' });
                }
              } catch (e) { console.error(e); }
              setPickerVisible(false);
            }} roleFilter={['employee','admin']} title={'Seleziona assegnatario'} />
        </Dialog>

        {/* Delete confirmation dialog shown when user taps delete in swipe actions */}
        <Dialog visible={deleteDialogVisible} onDismiss={() => { setDeleteDialogVisible(false); setOrderToDelete(null); }}>
          <Dialog.Title>{showTrash ? 'Elimina definitivamente' : 'Sposta nel cestino'}</Dialog.Title>
          <Dialog.Content>
            <Text>{showTrash ? 'Sei sicuro di voler eliminare definitivamente l\'ordine?' : 'Sei sicuro di voler spostare l\'ordine nel cestino?'}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setDeleteDialogVisible(false); setOrderToDelete(null); }}>Annulla</Button>
            <Button onPress={async () => {
              if (!orderToDelete) return;
              try {
                if (showTrash) {
                  // permanent delete
                  const res = await fetch(`${API_URL}/orders/${orderToDelete.id}?permanent=true`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                  if (res.ok) {
                    setToast({ visible: true, message: 'Ordine eliminato definitivamente', type: 'success' });
                  } else {
                    const parsed = await parseErrorResponse(res);
                    setToast({ visible: true, message: parsed.error || 'Errore eliminazione', type: 'error' });
                  }
                } else {
                  // soft-delete (move to trash)
                  const res = await fetch(`${API_URL}/orders/${orderToDelete.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                  if (res.ok) setToast({ visible: true, message: 'Ordine spostato nel cestino', type: 'success' });
                  else { const parsed = await parseErrorResponse(res); setToast({ visible: true, message: parsed.error || 'Errore eliminazione', type: 'error' }); }
                }
                setDeleteDialogVisible(false);
                setOrderToDelete(null);
                fetchData(); try { triggerRefresh(); } catch(e) {}
              } catch (e) {
                console.error('Errore delete order', e);
                setDeleteDialogVisible(false);
                setOrderToDelete(null);
                setToast({ visible: true, message: `Errore eliminazione: ${e?.message || 'sconosciuto'}`, type: 'error' });
              }
            }}>{showTrash ? 'Elimina definitivamente' : 'Sposta nel cestino'}</Button>
          </Dialog.Actions>
        </Dialog>
        {/* Bulk delete confirmation dialog */}
        <Dialog visible={bulkDeleteDialogVisible} onDismiss={() => { setBulkDeleteDialogVisible(false); }}>
          <Dialog.Title>Conferma eliminazione multipla</Dialog.Title>
          <Dialog.Content>
            <Text>Sei sicuro di voler eliminare definitivamente {selectedIds.length} ordini selezionati?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setBulkDeleteDialogVisible(false)}>Annulla</Button>
            <Button onPress={async () => {
              setBulkDeleteDialogVisible(false);
              if (selectedIds.length === 0) return;
              try {
                if (showTrash) {
                  // permanent delete in bulk
                  const delPromises = selectedIds.map(id => fetch(`${API_URL}/orders/${id}?permanent=true`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }));
                  const results = await Promise.all(delPromises);
                  let successCount = 0;
                  for (const r of results) if (r.ok) successCount += 1;
                  setToast({ visible: true, message: `Eliminati definitivamente ${successCount} / ${selectedIds.length} ordini`, type: successCount === selectedIds.length ? 'success' : 'warning' });
                } else {
                  // move to trash (soft-delete)
                  const delPromises = selectedIds.map(id => fetch(`${API_URL}/orders/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }));
                  const results = await Promise.all(delPromises);
                  let successCount = 0;
                  for (const r of results) if (r.ok) successCount += 1;
                  setToast({ visible: true, message: `Spostati nel cestino ${successCount} / ${selectedIds.length} ordini`, type: successCount === selectedIds.length ? 'success' : 'warning' });
                }
                // refresh list
                setSelectionMode(false);
                setSelectedIds([]);
                fetchData();
                try { triggerRefresh(); } catch (e) {}
              } catch (e) {
                console.error('Bulk delete error', e);
                setToast({ visible: true, message: `Errore eliminazione: ${e?.message || 'sconosciuto'}`, type: 'error' });
              }
            }} color="#E53935">{showTrash ? 'Elimina definitivamente' : 'Sposta nel cestino'}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <FloatingToast visible={toast?.visible} message={toast?.message} type={toast?.type || 'info'} onHide={() => setToast({ ...toast, visible: false })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#F9F9FB' },
  title: { fontSize:22, fontWeight:'600', margin:16 },
  fabOrder: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#7E57C2', zIndex: 10, elevation: 6 },
  leftFabBottom: { position: 'absolute', left: 20, bottom: 20, backgroundColor: '#4CAF50', zIndex: 10, elevation: 6 },
  // legacy search styles removed; use src/components/SearchInput instead
  rightActionsContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  // touch target adjusted to 40 for a slightly smaller look while remaining accessible
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#7E57C2', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  closeButtonText: { color: '#fff', fontSize: 18, lineHeight: 18 },
  // position adjusted: less to the right so it doesn't overflow, and slightly higher
  closeButtonAbsolute: { position: 'absolute', right: 6, top: -10, elevation: 8, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 6 }
});

// additional styles appended for status badges
const badgeStyles = StyleSheet.create({
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  statusBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' }
});

// merge into exported styles to keep usage consistent
Object.assign(styles, badgeStyles);
