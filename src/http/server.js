import express from 'express';
import { z } from 'zod';

export function startHttpServer(tools, config) {
  const app = express();
  const registry = new Map(tools.map((tool) => [tool.name, tool]));

  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (req, res) => {
    res.json({ ok: true, name: 'sonarqube-mcp-fixer' });
  });

  app.get('/tools', (req, res) => {
    res.json({
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description
      }))
    });
  });

  app.post('/tools/:name', async (req, res) => {
    const tool = registry.get(req.params.name);
    if (!tool) {
      res.status(404).json({ error: `Unknown tool: ${req.params.name}` });
      return;
    }

    try {
      const parsed = z.object(tool.schema).parse(req.body || {});
      const result = await tool.handler(parsed);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.listen(config.httpPort, () => {
    console.error(`SonarQube MCP HTTP server listening on http://localhost:${config.httpPort}`);
  });
}
