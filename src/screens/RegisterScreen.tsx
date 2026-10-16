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

export interface RegisterScreenProps {
  onBack?: () => void;
  onNavigateToLogin?: () => void;
  onGoHome?: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onBack,
  onNavigateToLogin,
  onGoHome,
}) => {
  const theme = useAppTheme();
  const { register } = useAuth();
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState<{
    name: string;
    email: string;
    message: string;
  } | null>(null);

  const validate = (): boolean => {
    let isValid = true;
    setNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setServerError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setNameError('Please enter your full name.');
      isValid = false;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setEmailError('Please enter your email address.');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError('Please enter a valid email address.');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Please enter a password.');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      isValid = false;
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password.');
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      isValid = false;
    }

    return isValid;
  };

  const handleRegister = useCallback(async () => {
    if (loading) return;
    if (!validate()) return;

    setLoading(true);
    setServerError(null);

    try {
      const result = await register({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      if (result.success) {
        setRegisteredSuccess({
          name: name.trim(),
          email: email.trim(),
          message:
            result.message ||
            'Your account registration has been submitted and is waiting for administrator approval.',
        });
      } else {
        setServerError(
          result.message || 'Registration failed. Please check your details.'
        );
      }
    } catch {
      setServerError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [name, email, password, confirmPassword, loading, register]);

  // If successfully registered, show the Approval Pending Success View
  if (registeredSuccess) {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <ScrollView contentContainerStyle={styles.successScroll}>
          <View
            style={[
              styles.successCard,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.successIconBadge,
                { backgroundColor: theme.isDark ? '#064E3B' : '#E6F9F2' },
              ]}
            >
              <Icon name="check-circle" size={40} color={theme.colors.success} strokeWidth={2.5} />
            </View>

            <Text style={[styles.successTitle, { color: theme.colors.text }]}>
              Registration Submitted!
            </Text>

            <Text
              style={[
                styles.successMessage,
                { color: theme.colors.textSecondary },
              ]}
            >
              {registeredSuccess.message}
            </Text>

            <View
              style={[
                styles.accountSummaryBox,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.borderLight,
                },
              ]}
            >
              <Text style={[styles.summaryLabel, { color: theme.colors.textMuted }]}>
                Account Details:
              </Text>
              <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                Name: {registeredSuccess.name}
              </Text>
              <Text style={[styles.summaryValue, { color: theme.colors.text }]}>
                Email: {registeredSuccess.email}
              </Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>STATUS: PENDING APPROVAL</Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Proceed to Login"
              style={[
                styles.actionButton,
                { backgroundColor: theme.colors.primary },
              ]}
              onPress={onNavigateToLogin}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  { color: theme.colors.primaryText },
                ]}
              >
                Go to Sign In
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Return to store home"
              style={[
                styles.secondaryButton,
                { borderColor: theme.colors.border },
              ]}
              onPress={onGoHome}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: theme.colors.text },
                ]}
              >
                Continue Browsing
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
          title="Create Account"
          onBack={onBack}
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
              Join Shop<Text style={{ color: theme.colors.accent }}>Easy</Text>
            </Text>
            <Text
              style={[
                styles.brandSubtitle,
                { color: theme.colors.textSecondary },
              ]}
            >
              Create your account to unlock exclusive offers and tracking
            </Text>
          </View>

          {/* Server Error Banner */}
          {serverError && (
            <View
              style={[
                styles.alertBanner,
                {
                  backgroundColor: theme.colors.dangerBg,
                  borderColor: theme.colors.danger,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                },
              ]}
            >
              <Icon name="alert-triangle" size={18} color={theme.colors.danger} />
              <Text
                style={[styles.alertMessage, { color: theme.colors.danger, flex: 1 }]}
              >
                {serverError}
              </Text>
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
            {/* Full Name Field */}
            <AppInput
              label="Full Name"
              placeholder="Enter your name"
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (nameError) setNameError('');
              }}
              onFocus={() => scrollRef.current?.scrollToInput(60)}
              editable={!loading}
              error={nameError}
            />

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
              onFocus={() => scrollRef.current?.scrollToInput(120)}
              editable={!loading}
              error={emailError}
            />

            {/* Password Field */}
            <AppInput
              label="Password (min 6 characters)"
              placeholder="Create a password"
              isPassword
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (passwordError) setPasswordError('');
              }}
              onFocus={() => scrollRef.current?.scrollToInput(200)}
              editable={!loading}
              error={passwordError}
            />

            {/* Confirm Password Field */}
            <AppInput
              label="Confirm Password"
              placeholder="Confirm your password"
              isPassword
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                if (confirmPasswordError) setConfirmPasswordError('');
              }}
              onFocus={() => scrollRef.current?.scrollToInput(280)}
              editable={!loading}
              error={confirmPasswordError}
            />

            {/* Register Submit Button */}
            <AppButton
              title="Create Account"
              onPress={handleRegister}
              loading={loading}
              disabled={loading}
              accessibilityLabel="Create Account"
              style={styles.submitButton}
            />
          </View>

          {/* Switch to Login */}
          <View style={styles.footerContainer}>
            <Text
              style={[
                styles.footerPrompt,
                { color: theme.colors.textSecondary },
              ]}
            >
              Already have an account?{' '}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              onPress={onNavigateToLogin}
              disabled={loading}
            >
              <Text style={[styles.footerLink, { color: theme.colors.accent }]}>
                Sign In
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
    fontSize: 18,
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
    marginVertical: 14,
  },
  logoIcon: {
    width: 44,
    height: 44,
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 24,
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
  alertMessage: {
    flex: 1,
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
    marginBottom: 14,
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
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  footerPrompt: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
  },
  // Success View Styles
  successScroll: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCard: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  successIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successIconText: {
    fontSize: 32,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  accountSummaryBox: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 22,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  pendingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 8,
  },
  pendingBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionButton: {
    width: '100%',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    width: '100%',
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
