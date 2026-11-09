[![OpenRepos](https://img.shields.io/endpoint?url=https://openrepos.org/status/awesome-project.openrepos.org.json&style=flat-square)](https://awesome-project.openrepos.org/)

# FinClass — Firebase Spark + GitHub Pages

This version does not use Cloud Functions. GitHub Pages hosts the static website; Firebase Authentication and Cloud Firestore provide login and shared classroom data.

## Important architecture and security
- Teacher and student roles are Firebase custom claims assigned only with the Firebase Admin SDK from a trusted computer.
- Students can read class data but cannot write student records, XP, announcements, or activity history.
- The teacher can award XP and publish announcements directly from the browser; Firestore Security Rules validate the teacher's role and class.
- Student Authentication accounts must be created separately in Firebase Console. Then assign each account its student custom claim with the included local script.
- Removing a student from the roster does not delete their Authentication account. Delete that account separately in Firebase Console if needed.
- Never put service-account JSON files in this repository or website folder.

## 1. Firebase Console setup
1. Enable Email/Password in Authentication.
2. Create Cloud Firestore.
3. Register a Firebase Web App and copy its config into `index.html`.
4. In `index.html`, make sure `CLASS_ID` matches the class ID used in the teacher setup script. Default: `grade12-section-a`.

## 2. Install tools locally
Install Node.js LTS, then in PowerShell:
```powershell
npm install -g firebase-tools
firebase login
```
Open PowerShell in this project folder.

## 3. Connect the project
Edit `.firebaserc` and replace `REPLACE_WITH_PROJECT_ID` with your actual Firebase Project ID. Then:
```powershell
firebase projects:list
```
If necessary, select the correct project:
```powershell
firebase use --add
```

## 4. Deploy Firestore Security Rules (Spark-compatible)
```powershell
firebase deploy --only firestore:rules
```
This package's `firebase.json` does not configure Cloud Functions. Do not run a Functions deployment for this Spark version.

## 5. Create the first teacher account
1. Firebase Console → Authentication → Users → Add user. Create the teacher email/password.
2. Create a service-account credential from Firebase Console → Project settings → Service accounts. Store it OUTSIDE this project folder and never upload it to GitHub.
3. Set `GOOGLE_APPLICATION_CREDENTIALS` in PowerShell to that file's full path:
   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\secure\finclass-admin-key.json"
   ```
4. Install Admin SDK locally in the project folder:
   ```powershell
   npm install firebase-admin
   ```
5. Assign the teacher role and create the class document:
   ```powershell
   node scripts/set-teacher-role.cjs teacher@example.com grade12-section-a "Grade 12 - Section A"
   ```
6. Sign out and sign back in to refresh the teacher's custom claims.

## 6. Create student accounts
For each student:
1. Firebase Console → Authentication → Users → Add user. Create the student's email/password account (or use the console's password reset flow).
2. Copy the student's email.
3. In PowerShell, with the Admin SDK credentials configured, run:
   ```powershell
   node scripts/set-student-role.cjs student@example.com grade12-section-a
   ```
4. Ask the student to sign out and sign in again.
5. In the FinClass teacher dashboard, choose **Add student**. Paste the student's Firebase Authentication UID and enter their name/avatar. Find the UID in Authentication → Users.

## 7. Publish on GitHub Pages
1. Upload the contents of this folder to your GitHub repository root; `index.html` must be at the root.
2. Repository Settings → Pages → Deploy from a branch → `main` → `/(root)` → Save.
3. Firebase Console → Authentication → Settings → Authorized domains. Add `YOUR-USERNAME.github.io` (hostname only).
4. Open `https://YOUR-USERNAME.github.io/finclass/`.

## 8. Test
- Sign in as the teacher and add one test student.
- Sign in as the student in another browser/private window.
- Award XP as teacher and verify that the student's fish and history update.
- Try no student-side write actions; students should only have read access.

## Notes
- Spark has usage limits. Check the Firebase pricing page for current quotas.
- Firestore rules are the security boundary. Do not loosen them to fix permission errors without reviewing the effect.
- Firebase web config is public client configuration, not an Admin credential.
