/**
 * Loopback client for the studio backend's internal API.
 * The agent server never holds the KIE key or LLM keys itself — it resolves
 * credentials and drives generation through the backend on 127.0.0.1.
 */

const DEFAULT_BASE = 'http://127.0.0.1:8787';
// Must match server/routes/agentInternal.ts INTERNAL_TOKEN_DEFAULT.
const DEFAULT_TOKEN = 'kie-studio-agent-dev';

function apiBase(): string {
	return process.env.STUDIO_API_BASE ?? DEFAULT_BASE;
}

function token(): string {
	return process.env.STUDIO_AGENT_TOKEN ?? DEFAULT_TOKEN;
}

export class StudioApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = 'StudioApiError';
	}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${apiBase()}${path}`, {
		...init,
		headers: {
			'content-type': 'application/json',
			'x-studio-agent-token': token(),
			...init?.headers,
		},
	});
	const text = await res.text();
	if (!res.ok) {
		let message = text;
		try {
			const parsed = JSON.parse(text) as { error?: string };
			if (parsed.error) message = parsed.error;
		} catch {
			// keep raw text
		}
		throw new StudioApiError(message, res.status);
	}
	const body = JSON.parse(text) as { data?: T };
	return (body.data ?? body) as T;
}

export interface LlmCredentials {
	providers: { id: string; apiKey: string }[];
	customEndpoints: {
		id: string;
		label: string;
		kind: 'openai-compatible' | 'anthropic-compatible';
		baseUrl: string;
		models: string[];
		apiKey: string;
	}[];
	defaultModel: { provider: string; model: string } | null;
}

export function fetchCredentials(): Promise<LlmCredentials> {
	return request<LlmCredentials>('/api/internal/agent/credentials');
}

export interface WorkflowSummary {
	id: string;
	model: string;
	title: string;
	category: 'image' | 'video' | 'audio';
	provider: string;
	operation: string;
	useCase: string | null;
	tags: string[];
	requiredFields: string[];
	optionalFields: string[];
	docsUrl: string | null;
}

export function listWorkflows(params: {
	category?: string;
	capability?: string;
	q?: string;
}): Promise<{ items: WorkflowSummary[] }> {
	const search = new URLSearchParams();
	if (params.category) search.set('category', params.category);
	if (params.capability) search.set('capability', params.capability);
	if (params.q) search.set('q', params.q);
	const qs = search.toString();
	return request<{ items: WorkflowSummary[] }>(
		`/api/internal/agent/workflows${qs ? `?${qs}` : ''}`,
	);
}

export interface WorkflowField {
	name: string;
	type: string;
	label: string;
	required?: boolean;
	default?: unknown;
	enum?: string[];
	description?: string;
	maxLength?: number;
	min?: number;
	max?: number;
	step?: number;
	accept?: string;
	scalar?: boolean;
	maxItems?: number;
}

export interface WorkflowSchema {
	id: string;
	model: string;
	title: string;
	category: 'image' | 'video' | 'audio';
	provider: string;
	operation: string;
	useCase?: string;
	tags?: string[];
	docsUrl?: string;
	fields: WorkflowField[];
}

export function getWorkflowSchema(id: string): Promise<WorkflowSchema> {
	return request<WorkflowSchema>(
		`/api/internal/agent/workflow-schema?id=${encodeURIComponent(id)}`,
	);
}

export function generateMedia(input: {
	provider: string;
	operation: string;
	model: string;
	input: Record<string, unknown>;
	workflowId?: string;
	title?: string;
}): Promise<{ taskId: string }> {
	return request<{ taskId: string }>('/api/internal/agent/generate', {
		method: 'POST',
		body: JSON.stringify(input),
	});
}

export interface TaskStatus {
	taskId: string;
	state: string;
	resultUrls: string[];
	media: { kind: string; url?: string; streamUrl?: string; localPath?: string }[];
	failMsg?: string;
	creditsConsumed?: number;
	progress?: number;
}

export function getTaskStatus(params: {
	taskId: string;
	provider?: string;
	operation?: string;
}): Promise<TaskStatus> {
	const search = new URLSearchParams({ taskId: params.taskId });
	if (params.provider) search.set('provider', params.provider);
	if (params.operation) search.set('operation', params.operation);
	return request<TaskStatus>(`/api/internal/agent/task?${search}`);
}

export interface HistorySummary {
	taskId: string;
	model: string;
	category: string;
	state: string;
	createdAt: number;
	resultUrls: string[];
	prompt: string | null;
	provider: string;
	operation: string;
}

export function searchHistory(params: {
	q?: string;
	category?: string;
	limit?: number;
}): Promise<{ items: HistorySummary[] }> {
	const search = new URLSearchParams();
	if (params.q) search.set('q', params.q);
	if (params.category) search.set('category', params.category);
	if (params.limit) search.set('limit', String(params.limit));
	const qs = search.toString();
	return request<{ items: HistorySummary[] }>(
		`/api/internal/agent/history${qs ? `?${qs}` : ''}`,
	);
}

export interface TaskInputSnapshot {
	taskId: string;
	model: string;
	modelId: string | null;
	provider: string;
	operation: string;
	input: Record<string, unknown> | null;
	prompt: string | null;
	state: string;
}

export function getTaskInput(taskId: string): Promise<TaskInputSnapshot> {
	return request<TaskInputSnapshot>(
		`/api/internal/agent/history/${encodeURIComponent(taskId)}/input`,
	);
}

export function getCredits(): Promise<{ credits: number | null }> {
	return request<{ credits: number | null }>('/api/internal/agent/credits');
}

export interface OptimizePromptResult {
	optimizedPrompt: string;
	mode: string;
	profile: { family: string; label: string };
}

export function optimizePrompt(input: {
	prompt: string;
	modelId?: string;
}): Promise<OptimizePromptResult> {
	return request<OptimizePromptResult>('/api/optimize-prompt', {
		method: 'POST',
		body: JSON.stringify({ prompt: input.prompt, modelId: input.modelId, mode: 'optimize' }),
	});
}