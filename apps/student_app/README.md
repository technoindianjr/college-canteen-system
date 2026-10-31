# Campus Canteen — student app (Flutter)

Screens from the design chart: Welcome / login (mobile OTP) → Home (search, Special Today, six categories,
popular items, combos) → category menu → cart → order placed with pickup code and live status → Orders · Profile.
Version 1 is **pay at the counter** (cash or UPI QR).

## First-time setup

```bash
cd apps/student_app
flutter create . --org com.campuscanteen --project-name campus_canteen --platforms=android,ios
flutter pub get
flutter analyze
flutter test
```

`flutter create .` only adds the missing `android/` and `ios/` folders; it keeps the existing `lib/` and `test/`.

### Android settings (after `flutter create`)

In `android/app/src/main/AndroidManifest.xml`, inside `<manifest>` above `<application>`:

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
```

For local testing against `http://` (not needed with your HTTPS domain), add to
`android/app/src/debug/AndroidManifest.xml` inside `<manifest>`:

```xml
<application android:usesCleartextTraffic="true"/>
```

## Run without Firebase (dev login)

Start the server with `AUTH_DEV_MODE=true`, then:

```bash
# Android emulator talking to the server on your Mac
flutter run --dart-define=DEV_LOGIN=true --dart-define=API_URL=http://10.0.2.2:3000

# Real phone on the same Wi-Fi / your live server
flutter run --dart-define=DEV_LOGIN=true --dart-define=API_URL=https://api.your-domain.com
```

Any 10-digit number and any 6-digit code logs you in. Never ship a build with `DEV_LOGIN=true`.

## Real OTP + push notifications (Firebase)

1. Create a Firebase project; add an Android app (`com.campuscanteen.campus_canteen`) and an iOS app.
2. Authentication → Sign-in method → enable **Phone**.
3. Android: add your debug and release **SHA-1 and SHA-256** fingerprints in Project settings
   (`cd android && ./gradlew signingReport`).
4. iOS: upload an APNs key in Cloud Messaging settings (needed for both OTP and push).
5. In this folder: `dart pub global activate flutterfire_cli && flutterfire configure` — this overwrites
   `lib/firebase_options.dart`.
6. On the server: set `FIREBASE_SERVICE_ACCOUNT_PATH` and `AUTH_DEV_MODE=false`.
7. Run: `flutter run --dart-define=API_URL=https://api.your-domain.com`

Tip: Firebase → Authentication → Phone → "Phone numbers for testing" lets you add fake numbers with a fixed code.

## Build a release APK

```bash
flutter build apk --release --dart-define=API_URL=https://api.your-domain.com
# build/app/outputs/flutter-apk/app-release.apk
```

## Code map

| Path | What |
| --- | --- |
| `lib/main.dart` | App start, Firebase init, live-update wiring |
| `lib/router.dart` | Routes + login / profile redirects |
| `lib/state/providers.dart` | Auth, menu, cart, orders (Riverpod) |
| `lib/services/` | Phone OTP (Firebase or dev), push registration |
| `lib/screens/` | One file per screen |
| `lib/widgets/` | Item rows, qty stepper, cart bar, images |
| `../../packages/canteen_core` | Models, API client, Socket.IO client, theme — shared with staff and admin apps |
