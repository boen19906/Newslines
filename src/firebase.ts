// firebase.js
import { initializeApp } from "firebase/app";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD3IjWLSn6IfrVYVcJrVrmpGCL0FzjJ1zc",
  authDomain: "newslines-us.firebaseapp.com",
  projectId: "newslines-us",
  storageBucket: "newslines-us.firebasestorage.app",
  messagingSenderId: "774861711509",
  appId: "1:774861711509:web:bbf051d6b8dcd8b10c939c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the app so you can use it elsewhere
export default app;