import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

const leaderboardPlugin = () => ({
  name: 'leaderboard-api',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url === '/api/leaderboard') {
        const filePath = path.resolve(__dirname, 'leaderboard.json');
        
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          if (fs.existsSync(filePath)) {
            res.end(fs.readFileSync(filePath, 'utf-8'));
          } else {
            res.end('[]');
          }
          return;
        }
        
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk.toString(); });
          req.on('end', () => {
            fs.writeFileSync(filePath, body);
            res.setHeader('Content-Type', 'application/json');
            res.end(body);
          });
          return;
        }

        if (req.method === 'DELETE') {
          fs.writeFileSync(filePath, '[]');
          res.setHeader('Content-Type', 'application/json');
          res.end('[]');
          return;
        }
      }
      next();
    });
  }
});

export default defineConfig({
  plugins: [leaderboardPlugin()],
  server: {
    port: 3000,
    open: false,
  },
});
