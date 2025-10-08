# 🏢 Gestionale App

Un'applicazione gestionale moderna sviluppata con React Native ed Expo.

## 🚀 Stato del Progetto

![CI/CD Pipeline](https://github.com/marstal98/gestionale-app/workflows/CI/CD%20Pipeline/badge.svg)
![Tests](https://github.com/marstal98/gestionale-app/workflows/Pull%20Request%20Check/badge.svg)
![Coverage](https://codecov.io/gh/marstal98/gestionale-app/branch/main/graph/badge.svg)

## 📱 Demo Live

- **Web App**: [https://marstal98.github.io/gestionale-app](https://marstal98.github.io/gestionale-app)
- **Mobile**: Scarica l'APK dalle [Releases](https://github.com/marstal98/gestionale-app/releases)

## ✨ Funzionalità

- 📊 Dashboard con statistiche
- 📦 Gestione ordini e prodotti
- 👥 Gestione utenti
- 💰 Sistema sconti avanzato
- 📱 Interface responsive
- 🧪 Test coverage > 90%

## 🛠 Sviluppo

### Prerequisiti
- Node.js 18+
- npm o yarn
- Expo CLI

### Installazione
```bash
git clone https://github.com/marstal98/gestionale-app.git
cd gestionale-app
npm install
```

### Comandi Disponibili
```bash
# Sviluppo
npm start              # Avvia Expo dev server
npm run web           # Avvia versione web
npm run android       # Avvia su Android
npm run ios           # Avvia su iOS

# Testing
npm test              # Esegue tutti i test
npm run test:watch    # Test in modalità watch
npm run test:coverage # Test con coverage report

# Build
npm run build:web     # Build per web
npm run deploy:web    # Deploy su GitHub Pages

# Versioning
npm run version:patch # Increment patch version
npm run version:minor # Increment minor version
npm run version:major # Increment major version
```

## 🔄 CI/CD Pipeline

Il progetto utilizza GitHub Actions per:

### ✅ Continuous Integration
- **Test automatici** su ogni push/PR
- **Coverage report** via Codecov
- **Build verification** per web e mobile
- **Code quality checks**

### 🚀 Continuous Deployment
- **Auto deploy** su GitHub Pages per la versione web
- **Release automatiche** quando si crea un tag
- **Mobile builds** con EAS Build su richiesta

### 📋 Workflow

1. **Push/PR** → Tests automatici
2. **Merge su main** → Deploy automatico
3. **Tag release** → Build mobile + Release notes

## 📊 Testing

```bash
npm test                    # Tutti i test
npm run test:coverage      # Con coverage report
```

**Test Coverage**: 28 test passati su 5 suite
- Business Logic: ✅
- Component Tests: ✅
- Integration Tests: ✅
- Discount Utils: ✅

## 🚀 Deploy

### Web (Automatico)
Ogni push su `main` deploya automaticamente su GitHub Pages.

### Mobile
Per creare build mobile, usa il messaggio commit:
```bash
git commit -m "feat: new feature [mobile-build]"
```

### Release
```bash
npm run version:minor
git push origin main --tags
```

## 📖 Architettura

```
src/
├── components/     # Componenti riutilizzabili
├── screens/        # Schermate principali
├── context/        # React Context per stato globale
├── utils/          # Funzioni di utilità
└── config.js       # Configurazione app

__tests__/          # Test suite completa
├── BusinessLogic.test.js
├── DiscountUtils.test.js
└── Component tests...
```

## 🤝 Contributing

1. Fork del progetto
2. Crea feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit dei cambiamenti (`git commit -m 'Add AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri una Pull Request

I test devono passare e la coverage non deve diminuire.

## 📄 License

Distribuito sotto licenza MIT. Vedi `LICENSE` per maggiori informazioni.

## 🔧 Configurazione CI/CD

### Secrets Necessari
Aggiungi questi secrets nel tuo repository GitHub:

- `EXPO_TOKEN`: Token per Expo/EAS builds
- `CODECOV_TOKEN`: Token per coverage reporting

### Branch Protection
Si consiglia di abilitare:
- Require PR reviews
- Require status checks to pass
- Require branches to be up to date

---

Sviluppato con ❤️ usando React Native + Expo