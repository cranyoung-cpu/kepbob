const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const port = 3000;

function send(res, status, data, type = 'text/plain') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(data);
}

function serveStatic(req, res) {
  let pathname = url.parse(req.url).pathname;
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(__dirname, 'public', pathname);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, 'Not Found');
    } else {
      const ext = path.extname(filePath).toLowerCase();
      const map = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript'
      };
      send(res, 200, data, map[ext] || 'application/octet-stream');
    }
  });
}

function parseBody(req, callback) {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 1e7) req.connection.destroy();
  });
  req.on('end', () => {
    try {
      callback(JSON.parse(body || '{}'));
    } catch (e) {
      callback({});
    }
  });
}

const dataDir = path.join(__dirname, 'data');
const templateFile = path.join(dataDir, 'templates.json');
const uploadsDir = path.join(dataDir, 'uploads');
const docsDir = path.join(dataDir, 'docs');
const sidebarDir = path.join(dataDir, 'sidebars');

function ensureDirs() {
  [dataDir, uploadsDir, docsDir, sidebarDir].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}
ensureDirs();

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/templates') {
    fs.readFile(templateFile, (err, data) => {
      if (err) return send(res, 200, '[]', 'application/json');
      send(res, 200, data, 'application/json');
    });
  } else if (req.method === 'POST' && req.url === '/api/templates') {
    parseBody(req, body => {
      fs.readFile(templateFile, (err, data) => {
        const list = err ? [] : JSON.parse(data);
        list.push(body);
        fs.writeFile(templateFile, JSON.stringify(list), () => {
          send(res, 200, JSON.stringify({ status: 'ok' }), 'application/json');
        });
      });
    });
  } else if (req.method === 'GET' && req.url.startsWith('/api/sidebars/')) {
    const page = req.url.split('/').pop();
    const filePath = path.join(sidebarDir, `${page}.json`);
    fs.readFile(filePath, (err, data) => {
      if (err) return send(res, 200, '{"left":[],"right":[]}', 'application/json');
      send(res, 200, data, 'application/json');
    });
  } else if (req.method === 'POST' && req.url === '/api/upload') {
    parseBody(req, body => {
      const fileName = Date.now() + '-' + body.name.replace(/[^\w.]/g, '');
      const filePath = path.join(uploadsDir, fileName);
      const fileData = Buffer.from(body.data || '', 'base64');
      fs.writeFile(filePath, fileData, err => {
        if (err) return send(res, 500, '{"error":"write"}', 'application/json');
        send(res, 200, JSON.stringify({ path: `/uploads/${fileName}` }), 'application/json');
      });
    });
  } else if (req.method === 'POST' && req.url === '/api/docs') {
    parseBody(req, body => {
      const name = body.name || Date.now().toString();
      const filePath = path.join(docsDir, `${name}.html`);
      fs.writeFile(filePath, body.content || '', () => {
        send(res, 200, JSON.stringify({ status: 'saved', name }), 'application/json');
      });
    });
  } else if (req.method === 'GET' && req.url.startsWith('/api/docs/')) {
    const name = req.url.split('/').pop();
    const filePath = path.join(docsDir, `${name}.html`);
    fs.readFile(filePath, (err, data) => {
      if (err) return send(res, 404, 'Not Found');
      send(res, 200, data, 'text/html');
    });
  } else if (req.url.startsWith('/uploads/')) {
    const filePath = path.join(uploadsDir, path.basename(req.url));
    fs.readFile(filePath, (err, data) => {
      if (err) return send(res, 404, 'Not Found');
      const ext = path.extname(filePath).toLowerCase();
      const map = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif'
      };
      send(res, 200, data, map[ext] || 'application/octet-stream');
    });
  } else {
    serveStatic(req, res);
  }
});

if (process.argv.includes('--test')) {
  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    server.close(() => console.log('Test mode: server closed'));
  });
} else {
  server.listen(port, () => console.log(`Server running at http://localhost:${port}`));
}
