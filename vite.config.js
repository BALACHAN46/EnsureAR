import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Custom plugin to allow the React app to save configuration directly to the filesystem during development
const saveConfigPlugin = () => ({
  name: 'save-config-plugin',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/api/save-tuning' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const newConfig = JSON.parse(body);
            const filePath = path.resolve(__dirname, 'public/models/model-defaults.json');
            
            // Read existing config
            const fileData = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(fileData);
            
            // Merge the new config for the specific model
            data.modelDefaults = data.modelDefaults || {};
            const isUpdate = !!data.modelDefaults[newConfig.modelId];
            data.modelDefaults[newConfig.modelId] = newConfig.config;
            
            // Write back to file
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, action: isUpdate ? 'update' : 'insert' }));
          } catch (error) {
            console.error('Error saving config:', error);
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: error.message }));
          }
        });
      } else {
        next();
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), saveConfigPlugin()],
})
