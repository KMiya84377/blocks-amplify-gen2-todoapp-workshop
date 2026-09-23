import { Scope, AuthCognito, DistributedTable, ApiNamespace } from '@aws-blocks/blocks';
import { z } from 'zod';

const scope = new Scope('app');

const auth = new AuthCognito(scope, 'auth', {
  passwordPolicy: {
    minLength: 8,
    requireDigits: true
  },
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
}));
