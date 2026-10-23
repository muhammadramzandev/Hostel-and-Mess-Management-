# HostelPro — Secure Multi-Hostel Management

This package is flattened: all HTML, JavaScript, CSS, Firebase configuration, and rules files are in this one folder. No `js/` or `css/` subfolders are required.

## Included panels
- `index.html`: sign in and public registration (warden, accountant, mess manager, student, parent).
- `admin-dashboard.html`, `warden-dashboard.html`, `accountant-dashboard.html`, `mess-manager-dashboard.html`, `student-dashboard.html`, `parent-dashboard.html`.
- `auth.js`, `firebase.js`, `firebase-config.js`, `tenant-security.js`, dashboard scripts, `styles.css`.
- `firestore.rules`, `firebase.json`, `firestore.indexes.json`.

## Security model
- Public registration does **not** offer an Admin role. No browser client is allowed to create a hostel or an admin profile.
- The system owner provisions each admin manually in Firebase Console (Authentication user + matching Firestore documents), or through a trusted Admin SDK backend. Never share admin credentials.
- Every public account must supply an existing active Hostel ID. Staff registration additionally requires an invitation bound to the same email and role. New public profiles are `pending` until approved by the hostel admin.
- Data is tenant-scoped under `hostels/{hostelId}/...`. Rules must be tested against the real Firebase project before production use.

## Firebase setup
1. Create/register a Firebase Web App and enable Email/Password in Authentication.
2. Create Firestore.
3. Put the Firebase web app configuration into `firebase-config.js`.
4. Deploy `firestore.rules` and `firestore.indexes.json` using Firebase CLI from this folder.
5. Host the folder on Firebase Hosting or another HTTPS static host. Do not open `index.html` using `file://`.
6. Create an admin account in Firebase Authentication, then create matching documents in Firestore: `users/{AUTH_UID}`, `hostels/{HOSTEL_ID}`, and `hostels/{HOSTEL_ID}/users/{AUTH_UID}`. Set matching UID/hostel ID, `role: "admin"`, `status: "active"`, `ownerUid` on the hostel, and the same hostel name/ID across documents. Console changes are privileged; protect access to the Firebase project.

## Important
The app is a client-side starter. The Firebase web configuration is public by design; Firestore Rules are the security boundary. Before storing real student or payment data, test cross-hostel isolation, invitation use, approvals, and each role in the Firebase Emulator Suite. Existing Authentication users with no Firestore profile need manual profile repair; publishing rules does not create missing profiles.
