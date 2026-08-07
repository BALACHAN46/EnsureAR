// Force Vite to clear optimize dep cache
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
// Mock Upload Plugin to save files locally to public/models/ and update JSON files
const mockUploadPlugin = () => ({
  name: 'mock-upload-plugin',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/api/mock-upload' && req.method === 'POST') {
        const chunks = [];
        req.on('data', chunk => { chunks.push(chunk); });
        req.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf-8');
            const data = JSON.parse(body);
            const id = Math.random().toString(36).substring(2, 14); // 12 char ID
            
            // Create category directory if it doesn't exist
            const catPath = path.resolve(__dirname, 'public/models', data.category);
            if (!fs.existsSync(catPath)) {
              fs.mkdirSync(catPath, { recursive: true });
            }

            // Save Model File (GLB or PNG)
            let modelUrl = '';
            if (data.modelFile) {
               const b64 = data.modelFile.split(';base64,').pop();
               const ext = data.modelFileName.split('.').pop();
               const filename = `${id}.${ext}`;
               fs.writeFileSync(path.join(catPath, filename), b64, { encoding: 'base64' });
               modelUrl = `/models/${data.category}/${filename}`;
            }

            // Save Thumbnail File
            let thumbUrl = modelUrl;
            if (data.thumbnailFile) {
               const b64 = data.thumbnailFile.split(';base64,').pop();
               const ext = data.thumbnailFileName.split('.').pop();
               const filename = `${id}_thumb.${ext}`;
               fs.writeFileSync(path.join(catPath, filename), b64, { encoding: 'base64' });
               thumbUrl = `/models/${data.category}/${filename}`;
            }

            // Update catalog.json
            const catFilePath = path.resolve(__dirname, 'public/models/catalog.json');
            const catalog = JSON.parse(fs.readFileSync(catFilePath, 'utf-8'));
            catalog.models.push({
               id,
               name: data.name,
               category: data.category,
               material: data.material || "",
               modelPath: modelUrl,
               mtlPath: "",
               texturePath: "",
               glbPath: modelUrl,
               thumbnailPath: thumbUrl,
               uploadedAt: new Date().toISOString(),
               scale: data.scale,
               offset: data.offset,
               rotationOffset: data.rotationOffset,
               necklaceType: data.necklaceType || "open"
            });
            fs.writeFileSync(catFilePath, JSON.stringify(catalog, null, 2));

            // Update model-defaults.json
            const defFilePath = path.resolve(__dirname, 'public/models/model-defaults.json');
            let defaults = { modelDefaults: {} };
            if (fs.existsSync(defFilePath)) {
               defaults = JSON.parse(fs.readFileSync(defFilePath, 'utf-8'));
            } else {
               defaults = { modelDefaults: {} };
            }
            defaults.modelDefaults[id] = {
               posX: data.offset[0],
               posY: data.offset[1],
               posZ: data.offset[2],
               rotX: data.rotationOffset[0],
               rotY: data.rotationOffset[1],
               rotZ: data.rotationOffset[2],
               scale: data.scale[0],
               enableSparkles: true,
               category: data.category
            };
            fs.writeFileSync(defFilePath, JSON.stringify(defaults, null, 2));

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, message: 'Saved successfully to local JSON files' }));
          } catch (e) {
            console.error('Upload Error:', e);
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, message: e.message }));
          }
        });
      } else if (req.url === '/api/mock-toggle-delete' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { id, deleted } = JSON.parse(body);
            const catFilePath = path.resolve(__dirname, 'public/models/catalog.json');
            const catalog = JSON.parse(fs.readFileSync(catFilePath, 'utf-8'));
            const modelIndex = catalog.models.findIndex(m => m.id === id);
            if (modelIndex > -1) {
              catalog.models[modelIndex].deleted = deleted;
              fs.writeFileSync(catFilePath, JSON.stringify(catalog, null, 2));
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ success: false, message: 'Model not found' }));
            }
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, message: e.message }));
          }
        });
      } else if (req.url === '/api/update-catalog-material' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const { id, material } = JSON.parse(body);
            const catFilePath = path.resolve(__dirname, 'public/models/catalog.json');
            const catalog = JSON.parse(fs.readFileSync(catFilePath, 'utf-8'));
            const modelIndex = catalog.models.findIndex(m => m.id === id);
            if (modelIndex > -1) {
              catalog.models[modelIndex].material = material;
              fs.writeFileSync(catFilePath, JSON.stringify(catalog, null, 2));
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ success: false, message: 'Model not found' }));
            }
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, message: e.message }));
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
  plugins: [react(), saveConfigPlugin(), mockUploadPlugin()],
})

