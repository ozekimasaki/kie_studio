'use agent';
import { useDataWriter, useInitialData, useModel, useTool } from '@flue/runtime';
import * as v from 'valibot';
import {
	generateMedia,
	getCredits,
	getTaskInput,
	getTaskStatus,
	getWorkflowSchema,
	listWorkflows,
	optimizePrompt,
	searchHistory,
	StudioApiError,
} from '../kieClient.ts';
import { FALLBACK_MODEL } from '../llmCatalog.ts';
import { getDefaultModel } from '../providers.ts';

const MAX_WORKFLOW_ITEMS = 30;

const mediaTaskSchema = v.object({
	taskId: v.string(),
	title: v.optional(v.string()),
	workflowId: v.optional(v.string()),
	status: v.picklist(['submitted', 'succeeded', 'failed']),
	resultUrls: v.optional(v.array(v.string())),
	media: v.optional(
		v.array(
			v.object({
				kind: v.string(),
				url: v.optional(v.string()),
				localPath: v.optional(v.string()),
			}),
		),
	),
	error: v.optional(v.string()),
});

const workflowSummarySchema = v.object({
	id: v.string(),
	model: v.string(),
	title: v.string(),
	category: v.picklist(['image', 'video', 'audio']),
	provider: v.string(),
	operation: v.string(),
	useCase: v.nullable(v.string()),
	tags: v.array(v.string()),
	requiredFields: v.array(v.string()),
	optionalFields: v.array(v.string()),
	docsUrl: v.nullable(v.string()),
});

const historySummarySchema = v.object({
	taskId: v.string(),
	model: v.string(),
	category: v.string(),
	state: v.string(),
	createdAt: v.number(),
	resultUrls: v.array(v.string()),
	prompt: v.nullable(v.string()),
	provider: v.string(),
	operation: v.string(),
});

function errorMessage(error: unknown): string {
	if (error instanceof StudioApiError) return error.message;
	if (error instanceof Error) return error.message;
	return String(error);
}

export function Studio() {
	const initialData = useInitialData<{ provider: string; model: string } | undefined>();
	const fallback = getDefaultModel() ?? FALLBACK_MODEL;
	const provider = initialData?.provider ?? fallback.provider;
	const model = initialData?.model ?? fallback.model;
	useModel(`${provider}/${model}`);

	// Declared unconditionally on every render (structural identity rule).
	const writeMediaTask = useDataWriter('media-task', { schema: mediaTaskSchema });

	useTool({
		name: 'list-workflows',
		description:
			'生成可能な画像/動画/音声ワークフロー(モデル)の一覧を取得する。category (image/video/audio) や capability (例: lip-sync, upscale, tts) で絞り込める。生成前に必ずこれで候補を確認すること。',
		input: v.object({
			category: v.optional(v.picklist(['image', 'video', 'audio'])),
			capability: v.optional(v.string()),
			q: v.optional(v.string()),
		}),
		output: v.object({
			total: v.number(),
			items: v.array(workflowSummarySchema),
			note: v.optional(v.string()),
		}),
		async run({ data }) {
			const { items } = await listWorkflows(data);
			const trimmed = items.slice(0, MAX_WORKFLOW_ITEMS);
			return {
				output: {
					total: items.length,
					items: trimmed,
					...(items.length > MAX_WORKFLOW_ITEMS
						? { note: `他に ${items.length - MAX_WORKFLOW_ITEMS} 件。capability や q で絞り込んでください。` }
						: {}),
				},
			};
		},
	});

	useTool({
		name: 'get-workflow-schema',
		description:
			'ワークフローの入力スキーマ(必須/任意パラメータ、型、選択肢、デフォルト)を取得する。generate-media の前に必ず呼び、パラメータを推測で埋めないこと。',
		input: v.object({ id: v.string() }),
		output: v.object({
			id: v.string(),
			model: v.string(),
			title: v.string(),
			category: v.string(),
			provider: v.string(),
			operation: v.string(),
			useCase: v.nullable(v.string()),
			docsUrl: v.nullable(v.string()),
			fields: v.array(
				v.object({
					name: v.string(),
					type: v.string(),
					label: v.string(),
					required: v.boolean(),
					default: v.optional(v.unknown()),
					enum: v.optional(v.array(v.string())),
					description: v.optional(v.string()),
					accept: v.optional(v.string()),
					maxLength: v.optional(v.number()),
					min: v.optional(v.number()),
					max: v.optional(v.number()),
				}),
			),
		}),
		async run({ data }) {
			try {
				const schema = await getWorkflowSchema(data.id);
				return {
					output: {
						id: schema.id,
						model: schema.model,
						title: schema.title,
						category: schema.category,
						provider: schema.provider,
						operation: schema.operation,
						useCase: schema.useCase ?? null,
						docsUrl: schema.docsUrl ?? null,
						fields: schema.fields.map((f) => ({
							name: f.name,
							type: f.type,
							label: f.label,
							required: f.required === true,
							...(f.default !== undefined ? { default: f.default } : {}),
							...(f.enum ? { enum: f.enum } : {}),
							...(f.description ? { description: f.description } : {}),
							...(f.accept ? { accept: f.accept } : {}),
							...(f.maxLength ? { maxLength: f.maxLength } : {}),
							...(f.min !== undefined ? { min: f.min } : {}),
							...(f.max !== undefined ? { max: f.max } : {}),
						})),
					},
				};
			} catch (error) {
				return `ワークフローが見つかりません: ${errorMessage(error)}`;
			}
		},
	});

	useTool({
		name: 'generate-media',
		description:
			'画像/動画/音声の生成タスクを作成する。必須: workflowId と input。実行前にユーザーへモデル・主要パラメータ・クレジット消費の見通しを提示して確認を取ること。taskId を即時返す(生成は非同期)。',
		input: v.object({
			workflowId: v.string(),
			input: v.record(v.string(), v.unknown()),
			title: v.optional(v.string()),
		}),
		output: v.object({
			taskId: v.string(),
			workflow: v.string(),
			note: v.string(),
		}),
		async run({ data }) {
			try {
				const schema = await getWorkflowSchema(data.workflowId);
				const created = await generateMedia({
					provider: schema.provider,
					operation: schema.operation,
					model: schema.model,
					input: data.input,
					workflowId: schema.id,
					title: data.title,
				});
				writeMediaTask({
					taskId: created.taskId,
					title: data.title ?? schema.title,
					workflowId: schema.id,
					status: 'submitted',
				});
				return {
					output: {
						taskId: created.taskId,
						workflow: schema.title,
						note: '生成を開始しました。結果は履歴ギャラリーにも表示されます。完了確認には get-task-status を使います。',
					},
				};
			} catch (error) {
				return `生成の開始に失敗しました: ${errorMessage(error)}`;
			}
		},
	});

	useTool({
		name: 'get-task-status',
		description:
			'生成タスクの状態を確認する。成功時は結果メディアの URL を返す。taskId だけでなく provider/operation も generate-media 時の値を使うこと。',
		input: v.object({
			taskId: v.string(),
			provider: v.optional(v.string()),
			operation: v.optional(v.string()),
		}),
		output: v.object({
			taskId: v.string(),
			state: v.string(),
			resultUrls: v.array(v.string()),
			failMsg: v.optional(v.string()),
			creditsConsumed: v.optional(v.number()),
		}),
		async run({ data }) {
			try {
				const task = await getTaskStatus(data);
				if (task.state === 'success' || task.state === 'partial') {
					writeMediaTask({
						taskId: task.taskId,
						status: 'succeeded',
						resultUrls: task.resultUrls,
						media: task.media.map((m) => ({
							kind: m.kind,
							...(m.url ? { url: m.url } : {}),
							...(m.localPath ? { localPath: m.localPath } : {}),
						})),
					});
				} else if (task.state === 'fail') {
					writeMediaTask({
						taskId: task.taskId,
						status: 'failed',
						error: task.failMsg ?? '不明なエラー',
					});
				}
				return {
					output: {
						taskId: task.taskId,
						state: task.state,
						resultUrls: task.resultUrls,
						...(task.failMsg ? { failMsg: task.failMsg } : {}),
						...(task.creditsConsumed !== undefined
							? { creditsConsumed: task.creditsConsumed }
							: {}),
					},
				};
			} catch (error) {
				return `状態の確認に失敗しました: ${errorMessage(error)}`;
			}
		},
	});

	useTool({
		name: 'search-history',
		description: '過去の生成履歴を検索する。タスク ID、モデル名、プロンプト内容で探せる。',
		input: v.object({
			q: v.optional(v.string()),
			category: v.optional(v.picklist(['image', 'video', 'audio'])),
			limit: v.optional(v.number()),
		}),
		output: v.object({ items: v.array(historySummarySchema) }),
		async run({ data }) {
			const { items } = await searchHistory(data);
			return { output: { items } };
		},
	});

	useTool({
		name: 'get-task-input',
		description:
			'過去タスクの入力パラメータを取得する。延長・再生成・パラメータ変更での再実行のベースにする。',
		input: v.object({ taskId: v.string() }),
		output: v.object({
			taskId: v.string(),
			model: v.string(),
			modelId: v.nullable(v.string()),
			provider: v.string(),
			operation: v.string(),
			input: v.nullable(v.record(v.string(), v.unknown())),
			prompt: v.nullable(v.string()),
			state: v.string(),
		}),
		async run({ data }) {
			try {
				const snapshot = await getTaskInput(data.taskId);
				return { output: snapshot };
			} catch (error) {
				return `タスクが見つかりません: ${errorMessage(error)}`;
			}
		},
	});

	useTool({
		name: 'get-credit-balance',
		description: 'kie.ai のクレジット残高を確認する。高コストな生成の前に確認するとよい。',
		input: v.object({}),
		output: v.object({ credits: v.nullable(v.number()) }),
		async run() {
			try {
				const { credits } = await getCredits();
				return { output: { credits } };
			} catch (error) {
				return `残高の確認に失敗しました: ${errorMessage(error)}`;
			}
		},
	});

	useTool({
		name: 'optimize-prompt',
		description:
			'プロンプトを対象モデル向けに最適化する(Grok CLI 使用)。ユーザーの意図を聞いた上で、生成前のブラッシュアップとして提案する。',
		input: v.object({
			prompt: v.string(),
			modelId: v.optional(v.string()),
		}),
		output: v.object({ optimizedPrompt: v.string() }),
		async run({ data }) {
			try {
				const result = await optimizePrompt(data);
				return { output: { optimizedPrompt: result.optimizedPrompt } };
			} catch (error) {
				if (error instanceof StudioApiError && error.status === 503) {
					return 'プロンプト最適化は現在利用できません(Grok CLI 未インストール)。手動でプロンプトを整えて進めてください。';
				}
				return `プロンプト最適化に失敗しました: ${errorMessage(error)}`;
			}
		},
	});

	return `あなたは KIE STUDIO のメディア生成アシスタントです。ユーザーと日本語で会話しながら、画像・動画・音声の生成を支援します。

## あなたの役割
- ユーザーの作りたいもの(題材、雰囲気、用途)をヒアリングし、最適なワークフロー(モデル)とプロンプトを提案する
- 生成パラメータの組み立て、生成実行、進捗確認、結果の報告を行う
- 過去の生成物の延長・再生成・パラメータ調整の相談にも応じる

## 生成の手順(必ず守る)
1. list-workflows で候補を探し、用途に合う workflowId を選ぶ
2. get-workflow-schema で入力スキーマを確認する(パラメータを推測で埋めない)
3. ユーザーに「モデル名・主要パラメータ・クレジット消費の見通し」を提示し、明示の承認を得る
4. generate-media で生成を開始する(タスクは非同期。結果は履歴ギャラリーにも並ぶ)
5. 完了確認を求められたら get-task-status を使う

## ルール
- クレジット消費を伴う生成は、必ずユーザーの承認後に実行する
- プロンプト作成に迷ったら optimize-prompt の利用を提案する
- 参照画像/動画/音源が必要なワークフローでは、アップロード済みの URL か添付ファイルを使う。Studio のアップロード機能で得た URL のみ指定できる
- 結果の報告は簡潔に。失敗時は failMsg を読みやすく伝え、対処(パラメータ変更・別モデル)を提案する
- 返答は日本語で。技術用語(モデル名など)はそのままでよい`;
}

// Conversation creation carries the model selection picked in the UI.
// Optional: omitted selection falls back to the studio default model.
Studio.initialData = v.optional(
	v.object({
		provider: v.string(),
		model: v.string(),
	}),
);