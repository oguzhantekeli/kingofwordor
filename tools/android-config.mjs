/**
 * Patches the generated Android project.
 *
 *   node tools/android-config.mjs
 *
 * `android/` is gitignored and CI recreates it with `npx cap add android`, so
 * anything hand-edited in there is lost on the next run. Everything that has to
 * be true of the native project is therefore applied here, idempotently, and
 * run straight after `cap sync`.
 *
 * What it fixes today
 * -------------------
 * The AdMob SDK installs a ContentProvider that runs before any of our code and
 * throws if no App ID is in the manifest. The app did not misbehave - it could
 * not start at all:
 *
 *   FATAL EXCEPTION: main
 *   java.lang.RuntimeException: Unable to get provider MobileAdsInitProvider:
 *   java.lang.IllegalStateException: * Missing application ID. *
 *
 * Until there is a real AdMob account, this writes Google's published sample
 * App ID, which is what their quick-start tells you to use while testing. Set
 * ADMOB_APP_ID to the real one for anything you intend to publish; a release
 * build still carrying the sample id is refused below.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Google's documented sample App ID. Serves test ads only. */
const SAMPLE_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const APP_ID = process.env.ADMOB_APP_ID ?? SAMPLE_APP_ID;

const MANIFEST = path.resolve('android/app/src/main/AndroidManifest.xml');

if (!fs.existsSync(MANIFEST)) {
  console.error(`  no android project at ${MANIFEST} - run "npx cap add android" first`);
  process.exit(1);
}

if (APP_ID === SAMPLE_APP_ID && process.env.KOW_RELEASE === '1') {
  console.error('  refusing to build a release with the AdMob sample App ID; set ADMOB_APP_ID');
  process.exit(1);
}

let xml = fs.readFileSync(MANIFEST, 'utf8');
let changed = false;

const META = `        <meta-data
            android:name="com.google.android.gms.ads.APPLICATION_ID"
            android:value="${APP_ID}" />`;

if (xml.includes('com.google.android.gms.ads.APPLICATION_ID')) {
  // keep the value in step with the environment without duplicating the tag
  const next = xml.replace(
    /(android:name="com\.google\.android\.gms\.ads\.APPLICATION_ID"\s*\n\s*android:value=")[^"]*(")/,
    `$1${APP_ID}$2`
  );
  if (next !== xml) { xml = next; changed = true; }
} else {
  xml = xml.replace(/(\n\s*<activity)/, `\n${META}\n$1`);
  changed = true;
}

if (changed) {
  fs.writeFileSync(MANIFEST, xml);
  console.log(`  AndroidManifest: AdMob APPLICATION_ID = ${APP_ID}` +
    (APP_ID === SAMPLE_APP_ID ? '  (Google sample id - test ads only)' : ''));
} else {
  console.log('  AndroidManifest: already correct');
}
