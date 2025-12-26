import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 统一代理 /api 开头的请求到后端
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      // 特殊处理 /baidu 路由 (因为它是后端直接跳转，可能不需要 API 前缀，但为了统一建议也加)
      // 如果后端 /baidu 路由也改成了 /api/baidu，则上面的规则已经覆盖
      // 暂时保留旧的兼容，但建议后续都走 /api
      '/baidu': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
