/**
 * Evolution API client for WhatsApp integration
 * Configure via workspace settings or environment variables
 */

const BASE_URL = import.meta.env.VITE_EVOLUTION_API_URL || 'https://whatsappapi.winhub.com.br';
const API_KEY = import.meta.env.VITE_EVOLUTION_API_KEY || '';
const INSTANCE = import.meta.env.VITE_EVOLUTION_INSTANCE_NAME || 'sdrai-whatsapp';

const headers = {
  'Content-Type': 'application/json',
  apikey: API_KEY,
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.response?.message?.[0] || error.message || 'Erro na API');
  }
  return res.json();
}

export async function createInstance() {
  return request<{
    instance: { instanceName: string; instanceId: string; status: string };
    hash: { apikey: string };
  }>('/instance/create', {
    method: 'POST',
    body: JSON.stringify({
      instanceName: INSTANCE,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
      rejectCall: false,
      groupsIgnore: true,
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
      syncFullHistory: false,
    }),
  });
}

export async function connectInstance() {
  return request<{ base64: string; code: string; count: number }>(
    `/instance/connect/${INSTANCE}`
  );
}

export type ConnectionState = 'open' | 'close' | 'connecting';

export async function getConnectionState() {
  return request<{ instance: { instanceName: string; state: ConnectionState } }>(
    `/instance/connectionState/${INSTANCE}`
  );
}

export async function logoutInstance() {
  return request<{ status: string }>(`/instance/logout/${INSTANCE}`, {
    method: 'DELETE',
  });
}
