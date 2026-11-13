# AppFanclubs

You already have apps you care about. AppFanclubs connects you with other people who use them.

A familiar browser, a creative tool, or niche software known mostly to people who share your interests can become the starting point for a community. Choose which detected apps to share, join their clubs, and talk with real people about what you use.

## Clubs and Blends

Each app has its own club for conversations, questions, discoveries and alternatives. Create a **Blend** to bring together people using a combination of two to five apps: compare workflows, share what you make, and learn how the tools fit together.

Blends use their apps’ names and an overlapping stack of their icons. Members can take part in community moderation through proposals and votes.

## Your app selection

App discovery runs on your device. You choose which apps to share; the complete scan is not uploaded. Subsequent scans update device-based memberships when selected apps are removed. Explicitly followed clubs can remain available.

Windows and Android support installed-app discovery. The macOS client scans standard Applications folders. iOS currently supports browsing and account access, not installed-app discovery.

## Download

[Open AppFanclubs](https://chillapi.stream/appfanclubs/) · [Download the latest release](https://github.com/PatAbah/AppFanclubs/releases/latest)

| Platform | Download |
| --- | --- |
| Windows | Portable `.exe` |
| Android | Installable `.apk` |
| macOS | `.dmg` and `.zip`, for Apple silicon and Intel |
| iOS Simulator | Simulator archive, for development on a Mac |

The Windows and macOS builds do not have developer signing or notarization. macOS may display an installation warning. The iOS simulator archive cannot be installed on an iPhone. A signed iPhone release is not available yet. Android push delivery is pending configuration.

## Build the clients

This repository contains the desktop, mobile and web clients. Node.js 22 and npm are recommended.

### Windows

```sh
npm ci
npm run test:desktop
npm run desktop:build
```

### macOS

On a Mac:

```sh
npm ci
npm run test:desktop
npm run desktop:build:mac
```

Desktop outputs are written to `release/1.1.0/`.

### Android

Install Node.js, Java and the Android SDK, then:

```sh
cd mobile
npm ci
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

On Windows, use `gradlew.bat assembleRelease`. Configure your own Android signing credentials when distributing your own builds.

### iOS Simulator

On a Mac with Xcode and CocoaPods:

```sh
cd mobile
npm ci
npx expo run:ios --configuration Release
```

A physical-device release requires Apple signing. Cloud builds can use the profiles in `mobile/eas.json` after linking your own Expo project.

### Web client

```sh
npm ci
npm run dev
```

Use `npm run build` for a production web build.

## Connection settings

The shared client address is defined in `mobile/appfanclubs.config.json`. Keep the HTTPS address and its service path together. Desktop builds also accept this file beside the portable executable or beside the macOS application bundle.

## Open source

The client source is available under the [MIT licence](LICENSE). Contributions, bug reports and platform testing are welcome.
