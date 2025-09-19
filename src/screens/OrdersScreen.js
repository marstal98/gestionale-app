import React, { useContext, useEffect, useState } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { Text, Card, Button, Portal, Dialog, TextInput } from "react-native-paper";
import { AuthContext } from "../context/AuthContext";
import { API_URL } from "../config";

export default function OrdersScreen() {
  const { token, user } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // order form
  const [showDialog, setShowDialog] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]); // [{productId, quantity}]

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
    } catch (err) {
      console.error('Errore fetch orders/products', err);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

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
      if (res.ok) { setShowDialog(false); setSelectedItems([]); fetchData(); }
      else { const err = await res.json(); alert(err.error || 'Errore'); }
    } catch (err) { console.error(err); }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gestione Ordini 📦</Text>

      <FlatList
        data={orders}
        keyExtractor={o => o.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({item}) => (
          <Card style={{ marginBottom: 12 }}>
            <Card.Content>
              <Text>#{item.id} - {item.status}</Text>
              <Text>Totale: €{item.total}</Text>
            </Card.Content>
          </Card>
        )}
      />

      {user?.role === 'customer' && (
        <Button mode="contained" onPress={() => setShowDialog(true)} style={{ margin: 16 }}>Nuovo ordine</Button>
      )}

      <Portal>
        <Dialog visible={showDialog} onDismiss={() => setShowDialog(false)}>
          <Dialog.Title>Seleziona prodotti</Dialog.Title>
          <Dialog.Content>
            {products.map(p => {
              const sel = selectedItems.find(i => i.productId === p.id);
              // validation for selected item
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
            {/* Disable create when no items selected or any validation errors present */}
            <Button onPress={createOrder} disabled={selectedItems.length === 0 || selectedItems.some(si => {
              const prod = products.find(p => p.id === si.productId);
              if (!prod) return true;
              if (!Number.isInteger(si.quantity) || si.quantity <= 0) return true;
              if (typeof prod.stock === 'number' && si.quantity > prod.stock) return true;
              return false;
            })}>Crea</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#F9F9FB' },
  title: { fontSize:22, fontWeight:'600', margin:16 }
});
