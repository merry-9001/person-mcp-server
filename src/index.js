#!/usr/bin/env node
import { getConfig } from './config.js';
import { startHttpServer } from './http/server.js';
import { startStdioServer } from './mcp/server.js';
import { SonarClient } from './sonar/client.js';
import { createTools } from './tools/definitions.js';
import { createQualityTools } from './tools/qualityDefinitions.js';
import { createSentryTools } from './tools/sentryDefinitions.js';

const config = getConfig();
const client = new SonarClient(config);
const tools = [...createTools(client, config), ...createSentryTools(config), ...createQualityTools(client, config)];

if (config.transport === 'http') {
  startHttpServer(tools, config);
} else {
  await startStdioServer(tools);
}
