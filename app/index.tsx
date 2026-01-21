import { Redirect } from 'expo-router';

export default function Index() {
  // Redirige automáticamente a tu pantalla "home"
  return <Redirect href="/home" />;
}
