import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  Switch,
  Animated,
} from 'react-native';
import { useAppTheme } from '../theme/theme';
import type { User } from '../types/auth';
import { Icon } from './Icon';
import { ConfirmDialog } from './dialogs';

export interface UserProfileModalProps {
  visible: boolean;
  user: User | null;
  onClose: () => void;
  onLogout: () => void;
  onMyOrders?: () => void;
  onAddressBook?: () => void;
  onNotifications?: () => void;
  onHelpSupport?: () => void;
  onAdminPanel?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  visible,
  user,
  onClose,
  onLogout,
  onMyOrders,
  onAddressBook,
  onNotifications,
  onHelpSupport,
  onAdminPanel,
}) => {
  const theme = useAppTheme();

  const [confirmLogout, setConfirmLogout] = React.useState(false);
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!visible) {
      setConfirmLogout(false);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.92);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 90,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!user) return null;

  const handleConfirmLogout = () => {
    onClose();
    onLogout();
  };

  const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              Account Profile
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close profile"
              style={[
                styles.closeButton,
                { backgroundColor: theme.colors.surfaceSubtle },
              ]}
              onPress={onClose}
            >
              <Icon name="close" size={16} color={theme.colors.text} strokeWidth={2.5} />
            </Pressable>
          </View>

          {/* User Avatar */}
          <View style={styles.avatarContainer}>
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              <Text
                style={[
                  styles.avatarInitial,
                  { color: theme.colors.primaryText },
                ]}
              >
                {initial}
              </Text>
            </View>
            <Text style={[styles.userName, { color: theme.colors.text }]}>
              {user.name || 'ShopEasy User'}
            </Text>
            <Text
              style={[styles.userEmail, { color: theme.colors.textSecondary }]}
            >
              {user.email}
            </Text>
          </View>

          {/* Details Box */}
          <View
            style={[
              styles.infoBox,
              {
                backgroundColor: theme.colors.surfaceSubtle,
                borderColor: theme.colors.borderLight,
              },
            ]}
          >
            <View style={styles.infoRow}>
              <Text
                style={[styles.infoLabel, { color: theme.colors.textMuted }]}
              >
                Account Type
              </Text>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor:
                      user.role === 'ADMIN'
                        ? theme.colors.accent
                        : theme.isDark
                        ? '#333333'
                        : '#E5E7EB',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    {
                      color:
                        user.role === 'ADMIN'
                          ? '#FFFFFF'
                          : theme.colors.text,
                    },
                  ]}
                >
                  {user.role || 'CUSTOMER'}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Appearance Theme Row */}
            <View style={styles.infoRow}>
              <Text
                style={[styles.infoLabel, { color: theme.colors.textMuted }]}
              >
                Appearance
              </Text>
              <View style={styles.appearanceToggleRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Appearance mode: currently ${theme.isDark ? 'Dark' : 'Light'}`}
                  onPress={() => theme.toggleTheme()}
                  style={styles.appearanceModeBadge}
                >
                  <Icon
                    name={theme.isDark ? 'moon' : 'sun'}
                    size={14}
                    color={theme.isDark ? '#FBBF24' : '#F59E0B'}
                    strokeWidth={2}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.appearanceModeText,
                      { color: theme.colors.text, marginLeft: 5 },
                    ]}
                  >
                    {theme.isDark ? 'Dark' : 'Light'}
                  </Text>
                </Pressable>
                <Switch
                  testID="theme-toggle-switch"
                  value={theme.isDark}
                  onValueChange={(val) => {
                    theme.setThemeMode(val ? 'dark' : 'light');
                  }}
                  trackColor={{ false: '#D1D5DB', true: theme.isDark ? '#555555' : '#000000' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#CBD5E1"
                  accessibilityRole="switch"
                  accessibilityLabel={`Appearance mode: currently ${theme.isDark ? 'Dark' : 'Light'}. Toggle switch to change.`}
                />
              </View>
            </View>
          </View>

          {/* Navigation Links Group */}
          <View style={styles.navLinksGroup}>

            {onMyOrders && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View my orders"
                style={({ pressed }) => [
                  styles.navMenuItem,
                  {
                    backgroundColor: theme.colors.surfaceSubtle,
                    borderColor: theme.colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={() => {
                  onClose();
                  onMyOrders();
                }}
              >
                <Icon name="orders" size={18} color={theme.colors.text} strokeWidth={2} />
                <Text style={[styles.navMenuItemText, { color: theme.colors.text }]}>
                  My Orders
                </Text>
                <Icon name="chevron-right" size={16} color={theme.colors.textSecondary} strokeWidth={2} />
              </Pressable>
            )}

            {onAddressBook && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delivery Addresses"
                style={({ pressed }) => [
                  styles.navMenuItem,
                  {
                    backgroundColor: theme.colors.surfaceSubtle,
                    borderColor: theme.colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={() => {
                  onClose();
                  onAddressBook();
                }}
              >
                <Icon name="map-pin" size={18} color={theme.colors.text} strokeWidth={2} />
                <Text style={[styles.navMenuItemText, { color: theme.colors.text }]}>
                  Delivery Addresses
                </Text>
                <Icon name="chevron-right" size={16} color={theme.colors.textSecondary} strokeWidth={2} />
              </Pressable>
            )}

            {onNotifications && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Notifications"
                style={({ pressed }) => [
                  styles.navMenuItem,
                  {
                    backgroundColor: theme.colors.surfaceSubtle,
                    borderColor: theme.colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={() => {
                  onClose();
                  onNotifications();
                }}
              >
                <Icon name="bell" size={18} color={theme.colors.text} strokeWidth={2} />
                <Text style={[styles.navMenuItemText, { color: theme.colors.text }]}>
                  Notifications
                </Text>
                <Icon name="chevron-right" size={16} color={theme.colors.textSecondary} strokeWidth={2} />
              </Pressable>
            )}

            {onHelpSupport && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Help and Customer Support"
                style={({ pressed }) => [
                  styles.navMenuItem,
                  {
                    backgroundColor: theme.colors.surfaceSubtle,
                    borderColor: theme.colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={() => {
                  onClose();
                  onHelpSupport();
                }}
              >
                <Icon name="help" size={18} color={theme.colors.text} strokeWidth={2} />
                <Text style={[styles.navMenuItemText, { color: theme.colors.text }]}>
                  Help & Support
                </Text>
                <Icon name="chevron-right" size={16} color={theme.colors.textSecondary} strokeWidth={2} />
              </Pressable>
            )}
          </View>

          {/* Sign Out Action Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out of account"
            style={({ pressed }) => [
              styles.logoutButton,
              {
                backgroundColor: theme.colors.dangerBg,
                borderColor: theme.colors.danger,
                opacity: pressed ? 0.8 : 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              },
            ]}
            onPress={() => setConfirmLogout(true)}
          >
            <Icon name="logout" size={16} color={theme.colors.danger} strokeWidth={2.2} />
            <Text style={[styles.logoutText, { color: theme.colors.danger }]}>
              Sign Out
            </Text>
          </Pressable>
        </Animated.View>
      </Pressable>

      {/* Centered Sign Out Confirmation Popup (matching Admin popup design) */}
      <ConfirmDialog
        visible={confirmLogout}
        title="Sign Out"
        message="Are you sure you want to sign out of your account?"
        icon="logout"
        cancelText="Cancel"
        confirmText="Sign Out"
        confirmAccessibilityLabel="Confirm sign out"
        isDestructive={true}
        onCancel={() => setConfirmLogout(false)}
        onConfirm={handleConfirmLogout}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '800',
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
  },
  infoBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginVertical: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(150,150,150,0.15)',
    marginVertical: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  appearanceToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appearanceModeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  appearanceModeText: {
    fontSize: 13,
    fontWeight: '700',
    includeFontPadding: false,
  },
  logoutButton: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  navLinksGroup: {
    width: '100%',
    gap: 8,
    marginBottom: 12,
  },
  navMenuItem: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navMenuItemText: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginLeft: 10,
  },
  ordersButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  ordersBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
  },
  confirmBox: {
    marginTop: 8,
    alignItems: 'center',
  },
  confirmPrompt: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  confirmBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmLogoutBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmLogoutText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
