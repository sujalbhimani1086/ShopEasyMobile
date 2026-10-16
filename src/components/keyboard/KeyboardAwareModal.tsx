import React from 'react';
import {
  Modal,
  ModalProps,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useKeyboardAware } from './useKeyboardAware';

export interface KeyboardAwareModalProps extends ModalProps {
  visible: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  overlayStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  maxHeightPercent?: number; // e.g. 0.85
  keyboardVerticalOffset?: number;
}

export const KeyboardAwareModal: React.FC<KeyboardAwareModalProps> = ({
  visible,
  onClose,
  children,
  overlayStyle,
  contentStyle,
  maxHeightPercent = 0.85,
  keyboardVerticalOffset = 0,
  animationType = 'slide',
  transparent = true,
  ...modalProps
}) => {
  const { isKeyboardVisible, keyboardHeight, screenHeight } = useKeyboardAware();

  // Calculate dynamic max height to guarantee modal stays visible above keyboard
  const calculatedMaxHeight = isKeyboardVisible
    ? Math.max(220, screenHeight - keyboardHeight - (Platform.OS === 'android' ? 30 : 50))
    : screenHeight * maxHeightPercent;

  return (
    <Modal
      visible={visible}
      animationType={animationType}
      transparent={transparent}
      onRequestClose={onClose}
      {...modalProps}
    >
      <KeyboardAvoidingView
        style={[styles.defaultOverlay, overlayStyle]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <View style={[{ maxHeight: calculatedMaxHeight }, contentStyle]}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  defaultOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
});
