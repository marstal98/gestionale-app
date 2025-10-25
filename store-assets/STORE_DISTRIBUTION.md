# 🏪 Store Distribution Guide

Guida completa per pubblicare l'app Gestionale sui store ufficiali.

## 📋 Prerequisiti Store

### Google Play Store
- **Google Play Console** account ($25 una tantum)
- **Service Account** per automazione (opzionale)
- **App Bundle (.aab)** firmato

### Apple App Store  
- **Apple Developer Program** ($99/anno)
- **App Store Connect** account
- **IPA** firmato per distribuzione

## 📱 Store Listing Requirements

### Icone & Graphics
- **App Icon**: 512x512px (Google), 1024x1024px (Apple)
- **Feature Graphic**: 1024x500px (Google Play)
- **Screenshots**: Vari formati per diversi dispositivi

### Descrizioni
- **Titolo**: Max 50 caratteri (Google), 30 caratteri (Apple)
- **Descrizione breve**: Max 80 caratteri (Google Play)
- **Descrizione completa**: Max 4000 caratteri
- **Keywords**: Per SEO e discoveryability

## 🚀 Processo di Pubblicazione

### Fase 1: Preparazione Assets
1. Crea screenshots rappresentativi
2. Scrivi descrizioni accattivanti
3. Prepara privacy policy e terms of service
4. Configura metadati store

### Fase 2: Build Production
```bash
# Build per entrambi gli store
npm run build:all

# O separatamente:
npm run build:android  # Google Play
npm run build:ios      # App Store
```

### Fase 3: Submit agli Store
```bash
# Submit automatico (richiede configurazione)
npm run submit:android
npm run submit:ios

# O manuale tramite console web
```

### Fase 4: Review Process
- **Google Play**: 1-3 giorni
- **App Store**: 1-7 giorni
- Possibili richieste di chiarimenti

## 📊 Store Optimization (ASO)

### Keywords Strategy
- Analizza competitor
- Usa strumenti SEO mobile
- A/B test diverse descrizioni

### Conversion Rate
- Screenshots accattivanti
- Video preview (consigliato)
- Reviews e ratings management

## 🔄 Update Strategy

### Versioning
```bash
# Bug fixes
npm run version:patch && npm run build:all

# New features  
npm run version:minor && npm run build:all

# Major releases
npm run version:major && npm run build:all
```

### Release Notes
- Sempre in italiano e inglese
- Evidenzia nuove funzionalità
- Menziona bug fixes importanti

## ⚡ Automazione EAS Submit

### Configurazione Google Play
```json
// eas.json - submit section
"submit": {
  "production": {
    "android": {
      "serviceAccountKeyPath": "./google-service-account.json",
      "track": "production"  // o "beta", "alpha"
    }
  }
}
```

### Configurazione App Store
```json
// eas.json - submit section  
"submit": {
  "production": {
    "ios": {
      "appleId": "your-apple-id@example.com",
      "ascAppId": "1234567890",
      "appleTeamId": "ABCDEF1234"
    }
  }
}
```

## 📈 Post-Launch Actions

### Monitoring
- Download metrics
- Crash reports  
- User reviews
- Performance analytics

### Marketing
- Social media announcement
- Press release
- User feedback collection
- Community building

---

**🎯 Obiettivo: App live sui store entro 7 giorni!**