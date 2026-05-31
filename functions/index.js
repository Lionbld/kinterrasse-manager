const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * Cloud Function: createStaffUser
 * Creates a Firebase Auth user server-side using Admin SDK.
 * Only callable by authenticated admins (role === 'admin').
 */
exports.createStaffUser = onCall({ region: 'europe-west1' }, async (request) => {
  // Must be authenticated
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Vous devez être connecté pour créer un compte staff.');
  }

  const { email, pin } = request.data;

  if (!email || !pin || pin.length < 6) {
    throw new HttpsError('invalid-argument', 'Email et PIN (min 6 chiffres) requis.');
  }

  // Verify the caller is an admin by checking their Firestore user document
  const callerDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
  if (!callerDoc.exists) {
    throw new HttpsError('permission-denied', 'Utilisateur non trouvé.');
  }
  const callerRole = callerDoc.data().role;
  if (callerRole !== 'admin') {
    throw new HttpsError('permission-denied', 'Seuls les admins peuvent créer des comptes staff.');
  }

  try {
    const userRecord = await admin.auth().createUser({
      email: email,
      password: pin,
      emailVerified: false,
    });
    return { uid: userRecord.uid };
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Cet identifiant est déjà utilisé.');
    }
    throw new HttpsError('internal', `Erreur création compte: ${error.message}`);
  }
});
