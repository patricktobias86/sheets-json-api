import { PostHog } from "posthog-node";

const apiKey = process.env.POSTHOG_API_KEY;
const host = process.env.POSTHOG_HOST;

let posthog = null;

if (apiKey && host) {
  posthog = new PostHog(apiKey, {
    host,
    flushAt: 1,
    flushInterval: 0,
    enableExceptionAutocapture: true,
  });
} else if (process.env.NODE_ENV !== "production") {
  const missing = [!apiKey && "POSTHOG_API_KEY", !host && "POSTHOG_HOST"]
    .filter(Boolean)
    .join(", ");
  console.warn(
    `${missing} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missing} is configured`
  );
}

export default posthog;
