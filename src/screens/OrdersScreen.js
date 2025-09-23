import React, { useContext, useEffect, useState, useRef } from "react";
import { useFocusEffect } from '@react-navigation/native';
import { View, StyleSheet, FlatList, StatusBar, TouchableOpacity } from "react-native";
import { Text, Card, Button, Portal, Dialog, TextInput, FAB, IconButton } from "react-native-paper";
import { Swipeable } from 'react-native-gesture-handler';
import SearchInput from '../components/SearchInput';
import FloatingToast from '../components/FloatingToast';
import AssigneePicker from '../components/AssigneePicker';
import { AuthContext } from "../context/AuthContext";
import { SyncContext } from "../context/SyncContext";
import { API_URL } from "../config";

export default function OrdersScreen({ navigation }) {
  const { token, user } = useContext(AuthContext);
  const { triggerRefresh, refreshKey } = useContext(SyncContext);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const [pickerVisible, setPickerVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // order form
  const [showDialog, setShowDialog] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]); // [{productId, quantity}]
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const swipeableRefs = useRef(new Map());

  const fetchData = async () => {
    try {
      const [oRes, pRes] = await Promise.all([
        fetch(`${API_URL}/orders`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/products`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
  const oData = await oRes.json();
  const pData = await pRes.json();
  // API sometimes returns { ok:true, data: [...] } or a bare array. Normalize to array.
  if (oRes.ok) setOrders(Array.isArray(oData) ? oData : (oData?.data || []));
  if (pRes.ok) setProducts(Array.isArray(pData) ? pData : (pData?.data || []));
      // try fetch users (if admin)
      try {
        const uRes = await fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } });
        if (uRes.ok) {
          const uData = await uRes.json();
          setUsersList(Array.isArray(uData) ? uData : (uData?.data || []));
        }
      } catch (e) { /* ignore */ }
    } catch (err) {
      console.error('Errore fetch orders/products', err);
    } finally { setLoading(false); }
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

  const filteredOrders = orders.filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return String(o.id).includes(s) || (o.customer?.name || o.customer?.email || '').toLowerCase().includes(s) || (o.status || '').toLowerCase().includes(s);
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
      // if route params contain refreshToken or simply on focus, fetch
      fetchData();
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
  if (res.ok) { setShowDialog(false); setSelectedItems([]); fetchData(); try { triggerRefresh(); } catch (e) { } }
  else { const err = await parseErrorResponse(res); setToast({ visible: true, message: err.error || 'Errore', type: 'error' }); }
    } catch (err) { console.error(err); }
  };

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      fetchData();
      const iv = setInterval(() => {
        if (mounted) fetchData();
      }, 5000);
      return () => { mounted = false; clearInterval(iv); };
    }, [token, refreshKey])
  );

  return (
  <View style={[styles.container, { paddingTop: 48 }]}>
      <StatusBar backgroundColor="transparent" barStyle="dark-content" translucent />

      <View style={{ paddingHorizontal: 16 }}>
        <SearchInput placeholder="Cerca ordini (numero, cliente, stato)" value={search} onChangeText={setSearch} />
      </View>

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
          const handleSendRow = async () => {
            try { swipeableRefs.current.get(item.id)?.close(); } catch (e) {}
            const ok = await changeOrderStatus(item.id, 'pending');
            if (ok) { fetchData(); try { triggerRefresh(); } catch(e){} }
          };

          // right actions component for Swipeable
          const RightActions = () => (
            <View style={styles.rightActionsContainer}>
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
            </View>
          );

          return (
            <Swipeable
              ref={(r) => { if (r) swipeableRefs.current.set(item.id, r); else swipeableRefs.current.delete(item.id); }}
              renderRightActions={(progress, dragX) => <RightActions />}
            >
              <Card style={{ marginBottom: 12 }} onPress={() => { setSelectedOrder(item); setShowDialog(true); }}>
                <Card.Content>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontWeight: '600' }}>#{item.id}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                      <Text style={styles.statusBadgeText}>{statusLabel(item.status)}</Text>
                    </View>
                  </View>
                  <Text style={{ marginTop: 6 }}>Totale: €{Number(item.total).toFixed(2)}</Text>
                  <Text>Cliente: {item.customer?.name || 'Cliente non assegnato'}</Text>
                  <Text>Assegnatario: {item.assignedTo ? item.assignedTo.name : 'Non assegnato'}</Text>
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

      <Portal>
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
          <Dialog.Title>Conferma eliminazione</Dialog.Title>
          <Dialog.Content>
            <Text>Sei sicuro di voler eliminare definitivamente l'ordine?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setDeleteDialogVisible(false); setOrderToDelete(null); }}>Annulla</Button>
            <Button onPress={async () => {
              if (!orderToDelete) return;
              try {
                const res = await fetch(`${API_URL}/orders/${orderToDelete.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                if (res.ok) {
                  setDeleteDialogVisible(false);
                  setOrderToDelete(null);
                  setToast({ visible: true, message: 'Ordine eliminato con successo', type: 'success' });
                  fetchData(); try { triggerRefresh(); } catch(e) {}
                } else {
                  const parsed = await parseErrorResponse(res);
                  const msg = parsed.error || `Errore eliminazione (status ${parsed.status || res.status})`;
                  setDeleteDialogVisible(false);
                  setOrderToDelete(null);
                  setToast({ visible: true, message: msg, type: 'error' });
                }
              } catch (e) {
                console.error('Errore delete order', e);
                setDeleteDialogVisible(false);
                setOrderToDelete(null);
                setToast({ visible: true, message: `Errore eliminazione: ${e?.message || 'sconosciuto'}`, type: 'error' });
              }
            }}>Elimina</Button>
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
  fabOrder: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#7E57C2', zIndex: 10, elevation: 6 }
  ,
  // legacy search styles removed; use src/components/SearchInput instead
  rightActionsContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }
  ,
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
