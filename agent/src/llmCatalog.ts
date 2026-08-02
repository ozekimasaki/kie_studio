/**
 * Agent-side copy of the LLM provider catalog essentials.
 * The canonical GUI-facing catalog lives in src/lib/models/llmProviders.ts;
 * agent/ is an independent package (bundled into the desktop app) and keeps
 * its own copy of the non-secret constants it needs.
 */

/** Env vars the built-in Pi providers read, keyed by studio provider id. */
export const BUILTIN_ENV_VARS: Record<string, string> = {
	google: 'GEMINI_API_KEY',
	xai: 'XAI_API_KEY',
	openai: 'OPENAI_API_KEY',
	anthropic: 'ANTHROPIC_API_KEY',
};

/** Alibaba (DashScope) model ids offered by the agent. */
export const ALIBABA_MODELS = ['qwen3-max', 'qwen-plus', 'qwen-flash'] as const;

/** Provider id used in model specifiers for a custom endpoint. */
export function customProviderId(endpointId: string): string {
	return `custom-${endpointId}`;
}

/** Fallback model when the conversation carries no selection. */
export const FALLBACK_MODEL = { provider: 'google', model: 'gemini-3.6-flash' };