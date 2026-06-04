/**
 * screens/maintenance/EditBillButton.jsx
 * React Native port of the web EditBillButton.
 *
 * Renders a compact "✏️ Edit" button on draft bill cards.
 * stopPropagation equivalent: onPress on a child does NOT bubble in RN,
 * so we just call onClick(bill) directly without needing e.stopPropagation().
 *
 * Props:
 *   onPress  — called with the bill object when tapped
 *   bill     — the bill object (passed back to onPress)
 */
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { C } from "../../constants/theme";

export const EditBillButton = ({ onPress, bill }) => (
  <TouchableOpacity
    onPress={() => onPress(bill)}
    activeOpacity={0.7}
    style={styles.btn}
    accessibilityLabel="Edit draft bill"
    accessibilityRole="button"
    // In RN, touch events don't bubble up through parent TouchableOpacity,
    // so no stopPropagation needed — the parent card press won't fire.
    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
  >
    <Text style={styles.label}>✏️  Edit</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  btn: {
    flexDirection:    "row",
    alignItems:       "center",
    backgroundColor:  C.amber + "18",
    borderWidth:      1.5,
    borderColor:      C.amber + "35",
    borderRadius:     8,
    paddingHorizontal:10,
    paddingVertical:  4,
    alignSelf:        "flex-start",
    marginTop:        4,
  },
  label: {
    fontSize:   11,
    fontWeight: "700",
    color:      C.amber,
  },
});