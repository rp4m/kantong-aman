import { useState } from "react";
import { UserPlus, Trash2, Mail, Crown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCollaborators, useBudgetPeriods, useCurrentUser, useProfiles,
  inviteCollaborator, removeCollaborator, updateCollaboratorRole, getProfileById,
} from "@/lib/cloud-store";
import { toast } from "sonner";

export function CollaboratorsSection({ budgetPeriodId }: { budgetPeriodId: string }) {
  const all = useCollaborators();
  const periods = useBudgetPeriods();
  useProfiles(); // subscribe for re-render
  const { userId } = useCurrentUser();
  const period = periods.find((p) => p.id === budgetPeriodId) as any;
  const isOwner = period?.ownerUserId === userId;
  const ownerProfile = getProfileById(period?.ownerUserId);
  const list = all.filter((c) => c.budgetPeriodId === budgetPeriodId);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"collaborator" | "viewer">("collaborator");
  const [loading, setLoading] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await inviteCollaborator(budgetPeriodId, email, role);
      toast.success("Undangan terkirim");
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengundang");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-primary" /> Kolaborator
      </h2>

      {isOwner && (
        <form onSubmit={handleInvite} className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Input type="email" placeholder="Email anggota" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Select value={role} onValueChange={(v) => setRole(v as any)}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="collaborator">Collaborator</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={loading}>Undang</Button>
        </form>
      )}

      <ul className="divide-y divide-border">
        {/* Owner row */}
        <li className="flex items-center gap-3 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/20 text-warning-foreground">
            <Crown className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {ownerProfile?.fullName || ownerProfile?.email || "Pemilik"}
              {period?.ownerUserId === userId && <span className="ml-1 text-xs text-muted-foreground">(Anda)</span>}
            </p>
            {ownerProfile?.email && <p className="truncate text-[11px] text-muted-foreground">{ownerProfile.email}</p>}
          </div>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Owner</span>
        </li>

        {list.length === 0 ? (
          <li className="py-3 text-center text-xs text-muted-foreground">Belum ada kolaborator lain.</li>
        ) : (
          list.map((c) => {
            const prof = getProfileById(c.userId);
            const displayName = prof?.fullName || prof?.email || c.invitedEmail;
            return (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {prof ? <User className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{displayName}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {c.invitedEmail} · {c.status === "pending" ? "menunggu pendaftaran" : "aktif"}
                  </p>
                </div>
                {isOwner ? (
                  <>
                    <Select value={c.role} onValueChange={(v) => updateCollaboratorRole(c.id, v as any).catch((e) => toast.error(e.message))}>
                      <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="collaborator">Collaborator</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" onClick={() => removeCollaborator(c.id).then(() => toast.success("Dihapus"))}>
                      <Trash2 className="h-4 w-4 text-expense" />
                    </Button>
                  </>
                ) : (
                  <span className="text-xs capitalize text-muted-foreground">{c.role}</span>
                )}
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
