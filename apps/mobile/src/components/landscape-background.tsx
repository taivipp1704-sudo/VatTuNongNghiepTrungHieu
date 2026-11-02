import { Image } from "expo-image";
import { View } from "react-native";
import { theme } from "@/theme";

// Decorative artwork is bundled locally and is never used as a product photo.
export function LandscapeBackground() {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.primaryDark }}>
      <Image
        source={require("../../assets/images/agri-landscape-v1.png")}
        contentFit="cover"
        contentPosition="center"
        accessible={false}
        style={{ position: "absolute", inset: 0 }}
      />
      <View
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: theme.colors.landscapeScrim,
        }}
      />
    </View>
  );
}
