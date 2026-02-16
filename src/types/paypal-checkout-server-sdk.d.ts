declare module "@paypal/checkout-server-sdk" {
  export namespace core {
    class SandboxEnvironment {
      constructor(clientId: string, clientSecret: string);
    }
    class LiveEnvironment {
      constructor(clientId: string, clientSecret: string);
    }
    class PayPalHttpClient {
      constructor(environment: SandboxEnvironment | LiveEnvironment);
      execute<T>(request: unknown): Promise<{ result: T }>;
    }
  }

  export namespace orders {
    class OrdersCreateRequest {
      prefer(value: string): void;
      requestBody(body: unknown): void;
    }
  }
}
