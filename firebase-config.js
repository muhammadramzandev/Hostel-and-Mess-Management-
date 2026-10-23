// Add your Firebase Web App configuration here.
// This file intentionally leaves credentials blank for your own Firebase project.
// Firebase web config is not a server secret; secure data with Authentication and Firestore Rules.
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: "",
  messagingSenderId: "",
  storageBucket: ""
};
export const FIREBASE_SDK_VERSION = "10.14.1";
export const isFirebaseConfigured = () =>
  Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
export const CONFIGURED = isFirebaseConfigured();
