# Arcade as an app

There are two ways to get the arcade on a phone.

## 1. Install it from the browser (works right now)

Once the site is hosted (GitHub Pages works), open `GameIndex.html` on the phone:

* Android / Chrome: tap the menu and pick "Install app", or use the Install button on the Me tab.
* iPhone / Safari: tap Share, then "Add to Home Screen".

It opens full screen with its own icon, and after the first visit every game works offline.

When you change any game, run `node tools/build.js` before pushing. It updates `precache.js`,
which tells phones there is a new version to download.

## 2. Build a real Android / iOS app (Capacitor)

You need Node.js, plus Android Studio for Android or Xcode on a Mac for iOS.

```bash
npm install
```

```bash
npx cap add android
```

```bash
npm run android
```

`npm run android` copies the site into `www/`, syncs it into the native project and opens Android Studio,
where you can run it on a phone or build an APK / AAB for the Play Store. For iOS swap `android` for `ios`.

App id and name live in `capacitor.config.json`. The icons in `icons/` can be used as the store icon.

### Building a signed APK from the terminal

You need JDK 17 and the Android SDK, with `JAVA_HOME` and `ANDROID_HOME` pointing at them.
Put this in `android/keystore.properties` (git ignores it):

```
storeFile=/path/to/your-release.jks
passwordFile=/path/to/a-file-holding-the-keystore-password
keyAlias=your-key-alias
```

```bash
npm run apk
```

The APK lands in `android/app/build/outputs/apk/release/`. Keep using the same keystore: an APK signed with a
different key can't install over an old one without wiping the player's saves.
