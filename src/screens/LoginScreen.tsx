import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/theme';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/Icon';
import { ScalePressable, FadeInView } from '../components/animated';
import { ScreenHeader, AppInput, AppButton } from '../components/common';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from '../components/keyboard';

import type { User } from '../types/auth';

export interface LoginScreenProps {
  onBack?: () => void;
  onNavigateToRegister?: () => void;
  onLoginSuccess?: (user?: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onBack,
  onNavigateToRegister,
  onLoginSuccess,
}) => {
  const theme = useAppTheme();
  const { login } = useAuth();

  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [serverError, setServerError] = useState<{
    message: string;
    status?: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');
    setServerError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setEmailError('Please enter your email address.');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError('Please enter a valid email address.');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Please enter your password.');
      isValid = false;
    }

    return isValid;
  };

  const handleLogin = useCallback(async () => {
    if (loading) return;
    if (!validate()) return;

    setLoading(true);
    setServerError(null);

    try {
      const result = await login({
        email: email.trim(),
        password,
      });

      if (result.success && result.user) {
        onLoginSuccess?.(result.user);
      } else {
        setServerError({
          message: result.message || 'Login failed. Please check credentials.',
          status: result.status,
        });
      }
    } catch {
      setServerError({
        message: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [email, password, loading, login, onLoginSuccess]);

  const fillDemoCustomer = () => {
    setEmail('sujal@gmail.com');
    setPassword('123456');
    setEmailError('');
    setPasswordError('');
    setServerError(null);
  };

  const fillDemoAdmin = () => {
    setEmail('sujal@test.com');
    setPassword('123456');
    setEmailError('');
    setPasswordError('');
    setServerError(null);
  };

  const fillDemoAccount = fillDemoCustomer;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Navigation Bar */}
        <ScreenHeader
          title="Sign In"
          onBack={onBack}
          backIcon="close"
        />

        <KeyboardAwareScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          extraScrollHeight={100}
        >
          {/* Header & Logo */}
          <View style={styles.brandContainer}>
            <Image
              source={require('../assets/logos/logo-icon.png')}
              style={styles.logoIcon}
              resizeMode="contain"
            />
            <Text style={[styles.brandTitle, { color: theme.colors.text }]}>
              Shop<Text style={{ color: theme.colors.accent }}>Easy</Text>
            </Text>
            <Text style={[styles.brandSubtitle, { color: theme.colors.textSecondary }]}>
              Sign in to access your orders and manage your account
            </Text>
          </View>

          {/* Server Error / Status Banner */}
          {serverError && (
            <View
              accessibilityRole="alert"
              style={[
                styles.alertBanner,
                {
                  backgroundColor:
                    serverError.status === 'PENDING'
                      ? theme.isDark
                        ? '#1E3A8A'
                        : '#EFF6FF'
                      : theme.colors.dangerBg,
                  borderColor:
                    serverError.status === 'PENDING'
                      ? '#3B82F6'
                      : theme.colors.danger,
                },
              ]}
            >
              <View style={{ marginRight: 8, marginTop: 2 }}>
                {serverError.status === 'PENDING' ? (
                  <Icon name="info" size={18} color="#3B82F6" />
                ) : (
                  <Icon name="alert-triangle" size={18} color={theme.colors.danger} />
                )}
              </View>
              <View style={styles.alertTextContainer}>
                {serverError.status === 'PENDING' && (
                  <Text style={[styles.alertHeader, { color: '#3B82F6' }]}>
                    Approval Pending
                  </Text>
                )}
                <Text
                  style={[
                    styles.alertMessage,
                    {
                      color:
                        serverError.status === 'PENDING'
                          ? theme.isDark
                            ? '#93C5FD'
                            : '#1D4ED8'
                          : theme.colors.danger,
                    },
                  ]}
                >
                  {serverError.message}
                </Text>
              </View>
            </View>
          )}

          {/* Form Card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            {/* Email Field */}
            <AppInput
              label="Email Address"
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (emailError) setEmailError('');
              }}
              onFocus={() => scrollRef.current?.scrollToInput(80)}
              editable={!loading}
              error={emailError}
            />

            {/* Password Field */}
            <AppInput
              label="Password"
              placeholder="Enter your password"
              isPassword
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (passwordError) setPasswordError('');
              }}
              onFocus={() => scrollRef.current?.scrollToInput(160)}
              editable={!loading}
              error={passwordError}
            />

            {/* Sign In Button */}
            <AppButton
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              accessibilityLabel="Sign In"
              style={styles.submitButton}
            />

            {/* Demo Accounts Quick Fill Options */}
            <View style={styles.demoSection}>
              {/* Demo Customer Account */}
              <ScalePressable
                testID="autofill-demo-customer-button"
                accessibilityRole="button"
                accessibilityLabel="Autofill Demo Customer"
                style={[
                  styles.demoButton,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surfaceSubtle,
                  },
                ]}
                activeScale={0.96}
                onPress={fillDemoCustomer}
                disabled={loading}
              >
                <Text
                  style={[styles.demoButtonText, { color: theme.colors.text }]}
                  numberOfLines={1}
                >
                  ⚡ Autofill Demo Customer (sujal@gmail.com)
                </Text>
              </ScalePressable>

              {/* Demo Admin Account */}
              <ScalePressable
                testID="autofill-demo-admin-button"
                accessibilityRole="button"
                accessibilityLabel="Autofill Demo Admin"
                style={[
                  styles.demoButton,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surfaceSubtle,
                    marginTop: 8,
                  },
                ]}
                activeScale={0.96}
                onPress={fillDemoAdmin}
                disabled={loading}
              >
                <Text
                  style={[styles.demoButtonText, { color: theme.colors.text }]}
                  numberOfLines={1}
                >
                  🛡️ Autofill Demo Admin (sujal@test.com)
                </Text>
              </ScalePressable>
            </View>
          </View>

          {/* Switch to Register */}
          <View style={styles.footerContainer}>
            <Text
              style={[
                styles.footerPrompt,
                { color: theme.colors.textSecondary },
              ]}
            >
              Don't have an account?{' '}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create account"
              onPress={onNavigateToRegister}
              disabled={loading}
            >
              <Text style={[styles.footerLink, { color: theme.colors.accent }]}>
                Sign Up
              </Text>
            </Pressable>
          </View>
        </KeyboardAwareScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  navBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  navPlaceholder: {
    width: 36,
  },
  scrollContent: {
    padding: 20,
    alignItems: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginVertical: 18,
  },
  logoIcon: {
    width: 48,
    height: 48,
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  alertBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  alertIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  alertTextContainer: {
    flex: 1,
  },
  alertHeader: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  alertMessage: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  passwordContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 46,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: {
    fontSize: 18,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  submitButton: {
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  demoSection: {
    marginTop: 14,
  },
  demoButton: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  demoButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  demoButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  footerPrompt: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
