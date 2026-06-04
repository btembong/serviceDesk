"use client";

export const TOKEN_KEY = "ubf_access_token";
export const REFRESH_KEY = "ubf_refresh_token";
export const USER_KEY = "ubf_user";

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "CUSTOMER" | "AGENT" | "ADMIN";
  accountNumber?: string;
  phone?: string;
  notifyEmail: boolean;
  notifySms: boolean;
};

export const saveAuth = (accessToken: string, refreshToken: string, user: User) => {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const getUser = (): User | null => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
};
