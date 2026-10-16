# ShopEasy Mobile — Documentation & Architecture

This directory houses project documentation, design artifacts, and test captures for the ShopEasy React Native mobile application.

## Directory Structure

```
ShopEasyMobile/
├── android/            # Native Android project configuration and Gradle build files
├── ios/                # Native iOS project configuration and CocoaPods
├── docs/               # Architecture guides, screenshots, and references
│   └── screenshots/    # Visual verification screenshots captured on physical devices
├── src/                # Core application source code
│   ├── assets/         # Static bundled assets
│   │   ├── icons/      # Custom vector and icon assets
│   │   ├── images/     # Bundled image files and placeholders
│   │   └── logos/      # ShopEasy brand logos and marks
│   ├── components/     # Reusable UI presentation components (Header, ProductCard, etc.)
│   ├── config/         # Environment, API endpoints, and network configuration
│   ├── context/        # React Context providers and global state management (CartContext)
│   ├── screens/        # Screen-level container views (Home, Products, Details, Cart)
│   ├── services/       # Network API communication services
│   ├── theme/          # App design tokens, color palettes, and Dark/Light mode theme provider
│   ├── types/          # TypeScript interfaces and data models
│   └── utils/          # General pure helper functions (price calculations, formatters)
├── __tests__/          # Automated Jest test suites
├── App.tsx             # Root application navigation and composition
├── index.js            # React Native AppRegistry entry point
└── package.json        # Dependencies and build scripts
```

## Screen Archives (`docs/screenshots/`)

Contains timestamped test captures from real device executions verifying:
- Home Screen and category filters
- Product Catalogue browsing and search
- Product Details inspection and stock limits
- Shopping Cart additions, steppers, order summaries, clear actions, and persistence across app restarts
