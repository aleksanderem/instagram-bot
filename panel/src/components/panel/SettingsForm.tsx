import { useEffect, useState } from "react";
import { BotIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, type SettingsResponse } from "@/lib/api";

const SettingsForm = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [model, setModel] = useState("");
  const [accountIds, setAccountIds] = useState("");
  const [toneNotes, setToneNotes] = useState("");
  const [respondToDms, setRespondToDms] = useState(true);
  const [respondToComments, setRespondToComments] = useState(true);

  useEffect(() => {
    api<SettingsResponse>("/api/settings")
      .then(({ effective }) => {
        setAutoSend(effective.autoSendConfidentDrafts);
        setModel(effective.aiModel);
        setAccountIds(effective.allowedInstagramAccountIds.join(", "));
        setToneNotes(effective.toneNotes);
        setRespondToDms(effective.respondToDms);
        setRespondToComments(effective.respondToComments);
      })
      .catch((error: Error) => toast.error(error.message))
      .finally(() => setLoading(false));
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api<SettingsResponse>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          autoSendConfidentDrafts: autoSend,
          aiModel: model.trim(),
          allowedInstagramAccountIds: accountIds.split(",").map((id) => id.trim()).filter(Boolean),
          toneNotes,
          respondToDms,
          respondToComments
        })
      });
      toast.success("Ustawienia zapisane.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Zapis nie powiódł się.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground text-sm">Wczytywanie ustawień…</p>;

  return (
    <form onSubmit={save}>
      {/* Bot behaviour */}
      <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
        <div className="space-y-1">
          <h2 className="font-semibold">Zachowanie bota</h2>
          <p className="text-muted-foreground text-sm">
            Jak bot ma odpowiadać i które konta Instagram może obsługiwać.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:col-span-2">
          <div className="flex flex-col items-start gap-2">
            <Label htmlFor="model">Model AI (MiniMax)</Label>
            <div className="relative w-full">
              <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} className="peer pr-9" />
              <div className="text-muted-foreground pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center pr-3 peer-disabled:opacity-50">
                <BotIcon className="size-4" />
                <span className="sr-only">Model AI</span>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">Nazwa modelu MiniMax używanego do szkiców odpowiedzi (np. MiniMax-M3)</p>
          </div>

          <div className="flex flex-col items-start gap-2">
            <Label htmlFor="respond-dms">Odpowiadaj na wiadomości (DM)</Label>
            <div className="flex h-9 items-center gap-3">
              <Switch id="respond-dms" checked={respondToDms} onCheckedChange={setRespondToDms} />
              <span className="text-sm">{respondToDms ? "Tak" : "Nie"}</span>
            </div>
            <p className="text-muted-foreground text-xs">Bot przygotowuje odpowiedzi na wiadomości prywatne</p>
          </div>

          <div className="flex flex-col items-start gap-2">
            <Label htmlFor="respond-comments">Odpowiadaj na komentarze</Label>
            <div className="flex h-9 items-center gap-3">
              <Switch id="respond-comments" checked={respondToComments} onCheckedChange={setRespondToComments} />
              <span className="text-sm">{respondToComments ? "Tak" : "Nie"}</span>
            </div>
            <p className="text-muted-foreground text-xs">Bot przygotowuje odpowiedzi w wątkach komentarzy</p>
          </div>

          <div className="flex flex-col items-start gap-2">
            <Label htmlFor="auto-send">Automatyczna wysyłka</Label>
            <div className="flex h-9 items-center gap-3">
              <Switch id="auto-send" checked={autoSend} onCheckedChange={setAutoSend} />
              <span className="text-sm">{autoSend ? "Włączona" : "Wyłączona"}</span>
            </div>
            <p className="text-muted-foreground text-xs">
              Wysyła bez akceptacji wyłącznie pewne odpowiedzi, które przeszły reguły bezpieczeństwa
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:col-span-2">
            <Label htmlFor="accounts">Dozwolone konta Instagram</Label>
            <Input
              id="accounts"
              value={accountIds}
              onChange={(e) => setAccountIds(e.target.value)}
              placeholder="np. 17841400000000000, 17841400000000001"
            />
            <p className="text-muted-foreground text-xs">
              Identyfikatory kont oddzielone przecinkami. Puste pole = każde połączone konto
            </p>
          </div>
        </div>
      </div>

      <Separator className="my-10" />

      {/* Tone of voice */}
      <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
        <div className="space-y-1">
          <h2 className="font-semibold">Ton komunikacji</h2>
          <p className="text-muted-foreground text-sm">
            Wskazówki dla AI przy pisaniu odpowiedzi i budowaniu profilu komunikacji.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:col-span-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="tone-notes">Wytyczne tonu</Label>
            <Textarea
              id="tone-notes"
              rows={5}
              value={toneNotes}
              onChange={(e) => setToneNotes(e.target.value)}
              placeholder="np. ciepło i konkretnie, bez wykrzykników, zwracamy się na Ty…"
            />
            <p className="text-muted-foreground text-xs">
              Te wskazówki trafiają do generatora profilu komunikacji
            </p>
          </div>
        </div>
      </div>

      <Separator className="my-10" />

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={saving} className="w-full sm:w-auto">
          {saving ? "Zapisywanie…" : "Zapisz ustawienia"}
        </Button>
      </div>
    </form>
  );
};

export default SettingsForm;
