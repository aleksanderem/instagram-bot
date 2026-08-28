import { useEffect, useState } from "react";
import { SparklesIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api, type Sample } from "@/lib/api";

const ProfileBuilder = () => {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [pasted, setPasted] = useState("");
  const [profile, setProfile] = useState("");
  const [generating, setGenerating] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    api<Sample[]>("/api/profile/samples").then(setSamples).catch((error: Error) => toast.error(error.message));
    api<{ content: string }>("/api/brand")
      .then(({ content }) => setProfile(content))
      .catch((error: Error) => toast.error(error.message));
  }, []);

  const addSamples = async () => {
    const texts = pasted.split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean);
    if (!texts.length) return toast.error("Wklej najpierw przynajmniej jedną wiadomość.");
    try {
      setSamples(await api<Sample[]>("/api/profile/samples", { method: "POST", body: JSON.stringify({ texts }) }));
      setPasted("");
      toast.success(`Dodano ${texts.length} ${texts.length === 1 ? "wiadomość" : "wiadomości"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się dodać wiadomości.");
    }
  };

  const removeSample = async (id: number) => {
    try {
      await api(`/api/profile/samples/${id}`, { method: "DELETE" });
      setSamples((current) => current.filter((sample) => sample.id !== id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nie udało się usunąć wiadomości.");
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const { content } = await api<{ content: string }>("/api/profile/generate", { method: "POST" });
      setProfile(content);
      toast.success("Profil wygenerowany — przejrzyj i zapisz.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generowanie nie powiodło się.");
    } finally {
      setGenerating(false);
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await api("/api/brand", { method: "PUT", body: JSON.stringify({ content: profile }) });
      toast.success("Profil komunikacji zapisany — bot korzysta z niego od razu.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Zapis profilu nie powiódł się.");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div>
      {/* Sample messages */}
      <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
        <div className="space-y-1">
          <h2 className="font-semibold">Przykładowe wiadomości</h2>
          <p className="text-muted-foreground text-sm">
            Wklej prawdziwe wiadomości od klientów i wasze odpowiedzi. Kolejne wiadomości oddziel pustą linią.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:col-span-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pasted">Nowe wiadomości</Label>
            <Textarea
              id="pasted"
              rows={6}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={"Dzień dobry, czy zabieg X jest dostępny w sobotę?\n\nKlient: Ile trwa konsultacja?\nMy: Konsultacja trwa około 30 minut…"}
            />
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={addSamples}>
                Dodaj do bazy
              </Button>
            </div>
          </div>

          {samples.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Wiadomość</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {samples.map((sample) => (
                  <TableRow key={sample.id}>
                    <TableCell className="text-muted-foreground">{sample.id}</TableCell>
                    <TableCell className="max-w-130 truncate whitespace-pre-wrap">{sample.text}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Usuń wiadomość ${sample.id}`}
                        onClick={() => removeSample(sample.id)}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <Separator className="my-10" />

      {/* Communication profile */}
      <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
        <div className="space-y-1">
          <h2 className="font-semibold">Profil komunikacji</h2>
          <p className="text-muted-foreground text-sm">
            Księga marki, z której bot korzysta przy każdej odpowiedzi. Wygeneruj ją z wiadomości albo edytuj ręcznie.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:col-span-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="profile">Treść profilu (Markdown)</Label>
              <Button type="button" variant="secondary" size="sm" onClick={generate} disabled={generating || !samples.length}>
                <SparklesIcon className="size-4" />
                {generating ? "Generowanie…" : "Zbuduj profil z wiadomości"}
              </Button>
            </div>
            <Textarea id="profile" rows={16} value={profile} onChange={(e) => setProfile(e.target.value)} />
            <p className="text-muted-foreground text-xs">
              Wygenerowany profil to propozycja — nic nie zapisuje się bez Twojej akceptacji
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" onClick={saveProfile} disabled={savingProfile} className="w-full sm:w-auto">
              {savingProfile ? "Zapisywanie…" : "Zapisz profil"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileBuilder;
