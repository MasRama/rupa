import type { Child } from 'hono/jsx';

/** Bare page shell for core's own messages (errors, sign-in failures). */
export function MessagePage({ title, children }: { title: string; children?: Child }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="stylesheet" href="/assets/rupa.css" />
      </head>
      <body>
        <main class="message">
          <h1>{title}</h1>
          {children}
          <p>
            <a href="/">Back to the dashboard</a>
          </p>
        </main>
      </body>
    </html>
  );
}
