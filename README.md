# Coolify MCP Server

A secure Model Context Protocol (MCP) server for Coolify API integration, designed for Claude Code.

## 🔒 Security Notice

This is a **security-audited** implementation of Coolify MCP server maintained under our own control for:
- Supply chain security
- Controlled dependency management  
- Custom security enhancements
- Audit trail of all changes

## Features

- **Application Management**: List, deploy, stop, and restart Coolify applications
- **Deployment Monitoring**: Check deployment status and logs
- **Webhook Management**: Create and manage application-specific webhooks
- **Server Information**: Get server details and configuration
- **MCP Protocol**: Full Model Context Protocol compliance for Claude Code integration

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file or set environment variables:

```bash
COOLIFY_URL=http://your-coolify-instance:8000
COOLIFY_TOKEN_PATH=/path/to/coolify/token
PLATFORM_IP=your-platform-ip  # Optional: defaults to localhost
```

## Usage

### Standalone Mode
```bash
npm start
```

### Development Mode
```bash
npm run dev
```

### Testing
```bash
npm test
```

### Claude Code Integration

Add to Claude Code MCP configuration:

```bash
claude mcp add coolify-mcp \
  -e COOLIFY_URL=http://your-coolify-instance:8000 \
  -e COOLIFY_TOKEN_PATH=/path/to/token \
  -- node /path/to/coolify-mcp-server/index.js
```

## Available MCP Tools

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `coolify_list_applications` | List all applications | None |
| `coolify_get_application` | Get application details | `uuid` |
| `coolify_deploy_application` | Deploy application | `uuid`, `forceRebuild` (optional) |
| `coolify_get_deployment_status` | Get deployment status | `uuid` |
| `coolify_list_deployments` | List application deployments | `uuid` |
| `coolify_stop_application` | Stop application | `uuid` |
| `coolify_restart_application` | Restart application | `uuid` |
| `coolify_get_application_logs` | Get application logs | `uuid`, `lines` (optional), `since` (optional) |
| `coolify_create_webhook` | Create webhook | `applicationUuid`, `name`, `url`, `secret` (optional) |
| `coolify_get_server_info` | Get server information | None |
| `coolify_list_servers` | List all servers | None |

## Security Features

- **Token-based Authentication**: Secure Bearer token authentication with Coolify API
- **Input Validation**: All parameters validated before API calls
- **Error Handling**: Secure error responses without sensitive data exposure
- **No External Dependencies**: Minimal dependency footprint for security
- **Audit Logging**: Request/response logging for security monitoring

## API Endpoints Used

- `GET /api/v1/applications` - List applications
- `GET /api/v1/applications/{uuid}` - Get application details
- `POST /api/v1/applications/{uuid}/deploy` - Deploy application
- `GET /api/v1/servers` - Get server information
- `POST /api/v1/applications/{uuid}/webhooks` - Create webhooks

## Dependencies

- **axios**: HTTP client for API requests
- **dotenv**: Environment variable management
- **nodemon**: Development server (dev dependency)

## Security Audit

This codebase has been security audited for:
- ✅ Data leak prevention
- ✅ External connection verification
- ✅ Prompt injection protection
- ✅ Dependency vulnerability scanning
- ✅ Authentication security

See `SECURITY.md` for detailed security assessment.

## License

MIT License - See LICENSE file for details.

## Contributing

1. Security-first approach required for all contributions
2. All changes must pass security review
3. Dependencies must be audited before addition
4. Follow existing code patterns and documentation

## Support

For issues or questions:
- Create GitHub issue in this repository
- Include relevant logs (with sensitive data redacted)
- Provide environment details