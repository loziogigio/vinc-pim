# B2B Email Service

Email service for B2B operations including registration, welcome, and password management emails.

## API Endpoints (S2S)

All endpoints are public for server-to-server communication.

---

### 1. Registration Request Email

Sends notification to **both admin AND the customer** who requested registration.

```
POST /api/b2b/emails/registration-request
```

**Request Body:**
```json
{
  "ragioneSociale": "Company Name Srl",
  "email": "customer@example.com",
  "comune": "Milano",
  "indirizzo": "Via Roma 123",
  "telefono": "+39 02 1234567",
  "partitaIva": "IT12345678901",
  "sdi": "XXXXXXX",
  "pec": "pec@company.it",
  "adminEmail": "admin@example.com",
  "adminUrl": "https://admin.example.com/customers"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| ragioneSociale | Yes | Company name |
| email | Yes | Customer email |
| comune | No | City |
| indirizzo | No | Address |
| telefono | No | Phone number |
| partitaIva | No | VAT number |
| sdi | No | SDI code |
| pec | No | PEC email |
| adminEmail | No | Admin email (falls back to SMTP `default_to` setting) |
| adminUrl | No | Custom admin panel URL (defaults to shopUrl/b2b/customers) |

---

### 2. Welcome Email

Sends welcome email with login credentials to newly approved B2B customer.

```
POST /api/b2b/emails/welcome
```

**Request Body:**
```json
{
  "toEmail": "customer@example.com",
  "ragioneSociale": "Company Name Srl",
  "username": "customer@example.com",
  "password": "TempPass123!",
  "contactName": "Mario Rossi",
  "loginUrl": "https://shop.example.com/login"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| toEmail | Yes | Recipient email |
| ragioneSociale | Yes | Company name |
| username | Yes | Login username |
| password | Yes | Login password |
| contactName | No | Contact person name |
| loginUrl | No | Custom login URL (defaults to shopUrl/login) |

---

### 3. Forgot Password Email

Sends temporary password to user who requested password reset.

```
POST /api/b2b/emails/forgot-password
```

**Request Body:**
```json
{
  "toEmail": "customer@example.com",
  "email": "customer@example.com",
  "ragioneSociale": "Company Name Srl",
  "contactName": "Mario Rossi",
  "tempPassword": "TmpPass789!",
  "loginUrl": "https://shop.example.com/login"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| toEmail | Yes | Recipient email |
| email | Yes | Account email (displayed in email) |
| tempPassword | Yes | New temporary password |
| ragioneSociale | No | Company name |
| contactName | No | Contact person name |
| loginUrl | No | Custom login URL (defaults to shopUrl/login) |

---

### 4. Reset Password Confirmation

Sends confirmation after password has been successfully reset.

```
POST /api/b2b/emails/reset-password
```

**Request Body:**
```json
{
  "toEmail": "customer@example.com",
  "email": "customer@example.com",
  "ragioneSociale": "Company Name Srl",
  "contactName": "Mario Rossi",
  "resetAt": "2025-12-13T17:00:00Z",
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "loginUrl": "https://shop.example.com/login",
  "supportEmail": "support@example.com"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| toEmail | Yes | Recipient email |
| email | Yes | Account email |
| ragioneSociale | No | Company name |
| contactName | No | Contact person name |
| resetAt | No | Reset timestamp (defaults to now) |
| ipAddress | No | IP address for security info |
| userAgent | No | Browser info for security |
| loginUrl | No | Custom login URL (defaults to shopUrl/login) |
| supportEmail | No | Support contact email |

---

## Response Format

All endpoints return:

**Success (200):**
```json
{
  "success": true,
  "messageId": "<uuid@domain.com>",
  "message": "Email sent to recipient@example.com"
}
```

**Error (400/500):**
```json
{
  "error": "Error description",
  "details": "Detailed error message"
}
```

---

## Configuration

URLs in emails are derived from Home Settings > Branding:
- **shopUrl**: Used for login redirects and portal links
- **websiteUrl**: Company website (optional)

If not configured, falls back to `NEXT_PUBLIC_APP_URL` environment variable.

---

## Testing

Use the test endpoint to send all email templates:

```bash
curl -X POST http://localhost:3001/api/b2b/test-emails \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "test@example.com"}'
```

Or test specific template:
```bash
curl -X POST http://localhost:3001/api/b2b/test-emails \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "test@example.com", "template": "welcome"}'
```

Available templates: `registration_request`, `welcome`, `forgot_password`, `reset_password`
