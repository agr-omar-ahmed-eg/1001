import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Provider setup
export const provider = new GoogleAuthProvider();
// Add required Google Workspace scopes
provider.addScope('https://www.googleapis.com/auth/forms.body');
provider.addScope('https://www.googleapis.com/auth/drive.file');

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;

// Cache the access token in memory and local storage for persistence across reloads/redirects.
let cachedAccessToken: string | null = localStorage.getItem('google_access_token');

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // First, check if we have a redirect result from a redirect sign-in flow
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          localStorage.setItem('google_access_token', cachedAccessToken);
          if (onAuthSuccess) {
            onAuthSuccess(result.user, cachedAccessToken);
          }
        }
      }
    })
    .catch((error) => {
      console.error('Redirect sign in error:', error);
    });

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const savedToken = localStorage.getItem('google_access_token') || cachedAccessToken;
      if (savedToken) {
        cachedAccessToken = savedToken;
        if (onAuthSuccess) onAuthSuccess(user, savedToken);
      } else {
        // Give getRedirectResult a moment to resolve in case of active redirect landing
        setTimeout(() => {
          const recheckedToken = localStorage.getItem('google_access_token') || cachedAccessToken;
          if (recheckedToken) {
            if (onAuthSuccess) onAuthSuccess(user, recheckedToken);
          } else {
            if (onAuthFailure) onAuthFailure();
          }
        }, 1500);
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem('google_access_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction (Popup version)
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('فشل الحصول على رمز الوصول من حساب Google.');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem('google_access_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Redirect version of sign-in
export const googleSignInRedirect = async (): Promise<void> => {
  try {
    isSigningIn = true;
    await signInWithRedirect(auth, provider);
  } catch (error: any) {
    console.error('Redirect sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken || localStorage.getItem('google_access_token');
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem('google_access_token');
};

