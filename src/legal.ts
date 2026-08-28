const page = (title: string, body: string) => `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:3rem auto;padding:0 1rem;line-height:1.6;color:#1a1a1a}h1{font-size:1.6rem}h2{font-size:1.15rem;margin-top:2rem}</style>
</head><body><h1>${title}</h1>${body}<p style="margin-top:3rem;color:#666">Ostatnia aktualizacja: 28 sierpnia 2026.</p></body></html>`;

export const privacyPolicyHtml = page(
  "Polityka prywatności — Instagram Copilot",
  `
<p>Ta aplikacja („Aplikacja") to wewnętrzne narzędzie właściciela profilu Instagram, służące do
obsługi wiadomości prywatnych i komentarzy na jego własnym profilu firmowym.</p>

<h2>Jakie dane przetwarzamy</h2>
<p>Identyfikator i nazwę połączonego konta Instagram, token dostępu wydany przez Meta
(przechowywany wyłącznie w postaci zaszyfrowanej), treść wiadomości i komentarzy kierowanych do
połączonego profilu oraz treści opublikowane przez ten profil (posty, komentarze, wiadomości)
używane do budowy profilu komunikacji marki.</p>

<h2>Cel przetwarzania</h2>
<p>Przygotowywanie propozycji odpowiedzi na wiadomości i komentarze, moderacja tych propozycji
przez człowieka oraz utrzymanie spójnego stylu komunikacji profilu. Dane nie są wykorzystywane
do reklamy ani profilowania osób trzecich i nie są sprzedawane.</p>

<h2>Odbiorcy danych</h2>
<p>Dane pochodzą z API Meta (Instagram) i są przetwarzane na serwerze Aplikacji w Unii Europejskiej.
Treść pojedynczej wiadomości lub komentarza może zostać przekazana dostawcy modelu językowego
(MiniMax) wyłącznie w celu przygotowania propozycji odpowiedzi.</p>

<h2>Okres przechowywania i usunięcie danych</h2>
<p>Dane są przechowywane tak długo, jak konto pozostaje połączone z Aplikacją. Odłączenie
Aplikacji w ustawieniach konta Instagram (Ustawienia → Bezpieczeństwo → Aplikacje i witryny)
odbiera jej dostęp do konta. Aby zażądać usunięcia zgromadzonych danych, skontaktuj się
z administratorem poprzez wiadomość prywatną na połączonym profilu Instagram — dane zostaną
usunięte niezwłocznie, najpóźniej w ciągu 30 dni.</p>
`
);

export const termsOfServiceHtml = page(
  "Regulamin — Instagram Copilot",
  `
<p>Aplikacja jest prywatnym narzędziem właściciela połączonego profilu Instagram. Nie świadczy
usług osobom trzecim, nie prowadzi rejestracji użytkowników i nie pobiera opłat.</p>

<h2>Zasady korzystania</h2>
<p>Z panelu Aplikacji korzysta wyłącznie administrator profilu. Aplikacja przygotowuje propozycje
odpowiedzi; za treść wysłanych odpowiedzi odpowiada właściciel profilu. Aplikacja działa zgodnie
z regulaminami platformy Meta, w tym zasadami Instagram API.</p>

<h2>Odpowiedzialność</h2>
<p>Aplikacja jest dostarczana „tak jak jest", bez gwarancji nieprzerwanego działania. Administrator
może w każdej chwili wyłączyć Aplikację lub odłączyć konto.</p>

<h2>Kontakt</h2>
<p>Wiadomość prywatna na połączonym profilu Instagram.</p>
`
);
