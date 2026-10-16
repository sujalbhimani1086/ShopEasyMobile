import { API_ENDPOINTS } from '../config/api';
import { fetchWithFallback } from './api';
import type {
  Address,
  CreateAddressPayload,
  UpdateAddressPayload,
} from '../types/address';

function buildAuthHeaders(token: string) {
  const clean = token.trim();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Cookie: `token=${clean}`,
    Authorization: `Bearer ${clean}`,
  };
}

export async function getAddresses(token: string): Promise<Address[]> {
  if (!token) throw new Error('Authentication required.');

  const res = await fetchWithFallback(API_ENDPOINTS.addresses, {
    method: 'GET',
    headers: buildAuthHeaders(token),
  });

  if (!res.ok) {
    throw new Error(`Failed to load addresses: HTTP ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data?.addresses) ? data.addresses : [];
}

export async function createAddress(
  payload: CreateAddressPayload,
  token: string
): Promise<Address> {
  if (!token) throw new Error('Authentication required.');

  const res = await fetchWithFallback(API_ENDPOINTS.addresses, {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || 'Could not save address.');
  }

  return data.address;
}

export async function updateAddress(
  id: number,
  payload: UpdateAddressPayload,
  token: string
): Promise<Address> {
  if (!token) throw new Error('Authentication required.');

  const res = await fetchWithFallback(API_ENDPOINTS.address(id), {
    method: 'PUT',
    headers: buildAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || 'Could not update address.');
  }

  return data.address;
}

export async function deleteAddress(id: number, token: string): Promise<void> {
  if (!token) throw new Error('Authentication required.');

  const res = await fetchWithFallback(API_ENDPOINTS.address(id), {
    method: 'DELETE',
    headers: buildAuthHeaders(token),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || 'Could not delete address.');
  }
}

export async function setDefaultAddress(id: number, token: string): Promise<Address> {
  if (!token) throw new Error('Authentication required.');

  const res = await fetchWithFallback(API_ENDPOINTS.defaultAddress(id), {
    method: 'PATCH',
    headers: buildAuthHeaders(token),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || 'Could not set default address.');
  }

  return data.address;
}
