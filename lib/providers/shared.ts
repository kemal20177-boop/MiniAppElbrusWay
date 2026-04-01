import "server-only";

type ProviderRequestOptions = {
  apiKeyEnv: string;
  baseUrlEnv: string;
  path: string;
  payload: Record<string, unknown>;
  timeoutMs?: number;
};

export type ExternalArtifactResponse = {
  mimeType?: string;
  base64?: string;
  url?: string;
  text?: string;
  fileName?: string;
  metadata?: Record<string, unknown>;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function isProviderConfigured(baseUrlEnv: string, apiKeyEnv: string) {
  return Boolean(process.env[baseUrlEnv] && process.env[apiKeyEnv]);
}

export async function callExternalProvider(options: ProviderRequestOptions) {
  const baseUrl = process.env[options.baseUrlEnv];
  const apiKey = process.env[options.apiKeyEnv];

  if (!baseUrl || !apiKey) {
    throw new Error(`PROVIDER_NOT_CONFIGURED:${options.baseUrlEnv}`);
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || Number(process.env.TOOL_JOB_TIMEOUT_MS || 60000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${trimTrailingSlash(baseUrl)}${options.path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Provider-Key": apiKey
      },
      body: JSON.stringify(options.payload),
      signal: controller.signal,
      cache: "no-store"
    });

    const payload = (await response.json().catch(() => null)) as ExternalArtifactResponse | null;
    if (!response.ok) {
      const message = payload && typeof payload.text === "string" ? payload.text : `PROVIDER_HTTP_${response.status}`;
      throw new Error(message);
    }

    return payload || {};
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("PROVIDER_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveArtifactContent(payload: ExternalArtifactResponse) {
  if (payload.base64) {
    return Buffer.from(payload.base64, "base64");
  }

  if (payload.url) {
    const response = await fetch(payload.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`ARTIFACT_FETCH_FAILED_${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  if (typeof payload.text === "string") {
    return payload.text;
  }

  throw new Error("PROVIDER_EMPTY_ARTIFACT");
}
