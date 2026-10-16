import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import {
  ScrollView,
  ScrollViewProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useKeyboardAware } from './useKeyboardAware';

export interface KeyboardAwareScrollViewRef {
  scrollTo: (options: { x?: number; y?: number; animated?: boolean }) => void;
  scrollToEnd: (options?: { animated?: boolean }) => void;
  scrollToInput: (yOffset: number, animated?: boolean) => void;
}

export interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  extraScrollHeight?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export const KeyboardAwareScrollView = forwardRef<
  KeyboardAwareScrollViewRef,
  KeyboardAwareScrollViewProps
>(({ children, contentContainerStyle, extraScrollHeight = 80, ...rest }, ref) => {
  const scrollRef = useRef<any>(null);
  const { isKeyboardVisible, keyboardHeight } = useKeyboardAware();

  useImperativeHandle(ref, () => ({
    scrollTo: (options) => scrollRef.current?.scrollTo(options),
    scrollToEnd: (options) => scrollRef.current?.scrollToEnd(options),
    scrollToInput: (yOffset: number, animated = true) => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, yOffset),
        animated,
      });
    },
  }));

  const dynamicPaddingBottom = isKeyboardVisible ? keyboardHeight + extraScrollHeight : 24;

  return (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      nestedScrollEnabled={true}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        contentContainerStyle,
        { paddingBottom: dynamicPaddingBottom },
      ]}
      {...rest}
    >
      {children}
    </ScrollView>
  );
});

KeyboardAwareScrollView.displayName = 'KeyboardAwareScrollView';
