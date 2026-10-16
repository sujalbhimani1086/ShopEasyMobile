import { useState, useEffect } from 'react';
import { Keyboard, Platform, Dimensions, EmitterSubscription } from 'react-native';

export interface KeyboardAwareState {
  keyboardHeight: number;
  isKeyboardVisible: boolean;
  availableHeight: number;
  screenHeight: number;
  dismissKeyboard: () => void;
}

export function useKeyboardAware(bottomExtra = 24): KeyboardAwareState {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [screenHeight, setScreenHeight] = useState(() => Dimensions.get('window').height);

  useEffect(() => {
    const onDimensionsChange = ({ window }: { window: { height: number } }) => {
      setScreenHeight(window.height);
    };

    const dimSub = Dimensions.addEventListener('change', onDimensionsChange);

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      const height = e?.endCoordinates?.height || 0;
      setKeyboardHeight(height);
      setIsKeyboardVisible(true);
    };

    const onHide = () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    };

    const showSub: EmitterSubscription = Keyboard.addListener(showEvent, onShow);
    const hideSub: EmitterSubscription = Keyboard.addListener(hideEvent, onHide);

    return () => {
      dimSub.remove();
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const availableHeight = Math.max(160, screenHeight - keyboardHeight - bottomExtra);

  return {
    keyboardHeight,
    isKeyboardVisible,
    availableHeight,
    screenHeight,
    dismissKeyboard: Keyboard.dismiss,
  };
}
