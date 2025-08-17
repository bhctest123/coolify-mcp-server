#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

class CoolifyMCPServer {
  constructor() {
    // Security: Enforce HTTPS in production
    this.baseUrl = this.validateAndSetBaseUrl();
    this.token = null;
    this.loadToken();
    this.configureHttpsAgent();
  }

  validateAndSetBaseUrl() {
    // Security: Default to HTTPS in production, allow HTTP override for development
    let baseUrl;
    if (process.env.COOLIFY_URL) {
      baseUrl = process.env.COOLIFY_URL;
    } else if (process.env.NODE_ENV === 'production') {
      baseUrl = `https://${process.env.PLATFORM_IP || "localhost"}:8000`;
    } else {
      // Development: Allow HTTP for testing, but log security warning
      baseUrl = `http://${process.env.PLATFORM_IP || "localhost"}:8000`;
      console.warn('⚠️  WARNING: Using HTTP in development mode. HTTPS required for production.');
    }
    
    // Security: Validate URL format
    try {
      const url = new URL(baseUrl);
      if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
        throw new Error('HTTPS required in production environment');
      }
      return baseUrl;
    } catch (error) {
      console.error('Invalid Coolify URL configuration');
      process.exit(1);
    }
  }

  configureHttpsAgent() {
    // Security: Configure HTTPS agent with proper security settings
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      secureProtocol: 'TLSv1_2_method',
      ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384'
    });
  }

  loadToken() {
    try {
      const tokenPath = this.validateTokenPath(process.env.COOLIFY_TOKEN_PATH || '/root/.coolify-token');
      
      // Security: Check file permissions
      const stats = fs.statSync(tokenPath);
      if (stats.mode & parseInt('077', 8)) {
        throw new Error('Token file has unsafe permissions');
      }
      
      this.token = fs.readFileSync(tokenPath, 'utf8').trim();
      
      // Security: Validate token format
      this.validateToken(this.token);
      
    } catch (error) {
      // Security: Generic error message to prevent information disclosure
      console.error('Authentication configuration error');
      process.exit(1);
    }
  }

  validateTokenPath(tokenPath) {
    // Security: Prevent path traversal attacks
    const resolvedPath = path.resolve(tokenPath);
    const allowedPaths = [
      '/root',
      '/var/secrets',
      '/opt/secrets',
      process.env.HOME || '/root'
    ];
    
    const isAllowed = allowedPaths.some(allowedPath => 
      resolvedPath.startsWith(path.resolve(allowedPath))
    );
    
    if (!isAllowed) {
      throw new Error('Token path not in allowed directory');
    }
    
    return resolvedPath;
  }

  validateToken(token) {
    // Security: Validate token format (base64-like pattern)
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token format');
    }
    
    // Check for reasonable token length (Coolify tokens are typically long)
    if (token.length < 20 || token.length > 500) {
      throw new Error('Invalid token length');
    }
    
    // Check for dangerous characters that could indicate injection
    if (/[<>"'&\r\n\t]/.test(token)) {
      throw new Error('Token contains invalid characters');
    }
  }

  // Security: UUID validation to prevent path injection
  validateUUID(uuid) {
    if (!uuid || typeof uuid !== 'string') {
      throw new Error('UUID required');
    }
    
    // Support both standard UUID v4 format and Coolify's custom format
    const standardUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const coolifyUuidRegex = /^[0-9a-z]{20,28}$/i; // Coolify's custom format (20-28 chars, alphanumeric)
    
    // Prevent obvious injection patterns
    if (/[\/\\\.\.%]/.test(uuid)) {
      throw new Error('Invalid UUID format - contains path characters');
    }
    
    // Check against both supported formats
    if (!standardUuidRegex.test(uuid) && !coolifyUuidRegex.test(uuid)) {
      throw new Error('Invalid UUID format');
    }
    
    return uuid;
  }

  // Security: Validate application log parameters
  validateLogOptions(options) {
    const validated = {};
    
    // Validate lines parameter
    if (options.lines !== undefined) {
      const lines = parseInt(options.lines, 10);
      if (isNaN(lines) || lines < 1 || lines > 10000) {
        throw new Error('Invalid lines parameter (1-10000)');
      }
      validated.lines = lines;
    } else {
      validated.lines = 100; // Safe default
    }
    
    // Validate since parameter
    if (options.since !== undefined) {
      // Allow only safe time formats
      if (!/^\d+[smhd]$/.test(options.since)) {
        throw new Error('Invalid since parameter format (use 1s, 5m, 2h, 1d)');
      }
      validated.since = options.since;
    } else {
      validated.since = '1h'; // Safe default
    }
    
    return validated;
  }

  // Security: Validate webhook payload
  validateWebhookPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Webhook payload must be an object');
    }
    
    // Validate required fields
    if (!payload.name || typeof payload.name !== 'string') {
      throw new Error('Webhook name is required');
    }
    
    if (!payload.url || typeof payload.url !== 'string') {
      throw new Error('Webhook URL is required');
    }
    
    // Validate URL format
    try {
      const url = new URL(payload.url);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Webhook URL must use HTTP or HTTPS');
      }
    } catch (error) {
      throw new Error('Invalid webhook URL format');
    }
    
    // Sanitize name (alphanumeric and basic chars only)
    if (!/^[a-zA-Z0-9\-_\s]{1,100}$/.test(payload.name)) {
      throw new Error('Webhook name contains invalid characters');
    }
    
    // Validate optional secret
    if (payload.secret && typeof payload.secret !== 'string') {
      throw new Error('Webhook secret must be a string');
    }
    
    return {
      name: payload.name.trim(),
      url: payload.url,
      secret: payload.secret || undefined
    };
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  async makeRequest(method, endpoint, data = null) {
    try {
      // Security: Validate endpoint to prevent injection
      if (!endpoint || typeof endpoint !== 'string') {
        throw new Error('Invalid endpoint');
      }
      
      // Security: Prevent path traversal in endpoints
      if (endpoint.includes('..') || endpoint.includes('//')) {
        throw new Error('Invalid endpoint format');
      }
      
      const config = {
        method,
        url: `${this.baseUrl}/api/v1${endpoint}`,
        headers: this.getHeaders(),
        timeout: 30000,
        httpsAgent: this.httpsAgent,
        maxRedirects: 0 // Security: Prevent redirect attacks
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      // Security: Sanitized error messages to prevent information disclosure
      if (error.response) {
        const status = error.response.status;
        if (status === 401) {
          throw new Error('Authentication failed');
        } else if (status === 403) {
          throw new Error('Access denied');
        } else if (status === 404) {
          throw new Error('Resource not found');
        } else if (status >= 500) {
          throw new Error('Server error');
        } else {
          throw new Error('API request failed');
        }
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('Service unavailable');
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error('Request timeout');
      } else {
        throw new Error('Network error');
      }
    }
  }

  // MCP tool implementations
  async listApplications() {
    try {
      const data = await this.makeRequest('GET', '/applications');
      return {
        success: true,
        applications: data.data || data,
        count: Array.isArray(data.data) ? data.data.length : (Array.isArray(data) ? data.length : 0)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getApplication(uuid) {
    try {
      // Security: Validate UUID to prevent path injection
      const validatedUuid = this.validateUUID(uuid);
      const data = await this.makeRequest('GET', `/applications/${validatedUuid}`);
      return {
        success: true,
        application: data.data || data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deployApplication(uuid, options = {}) {
    try {
      // Security: Validate UUID to prevent path injection
      const validatedUuid = this.validateUUID(uuid);
      
      // Security: Validate and sanitize options
      const payload = {
        force_rebuild: Boolean(options.forceRebuild || false)
      };
      
      const data = await this.makeRequest('POST', `/applications/${validatedUuid}/deploy`, payload);
      return {
        success: true,
        deployment: data.data || data,
        message: 'Deployment initiated successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getDeploymentStatus(uuid) {
    try {
      // Security: Validate UUID to prevent path injection
      const validatedUuid = this.validateUUID(uuid);
      const data = await this.makeRequest('GET', `/applications/${validatedUuid}/status`);
      return {
        success: true,
        status: data.data || data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async listDeployments(uuid) {
    try {
      // Security: Validate UUID to prevent path injection
      const validatedUuid = this.validateUUID(uuid);
      const data = await this.makeRequest('GET', `/applications/${validatedUuid}/deployments`);
      return {
        success: true,
        deployments: data.data || data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async stopApplication(uuid) {
    try {
      // Security: Validate UUID to prevent path injection
      const validatedUuid = this.validateUUID(uuid);
      const data = await this.makeRequest('POST', `/applications/${validatedUuid}/stop`);
      return {
        success: true,
        message: 'Application stopped successfully',
        result: data.data || data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async restartApplication(uuid) {
    try {
      // Security: Validate UUID to prevent path injection
      const validatedUuid = this.validateUUID(uuid);
      const data = await this.makeRequest('POST', `/applications/${validatedUuid}/restart`);
      return {
        success: true,
        message: 'Application restarted successfully',
        result: data.data || data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getApplicationLogs(uuid, options = {}) {
    try {
      // Security: Validate UUID to prevent path injection
      const validatedUuid = this.validateUUID(uuid);
      
      // Security: Validate log options to prevent parameter injection
      const validatedOptions = this.validateLogOptions(options);
      
      const params = new URLSearchParams({
        lines: validatedOptions.lines,
        since: validatedOptions.since
      });
      
      const data = await this.makeRequest('GET', `/applications/${validatedUuid}/logs?${params}`);
      return {
        success: true,
        logs: data.data || data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async listWebhooks() {
    try {
      // Note: Webhooks are application-specific in Coolify API
      // This method is currently not supported at the global level
      return {
        success: false,
        error: "Webhooks are application-specific. Use application UUID to get webhooks for a specific app."
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createWebhook(applicationUuid, payload) {
    try {
      // Security: Validate UUID to prevent path injection
      const validatedUuid = this.validateUUID(applicationUuid);
      
      // Security: Validate and sanitize webhook payload
      const validatedPayload = this.validateWebhookPayload(payload);
      
      const data = await this.makeRequest('POST', `/applications/${validatedUuid}/webhooks`, validatedPayload);
      return {
        success: true,
        webhook: data.data || data,
        message: 'Webhook created successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getServerInfo() {
    try {
      const data = await this.makeRequest('GET', '/servers');
      return {
        success: true,
        servers: data,
        count: Array.isArray(data) ? data.length : 1
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // MCP Server Protocol Implementation
  async handleMCPRequest(request) {
    const { method, params } = request;

    switch (method) {
      case 'tools/list':
        return {
          tools: [
            {
              name: 'coolify_list_applications',
              description: 'List all applications in Coolify',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'coolify_get_application',
              description: 'Get details of a specific application',
              inputSchema: {
                type: 'object',
                properties: {
                  uuid: {
                    type: 'string',
                    description: 'Application UUID'
                  }
                },
                required: ['uuid']
              }
            },
            {
              name: 'coolify_deploy_application',
              description: 'Deploy an application',
              inputSchema: {
                type: 'object',
                properties: {
                  uuid: {
                    type: 'string',
                    description: 'Application UUID'
                  },
                  forceRebuild: {
                    type: 'boolean',
                    description: 'Force rebuild the application'
                  }
                },
                required: ['uuid']
              }
            },
            {
              name: 'coolify_get_deployment_status',
              description: 'Get deployment status of an application',
              inputSchema: {
                type: 'object',
                properties: {
                  uuid: {
                    type: 'string',
                    description: 'Application UUID'
                  }
                },
                required: ['uuid']
              }
            },
            {
              name: 'coolify_list_deployments',
              description: 'List deployments for an application',
              inputSchema: {
                type: 'object',
                properties: {
                  uuid: {
                    type: 'string',
                    description: 'Application UUID'
                  }
                },
                required: ['uuid']
              }
            },
            {
              name: 'coolify_stop_application',
              description: 'Stop an application',
              inputSchema: {
                type: 'object',
                properties: {
                  uuid: {
                    type: 'string',
                    description: 'Application UUID'
                  }
                },
                required: ['uuid']
              }
            },
            {
              name: 'coolify_restart_application',
              description: 'Restart an application',
              inputSchema: {
                type: 'object',
                properties: {
                  uuid: {
                    type: 'string',
                    description: 'Application UUID'
                  }
                },
                required: ['uuid']
              }
            },
            {
              name: 'coolify_get_application_logs',
              description: 'Get application logs',
              inputSchema: {
                type: 'object',
                properties: {
                  uuid: {
                    type: 'string',
                    description: 'Application UUID'
                  },
                  lines: {
                    type: 'number',
                    description: 'Number of log lines to fetch (default: 100)'
                  },
                  since: {
                    type: 'string',
                    description: 'Time duration to fetch logs from (default: 1h)'
                  }
                },
                required: ['uuid']
              }
            },
            {
              name: 'coolify_list_webhooks',
              description: 'List all webhooks',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'coolify_create_webhook',
              description: 'Create a webhook for an application',
              inputSchema: {
                type: 'object',
                properties: {
                  applicationUuid: {
                    type: 'string',
                    description: 'Application UUID'
                  },
                  name: {
                    type: 'string',
                    description: 'Webhook name'
                  },
                  url: {
                    type: 'string',
                    description: 'Webhook URL'
                  },
                  secret: {
                    type: 'string',
                    description: 'Webhook secret'
                  }
                },
                required: ['applicationUuid', 'name', 'url']
              }
            },
            {
              name: 'coolify_get_server_info',
              description: 'Get Coolify server information',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            }
          ]
        };

      case 'tools/call':
        const { name, arguments: args } = params;
        
        switch (name) {
          case 'coolify_list_applications':
            return { content: [{ type: 'text', text: JSON.stringify(await this.listApplications(), null, 2) }] };
          
          case 'coolify_get_application':
            return { content: [{ type: 'text', text: JSON.stringify(await this.getApplication(args.uuid), null, 2) }] };
          
          case 'coolify_deploy_application':
            return { content: [{ type: 'text', text: JSON.stringify(await this.deployApplication(args.uuid, args), null, 2) }] };
          
          case 'coolify_get_deployment_status':
            return { content: [{ type: 'text', text: JSON.stringify(await this.getDeploymentStatus(args.uuid), null, 2) }] };
          
          case 'coolify_list_deployments':
            return { content: [{ type: 'text', text: JSON.stringify(await this.listDeployments(args.uuid), null, 2) }] };
          
          case 'coolify_stop_application':
            return { content: [{ type: 'text', text: JSON.stringify(await this.stopApplication(args.uuid), null, 2) }] };
          
          case 'coolify_restart_application':
            return { content: [{ type: 'text', text: JSON.stringify(await this.restartApplication(args.uuid), null, 2) }] };
          
          case 'coolify_get_application_logs':
            return { content: [{ type: 'text', text: JSON.stringify(await this.getApplicationLogs(args.uuid, args), null, 2) }] };
          
          case 'coolify_list_webhooks':
            return { content: [{ type: 'text', text: JSON.stringify(await this.listWebhooks(), null, 2) }] };
          
          case 'coolify_create_webhook':
            return { content: [{ type: 'text', text: JSON.stringify(await this.createWebhook(args.applicationUuid, args), null, 2) }] };
          
          case 'coolify_get_server_info':
            return { content: [{ type: 'text', text: JSON.stringify(await this.getServerInfo(), null, 2) }] };
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  start() {
    console.log('Coolify MCP Server starting...');
    
    // Read from stdin and write to stdout for MCP protocol
    process.stdin.setEncoding('utf8');
    
    let buffer = '';
    process.stdin.on('data', async (chunk) => {
      buffer += chunk;
      
      // Process complete lines
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        
        if (line.trim()) {
          try {
            const request = JSON.parse(line);
            const response = await this.handleMCPRequest(request);
            console.log(JSON.stringify(response));
          } catch (error) {
            console.error(JSON.stringify({
              error: {
                code: -1,
                message: error.message
              }
            }));
          }
        }
      }
    });

    process.stdin.on('end', () => {
      console.log('Coolify MCP Server shutting down...');
      process.exit(0);
    });
  }
}

// If run directly, start the server
if (require.main === module) {
  const server = new CoolifyMCPServer();
  server.start();
}

module.exports = CoolifyMCPServer;