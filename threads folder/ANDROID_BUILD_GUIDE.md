# THREADS Android APK Build Guide 📱

This project is fully structured to compile into an Android APK (`.apk`) file with complete offline storage, full hardware acceleration, file upload support, and real-time Cloud Firestore sync.

---

## 🚀 Method 1: Instant 1-Click Cloud Build with GitHub Actions (Recommended)

You don't need Android Studio or Java installed on your computer:

1. Push your repository to **GitHub**.
2. Go to the **Actions** tab in your GitHub repository.
3. Click on the **"Build Android APK"** workflow and click **"Run workflow"** (or simply push code to `main`/`master`).
4. Once completed (~2 minutes), download `threads-factory-app.apk` directly from the **Artifacts** section at the bottom of the run page!

---

## 🛠️ Method 2: Build with Android Studio

If you have Android Studio installed on your computer:

1. Build the web production assets:
   ```bash
   npm run build:android
   ```
2. Open **Android Studio**.
3. Select **File -> Open...** and choose the `android/` folder inside this project directory.
4. Wait for Gradle sync to finish.
5. In the top menu, click **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**.
6. Android Studio will generate the APK at:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

---

## 💻 Method 3: Command-Line Build with Gradle

If you have JDK 17 and Android SDK installed on your system:

1. Bundle the web app into Android assets:
   ```bash
   npm run build:android
   ```
2. Build the APK using Gradle:
   - **Windows (PowerShell/CMD):**
     ```cmd
     cd android
     gradlew assembleDebug
     ```
   - **Linux / macOS:**
     ```bash
     cd android
     ./gradlew assembleDebug
     ```
3. Locate your compiled APK:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

---

## 🌐 Method 4: Instant Online APK Generator with PWABuilder

Since THREADS includes a full Progressive Web App configuration (`manifest.json` + Service Worker):

1. Deploy your web app (e.g. Vercel, Netlify, Render, or Firebase Hosting).
2. Go to [https://www.pwabuilder.com/](https://www.pwabuilder.com/).
3. Enter your deployed URL and click **Start**.
4. Click **Package for Android** -> **Generate APK / AAB**.
5. Download your ready-to-install `.apk` package!

---

## ⚙️ App Configuration Details

- **Application ID / Package**: `com.pinkharmony.threads`
- **Application Name**: `THREADS`
- **Minimum Android Version**: Android 7.0 (API Level 24)
- **Target Android Version**: Android 14+ (API Level 34)
- **Permissions**: Internet, Network State, Media/Storage (for CSV uploads)
- **Features**: Hardware Acceleration, Offline Storage Persistence, Native File Chooser, Multi-Device Firestore Sync.
