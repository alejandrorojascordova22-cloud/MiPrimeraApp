import { useColorScheme } from "react-native";
import { ColoresApp } from "@/constants/coloresApp";

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: "text" | "background"
) {
  const theme = (useColorScheme() ?? "light") as "light" | "dark";
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  }
  return colorName === "text" ? ColoresApp.texto : ColoresApp.fondo;
}
