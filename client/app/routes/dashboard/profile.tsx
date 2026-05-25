import { getRuntimeEnv } from "@/lib/runtime-env";

export default function ProfilePage() {
	window.location.replace(`${getRuntimeEnv("BLOCKS_IDP_BASE_URL")}/profile`);
	return null;
}
