#!/usr/bin/env node

/**
 * Script per automatizzare il processo di release
 */

const { execSync } = require('child_process');
const fs = require('fs');
const readline = require('readline');

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

function runCommand(command, description) {
  try {
    log(`🔄 ${description}...`, 'blue');
    const output = execSync(command, { stdio: 'inherit' });
    log(`✅ ${description}`, 'green');
    return true;
  } catch (error) {
    log(`❌ ${description} fallito`, 'red');
    return false;
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  log('🚀 Release Automation Script', 'blue');
  log('===============================', 'blue');

  // 1. Controllo stato Git
  try {
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
    if (gitStatus.trim()) {
      log('❌ Repository ha modifiche non committate:', 'red');
      console.log(gitStatus);
      
      const commit = await question('Vuoi committare le modifiche? (y/n): ');
      if (commit.toLowerCase() === 'y') {
        const message = await question('Messaggio commit: ');
        runCommand(`git add .`, 'Add files');
        runCommand(`git commit -m "${message}"`, 'Commit changes');
      } else {
        log('❌ Committa le modifiche prima di procedere', 'red');
        process.exit(1);
      }
    }
  } catch (error) {
    log('⚠️  Controllo Git fallito, continuo...', 'yellow');
  }

  // 2. Selezione tipo release
  log('\nTipo di release:', 'yellow');
  log('1. Patch (1.0.0 → 1.0.1) - Bug fixes');
  log('2. Minor (1.0.0 → 1.1.0) - New features');
  log('3. Major (1.0.0 → 2.0.0) - Breaking changes');
  
  const releaseType = await question('Seleziona tipo (1/2/3): ');
  
  let versionCommand;
  switch (releaseType) {
    case '1':
      versionCommand = 'npm run version:patch';
      break;
    case '2':
      versionCommand = 'npm run version:minor';
      break;
    case '3':
      versionCommand = 'npm run version:major';
      break;
    default:
      log('❌ Selezione non valida', 'red');
      process.exit(1);
  }

  // 3. Bump version
  if (!runCommand(versionCommand, 'Version bump')) {
    process.exit(1);
  }

  // 4. Pre-build validation
  if (!runCommand('node scripts/pre-build.js', 'Pre-build validation')) {
    const continueAnyway = await question('Validation fallita. Continuare? (y/n): ');
    if (continueAnyway.toLowerCase() !== 'y') {
      process.exit(1);
    }
  }

  // 5. Selezione piattaforme
  log('\nPiattaforme di build:', 'yellow');
  log('1. Solo Android');
  log('2. Solo iOS');
  log('3. Entrambe');
  log('4. Preview (testing)');
  
  const platform = await question('Seleziona piattaforme (1/2/3/4): ');
  
  let buildCommand;
  switch (platform) {
    case '1':
      buildCommand = 'npm run build:android';
      break;
    case '2':
      buildCommand = 'npm run build:ios';
      break;
    case '3':
      buildCommand = 'npm run build:all';
      break;
    case '4':
      buildCommand = 'npm run build:preview';
      break;
    default:
      log('❌ Selezione non valida', 'red');
      process.exit(1);
  }

  // 6. Conferma finale
  const currentVersion = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
  log(`\n📋 Riepilogo Release:`, 'blue');
  log(`   Versione: ${currentVersion}`, 'blue');
  log(`   Build: ${buildCommand}`, 'blue');
  
  const confirm = await question('\nProcedere con il build? (y/n): ');
  if (confirm.toLowerCase() !== 'y') {
    log('❌ Release annullata', 'yellow');
    process.exit(0);
  }

  // 7. Esecuzione build
  log('\n🏗️  Avvio build process...', 'blue');
  if (!runCommand(buildCommand, 'EAS Build')) {
    log('❌ Build fallito', 'red');
    process.exit(1);
  }

  // 8. Push to Git
  if (!runCommand('git push', 'Push to Git')) {
    log('⚠️  Push Git fallito, ma build completato', 'yellow');
  }

  if (!runCommand('git push --tags', 'Push tags')) {
    log('⚠️  Push tags fallito, ma build completato', 'yellow');
  }

  // 9. Successo
  log('\n🎉 Release completata con successo!', 'green');
  log('\n📱 Prossimi passi:', 'blue');
  log('1. Controlla build su expo.dev/builds', 'blue');
  log('2. Testa l\'app sui dispositivi', 'blue');
  log('3. Submit agli store quando pronto', 'blue');
  log('   - npm run submit:android', 'blue');
  log('   - npm run submit:ios', 'blue');

  rl.close();
}

main().catch(error => {
  log(`💥 Errore: ${error.message}`, 'red');
  rl.close();
  process.exit(1);
});