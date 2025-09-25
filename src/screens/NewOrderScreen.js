import React, { useContext, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Keyboard } from 'react-native';
import { Text, TextInput, Button, Card, FAB, Portal, Modal, IconButton, Badge, Surface } from 'react-native-paper';
import FloatingToast from '../components/FloatingToast';
import SearchInput from '../components/SearchInput';
import { ScrollView, Dimensions } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { SyncContext } from '../context/SyncContext';
import { API_URL } from '../config';
import AssigneePicker from '../components/AssigneePicker';

export default function NewOrderScreen({ navigation, route }) {
  const { token, user } = useContext(AuthContext);
  const { triggerRefresh } = useContext(SyncContext);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState([]); // { productId, quantity }
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [customerId, setCustomerId] = useState(null);
  const [assignedToId, setAssignedToId] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editingOrderStatus, setEditingOrderStatus] = useState(null); // track status when editing
  const [pickerVisible, setPickerVisible] = useState(false);
  const [customerPickerVisible, setCustomerPickerVisible] = useState(false);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/products`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setProducts(data);
    } catch (err) { console.error('fetch products', err); }
    finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) { console.error('fetch users', e); }
  };

  useEffect(() => { if (token) fetchProducts(); }, [token]);
  useEffect(() => { if (token) fetchUsers(); }, [token]);

  // If navigated with an order to edit, prefill
  useEffect(() => {
    const ord = route?.params?.order;
    if (ord) {
      // order.items expected as [{ productId, quantity }]
      const pre = (ord.items || []).map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice || null }));
      setCart(pre);
      setCustomerId(ord.customerId || null);
      setAssignedToId(ord.assignedToId || null);
      setEditingOrderId(ord.id || null);
      if (ord.status) setEditingOrderStatus(ord.status);
    }
  }, [route]);

  // Defensive: if editingOrderId provided (for example when arriving from Orders list), fetch the order from API
  useEffect(() => {
    const loadExisting = async () => {
      if (!editingOrderId || !token) return;
      try {
        const res = await fetch(`${API_URL}/orders/${editingOrderId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 404) {
          setToast({ visible: true, message: 'Ordine non trovato (potrebbe essere stato eliminato)', type: 'error' });
          setEditingOrderId(null);
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setToast({ visible: true, message: data?.error || 'Errore recupero ordine', type: 'error' });
          return;
        }
        const data = await res.json();
        // normalize items
  const pre = (data.items || []).map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: (typeof i.unitPrice === 'number') ? i.unitPrice : null }));
        setCart(pre);
        setCustomerId(data.customerId || null);
        setAssignedToId(data.assignedToId || null);
        setEditingOrderId(data.id || null);
        setEditingOrderStatus(data.status || null);
      } catch (e) {
        console.error('load existing order', e);
        setToast({ visible: true, message: 'Errore comunicazione con il server', type: 'error' });
      }
    };
    loadExisting();
  }, [editingOrderId, token]);

  const filtered = products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || (p.sku || '').toLowerCase().includes(query.toLowerCase()));

  const addToCart = (product) => {
    const exists = cart.find(c => c.productId === product.id);
    if (exists) setCart(cart.map(c => c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c));
    else setCart([...cart, { productId: product.id, quantity: 1, unitPrice: (typeof product.price === 'number') ? product.price : null }]);
  };

  const changeQty = (productId, qty) => {
    // allow empty input while editing (don't immediately remove item)
    if (qty === '' || qty === null) {
      setCart(cart.map(c => c.productId === productId ? { ...c, quantity: '' } : c));
      return;
    }
    const q = Number.isNaN(parseInt(qty, 10)) ? 0 : parseInt(qty, 10);
    if (q <= 0) {
      // keep item until user explicitly removes
      setCart(cart.map(c => c.productId === productId ? { ...c, quantity: 0 } : c));
    } else {
      setCart(cart.map(c => c.productId === productId ? { ...c, quantity: q } : c));
    }
  };

  const submitOrder = async () => {
  // build payload filtering out items with non-positive quantity
  // include unitPrice (from cart or fallback to product.price) so payload total is accurate
  const items = cart.map(c => ({ productId: c.productId, quantity: Number(c.quantity) || 0, unitPrice: (typeof c.unitPrice === 'number') ? c.unitPrice : (products.find(p => p.id === c.productId)?.price || null) })).filter(i => i.quantity > 0);
    if (items.length === 0) { setToast({ visible: true, message: 'Carrello vuoto o quantità non valide', type: 'error' }); return; }
    try {
      const payloadTotal = items.reduce((s, it) => s + ((typeof it.unitPrice === 'number' ? it.unitPrice : 0) * it.quantity), 0);
      const payload = { items, total: payloadTotal };
      if (user?.role === 'admin' && assignedToId) payload.assignedToId = assignedToId;
      if (user?.role === 'admin' && customerId) payload.customerId = customerId;
      let res;
      if (editingOrderId) {
        // when publishing an edited draft, ensure status moves to 'pending'
        if (editingOrderStatus === 'draft') payload.status = 'pending';
        res = await fetch(`${API_URL}/orders/${editingOrderId}`, { method: 'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      } else {
        res = await fetch(`${API_URL}/orders`, { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
      }
      const data = await res.json();
      if (res.ok) {
        // show success toast then navigate back so user sees the confirmation
        setToast({ visible: true, message: editingOrderId ? 'ordine aggiornato con successo' : 'ordine creato con successo', type: 'success' });
        try { triggerRefresh(); } catch (e) { }
        // Prefer syncing local cart from server response if it contains items/unitPrice.
        // If server does not return detailed items (common for draft endpoints),
        // reconstruct the cart from the payload we just sent using product prices
        // so totals update immediately and deterministically.
        if (data && data.id) {
          const serverItems = (data.items || []);
          let pre;
          if (serverItems.length) {
            pre = serverItems.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: (typeof i.unitPrice === 'number') ? i.unitPrice : null }));
          } else {
            // fallback: use the items we sent and look up product prices locally
            pre = items.map(i => {
              const p = products.find(pp => pp.id === i.productId) || {};
              return { productId: i.productId, quantity: i.quantity, unitPrice: (typeof p.price === 'number') ? p.price : null };
            });
          }
          setCart(pre);
          setCustomerId(data.customerId || null);
          setAssignedToId(data.assignedToId || null);
          setEditingOrderId(data.id || null);
          setEditingOrderStatus(data.status || null);
          // fetch freshest version from server to make sure totals/unitPrice are those persisted server-side
          try {
            const rFresh = await fetch(`${API_URL}/orders/${data.id}`, { headers: { Authorization: `Bearer ${token}` } });
            if (rFresh.ok) {
              const fresh = await rFresh.json();
              const preFresh = (fresh.items || []).map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: (typeof i.unitPrice === 'number') ? i.unitPrice : null }));
              setCart(preFresh);
              setCustomerId(fresh.customerId || null);
              setAssignedToId(fresh.assignedToId || null);
              setEditingOrderId(fresh.id || null);
              setEditingOrderStatus(fresh.status || null);
            }
          } catch (e) { /* ignore */ }
        } else {
          // If server didn't return an id (unexpected), keep local cart as-is — don't clear it.
        }
        setTimeout(() => {
          try {
            navigation.getParent()?.navigate('MainTabs', { screen: 'Ordini' });
          } catch (e) { /* ignore */ }
          navigation.goBack();
        }, 700);
      } else {
        // if backend returns stock error like "Stock insufficiente per prodotto <id>"
        if (res.status === 409 && data?.error && data.error.toLowerCase().includes('stock insuff')) {
          // try to map id to product name if present
          const match = data.error.match(/prodotto\s+(\d+)/i);
          let prodName = null;
          if (match) {
            const id = parseInt(match[1], 10);
            const p = products.find(x => x.id === id);
            if (p) prodName = p.name;
          }
          const msg = prodName ? `Stock insufficiente per prodotto "${prodName}"` : data.error || 'Stock insufficiente';
          setToast({ visible: true, message: msg, type: 'error' });
        } else {
          setToast({ visible: true, message: data.error || 'Errore creazione ordine', type: 'error' });
        }
      }
    } catch (err) { console.error('create order', err); setToast({ visible: true, message: 'Errore server', type: 'error' }); }
  };

  const total = cart.reduce((sum, it) => {
    const qty = Number(it.quantity) || 0;
    const p = products.find(pp => pp.id === it.productId) || { price: 0 };
    const unit = (typeof it.unitPrice === 'number') ? it.unitPrice : (p.price || 0);
    return sum + unit * qty;
  }, 0);

  const [cartExpanded, setCartExpanded] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  return (
    <View style={{ flex:1, paddingTop: 50, backgroundColor: '#F9F9FB' }}>
      <Text style={{ fontSize: 20, fontWeight: '700', margin: 16, marginTop: 8 }}>Nuovo ordine</Text>
      <View style={{ paddingHorizontal: 16 }}>
          <SearchInput placeholder="Cerca prodotti (nome, codice)" value={query} onChangeText={setQuery} />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={p => String(p.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 180 }}
        renderItem={({item}) => (
          <Card style={{ marginBottom: 12 }}>
            <Card.Content>
              <Text style={{ fontWeight: '700' }}>{item.name}</Text>
              <Text>SKU: {item.sku}</Text>
              <Text>Prezzo: €{(typeof item.price === 'number') ? item.price.toFixed(2) : item.price} — Disp: {item.stock}</Text>
            </Card.Content>
            <Card.Actions>
              <Button onPress={() => addToCart(item)}>Aggiungi</Button>
            </Card.Actions>
          </Card>
        )}
      />

      {/* Compact fixed cart bar + expandable dialog so product list remains usable */}
      <View style={styles.cartBar}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700' }}>Carrello: {cart.reduce((s, it) => s + (Number(it.quantity) || 0), 0)} articoli — Totale: €{total.toFixed(2)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ alignItems: 'center' }}>
            <IconButton icon="trash-can-outline" size={26} onPress={() => { setCart([]); Keyboard.dismiss(); }} accessibilityLabel="Svuota carrello" style={{ marginBottom: 2 }} />
            <Text style={{ fontSize: 11 }}>Svuota</Text>
          </View>

          <View style={{ width: 12 }} />

          <View style={{ alignItems: 'center' }}>
            <View style={{ position: 'relative' }}>
              <IconButton icon="cart-outline" size={26} onPress={() => setCartExpanded(true)} disabled={cart.length === 0} accessibilityLabel="Apri carrello" />
              {/** Purple badge positioned top-right of the cart icon */}
              {cart.reduce((s, it) => s + (Number(it.quantity) || 0), 0) > 0 && (
                <Badge style={styles.badgePurple}>{cart.reduce((s, it) => s + (Number(it.quantity) || 0), 0)}</Badge>
              )}
            </View>
            <Text style={{ fontSize: 11 }}>Carrello</Text>
          </View>
        </View>
      </View>

      <Portal>
        <Modal visible={cartExpanded} onDismiss={() => setCartExpanded(false)} contentContainerStyle={styles.centerModalContainer}>
          <Surface style={styles.centerPanel}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '700' }}>Carrello</Text>
              <IconButton icon="close" size={20} onPress={() => setCartExpanded(false)} />
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {cart.length === 0 ? <Text>Vuoto</Text> : cart.map(c => {
                const p = products.find(pp => pp.id === c.productId) || {};
                return (
                  <View key={c.productId} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text>{p.name || `Prod ${c.productId}`}</Text>
                      <Text style={{ fontSize: 12, color: '#666' }}>SKU: {p.sku || '—'}</Text>
                    </View>
                    <TextInput style={{ width: 80, marginRight: 8 }} keyboardType="numeric" value={c.quantity === '' ? '' : String(c.quantity)} onChangeText={(t) => changeQty(c.productId, t)} />
                    <IconButton icon="delete-outline" size={20} onPress={() => {
                      const next = cart.filter(x => x.productId !== c.productId);
                      setCart(next);
                    }} accessibilityLabel={`Rimuovi ${p.name || c.productId}`} />
                  </View>
                );
              })}
            </ScrollView>
            <View style={{ marginTop: 12 }}>
              <Text style={{ marginBottom: 8, fontWeight: '700' }}>Totale: €{total.toFixed(2)}</Text>
              {/* Assignee selector */}
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: '700', marginBottom: 6 }}>Cliente:</Text>
                {user?.role === 'admin' ? (
                  <View>
                    <View style={{ position: 'relative' }}>
                      <TextInput
                        label="Cliente"
                        value={(() => {
                          const u = users.find(x => x.id === customerId);
                          return u ? u.name : '';
                        })()}
                        onFocus={() => { if (users.length) { setCustomerPickerVisible(true); Keyboard.dismiss(); } }}
                        showSoftInputOnFocus={false}
                        caretHidden={true}
                      />
                      <IconButton
                        icon={customerId ? 'close' : 'chevron-down'}
                        size={20}
                        color="#333"
                        style={{ position: 'absolute', right: 6, top: 18 }}
                        onPress={() => { if (customerId) setCustomerId(null); else if (users.length) { setCustomerPickerVisible(true); Keyboard.dismiss(); } }}
                        accessibilityLabel={customerId ? 'Rimuovi cliente' : 'Apri selezione cliente'}
                      />
                    </View>
                    <Text style={{ fontSize: 12, color: '#666', marginTop: 6 }}>Tocca per scegliere il cliente (opzionale)</Text>
                    <AssigneePicker visible={customerPickerVisible} onDismiss={() => setCustomerPickerVisible(false)} users={users} onSelect={(u) => setCustomerId(u.id)} roleFilter={'customer'} title={'Seleziona cliente'} />
                  </View>
                ) : (
                  <TextInput label="Cliente" value={user?.name || ''} editable={false} />
                )}

                <View style={{ height: 12 }} />

                <Text style={{ fontWeight: '700', marginBottom: 6 }}>Assegna a:</Text>
                {/* simple select: only admin can choose an assignee; others will be assigned to themselves */}
                {user?.role === 'admin' ? (
                  <View>
                    <View style={{ position: 'relative' }}>
                      <TextInput
                        label="Assegnato a"
                        value={(() => {
                          const u = users.find(x => x.id === assignedToId);
                          return u ? u.name : '';
                        })()}
                        onFocus={() => { if (users.length) { setPickerVisible(true); Keyboard.dismiss(); } }}
                        showSoftInputOnFocus={false}
                        caretHidden={true}
                      />
                      <IconButton
                        icon={assignedToId ? 'close' : 'chevron-down'}
                        size={20}
                        color="#333"
                        style={{ position: 'absolute', right: 6, top: 18 }}
                        onPress={() => { if (assignedToId) setAssignedToId(null); else if (users.length) { setPickerVisible(true); Keyboard.dismiss(); } }}
                        accessibilityLabel={assignedToId ? 'Rimuovi assegnatario' : 'Apri selezione assegnatario'}
                      />
                    </View>
                    <Text style={{ fontSize: 12, color: '#666', marginTop: 6 }}>Tocca per scegliere un assegnatario</Text>
                    <AssigneePicker visible={pickerVisible} onDismiss={() => setPickerVisible(false)} users={users} onSelect={(u) => setAssignedToId(u.id)} roleFilter={['employee','admin']} title={'Seleziona assegnatario'} />
                  </View>
                ) : (
                  <View>
                    <TextInput label="Assegnato a" value={user?.name || ''} editable={false} />
                    <Text style={{ fontSize: 12, color: '#666', marginTop: 6 }}>L'ordine sarà assegnato a te</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Button mode="outlined" onPress={() => { setCart([]); Keyboard.dismiss(); }}>Svuota</Button>
                <View style={{ flexDirection: 'row' }}>
                  <Button mode="outlined" onPress={async () => {
                    // Save as draft: send status: 'draft'
                    const itemsPayload = cart.map(c => ({ productId: c.productId, quantity: Number(c.quantity) || 0, unitPrice: (typeof c.unitPrice === 'number') ? c.unitPrice : (products.find(p => p.id === c.productId)?.price || null) })).filter(i => i.quantity > 0);
                    if (itemsPayload.length === 0) { setToast({ visible: true, message: 'Carrello vuoto o quantità non valide', type: 'error' }); return; }
                    try {
                      const payloadTotal = itemsPayload.reduce((s, it) => s + ((typeof it.unitPrice === 'number' ? it.unitPrice : 0) * it.quantity), 0);
                      const payload = { items: itemsPayload, total: payloadTotal, status: 'draft' };
                      if (user?.role === 'admin' && assignedToId) payload.assignedToId = assignedToId;
                      if (user?.role === 'admin' && customerId) payload.customerId = customerId;
                          let res;
                          if (editingOrderId) {
                            // update existing order draft
                            const upd = { ...payload };
                            // ensure status: 'draft'
                            upd.status = 'draft';
                            res = await fetch(`${API_URL}/orders/${editingOrderId}`, { method: 'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(upd) });
                          } else {
                            res = await fetch(`${API_URL}/orders`, { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
                          }
                      const data = await res.json();
                      if (res.ok) {
                        setToast({ visible: true, message: 'Bozza salvata', type: 'success' });
                        try { triggerRefresh(); } catch (e) { }
                        // Prefer syncing local cart from server response if present (keeps unitPrice).
                        // Otherwise reconstruct from the payload we just sent so totals update immediately.
                        if (data && data.id) {
                          const serverItems2 = (data.items || []);
                          let pre2;
                          if (serverItems2.length) {
                            pre2 = serverItems2.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: (typeof i.unitPrice === 'number') ? i.unitPrice : null }));
                          } else {
                            pre2 = itemsPayload.map(i => {
                              const p = products.find(pp => pp.id === i.productId) || {};
                              return { productId: i.productId, quantity: i.quantity, unitPrice: (typeof p.price === 'number') ? p.price : null };
                            });
                          }
                          setCart(pre2);
                          setCustomerId(data.customerId || null);
                          setAssignedToId(data.assignedToId || null);
                          setEditingOrderId(data.id || null);
                          setEditingOrderStatus(data.status || null);
                          // fetch freshest version from server to ensure detail shows updated total
                          try {
                            const rFresh2 = await fetch(`${API_URL}/orders/${data.id}`, { headers: { Authorization: `Bearer ${token}` } });
                            if (rFresh2.ok) {
                              const fresh2 = await rFresh2.json();
                              const preFresh2 = (fresh2.items || []).map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: (typeof i.unitPrice === 'number') ? i.unitPrice : null }));
                              setCart(preFresh2);
                              setCustomerId(fresh2.customerId || null);
                              setAssignedToId(fresh2.assignedToId || null);
                              setEditingOrderId(fresh2.id || null);
                              setEditingOrderStatus(fresh2.status || null);
                            }
                          } catch (e) { console.debug('NewOrderScreen: error fetching fresh after save-draft', e); }
                        } else {
                          // keep existing cart if server didn't return an id
                        }
                        setCartExpanded(false);
                        setTimeout(() => { navigation.goBack(); }, 600);
                      } else {
                        setToast({ visible: true, message: data?.error || 'Errore salvataggio bozza', type: 'error' });
                      }
                    } catch (err) { console.error('save draft', err); setToast({ visible: true, message: 'Errore server', type: 'error' }); }
                  }} style={{ marginRight: 8 }}>Salva bozza</Button>
                  <Button mode="contained" onPress={() => { submitOrder(); setCartExpanded(false); }} disabled={cart.length === 0}>Crea ordine</Button>
                </View>
              </View>
            </View>
          </Surface>
        </Modal>
      </Portal>
      <FloatingToast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast({ ...toast, visible: false })} />
    </View>
  );
}

const styles = StyleSheet.create({
  cartBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    elevation: 6,
    flexDirection: 'row',
    alignItems: 'center'
  },
  badgePurple: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#7E57C2',
    color: '#fff',
  },
  centerModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerPanel: {
    width: '90%',
    maxHeight: 520,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    elevation: 8,
  }
  ,
  // legacy search styles removed; use src/components/SearchInput instead
});
