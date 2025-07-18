import * as admin from 'firebase-admin';

let app: admin.app.App;

function initializeAdminApp() {
  if (admin.apps.length > 0) {
    app = admin.app();
    return;
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : undefined;

  if (serviceAccount) {
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // If no service account, we can't initialize.
    // We will log a warning. Subsequent calls to auth will fail,
    // which is expected if the service account is not configured.
    console.warn(
      'Firebase Admin an initialised. Service account key is missing.'
    );
  }
}

// Ensure the app is initialized before we export auth
initializeAdminApp();

// Now it's safe to export auth
export const auth = admin.auth();
