export default {
  async fetch() {
    return new Response("Intily scheduler online", { status: 200 });
  },

  async scheduled(_controller, env) {
    const url = "https://api.github.com/repos/knyavik-stack/synapsemax/actions/workflows/intily-ai-news.yml/dispatches";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
        "X-GitHub-Api-Version": "2026-03-10",
        "User-Agent": "intily-cloudflare-scheduler"
      },
      body: JSON.stringify({ ref: "main" })
    });

    console.log("GITHUB_DISPATCH", response.status);
    if (!response.ok) {
      console.error("GITHUB_DISPATCH_ERROR", response.status, await response.text());
    }
  }
};
