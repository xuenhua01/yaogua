import express from "express";
import ExcelJS from "exceljs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const CAP = "https://zxh-btp-template-api.cfapps.ap21.hana.ondemand.com/odata/v4/catalog";
const CAP_AUTH = "Basic " + Buffer.from("editor:editor").toString("base64");
const PORT = process.env.PORT || 5051;
const MCP_TOKEN = process.env.MCP_TOKEN || "";

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
  if (!title) throw new Error("书名不能为空");
  const books = await queryBooks();
  const id = books.reduce((max, book) => Math.max(max, book.ID || 0), 0) + 1;
  const created = await cap("/Books", {
    method: "POST",
    body: JSON.stringify({ ID: id, title, author: author || "" })
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

function toolResult(value) {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

async function exportBooks() {
  const books = await queryBooks();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("书籍");
  sheet.columns = [
    { header: "ID", key: "ID", width: 12 },
    { header: "书名", key: "title", width: 32 },
    { header: "作者", key: "author", width: 24 }
  ];
  books.forEach((book) => sheet.addRow(book));
  const buffer = await workbook.xlsx.writeBuffer();
  return {
    filename: "书籍.xlsx",
    count: books.length,
    base64: Buffer.from(buffer).toString("base64")
  };
}

function createServer() {
  const server = new McpServer({ name: "books-mcp", version: "1.0.0" });
  server.registerTool(
    "query_books",
    {
      description: "查询书籍。可按书名包含的文字筛选，不填则返回全部。",
      inputSchema: {
        title: z.string().optional().describe("书名中包含的文字，可空")
      }
    },
    async ({ title }) => toolResult(await queryBooks(title))
  );
  server.registerTool(
    "insert_book",
    {
      description: "插入一本书。书名必填。",
      inputSchema: {
        title: z.string().describe("书名"),
        author: z.string().optional().describe("作者")
      }
    },
    async ({ title, author }) => toolResult(await insertBook(title, author))
  );
  server.registerTool(
    "update_book",
    {
      description: "按 ID 修改一本书的书名或作者。",
      inputSchema: {
        id: z.number().describe("书籍 ID"),
        title: z.string().optional().describe("新书名，不改可省略"),
        author: z.string().optional().describe("新作者，不改可省略")
      }
    },
    async ({ id, title, author }) => toolResult(await updateBook(id, title, author))
  );
  server.registerTool(
    "export_books_excel",
    {
      description: "把全部书籍导出为 Excel 文件，供用户下载到自己的电脑。用户要求导出、制作 Excel 或保存到本地时使用。",
      inputSchema: {}
    },
    async () => toolResult(await exportBooks())
  );
  return server;
}

const app = express();
app.use(express.json());

app.get("/", (_req, res) => {
  res.type("text/plain; charset=utf-8").send("书籍 MCP 服务。助手通过 /mcp 连接，这里再调用 CAP。");
});

app.post("/mcp", async (req, res) => {
  if (MCP_TOKEN) {
    const header = req.get("authorization") || "";
    if (header !== "Bearer " + MCP_TOKEN) {
      res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message: "MCP 未授权" }, id: null });
      return;
    }
  }
  const server = createServer();
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: error.message || "MCP 处理失败" },
        id: null
      });
    }
  }
});

app.listen(PORT, () => {
  console.log("书籍 MCP http://127.0.0.1:" + PORT + "/mcp");
});
