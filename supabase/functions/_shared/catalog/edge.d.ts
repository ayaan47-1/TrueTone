/** Only the Deno APIs used by these entry points, also checked by the local tsc gate. */
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
