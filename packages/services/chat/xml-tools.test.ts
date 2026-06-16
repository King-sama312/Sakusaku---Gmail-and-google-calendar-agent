import { describe, it, expect } from "vitest";
import { hasXMLToolCalls, parseXMLToolCalls } from "./xml-tools";

describe("xml-tools", () => {
  it("detects XML tool calls in content", () => {
    expect(hasXMLToolCalls("<tool_call>list_threads</tool_call>")).toBe(true);
    expect(hasXMLToolCalls("Hello there")).toBe(false);
  });

  it("parses a single XML tool call", () => {
    const content = `<tool_call>get_thread
      <arg_key>id</arg_key>
      <arg_value>19ed0e362cfc6a4c</arg_value>
    </tool_call>`;

    const { toolCalls, cleanedContent } = parseXMLToolCalls(content);

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]).toMatchObject({
      id: "xml-call-1",
      type: "function",
      function: {
        name: "get_thread",
        arguments: JSON.stringify({ id: "19ed0e362cfc6a4c" }),
      },
    });
    expect(cleanedContent).not.toContain("<tool_call>");
  });

  it("parses multiple XML tool calls", () => {
    const content = `
      <tool_call>list_threads<arg_key>q</arg_key><arg_value>from:boss</arg_value></tool_call>
      <tool_call>get_thread<arg_key>id</arg_key><arg_value>abc123</arg_value></tool_call>
    `;

    const { toolCalls, cleanedContent } = parseXMLToolCalls(content);

    expect(toolCalls).toHaveLength(2);
    expect(toolCalls[0]?.function.name).toBe("list_threads");
    expect(toolCalls[1]?.function.name).toBe("get_thread");
    expect(cleanedContent).toBe("");
  });

  it("preserves surrounding text when cleaning", () => {
    const content = "Let me check that. <tool_call>list_threads</tool_call> Here are the results:";
    const { cleanedContent } = parseXMLToolCalls(content);
    expect(cleanedContent).toBe("Let me check that. Here are the results:");
  });

  it("ignores malformed blocks", () => {
    const content = "<tool_call></tool_call>";
    const { toolCalls } = parseXMLToolCalls(content);
    expect(toolCalls).toHaveLength(0);
  });
});
