import { useEffect, useState } from "react";
import { KeyRoundIcon } from "lucide-react";
import { Toaster, toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InstagramAccounts from "@/components/panel/InstagramAccounts";
import ProfileBuilder from "@/components/panel/ProfileBuilder";
import SettingsForm from "@/components/panel/SettingsForm";
import { api, getAdminKey, setAdminKey } from "@/lib/api";

const App = () => {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [keyInput, setKeyInput] = useState("");

  useEffect(() => {
    if (!getAdminKey()) return setAuthorized(false);
    api("/api/settings")
      .then(() => setAuthorized(true))
      .catch(() => setAuthorized(false));
  }, []);

  const submitKey = async (event: React.FormEvent) => {
    event.preventDefault();
    setAdminKey(keyInput.trim());
    try {
      await api("/api/settings");
      setAuthorized(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nieprawidłowy klucz.");
    }
  };

  if (authorized === null) {
    return <div className="text-muted-foreground grid min-h-dvh place-items-center text-sm">Łączenie z serwerem…</div>;
  }

  if (!authorized) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <Toaster position="top-center" richColors />
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Instagram Copilot — panel</CardTitle>
            <CardDescription>Podaj klucz administratora (ADMIN_API_KEY z pliku .env serwera).</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitKey} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="admin-key">Klucz administratora</Label>
                <Input
                  id="admin-key"
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  autoFocus
                />
              </div>
              <Button type="submit">
                <KeyRoundIcon className="size-4" />
                Zaloguj
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <Toaster position="top-center" richColors />
      <header className="bg-card sticky top-0 z-50 border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/panel/">Instagram Copilot</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Panel</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-1.5">
            <Separator orientation="vertical" className="hidden !h-4 sm:block" />
            <Avatar className="size-9 rounded-md">
              <AvatarFallback className="rounded-md text-xs">IC</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <Tabs defaultValue="settings">
          <TabsList className="mb-8">
            <TabsTrigger value="settings">Ustawienia</TabsTrigger>
            <TabsTrigger value="account">Konto Instagram</TabsTrigger>
            <TabsTrigger value="profile">Profil komunikacji</TabsTrigger>
          </TabsList>
          <TabsContent value="settings">
            <SettingsForm />
          </TabsContent>
          <TabsContent value="account">
            <InstagramAccounts />
          </TabsContent>
          <TabsContent value="profile">
            <ProfileBuilder />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default App;
