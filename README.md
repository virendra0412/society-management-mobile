# SocietyApp Mobile (React Native / Expo)

Production-grade Expo app — React Navigation, TypeScript-ready.

## Quick Start

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone.

## Set your API URL

Edit `app.json → extra.apiBaseUrl`:
```json
"extra": {
  "apiBaseUrl": "https://your-backend.onrender.com/api/v1"
}
```

## Project Structure

```
src/
├── api/            # Axios client + all API methods (mirrors backend)
├── components/
│   ├── ui/         # Badge, Btn, Input, Card, Modal, Spinner, EmptyState…
│   └── layout/     # ScreenWrapper (SafeArea + ScrollView)
├── constants/      # theme.js — colors, nav items, status maps
├── context/        # Auth, Toast, Language, Notifications
├── i18n/           # en.js / hi.js / gu.js locale files
├── navigation/
│   ├── RootNavigator.jsx   # Login/Pending/Main gate
│   ├── AuthStack.jsx       # Login → Register
│   └── AppTabs.jsx         # Bottom tab navigator
├── screens/
│   ├── auth/       ✅ Login, Register
│   ├── home/       ✅ Dashboard
│   ├── issues/     ✅ Full feature (list, create, detail, comments)
│   ├── visitors/   🔲 Placeholder (Phase 2 Sprint 1)
│   ├── maintenance/ 🔲 Placeholder (Phase 2 Sprint 1)
│   └── more/       ✅ Grid navigator
│       ├── Notices    🔲 Placeholder
│       ├── Help       🔲 Placeholder
│       ├── Contacts   🔲 Placeholder
│       ├── Polls      🔲 Placeholder
│       ├── Profile    🔲 Placeholder
│       └── Admin      🔲 Placeholder
└── utils/          # storage.js (SecureStore), timeago.js
```

## Push Notifications (Android)

For Android production push notifications, add `google-services.json`
(from Firebase Console) to the project root and uncomment the
`googleServicesFile` line in `app.json`.

## Building for Production

```bash
npx eas build --platform android
npx eas build --platform ios
```
