// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Updated: Ensure this matches your Firebase project settings
const firebaseConfig = {
  apiKey: "AIzaSyCcU19CezeaWVKy_av4QHTBFNiPngIcRRA",
  authDomain: "showswatched2.firebaseapp.com",
  projectId: "showswatched2",
  storageBucket: "showswatched2.appspot.com", // <-- fixed domain
  messagingSenderId: "936739771540",
  appId: "1:936739771540:web:2fcfeee905ff3f6fdd9081",
  measurementId: "G-DLKLNE1VQL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);
const analytics = getAnalytics(app);

export { app, db, analytics };
