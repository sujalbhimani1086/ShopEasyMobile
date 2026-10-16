import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { LoginScreen } from '../src/screens/LoginScreen';
import type { User } from '../src/types/auth';

const mockAdminUser: User = {
  id: 1,
  name: 'Sujal Admin',
  email: 'sujal@test.com',
  role: 'ADMIN',
  status: 'APPROVED',
};

const mockCustomerUser: User = {
  id: 5,
  name: 'Sujal Customer',
  email: 'sujal@gmail.com',
  role: 'CUSTOMER',
  status: 'APPROVED',
};

const mockLogin = jest.fn();

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    token: null,
    isLoading: false,
    login: mockLogin,
    logout: jest.fn(),
  }),
}));

describe('ShopEasy Mobile — Demo Login Autofill Buttons Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. Renders both Demo Customer and Demo Admin autofill buttons with exactly one icon', async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<LoginScreen />);
    });

    const customerBtn = renderer.root.findByProps({
      accessibilityLabel: 'Autofill Demo Customer',
    });
    const adminBtn = renderer.root.findByProps({
      accessibilityLabel: 'Autofill Demo Admin',
    });

    expect(customerBtn).toBeDefined();
    expect(adminBtn).toBeDefined();

    // Verify exact expected text with single icon
    expect(customerBtn.props.children.props.children).toBe('⚡ Autofill Demo Customer (sujal@gmail.com)');
    expect(adminBtn.props.children.props.children).toBe('🛡️ Autofill Demo Admin (sujal@test.com)');

    // Verify no nested Icon components inside the buttons (no duplicate SVG icons)
    expect(customerBtn.findAllByProps({ name: 'zap' }).length).toBe(0);
    expect(adminBtn.findAllByProps({ name: 'shield' }).length).toBe(0);
  });

  it('2. Tapping Demo Customer autofills sujal@gmail.com and 123456 without submitting', async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<LoginScreen />);
    });

    const customerBtn = renderer.root.findByProps({
      accessibilityLabel: 'Autofill Demo Customer',
    });

    await act(async () => {
      customerBtn.props.onPress();
    });

    const inputs = renderer.root.findAllByType(TextInput);
    const emailInput = inputs[0];
    const passwordInput = inputs[1];

    expect(emailInput.props.value).toBe('sujal@gmail.com');
    expect(passwordInput.props.value).toBe('123456');
    // Must NOT submit automatically
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('3. Tapping Demo Admin autofills sujal@test.com and 123456 without submitting', async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<LoginScreen />);
    });

    const adminBtn = renderer.root.findByProps({
      accessibilityLabel: 'Autofill Demo Admin',
    });

    await act(async () => {
      adminBtn.props.onPress();
    });

    const inputs = renderer.root.findAllByType(TextInput);
    const emailInput = inputs[0];
    const passwordInput = inputs[1];

    expect(emailInput.props.value).toBe('sujal@test.com');
    expect(passwordInput.props.value).toBe('123456');
    // Must NOT submit automatically
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('4. Switching between buttons correctly replaces both fields', async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<LoginScreen />);
    });

    const customerBtn = renderer.root.findByProps({
      accessibilityLabel: 'Autofill Demo Customer',
    });
    const adminBtn = renderer.root.findByProps({
      accessibilityLabel: 'Autofill Demo Admin',
    });

    // Tap customer first
    await act(async () => {
      customerBtn.props.onPress();
    });

    let inputs = renderer.root.findAllByType(TextInput);
    expect(inputs[0].props.value).toBe('sujal@gmail.com');

    // Switch to admin
    await act(async () => {
      adminBtn.props.onPress();
    });

    inputs = renderer.root.findAllByType(TextInput);
    expect(inputs[0].props.value).toBe('sujal@test.com');
    expect(inputs[1].props.value).toBe('123456');
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('5. Allows editing credentials after autofilling', async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<LoginScreen />);
    });

    const customerBtn = renderer.root.findByProps({
      accessibilityLabel: 'Autofill Demo Customer',
    });

    await act(async () => {
      customerBtn.props.onPress();
    });

    const inputs = renderer.root.findAllByType(TextInput);
    // User types additional characters or edits
    await act(async () => {
      inputs[0].props.onChangeText('sujal.custom@gmail.com');
      inputs[1].props.onChangeText('newpassword123');
    });

    expect(inputs[0].props.value).toBe('sujal.custom@gmail.com');
    expect(inputs[1].props.value).toBe('newpassword123');
  });

  it('6. Submitting Demo Customer credentials performs customer authentication', async () => {
    mockLogin.mockResolvedValueOnce({
      success: true,
      user: mockCustomerUser,
    });

    const onLoginSuccess = jest.fn();
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    });

    const customerBtn = renderer.root.findByProps({
      accessibilityLabel: 'Autofill Demo Customer',
    });
    await act(async () => {
      customerBtn.props.onPress();
    });

    const submitBtn = renderer.root.findByProps({
      accessibilityLabel: 'Sign In',
    });
    await act(async () => {
      submitBtn.props.onPress();
    });

    expect(mockLogin).toHaveBeenCalledWith({
      email: 'sujal@gmail.com',
      password: '123456',
    });

    await act(async () => {
      renderer.unmount();
    });
  });

  it('7. Submitting Demo Admin credentials performs admin authentication and passes ADMIN user', async () => {
    mockLogin.mockResolvedValueOnce({
      success: true,
      user: mockAdminUser,
    });

    const onLoginSuccess = jest.fn();
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    });

    const adminBtn = renderer.root.findByProps({
      accessibilityLabel: 'Autofill Demo Admin',
    });
    await act(async () => {
      adminBtn.props.onPress();
    });

    const submitBtn = renderer.root.findByProps({
      accessibilityLabel: 'Sign In',
    });
    await act(async () => {
      submitBtn.props.onPress();
    });

    expect(mockLogin).toHaveBeenCalledWith({
      email: 'sujal@test.com',
      password: '123456',
    });

    expect(onLoginSuccess).toHaveBeenCalledWith(mockAdminUser);

    await act(async () => {
      renderer.unmount();
    });
  });

  it('8. Displays error banner when backend returns invalid credentials', async () => {
    mockLogin.mockResolvedValueOnce({
      success: false,
      message: 'Invalid email or password',
    });

    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<LoginScreen />);
    });

    const customerBtn = renderer.root.findByProps({
      accessibilityLabel: 'Autofill Demo Customer',
    });
    await act(async () => {
      customerBtn.props.onPress();
    });

    const submitBtn = renderer.root.findByProps({
      accessibilityLabel: 'Sign In',
    });
    await act(async () => {
      submitBtn.props.onPress();
    });

    // Check that error banner rendered
    const errorBanner = renderer.root.findByProps({
      accessibilityRole: 'alert',
    });
    expect(errorBanner).toBeDefined();
  });
});
