# Store Asset Generation Guide

This guide explains how to create the required assets for Google Play Store and Apple App Store submission.

## 📱 Required Assets Overview

### Google Play Store
- ✅ App Icon: Use existing `assets/icon.png` (512x512px minimum)
- ❌ Feature Graphic: 1024×500px banner for store listing
- ❌ Screenshots: 2-8 phone screenshots, optional tablet screenshots

### Apple App Store  
- ❌ App Icon: 1024×1024px high-resolution icon
- ❌ iPhone Screenshots: 3-10 screenshots for different screen sizes
- ❌ iPad Screenshots: 1-5 screenshots for tablet layouts

## 🎨 Asset Creation Tools

### Design Tools (Recommended)
- **Figma** (Free): Professional design tool with mobile app templates
- **Canva** (Free/Paid): Easy-to-use templates for app store graphics
- **Adobe Creative Suite** (Paid): Industry-standard design tools
- **GIMP** (Free): Open-source alternative to Photoshop

### Screenshot Tools
- **Expo Simulator**: Generate screenshots from running app
- **Device Simulators**: iOS Simulator, Android Studio emulator
- **Real Devices**: Best quality, authentic user experience
- **Rotato** (Paid): Professional mockup generator

## 📐 Asset Specifications

### Feature Graphic (Google Play)
**File:** `feature-graphic.png`
**Size:** 1024×500px
**Format:** PNG or JPEG
**File Size:** Max 15MB

**Design Guidelines:**
- Should represent your app's core functionality
- Include app name/logo prominently
- Use high-contrast colors for visibility
- Avoid excessive text (will be hard to read)
- Match your app's visual branding

**Template Content:**
```
Background: Professional gradient or solid color
App Icon: Left or center placement
App Name: "Gestionale - Business Manager"
Tagline: "Streamline Your Business Operations"
Key Features: Order Management • Inventory • CRM
```

### App Icon 1024x1024 (App Store)
**File:** `app-icon-1024.png`
**Size:** 1024×1024px
**Format:** PNG (no transparency)
**File Size:** Max 1MB

**Design Guidelines:**
- Scale up existing icon.png maintaining quality
- Remove any transparency/alpha channels
- Ensure clear visibility at small sizes
- Follow iOS design guidelines
- No text overlays or badges

### Screenshots

#### iPhone Screenshots
**Files:** `iphone-screenshot-1.png` to `iphone-screenshot-6.png`
**Sizes Required:**
- 6.7" display: 1290×2796px
- 6.5" display: 1242×2688px  
- 5.5" display: 1242×2208px

**Content Suggestions:**
1. **Login Screen**: Clean, professional authentication
2. **Dashboard**: Main business overview with charts
3. **Orders List**: Active orders with status indicators  
4. **Product Management**: Inventory grid or list view
5. **User Profile**: Settings and account management
6. **Analytics**: Business insights and reporting

#### iPad Screenshots (Optional)
**Files:** `ipad-screenshot-1.png` to `ipad-screenshot-3.png`
**Sizes Required:**
- 12.9" display: 2048×2732px
- 11" display: 1668×2388px

### Android Screenshots
**Files:** `screenshots-phone-1.png` to `screenshots-phone-4.png`
**Sizes Required:**
- Phone: 1080×1920px minimum
- Tablet: 1200×1920px minimum (optional)

## 🛠️ Generation Commands

### Using Expo/React Native Simulators

```bash
# Start iOS simulator
npx expo start --ios

# Start Android emulator  
npx expo start --android

# Take screenshots using device tools
# iOS: Cmd+S in Simulator
# Android: Volume Down + Power button
```

### Using Design Tools

```bash
# Install image optimization tools
npm install -g imagemin imagemin-pngquant imagemin-mozjpeg

# Optimize generated images
imagemin store-assets/*.png --out-dir=store-assets/optimized
```

## 📋 Asset Creation Checklist

### Pre-Production (Testing Phase)
- [ ] Create feature graphic with placeholder design
- [ ] Generate 3-4 basic screenshots from simulator
- [ ] Scale up app icon to 1024x1024px
- [ ] Test all images in validation scripts

### Production Ready
- [ ] Professional feature graphic with final branding
- [ ] High-quality screenshots from real devices
- [ ] Multiple device size screenshots
- [ ] Localized screenshots (if supporting multiple languages)
- [ ] A/B test different feature graphic designs

## 📁 File Organization

```
store-assets/
├── feature-graphic.png          # Google Play banner
├── app-icon-1024.png           # App Store icon
├── screenshots-phone-1.png     # Android phone screenshots
├── screenshots-phone-2.png
├── screenshots-tablet-1.png (optional)
├── iphone-screenshot-1.png     # iOS screenshots  
├── iphone-screenshot-2.png
├── ipad-screenshot-1.png (optional)
└── templates/                  # Design templates and sources
    ├── feature-graphic.fig     # Figma template
    ├── icon-source.svg         # Vector icon source
    └── screenshot-frames.psd   # Device frame templates
```

## 🚀 Quick Start Templates

### Minimal Asset Set (For Testing)
1. **Feature Graphic**: Simple text on gradient background
2. **Screenshots**: 3 simulator screenshots with basic app flow
3. **App Icon**: Scaled version of existing icon.png

### Professional Asset Set (For Launch)
1. **Feature Graphic**: Custom design with branding and key features
2. **Screenshots**: 6-8 device screenshots showing all main features
3. **App Icon**: Professionally designed 1024x1024px icon
4. **Multiple Sizes**: Screenshots for all required device sizes

## 🔧 Automation Script

Create this script to validate all assets:

```bash
# Run asset validation
node scripts/validate-assets.js

# Generate missing asset templates
node scripts/generate-asset-templates.js

# Optimize all images
node scripts/optimize-images.js
```

## 📞 Resources and Help

- **Google Play Asset Guidelines**: [developer.android.com/distribute/console](https://developer.android.com/distribute/console)
- **App Store Screenshot Guidelines**: [developer.apple.com/design/human-interface-guidelines](https://developer.apple.com/design/human-interface-guidelines)
- **Expo Asset Guide**: [docs.expo.dev/guides/app-icons](https://docs.expo.dev/guides/app-icons)
- **Design Inspiration**: [mobbin.design](https://mobbin.design), [page.flows](https://pageflows.com)

---

**Note**: This guide provides templates and specifications. For production launch, consider hiring a professional designer for high-quality assets that will improve your app's conversion rate in the stores.