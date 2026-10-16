import React from 'react';
import {
  Modal,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { useAppTheme } from '../../theme/theme';

export interface LoadingDialogProps {
  visible: boolean;
  message?: string;
  testID?: string;
}

export const LoadingDialog: React.FC<LoadingDialogProps> = ({
  visible,
  message = 'Please wait...',
  testID,
}) => {
  const theme = useAppTheme();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
      testID={testID}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.borderLight,
            },
          ]}
        >
          <ActivityIndicator size="large" color={theme.colors.primary} style={styles.spinner} />
          <Text
            style={[styles.message, { color: theme.colors.text }]}
            numberOfLines={2}
          >
            {message}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 24,
  },
  card: {
    minWidth: 220,
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 26,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 18,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  spinner: {
    marginBottom: 16,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
});
