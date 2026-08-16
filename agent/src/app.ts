import { createAgentRouter } from '@flue/runtime/routing';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Studio } from './agents/studio.ts';
import { initProviders } from './providers.ts';

// Register LLM providers (env bridge for built-ins, custom providers for
// Alibaba and user endpoints) and start the credential refresh timer.
await initProviders();

const app = new Hono();

app.get('/health', (c) => c.json({ ok: true }));
app.get('/agents/health', (c) => c.json({ ok: true }));

// The studio frontend reaches agents same-origin via the dev proxy, but the
// packaged webview calls cross-origin from views:// — mirror the main API's
// local-only policy and expose the durable-stream coordination headers.
app.use(
	'/agents/*',
	cors({
		origin: (origin) => {
			if (!origin || origin === 'null' || origin.startsWith('views://')) {
				return origin ?? '*';
			}
			if (origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173') {
				return origin;
			}
			return '';
		},
		credentials: true,
		exposeHeaders: ['Stream-Next-Offset', 'Stream-Up-To-Date', 'Location'],
	}),
);

app.route('/agents/studio', createAgentRouter(Studio));

export default app;