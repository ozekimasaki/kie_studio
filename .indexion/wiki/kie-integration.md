# Kie Integration

`server/kie/` が認証、Market、Upload、provider adapter を担当する。

## Adapter

| 実装 | 主な operation |
|------|----------------|
| `adapters/market.ts` | Market create / record detail |
| `adapters/suno.ts` | generate、extend、upload cover/extend、replace、lyrics |
| `adapters/veo.ts` | generate、extend、1080p、4K |
| `adapters/runway.ts` | generate、extend、Aleph |

`adapters/index.ts` の registry から `ProviderAdapter` を取得する。作成結果は `taskId` と、即時完了時だけ normalized task を返す。status、複数 media、partial、期限、provider asset ID、raw payload は `NormalizedTask` へ揃える。

## Market

`market.ts` は result JSON を再帰的に走査して URL を抽出し、モデル名と URL から media kind を判定する。fail でも結果がある場合は `partial`。provider / operation を省略した既存リクエストは Market generate として扱う。

## Suno 補助

timestamped lyrics、waveform、style boost、Persona は adapter の補助関数を専用 route から呼ぶ。Persona は対応モデル・成功音源・一回制限を UI と DB の両方で守る。

## Upload / archive

Upload 名は timestamp を付けて一意化し、元名は表示 metadata として返す。archive は temporary download URL を都度取得し、失敗 media ごとに `.error.txt` を入れる。cached lyrics は media download の成否に関係なく ZIP へ入れる。

## See Also

- [Server API](wiki://server-api)
- [Architecture](wiki://architecture)
- [Core Concepts](wiki://core-concepts)
