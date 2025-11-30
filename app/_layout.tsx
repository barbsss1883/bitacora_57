import { Stack } from "expo-router";
import { useEffect } from "react";
import { initDatabase } from "../db/database";

export default function RootLayout() {
  useEffect(() => {
    initDatabase();
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}