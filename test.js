#!/usr/bin/env node

const CoolifyMCPServer = require('./index.js');

async function testCoolifyMCP() {
  console.log('🧪 Testing Coolify MCP Server');
  console.log('================================');

  const server = new CoolifyMCPServer();

  // Test connection and authentication
  console.log('\n1. Testing server connection...');
  try {
    const serverInfo = await server.getServerInfo();
    if (serverInfo.success) {
      console.log('✅ Server connection successful');
      console.log(`   Server info: ${JSON.stringify(serverInfo.server, null, 2)}`);
    } else {
      console.log('❌ Server connection failed:', serverInfo.error);
      return;
    }
  } catch (error) {
    console.log('❌ Server connection error:', error.message);
    return;
  }

  // Test listing applications
  console.log('\n2. Testing list applications...');
  try {
    const apps = await server.listApplications();
    if (apps.success) {
      console.log(`✅ Found ${apps.count} applications`);
      if (apps.applications && apps.applications.length > 0) {
        console.log('   Sample application:');
        console.log(`   - Name: ${apps.applications[0].name || 'N/A'}`);
        console.log(`   - UUID: ${apps.applications[0].uuid || apps.applications[0].id || 'N/A'}`);
        console.log(`   - Status: ${apps.applications[0].status || 'N/A'}`);
      }
    } else {
      console.log('❌ List applications failed:', apps.error);
    }
  } catch (error) {
    console.log('❌ List applications error:', error.message);
  }

  // Test getting a specific application (if any exist)
  console.log('\n3. Testing get application...');
  try {
    const apps = await server.listApplications();
    if (apps.success && apps.applications && apps.applications.length > 0) {
      const appUuid = apps.applications[0].uuid || apps.applications[0].id;
      if (appUuid) {
        const app = await server.getApplication(appUuid);
        if (app.success) {
          console.log('✅ Get application successful');
          console.log(`   Application: ${app.application.name || 'N/A'}`);
        } else {
          console.log('❌ Get application failed:', app.error);
        }
      } else {
        console.log('⚠️  No application UUID found to test');
      }
    } else {
      console.log('⚠️  No applications found to test');
    }
  } catch (error) {
    console.log('❌ Get application error:', error.message);
  }

  // Test MCP protocol handlers
  console.log('\n4. Testing MCP protocol handlers...');
  
  // Test tools/list
  try {
    const toolsList = await server.handleMCPRequest({
      method: 'tools/list',
      params: {}
    });
    console.log(`✅ MCP tools/list successful - ${toolsList.tools.length} tools available`);
  } catch (error) {
    console.log('❌ MCP tools/list error:', error.message);
  }

  // Test tools/call for list applications
  try {
    const mcpResponse = await server.handleMCPRequest({
      method: 'tools/call',
      params: {
        name: 'coolify_list_applications',
        arguments: {}
      }
    });
    console.log('✅ MCP tools/call (list applications) successful');
    const responseData = JSON.parse(mcpResponse.content[0].text);
    console.log(`   Found ${responseData.count || 0} applications via MCP`);
  } catch (error) {
    console.log('❌ MCP tools/call error:', error.message);
  }

  console.log('\n🏁 Coolify MCP Server tests completed');
}

async function testDirectAPI() {
  console.log('\n🌐 Testing Direct Coolify API');
  console.log('==============================');

  const server = new CoolifyMCPServer();

  console.log('\n1. Testing direct API calls...');
  
  // Test individual methods
  const tests = [
    { name: 'Server Info', method: 'getServerInfo' },
    { name: 'List Applications', method: 'listApplications' },
    { name: 'List Webhooks', method: 'listWebhooks' }
  ];

  for (const test of tests) {
    try {
      console.log(`\n   Testing ${test.name}...`);
      const result = await server[test.method]();
      if (result.success) {
        console.log(`   ✅ ${test.name} successful`);
        if (result.count !== undefined) {
          console.log(`      Count: ${result.count}`);
        }
      } else {
        console.log(`   ❌ ${test.name} failed: ${result.error}`);
      }
    } catch (error) {
      console.log(`   ❌ ${test.name} error: ${error.message}`);
    }
  }
}

// Main test execution
async function main() {
  try {
    await testCoolifyMCP();
    await testDirectAPI();
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}