import express from "express";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CAP = "https://zxh-btp-template-api.cfapps.ap21.hana.ondemand.com/odata/v4/catalog";
const CAP_AUTH = "Basic " + Buffer.from("editor:editor").toString("base64");
const PORT = process.env.PORT || 5050;

const SYSTEM = [
  "你是书籍助手。书籍存在 CAP 服务里，字段只有 ID、title（书名）、author（作者）。",
  "用户用中文提出查询、插入或修改时，调用工具完成，不要编造工具没返回的书。",
  "不知道 ID 时，先查询再修改。",
  "书名不能为空。用中文简短回复结果。"
].join("");

const tools = [
  {
    type: "function",
    function: {
      name: "query_books",
      description: "查询书籍。可按书名包含的文字筛选，不填则返回全部。",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "书名中包含的文字，可空" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "insert_book",
      description: "插入一本书。书名必填。",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "书名" },
          author: { type: "string", description: "作者" }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_book",
      description: "按 ID 修改一本书的书名或作者。",
      parameters: {
        type: "object",
        properties: {
          id: { type: "integer", description: "书籍 ID" },
          title: { type: "string", description: "新书名，不改可省略" },
          author: { type: "string", description: "新作者，不改可省略" }
        },
        required: ["id"]
      }
    }
  }
];

async function cap(path, options = {}) {
  const response = await fetch(CAP + path, {
    ...options,
    headers: {
      Authorization: CAP_AUTH,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: { message: text } };
    }
  }
  if (!response.ok) {
    const message = body && body.error && body.error.message ? body.error.message : "CAP 调用失败 " + response.status;
    throw new Error(message);
  }
  return body;
}

async function queryBooks(title) {
  let path = "/Books?$orderby=ID";
  if (title) {
    const safe = String(title).replaceAll("'", "''");
    path += "&$filter=" + encodeURIComponent(`contains(title,'${safe}')`);
  }
  const body = await cap(path);
  return (body.value || []).map((book) => ({
    ID: book.ID,
    title: book.title,
    author: book.author
  }));
}

async function insertBook(title, author) {
  const books = await queryBooks();
  const id = books.reduce((max, book) => Math.max(max, book.ID || 0), 0) + 1;
  const created = await cap("/Books", {
    method: "POST",
    body: JSON.stringify({ ID: id, title: title || "", author: author || "" })
  });
  return { ID: created.ID, title: created.title, author: created.author };
}

async function updateBook(id, title, author) {
  const data = {};
  if (title !== undefined) data.title = title;
  if (author !== undefined) data.author = author;
  if (!Object.keys(data).length) throw new Error("请说明要改的书名或作者");
  const updated = await cap("/Books(" + Number(id) + ")", {
    method: "PATCH",
    headers: { "If-Match": "*" },
    body: JSON.stringify(data)
  });
  return { ID: updated.ID, title: updated.title, author: updated.author };
}

async function runTool(name, args) {
  if (name === "query_books") return queryBooks(args.title);
  if (name === "insert_book") return insertBook(args.title, args.author);
  if (name === "update_book") return updateBook(args.id, args.title, args.author);
  throw new Error("未知工具 " + name);
}

function stepText(name, args) {
  if (name === "query_books") return args.title ? "查询书名包含「" + args.title + "」" : "查询全部书籍";
  if (name === "insert_book") return "插入《" + (args.title || "") + "》";
  if (name === "update_book") return "修改 ID " + args.id;
  return name;
}

async function callModel(messages, llm) {
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
  if (!llm.apiKey) {
    throw new Error("请先在页面上填写你自己的大模型密钥。");
  }
  const messages = [{ role: "system", content: SYSTEM }, ...history];
  const steps = [];
  for (let i = 0; i < 5; i++) {
    const message = await callModel(messages, llm);
    const calls = message.tool_calls || [];
    if (!calls.length) return { reply: message.content || "（没有回复）", steps };
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
        content = JSON.stringify(await runTool(call.function.name, args));
      } catch (error) {
        content = JSON.stringify({ error: error.message });
      }
      messages.push({ role: "tool", tool_call_id: call.id, content });
    }
  }
  return { reply: "步骤太多，请换一种说法。", steps };
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
  console.log("书籍助手 http://localhost:" + PORT);
});
