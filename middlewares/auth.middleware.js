import admin from "firebase-admin";

export const verifyFirebaseToken = async (req, res, next) => {
  // Read Authorization header from common locations
  const rawAuth = req.headers.authorization || req.get && req.get('authorization') || req.headers['x-access-token'] || '';

  if (!rawAuth) {
    console.warn('No Authorization header present');
    return res.status(401).json({ error: 'No authorization header provided' });
  }

  // Accept formats like: "Bearer <token>" (case-insensitive) or just the token
  const bearerMatch = rawAuth.match(/Bearer\s+(.+)/i);
  let idToken = bearerMatch ? bearerMatch[1].trim() : rawAuth.trim();

  // Remove any surrounding quotes
  idToken = idToken.replace(/^"|"$/g, '').replace(/^'|'$/g, '');

  // Quick validation: JWT-like tokens have 3 dot-separated parts
  const segments = idToken ? idToken.split('.') : [];
  if (!idToken || segments.length !== 3) {
    console.error('Invalid ID token format. headerPreview=', rawAuth.slice(0, 30), 'tokenLen=', idToken ? idToken.length : 0, 'segments=', segments.length);
    return res.status(401).json({ error: 'Invalid ID token format' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.firebaseUid = decodedToken.uid;
    return next();
  } catch (error) {
    // Log helpful diagnostics without printing the full token
    console.error('Token verification error:', {
      message: error?.message,
      code: error?.code,
      tokenPreview: idToken ? `${idToken.slice(0, 8)}...${idToken.slice(-8)}` : null,
      tokenLen: idToken ? idToken.length : 0,
    });
    return res.status(401).json({ error: 'Invalid or expired ID token', details: error?.message });
  }
};