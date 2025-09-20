import React, { useContext, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Keyboard } from 'react-native';
import { Text, TextInput, Button, Card, FAB, Portal, Modal, IconButton, Badge, Surface } from 'react-native-paper';
import FloatingToast from '../components/FloatingToast';
import SearchInput from '../components/SearchInput';
import { ScrollView, Dimensions } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { SyncContext } from '../context/SyncContext';
import { API_URL } from '../config';

export default function NewOrderScreen({ navigation }) {
  const { token } = useContext(AuthContext);
  const { triggerRefresh } = useContext(SyncContext);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState([]); // { productId, quantity }
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/products`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setProducts(data);
    } catch (err) { console.error('fetch products', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (token) fetchProducts(); }, [token]);

  const filtered = products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || (p.sku || '').toLowerCase().includes(query.toLowerCase()));

  const addToCart = (product) => {
    const exists = cart.find(c => c.productId === product.id);
    if (exists) setCart(cart.map(c => c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c));
    else setCart([...cart, { productId: product.id, quantity: 1 }]);
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
    const items = cart.map(c => ({ productId: c.productId, quantity: Number(c.quantity) || 0 })).filter(i => i.quantity > 0);
    if (items.length === 0) { setToast({ visible: true, message: 'Carrello vuoto o quantità non valide', type: 'error' }); return; }
    try {
      const res = await fetch(`${API_URL}/orders`, { method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ items }) });
      const data = await res.json();
      if (res.ok) {
        // show success toast then navigate back so user sees the confirmation
        setToast({ visible: true, message: 'ordine creato con successo', type: 'success' });
        try { triggerRefresh(); } catch (e) { }
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
    return sum + (p.price || 0) * qty;
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
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Button mode="outlined" onPress={() => { setCart([]); Keyboard.dismiss(); }}>Svuota</Button>
                <Button mode="contained" onPress={() => { submitOrder(); setCartExpanded(false); }} disabled={cart.length === 0}>Crea ordine</Button>
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
