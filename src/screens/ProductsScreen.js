import React, { useEffect, useState, useContext } from 'react';
import { View, StyleSheet, FlatList, StatusBar, Share } from 'react-native';
import { Text, Card, Button, FAB, Dialog, Portal, TextInput, ActivityIndicator, IconButton } from 'react-native-paper';
import { AuthContext } from '../context/AuthContext';
import SearchInput from '../components/SearchInput';
import { API_URL } from '../config';
import FloatingToast from '../components/FloatingToast';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function ProductsScreen() {
  const { token, user } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importReport, setImportReport] = useState(null);
  const [importing, setImporting] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportCsv, setExportCsv] = useState('');
  const [exporting, setExporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [tooltip, setTooltip] = useState({ visible: false, text: '', bottom: 0 });
 

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

  useEffect(() => { if (token) fetchProducts(); }, [token]);

  const filteredProducts = products.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (p.name || '').toLowerCase().includes(s) || (p.sku || '').toLowerCase().includes(s) || String(p.id).includes(s);
  });

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
      {/* left floating import/export FABs will be rendered below */}

      <View style={{ paddingHorizontal: 16 }}>
          <SearchInput placeholder="Cerca prodotti (nome, codice)" value={search} onChangeText={setSearch} />
      </View>

      <FlatList
        data={filteredProducts}
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

      {/* Import/Export floating buttons on left */}
      {user?.role === 'admin' && (
        <>
          <FAB icon="file-import" style={styles.leftFabTop} onPress={() => setShowImportDialog(true)} onLongPress={() => { setTooltip({ visible: true, text: 'Importa CSV', bottom: 88 }); setTimeout(() => setTooltip({ visible: false, text: '', bottom: 0 }), 1400); }} color="#fff" />
          <FAB icon="file-export" style={styles.leftFabBottom} onPress={async () => {
            setShowExportDialog(true);
            setExportCsv('');
            setExporting(true);
            try {
              const res = await fetch(`${API_URL}/products/export`, { headers: { Authorization: `Bearer ${token}` } });
              if (res.ok) {
                const text = await res.text();
                setExportCsv(text);
              } else {
                const err = await res.json();
                showToast(err.error || 'Errore export', 'error');
                setShowExportDialog(false);
              }
            } catch (err) { console.error('Export error', err); showToast('Errore server', 'error'); setShowExportDialog(false); }
            setExporting(false);
          }} onLongPress={() => { setTooltip({ visible: true, text: 'Esporta CSV', bottom: 20 }); setTimeout(() => setTooltip({ visible: false, text: '', bottom: 0 }), 1400); }} color="#fff" />
        </>
      )}

      <Portal>
        <Dialog visible={showImportDialog} onDismiss={() => setShowImportDialog(false)} style={styles.dialog}>
          <Dialog.Title>Importa CSV prodotti</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 8 }}>Seleziona un file .csv. Intestazione richiesta: <Text style={{ fontWeight: '700' }}>sku,name,description,price,stock,category</Text></Text>
            <Text style={{ marginBottom: 8, color:'#666' }}>Il file importerà solo nuovi prodotti (skus già presenti verranno saltati). I campi price e stock devono essere numerici.</Text>
            <Button mode="outlined" icon="file-upload" onPress={async () => {
              try {
                const res = await DocumentPicker.getDocumentAsync({ type: 'text/csv' });
                if (res.type === 'success') {
                  // upload file
                  setImporting(true);
                  const uri = res.uri;
                  const fileName = res.name || 'products.csv';
                  const formData = new FormData();
                  formData.append('file', { uri, name: fileName, type: 'text/csv' });
                  try {
                    const uploadRes = await fetch(`${API_URL}/products/import`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
                    const data = await uploadRes.json();
                    if (uploadRes.ok) {
                      setImportReport(data);
                      fetchProducts();
                      showToast('Import completato', 'success');
                    } else {
                      setImportReport(data);
                      showToast(data.error || 'Errore import', 'error');
                    }
                  } catch (uerr) { console.error('Upload error', uerr); showToast('Errore upload', 'error'); }
                  setImporting(false);
                }
              } catch (err) { console.error('Picker error', err); showToast('Errore selezione file', 'error'); setImporting(false); }
            }}>Seleziona file CSV</Button>
            {importing && <ActivityIndicator animating={true} />}
            {importReport && (
              <View style={{ marginTop:8 }}>
                <Text>Creati: {importReport.created}</Text>
                <Text>Saltati: {importReport.skipped}</Text>
                <Text>Errors: {importReport.errors?.length || 0}</Text>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setShowImportDialog(false); setCsvText(''); setImportReport(null); }}>Chiudi</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={showExportDialog} onDismiss={() => setShowExportDialog(false)} style={styles.dialog}>
          <Dialog.Title>Export CSV prodotti</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="CSV"
              value={exportCsv}
              onChangeText={setExportCsv}
              multiline
              numberOfLines={8}
              style={{ backgroundColor: '#fff', marginBottom: 8 }}
              editable={false}
            />
            {exporting && <Text>Preparazione CSV...</Text>}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowExportDialog(false)}>Chiudi</Button>
            <Button onPress={async () => {
              try {
                setDownloading(true);
                const fileUri = FileSystem.documentDirectory + `products_export_${Date.now()}.csv`;
                try {
                  // write without encoding to avoid compatibility issues
                  await FileSystem.writeAsStringAsync(fileUri, exportCsv);
                } catch (writeErr) {
                  console.warn('writeAsStringAsync failed', writeErr);
                  throw writeErr;
                }

                const sharingAvailable = await Sharing.isAvailableAsync();
                if (sharingAvailable) {
                  await Sharing.shareAsync(fileUri, { mimeType: 'text/csv' });
                } else {
                  // fallback: share text via React Native Share
                  await Share.share({ title: 'products.csv', message: exportCsv });
                }

                setDownloading(false);
              } catch (err) { console.error('Share error', err); setDownloading(false); showToast('Errore condivisione/salvataggio', 'error'); }
            }}>{downloading ? 'Salvando...' : 'Scarica / Condividi'}</Button>
          </Dialog.Actions>
        </Dialog>

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
      {tooltip.visible && (
        <View pointerEvents="none" style={[styles.tooltip, { bottom: tooltip.bottom }]}> 
          <Text style={styles.tooltipText}>{tooltip.text}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom:12, borderRadius:12, backgroundColor:'#fff' },
  name: { fontSize:18, fontWeight:'600', marginBottom:6 },
  fab: { position:'absolute', right:20, bottom:20, backgroundColor:'#7E57C2', zIndex: 10, elevation: 6 },
  leftFabTop: { position: 'absolute', left: 20, bottom: 100, backgroundColor: '#6C5CE7', zIndex: 10, elevation: 6 },
  leftFabBottom: { position: 'absolute', left: 20, bottom: 20, backgroundColor: '#4CAF50', zIndex: 10, elevation: 6 },
  topActionsContainer: { paddingHorizontal: 16, paddingTop: 8 },
  tooltip: { position: 'absolute', left: 90, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 10, paddingVertical:6, borderRadius:8 },
  tooltipText: { color:'#fff' },
  input: { marginBottom:10 },
  dialog: { borderRadius:12, backgroundColor:'#fff' }
  ,
  // legacy search styles removed; use src/components/SearchInput instead
});
