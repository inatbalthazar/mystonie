# Mystonie for Android (Google Play)

The Android app is a **Trusted Web Activity**: a small app that opens https://mystonie.com full screen in Chrome ([ADR 0097](../docs/decisions/0097-android-app-twa.md)). Site changes reach the app with every deploy. A new app version is only needed when `twa-manifest.json` changes (icon, name, colours).

- Package: `com.mystonie.app` (can never change once published)
- Source of the project: `twa-manifest.json`. [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) generates the Gradle project from it.
- Store listing text and pictures: [`brand/play-store/`](../brand/play-store/README.md)

**Never commit** `android.keystore` or its passwords (`.gitignore` blocks `*.keystore`, `*.aab` and `*.apk`). Keep the keystore and both passwords in a password manager and a backup. Play App Signing can reset a lost upload key, but only through Play support.

## 1. Tools (once)

Bubblewrap needs JDK 17 and the Android SDK. On its first run it offers to download both (about 1 GB) into `~/.bubblewrap`:

```
cd android
npx @bubblewrap/cli doctor
```

## 2. The signing key (once, by the owner)

```
keytool -genkeypair -v -keystore android.keystore -alias mystonie -keyalg RSA -keysize 2048 -validity 10000
```

It asks for a password and your name. Use the JDK from step 1; the old Java 8 `keytool` also works.

## 3. Build

```
cd android
npx @bubblewrap/cli update      # generates the Android project from twa-manifest.json
npx @bubblewrap/cli build       # asks for the two passwords
```

It makes:
- `app-release-bundle.aab`: the file you upload to Play;
- `app-release-signed.apk`: for trying on a phone with `adb install`.

For each later release, raise `appVersionCode` (and `appVersionName`) in `twa-manifest.json` first.

## 4. Full screen: Digital Asset Links

Until Chrome trusts the app, it shows an address bar at the top.

1. Print the upload key's fingerprint:
   ```
   keytool -list -v -keystore android.keystore -alias mystonie
   ```
   Copy the `SHA256:` line, for example `AB:CD:…`.
2. After the first upload, Play Console shows Play's own signing key under **Test and release → App integrity → App signing**. Copy its **SHA-256 certificate fingerprint**.
3. In Vercel → Settings → Environment Variables → `ANDROID_CERT_SHA256` = both fingerprints, comma separated. This isn't a secret. Then redeploy.
4. Check https://mystonie.com/.well-known/assetlinks.json lists them, and test it with Google's tester:
   `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://mystonie.com&relation=delegate_permission/common.handle_all_urls`

## 5. Google Play Console (by the owner)

1. **Developer account** at https://play.google.com/console: a one-time US$25 fee, and identity verification.
2. **Create app:**
   - name Mystonie;
   - default language English (en-US);
   - App, Free.
3. **Store listing:** everything in `brand/play-store/` (its README has where each file goes).
4. **App content** (Policy → App content):
   - **Privacy policy:** `https://mystonie.com/privacy`.
   - **Ads:** No.
   - **App access:** "All or some functionality is restricted". Explain that anyone can create an account with Google or an emailed code; no special credentials needed. Or give the reviewers a test Google account you make for them.
   - **Account deletion:** in the app, Settings → Delete account. For the web link, use `https://mystonie.com/privacy` (it says how to delete an account).
   - **Content rating:**
     - users interact (follow, Stamps);
     - users share content (reviews, Journal articles, cards);
     - no violence, gambling or purchases.
   - **Target audience:** 13+ (pick the age groups you're comfortable with; under 13 brings the Families policy).
   - **Data safety** (from `/privacy`; check it matches before you submit):
     - **Collected:** email address, name, user ID (account); photos (a profile photo you upload); app activity (what you log, reviews, articles); app interactions (cookieless analytics, PostHog); crash logs (Sentry); device or other IDs (the push address).
     - **Not collected:** location, contacts, financial info.
     - **Not shared** with third parties for advertising.
     - **Encrypted in transit:** yes.
     - **Users can delete their data:** yes.
5. **Testing first.** Upload `app-release-bundle.aab` to **Internal testing** and try it on your phone. Then:
   - **New personal accounts:** Google asks for a **closed test with at least 12 testers, opted in for 14 days in a row**, before you can apply for production. Check the current rule in Play Console's dashboard.
   - **Organization accounts:** they don't need this.
6. **Production:** promote the release. The first review takes from a few days to a week or more.

## Check on a real phone
- It opens full screen with no address bar (step 4 done).
- Google sign-in and the emailed code work.
- Settings → Notifications switches on, and Android asks for permission.
- Share and Download on a card work.
- Offline, the collection still opens.
- There's no Buy Me a Coffee link (ADR 0097).
