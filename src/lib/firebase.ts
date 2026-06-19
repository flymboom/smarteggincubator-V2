import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB31u_oDgwW7fNTq0VvU0PXIEXhdfZpcbg",
  authDomain: "smart-egg-incubator-e011f.firebaseapp.com",
  databaseURL: "https://smart-egg-incubator-e011f-default-rtdb.asia-southeast1.firebasedatabase.app",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

export { app, db, auth };
