import { useEffect, useState } from "react";
import { DownloadIcon, LinkIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type ImportResult, type InstagramAccount } from "@/lib/api";

const InstagramAccounts = () => {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [importing, setImporting] = useState(false);

  const refresh = () =>
    api<InstagramAccount[]>("/api/accounts").then(setAccounts).catch((error: Error) => toast.error(error.message));

  useEffect(() => {
    void refresh();
  }, []);

  const runImport = async () => {
    setImporting(true);
    try {
      const results = await api<ImportResult[]>("/api/profile/import", { method: "POST" });
      for (const result of results) {
        toast.success(
          `@${result.account}: ${result.posts} postów, ${result.messages} wiadomości, ${result.comments} komentarzy dodanych do bazy.`
        );
        for (const error of result.errors) toast.warning(`@${result.account}: ${error}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import nie powiódł się.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
      <div className="space-y-1">
        <h2 className="font-semibold">Konto Instagram</h2>
        <p className="text-muted-foreground text-sm">
          Połącz konto firmowe lub twórcy przez logowanie Meta. Po połączeniu bot automatycznie pobierze posty,
          wiadomości i komentarze profilu, żeby odpowiedzi brzmiały spójnie z Waszym stylem.
        </p>
      </div>

      <div className="flex flex-col gap-6 md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Połączone konta</CardTitle>
            <CardDescription>
              {accounts.length
                ? "Konta, w imieniu których bot odpowiada."
                : "Żadne konto nie jest jeszcze połączone."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {accounts.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Konto</TableHead>
                    <TableHead>Identyfikator</TableHead>
                    <TableHead>Połączono</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.instagram_id}>
                      <TableCell className="font-medium">
                        {account.username ? `@${account.username}` : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{account.instagram_id}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{new Date(account.created_at).toLocaleDateString("pl-PL")}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <a href="/auth/instagram/start" target="_blank" rel="noreferrer">
                  <LinkIcon className="size-4" />
                  {accounts.length ? "Połącz kolejne konto" : "Połącz konto Instagram"}
                </a>
              </Button>
              <Button type="button" variant="outline" onClick={() => void refresh()}>
                <RefreshCwIcon className="size-4" />
                Odśwież listę
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={runImport}
                disabled={importing || !accounts.length}
              >
                <DownloadIcon className="size-4" />
                {importing ? "Pobieranie treści…" : "Pobierz treści profilu ponownie"}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Pobrane treści trafiają do zakładki „Profil komunikacji" jako przykłady stylu marki — duplikaty są
              pomijane, więc ponowny import jest bezpieczny.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InstagramAccounts;
