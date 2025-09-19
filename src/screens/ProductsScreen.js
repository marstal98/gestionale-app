import React, { useEffect, useState, useContext } from 'react';
import { View, StyleSheet, FlatList, StatusBar } from 'react-native';
import { Text, Card, Button, FAB, Dialog, Portal, TextInput } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../config';
import FloatingToast from '../components/FloatingToast';

export default function ProductsScreen() {
  const { token, user } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState('success');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/products`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setProducts(data);
    } catch (err) {
      console.error('Errore fetch prodotti', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const openDialog = (p = null) => {
    if (p) {
      setEditing(p);
      setName(p.name || '');
      setSku(p.sku || '');
      setPrice(String(p.price || ''));
      setStock(String(p.stock || ''));
    } else {
      setEditing(null);
      setName(''); setSku(''); setPrice(''); setStock('');
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!name || !price) { showToast('Nome e prezzo obbligatori', 'error'); return; }
    try {
      const url = editing ? `${API_URL}/products/${editing.id}` : `${API_URL}/products`;
      const method = editing ? 'PUT' : 'POST';
      const body = { name, sku, price: parseFloat(price), stock: parseInt(stock || 0) };
      const res = await fetch(url, { method, headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (res.ok) {
        fetchProducts(); setShowDialog(false); showToast(editing ? 'Prodotto aggiornato' : 'Prodotto creato', 'success');
      } else {
        const err = await res.json(); showToast(err.error || 'Errore', 'error');
      }
    } catch (err) { console.error(err); showToast('Errore server', 'error'); }
  };

  const handleDelete = async (p) => {
    try {
      const res = await fetch(`${API_URL}/products/${p.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { fetchProducts(); showToast('Prodotto eliminato', 'success'); }
      else { const err = await res.json(); showToast(err.error || 'Errore', 'error'); }
    } catch (err) { console.error(err); showToast('Errore server', 'error'); }
  };

  const confirmDelete = (p) => {
    setProductToDelete(p);
    setShowConfirmDelete(true);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    await handleDelete(productToDelete);
    setShowConfirmDelete(false);
    setProductToDelete(null);
  };

  return (
    <View style={{ flex:1, backgroundColor:'#F9F9FB', paddingTop: 50 }}>
      <StatusBar backgroundColor="transparent" barStyle="dark-content" translucent />
      <FlatList
        data={products}
        keyExtractor={i => i.id.toString()}
        contentContainerStyle={{ padding:16, paddingTop: 16 }}
        renderItem={({item}) => (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.name}>{item.name}</Text>
              <Text>SKU: {item.sku || '-'}</Text>
              <Text>Prezzo: €{item.price}</Text>
              <Text>Disponibilità: {item.stock}</Text>
            </Card.Content>
            {user?.role === 'admin' && (
              <Card.Actions style={styles.actions}>
                <Button mode="text" onPress={() => openDialog(item)} icon="pencil" textColor="#7E57C2">Modifica</Button>
                <Button mode="text" onPress={() => confirmDelete(item)} icon="delete" textColor="red">Elimina</Button>
              </Card.Actions>
            )}
          </Card>
        )}
      />

      {user?.role === 'admin' && (
        <FAB icon="plus" style={styles.fab} onPress={() => openDialog()} color="white" />
      )}

      <Portal>
        <Dialog visible={showDialog} onDismiss={() => setShowDialog(false)} style={styles.dialog}>
          <Dialog.Title>{editing ? 'Modifica prodotto' : 'Nuovo prodotto'}</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Nome" value={name} onChangeText={setName} style={styles.input} />
            <TextInput label="SKU" value={sku} onChangeText={setSku} style={styles.input} />
            <TextInput label="Prezzo" value={price} onChangeText={setPrice} keyboardType="numeric" style={styles.input} />
            <TextInput label="Stock" value={stock} onChangeText={setStock} keyboardType="numeric" style={styles.input} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDialog(false)}>Annulla</Button>
            <Button onPress={handleSave}>Salva</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={showConfirmDelete} onDismiss={() => setShowConfirmDelete(false)} style={styles.dialog}>
          <Dialog.Title>Conferma</Dialog.Title>
          <Dialog.Content>
            <Text>Vuoi davvero eliminare il prodotto "{productToDelete?.name}"?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowConfirmDelete(false)}>Annulla</Button>
            <Button textColor="red" onPress={handleConfirmDelete}>Elimina</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <FloatingToast visible={toastVisible} message={toastMsg} type={toastType} onHide={() => setToastVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom:12, borderRadius:12, backgroundColor:'#fff' },
  name: { fontSize:18, fontWeight:'600', marginBottom:6 },
  fab: { position:'absolute', right:20, bottom:20, backgroundColor:'#7E57C2' },
  input: { marginBottom:10 },
  dialog: { borderRadius:12, backgroundColor:'#fff' }
});
