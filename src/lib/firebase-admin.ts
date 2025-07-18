import * as admin from 'firebase-admin';

let app: admin.app.App;

if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : undefined;

  if (serviceAccount) {
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    console.warn(
      'Firebase Admin not initialized. Service account key is missing in environment variables. Server-side Firebase features will not work.'
    );
    // In a non-initialized state, we can't export auth.
    // We'll create a dummy object to avoid crashing on import,
    // though any function call will fail.
    app = {} as admin.app.App; 
  }
} else {
  app = admin.app();
}

// Export auth only if the app was successfully initialized.
export const auth = app.name ? admin.auth(app) : ({} as admin.auth.Auth);
