import { Scope, AuthCognito, DistributedTable, ApiNamespace, Agent, BedrockModels } from '@aws-blocks/blocks';
import { z } from 'zod';

const scope = new Scope('a');

const auth = new AuthCognito(scope, 'auth', {
  passwordPolicy: {
    minLength: 8,
    requireDigits: true
  },
  crossDomain: true,
});

export const authApi = auth.createApi();

const todoSchema = z.object({
  id: z.string(),
  text: z.string(),
  done: z.boolean(),
  owner: z.string(),
});

const todos = new DistributedTable(scope, 'todos', {
  schema: todoSchema,
  key: { partitionKey: 'owner', sortKey: 'id' },
});

const agent = new Agent(scope, 'ai', {
  model: {
    deployed: BedrockModels.BALANCED,
  },
  streamingMode: 'token',
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
        return updatedTodo;
      },
    }),
  }),
});

export const api = new ApiNamespace(scope, 'api', (context) => ({
  // 自分のTodoを一覧取得する
  async listTodos() {
    const user = await auth.requireAuth(context);
    const results = [];
    for await (const todo of todos.query({ where: { owner: { equals: user.username } } })) {
      results.push(todo);
    }
    return results;
  },
  // Todoを新しく追加する
  async createTodo(text: string) {
    const user = await auth.requireAuth(context);
    const id = `todo-${Date.now().toString(36)}`;
    const todo = { id, text, done: false, owner: user.username };
    await todos.put(todo);
    return todo;
  },
  // Todoの完了/未完了を切り替える
  async toggleTodo(id: string, done: boolean) {
    const user = await auth.requireAuth(context);
    const owner = user.username;
    const todo = await todos.get({ owner, id });
    if (!todo) {
      throw new Error('not found');
    }
    const updatedTodo = { ...todo, done };
    await todos.put(updatedTodo);
  },
  // Todoを削除する
  async deleteTodo(id: string) {
    const user = await auth.requireAuth(context);
    await todos.delete({ owner: user.username, id });
  },
  // 新しい会話を開始する
  async createConversation() {
    const user = await auth.requireAuth(context);
    return { conversationId: await agent.createConversationId(user.username) };
  },
  // メッセージをAgentに送信する（応答はストリーミングで返る）
  async sendChatMessage(conversationId: string, message: string, channelId: string) {
    const user = await auth.requireAuth(context);
    await agent.stream(message, { conversationId, channelId, userId: user.username, context: { owner: user.username } });
  },
  // 会話の履歴を取得する
  async getChatHistory(conversationId: string) {
    await auth.requireAuth(context);
    return { messages: await agent.getConversation(conversationId) };
  },
  // Agentからのリアルタイム配信を受け取るためのチャンネル情報を取得する
  async getAgentChannel(channelId: string) {
    return await agent.getChannel(channelId);
  },
}));
