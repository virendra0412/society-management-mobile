/**
 * src/screens/sa/SALoginScreen.jsx
 * Super Admin login screen — separate from regular user login
 * React Native / Expo version
 */

import React, { useState } from "react";
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Text,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSAAuth } from "../../context/SAAuthContext";
import { COLORS, SPACING } from "../../constants/theme";

const SALoginScreen = () => {
  const { login, loading } = useSAAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Invalid email format";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await login({ email: email.trim(), password });
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        "Login failed. Please try again.";
      Alert.alert("Login Error", message);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Super Admin</Text>
            <Text style={styles.subtitle}>Platform Management Portal</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.email && styles.inputError,
                ]}
                placeholder="admin@example.com"
                placeholderTextColor={COLORS.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors({ ...errors, email: "" });
                }}
              />
              {errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.password && styles.inputError,
                ]}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.placeholder}
                secureTextEntry
                editable={!isLoading}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password)
                    setErrors({ ...errors, password: "" });
                }}
              />
              {errors.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.loginButton,
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Super Admin Access</Text>
            <Text style={styles.infoText}>
              This portal is for platform administrators only. If you don't have
              access credentials, please contact support.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  header: {
    marginBottom: SPACING.xxl,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  form: {
    marginBottom: SPACING.xl,
  },
  fieldContainer: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  inputError: {
    borderColor: COLORS.error,
    backgroundColor: "rgba(220, 53, 69, 0.05)",
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: SPACING.xs,
    fontWeight: "500",
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: SPACING.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xl,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  infoBox: {
    backgroundColor: "rgba(23, 162, 184, 0.1)",
    borderLeftWidth: 4,
    borderLeftColor: COLORS.info,
    borderRadius: 6,
    padding: SPACING.md,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});

export default SALoginScreen;
