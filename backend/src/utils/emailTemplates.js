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
  const deepLink = payload?.deepLink || `${process.env.FRONTEND_DEEPLINK || 'gestionexus://reset-password'}?token=${token}`;
  const webLink = payload?.webLink || `${process.env.FRONTEND_URL || 'http://localhost:19006'}/reset-password?token=${token}`;

  const subject = `${APP_NAME} - Richiesta reset password`;
  const text = `Ciao ${user.name || ''},\n\nAbbiamo ricevuto una richiesta per resettare la password. Puoi aprire il link direttamente nell'app (se il tuo dispositivo lo supporta) o usare il link web di fallback:\n\nLink (apri in app): ${deepLink}\nLink (web fallback): ${webLink}\n\nSe il link non si apre, copia il seguente token e incollalo nella schermata 'Reset password' dell'app:\n\n${token}\n\nSe non hai richiesto questa operazione ignora questa email.`;

  const html = `<p>Ciao ${user.name || ''},</p>
    <p>Abbiamo ricevuto una richiesta per resettare la password. Puoi aprire il link direttamente nell'app (se il tuo dispositivo lo supporta) o usare il link web di fallback:</p>
    <p><strong>Apri in app:</strong> <a href="${deepLink}">${deepLink}</a></p>
    <p><strong>Link web (fallback):</strong> <a href="${webLink}">${webLink}</a></p>
    <p>Se il link non si apre, copia il seguente token e incollalo nella schermata <em>Reset password</em> dell'app:</p>
    <pre style="background:#f4f4f4;padding:10px;border-radius:6px;">${token}</pre>
    <p>Se non hai richiesto questa operazione ignora questa email.</p>`;

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
  genericTestTemplate,
};
