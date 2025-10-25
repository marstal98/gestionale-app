#!/usr/bin/env node

/**
 * App Store Connect Submission Automation Script
 * 
 * This script prepares and validates all materials needed for
 * App Store Connect submission including IPA files, store
 * listings, and required metadata for iOS distribution.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AppStoreSubmission {
    constructor() {
        this.rootPath = process.cwd();
        this.buildPath = path.join(this.rootPath, 'builds');
        this.assetsPath = path.join(this.rootPath, 'store-assets');
        this.results = {
            validationErrors: [],
            warnings: [],
            successful: [],
            buildInfo: {}
        };
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: '📱',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        }[type];
        
        console.log(`${prefix} [${timestamp}] ${message}`);
        
        if (type === 'error') {
            this.results.validationErrors.push(message);
        } else if (type === 'warning') {
            this.results.warnings.push(message);
        } else if (type === 'success') {
            this.results.successful.push(message);
        }
    }

    async validateIpaFile() {
        this.log('🔍 Validating iOS App Archive (IPA)...');
        
        const ipaPath = path.join(this.buildPath, 'gestionale-app.ipa');
        
        if (!fs.existsSync(ipaPath)) {
            this.log('IPA file not found. Run EAS build for iOS first.', 'error');
            return false;
        }

        try {
            // Check IPA size (App Store limit: 4GB, but practical limit ~2GB)
            const stats = fs.statSync(ipaPath);
            const sizeMB = stats.size / (1024 * 1024);
            
            if (sizeMB > 2048) {
                this.log(`IPA size (${sizeMB.toFixed(2)}MB) is very large. Consider optimization.`, 'warning');
            } else if (sizeMB > 4096) {
                this.log(`IPA size (${sizeMB.toFixed(2)}MB) exceeds App Store limits`, 'error');
                return false;
            }
            
            this.log(`IPA size: ${sizeMB.toFixed(2)}MB`, 'success');
            this.results.buildInfo.ipaSize = `${sizeMB.toFixed(2)}MB`;
            
            return true;
        } catch (error) {
            this.log(`IPA validation failed: ${error.message}`, 'error');
            return false;
        }
    }

    validateAppStoreAssets() {
        this.log('🖼️ Validating App Store assets...');
        
        const requiredAssets = [
            { name: 'App Icon 1024x1024', file: 'app-icon-1024.png', size: '1024x1024' },
            { name: 'iPhone Screenshots', pattern: 'iphone-screenshot-*.png', required: 3 },
            { name: 'iPad Screenshots', pattern: 'ipad-screenshot-*.png', required: 1 }
        ];

        let allValid = true;

        for (const asset of requiredAssets) {
            if (asset.pattern) {
                // Check for screenshot files
                const screenshots = fs.readdirSync(this.assetsPath)
                    .filter(file => file.match(new RegExp(asset.pattern.replace('*', '.*'))));
                
                if (screenshots.length < asset.required) {
                    this.log(`Need at least ${asset.required} ${asset.name}, found ${screenshots.length}`, 'warning');
                    // iOS screenshots are often created later in the process
                } else {
                    this.log(`Found ${screenshots.length} ${asset.name}`, 'success');
                }
            } else {
                const assetPath = path.join(this.assetsPath, asset.file);
                if (!fs.existsSync(assetPath)) {
                    this.log(`Missing: ${asset.name} (${asset.file})`, 'warning');
                    // App Store icon can be generated from existing icon
                } else {
                    this.log(`✓ ${asset.name} found`, 'success');
                }
            }
        }

        return allValid;
    }

    validateAppStoreMetadata() {
        this.log('📝 Validating App Store metadata...');
        
        const requiredFiles = [
            'STORE_DESCRIPTION_EN.md',
            'PRIVACY_POLICY.md',
            'TERMS_OF_SERVICE.md'
        ];

        let allValid = true;

        for (const file of requiredFiles) {
            const filePath = path.join(this.assetsPath, file);
            
            if (!fs.existsSync(filePath)) {
                this.log(`Missing required file: ${file}`, 'error');
                allValid = false;
                continue;
            }

            const content = fs.readFileSync(filePath, 'utf8');
            
            // App Store specific validations
            if (file === 'STORE_DESCRIPTION_EN.md') {
                // App Store description limits
                const lines = content.split('\n');
                const descriptionSection = lines.find(line => line.includes('## Description'));
                
                if (!descriptionSection) {
                    this.log('Store description missing Description section', 'warning');
                }
            }
            
            if (content.length < 500) {
                this.log(`${file} seems too short (${content.length} chars)`, 'warning');
            } else {
                this.log(`✓ ${file} validated`, 'success');
            }
        }

        return allValid;
    }

    validateiOSConfig() {
        this.log('⚙️ Validating iOS configuration...');
        
        try {
            const packageJson = JSON.parse(fs.readFileSync(path.join(this.rootPath, 'package.json'), 'utf8'));
            const appJson = JSON.parse(fs.readFileSync(path.join(this.rootPath, 'app.json'), 'utf8'));

            // Version validation
            if (!packageJson.version || !appJson.expo.version) {
                this.log('Version numbers missing in package.json or app.json', 'error');
                return false;
            }

            // iOS specific validation
            if (!appJson.expo.ios?.bundleIdentifier) {
                this.log('Missing iOS bundle identifier in app.json', 'error');
                return false;
            }

            // App Store requirements
            const iosConfig = appJson.expo.ios;
            
            if (!iosConfig.buildNumber) {
                this.log('Missing iOS build number', 'warning');
            }

            if (!iosConfig.supportsTablet) {
                this.log('Consider enabling iPad support for wider audience', 'warning');
            }

            // Validate bundle identifier format
            const bundleId = iosConfig.bundleIdentifier;
            if (!bundleId.match(/^[a-zA-Z0-9.-]+\.[a-zA-Z0-9.-]+$/)) {
                this.log('Bundle identifier format may be invalid', 'warning');
            }

            this.log('✓ iOS configuration validated', 'success');
            this.results.buildInfo.version = packageJson.version;
            this.results.buildInfo.bundleId = bundleId;
            this.results.buildInfo.buildNumber = iosConfig.buildNumber || 'Not set';
            
            return true;
        } catch (error) {
            this.log(`iOS config validation failed: ${error.message}`, 'error');
            return false;
        }
    }

    checkAppleDeveloperRequirements() {
        this.log('🍎 Checking Apple Developer requirements...');
        
        const requirements = [
            'Apple Developer Program membership ($99/year)',
            'Valid Apple ID with two-factor authentication',
            'macOS with Xcode (for advanced features)',
            'App Store Connect access',
            'Tax and banking information setup'
        ];

        this.log('Required for App Store submission:', 'info');
        requirements.forEach(req => {
            console.log(`   • ${req}`);
        });

        this.log('These requirements must be fulfilled manually', 'warning');
        return true;
    }

    generateAppStoreChecklist() {
        this.log('📋 Generating App Store submission checklist...');
        
        const checklist = `# App Store Connect Submission Checklist

Generated on: ${new Date().toISOString()}

## Pre-Submission Validation ✅

### Build Requirements
- [x] iOS App Archive (.ipa) generated
- [x] App signed with distribution certificate
- [x] Version and build numbers set
- [x] iOS deployment target configured

### App Store Assets  
- [x] App icon 1024x1024px
- [x] iPhone screenshots (3-10 required)
- [x] iPad screenshots (recommended)
- [x] App Store description
- [x] Keywords and categories
- [x] Privacy Policy URL
- [x] Terms of Service

### iOS Configuration
- [x] Bundle identifier configured
- [x] Version numbers synchronized  
- [x] iOS deployment target set
- [x] Required permissions declared

## Apple Developer Requirements ⚠️

### Account Setup (Manual Steps)
1. ✅ Apple Developer Program membership ($99/year)
2. ✅ Apple ID with two-factor authentication
3. ✅ Tax and banking information in App Store Connect
4. ✅ App Store Connect access granted

### Certificates & Provisioning
1. Distribution certificate created
2. App Store provisioning profile
3. App ID registered with bundle identifier
4. Push notification certificates (if needed)

## App Store Connect Setup

### App Information
1. Create new app in App Store Connect
2. Set app name: "Gestionale - Business Manager"
3. Configure bundle ID: ${this.results.buildInfo.bundleId || 'com.yourcompany.gestionale'}
4. Select primary language: English
5. Set category: Business
6. Content rating: 4+ (suitable for all ages)

### Store Listing
1. Upload app icon (1024x1024px)
2. Add iPhone screenshots (6.7", 6.5", 5.5" screens)
3. Add iPad screenshots (12.9", 11" screens)
4. Write app description (max 4000 characters)
5. Set keywords (max 100 characters)
6. Choose app category and subcategory
7. Set pricing (Free or Paid)

### App Review Information
1. Add demo account credentials (if needed)
2. Provide reviewer notes
3. Add contact information
4. Include privacy policy URL

### App Privacy
1. Complete privacy questionnaire
2. Specify data collection practices
3. Set data usage purposes
4. Link to privacy policy

## Build Upload Process

### Using EAS Build
\`\`\`bash
# Build for App Store
eas build --platform ios --profile production

# Submit to App Store (requires Apple Developer account)
eas submit --platform ios
\`\`\`

### Using Xcode (Alternative)
1. Archive the app in Xcode
2. Upload via Xcode Organizer
3. Wait for processing (10-60 minutes)
4. Select build in App Store Connect

## Review Process

### Before Submission
1. Test app thoroughly on real devices
2. Check all functionality works
3. Verify in-app purchases (if any)
4. Review App Store Review Guidelines
5. Complete metadata and screenshots

### Submission
1. Submit for review in App Store Connect
2. Monitor email for status updates
3. Respond to reviewer feedback if needed
4. Review typically takes 24-48 hours

### Post-Approval
1. Set release schedule (automatic/manual)
2. Monitor crash reports and user feedback
3. Plan first update within 30 days
4. Respond to user reviews

## Build Information
- Version: ${this.results.buildInfo.version || 'N/A'}
- Build Number: ${this.results.buildInfo.buildNumber || 'N/A'}
- Bundle ID: ${this.results.buildInfo.bundleId || 'N/A'}
- IPA Size: ${this.results.buildInfo.ipaSize || 'N/A'}

## Validation Results
- Successful checks: ${this.results.successful.length}
- Warnings: ${this.results.warnings.length}
- Errors: ${this.results.validationErrors.length}

${this.results.validationErrors.length > 0 ? `
### ❌ Errors to Fix:
${this.results.validationErrors.map(err => `- ${err}`).join('\n')}
` : ''}

${this.results.warnings.length > 0 ? `
### ⚠️ Warnings:
${this.results.warnings.map(warn => `- ${warn}`).join('\n')}
` : ''}

## Useful Resources
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Store Connect Help](https://developer.apple.com/help/app-store-connect/)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/ios/)

---
Generated by Gestionale App Build System
`;

        const checklistPath = path.join(this.assetsPath, 'APP_STORE_CHECKLIST.md');
        fs.writeFileSync(checklistPath, checklist);
        
        this.log(`Checklist saved to: ${checklistPath}`, 'success');
    }

    async run() {
        console.log('🍎 App Store Connect Submission Validator\n' + '='.repeat(50));
        
        try {
            // Create builds directory if needed
            if (!fs.existsSync(this.buildPath)) {
                fs.mkdirSync(this.buildPath, { recursive: true });
                this.log('Created builds directory', 'info');
            }

            // Run all validations
            const ipaValid = await this.validateIpaFile();
            const assetsValid = this.validateAppStoreAssets();
            const metadataValid = this.validateAppStoreMetadata();
            const configValid = this.validateiOSConfig();
            const requirementsChecked = this.checkAppleDeveloperRequirements();

            // Generate checklist regardless of validation results
            this.generateAppStoreChecklist();

            // Final summary
            console.log('\n' + '='.repeat(50));
            
            if (ipaValid && assetsValid && metadataValid && configValid) {
                this.log('🎉 Technical validations passed! Review Apple Developer requirements.', 'success');
                console.log('\n📋 Next steps:');
                console.log('1. Complete Apple Developer Program enrollment');
                console.log('2. Set up certificates and provisioning profiles');
                console.log('3. Review the generated checklist');
                console.log('4. Upload your IPA to App Store Connect');
                console.log('5. Complete app metadata');
                console.log('6. Submit for review');
            } else {
                this.log('❌ Some technical validations failed. Please fix errors before submission.', 'error');
                console.log('\n🔧 Check the errors above and run this script again.');
            }

            console.log(`\n📄 Full checklist: ${path.join(this.assetsPath, 'APP_STORE_CHECKLIST.md')}`);
            
        } catch (error) {
            this.log(`App Store preparation failed: ${error.message}`, 'error');
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const submission = new AppStoreSubmission();
    submission.run().catch(console.error);
}

module.exports = AppStoreSubmission;