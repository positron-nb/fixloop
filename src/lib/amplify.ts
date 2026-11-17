import { Amplify } from 'aws-amplify';

/**
 * amplify_outputs.json is produced by `npx ampx sandbox` (local) or by the Amplify Hosting
 * build (production). It is not committed. If it is missing, the app shows a setup screen
 * instead of pretending to work.
 */
const found = import.meta.glob('../../amplify_outputs.json', { eager: true, import: 'default' });
export const outputs = Object.values(found)[0] as Record<string, unknown> | undefined;
export const isConfigured = !!outputs;

if (outputs) Amplify.configure(outputs);
