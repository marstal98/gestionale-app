import React, { useContext, useEffect, useState } from "react";
import { useFocusEffect } from '@react-navigation/native';
import { View, StyleSheet, FlatList, StatusBar } from "react-native";
import { Text, Card, Button, Portal, Dialog, TextInput, FAB, IconButton } from "react-native-paper";
import SearchInput from '../components/SearchInput';
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
  const [pickerVisible, setPickerVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // order form
  const [showDialog, setShowDialog] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]); // [{productId, quantity}]
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchData = async () => {
    try {
      const [oRes, pRes] = await Promise.all([
        fetch(`${API_URL}/orders`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/products`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const oData = await oRes.json();
      const pData = await pRes.json();
      if (oRes.ok) setOrders(oData);
      if (pRes.ok) setProducts(pData);
      // try fetch users (if admin)
      try {
        const uRes = await fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } });
        if (uRes.ok) {
          const uData = await uRes.json();
          setUsersList(uData);
        }
      } catch (e) { /* ignore */ }
    } catch (err) {
      console.error('Errore fetch orders/products', err);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (token) fetchData(); }, [token, refreshKey]);

  const filteredOrders = orders.filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return String(o.id).includes(s) || (o.customer?.name || o.customer?.email || '').toLowerCase().includes(s) || (o.status || '').toLowerCase().includes(s);
  });

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
      else { const err = await res.json(); alert(err.error || 'Errore'); }
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
        renderItem={({item}) => (
          <Card style={{ marginBottom: 12 }} onPress={() => { setSelectedOrder(item); setShowDialog(true); }}>
            <Card.Content>
              <Text>#{item.id} - {item.status}</Text>
              <Text>Totale: €{Number(item.total).toFixed(2)}</Text>
              <Text>Cliente: {item.customer?.name || 'Cliente non assegnato'}</Text>
              <Text>Assegnatario: {item.assignedTo ? item.assignedTo.name : 'Non assegnato'}</Text>
            </Card.Content>
          </Card>
        )}
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
        <Dialog visible={!!selectedOrder} onDismiss={() => { setSelectedOrder(null); setShowDialog(false); }} style={{ maxHeight: 600 }}>
          <Dialog.Title>Dettagli ordine #{selectedOrder?.id}</Dialog.Title>
          <Dialog.Content>
            {selectedOrder ? (
              <>
                <Text>Status: {selectedOrder.status}</Text>
                <Text>Cliente: {selectedOrder.customer?.name || '—'}</Text>
                <Text>Creato: {new Date(selectedOrder.createdAt).toLocaleString()}</Text>
                <Text style={{ marginTop: 8, fontWeight: '700' }}>Articoli:</Text>
                {selectedOrder.items && selectedOrder.items.map((it) => {
                  const prod = products.find(p => p.id === it.productId) || {};
                  return (
                    <View key={it.id} style={{ marginTop: 6 }}>
                      <Text>{prod.name || `Prodotto ${it.productId}`} — Qtà: {it.quantity} — Prezzo unitario: €{(typeof it.unitPrice === 'number') ? it.unitPrice.toFixed(2) : it.unitPrice} — Subtotale: €{(it.quantity * it.unitPrice).toFixed(2)}</Text>
                    </View>
                  );
                })}
                <Text style={{ marginTop: 8, fontWeight: '700' }}>Totale ordine: €{Number(selectedOrder.total).toFixed(2)}</Text>
                {selectedOrder.notes ? <Text style={{ marginTop: 8 }}>Note: {selectedOrder.notes}</Text> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <Text style={{ flex: 1 }}>Assegnato a: {selectedOrder.assignedTo ? selectedOrder.assignedTo.name : '—'}</Text>
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
                          const err = await res.json(); alert(err.error || 'Errore rimozione assegnatario');
                        }
                      } catch (e) { console.error(e); }
                    }} accessibilityLabel="Rimuovi assegnatario" />
                  )}
                </View>
              </>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            {/* Allow reassignment if admin or owner */}
            {selectedOrder && (user?.role === 'admin') && usersList.length > 0 && (
              <Button onPress={() => setPickerVisible(true)}>Cambia assegnatario</Button>
            )}
            <AssigneePicker visible={pickerVisible} onDismiss={() => setPickerVisible(false)} users={usersList} onSelect={async (next) => {
              try {
                const res = await fetch(`${API_URL}/orders/${selectedOrder.id}/assign`, { method: 'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ assignedToId: next.id }) });
                if (res.ok) {
                  selectedOrder.assignedTo = next;
                  setSelectedOrder({ ...selectedOrder });
                  fetchData();
                  try { triggerRefresh(); } catch (e) { }
                } else {
                  const err = await res.json(); alert(err.error || 'Errore assegnazione');
                }
              } catch (e) { console.error(e); }
              setPickerVisible(false);
            }} roleFilter={['employee','admin']} title={'Seleziona assegnatario'} />
            <Button onPress={() => { setSelectedOrder(null); setShowDialog(false); }}>Chiudi</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#F9F9FB' },
  title: { fontSize:22, fontWeight:'600', margin:16 },
  fabOrder: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#7E57C2', zIndex: 10, elevation: 6 }
  ,
  // legacy search styles removed; use src/components/SearchInput instead
});
