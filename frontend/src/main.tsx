import '@fontsource-variable/inter'
import '@radix-ui/themes/styles.css'
import './app/global.css'

import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AppProviders } from '@/app/providers'
import { createQueryClient } from '@/app/query-client'
import { createAppRouter } from '@/app/router'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element in index.html')

// One cache for the whole app, shared by the router's loaders and the components.
const queryClient = createQueryClient()
const router = createAppRouter(queryClient)

createRoot(root).render(
  <StrictMode>
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
