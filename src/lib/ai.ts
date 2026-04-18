export type AIProvider = "ollama" | "deepseek" | "qwen" | "openai" | "claude" | "kimi" | "glm" | "remote";

export interface AIModel {
  provider: AIProvider;
  id: string;
  label: string;
  baseUrl: string;
  contextWindow: number;
}

export const AI_MODELS: AIModel[] = [
  // Ollama (local)
  { provider: "ollama",   id: "qwen2.5:14b",             label: "Qwen 2.5 14B (本地)",  baseUrl: "http://localhost:11434",             contextWindow: 32000  },
  { provider: "ollama",   id: "qwen2.5:7b",              label: "Qwen 2.5 7B (本地)",   baseUrl: "http://localhost:11434",             contextWindow: 32000  },
  { provider: "ollama",   id: "qwen2.5:3b",              label: "Qwen 2.5 3B (本地)",   baseUrl: "http://localhost:11434",             contextWindow: 32000  },
  // Cloud providers
  { provider: "deepseek", id: "deepseek-chat",           label: "DeepSeek V3",          baseUrl: "https://api.deepseek.com",           contextWindow: 64000  },
  { provider: "deepseek", id: "deepseek-reasoner",       label: "DeepSeek R1",          baseUrl: "https://api.deepseek.com",           contextWindow: 64000  },
  { provider: "qwen",     id: "qwen-plus",               label: "通义千问 Plus",          baseUrl: "https://dashscope.aliyuncs.com/compatible-mode", contextWindow: 128000 },
  { provider: "qwen",     id: "qwen-turbo",              label: "通义千问 Turbo",         baseUrl: "https://dashscope.aliyuncs.com/compatible-mode", contextWindow: 128000 },
  { provider: "kimi",     id: "moonshot-v1-8k",          label: "Kimi 8K",              baseUrl: "https://api.moonshot.cn",            contextWindow: 8000   },
  { provider: "kimi",     id: "moonshot-v1-32k",         label: "Kimi 32K",             baseUrl: "https://api.moonshot.cn",            contextWindow: 32000  },
  { provider: "glm",      id: "glm-4-flash",             label: "智谱 GLM-4 Flash",      baseUrl: "https://open.bigmodel.cn/api/paas", contextWindow: 128000 },
  { provider: "glm",      id: "glm-4",                   label: "智谱 GLM-4",            baseUrl: "https://open.bigmodel.cn/api/paas", contextWindow: 128000 },
  { provider: "openai",   id: "gpt-4o-mini",             label: "GPT-4o Mini",          baseUrl: "https://api.openai.com",            contextWindow: 128000 },
  { provider: "openai",   id: "gpt-4o",                  label: "GPT-4o",               baseUrl: "https://api.openai.com",            contextWindow: 128000 },
  { provider: "claude",   id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5",   baseUrl: "https://api.anthropic.com",         contextWindow: 200000 },
  { provider: "claude",   id: "claude-sonnet-4-6",       label: "Claude Sonnet 4.6",    baseUrl: "https://api.anthropic.com",         contextWindow: 200000 },
  // Remote proxy (user-configured URL)
  { provider: "remote",   id: "remote-qwen2.5:14b",      label: "远程代理 Qwen 2.5 14B",  baseUrl: "remote",                             contextWindow: 32000  },
  { provider: "remote",   id: "remote-qwen2.5:7b",       label: "远程代理 Qwen 2.5 7B",   baseUrl: "remote",                             contextWindow: 32000  },
];

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICallOptions {
  model: AIModel;
  apiKey: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  onChunk?: (text: string) => void; // streaming callback
  remoteUrl?: string; // override base URL for remote provider
}

// Build the correct API path for each provider
function getApiUrl(model: AIModel, remoteUrl?: string): string {
  if (model.provider === "remote") {
    const base = (remoteUrl ?? "").replace(/\/$/, "");
    return `${base}/v1/chat/completions`;
  }
  switch (model.provider) {
    case "claude":
      return `${model.baseUrl}/v1/messages`;
    case "glm":
      return `${model.baseUrl}/v4/chat/completions`;
    default:
      return `${model.baseUrl}/v1/chat/completions`;
  }
}

// Build request headers
function getHeaders(model: AIModel, apiKey: string): Record<string, string> {
  const base: Record<string, string> = { "Content-Type": "application/json" };
  if (model.provider === "claude") {
    return { ...base, "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
  }
  // Ollama accepts any Bearer token (or none); remote uses access token
  const key = model.provider === "ollama" ? "ollama" : apiKey;
  const headers: Record<string, string> = { ...base, Authorization: `Bearer ${key}` };
  // ngrok free tier shows a browser warning page unless this header is set
  if (model.provider === "remote") headers["ngrok-skip-browser-warning"] = "true";
  return headers;
}

// Build request body (OpenAI-compatible for most; Anthropic format for Claude)
function getBody(model: AIModel, messages: ChatMessage[], maxTokens: number, temperature: number, stream: boolean): object {
  if (model.provider === "claude") {
    const system = messages.find((m) => m.role === "system")?.content;
    const userMessages = messages.filter((m) => m.role !== "system");
    return {
      model: model.id,
      messages: userMessages,
      ...(system ? { system } : {}),
      max_tokens: maxTokens,
      stream,
    };
  }
  return {
    model: model.id,
    messages,
    max_tokens: maxTokens,
    temperature,
    stream,
  };
}

// Resolve the actual model ID for remote (strip "remote-" prefix)
function resolveModelId(model: AIModel): string {
  if (model.provider === "remote") return model.id.replace(/^remote-/, "");
  return model.id;
}

// Non-streaming call — returns full text
export async function aiComplete(options: AICallOptions): Promise<string> {
  const { model, apiKey, messages, maxTokens = 1024, temperature = 0.7, remoteUrl } = options;
  const resolvedModel = { ...model, id: resolveModelId(model) };
  const res = await fetch(getApiUrl(model, remoteUrl), {
    method: "POST",
    headers: getHeaders(resolvedModel, apiKey),
    body: JSON.stringify(getBody(resolvedModel, messages, maxTokens, temperature, false)),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error ${res.status}: ${err}`);
  }
  const json = await res.json();
  // Anthropic response shape
  if (model.provider === "claude") {
    return json.content?.[0]?.text ?? "";
  }
  return json.choices?.[0]?.message?.content ?? "";
}

// Streaming call — calls onChunk for each delta, returns full text
export async function aiStream(options: AICallOptions): Promise<string> {
  const { model, apiKey, messages, maxTokens = 2048, temperature = 0.7, onChunk, remoteUrl } = options;
  const resolvedModel = { ...model, id: resolveModelId(model) };
  const res = await fetch(getApiUrl(model, remoteUrl), {
    method: "POST",
    headers: getHeaders(resolvedModel, apiKey),
    body: JSON.stringify(getBody(resolvedModel, messages, maxTokens, temperature, true)),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI API error ${res.status}: ${err}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        let delta = "";
        if (resolvedModel.provider === "claude") {
          delta = parsed.delta?.text ?? "";
        } else {
          delta = parsed.choices?.[0]?.delta?.content ?? "";
        }
        if (delta) {
          full += delta;
          onChunk?.(delta);
        }
      } catch {
        // ignore malformed SSE lines
      }
    }
  }
  return full;
}
