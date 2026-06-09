import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CloudDataProvider } from "@/lib/cloud-store";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthGate,
});

function AuthGate() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!mounted) return;
      if (!session) {
        setAuthed(false);
        navigate({ to: "/auth" });
      } else {
        setAuthed(true);
      }
    });
    supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return;
      if (error || !data.user) {
        navigate({ to: "/auth" });
      } else {
        setAuthed(true);
      }
      setReady(true);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [navigate]);

  if (!ready || !authed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  return (
    <CloudDataProvider>
      <Outlet />
    </CloudDataProvider>
  );
}
