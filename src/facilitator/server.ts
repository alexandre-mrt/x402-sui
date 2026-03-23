import { x402Facilitator } from "@x402/core/facilitator";
import type { Network, PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { registerExactSuiFacilitatorScheme } from "../exact/facilitator/index.js";
import type { FacilitatorSuiSigner } from "../signer.js";

export interface FacilitatorServerConfig {
  port: number;
  signer: FacilitatorSuiSigner;
  networks: Network[];
}

export function createFacilitatorServer(config: FacilitatorServerConfig) {
  const facilitator = new x402Facilitator();

  registerExactSuiFacilitatorScheme(facilitator, {
    signer: config.signer,
    networks: config.networks,
  });

  const server = Bun.serve({
    port: config.port,

    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);

      // CORS headers for all responses
      const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      };

      // Handle preflight
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers });
      }

      try {
        if (url.pathname === "/supported" && req.method === "GET") {
          return handleSupported(facilitator, headers);
        }

        if (url.pathname === "/verify" && req.method === "POST") {
          return await handleVerify(facilitator, req, headers);
        }

        if (url.pathname === "/settle" && req.method === "POST") {
          return await handleSettle(facilitator, req, headers);
        }

        return Response.json({ error: "Not found" }, { status: 404, headers });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return Response.json({ error: message }, { status: 500, headers });
      }
    },
  });

  return server;
}

function handleSupported(facilitator: x402Facilitator, headers: Record<string, string>): Response {
  const supported = facilitator.getSupported();
  return Response.json(supported, { headers });
}

async function handleVerify(
  facilitator: x402Facilitator,
  req: Request,
  headers: Record<string, string>,
): Promise<Response> {
  const body = (await req.json()) as {
    paymentPayload?: PaymentPayload;
    paymentRequirements?: PaymentRequirements;
  };

  if (!body.paymentPayload || !body.paymentRequirements) {
    return Response.json(
      { error: "Missing paymentPayload or paymentRequirements" },
      { status: 400, headers },
    );
  }

  const result = await facilitator.verify(body.paymentPayload, body.paymentRequirements);
  const status = result.isValid ? 200 : 400;
  return Response.json(result, { status, headers });
}

async function handleSettle(
  facilitator: x402Facilitator,
  req: Request,
  headers: Record<string, string>,
): Promise<Response> {
  const body = (await req.json()) as {
    paymentPayload?: PaymentPayload;
    paymentRequirements?: PaymentRequirements;
  };

  if (!body.paymentPayload || !body.paymentRequirements) {
    return Response.json(
      { error: "Missing paymentPayload or paymentRequirements" },
      { status: 400, headers },
    );
  }

  const result = await facilitator.settle(body.paymentPayload, body.paymentRequirements);
  const status = result.success ? 200 : 400;
  return Response.json(result, { status, headers });
}
