const APP_NAME = 'GestioNexus';
const FROM = process.env.MAIL_FROM || `GestioNexus <no-reply@gestionexus.com>`;

export function welcomeTemplate(user) {
  const subject = `Benvenuto in ${APP_NAME}, ${user.name || ''}`;
  const text = `Ciao ${user.name || ''},\n\nBenvenuto in ${APP_NAME}!\n\nPuoi effettuare il login con la tua email: ${user.email}\n\nSe non hai richiesto questo account, contatta il supporto.`;
  const html = `<p>Ciao ${user.name || ''},</p><p>Benvenuto in <strong>${APP_NAME}</strong>!</p><p>Puoi effettuare il login con la tua email: <code>${user.email}</code></p><p>Se non hai richiesto questo account, contatta il supporto.</p>`;
  return { subject, text, html, from: FROM };
}

export function adminNotifyNewUserTemplate(admin, newUser) {
  const subject = `Nuovo utente creato: ${newUser.name}`;
  const text = `Ciao ${admin.name || ''},\n\nL'utente ${newUser.name} (${newUser.email}) è stato creato dal pannello amministrazione.\n\nControlla i dettagli nel pannello.`;
  const html = `<p>Ciao ${admin.name || ''},</p><p>L'utente <strong>${newUser.name}</strong> (${newUser.email}) è stato creato dal pannello amministrazione.</p><p>Controlla i dettagli nel pannello.</p>`;
  return { subject, text, html, from: FROM };
}

export function passwordChangedTemplate(user) {
  const subject = `${APP_NAME} - Password modificata`;
  const text = `Ciao ${user.name || ''},\n\nLa tua password è stata modificata con successo. Se non sei stato tu, contatta immediatamente il supporto.`;
  const html = `<p>Ciao ${user.name || ''},</p><p>La tua password è stata modificata con successo. Se non sei stato tu, contatta immediatamente il supporto.</p>`;
  return { subject, text, html, from: FROM };
}

export function resetRequestTemplate(user, payload) {
  // payload = { token, deepLink, webLink }
  const token = payload?.token || '';
  // For privacy and security, do not include clickable external links in emails.
  // Provide clear textual instructions and the token so the user can open the app
  // or the web panel manually and paste the token when required.

  const subject = `${APP_NAME} - Richiesta reset password`;
  const text = `Ciao ${user.name || ''},\n\nAbbiamo ricevuto una richiesta per resettare la password. Per completare l'operazione segui questi passaggi:\n\n1) Apri l'app ${APP_NAME} sul tuo dispositivo.\n2) Vai su Login → Reset password (o Impostazioni → Reset password).\n3) Copia il token qui sotto e incollalo nel campo richiesto:\n\n${token}\n\nSe preferisci usare il pannello web, visita il pannello di gestione della tua azienda e cerca la sezione 'Reset password', quindi incolla lo stesso token.\n\nSe non hai richiesto questa operazione, ignora questa email.`;

  const html = `<p>Ciao ${user.name || ''},</p>
    <p>Abbiamo ricevuto una richiesta per resettare la password. Per completare l'operazione segui questi passaggi:</p>
    <ol>
      <li>Apri l'app <strong>${APP_NAME}</strong> sul tuo dispositivo.</li>
      <li>Vai a <strong>Login → Reset password</strong> (o <strong>Impostazioni → Reset password</strong>).</li>
      <li>Copia il token qui sotto e incollalo nel campo richiesto.</li>
    </ol>
    <pre style="background:#f4f4f4;padding:10px;border-radius:6px;">${token}</pre>
    <p>In alternativa, puoi accedere al pannello web della tua azienda e utilizzare la funzione <strong>Reset password</strong>, quindi incollare lo stesso token.</p>
    <p>Se non hai richiesto questa operazione, ignora questa email.</p>`;

  return { subject, text, html, from: FROM };
}

export function orderConfirmationTemplate(order) {
  const subject = `Conferma ordine #${order.id}`;
  const text = `Grazie per il tuo ordine #${order.id}.\nTotale: ${order.total}\nStato: ${order.status}`;
  const html = `<p>Grazie per il tuo ordine <strong>#${order.id}</strong>.</p><p>Totale: ${order.total}</p><p>Stato: ${order.status}</p>`;
  return { subject, text, html, from: FROM };
}

export function orderAssignedTemplate(order) {
  const subject = `Nuovo ordine assegnato #${order.id}`;
  const text = `Ti è stato assegnato l'ordine #${order.id}.\nCliente: ${order.customerName || ''}\nTotale: ${order.total}`;
  const html = `<p>Ti è stato assegnato l'ordine <strong>#${order.id}</strong>.</p><p>Cliente: ${order.customerName || ''}</p><p>Totale: ${order.total}</p>`;
  return { subject, text, html, from: FROM };
}

export function adminOrderCreatedTemplate(admin, order) {
  const subject = `Nuovo ordine creato #${order.id}`;
  const text = `L'ordine #${order.id} è stato creato da ${order.createdByName || 'un utente'}. Totale: ${order.total}`;
  const html = `<p>L'ordine <strong>#${order.id}</strong> è stato creato da ${order.createdByName || 'un utente'}.</p><p>Totale: ${order.total}</p>`;
  return { subject, text, html, from: FROM };
}

export function adminOrderCreatedByYouTemplate(admin, order) {
  const subject = `Hai creato l'ordine #${order.id}`;
  const text = `Ciao ${admin.name || ''},\n\nHai creato l'ordine #${order.id}. Totale: ${order.total}`;
  const html = `<p>Ciao ${admin.name || ''},</p><p>Hai creato l'ordine <strong>#${order.id}</strong>.</p><p>Totale: ${order.total}</p>`;
  return { subject, text, html, from: FROM };
}

export function adminOrderStatusTemplate(admin, order, status) {
  const subject = `Ordine #${order.id} - stato: ${status}`;
  const text = `Ciao ${admin.name || ''},\n\nLo stato dell'ordine #${order.id} è cambiato in: ${status}. Totale: ${order.total}`;
  const html = `<p>Ciao ${admin.name || ''},</p><p>Lo stato dell'ordine <strong>#${order.id}</strong> è cambiato in: <strong>${status}</strong>.</p><p>Totale: ${order.total}</p>`;
  return { subject, text, html, from: FROM };
}

// Email template for when an admin assigns an order to an assignee
export function adminOrderAssignedTemplate(admin, order, assignee) {
  const subject = `Ordine #${order.id} assegnato a ${assignee?.name || assignee?.email || 'utente'}`;
  const text = `Ciao ${admin.name || ''},\n\nHai assegnato l'ordine #${order.id} a ${assignee?.name || assignee?.email || 'un utente'}.\nTotale: ${order.total}\n\nControlla i dettagli nel pannello.`;
  const html = `<p>Ciao ${admin.name || ''},</p><p>Hai assegnato l'ordine <strong>#${order.id}</strong> a <strong>${assignee?.name || assignee?.email || 'un utente'}</strong>.</p><p>Totale: ${order.total}</p><p>Controlla i dettagli nel pannello.</p>`;
  return { subject, text, html, from: FROM };
}

// Email template for when a user is unassigned from an order
export function orderUnassignedTemplate(user, order) {
  const subject = `Rimozione assegnazione ordine #${order.id}`;
  const text = `Ciao ${user.name || ''},\n\nSei stato rimosso dall'ordine #${order.id}.\nTotale: ${order.total}\n\nSe pensi che sia un errore, contatta l'amministratore.`;
  const html = `<p>Ciao ${user.name || ''},</p><p>Sei stato rimosso dall'ordine <strong>#${order.id}</strong>.</p><p>Totale: ${order.total}</p><p>Se pensi che sia un errore, contatta l'amministratore.</p>`;
  return { subject, text, html, from: FROM };
}

export function genericTestTemplate(user) {
  return { subject: `${APP_NAME} - Email di test`, text: `Ciao ${user.name || ''}, questa è una email di test inviata dal sistema.`, html: `<p>Ciao ${user.name || ''},</p><p>Questa è una email di test inviata dal sistema.</p>`, from: FROM };
}

export function inviteTemplate(invitation, payload = {}) {
  // invitation = { token, email }
  const tempPassword = payload?.tempPassword || '';
  const subject = `${APP_NAME} - Invito ad accedere`;
  const text = `Ciao,\n\nSei stato invitato ad accedere a ${APP_NAME}.\n\nPer accedere per la prima volta procedi così:\n\n1) Apri l'app ${APP_NAME} sul tuo dispositivo.\n2) Vai alla schermata Accedi.\n3) Inserisci la tua email: ${invitation.email}\n   Password temporanea: ${tempPassword}\n4) Dopo il primo accesso, vai su Impostazioni → Cambia password e imposta una nuova password personale (almeno 8 caratteri).\n\nSe non ti aspettavi questa email, ignora e contatta il supporto.`;
  const html = `<p>Ciao,</p>\n    <p>Sei stato invitato ad accedere a <strong>${APP_NAME}</strong>.</p>\n    <p>Per accedere per la prima volta procedi così:</p>\n    <ol>\n      <li>Apri l'app <strong>${APP_NAME}</strong> sul tuo dispositivo.</li>\n      <li>Vai alla schermata <strong>Accedi</strong>.</li>\n      <li>Inserisci le seguenti credenziali temporanee:</li>\n    </ol>\n    <ul>\n      <li><strong>Email:</strong> ${invitation.email}</li>\n      <li><strong>Password temporanea:</strong> <code style="background:#f4f4f4;padding:4px 6px;border-radius:4px;">${tempPassword}</code></li>\n    </ul>\n    <p>Dopo il primo accesso, vai su <strong>Impostazioni → Cambia password</strong> ed imposta una nuova password personale (almeno 8 caratteri).</p>\n    <p>Se non ti aspettavi questa email, ignora e contatta il supporto.</p>`;
  return { subject, text, html, from: FROM };
}

export function accessRequestNotifyTemplate(accessRequest, payload = {}) {
  // Do not include clickable links. Provide instructions for admins to open the app
  // or the web panel and navigate to the Access Requests section, then paste the
  // provided request id if needed.
  const subject = `${APP_NAME} - Nuova richiesta di accesso da ${accessRequest.email}`;
  const text = `Ciao,\n\nHai ricevuto una nuova richiesta di accesso.\n\nNome: ${accessRequest.name || ''}\nEmail: ${accessRequest.email}\nAzienda: ${accessRequest.company || ''}\n\nPer valutarla segui questi passaggi:\n1) Apri l'app ${APP_NAME} e accedi con un account admin.\n2) Vai al menù principale → Access Requests (Richieste di accesso).\n3) Cerca la richiesta con l'ID: ${accessRequest.id} (o usa l'indirizzo email) e aprila per visualizzare i dettagli.\n\nSe preferisci il pannello web, accedi al pannello di amministrazione e cerca la sezione 'Access Requests', quindi cerca l'ID ${accessRequest.id}.\n\nSe non vuoi ricevere queste notifiche, aggiorna le impostazioni.`;
  const html = `<p>Ciao,</p><p>Hai ricevuto una nuova richiesta di accesso.</p><ul><li><strong>Nome:</strong> ${accessRequest.name || ''}</li><li><strong>Email:</strong> ${accessRequest.email}</li><li><strong>Azienda:</strong> ${accessRequest.company || ''}</li></ul><p>Per valutarla:</p><ol><li>Apri l'app <strong>${APP_NAME}</strong> e accedi con un account admin.</li><li>Vai al menù principale → <strong>Access Requests</strong> (Richieste di accesso).</li><li>Cerca la richiesta usando l'ID <code>${accessRequest.id}</code> o l'indirizzo email e aprila per vedere i dettagli.</li></ol><p>Se preferisci il pannello web, accedi al pannello di amministrazione e cerca la sezione <strong>Access Requests</strong>, quindi cerca l'ID <code>${accessRequest.id}</code>.</p><p>Se non vuoi ricevere queste notifiche, aggiorna le impostazioni.</p>`;
  return { subject, text, html, from: FROM };
}

export default {
  welcomeTemplate,
  adminNotifyNewUserTemplate,
  passwordChangedTemplate,
  resetRequestTemplate,
  orderConfirmationTemplate,
  orderAssignedTemplate,
  adminOrderCreatedTemplate,
  adminOrderAssignedTemplate,
  orderUnassignedTemplate,
  adminOrderStatusTemplate,
  adminOrderCreatedByYouTemplate,
  inviteTemplate,
  accessRequestNotifyTemplate,
  genericTestTemplate,
};
