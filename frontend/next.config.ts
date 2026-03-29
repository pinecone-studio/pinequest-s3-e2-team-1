import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	async redirects() {
		return [
			{
				source: "/ai-scheduler-personal",
				destination: "/ai-scheduler",
				permanent: false,
			},
			{
				source: "/ai-scheduler-school-event",
				destination: "/ai-scheduler?view=school",
				permanent: false,
			},
		];
	},
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
