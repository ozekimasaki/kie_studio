import { describe, expect, it } from 'vitest'
import {
  AGENT_UNAVAILABLE_MESSAGE,
  AGENT_UNAVAILABLE_TYPE,
  agentUnavailableBody,
  formatAgentSendError,
} from './agentUnavailable.ts'

describe('formatAgentSendError', () => {
  it('maps generic Flue 502 request failed to the sidecar guidance', () => {
    expect(formatAgentSendError(new Error('Flue API error 502: request failed'))).toBe(
      AGENT_UNAVAILABLE_MESSAGE,
    )
  })

  it('maps the Flue envelope type from a 502 proxy body', () => {
    expect(
      formatAgentSendError(
        new Error(`Flue API error 502 [${AGENT_UNAVAILABLE_TYPE}]: ${AGENT_UNAVAILABLE_MESSAGE}`),
      ),
    ).toBe(AGENT_UNAVAILABLE_MESSAGE)
  })

  it('keeps a Flue envelope message that is not the generic 502', () => {
    expect(
      formatAgentSendError(
        new Error('Flue API error 400 [invalid_initial_data]: provider is required'),
      ),
    ).toBe('provider is required')
  })

  it('passes through non-Flue errors', () => {
    expect(formatAgentSendError(new Error('network down'))).toBe('network down')
  })
})

describe('agentUnavailableBody', () => {
  it('uses the Flue error envelope so SDK shows error.message', () => {
    const body = agentUnavailableBody('http://127.0.0.1:8789: ECONNREFUSED')
    expect(body.error.type).toBe(AGENT_UNAVAILABLE_TYPE)
    expect(body.error.message).toBe(AGENT_UNAVAILABLE_MESSAGE)
    expect(body.error.details).toContain('8789')
  })
})
