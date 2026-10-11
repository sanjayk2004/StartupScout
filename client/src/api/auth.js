export const API_BASE = import.meta.env?.VITE_API_BASE_URL || '';

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error('We could not reach StartupScout. Check your connection and try again.');
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const nestedError = result?.error;
    const message = typeof nestedError === 'string'
      ? nestedError
      : (typeof nestedError?.message === 'string' && nestedError.message) ||
        (typeof result?.message === 'string' && result.message) ||
        'Something went wrong. Please try again.';
    const error = new Error(message);
    error.fields = nestedError?.fields && typeof nestedError.fields === 'object'
      ? nestedError.fields
      : result?.fields && typeof result.fields === 'object' ? result.fields : {};
    throw error;
  }
  return result;
}

export const requestApi = request;

export const authApi = {
  registerInvestor: (data) => request('/auth/register/investor', {
    method: 'POST', body: JSON.stringify(data),
  }),
  registerFounder: (data) => request('/auth/register/founder', {
    method: 'POST', body: JSON.stringify(data),
  }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
};
