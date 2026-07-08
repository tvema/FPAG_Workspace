import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";

const db = new Database('project.db');

// Initialize database schema
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    name TEXT,
    path TEXT,
    type TEXT,
    content TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT,
    role TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

try {
  db.exec(`ALTER TABLE files ADD COLUMN project_id TEXT DEFAULT 'default'`);
} catch (e) {
  // column might already exist
}

try {
  db.exec(`ALTER TABLE files ADD COLUMN is_link BOOLEAN DEFAULT 0`);
} catch (e) {
  // column might already exist
}

db.exec(`INSERT OR IGNORE INTO projects (id, name) VALUES ('default', 'Default Project')`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API endpoints

  // Projects API
  app.get("/api/projects", (_req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/projects", (req, res) => {
    try {
      const { id, name } = req.body;
      db.prepare("INSERT INTO projects (id, name) VALUES (?, ?)").run(id, name);
      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/projects/:projectId/files", async (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM files WHERE project_id = ?").all(req.params.projectId) as any[];
      
      const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.projectId) as { id: string, name: string };
      if (!project) return res.json(rows);
      
      const fs = await import('fs/promises');
      const nodePath = await import('path');
      const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      const exportDir = nodePath.resolve((process.env.WORKSPACE_DIR || nodePath.join(process.cwd(), '.workspace_export')), sanitize(project.name));
      
      for (const row of rows) {
        if (row.is_link) {
          try {
            const fullPath = nodePath.resolve(exportDir, row.path);
            if (fullPath.startsWith(exportDir)) {
              row.content = await fs.readFile(fullPath, 'utf8');
            }
          } catch (e) {
            // retain default DB placeholder if reading fails
          }
        }
      }

      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get all files (fallback / debug)
  app.get("/api/files", (_req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM files").all();
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get file by ID
  app.get("/api/files/:id", (req, res) => {
    try {
      const row = db.prepare("SELECT * FROM files WHERE id = ?").get(req.params.id);
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Save or update file
  app.post("/api/files", async (req, res) => {
    try {
      const { id, name, path, type, content, project_id = 'default' } = req.body;
      const reqIsLink = req.body.is_link;
      const is_link = reqIsLink === true || reqIsLink === 1 || reqIsLink === 'true' || reqIsLink === '1' ? 1 : 0;
      db.prepare(`
        INSERT INTO files (id, name, path, type, content, project_id, is_link) 
        VALUES (?, ?, ?, ?, ?, ?, ?) 
        ON CONFLICT(id) DO UPDATE SET 
          name=excluded.name, 
          path=excluded.path, 
          type=excluded.type, 
          content=excluded.content,
          project_id=excluded.project_id,
          is_link=excluded.is_link
      `).run(id, name, path, type, content, project_id, is_link);

      // Sync to disk
      if (!is_link) {
        const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(project_id) as any;
        if (project) {
          const fs = await import('fs/promises');
          const nodePath = await import('path');
          const sanitize = (n: string) => n.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
          const exportDir = nodePath.resolve(nodePath.join(process.cwd(), '.workspace_export'), sanitize(project.name));
          const fullPath = nodePath.resolve(exportDir, path);
          await fs.mkdir(nodePath.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, content || '', 'utf8');
        }
      }

      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete file
  app.delete("/api/files/:id", async (req, res) => {
    try {
      const file = db.prepare("SELECT * FROM files WHERE id = ?").get(req.params.id) as any;
      db.prepare("DELETE FROM files WHERE id = ?").run(req.params.id);
      db.prepare("DELETE FROM messages WHERE file_id = ?").run(req.params.id);
      
      if (file && !file.is_link) {
        const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(file.project_id) as any;
        if (project) {
          const fs = await import('fs/promises');
          const nodePath = await import('path');
          const sanitize = (n: string) => n.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
          const exportDir = nodePath.resolve(nodePath.join(process.cwd(), '.workspace_export'), sanitize(project.name));
          const fullPath = nodePath.resolve(exportDir, file.path);
          try { await fs.unlink(fullPath); } catch (e) {}
        }
      }
      
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get messages for a specific file
  app.get("/api/messages/:fileId", (req, res) => {
    try {
      const rows = db.prepare("SELECT role, content FROM messages WHERE file_id = ? ORDER BY timestamp ASC").all(req.params.fileId);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add a new message for a specific file
  app.post("/api/messages", (req, res) => {
    try {
      const { file_id, role, content } = req.body;
      const result = db.prepare("INSERT INTO messages (file_id, role, content) VALUES (?, ?, ?)").run(file_id, role, content);
      res.json({ success: true, messageId: result.lastInsertRowid });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Proxy to external AI
  app.post("/api/chat", async (req, res) => {
    try {
      const { provider = 'gemini_server', messages, apiKey: clientApiKey, model: clientModel, proxy: clientProxy } = req.body;
      
      if (provider === 'ollama_server') {
          const ollamaUrl = clientProxy || 'http://127.0.0.1:11434';
          const model = clientModel || 'gemma';
          
          const ollamaMessages = messages.map((m: any) => ({
             role: m.role === 'assistant' ? 'assistant' : 'user',
             content: m.content
          }));
          
          const response = await fetch(`${ollamaUrl}/api/chat`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
                model,
                messages: ollamaMessages,
                stream: false
             })
          });
          
          if (!response.ok) {
             throw new Error(`Ollama API error: ${response.statusText}`);
          }
          const data = await response.json();
          return res.json({ message: { role: 'assistant', content: data.message.content } });
      } else {
          // Gemini Server-side Agent
          const apiKey = clientApiKey || process.env.GEMINI_API_KEY;
          const proxy = clientProxy || process.env.GEMINI_HTTP_PROXY || process.env.HTTP_PROXY || process.env.HTTPS_PROXY || "";
          const model = clientModel || process.env.GEMINI_MODEL || "gemini-2.5-flash";
          
          if (!apiKey) {
            return res.status(500).json({ error: "No API key provided. Please set it in settings." });
          }
          
          const contents = messages.map((m: any) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          }));

          const fetchOptions: any = {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ contents })
          };

          if (proxy) {
             let formattedProxy = proxy;
             if (!formattedProxy.startsWith('http://') && !formattedProxy.startsWith('https://') && !formattedProxy.startsWith('socks')) {
                 formattedProxy = 'http://' + formattedProxy;
             }
             
             const fetchNode = (await import('node-fetch')).default;
             const { HttpsProxyAgent } = await import('https-proxy-agent');
             
             fetchOptions.agent = new HttpsProxyAgent(formattedProxy);
             
             const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          
             const response = await fetchNode(apiUrl, fetchOptions);
             
             if (!response.ok) {
                 const errData: any = await response.json();
                 throw new Error(`Gemini Server Error: ${errData?.error?.message || response.statusText}`);
             }
             
             const data: any = await response.json();
             const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
             return res.json({ message: { role: 'assistant', content: text } });
             
          } else {
             const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
             
             const response = await fetch(apiUrl, fetchOptions);
             
             if (!response.ok) {
                 const errData = await response.json();
                 throw new Error(`Gemini Server Error: ${errData?.error?.message || response.statusText}`);
             }
             
             const data = await response.json();
             const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
             
             return res.json({ message: { role: 'assistant', content: text } });
          }
      }
    } catch (err: any) {
      console.error('Chat Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // GitHub OAuth Flow
  app.get('/api/auth/github/url', (req, res) => {
    const redirectUri = req.query.redirectUri as string;
    
    if (!process.env.GITHUB_CLIENT_ID) {
      return res.status(400).json({ error: 'GITHUB_CLIENT_ID is not set in environment variables.' });
    }

    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: 'repo user gist',
      response_type: 'code',
    });

    res.json({ url: `https://github.com/login/oauth/authorize?${params}` });
  });

  app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
    const { code } = req.query;
    
    try {
      if (!code) throw new Error('No code provided');
      
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code: code
        })
      });
      
      const data = await tokenResponse.json();
      
      if (data.error) {
        throw new Error(data.error_description || data.error);
      }
      
      // We will send the access_token back to the client via postMessage
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: '${data.access_token}' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error('GitHub OAuth error:', err);
      res.send(`
        <html>
          <body>
            <h3>Authentication Error</h3>
            <p>${err.message}</p>
            <script>
              setTimeout(() => {
                if (window.opener) window.close();
              }, 3000);
            </script>
          </body>
        </html>
      `);
    }
  });

  // Local Git Export Endpoint
  app.post('/api/export/local', async (req, res) => {
    try {
      const { projectId = 'default', commitMessage = 'Auto-exported from Workspace' } = req.body;
      
      const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as { id: string, name: string };
      if (!project) throw new Error("Project not found");

      const files = db.prepare("SELECT * FROM files WHERE project_id = ?").all(projectId) as { path: string, content: string }[];
      
      const fs = await import('fs/promises');
      const nodePath = await import('path');
      const { simpleGit } = await import('simple-git');
      
      // Determine export dir: projects/<project_name_sanitized>
      const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      const exportDir = nodePath.resolve(nodePath.join(process.cwd(), '.workspace_export'), sanitize(project.name));
      
      await fs.mkdir(exportDir, { recursive: true });
      
      // Write files
      for (const file of files) {
        if (file.path.endsWith('.gitkeep')) continue;
        const fullPath = nodePath.resolve(exportDir, file.path);
        await fs.mkdir(nodePath.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, file.content || '', 'utf8');
      }
      
      // Git commit
      const git = simpleGit(exportDir);
      
      let isRepo = false;
      try {
        await fs.access(nodePath.join(exportDir, '.git'));
        isRepo = true;
      } catch {
        isRepo = false;
      }
      if (!isRepo) {
        await git.init();
      }
      
      await git.add('./*');
      const status = await git.status();
      if (status.staged.length > 0 || status.not_added.length > 0) {
          await git.commit(commitMessage);
      }
      
      res.json({ success: true, path: exportDir });
    } catch (err: any) {
      console.error('Local export error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Git Actions
  app.post('/api/git/action', async (req, res) => {
    try {
      const { projectId = 'default', action, path = '', commitMessage = '' } = req.body;
      const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as { id: string, name: string };
      if (!project) throw new Error("Project not found");
      
      const nodePath = await import('path');
      const fs = await import('fs/promises');
      const { simpleGit } = await import('simple-git');
      const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      const exportDir = nodePath.resolve(nodePath.join(process.cwd(), '.workspace_export'), sanitize(project.name));
      
      await fs.mkdir(exportDir, { recursive: true });
      const git = simpleGit(exportDir);
      
      let result: any = { success: true };
      
      let isRepo = false;
      try {
        await fs.access(nodePath.join(exportDir, '.git'));
        isRepo = true;
      } catch {
        isRepo = false;
      }

      if (action === 'init') {
        // First dump all files from DB to disk to ensure they exist
        const files = db.prepare("SELECT * FROM files WHERE project_id = ?").all(projectId) as { path: string, content: string, is_link: number }[];
        for (const file of files) {
          if (file.is_link) continue;
          const fullPath = nodePath.resolve(exportDir, file.path);
          await fs.mkdir(nodePath.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, file.content || '', 'utf8');
        }
        await git.init();
      } else if (action === 'add') {
        if (isRepo) await git.add(path);
      } else if (action === 'rm') {
        if (isRepo) {
           try { await git.rm(path); } catch(e) {
             // If not in index, just ignore or try to unstage
             try { await git.reset(['--', path]); } catch(e2) {}
           }
        }
      } else if (action === 'commit') {
        if (isRepo) {
          await git.addConfig('user.name', 'Workspace User');
          await git.addConfig('user.email', 'workspace@example.com');
          
          try {
            await fs.access(nodePath.join(exportDir, '.gitignore'));
          } catch {
            await fs.writeFile(nodePath.join(exportDir, '.gitignore'), '*.vcd\n*.vvp\n*.out\nsim/\n', 'utf8');
          }

          let commitOutput = '';
          try {
             commitOutput = await git.raw(['commit', '-a', '-m', commitMessage || 'Workspace update']);
          } catch(e: any) {
             commitOutput = e.message;
             result.success = false;
          }
          result.commitResult = commitOutput;
        }
      } else if (action === 'show') {
         if (isRepo) {
            try {
               const fileContent = await git.show([`HEAD:${path}`]);
               result.content = fileContent;
            } catch(e: any) {
               result.content = null;
               result.error = e.message;
            }
         }
      }
      
      res.json(result);
    } catch (err: any) {
      console.error('Git action error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/git/status', async (req, res) => {
    try {
      const { projectId = 'default' } = req.query;
      const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId as string) as { id: string, name: string };
      if (!project) throw new Error("Project not found");
      
      const nodePath = await import('path');
      const fs = await import('fs/promises');
      const { simpleGit } = await import('simple-git');
      const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      const exportDir = nodePath.resolve(nodePath.join(process.cwd(), '.workspace_export'), sanitize(project.name));
      
      try { await fs.access(exportDir); } catch { await fs.mkdir(exportDir, { recursive: true }); }
      const git = simpleGit(exportDir);
      
      let isRepo = false;
      try {
        await fs.access(nodePath.join(exportDir, '.git'));
        isRepo = true;
      } catch {
        isRepo = false;
      }

      if (!isRepo) {
        return res.json({ isRepo: false, status: {} });
      }
      
      const status = await git.status();
      res.json({ isRepo: true, status });
    } catch (err: any) {
      console.error('Git status error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/export/pdf', async (req, res) => {
    try {
      const { html } = req.body;
      if (!html) return res.status(400).json({ error: "Missing HTML content" });

      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.launch({ 
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        headless: true
      });
      
      const page = await browser.newPage();
      
      // Inject some basic styling to ensure it looks like a clean document
      const styledHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
          <style>
            body {
              font-family: 'Inter', Arial, sans-serif;
              color: black;
              background-color: white;
              padding: 20px;
              line-height: 1.5;
              max-width: 1000px;
              margin: 0 auto;
            }
            h1, h2, h3, h4, h5, h6 {
              color: black;
              margin-top: 1.5em;
              margin-bottom: 0.5em;
              font-weight: bold;
            }
            h1 { font-size: 2em; border-bottom: 1px solid #ccc; padding-bottom: 0.3em; }
            h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
            p { margin-bottom: 1em; }
            a { color: #000; text-decoration: underline; }
            ul, ol { margin-bottom: 1em; padding-left: 2em; }
            blockquote {
              border-left: 4px solid #ccc;
              padding-left: 1em;
              color: #555;
              margin-left: 0;
            }
            pre, pre div, pre code, pre code span {
              white-space: pre-wrap !important;
              word-wrap: break-word !important;
              word-break: break-all !important;
              font-family: "JetBrains Mono", Consolas, "Courier New", monospace !important;
              font-size: 10px !important;
              line-height: 1.3 !important;
            }
            pre {
              background-color: #f6f8fa !important; /* Light grey background */
              color: #24292e !important;
              border: 1px solid #e1e4e8;
              padding: 12px;
              border-radius: 4px;
            }
            code {
              font-family: "JetBrains Mono", Consolas, "Courier New", monospace !important;
              background-color: #f3f4f6;
              color: #24292e;
              padding: 0.2em 0.4em;
              border-radius: 3px;
              font-size: 10px !important;
            }
            pre code {
              background-color: transparent !important;
              padding: 0;
              color: inherit !important;
            }
            /* Syntax highlighting color overrides for light PDF background */
            span[style*="#569cd6" i], span[style*="86, 156, 214"] { color: #0000ff !important; } /* keywords */
            span[style*="#c586c0" i], span[style*="197, 134, 192"] { color: #af00db !important; } /* control flow */
            span[style*="#9cdcfe" i], span[style*="156, 220, 254"] { color: #001080 !important; font-weight: 500 !important; } /* variables */
            span[style*="#dcdcaa" i], span[style*="220, 220, 170"] { color: #795e26 !important; font-weight: 500 !important; } /* functions */
            span[style*="#ce9178" i], span[style*="206, 145, 120"] { color: #a31515 !important; } /* strings */
            span[style*="#6a9955" i], span[style*="106, 153, 85"] { color: #008000 !important; } /* comments */
            span[style*="#4ec9b0" i], span[style*="78, 201, 176"] { color: #267f99 !important; } /* types */
            span[style*="#b5cea8" i], span[style*="181, 206, 168"] { color: #098658 !important; } /* numbers */
            span[style*="#d4d4d4" i], span[style*="212, 212, 212"] { color: #24292e !important; } /* default text */
            span[style*="#4fc1ff" i], span[style*="79, 193, 255"] { color: #0070c1 !important; } /* properties */
          </style>
        </head>
        <body>
          ${html}
        </body>
        </html>
      `;

      await page.setContent(styledHtml, { waitUntil: 'load' });
      
      // Wait for fonts to load
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      // Wait for network requests (like font downloads) to finish
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
      });

      await browser.close();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=document.pdf');
      res.send(Buffer.from(pdfBuffer));
    } catch (err: any) {
      console.error('PDF export error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Local Build Endpoint
  app.post('/api/build/local', async (req, res) => {
    try {
      const { projectId = 'default', target = '', workDir = '' } = req.body;
      
      const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as { id: string, name: string };
      if (!project) throw new Error("Project not found");

      const files = db.prepare("SELECT * FROM files WHERE project_id = ?").all(projectId) as { path: string, content: string, is_link?: number }[];
      
      const fs = await import('fs/promises');
      const nodePath = await import('path');
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      // Determine export dir: projects_export/<project_name_sanitized>
      const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      const exportDir = nodePath.resolve(nodePath.join(process.cwd(), '.workspace_export'), sanitize(project.name));
      
      await fs.mkdir(exportDir, { recursive: true });
      
      // Write files
      for (const file of files) {
        if (file.is_link) continue;
        if (file.path.endsWith('.gitkeep')) continue;
        const fullPath = nodePath.resolve(exportDir, file.path);
        await fs.mkdir(nodePath.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, file.content || '', 'utf8');
      }
      
      const cmd = target ? `make ${target}` : `make`;
      const runDir = workDir ? nodePath.resolve(exportDir, workDir) : exportDir;
      
      // prevent directory traversal
      if (!runDir.startsWith(exportDir)) {
          throw new Error("Invalid work directory");
      }
      
      const { stdout, stderr } = await execAsync(cmd, { cwd: runDir });
      
      res.json({ success: true, output: stdout + (stderr ? '\n' + stderr : '') });
    } catch (err: any) {
      console.error('Local build error:', err);
      const combinedOutput = [err.stdout, err.stderr].filter(Boolean).join('\n');
      res.status(500).json({ error: err.message, output: combinedOutput || err.message });
    }
  });

  app.get('/api/build/local/file', async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      const filePath = req.query.path as string;
      if (!projectId || !filePath) return res.status(400).json({ error: "Missing params" });
      
      const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as { id: string, name: string };
      if (!project) return res.status(404).json({ error: "Project not found" });
      
      const fs = await import('fs/promises');
      const nodePath = await import('path');
      const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      const exportDir = nodePath.resolve(nodePath.join(process.cwd(), '.workspace_export'), sanitize(project.name));
      const fullPath = nodePath.resolve(exportDir, filePath);
      
      // prevent directory traversal
      if (!fullPath.startsWith(exportDir)) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const content = await fs.readFile(fullPath, 'utf8');
      res.json({ content });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  const { WebSocketServer } = await import('ws');
  const wss = new WebSocketServer({ server });
  const { spawn } = await import('child_process');
  
  // GDB WebSocket handler
  wss.on('connection', (ws) => {
    let gdbProcess: import('child_process').ChildProcess | null = null;
    
    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'start') {
          const { projectId, breakpoints } = msg;
          // Find project
          const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as { id: string, name: string };
          if (!project) {
            ws.send(JSON.stringify({ type: 'error', data: 'Project not found' }));
            return;
          }
          
          const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
          const nodePath = await import('path');
          const exportDir = nodePath.resolve(nodePath.join(process.cwd(), '.workspace_export'), sanitize(project.name));
          
          // First, compile the project
          ws.send(JSON.stringify({ type: 'output', data: 'Compiling project...' }));
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          
          try {
            await execAsync('make', { cwd: exportDir });
            ws.send(JSON.stringify({ type: 'output', data: 'Compilation successful.\n' }));
          } catch (err: any) {
            ws.send(JSON.stringify({ type: 'output', data: 'Compilation failed:\n' + err.stdout + '\n' + err.stderr }));
            return;
          }
          
          // Start GDB process
          gdbProcess = spawn('gdb', ['-q', './main'], { cwd: exportDir });
          
          gdbProcess.stdout?.on('data', (out) => {
            ws.send(JSON.stringify({ type: 'output', data: out.toString() }));
          });
          
          gdbProcess.stderr?.on('data', (errOut) => {
            ws.send(JSON.stringify({ type: 'output', data: errOut.toString() }));
          });
          
          gdbProcess.on('close', (code) => {
            ws.send(JSON.stringify({ type: 'output', data: `GDB exited with code ${code}\n` }));
            gdbProcess = null;
          });
          
          // Set breakpoints
          if (breakpoints) {
            for (const file of Object.keys(breakpoints)) {
              for (const line of breakpoints[file]) {
                gdbProcess.stdin?.write(`break ${file}:${line}\n`);
              }
            }
          }
        } else if (msg.type === 'command') {
          if (gdbProcess && gdbProcess.stdin) {
            gdbProcess.stdin.write(msg.command + '\n');
          } else {
            ws.send(JSON.stringify({ type: 'output', data: 'GDB is not running.\n' }));
          }
        } else if (msg.type === 'stop') {
          if (gdbProcess) {
            gdbProcess.kill('SIGKILL');
            gdbProcess = null;
            ws.send(JSON.stringify({ type: 'output', data: 'GDB stopped.\n' }));
          }
        }
      } catch (err) {
        console.error('WS Error:', err);
      }
    });
    
    ws.on('close', () => {
      if (gdbProcess) {
        gdbProcess.kill('SIGKILL');
      }
    });
  });
}

startServer().catch(console.error);
