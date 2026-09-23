import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const codespaceName = process.env.CODESPACE_NAME
const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN

function rewriteWsUrl(value: unknown): unknown {
  if (typeof value === 'string' && value.startsWith('ws://localhost:')) {
    if (codespaceName && forwardingDomain) {
      return `wss://${codespaceName}-5173.${forwardingDomain}/realtime`
    }
    return value
  }
  if (Array.isArray(value)) return value.map(rewriteWsUrl)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, rewriteWsUrl(v)]))
  }
  return value
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/aws-blocks/api': {
        target: 'http://localhost:3001',
        selfHandleResponse: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, _req, res) => {
            const chunks: Buffer[] = []
            proxyRes.on('data', (chunk) => chunks.push(chunk))
            proxyRes.on('end', () => {
              let body = Buffer.concat(chunks).toString('utf-8')
              try {
                body = JSON.stringify(rewriteWsUrl(JSON.parse(body)))
              } catch {
                // JSONでなければそのまま返す
              }
              // Set-Cookie等、元のレスポンスヘッダーを引き継ぐ
              for (const [key, value] of Object.entries(proxyRes.headers)) {
                if (value !== undefined) res.setHeader(key, value)
              }
              res.setHeader('content-type', 'application/json')
              res.setHeader('content-length', Buffer.byteLength(body))
              res.end(body)
            })
          })
        },
      },
      // Codespaces等、フロントエンドがHTTPS越しに配信される環境では、
      // Blocksのローカルサーバーが返す絶対URL(http://localhost:3001/...)を
      // ブラウザが直接叩けない(Mixed Content)。config.jsonのレスポンスを
      // 書き換え、相対パス(/aws-blocks/api)に差し替えてこのVite自身の
      // サーバー経由(server-to-server)でBlocksへ転送する。
      '/.blocks-sandbox/config.json': {
        target: 'http://localhost:3001',
        selfHandleResponse: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, _req, res) => {
            const chunks: Buffer[] = []
            proxyRes.on('data', (chunk) => chunks.push(chunk))
            proxyRes.on('end', () => {
              let body = Buffer.concat(chunks).toString('utf-8')
              try {
                const json = JSON.parse(body)
                if (json.apiUrl) json.apiUrl = '/aws-blocks/api'
                body = JSON.stringify(json)
              } catch {
                // JSONでなければそのまま返す
              }
              res.setHeader('content-type', 'application/json')
              res.setHeader('content-length', Buffer.byteLength(body))
              res.end(body)
            })
          })
        },
      },
      '/realtime': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
})
