# HTTP interfaces

## Passwordless account verification

All mutations require JSON and an exact allowed Origin. Browser requests include it automatically. Secrets and session tokens never belong in request URLs.

### POST /api/auth/whatsapp/send-code

```json
{"phoneNumber":"+971501234567","language":"en"}
```

Language accepts `en` or `ar`; default `en`. Success: `{"expiresIn":300,"resendAfter":60,"deliveryLanguage":"en"}`. No code or token is returned. Uses the configured approved Meta template.

### POST /api/auth/whatsapp/verify-code

```json
{"phoneNumber":"+971501234567","code":"123456"}
```

Success sets the signed HttpOnly session cookie and returns `{"redirectTo":"/onboarding?lang=en"}` for new users, or `/dashboard` for existing members. The example code above has no special meaning. Codes expire, are attempt-limited, and cannot be replayed.

Auth errors use Better Auth's `{code,message}` shape. Expected errors include INVALID_CODE, CODE_EXPIRED, ATTEMPTS_EXCEEDED, RESEND_TOO_SOON, SEND_LIMIT_REACHED, WHATSAPP_NOT_CONFIGURED and WHATSAPP_SEND_FAILED. Phone-based budgets live in MongoDB. Additional endpoint throttling can return HTTP 429.

`GET /api/auth/get-session` reads the current session; `POST /api/auth/sign-out` revokes it. Email/password signup and login are disabled.

## Business APIs

All endpoints below require an active, phone-verified session. Successful responses use `{data: ...}`. Errors use `{error:{code,message,requestId,details?}}`; responses include `x-request-id` and `Cache-Control: no-store`.

| Method | Path | Permission |
|---|---|---|
| GET | `/api/v1/businesses` | Own memberships |
| POST | `/api/v1/businesses` | Verified user; idempotent initial workspace |
| GET | `/api/v1/businesses/:id` | Read |
| PATCH | `/api/v1/businesses/:id` | OWNER / ADMIN |
| GET | `/api/v1/businesses/:id/locations/:locationId` | Read |
| PATCH | `/api/v1/businesses/:id/locations/:locationId` | OWNER / ADMIN / MANAGER |
| GET | `/api/v1/businesses/:id/onboarding` | Read |
| GET | `/api/v1/businesses/:id/onboarding/readiness` | Read |
| POST | `/api/v1/businesses/:id/onboarding/complete` | OWNER / ADMIN; live activation not released |
| GET | `/api/v1/businesses/:id/members` | OWNER / ADMIN |
| POST | `/api/v1/businesses/:id/members` | OWNER / ADMIN; owner/admin protections |

Business creation accepts `{name,locationName,businessType:"RESTAURANT"}`. The initial restaurant-name screen supplies `Main branch` automatically and copies the verified owner's phone to the business profile. Owner membership, organization, business, location, hours, onboarding steps and audit entry are created in one transaction.

Profile writes require the latest integer `revision`, business fields and a location payload with seven weekday entries. Server-side validation rejects protected/unknown fields and cross-business location references. A stale revision returns 409. Onboarding completion is derived from persisted business data, never a client-provided completion flag.

The team API accepts `{phoneNumber,role}` and adds or updates an existing phone-verified user. No invitation message is sent. Public signup does not collect a real email.
