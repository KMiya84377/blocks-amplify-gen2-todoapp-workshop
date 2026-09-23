import { useEffect, useRef, useState } from 'react'
import { api, authApi } from 'aws-blocks'
import { Authenticator, onAuthChange } from '@aws-blocks/blocks/ui'
import { useChat } from '@aws-blocks/bb-agent/client'
import './App.css'

type Todo = { id: string; text: string; done: boolean; owner: string }
type User = { userId: string; username: string }

function TodoSection({ user }: { user: User }) {
  const [todos, setTodos] = useState<Todo[]>([])
  const [text, setText] = useState('')

  const refresh = async () => setTodos(await api.listTodos())

  useEffect(() => { refresh() }, [])

  async function addTodo() {
    if (text.trim() === '') {
      return
    }
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
    if (!chatInput.trim()) {
      return
    }
    await chatRef.current!.sendMessage(chatInput.trim())
    setChatInput('')
  }

  return (
    <section id="chat">
      <h2>Todoアシスタント</h2>
      <ul className="chat-list">
        {chatMessages.map((m, i) => (
          <li key={i} className={`chat-message ${m.role}`}>
            <span className="chat-role">{m.role}</span>
            <span>{m.content}</span>
          </li>
        ))}
      </ul>
      <div className="chat-input">
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendChat()}
          placeholder="牛乳を買うタスクを追加して"
        />
        <button onClick={sendChat}>送信</button>
      </div>
    </section>
  )
}

function App() {
  const authRef = useRef<HTMLDivElement>(null)
  const mounted = useRef(false)
  const [user, setUser] = useState<User | null>(null)

  // Authenticator()は複数回呼べないため、初回のみ実行する
  useEffect(() => {
    if (mounted.current || !authRef.current) {
      return
    }
    mounted.current = true
    authRef.current.appendChild(Authenticator(authApi))
  }, [])

  // ログイン状態の変化を監視する
  useEffect(() => onAuthChange(authApi, setUser), [])

  if (!user) {
    return <div ref={authRef} className="app-layout" key="auth" />
  }

  return (
    <div className="app-layout" key="app">
      <TodoSection user={user} />
      <ChatSection />
    </div>
  )
}

export default App
