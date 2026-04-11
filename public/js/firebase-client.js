import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getFirestore, collection, getDocs, getDoc, doc, query, where, orderBy, limit }
  from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';
import { getStorage, ref, uploadBytes, getDownloadURL }
  from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js';

const firebaseConfig = {
  apiKey: "AIzaSyDJjf-7YX1RivFAPKEgTPfcX15NbCoj0yA",
  authDomain: "beauty-black-room.firebaseapp.com",
  projectId: "beauty-black-room",
  storageBucket: "beauty-black-room.firebasestorage.app",
  messagingSenderId: "626607401170",
  appId: "1:626607401170:web:593c7798c97b137e72a50b",
  measurementId: "G-WPF5KY4W35"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export { collection, getDocs, getDoc, doc, query, where, orderBy, limit,
         signInWithEmailAndPassword, signOut, onAuthStateChanged,
         ref, uploadBytes, getDownloadURL };
