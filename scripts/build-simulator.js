#!/usr/bin/env node

/**
 * Simulatore di build EAS per testing locale
 * Simula il processo di build senza effettuare build reali
 */

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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulateBuild(platform, profile) {
  log(`\n🏗️  Simulazione EAS Build`, 'blue');
  log(`Platform: ${platform}`, 'blue');
  log(`Profile: ${profile}`, 'blue');
  log(`===============================`, 'blue');

  // Simulazione fasi build
  const phases = [
    'Validazione configurazione',
    'Setup ambiente build',
    'Install dependencies',
    'Generazione bundle',
    'Compilazione nativa',
    'Signing & packaging',
    'Upload artifacts'
  ];

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    log(`\n[${i + 1}/${phases.length}] ${phase}...`, 'yellow');
    
    // Simula tempo di processing
    await delay(1000 + Math.random() * 2000);
    
    log(`✅ ${phase} completato`, 'green');
  }

  // Risultato finale
  const buildId = Math.random().toString(36).substring(7);
  const downloadUrl = `https://expo.dev/artifacts/${buildId}`;
  
  log(`\n🎉 Build completato con successo!`, 'green');
  log(`\n📋 Dettagli Build:`, 'blue');
  log(`   Build ID: ${buildId}`, 'blue');
  log(`   Platform: ${platform}`, 'blue');
  log(`   Profile: ${profile}`, 'blue');
  log(`   Download: ${downloadUrl}`, 'blue');
  log(`   Size: ${Math.floor(Math.random() * 50 + 10)} MB`, 'blue');
  
  if (platform === 'android') {
    const fileType = profile === 'production' ? 'AAB' : 'APK';
    log(`   Type: ${fileType}`, 'blue');
  } else if (platform === 'ios') {
    log(`   Type: IPA`, 'blue');
  }

  log(`\n📱 Next Steps:`, 'yellow');
  log(`1. Download and test on device`, 'yellow');
  log(`2. If preview: Share with team for testing`, 'yellow');
  log(`3. If production: Submit to stores`, 'yellow');
  
  return { success: true, buildId, downloadUrl };
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments (simula eas build args)
  let platform = 'all';
  let profile = 'preview';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--platform' && args[i + 1]) {
      platform = args[i + 1];
      i++;
    }
    if (args[i] === '--profile' && args[i + 1]) {
      profile = args[i + 1];
      i++;
    }
  }

  log(`🚀 EAS Build Simulator`, 'blue');
  log(`(Per testing - non fa build reali)`, 'yellow');

  if (platform === 'all') {
    // Build per entrambe le piattaforme
    await simulateBuild('android', profile);
    await simulateBuild('ios', profile);
  } else {
    await simulateBuild(platform, profile);
  }

  log(`\n✨ Simulation completed!`, 'green');
  log(`Per build reali, usa EAS CLI con account Expo.`, 'blue');
}

main().catch(error => {
  log(`💥 Errore: ${error.message}`, 'red');
  process.exit(1);
});