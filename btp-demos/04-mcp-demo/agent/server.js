import express from "express";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5052;
const MCP_URL = process.env.MCP_URL || "http://127.0.0.1:5051/mcp";
const MCP_TOKEN = process.env.MCP_TOKEN || "";

const SYSTEM = [
  "你是书籍助手。书籍能力来自 MCP 服务，字段只有 ID、title（书名）、author（作者）。",
  "用户用中文提出查询、插入或修改时，调用工具完成，不要编造工具没返回的书。",
  "用户要求导出 Excel 或保存到电脑时，调用 export_books_excel。文件会由页面下载，不要说无法保存。",
  "不知道 ID 时，先查询再修改。",
  "书名不能为空。用中文简短回复结果。"
].join("");

function stepText(name, args) {
  if (name === "query_books") return args.title ? "MCP 查询书名包含「" + args.title + "」" : "MCP 查询全部书籍";
  if (name === "insert_book") return "MCP 插入《" + (args.title || "") + "》";
  if (name === "update_book") return "MCP 修改 ID " + args.id;
  if (name === "export_books_excel") return "MCP 导出 Excel";
  return "MCP " + name;
}

async function withMcp(work) {
  const client = new Client({ name: "books-assistant", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: {
      headers: MCP_TOKEN ? { Authorization: "Bearer " + MCP_TOKEN } : {}
    }
  });
  await client.connect(transport);
  try {
    return await work(client);
  } finally {
    await client.close();
  }
}

function modelTools(tools) {
  return tools.map((tool) => {
    const parameters = { ...(tool.inputSchema || { type: "object", properties: {} }) };
    delete parameters.$schema;
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description || tool.name,
        parameters
      }
    };
  });
}

async function callModel(messages, tools, llm) {
  const base = (llm.baseUrl || "https://api.deepseek.com/v1").replace(/\/$/, "");
  const response = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + llm.apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: llm.model || "deepseek-chat",
      messages,
      tools
    })
  });
  const text = await response.text();
  let body = {};
  try {
    body = JSON.parse(text);
  } catch {
    body = { error: { message: text } };
  }
  if (!response.ok) {
    const message = body.error && body.error.message ? body.error.message : "大模型调用失败 " + response.status;
    throw new Error(message);
  }
  return body.choices[0].message;
}

async function answer(history, llm) {
  if (!llm.apiKey) throw new Error("请先在页面上填写你自己的大模型密钥。");
  return withMcp(async (client) => {
    const listed = await client.listTools();
    const tools = modelTools(listed.tools || []);
    const messages = [{ role: "system", content: SYSTEM }, ...history];
    const steps = [];
    let file = null;
    for (let i = 0; i < 5; i++) {
      const message = await callModel(messages, tools, llm);
      const calls = message.tool_calls || [];
      if (!calls.length) return { reply: message.content || "（没有回复）", steps, file };
      messages.push(message);
      for (const call of calls) {
        let args = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          args = {};
        }
        steps.push(stepText(call.function.name, args));
        let content;
        try {
          const result = await client.callTool({ name: call.function.name, arguments: args });
          const text = (result.content || [])
            .filter((item) => item.type === "text")
            .map((item) => item.text)
            .join("\n");
          content = text || JSON.stringify(result);
          if (result.isError) content = JSON.stringify({ error: content });
          if (call.function.name === "export_books_excel") {
            const parsed = JSON.parse(content);
            if (parsed && parsed.base64) {
              file = { name: parsed.filename || "书籍.xlsx", base64: parsed.base64 };
              content = JSON.stringify({ filename: file.name, count: parsed.count, downloaded: true });
            }
          }
        } catch (error) {
          content = JSON.stringify({ error: error.message });
        }
        messages.push({ role: "tool", tool_call_id: call.id, content });
      }
    }
    return { reply: "步骤太多，请换一种说法。", steps, file };
  });
}

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

app.post("/api/chat", async (req, res) => {
  const history = Array.isArray(req.body && req.body.messages) ? req.body.messages : [];
  const safe = history
    .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
    .slice(-12)
    .map((item) => ({ role: item.role, content: item.content }));
  const llm = {
    apiKey: String((req.body && req.body.apiKey) || "").trim(),
    baseUrl: String((req.body && req.body.baseUrl) || "").trim(),
    model: String((req.body && req.body.model) || "").trim()
  };
  try {
    res.json(await answer(safe, llm));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log("MCP 书籍助手 http://127.0.0.1:" + PORT);
});
