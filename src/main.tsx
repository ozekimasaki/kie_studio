import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LazyMotion } from 'motion/react'
import './index.css'
import App from './App.tsx'

const loadMotionFeatures = () =>
  import('./lib/motionFeatures.ts').then((module) => module.default)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={loadMotionFeatures} strict>
        <App />
      </LazyMotion>
    </QueryClientProvider>
  </StrictMode>,
)
