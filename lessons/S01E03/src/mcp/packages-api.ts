const PACKAGES_URL = "https://hub.ag3nts.org/api/packages";

function hubApiKey(): string {
  const key = process.env.HUB_API_KEY?.trim();
  if (!key) {
    throw new Error("HUB_API_KEY is not set");
  }
  return key;
}

async function postPackages(body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(PACKAGES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: hubApiKey(),
      ...body,
    }),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    throw new Error(`Packages API ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

export async function checkPackage(packageid: string): Promise<unknown> {
  return postPackages({
    action: "check",
    packageid,
  });
}

export async function redirectPackage(input: {
  packageid: string;
  destination: string;
  code: string;
}): Promise<unknown> {
  return postPackages({
    action: "redirect",
    packageid: input.packageid,
    destination: input.destination,
    code: input.code,
  });
}
