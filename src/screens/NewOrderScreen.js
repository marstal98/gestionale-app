import React, { useContext, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, FlatList, StyleSheet, Keyboard } from 'react-native';
import { Text, Button, Card, FAB, Portal, Modal, IconButton, Badge, Surface, Dialog } from 'react-native-paper';
import RequiredTextInput from '../components/RequiredTextInput';
import { showToast } from '../utils/toastService';
import SearchInput from '../components/SearchInput';
import { ScrollView, Dimensions } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { SyncContext } from '../context/SyncContext';
import { API_URL } from '../config';
import { buildHeaders } from '../utils/api';
import { safeMessageFromData } from '../utils/errorUtils';
import AssigneePicker from '../components/AssigneePicker';
import CreateCustomerModal from '../components/CreateCustomerModal';

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
  const [isDeleted, setIsDeleted] = useState(false);
  const [assignConfirm, setAssignConfirm] = useState({ visible: false, payload: null, isEditing: false });
  const [pickerVisible, setPickerVisible] = useState(false);
  const [customerPickerVisible, setCustomerPickerVisible] = useState(false);
  const [createCustomerVisible, setCreateCustomerVisible] = useState(false);

  const fetchProducts = async () => {
    try {
  const res = await fetch(`${API_URL}/products`, { headers: buildHeaders(token) });
      const data = await res.json();
      if (res.ok) setProducts(data);
    } catch (err) { console.error('fetch products', err); }
    finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    try {
  const res = await fetch(`${API_URL}/users`, { headers: buildHeaders(token) });
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
  const res = await fetch(`${API_URL}/orders/${editingOrderId}`, { headers: buildHeaders(token) });
        if (res.status === 404) {
          showToast('Ordine non trovato (potrebbe essere stato eliminato)', 'error');
          setEditingOrderId(null);
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const safe = safeMessageFromData(data, 'Errore recupero ordine');
          showToast(safe, 'error');
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
  setIsDeleted(!!data.deletedAt);
      } catch (e) {
        console.error('load existing order', e);
    showToast('Errore comunicazione con il server', 'error');
      }
    };
    loadExisting();
  }, [editingOrderId, token]);

  const filtered = products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || (p.sku || '').toLowerCase().includes(query.toLowerCase()));

  const addToCart = (product) => {
    if (isDeleted) {
    showToast('Ordine nel cestino: non è possibile modificare', 'error');
      return;
    }
    const exists = cart.find(c => c.productId === product.id);
    if (exists) setCart(cart.map(c => c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c));
    else setCart([...cart, { productId: product.id, quantity: 1, unitPrice: (typeof product.price === 'number') ? product.price : null }]);
  };

  const changeQty = (productId, qty) => {
    if (isDeleted) return;
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
  if (items.length === 0) { showToast('Carrello vuoto o quantità non valide', 'error'); return; }
    try {
      const payloadTotal = items.reduce((s, it) => s + ((typeof it.unitPrice === 'number' ? it.unitPrice : 0) * it.quantity), 0);
      const payload = { items, total: payloadTotal };
      if (user?.role === 'admin' && assignedToId) payload.assignedToId = assignedToId;
      if (user?.role === 'admin' && customerId) payload.customerId = customerId;
      // Validation: when creating a real order (not editing a draft), customer is required
      if (!editingOrderId) {
        if (!customerId) {
          showToast('Devi selezionare un cliente per creare l\'ordine', 'error');
          return;
        }
        // attach customer for non-admin users too (if selected by UI)
        if (customerId) payload.customerId = customerId;
      }
      // Before performing the actual submit, ensure customer is assigned to the selected employee (if both present)
      const needCheckAssignment = !!payload.customerId && !!payload.assignedToId;
      if (needCheckAssignment) {
        try {
          const aRes = await fetch(`${API_URL}/assignments?employeeId=${payload.assignedToId}&customerId=${payload.customerId}`, { headers: buildHeaders(token) });
          const aData = aRes.ok ? await aRes.json() : [];
          if (!Array.isArray(aData) || aData.length === 0) {
            // prompt the user to assign customer to employee
            setAssignConfirm({ visible: true, payload, isEditing: !!editingOrderId });
            return;
          }
        } catch (e) { /* ignore and continue to submit */ }
      }

      // if ok or no check needed, continue to perform submit
      const submitOrderContinue = async (payloadToSend, editingFlag) => {
        let res;
        if (editingFlag) {
          // when publishing an edited draft, ensure status moves to 'pending'
          if (editingOrderStatus === 'draft') payloadToSend.status = 'pending';
          res = await fetch(`${API_URL}/orders/${editingOrderId}`, { method: 'PUT', headers: buildHeaders(token, { 'Content-Type':'application/json' }), body: JSON.stringify(payloadToSend) });
        } else {
          res = await fetch(`${API_URL}/orders`, { method: 'POST', headers: buildHeaders(token, { 'Content-Type':'application/json' }), body: JSON.stringify(payloadToSend) });
        }
  const data = await res.json();
  if (res.ok) {
          // show success toast then navigate back so user sees the confirmation
          showToast(editingFlag ? 'ordine aggiornato con successo' : 'ordine creato con successo', 'success');
          try { triggerRefresh(); } catch (e) { }
          // Prefer syncing local cart from server response if it contains items/unitPrice.
          if (data && data.id) {
            const serverItems = (data.items || []);
            let pre;
            if (serverItems.length) {
              pre = serverItems.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: (typeof i.unitPrice === 'number') ? i.unitPrice : null }));
            } else {
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
            try {
              const rFresh = await fetch(`${API_URL}/orders/${data.id}`, { headers: buildHeaders(token) });
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
          }
          setTimeout(() => {
            try {
              navigation.getParent()?.navigate('MainTabs', { screen: 'Ordini' });
            } catch (e) { /* ignore */ }
            navigation.goBack();
          }, 700);
        } else {
          // if backend returns stock error like "Stock insufficiente per prodotto <id>"
          const rawErr = data && data.error ? String(data.error) : '';
          if (res.status === 409 && rawErr.toLowerCase().includes('stock insuff')) {
            // parse product id from server message internally (never show raw server text)
            const match = rawErr.match(/prodotto\s+(\d+)/i);
            let prodName = null;
            if (match) {
              const id = parseInt(match[1], 10);
              const p = products.find(x => x.id === id);
              if (p) prodName = p.name;
            }
            const msg = prodName ? `Stock insufficiente per prodotto "${prodName}"` : 'Stock insufficiente';
            showToast(msg, 'error');
            } else {
            // If server indicates mapping is required, show the assign-confirm dialog instead of raw error
            const safe = safeMessageFromData(data, 'Errore creazione ordine');
            if (safe === 'mapping_required') {
              setAssignConfirm({ visible: true, payload: payloadToSend, isEditing: editingFlag });
              return;
            }
            showToast(safe, 'error');
          }
        }
      };

      await submitOrderContinue(payload, !!editingOrderId);
  } catch (err) { console.error('create order', err); showToast('Errore server', 'error'); }
  };

  const total = cart.reduce((sum, it) => {
    const qty = Number(it.quantity) || 0;
    const p = products.find(pp => pp.id === it.productId) || { price: 0 };
    const unit = (typeof it.unitPrice === 'number') ? it.unitPrice : (p.price || 0);
    return sum + unit * qty;
  }, 0);

  const [cartExpanded, setCartExpanded] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const onFieldInvalid = (fieldName) => {
    setFieldErrors(e => ({ ...e, [fieldName]: true }));
  showToast(`Campo ${fieldName} obbligatorio`, 'error');
  }

  useFocusEffect(
    React.useCallback(() => {
      return () => { try { setFieldErrors({}); } catch (e) { } };
    }, [])
  );

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
              <Text style={{ fontSize: 20, fontWeight: '800' }}>Carrello</Text>
              <IconButton icon="close" size={22} onPress={() => setCartExpanded(false)} />
            </View>
            <ScrollView style={{ maxHeight: 560 }}>
              {cart.length === 0 ? <Text>Vuoto</Text> : cart.map(c => {
                const p = products.find(pp => pp.id === c.productId) || {};
                const qty = Number(c.quantity) || 0;
                const unit = (typeof c.unitPrice === 'number') ? c.unitPrice : (p.price || 0);
                const subtotal = (unit * qty).toFixed(2);
                return (
                  <View key={c.productId} style={styles.itemRow}>
                    <View style={styles.itemInfo}>
                      <Text style={{ fontWeight: '700', fontSize: 16 }}>{p.name || `Prod ${c.productId}`}</Text>
                      <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>SKU: {p.sku || '—'}</Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                        <Text style={{ fontSize: 13, color: '#333' }}>Prezzo: €{(typeof unit === 'number') ? unit.toFixed(2) : unit}</Text>
                        <Text style={styles.subtotalText}>€{subtotal}</Text>
                      </View>
                    </View>
                    <View style={styles.itemActions}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <RequiredTextInput
                          label="Quantità"
                          name={`Quantità_${c.productId}`}
                          style={styles.qtyInput}
                          keyboardType="numeric"
                          value={c.quantity === '' ? '' : String(c.quantity)}
                          onChangeText={(t) => { if (!isDeleted) changeQty(c.productId, t); }}
                          editable={!isDeleted}
                          onInvalid={() => onFieldInvalid(`Quantità_${c.productId}`)}
                          showError={!!fieldErrors[`Quantità_${c.productId}`]}
                        />
                        <IconButton icon="delete-outline" size={26} disabled={isDeleted} onPress={() => {
                          if (isDeleted) return;
                          const next = cart.filter(x => x.productId !== c.productId);
                          setCart(next);
                        }} accessibilityLabel={`Rimuovi ${p.name || c.productId}`} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <View style={{ marginTop: 12 }}>
              <Text style={{ marginBottom: 8, fontWeight: '800', fontSize: 18 }}>Totale: €{total.toFixed(2)}</Text>
              {/* Assignee selector */}
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: '700', marginBottom: 6 }}>Cliente:</Text>
                <View>
                    <View style={{ position: 'relative' }}>
                    <RequiredTextInput
                      label="Cliente"
                      name="Cliente"
                      value={(() => { const u = users.find(x => x.id === customerId); return u ? u.name : ''; })()}
                      onFocus={() => { if (users.length) { setCustomerPickerVisible(true); Keyboard.dismiss(); } }}
                      showSoftInputOnFocus={false}
                      caretHidden={true}
                      editable={!isDeleted}
                      onInvalid={() => onFieldInvalid('Cliente')}
                      showError={!!fieldErrors.Cliente}
                    />
                    <IconButton
                      icon={customerId ? 'close' : 'chevron-down'}
                      size={20}
                      color="#333"
                      style={{ position: 'absolute', right: 6, top: 18 }}
                      onPress={() => { if (isDeleted) return; if (customerId) setCustomerId(null); else if (users.length) { setCustomerPickerVisible(true); Keyboard.dismiss(); } }}
                      accessibilityLabel={customerId ? 'Rimuovi cliente' : 'Apri selezione cliente'}
                    />
                  </View>
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 6 }}>{isDeleted ? 'Ordine nel cestino: non modificabile' : 'Tocca per scegliere il cliente'}</Text>
                  <AssigneePicker visible={customerPickerVisible} onDismiss={() => setCustomerPickerVisible(false)} users={users} onSelect={(u) => setCustomerId(u.id)} roleFilter={'customer'} title={'Seleziona cliente'} />
                  <View style={{ height: 8 }} />
                  {user?.role === 'admin' && <Button mode="outlined" onPress={() => setCreateCustomerVisible(true)}>Crea nuovo cliente</Button>}
                </View>

                <View style={{ height: 12 }} />

                <Text style={{ fontWeight: '700', marginBottom: 6 }}>Assegna a:</Text>
                {/* simple select: only admin can choose an assignee; others will be assigned to themselves */}
                {user?.role === 'admin' ? (
                  <View>
                    <View style={{ position: 'relative' }}>
                      <RequiredTextInput
                        label="Assegnato a"
                        name="Assegnato a"
                        value={(() => {
                          const u = users.find(x => x.id === assignedToId);
                          return u ? u.name : '';
                        })()}
                        onFocus={() => { if (users.length) { setPickerVisible(true); Keyboard.dismiss(); } }}
                        showSoftInputOnFocus={false}
                        caretHidden={true}
                        onInvalid={() => onFieldInvalid('Assegnato a')}
                        showError={!!fieldErrors['Assegnato a']}
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
                    {/* filter out current user from the dropdown choices and pass a filtered list */}
                    <AssigneePicker
                      visible={pickerVisible}
                      onDismiss={() => setPickerVisible(false)}
                      users={users.filter(u => u.id !== user?.id)}
                      onSelect={(u) => setAssignedToId(u.id)}
                      roleFilter={['employee','admin']}
                      title={'Seleziona assegnatario'}
                    />
                    <View style={{ height: 8 }} />
                    {/* Add 'Assegna a me' button styled like Crea nuovo cliente */}
                    <Button mode="outlined" onPress={() => { if (!user) return; setAssignedToId(user.id); setPickerVisible(false); }}>
                      Assegna a me
                    </Button>
                  </View>
                ) : (
                  <View>
                    <RequiredTextInput label="Assegnato a" name="Assegnato a" value={user?.name || ''} editable={false} showError={!!fieldErrors['Assegnato a']} />
                    <Text style={{ fontSize: 12, color: '#666', marginTop: 6 }}>L'ordine sarà assegnato a te</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Button mode="outlined" onPress={() => { setCart([]); Keyboard.dismiss(); }}>Svuota</Button>
                <View style={{ flexDirection: 'row' }}>
                  <Button mode="outlined" disabled={isDeleted} onPress={async () => {
                    // Save as draft: send status: 'draft'
                    const itemsPayload = cart.map(c => ({ productId: c.productId, quantity: Number(c.quantity) || 0, unitPrice: (typeof c.unitPrice === 'number') ? c.unitPrice : (products.find(p => p.id === c.productId)?.price || null) })).filter(i => i.quantity > 0);
                    if (itemsPayload.length === 0) { showToast('Carrello vuoto o quantità non valide', 'error'); return; }
                    if (!customerId) {
                      // require assigning a customer for drafts per request
                      showToast('Devi assegnare prima un cliente per salvare la bozza', 'error');
                      setCustomerPickerVisible(true);
                      return;
                    }
                    try {
                      const payloadTotal = itemsPayload.reduce((s, it) => s + ((typeof it.unitPrice === 'number' ? it.unitPrice : 0) * it.quantity), 0);
                      const payload = { items: itemsPayload, total: payloadTotal, status: 'draft' };
                      if (user?.role === 'admin' && assignedToId) payload.assignedToId = assignedToId;
                      if (customerId) payload.customerId = customerId;
                          let res;
                          if (editingOrderId) {
                            // update existing order draft
                            const upd = { ...payload };
                            // ensure status: 'draft'
                            upd.status = 'draft';
                            res = await fetch(`${API_URL}/orders/${editingOrderId}`, { method: 'PUT', headers: buildHeaders(token, { 'Content-Type':'application/json' }), body: JSON.stringify(upd) });
                          } else {
                            res = await fetch(`${API_URL}/orders`, { method: 'POST', headers: buildHeaders(token, { 'Content-Type':'application/json' }), body: JSON.stringify(payload) });
                          }
                      const data = await res.json();
                      if (res.ok) {
                        showToast('Bozza salvata', 'success');
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
                            const rFresh2 = await fetch(`${API_URL}/orders/${data.id}`, { headers: buildHeaders(token) });
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
                        const safe = safeMessageFromData(data || {}, 'Errore salvataggio bozza');
                        showToast(safe, 'error');
                      }
                    } catch (err) { console.error('save draft', err); showToast('Errore server', 'error'); }
                  }} style={{ marginRight: 8 }}>Salva bozza</Button>
                  <Button mode="contained" onPress={() => { submitOrder(); setCartExpanded(false); }} disabled={cart.length === 0 || isDeleted}>Crea ordine</Button>
                </View>
              </View>
            </View>
            <CreateCustomerModal visible={createCustomerVisible} onDismiss={() => setCreateCustomerVisible(false)} token={token} onCreated={(res) => {
              // res: created user or { existing:true, user }
              if (!res) return;
              if (res.existing && res.user) {
                // ask to confirm linking - simple automatic link: set customerId to existing
                // ensure the existing user is visible in users list immediately
                setUsers(prev => {
                  if (!prev.some(u => u.id === res.user.id)) return [res.user, ...prev];
                  return prev;
                });
                setCustomerId(res.user.id);
                showToast(`Usando cliente esistente: ${res.user.email}`, 'success');
                setCreateCustomerVisible(false);
                return;
              }
              // created: set id
              // add to users list so dropdown shows immediately
              setUsers(prev => {
                const u = { id: res.id, name: res.name || '', email: res.email || '', role: res.role || 'customer', createdAt: new Date().toISOString(), isActive: true };
                return [u, ...prev];
              });
              setCustomerId(res.id);
              showToast(`Cliente creato: ${res.email}`, 'success');
              setCreateCustomerVisible(false);
            }} />
          </Surface>
        </Modal>
        {/* Confirm assign dialog: shown when customer is not assigned to selected employee */}
        <Dialog visible={assignConfirm.visible} onDismiss={() => setAssignConfirm({ visible: false, payload: null, isEditing: false })}>
          <Dialog.Title>Cliente non assegnato</Dialog.Title>
            <Dialog.Content>
              <Text>questo cliente non è asseganto a questo dipendente, lo si vuole assegnare?</Text>
            </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setAssignConfirm({ visible: false, payload: null, isEditing: false }); showToast('Ordine annullato', 'info'); }}>No, annulla</Button>
            <Button mode="contained" onPress={async () => {
              if (!assignConfirm.payload) return;
              const { payload, isEditing } = assignConfirm;
              try {
                // create assignment via API
                const aRes = await fetch(`${API_URL}/assignments`, { method: 'POST', headers: buildHeaders(token, { 'Content-Type':'application/json' }), body: JSON.stringify({ customerId: payload.customerId, employeeId: payload.assignedToId }) });
                if (!aRes.ok) {
                  const err = await aRes.json().catch(() => ({}));
                  // never show raw server error text — sanitize and display a safe message
                  try {
                    const safe = safeMessageFromData(err || {}, 'Errore assegnazione cliente');
                    showToast(safe, 'error');
                  } catch (e) { showToast('Errore assegnazione cliente', 'error'); }
                  setAssignConfirm({ visible: false, payload: null, isEditing: false });
                  return;
                }
                // proceed with submit after creating assignment
                setAssignConfirm({ visible: false, payload: null, isEditing: false });
                // call internal submit continuation
                try {
                  // reuse submit continuation by invoking submitOrder again but bypassing assignment check
                  // call the internal helper by duplicating small part: a simple POST/PUT done below
                    if (isEditing) {
                    // ensure status moves to pending if it was draft
                    if (editingOrderStatus === 'draft') payload.status = 'pending';
                    const res = await fetch(`${API_URL}/orders/${editingOrderId}`, { method: 'PUT', headers: buildHeaders(token, { 'Content-Type':'application/json' }), body: JSON.stringify(payload) });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) showToast('ordine aggiornato con successo', 'success');
                    else {
                      // If server signals mapping_required (should be unlikely after creating assignment), reopen dialog
                      const safe = safeMessageFromData(data, 'Errore creazione ordine');
                      if (safe === 'mapping_required') {
                        setAssignConfirm({ visible: true, payload, isEditing });
                        return;
                      }
                      showToast(safe, 'error');
                    }
                    } else {
                    const res = await fetch(`${API_URL}/orders`, { method: 'POST', headers: buildHeaders(token, { 'Content-Type':'application/json' }), body: JSON.stringify(payload) });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) showToast('ordine creato con successo', 'success');
                      else {
                      if (data && (data.error === 'mapping_required' || data.mappingRequired)) {
                        setAssignConfirm({ visible: true, payload, isEditing });
                        return;
                      }
                      const safe = safeMessageFromData(data || {}, 'Errore creazione ordine');
                      showToast(safe, 'error');
                    }
                  }
                  try { triggerRefresh(); } catch (e) {}
                } catch (e) { console.error('submit after assign', e); showToast('Errore server', 'error'); }
              } catch (e) { console.error('create assignment', e); showToast('Errore durante assegnazione', 'error'); }
            }}>Assegna e crea</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      {/* Global toast host handles toasts now - no local FloatingToast here */}
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
    maxHeight: 700,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    elevation: 8,
  },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: '#FAFAFC',
    },
    itemInfo: {
      flex: 1,
      paddingRight: 12,
    },
    itemActions: {
      width: 140,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    qtyInput: {
      width: 56,
      marginRight: 6,
      textAlign: 'center',
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderRadius: 6,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: '#E6E6EA',
    },
    subtotalText: {
      fontWeight: '700',
      color: '#333'
    }
  ,
  // legacy search styles removed; use src/components/SearchInput instead
});
