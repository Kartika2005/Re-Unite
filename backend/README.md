# backend

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.8. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `WHATSAPP_API_URL` | Whapi Cloud endpoint | `https://gate.whapi.cloud/messages/text` |
| `WHATSAPP_AUTH_TOKEN` | Whapi Cloud Bearer token | — |
| `WHATSAPP_RECIPIENT` | Channel/group ID to send notifications to | — |

