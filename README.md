# HIX Protocol (Expo Go Ready)

This project is configured to run as a standard Expo app using `App.js` as the entry screen.

## Quick start (Expo Go)

1. Install dependencies:

```bash
npm install
```

2. Start Metro:

```bash
npx expo start
```

3. Open with Expo Go on your phone by scanning the QR code.


## iPhone “Safari could not connect to the server” fix

If you start Expo with `--localhost`, the URL is `127.0.0.1` and only your computer can reach it.
Your phone cannot open that address, so Expo Go/Safari will fail to connect.

Use one of these instead:

```bash
npx expo start -c --lan
```

or

```bash
npx expo start -c --tunnel
```

Use `--lan` when phone + PC are on same Wi-Fi. Use `--tunnel` when LAN is blocked.


## Useful commands

```bash
npm run start
npm run android
npm run ios
npm run web
npm run doctor
npm run fix-deps
```

## Important: dependency safety for Expo

Avoid running `npm audit fix --force` in Expo projects unless you intentionally plan a full SDK upgrade.
It can silently upgrade `expo` and create native/JS version mismatches in Expo Go.

If that happens, reset to project-pinned dependencies:

```bash
# from project root
rm -rf node_modules package-lock.json .expo
npm install
npx expo install --fix
npx expo start -c --tunnel
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules,package-lock.json,.expo
npm install
npx expo install --fix
npx expo start -c --tunnel
```

## Recommended local environment

- Node.js 20 LTS (the project now declares `>=20 <22` in `package.json`).
- Keep Expo Go updated on your phone.

2. Start Metro:

```bash
npx expo start
```

3. Open with Expo Go on your phone by scanning the QR code.

## Useful commands

```bash
npm run start
npm run android
npm run ios
npm run web
```

## Notes

- Main app file: `App.js`
- Entry registration: `index.js`
- Expo config: `app.json`

If you later want file-based routing with Expo Router, generate it explicitly and add the required router dependencies before introducing `app/` route files.
