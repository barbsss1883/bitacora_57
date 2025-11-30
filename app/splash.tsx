import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import LottieView from "lottie-react-native";
import { useRouter } from "expo-router";

export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace("/login"), 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <LottieView
        source={require("../assets/animations/road-loop.json")}
        autoPlay
        loop={false}
        style={{ width: 300, height: 300 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1720", justifyContent: "center", alignItems: "center" }
});