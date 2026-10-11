/* 起一个本地假接口，把 AI.chat 整条路真跑一遍：流式、非流式、报错。
   跑法："D:\Tools\node\node.exe" tools\test_ai_stream.js */
const http = require('http');
const path = require('path');
const AI = require(path.join(__dirname, '..', 'ai.js'));

let failed = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log('  ok   ' + name);
  } else {
    failed++;
    console.log('  FAIL ' + name + (extra === undefined ? '' : '  -> ' + extra));
  }
}

function sseFrame(text) {
  return 'data: ' + JSON.stringify({ choices: [{ delta: { content: text } }] }) + '\n\n';
}

function handle(req, res) {
  if (req.url === '/v1/chat/completions') {
    // 故意把一帧从中间劈开，模拟网络分片
    const frames = [sseFrame('天道'), sseFrame('刚健，'), sseFrame('宜进取。')];
    const whole = frames.join('') + 'data: [DONE]\n\n';
    const cut = 40;
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(whole.slice(0, cut));
    setTimeout(function () {
      res.write(whole.slice(cut));
      res.end();
    }, 30);
    return;
  }
  if (req.url === '/v1/plain/chat/completions') {
    // 有的服务不理 stream，直接回一整包
    const body = JSON.stringify({ choices: [{ message: { content: '一整段话' } }] });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
    return;
  }
  if (req.url === '/v1/bad/chat/completions') {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'invalid api key' } }));
    return;
  }
  res.writeHead(404).end('nope');
}

const server = http.createServer(handle);

server.listen(0, '127.0.0.1', function () {
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port + '/v1';
  const messages = [{ role: 'user', content: '试试' }];

  run(base, messages).then(function () {
    server.close();
    console.log('');
    console.log(failed ? failed + ' 项没过' : '全部通过');
    process.exit(failed ? 1 : 0);
  });
});

async function run(base, messages) {
  console.log('流式：');
  const deltas = [];
  const text = await AI.chat({ base: base, model: 'm', key: 'k' }, messages, function (d) {
    deltas.push(d);
  });
  check('拼出完整一段', text === '天道刚健，宜进取。', text);
  check('增量分三次喂出来', deltas.length === 3, deltas.length);
  check('增量加起来等于全文', deltas.join('') === text);

  console.log('非流式：');
  const plain = await AI.chat({ base: base + '/plain', model: 'm', key: 'k' }, messages, null);
  check('整包 JSON 也认', plain === '一整段话', plain);

  console.log('请求长相：');
  // 把发出去的请求抓下来看一眼
  let seen = null;
  const spy = new Promise(function (resolve) {
    server.removeAllListeners('request');
    server.on('request', function (req, res) {
      let body = '';
      req.on('data', function (c) { body += c; });
      req.on('end', function () {
        seen = { url: req.url, method: req.method, auth: req.headers.authorization,
          ctype: req.headers['content-type'], body: JSON.parse(body || '{}') };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: '好' } }] }));
        resolve();
      });
    });
  });
  await AI.chat({ base: 'http://127.0.0.1:' + server.address().port + '/v1', model: 'glm-4-flash', key: 'k-123' }, messages, null);
  await spy;
  check('打到 /chat/completions', seen && seen.url === '/v1/chat/completions', seen && seen.url);
  check('用 POST', seen && seen.method === 'POST');
  check('带上 Bearer', seen && seen.auth === 'Bearer k-123', seen && seen.auth);
  check('是 JSON', seen && seen.ctype === 'application/json');
  check('要流式', seen && seen.body.stream === true);
  check('带上模型名', seen && seen.body.model === 'glm-4-flash');
  check('带上 messages', seen && Array.isArray(seen.body.messages) && seen.body.messages.length === 1);
  check('地址结尾多个斜杠也不怕',
    (await AI.chat({ base: 'http://127.0.0.1:' + server.address().port + '/v1/', model: 'm', key: 'k' }, messages, null)) === '好');
  // 把真的路由挂回去，别让探子把后面的用例都答成 200
  server.removeAllListeners('request');
  server.on('request', handle);

  console.log('出错：');
  let msg = '';
  try {
    await AI.chat({ base: base + '/bad', model: 'm', key: 'x' }, messages, null);
  } catch (e) {
    msg = e.message;
  }
  check('401 说成密钥不对', msg.indexOf('密钥') >= 0, msg);
  check('把接口的原话带上', msg.indexOf('invalid api key') >= 0, msg);

  let msg2 = '';
  try {
    await AI.chat({ base: 'http://127.0.0.1:1/v1', model: 'm', key: 'x' }, messages, null);
  } catch (e) {
    msg2 = e.message;
  }
  check('连不上时说人话', msg2.indexOf('连不上接口') >= 0, msg2);
}
