# BTP 练习

这段时间做的四个 demo。云上的应用还在 BTP，这里只保存代码。`node_modules` 没有放进来，到对应文件夹执行 `npm install` 才会装依赖。

## 01-handwrite

第一个上云的 demo。CAP 提供书籍和物料，UI5 调用它。登录入口是 approuter，权限是 `handwrite-xsuaa`，书表在 HANA 容器 `handwrite-hdi`。

| 文件 | 作用 |
|---|---|
| `manifest.yml` | 发布清单。两个应用：CAP 服务和 approuter |
| `package.json` | CAP 的依赖、启动方式，以及本地模拟账号 |
| `package-lock.json` | 依赖的具体版本 |
| `xs-security.json` | 权限定义。角色有查询和维护 |
| `services-manifest.yml` | 早期准备服务时用的清单 |
| `readme.md` | 这个项目原来的说明 |
| `.gitignore` | 不提交依赖库 |
| `.vscode/tasks.json` | 编辑器里的启动任务 |
| `srv/cat-service.cds` | CAP 接口定义。书籍、物料、当前用户 |
| `srv/cat-service.js` | 接口里的检查、当前用户、物料读取 |
| `srv/s4-product.cds` | 准备读取 S/4 产品的外部接口定义 |
| `db/data/CatalogService.Books.csv` | 书籍的初始数据，只在部署建表时使用 |
| `db/data/CatalogService.Materials.csv` | 物料的初始数据 |
| `app/index.html` | 进入书籍和物料页面的入口 |
| `app/books.html` | 早期的书籍页面 |
| `app/books-simple.html` | 简化过的书籍页面 |
| `app/books-report.html` | 书籍报表页面 |
| `app/materials.html` | 早期的物料页面 |
| `app/materials-report.html` | 物料报表页面 |
| `app/fiori-service.cds` | 给 Fiori 用的服务注释 |
| `app/books/webapp/` | 书籍的 UI5 页面：入口、组件、清单、文字 |
| `app/materials/webapp/` | 物料的 UI5 页面 |
| `app/demo/` | 后来改过的一套 UI5。首页、书籍、物料、弹窗和控制器都在这里 |
| `approuter/package.json` | 登录入口应用的依赖 |
| `approuter/xs-app.json` | 登录入口把请求转到 CAP，并带上令牌 |
| `approuter/logout.html` | 退出后看到的页面 |
| `gen/db/` | CAP 生成的 HANA 表定义，不是手写的业务代码 |

## 02-template

练习用的 CAP。只有书籍，字段是编号、书名、作者。云上的应用是 `ZXH_BTP_Template-srv`。点页面按钮时，浏览器直接调用 `/odata/v4/catalog/Books`，不经过助手和大模型。书仍在 `handwrite-hdi`。

| 文件 | 作用 |
|---|---|
| `manifest.yml` | 发布清单。CAP 服务，以及还没发布的登录入口 |
| `package.json` | 依赖和启动方式。本地用模拟账号，云上准备走 XSUAA |
| `package-lock.json` | 依赖的具体版本 |
| `xs-security.json` | 练习项目的角色定义，云上还没创建这个权限服务 |
| `srv/cat-service.cds` | 书籍接口和权限。查询、维护两个角色 |
| `srv/cat-service.js` | 当前用户，以及保存前检查书名不能为空 |
| `db/data/CatalogService-Books.csv` | 本地启动时的样例书，不会写进云上的 HANA |
| `app/books/webapp/index.html` | UI5 页面入口 |
| `app/books/webapp/manifest.json` | 页面配置。接口地址是 `/odata/v4/catalog/` |
| `app/books/webapp/Component.js` | 启动时带上练习账号 |
| `app/books/webapp/view/Books.view.xml` | 书籍表格、查询账号、维护账号、新建 |
| `app/books/webapp/view/BookDialog.fragment.xml` | 新建和编辑时的弹窗 |
| `app/books/webapp/controller/Books.controller.js` | 查询、新建、编辑。这些请求直接发给 CAP |
| `approuter/` | 登录入口的代码。云上还没发布 |

## 03-agent-web

第一版对话助手。页面上填写大模型密钥，密钥留在浏览器里。助手直接调用 `ZXH_BTP_Template-srv` 的 CAP，中间没有 MCP。云上地址是 `zxh-btp-agent`。

| 文件 | 作用 |
|---|---|
| `manifest.yml` | 发布这一个助手应用，不绑定 HANA |
| `package.json` | 启动命令和 express 依赖 |
| `package-lock.json` | 依赖的具体版本 |
| `server.js` | 助手本体。问大模型，并直接调用 CAP 做查询、插入、修改 |
| `public/index.html` | 聊天页面。密钥、接口地址、模型名保存在这台浏览器 |
| `.cfignore` | 发布时不上传依赖库和 `.env` |
| `.gitignore` | 提交时不纳入依赖库和 `.env` |

## 04-mcp-demo

一个助手对接一个自己写的书籍 MCP。助手问大模型，MCP 再调用 CAP。云上是两个应用：`ZXH_BTP_AgentMcp` 和 `ZXH_BTP_BooksMcp`。

| 文件 | 作用 |
|---|---|
| `manifest.yml` | 一次发布助手和 MCP 两个应用 |
| `agent/package.json` | 助手的启动命令和依赖 |
| `agent/package-lock.json` | 助手依赖的具体版本 |
| `agent/server.js` | 助手。先问 MCP 有哪些工具，再调用大模型，然后通知 MCP 执行 |
| `agent/public/index.html` | 聊天页面。导出 Excel 时由浏览器下载 |
| `agent/.cfignore` | 发布助手时不上传依赖库 |
| `agent/.gitignore` | 提交助手时不纳入依赖库 |
| `mcp/package.json` | MCP 服务的启动命令和依赖，包含生成 Excel 的库 |
| `mcp/package-lock.json` | MCP 依赖的具体版本 |
| `mcp/server.js` | 登记查书、插书、改书、导出 Excel，并调用 CAP。`editor` 账号在这个文件开头 |
| `mcp/.cfignore` | 发布 MCP 时不上传依赖库 |
| `mcp/.gitignore` | 提交 MCP 时不纳入依赖库 |
