import {
  API_ENDPOINTS,
  getApiBaseUrl,
  setApiBaseUrl,
  CANDIDATE_BASE_URLS,
} from '../config/api';
import type { LoginCredentials, RegisterData, AuthResult, User } from '../types/auth';

const REQUEST_TIMEOUT_MS = 8000;

async function executeAuthFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    if (timedOut || err?.name === 'AbortError' || err?.message === 'Aborted') {
      const timeoutError = new Error(`Authentication request timed out after ${timeoutMs}ms while connecting to ${url}`);
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Executes an auth request against the active base URL, and falls back across
 * other candidates (e.g. 10.0.2.2, localhost via adb reverse, or LAN IP) if network fails.
 */
async function authFetchWithFallback(
  endpointPath: string,
  options: RequestInit = {}
): Promise<Response> {
  const currentBase = getApiBaseUrl();
  const primaryUrl = `${currentBase}${endpointPath}`;

  try {
    const res = await executeAuthFetch(primaryUrl, options, REQUEST_TIMEOUT_MS);
    return res;
  } catch (initialError) {
    const remainingCandidates = CANDIDATE_BASE_URLS.filter((b) => b !== currentBase);

    for (const candidate of remainingCandidates) {
      try {
        const fallbackUrl = `${candidate}${endpointPath}`;
        const fallbackRes = await executeAuthFetch(fallbackUrl, options, 3000);
        // If candidate responded (even with 4xx), the host is alive
        setApiBaseUrl(candidate);
        return fallbackRes;
      } catch {
        // Try next candidate
      }
    }

    throw new Error(
      'Unable to connect to authentication service. Please verify the backend server is running.'
    );
  }
}

/**
 * Extracts JWT token from the Set-Cookie response header if present.
 */
function extractTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/token=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Authenticates user credentials with the backend API.
 */
export async function loginApi(credentials: LoginCredentials): Promise<{
  result: AuthResult;
  token: string | null;
}> {
  try {
    const response = await authFetchWithFallback(API_ENDPOINTS.login, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
      }),
    });

    let data: any = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    const setCookie = response.headers.get('set-cookie') || response.headers.get('Set-Cookie');
    const token = data?.token || extractTokenFromCookie(setCookie);

    if (response.ok && data?.success) {
      const user: User = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        status: data.user.status,
      };

      return {
        result: {
          success: true,
          status: user.status,
          user,
        },
        token,
      };
    }

    // Handle approval status responses (403 Forbidden)
    if (response.status === 403) {
      return {
        result: {
          success: false,
          status: data?.status || 'PENDING',
          message:
            data?.message ||
            'Your registration is waiting for administrator approval.',
        },
        token: null,
      };
    }

    // Handle invalid credentials (401)
    if (response.status === 401) {
      return {
        result: {
          success: false,
          message: data?.message || 'Invalid email or password.',
        },
        token: null,
      };
    }

    // Other validation errors (400) or server error (500)
    return {
      result: {
        success: false,
        message: data?.message || 'Login failed. Please check your credentials.',
      },
      token: null,
    };
  } catch (error: any) {
    console.error('Login network error:', error);
    return {
      result: {
        success: false,
        message:
          'Unable to connect to the ShopEasy server. Please verify network connectivity.',
      },
      token: null,
    };
  }
}

/**
 * Registers a new customer account with the backend API.
 */
export async function registerApi(data: RegisterData): Promise<AuthResult> {
  try {
    const response = await authFetchWithFallback(API_ENDPOINTS.register, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        password: data.password,
      }),
    });

    let resData: any = {};
    try {
      resData = await response.json();
    } catch {
      resData = {};
    }

    if (response.ok && resData?.success) {
      const user: User = {
        id: resData.user.id,
        name: resData.user.name,
        email: resData.user.email,
        role: resData.user.role,
        status: resData.user.status || 'PENDING',
      };

      return {
        success: true,
        message:
          resData.message ||
          'Your registration request has been submitted for administrator approval.',
        status: user.status,
        user,
      };
    }

    // Conflict (409) or bad request (400)
    return {
      success: false,
      status: resData?.status,
      message: resData?.message || 'Registration failed. Please try again.',
    };
  } catch (error: any) {
    console.error('Registration network error:', error);
    return {
      success: false,
      message:
        'Unable to connect to the ShopEasy server. Please verify network connectivity.',
    };
  }
}

/**
 * Checks registration status of an email address.
 */
export async function getRegistrationStatusApi(email: string): Promise<{
  success: boolean;
  status?: string;
  name?: string;
  message?: string;
}> {
  try {
    const response = await authFetchWithFallback(
      API_ENDPOINTS.registrationStatus(email.trim().toLowerCase())
    );
    const data = await response.json();
    if (response.ok && data?.success) {
      return {
        success: true,
        status: data.status,
        name: data.name,
      };
    }
    return {
      success: false,
      message: data?.message || 'Could not check status.',
    };
  } catch {
    return {
      success: false,
      message: 'Network error checking registration status.',
    };
  }
}

/**
 * Fetches and verifies the authenticated user profile from backend database.
 */
export async function getProfileApi(token: string): Promise<{
  success: boolean;
  user?: User;
  expired?: boolean;
}> {
  try {
    const cleanToken = (token || '').trim();
    if (!cleanToken) {
      return { success: false, expired: true };
    }

    // Require standard 3-part JWT format to avoid sending non-JWT mock tokens to local backend
    if (cleanToken.split('.').length !== 3) {
      return { success: false };
    }

    const response = await authFetchWithFallback(API_ENDPOINTS.authMe, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${cleanToken}`,
        Cookie: `token=${cleanToken}`,
      },
    });

    if (response.status === 401) {
      return { success: false, expired: true };
    }

    const data = await response.json();
    if (response.ok && data?.success && data?.user) {
      return {
        success: true,
        user: {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
          status: data.user.status,
        },
      };
    }

    return { success: false };
  } catch {
    return { success: false };
  }
}

