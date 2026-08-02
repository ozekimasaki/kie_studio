import { createProvider, type Model } from '@earendil-works/pi-ai';
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';
import { setProvider } from '@flue/runtime';
import { fetchCredentials, type LlmCredentials } from './kieClient.ts';
import { ALIBABA_MODELS, BUILTIN_ENV_VARS, customProviderId } from './llmCatalog.ts';

/**
 * Provider registration for the studio agent.
 *
 * Built-in providers (google/xai/openai/anthropic) read their API keys from
 * process.env — we bridge the studio's encrypted SQLite settings into env
 * vars, refreshed from the backend on a timer so GUI edits take effect
 * without a restart. Alibaba and user-defined compatible endpoints are
 * registered as custom providers whose auth resolves per request.
 */

const REFRESH_MS = 15_000;

let refreshing: Promise<void> | null = null;
let lastCredentials: LlmCredentials | null = null;

function bridgeEnv(credentials: LlmCredentials): void {
	const keys = new Map(credentials.providers.map((p) => [p.id, p.apiKey]));
	for (const [providerId, envVar] of Object.entries(BUILTIN_ENV_VARS)) {
		const key = keys.get(providerId);
		if (key) {
			process.env[envVar] = key;
		} else {
			delete process.env[envVar];
		}
	}
}

function alibabaModel(id: string): Model<'openai-completions'> {
	return {
		id,
		name: id,
		api: 'openai-completions',
		provider: 'alibaba',
		baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
		reasoning: false,
		input: ['text'],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128_000,
		maxTokens: 8_192,
	};
}

function registerAlibaba(): void {
	setProvider(
		createProvider({
			id: 'alibaba',
			name: 'Alibaba (DashScope)',
			auth: {
				apiKey: {
					name: 'DashScope API key',
					resolve: async () => {
						const key = lastCredentials?.providers.find((p) => p.id === 'alibaba')?.apiKey;
						if (!key) return undefined;
						return { auth: { apiKey: key } };
					},
				},
			},
			models: ALIBABA_MODELS.map(alibabaModel),
			api: openAICompletionsApi(),
		}),
	);
}

function registerCustomEndpoints(credentials: LlmCredentials): void {
	for (const endpoint of credentials.customEndpoints) {
		const models: Model<'openai-completions'>[] = endpoint.models.map((id) => ({
			id,
			name: id,
			api: 'openai-completions',
			provider: customProviderId(endpoint.id),
			baseUrl: endpoint.baseUrl,
			reasoning: false,
			input: ['text'],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 128_000,
			maxTokens: 8_192,
		}));
		const modelsAnthropic: Model<'anthropic-messages'>[] = endpoint.models.map((id) => ({
			id,
			name: id,
			api: 'anthropic-messages',
			provider: customProviderId(endpoint.id),
			baseUrl: endpoint.baseUrl,
			reasoning: false,
			input: ['text'],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: 200_000,
			maxTokens: 8_192,
		}));
		if (endpoint.kind === 'openai-compatible') {
			setProvider(
				createProvider({
					id: customProviderId(endpoint.id),
					name: endpoint.label,
					auth: {
						apiKey: {
							name: `${endpoint.label} API key`,
							resolve: async () => {
								const current = lastCredentials?.customEndpoints.find(
									(e) => e.id === endpoint.id,
								);
								if (!current?.apiKey) return undefined;
								return { auth: { apiKey: current.apiKey } };
							},
						},
					},
					models,
					api: openAICompletionsApi(),
				}),
			);
		} else {
			setProvider(
				createProvider({
					id: customProviderId(endpoint.id),
					name: endpoint.label,
					auth: {
						apiKey: {
							name: `${endpoint.label} API key`,
							resolve: async () => {
								const current = lastCredentials?.customEndpoints.find(
									(e) => e.id === endpoint.id,
								);
								if (!current?.apiKey) return undefined;
								return { auth: { apiKey: current.apiKey } };
							},
						},
					},
					models: modelsAnthropic,
					api: anthropicMessagesApi(),
				}),
			);
		}
	}
}

/** Current default model from studio settings (null until first refresh). */
export function getDefaultModel(): { provider: string; model: string } | null {
	return lastCredentials?.defaultModel ?? null;
}
export async function refreshProviders(): Promise<void> {
	refreshing ??= (async () => {
		try {
			const credentials = await fetchCredentials();
			lastCredentials = credentials;
			bridgeEnv(credentials);
			registerAlibaba();
			registerCustomEndpoints(credentials);
		} catch (error) {
			console.warn('[agent] failed to refresh LLM credentials:', error);
		} finally {
			refreshing = null;
		}
	})();
	return refreshing;
}

/** Boot-time registration plus the periodic credential refresh. */
export async function initProviders(): Promise<void> {
	await refreshProviders();
	const timer = setInterval(() => {
		void refreshProviders();
	}, REFRESH_MS);
	timer.unref?.();
}