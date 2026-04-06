import { describe, it, expect } from 'vitest';
import { extractExplanation } from './parse-ai-response';

describe('extractExplanation', () => {
  it('extracts text from a standard Responses API output', () => {
    const result = {
      id: 'resp_abc123',
      output: [
        {
          type: 'reasoning',
          content: [{ type: 'reasoning_text', text: 'thinking...' }],
        },
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: 'White has a strong center with pawns on e4 and d4.',
            },
          ],
        },
      ],
    };

    expect(extractExplanation(result)).toBe(
      'White has a strong center with pawns on e4 and d4.'
    );
  });

  it('returns fallback when output is empty array', () => {
    expect(extractExplanation({ output: [] })).toBe('No explanation generated.');
  });

  it('returns fallback when output is missing', () => {
    expect(extractExplanation({})).toBe('No explanation generated.');
  });

  it('returns fallback for null/undefined input', () => {
    expect(extractExplanation(null)).toBe('No explanation generated.');
    expect(extractExplanation(undefined)).toBe('No explanation generated.');
  });

  it('skips reasoning blocks and finds message block', () => {
    const result = {
      output: [
        { type: 'reasoning', content: [{ type: 'reasoning_text', text: 'internal reasoning' }] },
        { type: 'reasoning', content: [{ type: 'reasoning_text', text: 'more reasoning' }] },
        { type: 'message', content: [{ type: 'output_text', text: 'The actual explanation.' }] },
      ],
    };

    expect(extractExplanation(result)).toBe('The actual explanation.');
  });

  it('returns fallback when message has no output_text block', () => {
    const result = {
      output: [
        { type: 'message', content: [{ type: 'some_other_type', text: 'not this' }] },
      ],
    };

    expect(extractExplanation(result)).toBe('No explanation generated.');
  });

  it('returns fallback when message content is empty', () => {
    const result = {
      output: [{ type: 'message', content: [] }],
    };

    expect(extractExplanation(result)).toBe('No explanation generated.');
  });

  it('returns fallback when output_text has empty string', () => {
    const result = {
      output: [
        { type: 'message', content: [{ type: 'output_text', text: '' }] },
      ],
    };

    expect(extractExplanation(result)).toBe('No explanation generated.');
  });

  it('takes first output_text when multiple exist', () => {
    const result = {
      output: [
        {
          type: 'message',
          content: [
            { type: 'output_text', text: 'First explanation.' },
            { type: 'output_text', text: 'Second explanation.' },
          ],
        },
      ],
    };

    expect(extractExplanation(result)).toBe('First explanation.');
  });

  it('handles message with missing content field', () => {
    const result = {
      output: [{ type: 'message' }],
    };

    expect(extractExplanation(result)).toBe('No explanation generated.');
  });
});
