# OpenCanvas API Server

Admin configuration API server for OpenCanvas. Manages users, LLM provider API keys, model routing configuration, function settings, and audit logs using SQLite.

## Features

- **User Management**: CRUD operations for admin, editor, and viewer users with bcrypt password hashing
- **LLM Provider Configuration**: Manage Anthropic and OpenAI API keys with connectivity testing
- **Model Routing**: Configure which models to use for fast/standard/premium tiers
- **Function Management**: Enable/disable functions and configure approval requirements
- **Usage Tracking**: Log and analyze LLM API usage with cost tracking
- **Audit Logging**: Comprehensive audit trail for all administrative actions
- **System Settings**: Configurable system-wide settings (rate limits, policies, etc.)
- **Real SQLite Database**: All data persisted to SQLite with WAL mode for performance
- **Security**: Bcrypt password hashing, session-based auth, API key masking

## Project Structure

```
apps/api-server/
├── src/
│   ├── db.ts                    # SQLite database initialization
│   ├── server.ts                # Main Express server
│   ├── middleware/
│   │   └── auth.ts              # Authentication middleware
│   └── routes/
│       ├── auth.ts              # Login, logout, current user
│       ├── users.ts             # User CRUD operations
│       ├── providers.ts         # LLM provider management
│       ├── models.ts            # Model routing configuration
│       ├── functions.ts         # Function configuration
│       ├── usage.ts             # Usage logging and analytics
│       ├── audit.ts             # Audit log
│       └── settings.ts          # System settings
├── data/
│   └── admin.db                 # SQLite database (gitignored)
├── package.json
├── tsconfig.json
└── README.md
```

## Quick Start

### Install Dependencies

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Server runs on http://localhost:4002

### Build

```bash
pnpm build
```

### Production

```bash
pnpm start
```

## Default Credentials

On first startup, a default admin user is created:

- **Email**: `admin@localhost`
- **Password**: `admin`

**Important**: Change this password immediately after first login!

## API Endpoints

### Authentication

#### POST /api/auth/login
Login with email and password.

```bash
curl -X POST http://localhost:4002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@localhost", "password": "admin"}'
```

Response:
```json
{
  "token": "uuid-session-token",
  "user": {
    "id": "user-id",
    "email": "admin@localhost",
    "name": "Administrator",
    "role": "admin"
  }
}
```

#### GET /api/auth/me
Get current user.

```bash
curl http://localhost:4002/api/auth/me \
  -H "Authorization: Bearer <token>"
```

#### POST /api/auth/logout
Logout and invalidate token.

```bash
curl -X POST http://localhost:4002/api/auth/logout \
  -H "Authorization: Bearer <token>"
```

### User Management

All endpoints require authentication with `Authorization: Bearer <token>` header.

#### GET /api/admin/users
List all users.

```bash
curl http://localhost:4002/api/admin/users \
  -H "Authorization: Bearer <token>"
```

#### POST /api/admin/users
Create a new user.

```bash
curl -X POST http://localhost:4002/api/admin/users \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "John Doe",
    "password": "secure-password",
    "role": "editor"
  }'
```

Roles: `admin`, `editor`, `viewer`

#### PUT /api/admin/users/:id
Update a user.

```bash
curl -X PUT http://localhost:4002/api/admin/users/<user-id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Jane Doe", "role": "admin"}'
```

#### DELETE /api/admin/users/:id
Soft delete a user (sets is_active=0).

```bash
curl -X DELETE http://localhost:4002/api/admin/users/<user-id> \
  -H "Authorization: Bearer <token>"
```

#### POST /api/admin/users/:id/reset-password
Reset user password.

```bash
curl -X POST http://localhost:4002/api/admin/users/<user-id>/reset-password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"password": "new-secure-password"}'
```

### LLM Provider Management

#### GET /api/admin/providers
List all providers (API keys are masked).

```bash
curl http://localhost:4002/api/admin/providers \
  -H "Authorization: Bearer <token>"
```

#### GET /api/admin/providers/active
Get active providers with full API keys (for internal use by ai-runtime).

This endpoint accepts either:
- Bearer token authentication
- Internal API key via `X-Internal-Key` header (defaults to `internal-dev-key` in dev)

```bash
curl http://localhost:4002/api/admin/providers/active \
  -H "X-Internal-Key: internal-dev-key"
```

#### POST /api/admin/providers
Create a new LLM provider.

```bash
curl -X POST http://localhost:4002/api/admin/providers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "anthropic",
    "display_name": "Anthropic Production",
    "api_key": "sk-ant-...",
    "base_url": null,
    "is_default": false
  }'
```

Supported providers: `anthropic`, `openai`

#### PUT /api/admin/providers/:id
Update a provider.

```bash
curl -X PUT http://localhost:4002/api/admin/providers/<provider-id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"display_name": "Anthropic Staging", "is_default": true}'
```

#### DELETE /api/admin/providers/:id
Delete a provider.

```bash
curl -X DELETE http://localhost:4002/api/admin/providers/<provider-id> \
  -H "Authorization: Bearer <token>"
```

#### POST /api/admin/providers/:id/test
Test provider connectivity by making a real API call.

```bash
curl -X POST http://localhost:4002/api/admin/providers/<provider-id>/test \
  -H "Authorization: Bearer <token>"
```

Response:
```json
{
  "success": true,
  "message": "Provider connection successful"
}
```

### Model Configuration

#### GET /api/admin/models
List all model configurations.

```bash
curl http://localhost:4002/api/admin/models \
  -H "Authorization: Bearer <token>"
```

#### PUT /api/admin/models/:tier
Update model configuration for a tier (fast, standard, premium).

```bash
curl -X PUT http://localhost:4002/api/admin/models/standard \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "provider-uuid",
    "model_id": "claude-3-5-sonnet-20241022",
    "max_tokens": 4096,
    "temperature": 0.7,
    "is_active": true
  }'
```

#### GET /api/admin/models/routing-rules
Get current routing rules (for ai-runtime).

```bash
curl http://localhost:4002/api/admin/models/routing-rules \
  -H "Authorization: Bearer <token>"
```

### Function Management

#### GET /api/admin/functions
List all function configurations.

```bash
curl http://localhost:4002/api/admin/functions \
  -H "Authorization: Bearer <token>"
```

#### PUT /api/admin/functions/:name
Update function configuration.

```bash
curl -X PUT http://localhost:4002/api/admin/functions/code_execution \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "is_enabled": true,
    "requires_approval": false,
    "tier_override": "premium"
  }'
```

### Usage Tracking

#### GET /api/admin/usage
List usage log entries with pagination.

```bash
curl "http://localhost:4002/api/admin/usage?limit=50&offset=0" \
  -H "Authorization: Bearer <token>"
```

#### GET /api/admin/usage/stats
Get aggregated usage statistics.

```bash
curl http://localhost:4002/api/admin/usage/stats \
  -H "Authorization: Bearer <token>"
```

Returns:
- Total tokens and costs
- Usage by provider
- Usage by function
- Usage by user
- Usage by status
- Recent activity (last 24 hours)

#### POST /api/admin/usage
Record a usage entry (called by ai-runtime after each LLM call).

```bash
curl -X POST http://localhost:4002/api/admin/usage \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-uuid",
    "function_name": "chat_completion",
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "input_tokens": 1250,
    "output_tokens": 850,
    "total_tokens": 2100,
    "estimated_cost": 0.021,
    "duration_ms": 2345,
    "status": "success"
  }'
```

### Audit Log

#### GET /api/admin/audit
List audit log entries with pagination and filtering.

```bash
curl "http://localhost:4002/api/admin/audit?limit=50&offset=0&resource_type=user&action=create" \
  -H "Authorization: Bearer <token>"
```

#### POST /api/admin/audit
Record an audit entry.

```bash
curl -X POST http://localhost:4002/api/admin/audit \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "actor_id": "user-uuid",
    "actor_email": "admin@localhost",
    "action": "custom_action",
    "resource_type": "custom_resource",
    "resource_id": "resource-uuid",
    "details": "{\"key\": \"value\"}"
  }'
```

### System Settings

#### GET /api/admin/settings
Get all system settings.

```bash
curl http://localhost:4002/api/admin/settings \
  -H "Authorization: Bearer <token>"
```

#### PUT /api/admin/settings/:key
Set a system setting.

```bash
curl -X PUT http://localhost:4002/api/admin/settings/rate_limit_per_minute \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"value": 100}'
```

Common settings:
- `rate_limit_per_minute`: Rate limit for API calls
- `max_tokens_per_request`: Maximum tokens per request
- `content_policy`: Content moderation policy
- `org_name`: Organization name

## Database Schema

### users
- `id`: UUID primary key
- `email`: Unique email address
- `name`: User full name
- `password_hash`: Bcrypt hashed password
- `role`: admin | editor | viewer
- `is_active`: Soft delete flag
- `created_at`, `updated_at`: Timestamps

### llm_providers
- `id`: UUID primary key
- `provider`: anthropic | openai
- `display_name`: Human-readable name
- `api_key`: Provider API key
- `base_url`: Optional custom base URL
- `is_default`: Default provider flag
- `is_active`: Active flag
- `created_at`, `updated_at`: Timestamps

### model_config
- `id`: UUID primary key
- `tier`: fast | standard | premium
- `provider_id`: Foreign key to llm_providers
- `model_id`: Model identifier
- `max_tokens`: Maximum tokens
- `temperature`: Temperature setting
- `is_active`: Active flag
- `created_at`, `updated_at`: Timestamps

### function_config
- `function_name`: Primary key
- `is_enabled`: Enabled flag
- `requires_approval`: Approval requirement flag
- `tier_override`: Optional tier override
- `updated_at`: Timestamp

### usage_log
- `id`: UUID primary key
- `user_id`: Optional user ID
- `function_name`: Function that made the call
- `provider`: LLM provider used
- `model`: Model used
- `input_tokens`, `output_tokens`, `total_tokens`: Token counts
- `estimated_cost`: Estimated cost in USD
- `duration_ms`: Request duration
- `status`: success | error
- `error_message`: Optional error message
- `created_at`: Timestamp

### audit_log
- `id`: UUID primary key
- `actor_id`: User who performed the action
- `actor_email`: Actor's email
- `action`: Action performed
- `resource_type`: Type of resource
- `resource_id`: Resource identifier
- `details`: JSON details
- `created_at`: Timestamp

### system_settings
- `key`: Setting key (primary key)
- `value`: Setting value (JSON or string)
- `updated_at`: Timestamp

## Security

- **Password Hashing**: All passwords are hashed with bcrypt (10 rounds)
- **API Key Masking**: API keys are masked in list endpoints (only last 4 chars shown)
- **Session Management**: In-memory session store (tokens invalidated on logout)
- **Internal API Key**: Protected internal endpoints for ai-runtime access
- **Audit Logging**: All administrative actions are logged
- **Soft Deletes**: Users are soft-deleted (is_active=0) to preserve audit trail

## Environment Variables

- `PORT`: Server port (default: 4002)
- `INTERNAL_API_KEY`: Internal API key for ai-runtime (default: `internal-dev-key`)

## Development Notes

- Database is stored in `data/admin.db` (gitignored)
- WAL mode enabled for better concurrent access
- Foreign keys enforced
- All routes use real SQLite operations (no mock data)
- Provider test endpoint makes real API calls to verify connectivity
- Comprehensive error handling and logging

## Integration with ai-runtime

The ai-runtime service should:

1. Call `GET /api/admin/providers/active` with `X-Internal-Key` header to get provider configs
2. Call `GET /api/admin/models/routing-rules` to get model routing configuration
3. Call `POST /api/admin/usage` after each LLM call to log usage
4. Check function configs via `GET /api/admin/functions` for enable/disable status

## License

Private - Part of OpenCanvas monorepo
