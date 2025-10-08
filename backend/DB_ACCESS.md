Accesso al database — opzioni e credenziali

Situazione attuale
- In sviluppo il progetto usa SQLite (file `backend/dev.db`) via `DATABASE_URL=file:./dev.db` (vedi `backend/.env`).

Opzione 1 — Usare SQLite (più semplice, nessuna credenziale)
- Dove: il file si trova in `backend/dev.db` nell'albero del repository.
- Strumenti consigliati:
  - Prisma Studio (interfaccia web leggera, integrata con Prisma)
  - DB Browser for SQLite (GUI standalone)
  - DBeaver / TablePlus / Beekeeper Studio (multipiattaforma GUI)

Prisma Studio (consigliato per sviluppo rapido)
- Avvia il backend o posizionati nella cartella `backend` e lancia:

  # PowerShell
  npx prisma studio

- Nexus: apre un'interfaccia web locale (di solito http://localhost:5555) che ti permette di navigare le tabelle e fare query semplici (insert/update/delete) direttamente.

DB Browser for SQLite
- Apri `backend/dev.db` e puoi eseguire query SQL direttamente.

Opzione 2 — Usare Postgres in Docker (con credenziali di test)
- Ho aggiunto un `docker-compose.postgres.yml` nella root del repository. Avviare:

  # PowerShell
  docker compose -f .\docker-compose.postgres.yml up -d

- Credenziali (dev/test):
  - host: localhost
  - port: 5432
  - database: gestionale_dev
  - user: gestionale
  - password: gestionale_pass

- Per usare Postgres con l'app, aggiorna `backend/.env` (o esporta nella tua sessione) con:

  DATABASE_URL=postgresql://gestionale:gestionale_pass@localhost:5432/gestionale_dev

- Rigenera il client Prisma e applica eventuali migrazioni (attenzione: se passi da SQLite a Postgres potresti dover migrare i dati):

  cd backend
  # Aggiorna .env come sopra
  npx prisma generate
  npx prisma migrate deploy   # o npx prisma migrate dev se vuoi creare nuove migrazioni in locale

Strumenti GUI consigliati per Postgres
- DBeaver (free): connetti via host/port/user/password e svolgi query SQL comodamente.
- TablePlus (commerciale) o Beekeeper Studio (open-source) sono alternative rapide.

Connessione via psql (CLI):

  # PowerShell
  psql "postgresql://gestionale:gestionale_pass@localhost:5432/gestionale_dev"

Note di sicurezza
- Le credenziali nel `docker-compose.postgres.yml` sono pensate solo per sviluppo locale. Non usarle in produzione.
- Se esegui migrazioni di schema da SQLite a Postgres, assicurati di avere un backup del database.

Se vuoi, posso:
- Generare script per migrare i dati da SQLite a Postgres.
- Aggiungere un comando `Makefile` o `package.json` script per avviare rapidamente Postgres e aggiornare `backend/.env`.
- Creare un file `.env.postgres.example` con la stringa `DATABASE_URL` pronta.
