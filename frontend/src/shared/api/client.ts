import createClient from 'openapi-fetch'

import type { components, paths } from './schema'

/** The API's single error shape (RFC 9457 problem details), from the OpenAPI contract. */
export type Problem = components['schemas']['Problem']

/** Response bodies by schema name, e.g. Schema<'DecisionResponse'>. */
export type Schema<Name extends keyof components['schemas']> = components['schemas'][Name]

/** Typed client: paths, parameters and responses all come from the backend's OpenAPI schema. */
export const api = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? window.location.origin,
  // Look fetch up on every call, so anything that wraps it later (test mocks) is used.
  fetch: (request) => globalThis.fetch(request),
})

export class ApiError extends Error {
  readonly status: number
  readonly problem: Problem | undefined
  /** The X-Request-ID of the failed call, to find it in the API's logs. */
  readonly requestId: string | undefined

  constructor(status: number, problem: Problem | undefined, requestId?: string) {
    super(problem?.detail ?? problem?.title ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
    this.requestId = requestId ?? undefined
  }
}

function isProblem(value: unknown): value is Problem {
  return typeof value === 'object' && value !== null && 'title' in value && 'status' in value
}

/** Turn openapi-fetch's { data, error } result into data, or throw an ApiError. */
export async function unwrap<T>(
  request: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await request
  if (error !== undefined || data === undefined) {
    throw new ApiError(
      response.status,
      isProblem(error) ? error : undefined,
      response.headers.get('x-request-id') ?? undefined,
    )
  }
  return data
}
