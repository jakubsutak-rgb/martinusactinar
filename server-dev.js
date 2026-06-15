const http = require('http');
const fs = require('fs');
const path = require('path');

const MOCK_TEXT = `Milí čitatelia, milé čitateľky,

toto je ukážkový text v martinusáčtine. Knižní škriatkovia práve ladili generátor, aby bol každý text presne taký, aký má byť.

Keď prepojíte tool s API kľúčom, na tomto mieste sa objaví skutočný martinusácky text – šitý na mieru vášmu zadaniu.

So želaním dobrej knihy po vašom boku,
váš Martinus`;

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/generate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ text: MOCK_TEXT }));
    });
    return;
  }

  const filePath = path.join(__dirname, 'martinusactar.html');
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

server.listen(3456, () => console.log('Server running on http://localhost:3456'));
