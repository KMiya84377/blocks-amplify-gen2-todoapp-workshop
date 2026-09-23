# おまけ: KnowledgeBaseでの検索

AWS Blocksの`KnowledgeBase`を使うと、独自のドキュメントをAgentに検索させることができます。

ここでは、LLMが学習データからは知り得ない固有の情報（飼っているペットの名前や餌やりのルール）をmdファイルに書いておき、Agentがそれを検索して「餌をあげるタスク」を提案できるようにします。

> [!NOTE] 前提
>
> 本章は[3_AIアシスタント追加 by AWS Blocks.md](3_AIアシスタント追加%20by%20AWS%20Blocks.md)までの続きです。事前に完了しておいてください。[5_おまけ Todo一覧のリアルタイム自動更新.md](5_おまけ%20Todo一覧のリアルタイム自動更新.md)への依存はありません。

**作業目安：15分**

## ナレッジベース用ドキュメントの作成

1. `todo-app/knowledge/pets.md`を新規作成します。

```markdown title="knowledge/pets.md"
# 飼っているペットの餌やりルール

## モモ（犬・3歳）
朝7時と夜19時に「ロイヤルカナン インドアアダルト」を50gずつ。おやつは1日1回まで。

## レオ（猫・5歳）
朝8時と夜20時に「ヒルズ サイエンス・ダイエット」を30gずつ。水は自動給水器「PetSafe」を毎朝チェック。

## フィン（サメ）
週2回（月・木）の朝10時に、冷凍のイワシを3尾。水槽の水温は24℃を維持すること。
```

## KnowledgeBaseとAgentツールの追加

2. `todo-app/aws-blocks/index.ts`の`import`文に`KnowledgeBase`を追加します。

```typescript title="aws-blocks/index.ts(追記)"
import { Scope, AuthCognito, DistributedTable, ApiNamespace, Agent, BedrockModels, KnowledgeBase } from '@aws-blocks/blocks';
import { z } from 'zod';
```

3. ペット情報を検索する`KnowledgeBase`を追加します。

```typescript title="aws-blocks/index.ts(追記)"
// scope・auth・todoSchema・todosの宣言はそのまま

const petsKb = new KnowledgeBase(scope, 'pets', {
  source: './knowledge',
  description: '飼っているペットの餌やりルール',
});
```

4. Agentに、`petsKb`を検索する`searchPetInfo`ツールを追加します。

```typescript title="aws-blocks/index.ts(抜粋)"
const agent = new Agent(scope, 'ai', {
  // model・systemPrompt・toolContextSchemaの宣言はそのまま
  tools: (tool) => ({
    // addTodo・toggleTodoの宣言はそのまま

    searchPetInfo: tool({
      description: 'ペットの餌やりルール（名前・餌の種類・量・時間）を検索する',
      parameters: z.object({ query: z.string().describe('検索したい内容（例: モモの餌、餌やりのタスク）') }),
      handler: async ({ input }) => {
        const results = await petsKb.retrieve(input.query, { maxResults: 3 });
        return results.map((r) => r.text);
      },
    }),
  }),
});
```

> [!NOTE] `KnowledgeBase.retrieve()`の返り値
>
> `retrieve()`は、関連度の高い順に並んだチャンク（`{ text, score, source, metadata }`）の配列を返します。ここでは`text`（該当箇所の本文）だけをAgentに渡しています。

## 動作確認

5. チャット欄に「餌をあげるタスクを追加して」のように入力します。

6. Agentが`searchPetInfo`でペットの餌やりルールを検索し、モモ・レオ・フィンそれぞれの餌の内容を反映したTodoを追加することを確認できます。

問題なければ、ここまでの成果をコミットしておきましょう。

ここまで確認できたら、次のステップ（[docs/7_後処理.md](7_後処理.md)）に進んでください。
