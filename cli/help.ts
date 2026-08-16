export const ROOT_HELP = `kiestudio — KIE STUDIO CLI

Studio API 経由で IMAGE / VIDEO / AUDIO を生成し、結果は Gallery の履歴に載ります。
kie.ai や /api/internal/agent は直接叩きません。

Usage:
  kiestudio <command> [options]

Commands:
  up         Studio API を起動する（既に起動中なら何もしない）
  open       Web UI (http://localhost:5173) を開く
  models     カタログの workflow を一覧する
  generate   生成タスクを作成する（毎回新しい taskId。冪等ではない）
  status     タスク状態を取得する
  history    Gallery 履歴の要約を表示する

Global options:
  -h, --help     ヘルプ
  --json         JSON で出力する
  -V, --version  バージョン

Examples:
  kiestudio up
  kiestudio models --category image flux
  kiestudio generate -m flux-kontext-pro -p "a red bicycle" --wait
  kiestudio status <taskId> --wait
  kiestudio history

API 未起動時は先に \`kiestudio up\` または \`npm run dev\` を実行してください。
接続先は STUDIO_API_BASE、未設定時は 127.0.0.1:8787-8806 を探索します。
`

export const UP_HELP = `kiestudio up

Studio API (Hono) を前面で起動します。既に /api/health が応答していれば何もしません。

Usage:
  kiestudio up

Examples:
  kiestudio up
  STUDIO_API_BASE=http://127.0.0.1:8788 kiestudio up
`

export const OPEN_HELP = `kiestudio open

Web UI をブラウザで開きます。http://localhost:5173 に届かない場合は npm run dev を案内します。

Usage:
  kiestudio open

Examples:
  kiestudio open
`

export const MODELS_HELP = `kiestudio models

カタログの workflow を一覧します。

Usage:
  kiestudio models [--category image|video|audio] [query]

Options:
  --category   image / video / audio で絞る
  --json       JSON で出力する
  -h, --help   ヘルプ

Examples:
  kiestudio models
  kiestudio models --category image
  kiestudio models flux
  kiestudio models --category video seedance --json
`

export const GENERATE_HELP = `kiestudio generate

生成タスクを作成し、Studio 履歴（Gallery）に記録します。
再実行すると別タスクになります（冪等ではありません）。

Usage:
  kiestudio generate -m <id|model> [options]

Options:
  -m, --model <id>     workflow id または model 名（必須）
  -p, --prompt <text>  input.prompt に入れる
  --input <json>       生成 input を JSON で渡す
  --set <key=value>    input の追加フィールド（複数可。value は JSON または文字列）
  --wait               終端状態までポーリングする
  --json               JSON で出力する
  -h, --help           ヘルプ

Examples:
  kiestudio generate -m flux-kontext-pro -p "a red bicycle" --wait
  kiestudio generate -m market/flux-kontext-pro --input '{"prompt":"hi","aspect_ratio":"16:9"}'
  kiestudio generate -m flux-kontext-pro -p "hi" --set aspect_ratio=16:9 --json

結果の管理（ピン・再利用・削除）は Gallery UI で行います。
  kiestudio history
  kiestudio open
`

export const STATUS_HELP = `kiestudio status

タスクの正規化状態を取得します。終端状態は履歴へ mirror されます。

Usage:
  kiestudio status <taskId> [--provider market|suno|veo|runway] [--operation generate] [--wait] [--json]

Options:
  --provider    既定 market
  --operation   既定 generate
  --wait        終端状態までポーリングする
  --json        JSON で出力する
  -h, --help    ヘルプ

Examples:
  kiestudio status 123e4567-e89b --wait
  kiestudio status 123e4567-e89b --provider suno --json
`

export const HISTORY_HELP = `kiestudio history

Gallery と同じ SQLite 履歴の要約を表示します。削除やピンは CLI 第一版ではできません。

Usage:
  kiestudio history [query] [--category image|video|audio] [--json]

Options:
  --category   image / video / audio で絞る
  --json       JSON で出力する
  -h, --help   ヘルプ

Examples:
  kiestudio history
  kiestudio history bicycle
  kiestudio history --category image --json
`
