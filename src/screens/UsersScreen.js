import React, { useEffect, useState, useContext } from "react";
import { useFocusEffect } from '@react-navigation/native';
import { View, StyleSheet, FlatList } from "react-native";
import {
    Text,
    Card,
    Button,
    Dialog,
    Portal,
    TextInput,
    FAB,
    IconButton,
} from "react-native-paper";
import SearchInput from '../components/SearchInput';
import PasswordInput from '../components/PasswordInput';
import RequiredTextInput from '../components/RequiredTextInput';
import AssignmentsModal from '../components/AssignmentsModal';
import { AuthContext } from "../context/AuthContext";
import { SyncContext } from "../context/SyncContext";
import { API_URL } from "../config";
import { buildHeaders } from '../utils/api';
import { safeMessageFromData } from '../utils/errorUtils';
import { StatusBar } from "react-native";
import { RadioButton } from "react-native-paper";
import { showToast } from '../utils/toastService';


export default function UsersScreen() {
    const { token, user: authUser } = useContext(AuthContext);
    const { triggerRefresh } = useContext(SyncContext);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Stato per dialog
    const [showDialog, setShowDialog] = useState(false);
    const [showConfirmDelete, setShowConfirmDelete] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [userToDelete, setUserToDelete] = useState(null);

    // Campi form
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [role, setRole] = useState("customer");

    // Dropdown
    const [showDropDown, setShowDropDown] = useState(false);
    const roleList = [
        { label: "Amministratore", value: "admin" },
        { label: "Dipendente", value: "employee" },
        { label: "Cliente", value: "customer" },
    ];

    

    // assignment modal state
    const [assignmentsModalEmployee, setAssignmentsModalEmployee] = useState(null);


    // use global toast service

    const onFieldInvalid = (fieldName) => {
        setFieldErrors(e => ({ ...e, [fieldName]: true }));
        showToast(`Campo ${fieldName} obbligatorio`, 'error');
    };


    const fetchUsers = async () => {
        try {
            const response = await fetch(`${API_URL}/users`, {
                headers: buildHeaders(token),
            });
            const data = await response.json();
            if (response.ok) setUsers(data);
        } catch (err) {
            console.error("Errore fetch utenti:", err);
        } finally {
            setLoading(false);
        }
    };

    const { refreshKey } = useContext(SyncContext);
    useEffect(() => {
        if (token) fetchUsers();
    }, [token, refreshKey]);

    useFocusEffect(
        React.useCallback(() => {
            return () => { try { setFieldErrors({}); } catch (e) { } };
        }, [])
    );

    // filtered users according to search
    // hide the superadmin user from non-superadmin viewers
    const superEmail = (require('../config').SUPERADMIN_EMAIL || '').toString().toLowerCase().trim();
    const isViewerSuper = (authUser?.email || '').toString().toLowerCase().trim() === superEmail;

    const filteredUsers = users
        .filter(u => {
            // hide the superadmin account from non-superadmin viewers
            if (!isViewerSuper && (u.email || '').toString().toLowerCase().trim() === superEmail) return false;
            return true;
        })
        .filter(u => {
            if (!search) return true;
            const s = search.toLowerCase();
            return (u.name || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s) || (u.role || '').toLowerCase().includes(s);
        });

    const confirmToggleActive = (u) => {
        // Prevent admin disabling themselves
        if (authUser && u.id === authUser.id) {
            showToast("Non puoi modificare lo stato del tuo utente", 'error');
            return;
        }
        setEditingUser(u);
        setShowDialog(true);
        // reuse dialog for editing but we will show a confirm below
        setName(u.name); setEmail(u.email); setRole(u.role);
    };

    const handleToggleActive = async (u) => {
        try {
            const res = await fetch(`${API_URL}/users/${u.id}/activate`, {
                method: 'PUT',
                headers: buildHeaders(token, { 'Content-Type': 'application/json' }),
                body: JSON.stringify({ isActive: !u.isActive })
            });
            if (res.ok) { fetchUsers(); showToast(!u.isActive ? 'Utente riattivato' : 'Utente disattivato', 'success'); triggerRefresh(); }
            else {
                const e = await res.json().catch(() => ({}));
                const safe = safeMessageFromData(e || {}, 'Errore');
                showToast(safe, 'error');
            }
            } catch (err) { console.error(err); showToast('Errore server', 'error'); }
    };

    // Creazione o modifica
    const handleSave = async () => {
        // Validazioni client-side
        // Email formato
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            showToast("Inserisci un'email valida", "error");
            return;
        }

        // Password (solo per nuovo utente o se l'admin vuole cambiare la password)
        if (!editingUser) {
            if (!password || password.length < 8) {
                showToast("La password deve avere almeno 8 caratteri", "error");
                return;
            }

            // semplice controllo di complessità: almeno una lettera e un numero
            const strongPass = /^(?=.*[A-Za-z])(?=.*\d).+$/;
            if (!strongPass.test(password)) {
                showToast("La password deve contenere lettere e numeri", "error");
                return;
            }
        } else if (password) {
            // se si sta modificando e viene fornita una nuova password, validarla
            if (password.length < 8) {
                showToast("La password deve avere almeno 8 caratteri", "error");
                return;
            }
            const strongPass = /^(?=.*[A-Za-z])(?=.*\d).+$/;
            if (!strongPass.test(password)) {
                showToast("La password deve contenere lettere e numeri", "error");
                return;
            }
        }

        // Controllo email già esistente (solo per creazione o se cambia email)
        const emailExists = users.some((u) => u.email === email && (!editingUser || u.id !== editingUser.id));
        if (emailExists) {
            showToast("Esiste già un utente con questa email", "error");
            return;
        }

        try {
            const url = editingUser
                ? `${API_URL}/users/${editingUser.id}`
                : `${API_URL}/users`;

            const method = editingUser ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: buildHeaders(token, { "Content-Type": "application/json" }),
                body: JSON.stringify({ name, email, password, role }),
            });

            if (response.ok) {
                fetchUsers();
                setShowDialog(false);
                setEditingUser(null);
                setName("");
                setEmail("");
                setPassword("");
                setRole("customer");
                showToast(editingUser ? "Utente modificato con successo" : "Utente inserito con successo", "success");
                triggerRefresh();
                } else if (response.status === 409) {
                const data = await response.json().catch(() => ({}));
                const safe = safeMessageFromData(data, 'Email già registrata');
                showToast(safe, 'error');
            } else {
                const data = await response.json().catch(() => ({}));
                const safe = safeMessageFromData(data, 'Errore salvataggio');
                showToast(safe, 'error');
            }
        } catch (err) {
            console.error("Errore salvataggio:", err);
        }
    };

    // Eliminazione
    const confirmDelete = (user) => {
        // Prevent deleting the currently authenticated user
        if (authUser && user && user.id === authUser.id) {
            showToast("Non puoi eliminare il tuo utente!", "error");
            return;
        }

        setUserToDelete(user);
        setShowConfirmDelete(true);
    };

    const handleDelete = async () => {
        try {
            // Double-check: do not allow deleting the current user
            if (userToDelete && authUser && userToDelete.id === authUser.id) {
                setShowConfirmDelete(false);
                showToast("Non puoi eliminare il tuo utente!", "error");
                return;
            }
            const response = await fetch(`${API_URL}/users/${userToDelete.id}`, {
                method: "DELETE",
                headers: buildHeaders(token),
            });
            if (response.ok) {
                fetchUsers();
                setShowConfirmDelete(false);
                showToast("Utente eliminato con successo", "success");
                triggerRefresh();
            }
        } catch (err) {
            console.error("Errore eliminazione:", err);
        }
    };

    // Apri modale per nuovo/modifica
    const openDialog = (user = null) => {
        if (user) {
            setEditingUser(user);
            setName(user.name);
            setEmail(user.email);
            setPassword("");
            setRole(user.role);
        } else {
            setEditingUser(null);
            setName("");
            setEmail("");
            setPassword("");
            setRole("customer");
        }
        setShowDialog(true);
    };

    return (
        <View style={{ flex: 1, backgroundColor: "#F9F9FB", paddingTop: 50 }}>
            <StatusBar
                backgroundColor="transparent" // trasparente sotto Android
                barStyle="dark-content"       // testo scuro (icone nere)
                translucent                   // fa "scorrere" il contenuto sotto la status bar
            />
            {/* unified search input */}
            <SearchInput placeholder="Cerca utenti (nome, email, ruolo)" value={search} onChangeText={setSearch} />

            <FlatList
                data={filteredUsers}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                    <Card style={styles.card}>
                        <Card.Content>
                            <Text style={styles.name}>{item.name}</Text>
                            <Text>Email: {item.email}</Text>
                            <Text>Ruolo: {item.role}</Text>
                            <Text>Creato: {new Date(item.createdAt).toLocaleDateString()}</Text>
                            <Text>Stato: {item.isActive ? 'Attivo' : 'Disabilitato'}</Text>
                        </Card.Content>
                        <Card.Actions style={styles.actions}>
                            <Button
                                mode="text"
                                    onPress={() => openDialog(item)}
                                icon="pencil"
                                    textColor="#7E57C2"
                                    style={styles.actionButton}
                            >
                                Modifica
                            </Button>
                            <Button
                                mode="text"
                                    onPress={() => confirmDelete(item)}
                                icon="delete"
                                    textColor="red"
                                    style={styles.actionButton}
                            >
                                Elimina
                            </Button>
                            <Button
                                mode="text"
                                    onPress={() => handleToggleActive(item)}
                                    icon={item.isActive ? 'account-cancel' : 'account-check'}
                                    textColor={item.isActive ? 'orange' : '#4CAF50'}
                                    style={styles.actionButton}
                            >
                                {item.isActive ? 'Disabilita' : 'Abilita'}
                            </Button>
                            {item.role === 'employee' && (
                                <Button
                                    mode="text"
                                        onPress={() => setAssignmentsModalEmployee(item)}
                                        icon="account-multiple"
                                        textColor="#1976D2"
                                        style={styles.actionButton}
                                >
                                    Assegna clienti
                                </Button>
                            )}
                        </Card.Actions>
                    </Card>
                )}
            />

            {/* Floating Action Button */}
            <FAB
                icon="plus"
                style={styles.fab}
                onPress={() => openDialog()}
                color="white"
            />

            {/* Dialog inserisci/modifica */}
            <Portal>
                <Dialog visible={showDialog} onDismiss={() => setShowDialog(false)} style={styles.dialog}>
                    <Dialog.Title>{editingUser ? "Modifica Utente" : "Nuovo Utente"}</Dialog.Title>

                    <Dialog.Content>
                        <RequiredTextInput label="Nome" name="Nome" required value={name} onChangeText={setName} onInvalid={onFieldInvalid} showError={!!fieldErrors.Nome} style={styles.input} />
                        <RequiredTextInput label="Email" name="Email" required value={email} onChangeText={setEmail} onInvalid={onFieldInvalid} showError={!!fieldErrors.Email} style={styles.input} />
                        {!editingUser && (
                            <PasswordInput
                                label="Password"
                                value={password}
                                onChangeText={setPassword}
                                style={styles.input}
                                required
                                showError={!!fieldErrors.Password}
                                onBlur={() => { if (!password || password.length < 8) onFieldInvalid('Password'); }}
                            />
                        )}

                        <Text style={{ marginTop: 10, marginBottom: 5, fontWeight: "600" }}>
                            Seleziona ruolo:
                        </Text>
                        <RadioButton.Group onValueChange={setRole} value={role}>
                            <RadioButton.Item label="Amministratore" value="admin" />
                            <RadioButton.Item label="Dipendente" value="employee" />
                            <RadioButton.Item label="Cliente" value="customer" />
                        </RadioButton.Group>
                    </Dialog.Content>

                    <Dialog.Actions>
                        <Button onPress={() => setShowDialog(false)}>Annulla</Button>
                        <Button onPress={handleSave}>Salva</Button>
                    </Dialog.Actions>

                </Dialog>

                {/* Dialog conferma eliminazione */}
                <Dialog visible={showConfirmDelete} onDismiss={() => setShowConfirmDelete(false)} style={styles.dialog}>
                    <Dialog.Title>Conferma</Dialog.Title>
                    <Dialog.Content>
                        <Text>Vuoi davvero eliminare questo utente?</Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setShowConfirmDelete(false)}>Annulla</Button>
                        <Button textColor="red" onPress={handleDelete}>
                            Elimina
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>


            {/* Global toast host handles toasts */}

            <AssignmentsModal
                visible={!!assignmentsModalEmployee}
                employee={assignmentsModalEmployee}
                token={token}
                onDismiss={() => setAssignmentsModalEmployee(null)}
                onSaved={() => { fetchUsers(); triggerRefresh(); setAssignmentsModalEmployee(null); showToast('Assegnazioni aggiornate', 'success'); }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    list: { padding: 16, paddingTop: 10 }, // 👈 margine in alto
    card: {
        marginBottom: 12,
        borderRadius: 12,
        backgroundColor: "#fff",
        elevation: 3,
    },
    name: { fontSize: 18, fontWeight: "600", marginBottom: 4, color: "#333" },
    // allow actions to wrap onto multiple lines on small screens
    actions: { justifyContent: "flex-end", flexWrap: 'wrap' },
    actionButton: { marginRight: 6, marginBottom: 6 },
    fab: {
        position: "absolute",
        right: 20,
        bottom: 20,
        backgroundColor: "#7E57C2",
    },
    input: { marginBottom: 10 },
    dialog: { borderRadius: 12, backgroundColor: "#ffffff" },
    // legacy search styles removed; use src/components/SearchInput instead
});
