import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB4hmAv_fK9-KHbKU1SCtYoctC-l7n5RBQ",
  authDomain: "interview-helper-me.firebaseapp.com",
  projectId: "interview-helper-me",
  storageBucket: "interview-helper-me.firebasestorage.app",
  messagingSenderId: "428505644515",
  appId: "1:428505644515:web:63f6b40689fee0941bf4d6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
