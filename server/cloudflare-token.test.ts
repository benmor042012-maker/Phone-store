import { describe, expect, it } from "vitest";

describe("Cloudflare deployment token", () => {
  it("verifies the restricted token without changing any Cloudflare resource", async () => {
    const token = process.env.CLOUDFLARE_API_TOKEN;
    expect(token, "CLOUDFLARE_API_TOKEN must be configured").toBeTruthy();

    const response = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await response.json()) as { success?: boolean; result?: { status?: string } };

    expect(response.ok).toBe(true);
    expect(body.success).toBe(true);
    expect(body.result?.status).toBe("active");
  }, 15_000);
});
