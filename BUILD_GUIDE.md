# 🏗️ Build & Distribution Guide

Guida completa per creare build di produzione dell'app Gestionale.

## 📋 Prerequisiti

### Setup Account Expo
1. Crea account su [expo.dev](https://expo.dev)
2. Login con EAS CLI:
   ```bash
   eas login
   ```

### Configurazione Android
- **Google Play Console** account
- **Keystore** per firmare l'APK (generato automaticamente da EAS)
- **Service Account JSON** per upload automatico

### Configurazione iOS
- **Apple Developer Account** ($99/anno)
- **Bundle Identifier** univoco
- **Provisioning Profiles** (gestiti da EAS)

## 🚀 Comandi Build

### Build di Sviluppo
```bash
# Development build (per testing interno)
npm run build:preview
# oppure
eas build --platform all --profile preview
```

### Build di Produzione
```bash
# Android App Bundle (per Google Play)
npm run build:android
# oppure
eas build --platform android --profile production

# Android APK (per distribuzione diretta)
npm run build:android:apk
# oppure
eas build --platform android --profile production-apk

# iOS IPA (per App Store)
npm run build:ios
# oppure
eas build --platform ios --profile production

# Build per entrambe le piattaforme
npm run build:all
# oppure
eas build --platform all --profile production
```

## 📱 Profili Build (eas.json)

### Development
- **Scopo**: Testing interno, debugging
- **Output**: Development client
- **Distribuzione**: Internal testing

### Preview
- **Scopo**: Testing pre-produzione
- **Android**: APK standalone
- **iOS**: Simulator build
- **Distribuzione**: Internal testing

### Production
- **Scopo**: Store distribution
- **Android**: App Bundle (.aab)
- **iOS**: IPA per App Store
- **Distribuzione**: Store pubblici

### Production-APK
- **Scopo**: Distribuzione diretta Android
- **Output**: APK standalone
- **Distribuzione**: Sideloading, testing

## 🔐 Configurazione Signing

### Android - Automatic Signing
EAS gestisce automaticamente:
- Creazione keystore sicuro
- Firma automatica
- Upload su Google Play

### iOS - Automatic Signing
EAS gestisce automaticamente:
- Provisioning profiles
- Certificati sviluppo/distribuzione
- Upload su App Store Connect

## 📦 Workflow di Distribuzione

### 1. Pre-Build Checklist
- [ ] Tests passano: `npm test`
- [ ] Build web funziona: `npm run build:web`
- [ ] Backend configurato per produzione
- [ ] Version bump: `npm run version:patch`
- [ ] Git commit e push

### 2. Build Processo
```bash
# 1. Build per testing interno
eas build --platform all --profile preview

# 2. Test su dispositivi reali
# Scarica APK/IPA dai link EAS

# 3. Build finale per store
eas build --platform all --profile production
```

### 3. Submit agli Store
```bash
# Android (Google Play)
npm run submit:android
# oppure
eas submit --platform android

# iOS (App Store)
npm run submit:ios
# oppure
eas submit --platform ios
```

## 🤖 Automazione CI/CD

### GitHub Actions Integration
Il workflow in `.github/workflows/ci-cd.yml` include:

```yaml
# Build mobile quando commit contiene [mobile-build]
- name: Build Mobile Apps
  if: contains(github.event.head_commit.message, '[mobile-build]')
  run: |
    eas build --platform all --non-interactive
```

### Trigger Build Automatici
```bash
# Commit che triggerà build mobile
git commit -m "feat: new feature [mobile-build]"
git push
```

## 📊 Monitoring Build

### Build Status
- Dashboard EAS: [expo.dev/builds](https://expo.dev/builds)
- Email notifications automatiche
- Slack/Discord integration possibile

### Build Artifacts
- **Android**: AAB/APK scaricabili
- **iOS**: IPA per TestFlight/App Store
- **Logs**: Completi per debugging
- **Size Analysis**: Bundle analyzer integrato

## 📈 Versioning Strategy

### Semantic Versioning
```bash
# Patch: bug fixes (1.0.0 → 1.0.1)
npm run version:patch

# Minor: new features (1.0.0 → 1.1.0)
npm run version:minor

# Major: breaking changes (1.0.0 → 2.0.0)
npm run version:major
```

### Build Numbers
- **Android**: `versionCode` auto-incrementato
- **iOS**: `buildNumber` auto-incrementato
- **Sincronizzazione**: Gestita da EAS

## 🚨 Troubleshooting

### Build Failures Comuni

#### Android
```bash
# Dependency conflicts
expo install --fix

# Gradle issues
eas build --clear-cache --platform android
```

#### iOS
```bash
# Provisioning issues
eas credentials --platform ios

# CocoaPods cache
eas build --clear-cache --platform ios
```

### Performance Issues
```bash
# Bundle size analysis
npx expo bundle-split

# Dependencies audit
npm audit
expo doctor
```

## 📋 Checklist Pre-Release

### Funzionalità
- [ ] Login/logout funziona
- [ ] Tutte le schermate caricate
- [ ] Backend integration attiva
- [ ] Test suite passa (37/37)
- [ ] Performance accettabili

### Metadati Store
- [ ] Screenshots aggiornati
- [ ] Descrizione app in italiano/inglese
- [ ] Keywords per SEO
- [ ] Privacy policy
- [ ] Terms of service

### Compliance
- [ ] GDPR compliance (EU)
- [ ] App Store guidelines
- [ ] Google Play policies
- [ ] Accessibility standards

## 🎯 Next Steps

Dopo il primo deploy:
1. **Analytics**: Integrare Firebase/Sentry
2. **Updates**: Setup Expo Updates per hotfix
3. **Testing**: Beta testing con TestFlight/Play Console
4. **Monitoring**: Crash reporting e performance

---

**🚀 Ready to ship!** La tua app è pronta per il mondo!