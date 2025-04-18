import { authClient } from "@/lib/auth-client";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/auth/vscode-link")({
  async loader() {
    const { data, error } = await authClient.signIn.deviceLink({
      deviceName: "Pochi VSCode Extension",
    });
    if (error) {
      return { error };
    }

    const vscodeUri = new URL("vscode://com.getpochi.vscode");
    vscodeUri.searchParams.set("token", data.token);

    const uri = new URL(data.approveLink);
    uri.host = window.location.host;
    uri.port = window.location.port;
    uri.searchParams.set("redirectTo", vscodeUri.toString());
    window.location.href = uri.toString();
  },
});
