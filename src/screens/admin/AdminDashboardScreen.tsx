import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  StatusBar,
  Platform,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { useFeedback } from '../../context/FeedbackContext';
import { Icon } from '../../components/Icon';
import { FullPageContentLoader } from '../../components/common';
import type { AdminSection } from '../../types/admin';

// Section Views
import { AdminOverviewView } from './AdminOverviewView';
import { AdminProductsView } from './AdminProductsView';
import { AdminOrdersView } from './AdminOrdersView';
import { AdminCouponsView } from './AdminCouponsView';
import { AdminReviewsView } from './AdminReviewsView';
import { AdminAnalyticsView } from './AdminAnalyticsView';
import { AdminUsersView } from './AdminUsersView';
import { AdminCategoriesView } from './AdminCategoriesView';
import { AdminRegistrationsView } from './AdminRegistrationsView';

import { getProfileApi } from '../../services/authApi';

export interface AdminDashboardScreenProps {
  initialSection?: AdminSection;
  onBack: () => void;
  onLogout?: () => void;
}

interface TabItem {
  id: AdminSection;
  label: string;
  icon: string;
}

const ADMIN_TABS: TabItem[] = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'products', label: 'Products', icon: 'package' },
  { id: 'categories', label: 'Categories', icon: 'grid' },
  { id: 'orders', label: 'Orders', icon: 'orders' },
  { id: 'coupons', label: 'Coupons', icon: 'tag' },
  { id: 'reviews', label: 'Reviews', icon: 'star' },
  { id: 'users', label: 'Users', icon: 'users' },
  { id: 'registrations', label: 'Registrations', icon: 'check-circle' },
];

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({
  initialSection = 'overview',
  onBack,
  onLogout,
}) => {
  const theme = useAppTheme();
  const feedback = useFeedback();
  const { user, token, isLoading } = useAuth();
  let insetsTop = 0;
  try {
    const insets = useSafeAreaInsets();
    insetsTop = insets?.top || 0;
  } catch {
    insetsTop = 0;
  }

  const [activeSection, setActiveSection] = useState<AdminSection>(initialSection);
  const [sectionHistory, setSectionHistory] = useState<AdminSection[]>([initialSection]);

  const tabsScrollRef = React.useRef<any>(null);
  const tabLayoutsRef = React.useRef<Record<string, { x: number; width: number }>>({});
  const containerWidthRef = React.useRef<number>(0);

  const scrollToActiveTab = useCallback((section: AdminSection, animated = true) => {
    const layout = tabLayoutsRef.current[section];
    const containerWidth = containerWidthRef.current;
    if (layout && tabsScrollRef.current) {
      const targetX = Math.max(
        0,
        layout.x - (containerWidth > 0 ? (containerWidth - layout.width) / 2 : 100)
      );
      tabsScrollRef.current.scrollTo({ x: targetX, animated });
    }
  }, []);

  useEffect(() => {
    scrollToActiveTab(activeSection, true);
  }, [activeSection, scrollToActiveTab]);

  // Strict Security Guard: Only users with verified role === 'ADMIN' can access this screen
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN')) {
      feedback.toast.error('Access Denied: Admin authorization required.');
      onBack();
    }
  }, [user, isLoading, onBack, feedback]);

  // Verify administrator session validity against backend database on mount
  useEffect(() => {
    let isMounted = true;
    async function verifyBackendAdmin() {
      if (!token) return;
      try {
        const res = await getProfileApi(token);
        if (!isMounted) return;
        if (res.expired || (res.success && res.user && res.user.role !== 'ADMIN')) {
          feedback.toast.error('Session expired or admin permissions revoked.');
          if (onLogout) {
            onLogout();
          } else {
            onBack();
          }
        }
      } catch {
        // Network offline - allow local session
      }
    }

    if (!isLoading && user?.role === 'ADMIN' && token) {
      verifyBackendAdmin();
    }

    return () => {
      isMounted = false;
    };
  }, [token, isLoading, user?.role, feedback, onLogout, onBack]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      (StatusBar as any).setBackgroundColor?.('#000000');
    }
  }, []);

  // Navigate between admin sections while maintaining history
  const navigateToSection = (section: AdminSection) => {
    if (section === activeSection) return;
    setSectionHistory((prev) => [...prev, section]);
    setActiveSection(section);
  };

  // Back arrow handling: return to previous admin section or Overview, never trigger logout
  const handleBackPress = () => {
    if (sectionHistory.length > 1) {
      const nextHistory = [...sectionHistory];
      nextHistory.pop();
      const prevSection = nextHistory[nextHistory.length - 1];
      setSectionHistory(nextHistory);
      setActiveSection(prevSection);
      return;
    }
    if (activeSection !== 'overview') {
      setSectionHistory(['overview']);
      setActiveSection('overview');
      return;
    }
    // At overview with no prior admin history: return to customer store if available
    onBack();
  };

  // Android hardware back button handling
  useEffect(() => {
    const onHardwareBack = () => {
      if (sectionHistory.length > 1) {
        const nextHistory = [...sectionHistory];
        nextHistory.pop();
        const prevSection = nextHistory[nextHistory.length - 1];
        setSectionHistory(nextHistory);
        setActiveSection(prevSection);
        return true;
      }
      if (activeSection !== 'overview') {
        setSectionHistory(['overview']);
        setActiveSection('overview');
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [sectionHistory, activeSection]);

  if (isLoading || !user || user.role !== 'ADMIN') {
    return (
      <View style={[styles.guardContainer, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle="light-content" />
        <FullPageContentLoader message="Loading dashboard..." />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Permanently Black Header */}
      <View style={[styles.headerWrapper, { paddingTop: Math.max(insetsTop, 8) }]}>
        <View style={styles.headerContent}>
          {/* Back Button */}
          <Pressable
            testID="admin-header-back-button"
            accessibilityRole="button"
            accessibilityLabel="Back to previous section or store"
            style={styles.backButton}
            onPress={handleBackPress}
          >
            <Icon name="arrow-left" size={20} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>

          {/* White Official Logo & Admin Badge */}
          <View style={styles.brandContainer}>
            <Image
              source={require('../../assets/logos/1logo-white.png')}
              style={styles.logoImage}
              resizeMode="contain"
              accessibilityLabel="ShopEasy Logo"
            />
            <View style={styles.adminBadge}>
              <Icon name="shield" size={11} color="#000000" strokeWidth={2.5} />
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
          </View>

          {/* Right Header Actions: Theme Toggle & Sign Out */}
          <View style={styles.headerRightActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Appearance mode: ${theme.isDark ? 'Dark' : 'Light'}`}
              style={styles.themeToggleBtn}
              onPress={() => theme.toggleTheme()}
            >
              <Icon
                name={theme.isDark ? 'sun' : 'moon'}
                size={18}
                color={theme.isDark ? '#FBBF24' : '#FFFFFF'}
                strokeWidth={2}
              />
            </Pressable>

            {onLogout && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign out of Admin Console"
                style={styles.logoutBtn}
                onPress={() => {
                  feedback.showConfirm({
                    title: 'Sign Out',
                    message: 'Are you sure you want to sign out of the Admin Console?',
                    icon: 'logout',
                    cancelText: 'Cancel',
                    confirmText: 'Sign Out',
                    isDestructive: true,
                    onConfirm: onLogout,
                  });
                }}
              >
                <Icon name="logout" size={17} color="#EF4444" strokeWidth={2.2} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Horizontal Navigation Tabs */}
        <ScrollView
          ref={tabsScrollRef}
          testID="admin-horizontal-nav-scroll"
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
          style={styles.tabsScrollView}
          onLayout={(e) => {
            containerWidthRef.current = e.nativeEvent.layout.width;
            scrollToActiveTab(activeSection, false);
          }}
        >
          {ADMIN_TABS.map((tab) => {
            const isActive = activeSection === tab.id;
            return (
              <Pressable
                key={tab.id}
                testID={`admin-tab-${tab.id}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${tab.label} section`}
                onLayout={(e) => {
                  const { x, width } = e.nativeEvent.layout;
                  tabLayoutsRef.current[tab.id] = { x, width };
                  if (tab.id === activeSection) {
                    scrollToActiveTab(activeSection, false);
                  }
                }}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.12)',
                  },
                ]}
                onPress={() => navigateToSection(tab.id)}
              >
                <Icon
                  name={tab.icon}
                  size={14}
                  color={isActive ? '#000000' : '#FFFFFF'}
                  strokeWidth={2}
                />
                <Text
                  testID={`admin-tab-text-${tab.id}`}
                  style={[
                    styles.tabChipText,
                    {
                      color: isActive ? '#000000' : '#FFFFFF',
                      fontWeight: isActive ? '700' : '500',
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Admin Section View */}
      <View style={styles.bodyContainer}>
        {activeSection === 'overview' && (
          <AdminOverviewView
            token={token || ''}
            onNavigateToSection={navigateToSection}
          />
        )}
        {activeSection === 'products' && <AdminProductsView token={token || ''} />}
        {activeSection === 'orders' && <AdminOrdersView token={token || ''} />}
        {activeSection === 'coupons' && <AdminCouponsView token={token || ''} />}
        {activeSection === 'reviews' && <AdminReviewsView token={token || ''} />}
        {activeSection === 'analytics' && <AdminAnalyticsView token={token || ''} />}
        {activeSection === 'users' && <AdminUsersView token={token || ''} />}
        {activeSection === 'categories' && <AdminCategoriesView token={token || ''} />}
        {activeSection === 'registrations' && <AdminRegistrationsView token={token || ''} />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  guardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  guardText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerWrapper: {
    backgroundColor: '#000000',
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333333',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 48,
  },
  backButton: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoImage: {
    width: 100,
    height: 26,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  adminBadgeText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeToggleBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoutBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  tabsScrollView: {
    marginTop: 8,
  },
  tabsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
  },
  tabChipText: {
    fontSize: 12,
  },
  bodyContainer: {
    flex: 1,
  },
});
