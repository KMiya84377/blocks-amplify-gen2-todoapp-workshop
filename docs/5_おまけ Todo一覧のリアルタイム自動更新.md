# おまけ: Todo一覧のリアルタイム自動更新

3章まででは、チャットでAgentがTodoを追加・完了しても、画面をリロードするまで一覧に反映されませんでした。

ここでは、AWS Blocksの`Realtime`を使って、Todoが変更された瞬間に一覧が自動更新されるようにします。

> **前提**
> 本章は[3_AIアシスタント追加 by AWS Blocks.md](3_AIアシスタント追加%20by%20AWS%20Blocks.md)までの続きです。事前に完了しておいてください。

**作業目安：15分**

## Realtimeチャンネルの追加

1. `todo-app/aws-blocks/index.ts`の`import`文に`Realtime`を追加します。

```typescript title="aws-blocks/index.ts(追記)"
import { Scope, AuthCognito, DistributedTable, ApiNamespace, Agent, BedrockModels, Realtime } from '@aws-blocks/blocks';
import { z } from 'zod';
```

2. Todo更新の通知用に`Realtime`を追加します。

```typescript title="aws-blocks/index.ts(追記)"
// scope・auth・todoSchema・todos・agentの宣言はそのまま

const todoRealtime = new Realtime(scope, 'todo-updates', {
  namespaces: {
    updates: Realtime.namespace(z.object({ updatedAt: z.number() })),
  },
});
```

3. Todoを変更する箇所（`createTodo`・`toggleTodo`・`deleteTodo`）で、変更後に`todoRealtime.publish()`を呼びます。

```typescript title="aws-blocks/index.ts(抜粋)"
export const api = new ApiNamespace(scope, 'api', (context) => ({
  // listTodosはそのまま

  async createTodo(text: string) {
    const user = await auth.requireAuth(context);
    const id = `todo-${Date.now().toString(36)}`;
    const todo = { id, text, done: false, owner: user.username };
    await todos.put(todo);
    await todoRealtime.publish('updates', user.username, { updatedAt: Date.now() });
    return todo;
  },
  async toggleTodo(id: string, done: boolean) {
    const user = await auth.requireAuth(context);
    const owner = user.username;
    const todo = await todos.get({ owner, id });
    if (!todo) {
      throw new Error('not found');
    }
    const updatedTodo = { ...todo, done };
    await todos.put(updatedTodo);
    await todoRealtime.publish('updates', owner, { updatedAt: Date.now() });
  },
  async deleteTodo(id: string) {
    const user = await auth.requireAuth(context);
    await todos.delete({ owner: user.username, id });
    await todoRealtime.publish('updates', user.username, { updatedAt: Date.now() });
  },

  // createConversation・sendChatMessage・getChatHistory・getAgentChannelはそのまま
}));
```

4. Agentの`addTodo`・`toggleTodo`ツールでも、同様に変更後へ`publish()`を追加します。

```typescript title="aws-blocks/index.ts(抜粋)"
const agent = new Agent(scope, 'ai', {
  // model・systemPrompt・toolContextSchemaの宣言はそのまま
  tools: (tool) => ({
    addTodo: tool({
      description: 'Todoを新しく追加する',
      parameters: z.object({ text: z.string().describe('Todoの内容') }),
      handler: async ({ input, context }) => {
        const id = `todo-${Date.now().toString(36)}`;
        const todo = { id, text: input.text, done: false, owner: context.owner };
        await todos.put(todo);
        await todoRealtime.publish('updates', context.owner, { updatedAt: Date.now() });
        return todo;
      },
    }),
    toggleTodo: tool({
      description: 'テキストが一致するTodoを完了/未完了にする',
      parameters: z.object({
        text: z.string().describe('対象Todoの内容（部分一致で検索）'),
        done: z.boolean().describe('trueで完了、falseで未完了に戻す'),
      }),
      handler: async ({ input, context }) => {
        const myTodos = [];
        for await (const todo of todos.query({ where: { owner: { equals: context.owner } } })) {
          myTodos.push(todo);
        }
        const matches = myTodos.filter((t) => t.text.includes(input.text));
        if (matches.length !== 1) {
          throw new Error(matches.length === 0 ? 'not found' : 'multiple matches');
        }
        const updatedTodo = { ...matches[0], done: input.done };
        await todos.put(updatedTodo);
        await todoRealtime.publish('updates', context.owner, { updatedAt: Date.now() });
        return updatedTodo;
      },
    }),
  }),
});
```

5. Todo更新チャンネルの購読用に、`ApiNamespace`へメソッドを追加します。

```typescript title="aws-blocks/index.ts(抜粋)"
export const api = new ApiNamespace(scope, 'api', (context) => ({
  // 他のメソッドはそのまま

  // Todo更新のRealtimeチャンネルを取得する
  async getTodoChannel() {
    const user = await auth.requireAuth(context);
    return todoRealtime.getChannel('updates', user.username);
  },
}));
```

## フロントエンドで購読する

6. `todo-app/src/App.tsx`の`TodoSection`に、Todo更新チャンネルを購読する`useEffect`を追加します。

```tsx title="src/App.tsx(抜粋)"
function TodoSection({ user }: { user: User }) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [text, setText] = useState('')

  const refresh = async () => setTodos(await api.listTodos())

  useEffect(() => { refresh() }, [])

  // Todo更新のRealtimeチャンネルを購読し、変更のたびに自動で再取得する
  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let cancelled = false
    ;(async () => {
      const channel = await api.getTodoChannel()
      if (cancelled) {
        return
      }
      const sub = channel.subscribe(() => { refresh() })
      unsubscribe = () => sub.unsubscribe()
    })()
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  // addTodo・toggleTodo・deleteTodoはそのまま
}
```

7. チャット欄に「牛乳を買うタスクを追加して」のように入力します。

8. 画面をリロードせずに、Todo一覧へ自動で反映されることを確認できます。

問題なければ、ここまでの成果をコミットしておきましょう。

ここまで確認できたら、次のステップ（[docs/6_おまけ KnowledgeBaseでの検索.md](6_おまけ%20KnowledgeBaseでの検索.md)）に進んでください。
