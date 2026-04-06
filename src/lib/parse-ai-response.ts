/**
 * Parse the Cloudflare Workers AI Responses API output.
 *
 * GPT-oss models return a nested structure:
 *   { output: [{ type: 'reasoning', ... }, { type: 'message', content: [{ type: 'output_text', text: '...' }] }] }
 *
 * This extracts the text from the first output_text block inside a message item.
 */

export interface ResponsesApiOutput {
  output?: Array<{
    type: string;
    content?: Array<{ type: string; text?: string }>;
  }>;
}

export function extractExplanation(result: unknown): string {
  const res = result as ResponsesApiOutput;
  if (res?.output) {
    for (const item of res.output) {
      if (item.type === 'message' && item.content) {
        for (const block of item.content) {
          if (block.type === 'output_text' && block.text) {
            return block.text;
          }
        }
      }
    }
  }
  return 'No explanation generated.';
}
