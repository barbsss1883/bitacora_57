import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyDdA_weQOkZ3LMAnehdAHUWi8moqHZEHns",
  authDomain: "device-streaming-61499c4a.firebaseapp.com",
  databaseURL: "https://device-streaming-61499c4a-default-rtdb.firebaseio.com",
  projectId: "device-streaming-61499c4a",
  storageBucket: "device-streaming-61499c4a.firebasestorage.app",
  messagingSenderId: "363075260432",
  appId: "1:363075260432:web:d4028409282f0baedbba95",
  measurementId: "G-CYK90M6589"
};

const app = initializeApp(firebaseConfig);

export const db_firestore = getFirestore(app);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

export const storage = getStorage(app);
export const cloudFunctions = getFunctions(app, 'us-central1');
