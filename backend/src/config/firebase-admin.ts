import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../../firebase-applet-config.json';

const activeProjectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;

if (!getApps().length) {
  initializeApp({
    projectId: activeProjectId,
  });
}

export const adminAuth = getAuth();
