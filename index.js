#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class CoolifyMCPServer {
  constructor() {
    this.baseUrl = process.env.COOLIFY_URL || `http://${process.env.PLATFORM_IP || "localhost"}:8000`;
    this.token = null;
    this.loadToken();
  }

  loadToken() {
    try {
      const tokenPath = process.env.COOLIFY_TOKEN_PATH || '/root/.coolify-token';
      this.token = fs.readFileSync(tokenPath, 'utf8').trim();
    } catch (error) {
      console.error('Failed to load Coolify token:', error.message);
      process.exit(1);
    }
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
      const config = {
        method,
        url: `${this.baseUrl}/api/v1${endpoint}`,
        headers: this.getHeaders(),
        timeout: 30000
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      throw new Error(`Coolify API error: ${error.response?.data?.message || error.message}`);
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
      const data = await this.makeRequest('GET', `/applications/${uuid}`);
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
      const payload = {
        force_rebuild: options.forceRebuild || false,
        ...options
      };
      
      const data = await this.makeRequest('POST', `/applications/${uuid}/deploy`, payload);
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
      const data = await this.makeRequest('GET', `/applications/${uuid}/status`);
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
      const data = await this.makeRequest('GET', `/applications/${uuid}/deployments`);
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
      const data = await this.makeRequest('POST', `/applications/${uuid}/stop`);
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
      const data = await this.makeRequest('POST', `/applications/${uuid}/restart`);
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
      const params = new URLSearchParams({
        lines: options.lines || 100,
        since: options.since || '1h'
      });
      
      const data = await this.makeRequest('GET', `/applications/${uuid}/logs?${params}`);
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
      const data = await this.makeRequest('POST', `/applications/${applicationUuid}/webhooks`, payload);
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