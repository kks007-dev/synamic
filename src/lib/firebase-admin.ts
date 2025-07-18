import * as admin from 'firebase-admin';

let app: admin.app.App;

if (!admin.apps.length) {
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountString) {
    try {
      const serviceAccount = JSON.parse(serviceAccountString);
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (e) {
      console.error('Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:', e);
      app = {} as admin.app.App;
    }
  } else {
    console.warn(
      'Firebase Admin not initialized. Service account key is missing in environment variables. Server-side Firebase features will not work.'
    );
    app = {} as admin.app.App;
  }
} else {
  app = admin.app();
}

// Export auth only if the app was successfully initialized.
export const auth = app.name ? admin.auth(app) : ({} as admin.auth.Auth);
