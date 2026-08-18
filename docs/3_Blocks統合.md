# AWS Blocksの統合

前章で作ったTodoアプリに、AWS Blocksの`Agent`を使ってAIアシスタント機能を追加します。

## Agentの追加

**作業目安：15分**

1. `aws-blocks/index.ts`に`Agent`を追加します。ユーザーの指示でTodoを追加・一覧取得できるツールを持たせます。`import`文に`Agent`・`BedrockModels`・`OllamaModels`を追加します。

```typescript title="aws-blocks/index.ts(追記)"
import { Scope, AuthCognito, DistributedTable, ApiNamespace, Agent, BedrockModels, OllamaModels } from '@aws-blocks/blocks';
import { z } from 'zod';

// scope・auth・todoSchema・todosの宣言はそのまま

const agent = new Agent(scope, 'ai', {
  model: {
    deployed: BedrockModels.BALANCED,
    local: OllamaModels.SMALL,
  },
  systemPrompt: 'あなたはTodoアプリのアシスタントです。ユーザーの指示に応じてTodoを追加・完了します。',
  toolContextSchema: z.object({ owner: z.string() }),
  tools: (tool) => ({
    addTodo: tool({
      description: 'Todoを新しく追加する',
      parameters: z.object({ text: z.string().describe('Todoの内容') }),
      handler: async ({ input, context }) => {
        const id = `todo-${Date.now().toString(36)}`;
        const todo = { id, text: input.text, done: false, owner: context.owner };
        await todos.put(todo);
        return todo;
      },
    }),
    listMyTodos: tool({
      description: '自分のTodo一覧を取得する',
      parameters: z.object({}),
      handler: async ({ context }) => {
        return await Array.fromAsync(todos.query({ where: { owner: { equals: context.owner } } }));
      },
    }),
  }),
});
```

> [!NOTE]
>
> `local: OllamaModels.SMALL`が指定されているため、`npm run blocks:dev`のローカル開発中はOllamaでAgentを動かせます（別途Ollamaのインストールが必要です）。AWSへデプロイした際は`deployed: BedrockModels.BALANCED`が使われ、Amazon Bedrockを呼び出します。

## チャット用APIの追加

**作業目安：10分**

`aws-blocks/index.ts`の`ApiNamespace`に、Agentとチャットするためのメソッドを追加します。

```typescript title="aws-blocks/index.ts(抜粋)"
export const api = new ApiNamespace(scope, 'api', (context) => ({
  // 前章のTodo CRUDメソッドはそのまま

  async createConversation() {
    const user = await auth.requireAuth(context);
    return { conversationId: await agent.createConversationId(user.username) };
  },
  async sendChatMessage(conversationId: string, message: string, channelId: string) {
    const user = await auth.requireAuth(context);
    await agent.stream(message, { conversationId, channelId, userId: user.username, context: { owner: user.username } });
  },
  async getChatHistory(conversationId: string) {
    await auth.requireAuth(context);
    return { messages: await agent.getConversation(conversationId) };
  },
  async getAgentChannel(channelId: string) {
    return await agent.getChannel(channelId);
  },
}));
```

`agent.getConversation()`が返す`Message[]`(`messageId`/`role`/`content`/`contentType`/`createdAt`/`metadata`)を、そのまま`{ messages: [...] }`でラップして返している点に注意してください。フロントエンド側の`useChat`が期待する形(`{ messages: { role, content }[] }`)に合わせるためです。

## フロントエンドへのチャットUI追加

**作業目安：15分**

1. Blocks側のAPIクライアントを再生成します。

```shell
npm run blocks:generate-client
```

2. `src/App.tsx`に、`useChat`のimport・初期化・チャット欄のUIを追加します。`useChat`はReact非依存のフレームワーク非依存フックなので、`useRef`で1回だけ初期化します。前章の`TodoSection`の下にチャット欄を追加する形にします。

<details>
<summary>src/App.tsx(全文)</summary>

```tsx
import { useEffect, useRef, useState } from 'react'
import { api, authApi } from 'aws-blocks'
import { Authenticator, onAuthChange } from '@aws-blocks/blocks/ui'
import { useChat } from '@aws-blocks/bb-agent/client'

type Todo = { id: string; text: string; done: boolean; owner: string }
type User = { userId: string; username: string }

function TodoSection({ user }: { user: User }) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [text, setText] = useState('')

  const refresh = async () => setTodos(await api.listTodos())

  useEffect(() => { refresh() }, [])

  async function addTodo() {
    if (text.trim() === '') return
    await api.createTodo(text)
    setText('')
    await refresh()
  }

  async function toggleTodo(todo: Todo) {
    await api.toggleTodo(todo.id, !todo.done)
    await refresh()
  }

  async function deleteTodo(id: string) {
    await api.deleteTodo(id)
    await refresh()
  }

  return (
    <section id="todo">
      <p>ようこそ、{user.username} さん</p>
      <h1>TODO</h1>
      <div className="todo-form">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="やることを入力" />
        <button onClick={addTodo}>追加</button>
      </div>
      <ul className="todo-list">
        {todos.map((todo) => (
          <li key={todo.id} className={todo.done ? 'done' : ''}>
            <input type="checkbox" checked={todo.done} onChange={() => toggleTodo(todo)} />
            <span>{todo.text}</span>
            <button className="delete" onClick={() => deleteTodo(todo.id)}>×</button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ChatSection() {
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const chatRef = useRef<ReturnType<typeof useChat> | null>(null)

  if (!chatRef.current) {
    chatRef.current = useChat({
      api: {
        sendMessage: (conversationId, message, channelId) => api.sendChatMessage(conversationId, message, channelId),
        createConversation: () => api.createConversation(),
        getConversation: (id) => api.getChatHistory(id),
      },
      subscribe: async (channelId, handler) => {
        const channel = await api.getAgentChannel(channelId)
        return channel.subscribe(handler)
      },
      onMessagesChange: (messages) => setChatMessages(messages),
    })
  }

  const sendChat = async () => {
    if (!chatInput.trim()) return
    await chatRef.current!.sendMessage(chatInput.trim())
    setChatInput('')
  }

  return (
    <div>
      <h2>Todoアシスタント</h2>
      <ul>
        {chatMessages.map((m, i) => (<li key={i}><strong>{m.role}:</strong> {m.content}</li>))}
      </ul>
      <input
        value={chatInput}
        onChange={(e) => setChatInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && sendChat()}
        placeholder="牛乳を買うタスクを追加して"
      />
      <button onClick={sendChat}>送信</button>
    </div>
  )
}

function App() {
  const authRef = useRef<HTMLDivElement>(null)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const el = Authenticator(authApi)
    authRef.current?.appendChild(el)
    return () => { authRef.current?.removeChild(el) }
  }, [])

  useEffect(() => onAuthChange(authApi, setUser), [])

  if (!user) {
    return <div ref={authRef} />
  }

  return (
    <>
      <TodoSection user={user} />
      <ChatSection />
    </>
  )
}

export default App
```

</details>

3. チャット欄に「牛乳を買うタスクを追加して」のように入力し、Todo一覧にも反映されることを確認します。

問題なければ、ここまでの成果をコミットしておきましょう。

ここまで確認できたら、次のステップ（[docs/4_ホスティング.md](4_ホスティング.md)）に進んでください。
