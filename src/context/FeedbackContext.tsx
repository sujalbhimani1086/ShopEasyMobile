import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  ConfirmDialog,
  AlertDialog,
  AppToast,
  LoadingDialog,
  type ToastType,
  type AlertType,
} from '../components/dialogs';
import type { IconName } from '../components/Icon';

export interface ConfirmOptions {
  title: string;
  message: string;
  icon?: IconName;
  iconColor?: string;
  iconBgColor?: string;
  cancelText?: string;
  confirmText?: string;
  isDestructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export interface AlertOptions {
  title: string;
  message: string;
  type?: AlertType;
  buttonText?: string;
  icon?: IconName;
  onClose?: () => void;
}

export interface FeedbackContextType {
  toast: {
    show: (message: string, type?: ToastType, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    hide: () => void;
  };
  showConfirm: (options: ConfirmOptions) => void;
  showAlert: (options: AlertOptions) => void;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
}

const defaultFeedbackContext: FeedbackContextType = {
  toast: {
    show: () => {},
    success: () => {},
    error: () => {},
    warning: () => {},
    info: () => {},
    hide: () => {},
  },
  showConfirm: (opts) => {
    // Fallback if provider not mounted
    opts.onConfirm();
  },
  showAlert: (opts) => {
    opts.onClose?.();
  },
  showLoading: () => {},
  hideLoading: () => {},
};

const FeedbackContext = createContext<FeedbackContextType>(defaultFeedbackContext);

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Toast state
  const [toastState, setToastState] = useState<{
    visible: boolean;
    message: string;
    type: ToastType;
    duration: number;
  }>({
    visible: false,
    message: '',
    type: 'success',
    duration: 3000,
  });

  // Confirm dialog state
  const [confirmState, setConfirmState] = useState<{
    visible: boolean;
    options: ConfirmOptions | null;
  }>({
    visible: false,
    options: null,
  });

  // Alert dialog state
  const [alertState, setAlertState] = useState<{
    visible: boolean;
    options: AlertOptions | null;
  }>({
    visible: false,
    options: null,
  });

  // Loading dialog state
  const [loadingState, setLoadingState] = useState<{
    visible: boolean;
    message: string;
  }>({
    visible: false,
    message: 'Please wait...',
  });

  const showToast = useCallback(
    (message: string, type: ToastType = 'success', duration: number = 3000) => {
      setToastState({
        visible: true,
        message,
        type,
        duration,
      });
    },
    []
  );

  const hideToast = useCallback(() => {
    setToastState((prev) => ({ ...prev, visible: false }));
  }, []);

  const showConfirm = useCallback((options: ConfirmOptions) => {
    setConfirmState({
      visible: true,
      options,
    });
  }, []);

  const handleConfirmCancel = useCallback(() => {
    if (confirmState.options?.onCancel) {
      confirmState.options.onCancel();
    }
    setConfirmState({ visible: false, options: null });
  }, [confirmState.options]);

  const handleConfirmConfirm = useCallback(async () => {
    if (confirmState.options?.onConfirm) {
      await confirmState.options.onConfirm();
    }
    setConfirmState({ visible: false, options: null });
  }, [confirmState.options]);

  const showAlert = useCallback((options: AlertOptions) => {
    setAlertState({
      visible: true,
      options,
    });
  }, []);

  const handleAlertClose = useCallback(() => {
    if (alertState.options?.onClose) {
      alertState.options.onClose();
    }
    setAlertState({ visible: false, options: null });
  }, [alertState.options]);

  const showLoading = useCallback((message = 'Please wait...') => {
    setLoadingState({ visible: true, message });
  }, []);

  const hideLoading = useCallback(() => {
    setLoadingState((prev) => ({ ...prev, visible: false }));
  }, []);

  const contextValue = useMemo<FeedbackContextType>(
    () => ({
      toast: {
        show: showToast,
        success: (msg, dur) => showToast(msg, 'success', dur),
        error: (msg, dur) => showToast(msg, 'error', dur),
        warning: (msg, dur) => showToast(msg, 'warning', dur),
        info: (msg, dur) => showToast(msg, 'info', dur),
        hide: hideToast,
      },
      showConfirm,
      showAlert,
      showLoading,
      hideLoading,
    }),
    [showToast, hideToast, showConfirm, showAlert, showLoading, hideLoading]
  );

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}

      {/* Global Toast */}
      <AppToast
        visible={toastState.visible}
        message={toastState.message}
        type={toastState.type}
        duration={toastState.duration}
        onDismiss={hideToast}
      />

      {/* Global Confirm Dialog */}
      {confirmState.options && (
        <ConfirmDialog
          visible={confirmState.visible}
          title={confirmState.options.title}
          message={confirmState.options.message}
          icon={confirmState.options.icon}
          iconColor={confirmState.options.iconColor}
          iconBgColor={confirmState.options.iconBgColor}
          cancelText={confirmState.options.cancelText}
          confirmText={confirmState.options.confirmText}
          isDestructive={confirmState.options.isDestructive}
          onCancel={handleConfirmCancel}
          onConfirm={handleConfirmConfirm}
        />
      )}

      {/* Global Alert Dialog */}
      {alertState.options && (
        <AlertDialog
          visible={alertState.visible}
          title={alertState.options.title}
          message={alertState.options.message}
          type={alertState.options.type}
          buttonText={alertState.options.buttonText}
          icon={alertState.options.icon}
          onClose={handleAlertClose}
        />
      )}

      {/* Global Loading Dialog */}
      <LoadingDialog
        visible={loadingState.visible}
        message={loadingState.message}
      />
    </FeedbackContext.Provider>
  );
};

export const useFeedback = (): FeedbackContextType => {
  return useContext(FeedbackContext);
};
