#!/usr/bin/env node

/**
 * Script di pre-build per validare l'app prima del build di produzione
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colori per output console
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    log(`✅ ${description}`, 'green');
    return true;
  } else {
    log(`❌ ${description} - File mancante: ${filePath}`, 'red');
    return false;
  }
}

function runCommand(command, description) {
  try {
    log(`🔄 ${description}...`, 'blue');
    const output = execSync(command, { stdio: 'pipe', encoding: 'utf8' });
    log(`✅ ${description}`, 'green');
    return { success: true, output };
  } catch (error) {
    log(`❌ ${description} - Errore: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function main() {
  log('🏗️  Pre-Build Validation Script', 'blue');
  log('=====================================', 'blue');

  let allChecksPass = true;

  // 1. Controllo file essenziali
  log('\n📁 Controllo file essenziali...', 'yellow');
  const essentialFiles = [
    ['app.json', 'Configurazione Expo'],
    ['eas.json', 'Configurazione EAS Build'],
    ['package.json', 'Dipendenze npm'],
    ['src/config.js', 'Configurazione app'],
    ['assets/icon.png', 'Icona app'],
    ['assets/adaptive-icon.png', 'Icona Android adaptive']
  ];

  for (const [file, desc] of essentialFiles) {
    if (!checkFile(file, desc)) allChecksPass = false;
  }

  // 2. Controllo configurazione app.json
  log('\n⚙️  Controllo configurazione...', 'yellow');
  try {
    const appConfig = JSON.parse(fs.readFileSync('app.json', 'utf8'));
    const expo = appConfig.expo;

    // Campi obbligatori
    const requiredFields = [
      ['name', 'Nome app'],
      ['slug', 'Slug app'],
      ['version', 'Versione app'],
      ['icon', 'Icona'],
      ['android.package', 'Package ID Android'],
      ['ios.bundleIdentifier', 'Bundle ID iOS']
    ];

    for (const [field, desc] of requiredFields) {
      const value = field.includes('.') 
        ? field.split('.').reduce((obj, key) => obj?.[key], expo)
        : expo[field];
      
      if (value) {
        log(`✅ ${desc}: ${value}`, 'green');
      } else {
        log(`❌ ${desc} mancante in app.json`, 'red');
        allChecksPass = false;
      }
    }
  } catch (error) {
    log(`❌ Errore lettura app.json: ${error.message}`, 'red');
    allChecksPass = false;
  }

  // 3. Test suite
  log('\n🧪 Esecuzione test suite...', 'yellow');
  const testResult = runCommand('npm test', 'Test suite');
  if (!testResult.success) {
    allChecksPass = false;
  } else {
    // Analizza output dei test
    const testOutput = testResult.output;
    const passedMatch = testOutput.match(/(\d+) passed/);
    const failedMatch = testOutput.match(/(\d+) failed/);
    
    if (passedMatch) {
      log(`✅ Test passati: ${passedMatch[1]}`, 'green');
    }
    if (failedMatch && parseInt(failedMatch[1]) > 0) {
      log(`❌ Test falliti: ${failedMatch[1]}`, 'red');
      allChecksPass = false;
    }
  }

  // 4. Controllo dipendenze
  log('\n📦 Controllo dipendenze...', 'yellow');
  const auditResult = runCommand('npm audit --audit-level moderate', 'Audit sicurezza');
  if (!auditResult.success) {
    log('⚠️  Vulnerabilità rilevate - considera npm audit fix', 'yellow');
  }

  // 5. Controllo build web (opzionale per mobile build)
  log('\n🌐 Test build web...', 'yellow');
  const webBuildResult = runCommand('npm run build:web', 'Build web');
  if (!webBuildResult.success) {
    log('⚠️  Build web fallito, ma non blocca il mobile build', 'yellow');
  }

  // 6. Controllo backend
  log('\n🔗 Controllo configurazione backend...', 'yellow');
  try {
    const configPath = path.join(__dirname, '..', 'src', 'config.js');
    const configContent = fs.readFileSync(configPath, 'utf8');
    if (configContent.includes('API_URL')) {
      log(`✅ API URL configurata nel config`, 'green');
    } else {
      log('❌ API URL non trovata nel config', 'red');
      allChecksPass = false;
    }
  } catch (error) {
    log(`❌ Errore lettura config: ${error.message}`, 'red');
    allChecksPass = false;
  }

  // 7. Verifica versioning
  log('\n🏷️  Controllo versioning...', 'yellow');
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));
    
    const npmVersion = packageJson.version;
    const expoVersion = appJson.expo.version;
    
    if (npmVersion === expoVersion) {
      log(`✅ Versioni sincronizzate: ${npmVersion}`, 'green');
    } else {
      log(`⚠️  Versioni non sincronizzate - npm: ${npmVersion}, expo: ${expoVersion}`, 'yellow');
    }
  } catch (error) {
    log(`❌ Errore controllo versioni: ${error.message}`, 'red');
  }

  // Risultato finale
  log('\n=====================================', 'blue');
  if (allChecksPass) {
    log('🎉 Tutti i controlli passati! Pronto per il build!', 'green');
    log('\nComandi disponibili:', 'blue');
    log('- npm run build:preview  (per testing)', 'blue');
    log('- npm run build:android  (produzione Android)', 'blue');
    log('- npm run build:ios      (produzione iOS)', 'blue');
    log('- npm run build:all      (produzione tutte)', 'blue');
    process.exit(0);
  } else {
    log('❌ Alcuni controlli sono falliti. Risolvi i problemi prima del build.', 'red');
    process.exit(1);
  }
}

main().catch(error => {
  log(`💥 Errore script: ${error.message}`, 'red');
  process.exit(1);
});