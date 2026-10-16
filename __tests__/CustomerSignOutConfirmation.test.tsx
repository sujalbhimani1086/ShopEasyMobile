import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { UserProfileModal } from '../src/components/UserProfileModal';
import { ThemeProvider } from '../src/theme/theme';
import type { User } from '../src/types/auth';

const mockCustomerUser: User = {
  id: 10,
  name: 'Test Customer',
  email: 'customer@shopeasy.com',
  role: 'CUSTOMER',
  status: 'APPROVED',
};

describe('ShopEasy Mobile — Customer Sign Out Confirmation Popup', () => {
  it('1. Tapping Sign Out opens the confirmation modal with title, message, red icon, cancel and sign out buttons', async () => {
    const onLogout = jest.fn();
    const onClose = jest.fn();

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <ThemeProvider>
          <UserProfileModal
            visible={true}
            user={mockCustomerUser}
            onClose={onClose}
            onLogout={onLogout}
          />
        </ThemeProvider>
      );
    });

    const root = renderer.root;

    // Find the Sign Out action button in the profile sheet
    const signOutBtn = root.findByProps({ accessibilityLabel: 'Sign out of account' });
    expect(signOutBtn).toBeDefined();

    // Tap Sign Out
    await act(async () => {
      signOutBtn.props.onPress();
    });

    // onLogout must NOT be called immediately
    expect(onLogout).not.toHaveBeenCalled();

    // Confirmation dialog elements must be present
    const dialogTitle = root.findAll((node) => node.props && node.props.children === 'Sign Out');
    expect(dialogTitle.length).toBeGreaterThan(0);

    const dialogMsg = root.findAll(
      (node) =>
        node.props &&
        node.props.children === 'Are you sure you want to sign out of your account?'
    );
    expect(dialogMsg.length).toBeGreaterThan(0);

    const cancelBtn = root.findByProps({ accessibilityLabel: 'Cancel' });
    expect(cancelBtn).toBeDefined();

    const confirmBtn = root.findByProps({ accessibilityLabel: 'Confirm sign out' });
    expect(confirmBtn).toBeDefined();
  });

  it('2. Tapping Cancel dismisses the confirmation popup and preserves customer session without logging out', async () => {
    const onLogout = jest.fn();
    const onClose = jest.fn();

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <ThemeProvider>
          <UserProfileModal
            visible={true}
            user={mockCustomerUser}
            onClose={onClose}
            onLogout={onLogout}
          />
        </ThemeProvider>
      );
    });

    const root = renderer.root;

    // Open confirmation popup
    const signOutBtn = root.findByProps({ accessibilityLabel: 'Sign out of account' });
    await act(async () => {
      signOutBtn.props.onPress();
    });

    // Tap Cancel
    const cancelBtn = root.findByProps({ accessibilityLabel: 'Cancel' });
    await act(async () => {
      cancelBtn.props.onPress();
    });

    // Logout was NOT called
    expect(onLogout).not.toHaveBeenCalled();

    // Confirmation dialog is closed
    const confirmBtn = root.findAll((node) => node.props && node.props.accessibilityLabel === 'Confirm sign out');
    expect(confirmBtn.length).toBe(0);
  });

  it('3. Confirming Sign Out closes modal and triggers onLogout callback', async () => {
    const onLogout = jest.fn();
    const onClose = jest.fn();

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <ThemeProvider>
          <UserProfileModal
            visible={true}
            user={mockCustomerUser}
            onClose={onClose}
            onLogout={onLogout}
          />
        </ThemeProvider>
      );
    });

    const root = renderer.root;

    // Open confirmation popup
    const signOutBtn = root.findByProps({ accessibilityLabel: 'Sign out of account' });
    await act(async () => {
      signOutBtn.props.onPress();
    });

    // Confirm Sign Out
    const confirmBtn = root.findByProps({ accessibilityLabel: 'Confirm sign out' });
    await act(async () => {
      confirmBtn.props.onPress();
    });

    expect(onClose).toHaveBeenCalled();
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
