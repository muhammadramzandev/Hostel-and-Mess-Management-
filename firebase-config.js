// Add your Firebase Web App configuration here.
// This file intentionally leaves credentials blank for your own Firebase project.
// Firebase web config is not a server secret; secure data with Authentication and Firestore Rules.
export const firebaseConfig = {
  apiKey: "AIzaSyD32PiCYM--tt27soguMTWbWEI8TdwPWRU",
  authDomain: "hostelpro-eb9ea.firebaseapp.com",
  projectId: "hostelpro-eb9ea",
  appId: "1:631259206007:web:ff2d206c1111f098c6d172",
  messagingSenderId: "631259206007",
  storageBucket: "hostelpro-eb9ea.firebasestorage.app"
};
export const FIREBASE_SDK_VERSION = "10.14.1";
export const isFirebaseConfigured = () =>
  Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);
export const CONFIGURED = isFirebaseConfigured();
