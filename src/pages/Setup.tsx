import { Wordmark } from '../components/Logo';

/** Shown only when amplify_outputs.json is missing: the app never fakes a backend. */
export function Setup() {
  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <div className="max-w-lg w-full bg-surface border border-line rounded-2xl p-6 shadow-card">
        <Wordmark />
        <h1 className="mt-5 text-xl font-semibold">Backend not connected</h1>
        <p className="mt-2 text-sm text-ink-2">
          This build has no <code className="px-1 rounded bg-surface-2">amplify_outputs.json</code>, so it cannot reach the FixLoop AWS backend. FixLoop has no offline or mock mode.
        </p>
        <ol className="mt-4 text-sm text-ink-2 list-decimal pl-5 space-y-1">
          <li>
            Configure AWS credentials (see <code>docs/DEPLOYMENT.md</code>).
          </li>
          <li>
            Run <code className="px-1 rounded bg-surface-2">npx ampx sandbox</code> in the project folder.
          </li>
          <li>Reload this page.</li>
        </ol>
      </div>
    </div>
  );
}
