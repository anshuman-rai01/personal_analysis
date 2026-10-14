import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../../firebase-applet-config.json';

const configProjectId = (firebaseConfig as any)?.projectId;
const envProjectId = process.env.FIREBASE_PROJECT_ID;
const activeProjectId = envProjectId || configProjectId;

if (envProjectId && configProjectId && envProjectId !== configProjectId) {
  console.warn(
    `\n⚠️  [FIREBASE CONFIG WARNING]: FIREBASE_PROJECT_ID environment variable ("${envProjectId}") ` +
    `differs from firebase-applet-config.json projectId ("${configProjectId}"). ` +
    `A mismatch will cause every client ID token to fail verification!\n`
  );
}

console.log(`[Firebase Admin] Initialized with project ID: ${activeProjectId}`);

if (!getApps().length) {
  initializeApp({
    projectId: activeProjectId,
  });
}

export const adminAuth = getAuth();

