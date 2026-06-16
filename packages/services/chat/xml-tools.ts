/**
 * Some OpenAI-compatible providers (e.g. GLM) return tool calls embedded as XML
 * inside the assistant message content instead of the standard `tool_calls` array.
 *
 * Example:
 * <tool_call>get_thread
 *   <arg_key>id</arg_key>
 *   <arg_value>19ed0e362cfc6a4c</arg_value>
 * </tool_call>
 *
 * This module parses those XML blocks into the same shape used by the OpenAI SDK
 * so the rest of the chat loop can execute them uniformly.
 */

export interface XMLToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Parse `<tool_call>` XML blocks from assistant content.
 * Returns the parsed tool calls and the content with the XML blocks removed.
 */
export function parseXMLToolCalls(content: string): {
  toolCalls: XMLToolCall[];
  cleanedContent: string;
} {
  const toolCalls: XMLToolCall[] = [];
  const pattern = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  let match: RegExpExecArray | null;
  let idCounter = 0;

  // eslint-disable-next-line no-cond-assign
  while ((match = pattern.exec(content)) !== null) {
    const block = match[1];
    if (!block) continue;

    const nameMatch = block.match(/^\s*([a-zA-Z0-9_]+)/);
    const name = nameMatch?.[1] ?? "";
    if (!name) continue;

    const args: Record<string, unknown> = {};
    const keyValuePattern = /<arg_key>([\s\S]*?)<\/arg_key>\s*<arg_value>([\s\S]*?)<\/arg_value>/g;
    let kvMatch: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((kvMatch = keyValuePattern.exec(block)) !== null) {
      const key = kvMatch[1]?.trim() ?? "";
      const value = kvMatch[2]?.trim() ?? "";
      if (key) args[key] = value;
    }

    idCounter += 1;
    toolCalls.push({
      id: `xml-call-${idCounter}`,
      type: "function",
      function: {
        name,
        arguments: JSON.stringify(args),
      },
    });
  }

  const cleanedContent = content.replace(/\s*<tool_call>[\s\S]*?<\/tool_call>\s*/g, " ").trim();

  return { toolCalls, cleanedContent };
}

export function hasXMLToolCalls(content: string): boolean {
  return /<tool_call>[\s\S]*?<\/tool_call>/.test(content);
}
