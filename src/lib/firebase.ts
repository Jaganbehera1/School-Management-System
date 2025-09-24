// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBVXMkhAUz4h5fpCZXnPiU6U0i_Dx4_IPo",
  authDomain: "school-management-system-3feb9.firebaseapp.com",
  projectId: "school-management-system-3feb9",
  storageBucket: "school-management-system-3feb9.firebasestorage.app",
  messagingSenderId: "920746102471",
  appId: "1:920746102471:web:aa6f2cf8a41c3fa3e438e2",
  measurementId: "G-J6D38QGF40"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;