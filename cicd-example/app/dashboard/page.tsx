export default function DashboardPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Welcome back!
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          You are now logged in to the dashboard.
        </p>
        <div className="mt-8 rounded-xl bg-zinc-50 p-6 dark:bg-zinc-800">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Logged in as
          </p>
          <p className="mt-1 font-mono text-sm text-zinc-900 dark:text-zinc-50">
            demo@example.com
          </p>
        </div>
        <a
          href="/login"
          className="mt-6 inline-block text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-50"
        >
          Sign out
        </a>
      </div>
    </div>
  );
}
