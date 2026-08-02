import { sqlite } from '@flue/runtime/node';

// The desktop host (Electrobun main process) injects FLUE_DB_PATH pointing at
// the writable userData directory before importing the built app. The dev
// sidecar falls back to ./data/flue.db under the agent package.
export default sqlite(process.env.FLUE_DB_PATH ?? './data/flue.db');