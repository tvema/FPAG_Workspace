import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { GoogleGenAI } from "@google/genai";


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

db.exec(`INSERT OR IGNORE INTO projects (id, name) VALUES ('default', 'Default Project')`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API endpoints

  // Projects API
  app.get("/api/projects", (req, res) => {
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

  app.get("/api/projects/:projectId/files", (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM files WHERE project_id = ?").all(req.params.projectId);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get all files (fallback / debug)
  app.get("/api/files", (req, res) => {
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
  app.post("/api/files", (req, res) => {
    try {
      const { id, name, path, type, content, project_id = 'default' } = req.body;
      db.prepare(`
        INSERT INTO files (id, name, path, type, content, project_id) 
        VALUES (?, ?, ?, ?, ?, ?) 
        ON CONFLICT(id) DO UPDATE SET 
          name=excluded.name, 
          path=excluded.path, 
          type=excluded.type, 
          content=excluded.content,
          project_id=excluded.project_id
      `).run(id, name, path, type, content, project_id);
      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete file
  app.delete("/api/files/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM files WHERE id = ?").run(req.params.id);
      db.prepare("DELETE FROM messages WHERE file_id = ?").run(req.params.id);
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
      const exportDir = nodePath.resolve(process.cwd(), 'projects_export', sanitize(project.name));
      
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
      
      const isRepo = await git.checkIsRepo();
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
