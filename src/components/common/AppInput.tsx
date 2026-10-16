import React, { useState, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  TextInputProps,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useAppTheme } from '../../theme/theme';
import { Icon, IconName } from '../Icon';

export interface AppInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string | null;
  hint?: string;
  leftIcon?: IconName;
  rightIcon?: IconName;
  onRightIconPress?: () => void;
  isPassword?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

export const AppInput = forwardRef<any, AppInputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      onRightIconPress,
      isPassword = false,
      secureTextEntry,
      containerStyle,
      inputStyle,
      labelStyle,
      onFocus,
      onBlur,
      editable = true,
      ...restProps
    },
    ref
  ) => {
    const theme = useAppTheme();
    const [isFocused, setIsFocused] = useState(false);
    const [passwordVisible, setPasswordVisible] = useState(false);

    const isSecure = isPassword ? !passwordVisible : secureTextEntry;

    // Resolve border color
    let borderColor = theme.colors.borderLight;
    if (error) {
      borderColor = theme.colors.danger;
    } else if (isFocused) {
      borderColor = theme.colors.primary;
    }

    return (
      <View style={[styles.fieldGroup, containerStyle]}>
        {label ? (
          <Text style={[styles.fieldLabel, { color: theme.colors.text }, labelStyle]}>
            {label}
          </Text>
        ) : null}

        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              borderColor,
              borderRadius: theme.radius.md,
              opacity: editable ? 1 : 0.6,
            },
          ]}
        >
          {leftIcon ? (
            <View style={styles.leftIconWrapper}>
              <Icon
                name={leftIcon}
                size={18}
                color={isFocused ? theme.colors.primary : theme.colors.textMuted}
                strokeWidth={2}
              />
            </View>
          ) : null}

          <TextInput
            ref={ref}
            style={[
              styles.textInput,
              {
                color: theme.colors.text,
              },
              inputStyle,
            ]}
            placeholderTextColor={theme.colors.textMuted}
            secureTextEntry={isSecure}
            editable={editable}
            onFocus={(e) => {
              setIsFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            {...restProps}
          />

          {isPassword ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
              onPress={() => setPasswordVisible((prev) => !prev)}
              style={styles.rightActionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.toggleText, { color: theme.colors.textSecondary }]}>
                {passwordVisible ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
          ) : rightIcon ? (
            <Pressable
              accessibilityRole="button"
              onPress={onRightIconPress}
              disabled={!onRightIconPress}
              style={styles.rightActionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon
                name={rightIcon}
                size={18}
                color={theme.colors.textMuted}
                strokeWidth={2}
              />
            </Pressable>
          ) : null}
        </View>

        {error ? (
          <Text style={[styles.errorText, { color: theme.colors.danger }]}>
            {error}
          </Text>
        ) : hint ? (
          <Text style={[styles.hintText, { color: theme.colors.textMuted }]}>
            {hint}
          </Text>
        ) : null}
      </View>
    );
  }
);

AppInput.displayName = 'AppInput';

const styles = StyleSheet.create({
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 12,
  },
  leftIconWrapper: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: 48,
    fontSize: 14,
    paddingVertical: 0,
  },
  rightActionBtn: {
    paddingLeft: 8,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  hintText: {
    fontSize: 12,
    marginTop: 4,
  },
});
