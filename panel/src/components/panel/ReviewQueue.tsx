import { useEffect, useState } from "react";
import { CheckIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

interface Review {
  id: number;
  status: string;
  draft_text: string;
  reason: string | null;
  channel: "dm" | "comment";
  sender_id: string;
  inbound_text?: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "do akceptacji",
  approved: "zaakceptowana",
  sent: "wysłana",
  rejected: "odrzucona"
};

const ReviewQueue = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const refresh = () =>
    api<Review[]>("/api/reviews").then(setReviews).catch((error: Error) => toast.error(error.message));

  useEffect(() => {
    void refresh();
  }, []);

  const send = async (review: Review) => {
    setBusy(review.id);
    try {
      await api(`/api/reviews/${review.id}/send`, {
        method: "POST",
        body: JSON.stringify({ text: edits[review.id] ?? review.draft_text })
      });
      toast.success("Odpowiedź wysłana.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Wysyłka nie powiodła się.");
    } finally {
      setBusy(null);
    }
  };

  const reject = async (review: Review) => {
    setBusy(review.id);
    try {
      await api(`/api/reviews/${review.id}/reject`, { method: "POST" });
      toast.success("Propozycja odrzucona.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Odrzucenie nie powiodło się.");
    } finally {
      setBusy(null);
    }
  };

  const pending = reviews.filter((review) => review.status === "pending" || review.status === "approved");
  const done = reviews.filter((review) => review.status === "sent" || review.status === "rejected");

  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
      <div className="space-y-1">
        <h2 className="font-semibold">Skrzynka</h2>
        <p className="text-muted-foreground text-sm">
          Wiadomości i komentarze z Instagrama wraz z propozycjami odpowiedzi. Nic nie wychodzi bez Twojej
          akceptacji — możesz poprawić treść przed wysłaniem.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void refresh()}>
          <RefreshCwIcon className="size-4" />
          Odśwież
        </Button>
      </div>

      <div className="flex flex-col gap-6 md:col-span-2">
        {pending.length === 0 && (
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              Brak wiadomości czekających na akceptację.
            </CardContent>
          </Card>
        )}

        {pending.map((review) => (
          <Card key={review.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{review.channel === "dm" ? "wiadomość" : "komentarz"}</Badge>
                <Badge variant="outline">{STATUS_LABELS[review.status] ?? review.status}</Badge>
              </div>
              <CardTitle className="text-base font-medium">{review.inbound_text ?? "—"}</CardTitle>
              {review.reason && <CardDescription>Powód: {review.reason}</CardDescription>}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Textarea
                rows={3}
                value={edits[review.id] ?? review.draft_text}
                onChange={(e) => setEdits((current) => ({ ...current, [review.id]: e.target.value }))}
                aria-label={`Odpowiedź na wiadomość ${review.id}`}
              />
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" disabled={busy === review.id} onClick={() => reject(review)}>
                  <XIcon className="size-4" />
                  Odrzuć
                </Button>
                <Button type="button" disabled={busy === review.id} onClick={() => send(review)}>
                  <CheckIcon className="size-4" />
                  {busy === review.id ? "Wysyłanie…" : "Zatwierdź i wyślij"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {done.length > 0 && (
          <p className="text-muted-foreground text-xs">
            Załatwione: {done.length} ({done.filter((review) => review.status === "sent").length} wysłanych,{" "}
            {done.filter((review) => review.status === "rejected").length} odrzuconych)
          </p>
        )}
      </div>
    </div>
  );
};

export default ReviewQueue;
