# Instagram Copilot

Bezpieczny starter własnego bota do wiadomości prywatnych i komentarzy na Instagramie. Korzysta wyłącznie z oficjalnego OAuth i Graph API Meta — **nie przyjmuje ani nie zapisuje hasła do Instagrama**.

## Co już obsługuje

- Połączenie konta Instagram Business/Creator przez OAuth Meta.
- Webhooki wiadomości i komentarzy, z ochroną przed podwójnym przetworzeniem zdarzeń.
- Szyfrowane lokalnie tokeny dostępu (AES-256-GCM) w pliku JSON z uprawnieniami tylko dla właściciela procesu. W produkcji należy zastąpić go zarządzaną bazą danych.
- Generowanie krótkiej odpowiedzi AI według określonego tonu.
- Reguły eskalacji (reklamacje, płatności, dane osobowe itp.) i kontrolę długości/ryzykownych obietnic.
- Kolejkę odpowiedzi do zatwierdzenia oraz endpoint wysyłający DM albo odpowiedź w wątku komentarza.

Domyślnie odpowiedzi o średniej/niskiej pewności trafiają do ręcznej akceptacji. Automatyczna wysyłka jest celowo wyłączona. Po walidacji można ustawić `AUTO_SEND_CONFIDENT_DRAFTS=true`; system wyśle wtedy wyłącznie odpowiedzi o wysokiej pewności, które przeszły reguły bezpieczeństwa.

## Uruchomienie

1. Zainstaluj zależności: `npm install`.
2. Skopiuj `.env.example` do `.env` i uzupełnij wartości.
3. Skopiuj `brand.md.example` do `brand.md` i uzupełnij głos marki oraz FAQ.
4. Uruchom: `npm run dev`.
5. Wystaw lokalny serwer pod publicznym HTTPS (np. Cloudflare Tunnel) i ustaw ten adres jako `APP_BASE_URL`.
6. Otwórz `http://localhost:3000/auth/instagram/start` i zaakceptuj dostęp na koncie Meta.

## Konfiguracja w Meta

1. Utwórz aplikację w [Meta for Developers](https://developers.facebook.com/).
2. Dodaj produkt Instagram oraz odpowiedni przypadek użycia logowania/API dla kont profesjonalnych.
3. Dodaj redirect URI: `https://twoja-domena/auth/instagram/callback`.
4. Dodaj webhook callback URL: `https://twoja-domena/webhooks/instagram` i ten sam `META_VERIFY_TOKEN`.
5. Subskrybuj zdarzenia wiadomości i komentarzy dla połączonego konta. Webhook weryfikuje podpis `X-Hub-Signature-256` z użyciem sekretu aplikacji Meta.
6. Przed produkcją przejdź wymagany przez Meta App Review dla używanych uprawnień.

Nazwy konkretnych uprawnień i dostępnych pól mogą różnić się według wybranej wersji produktu Meta. Przed wysłaniem aplikacji do App Review potwierdź je w aktualnej dokumentacji Meta dla Instagram API.

## Moderacja

`GET /api/reviews` zwraca 100 najnowszych propozycji. Wszystkie endpointy panelu wymagają nagłówka `X-Admin-Api-Key` z wartością `ADMIN_API_KEY`. Aby wysłać odpowiedź po akceptacji:

```bash
curl -X POST http://localhost:3000/api/reviews/ID/send \
  -H 'Content-Type: application/json' \
  -H 'X-Admin-Api-Key: twoj-klucz-administratora' \
  -d '{"text":"Opcjonalnie zmieniona odpowiedź"}'
```

Odrzucenie: `POST /api/reviews/ID/reject`.

W środowisku produkcyjnym endpointy panelu należy zabezpieczyć logowaniem administratora (np. przez dostawcę SSO) oraz prowadzić rejestr akcji moderacyjnych.

## Panel administracyjny

W katalogu `panel/` jest panel www (React + shadcn) do konfiguracji bota:

- **Ustawienia** — model AI, automatyczna wysyłka, dozwolone konta Instagram, wytyczne tonu.
- **Profil komunikacji** — wklejasz przykładowe wiadomości klientów i odpowiedzi marki, a AI buduje z nich `brand.md`; wygenerowaną propozycję zatwierdzasz ręcznie.

Uruchomienie: `npm run panel:build`, potem panel jest dostępny pod `http://localhost:3000/panel/` (serwuje go główny serwer). Do pracy nad panelem: `npm run panel:dev` (port 5173, proxy do API na 3000). Logowanie kluczem `ADMIN_API_KEY`.

## Ton i wiedza marki

Ogólne reguły bezpieczeństwa są w `src/ai.ts`. Przed uruchomieniem produkcyjnym uzupełnij lokalny plik `brand.md` na bazie `brand.md.example` o:

- listę FAQ wraz z zatwierdzonymi odpowiedziami,
- ofertę, ograniczenia i źródło aktualnej dostępności/cen,
- przykłady odpowiedzi „tak” i „nie”,
- przypadki, które zawsze przejmuje człowiek.

Nie umieszczaj w promptach ani bazie wiedzy haseł, tokenów czy danych osobowych klientów.
