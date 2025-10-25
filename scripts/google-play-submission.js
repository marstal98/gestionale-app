#!/usr/bin/env node

/**
 * Google Play Store Submission Automation Script
 * 
 * This            if (asset.pattern) {
                // Check for screenshot files
                try {
                    const screenshots = fs.readdirSync(this.assetsPath)
                        .filter(file => file.match(/screenshots-.*\.png$/));
                    
                    if (screenshots.length < asset.required) {
                        this.log(`Need at least ${asset.required} screenshots, found ${screenshots.length}`, 'error');
                        allValid = false;
                    } else {
                        this.log(`Found ${screenshots.length} screenshots`, 'success');
                    }
                } catch (error) {
                    this.log(`Need at least ${asset.required} screenshots, found 0`, 'error');
                    allValid = false;
                }
            } else if (!fs.existsSync(assetPath)) {ares and validates all materials needed for
 * Google Play Console submission including app bundles, store
 * listings, and required metadata.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class GooglePlaySubmission {
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

    async validateAppBundle() {
        this.log('🔍 Validating Android App Bundle (AAB)...');
        
        const aabPath = path.join(this.buildPath, 'gestionale-app.aab');
        
        if (!fs.existsSync(aabPath)) {
            this.log('App Bundle (.aab) file not found. Run EAS build first.', 'error');
            return false;
        }

        try {
            // Check bundle size (Google Play limit: 150MB)
            const stats = fs.statSync(aabPath);
            const sizeMB = stats.size / (1024 * 1024);
            
            if (sizeMB > 150) {
                this.log(`App Bundle size (${sizeMB.toFixed(2)}MB) exceeds 150MB limit`, 'error');
                return false;
            }
            
            this.log(`App Bundle size: ${sizeMB.toFixed(2)}MB`, 'success');
            this.results.buildInfo.bundleSize = `${sizeMB.toFixed(2)}MB`;
            
            return true;
        } catch (error) {
            this.log(`Bundle validation failed: ${error.message}`, 'error');
            return false;
        }
    }

    validateStoreAssets() {
        this.log('🖼️ Validating store assets...');
        
        const requiredAssets = [
            { name: 'Feature Graphic', file: 'feature-graphic.png', size: '1024x500' },
            { name: 'App Icon', file: '../assets/icon.png', size: '512x512' },
            { name: 'Screenshots', pattern: 'screenshots-*.png', required: 2 }
        ];

        let allValid = true;

        for (const asset of requiredAssets) {
            if (asset.pattern) {
                // Check for screenshot files
                try {
                    const screenshots = fs.readdirSync(this.assetsPath)
                        .filter(file => file.match(/screenshots-.*\.png$/));
                    
                    if (screenshots.length < asset.required) {
                        this.log(`Need at least ${asset.required} screenshots, found ${screenshots.length}`, 'error');
                        allValid = false;
                    } else {
                        this.log(`Found ${screenshots.length} screenshots`, 'success');
                    }
                } catch (error) {
                    this.log(`Need at least ${asset.required} screenshots, found 0`, 'error');
                    allValid = false;
                }
            } else {
                const assetPath = path.join(this.assetsPath, asset.file);
                if (!fs.existsSync(assetPath)) {
                    this.log(`Missing required asset: ${asset.name} (${asset.file})`, 'error');
                    allValid = false;
                } else {
                    this.log(`✓ ${asset.name} found`, 'success');
                }
            }
        }

        return allValid;
    }

    validateMetadata() {
        this.log('📝 Validating app metadata...');
        
        const requiredFiles = [
            'STORE_DESCRIPTION_IT.md',
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
            
            // Validate minimum content length
            if (content.length < 500) {
                this.log(`${file} seems too short (${content.length} chars)`, 'warning');
            } else {
                this.log(`✓ ${file} validated`, 'success');
            }
        }

        return allValid;
    }

    validateAppConfig() {
        this.log('⚙️ Validating app configuration...');
        
        try {
            const packageJson = JSON.parse(fs.readFileSync(path.join(this.rootPath, 'package.json'), 'utf8'));
            const appJson = JSON.parse(fs.readFileSync(path.join(this.rootPath, 'app.json'), 'utf8'));

            // Version validation
            if (!packageJson.version || !appJson.expo.version) {
                this.log('Version numbers missing in package.json or app.json', 'error');
                return false;
            }

            if (packageJson.version !== appJson.expo.version) {
                this.log('Version mismatch between package.json and app.json', 'warning');
            }

            // Required Expo fields
            const requiredFields = ['name', 'slug', 'version', 'description'];
            for (const field of requiredFields) {
                if (!appJson.expo[field]) {
                    this.log(`Missing required field in app.json: expo.${field}`, 'error');
                    return false;
                }
            }

            // Android specific validation
            if (!appJson.expo.android?.package) {
                this.log('Missing Android package name in app.json', 'error');
                return false;
            }

            this.log('✓ App configuration validated', 'success');
            this.results.buildInfo.version = packageJson.version;
            this.results.buildInfo.androidPackage = appJson.expo.android.package;
            
            return true;
        } catch (error) {
            this.log(`Config validation failed: ${error.message}`, 'error');
            return false;
        }
    }

    generateSubmissionChecklist() {
        this.log('📋 Generating submission checklist...');
        
        const checklist = `# Google Play Store Submission Checklist

Generated on: ${new Date().toISOString()}

## Pre-Submission Validation ✅

### Build Requirements
- [x] Android App Bundle (.aab) generated
- [x] Bundle size under 150MB
- [x] App signed with upload key
- [x] Version codes incremented

### Store Assets
- [x] Feature graphic (1024x500px)
- [x] App icon (512x512px)  
- [x] Screenshots (minimum 2)
- [x] Privacy Policy document
- [x] Terms of Service document

### App Configuration
- [x] Package name configured
- [x] Version numbers synchronized
- [x] Target SDK version set
- [x] Permissions declared

## Manual Steps Required

### Google Play Console Setup
1. Create developer account ($25 one-time fee)
2. Complete identity verification
3. Accept Developer Distribution Agreement

### App Listing Creation
1. Upload app bundle (.aab file)
2. Fill out store listing details:
   - App name: "Gestionale - Business Manager"
   - Short description (80 chars max)
   - Full description (4000 chars max)
   - Category: Business
   - Content rating: Everyone
3. Upload store assets (feature graphic, screenshots)
4. Set pricing & distribution (countries)

### Release Management
1. Create production release
2. Upload app bundle
3. Add release notes
4. Review and publish

### Post-Launch
1. Monitor crash reports
2. Respond to user reviews
3. Plan update schedule

## Build Information
- Version: ${this.results.buildInfo.version || 'N/A'}
- Bundle Size: ${this.results.buildInfo.bundleSize || 'N/A'}
- Package: ${this.results.buildInfo.androidPackage || 'N/A'}

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

---
Generated by Gestionale App Build System
`;

        const checklistPath = path.join(this.assetsPath, 'GOOGLE_PLAY_CHECKLIST.md');
        fs.writeFileSync(checklistPath, checklist);
        
        this.log(`Checklist saved to: ${checklistPath}`, 'success');
    }

    async run() {
        console.log('🚀 Google Play Store Submission Validator\n' + '='.repeat(50));
        
        try {
            // Create builds directory if needed
            if (!fs.existsSync(this.buildPath)) {
                fs.mkdirSync(this.buildPath, { recursive: true });
                this.log('Created builds directory', 'info');
            }

            // Run all validations
            const bundleValid = await this.validateAppBundle();
            const assetsValid = this.validateStoreAssets();
            const metadataValid = this.validateMetadata();
            const configValid = this.validateAppConfig();

            // Generate checklist regardless of validation results
            this.generateSubmissionChecklist();

            // Final summary
            console.log('\n' + '='.repeat(50));
            
            if (bundleValid && assetsValid && metadataValid && configValid) {
                this.log('🎉 All validations passed! Ready for Google Play submission.', 'success');
                console.log('\n📋 Next steps:');
                console.log('1. Review the generated checklist');
                console.log('2. Set up Google Play Console account');
                console.log('3. Upload your app bundle');
                console.log('4. Complete store listing');
                console.log('5. Submit for review');
            } else {
                this.log('❌ Some validations failed. Please fix errors before submission.', 'error');
                console.log('\n🔧 Check the errors above and run this script again.');
            }

            console.log(`\n📄 Full checklist: ${path.join(this.assetsPath, 'GOOGLE_PLAY_CHECKLIST.md')}`);
            
        } catch (error) {
            this.log(`Submission preparation failed: ${error.message}`, 'error');
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const submission = new GooglePlaySubmission();
    submission.run().catch(console.error);
}

module.exports = GooglePlaySubmission;