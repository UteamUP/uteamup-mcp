# MCP Server: Dedicated Instance Integration

## Changes Required in index.js

### 1. Dynamic URL Resolution (after OAuth auth)

After successful authentication, check if the tenant has a `DedicatedApiUrl`:

```javascript
// After token exchange, before forwarding requests:
const tenantInfo = await getTenantInfo(token);
const apiBaseUrl = tenantInfo.dedicatedApiUrl || process.env.UTEAMUP_API_BASE_URL;
```

### 2. New Tool Definitions

Add these tools to the MCP tool registry:

```javascript
{
  name: "get_dedicated_instance_status",
  description: "Get the status of a tenant's dedicated API/frontend instances",
  inputSchema: { type: "object", properties: {} }
},
{
  name: "get_dedicated_instance_billing", 
  description: "Get billing breakdown for dedicated infrastructure",
  inputSchema: { type: "object", properties: {} }
}
```

### 3. Forward to Backend MCP Handlers

These tools map to the backend MCP commands:
- `get_dedicated_instance_status` → `GetDedicatedInstanceStatusCommand`
- `get_dedicated_instance_billing` → `GetDedicatedInstanceBillingCommand`

The backend handlers are already created at:
- `UteamUP_API/MCP/Commands/DedicatedInstance/`
- `UteamUP_API/MCP/Handlers/DedicatedInstance/`
