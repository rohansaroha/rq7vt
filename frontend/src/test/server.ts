import { setupServer } from 'msw/node'

/** A mock API for component tests; each test registers the responses it needs. */
export const server = setupServer()
