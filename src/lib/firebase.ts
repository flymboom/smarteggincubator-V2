import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCE7tNn6yBZB-_XybqMcRwoSuIek27eb7U",
  authDomain: "smarteggincubator-v2.firebaseapp.com",
  databaseURL: "https://smarteggincubator-v2-default-rtdb.asia-southeast1.firebasedatabase.app",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

export { app, db, auth };
