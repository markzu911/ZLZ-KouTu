import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

let aiInstance: GoogleGenAI | null = null;
function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // SaaS API Proxy helper
  const SAAS_BASE_URL = "http://aibigtree.com";
  const proxyToSaas = async (req: express.Request, res: express.Response, targetPath: string) => {
    try {
      const response = await axios({
        method: req.method,
        url: `${SAAS_BASE_URL}${targetPath}`,
        data: req.body,
        headers: { 'Content-Type': 'application/json' }
      });
      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error(`SaaS Proxy Error (${targetPath}):`, error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Proxy failed" });
    }
  };

  // SaaS Endpoints
  app.post("/api/tool/launch", (req, res) => proxyToSaas(req, res, "/api/tool/launch"));
  app.post("/api/tool/verify", (req, res) => proxyToSaas(req, res, "/api/tool/verify"));
  app.post("/api/tool/consume", (req, res) => proxyToSaas(req, res, "/api/tool/consume"));
  
  // Image Upload Endpoints
  app.post("/api/upload/image", (req, res) => proxyToSaas(req, res, "/api/upload/image"));
  app.post("/api/upload/direct-token", (req, res) => proxyToSaas(req, res, "/api/upload/direct-token"));
  app.post("/api/upload/commit", (req, res) => proxyToSaas(req, res, "/api/upload/commit"));

  // Gemini API Proxy
  app.post("/api/gemini", async (req, res) => {
    try {
      const { model: modelName, payload } = req.body;
      const response = await getAI().models.generateContent({
        model: modelName,
        ...payload
      });
      
      res.json(response);
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
