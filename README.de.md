# Nostru

Ein Nostr-Social-Client als Browser-Seitenpanel-Erweiterung (Chrome MV3). Ermoeglicht das Lesen und Schreiben im Nostr-Netzwerk, das Senden von Zaps per Klick via NWC und den Empfang von Bitcoin ueber Silent Payments - alles ohne den Browser zu verlassen.

---

## Was es tut

| Funktion | Beschreibung |
|----------|--------------|
| **Social Feed** | Startseiten-Feed ueber das Nostr-Outbox-Modell (NDK), mit Antworten, Reaktionen, Reposts und Zaps |
| **Profile** | Beliebige Nostr-Profile anzeigen, folgen/entfolgen, Follower-Anzahl einsehen |
| **Suche** | Volltextsuche ueber Notizen, Profile und Artikel mit Autor- und Datumsfiltern |
| **Direktnachrichten** | Verschluesselte Nachrichten NIP-04 und NIP-44 (kind 4 / 1059) |
| **NWC-Wallet** | Lightning-Zaps per Klick via Nostr Wallet Connect; Saldoanzeige |
| **Block-/Stummschaltlisten** | NIP-51-Stummschaltliste (kind 10000), an Relays veroeffentlicht; lokale Blockliste |
| **NIP-07-Bridge** | Fungiert als web3-artiger Nostr-Unterzeichner fuer dApps; seitenbasiertes Berechtigungssystem |
| **NSP-Adressen** | Leitet eine BIP-352-Silent-Payment-Adresse aus einem beliebigen Nostr-oeffentlichen Schluessel ab - ohne Zustimmung des Empfaengers |
| **NSP-Scanning** | Erkennt eingehende Bitcoin Silent Payments ueber einen lokalen nativen Host (keine Schluesseloffenlegung in der Cloud) |
| **NSP-Sweep** | Erstellt und uebertraegt optional eine vollstaendig lokal signierte Sweep-Transaktion |
| **Benachrichtigungen** | Hintergrundabfrage fuer Erwaehungen, Zaps und DMs; Systembenachrichtigungen |

---

## Was es NICHT tut

| Was | Warum |
|-----|-------|
| Private Schluessel dauerhaft speichern | Schluessel leben nur in `chrome.storage.session` (beim Schliessen des Browsers geloescht) |
| Deinen Scan-Schluessel an einen Server senden | Der private Scan-Schluessel wird im Speicher der Erweiterung abgeleitet und nur an den lokalen nativen Prozess via Chrome Native Messaging weitergegeben - niemals ueber das Netzwerk |
| Konto benoetigen, um NSP-Adressen anzuzeigen | Jeder npub reicht aus, um die Silent-Payment-Adresse von jemandem zu berechnen |
| Transaktionen automatisch uebertragen | Die Uebertragung ist immer eine explizite Benutzeraktion mit einer dedizierten Schaltflaeche |
| Telemetrie sammeln | Null Analysen, null Beacons, null Drittanbieter-Skripte |
| Cloud-Scanning verwenden | Das Scanning laeuft lokal via `host.py` und nutzt einen benutzerkonfigurierten Indexserver nur fuer Blockdaten (Tweaks), niemals fuer private Schluessel |
| Transaktionsverlauf offenlegen | Silent-Payment-Ausgaben sind on-chain nicht korrelierbar; keine xpub- oder Adresswiederverwendung |

---

## Jedes Nostr-Konto ist ein Bitcoin-Silent-Payment-Empfaenger

Nostr-Identitaeten sind secp256k1-Schluesselpaar - dieselbe elliptische Kurve, die Bitcoin verwendet. BIP-352 (Silent Payments) baut ebenfalls auf secp256k1 auf. Das bedeutet, dass die Ableitung kein Trick oder Workaround ist: Sie ist eine direkte mathematische Konsequenz der gemeinsamen Kurvenarithmetik.

Die Ableitung von einem beliebigen oeffentlichen Nostr-Schluessel (`npub`) zu einer Silent-Payment-Adresse (`sp1...`) funktioniert so:

| Schritt | Operation | Wer kann das tun |
|---------|-----------|------------------|
| 1 | Oeffentlichen Nostr-x-only-Schluessel nehmen (32 Bytes, gerades Y gemaess BIP-340) | Jeder |
| 2 | Berechnen: `ScanPub = P + tagged_hash("nostr-sp/scan", P_compressed) * G` | Jeder |
| 3 | Berechnen: `SpendPub = P + tagged_hash("nostr-sp/spend", P_compressed) * G` | Jeder |
| 4 | Kodieren als `sp1... = bech32m([0x00] + ScanPub_33 + SpendPub_33)` | Jeder |
| 5 | Eingehende Zahlungen erkennen (`scan_priv` ableiten, Bloecke via ECDH scannen) | Nur nsec-Inhaber |
| 6 | Empfangene Mittel ausgeben (`spend_priv + t_k` ableiten, Sweep-Tx signieren) | Nur nsec-Inhaber |

Die Schlusseleigenschaft: Schritte 1-4 benoetigen nur den oeffentlichen Schluessel und sind deterministisch. **Jeder, der deinen npub finden kann, kann dich bezahlen - ohne jemals eine Adresse zu verlangen, ohne dass du online bist und ohne on-chain-Verbindung zwischen zwei Zahlungen an dich.**

Das bedeutet:

- **Jeder Nostr-Nutzer ist bereits ein Bitcoin-SP-Empfaenger**, ob er es weiss oder nicht. Die Adresse existiert in dem Moment, in dem das Schluesselpaar existiert.
- **Das soziale Nostr-Graph verdoppelt sich als Bitcoin-Zahlungsverzeichnis.** Wenn du jemandem folgst, kannst du ihn lautlos allein aus seinem Profil heraus bezahlen - ohne dass er je eine Bitcoin-Adresse geteilt hat.
- **Zahlungen ueberleben Key-Rotation-Workarounds.** Ein Sender berechnet die Adresse einmal aus dem npub, und die resultierenden UTXOs sind on-chain von jedem anderen P2TR-Output nicht zu unterscheiden - keine Adresswiederverwendung, kein Clustering, keine senderuebergreifende Verknuepfung.
- **Der Empfaenger muss Nostru nicht ausfuehren.** Jede BIP-352-kompatible Wallet kann an eine sp1-Adresse senden, die aus einem npub abgeleitet wurde. Der Empfaenger kann spaeter mit Nostru scannen, wann immer er moechte.

Nostru macht das sichtbar: Oeffne ein beliebiges Profil in der Erweiterung, und die `sp1...`-Adresse erscheint automatisch, live in deinem Browser aus nichts weiter als dem oeffentlichen Schluessel des Kontos berechnet.

---

## Abwaegungen

NSP ist maechtig, aber nicht neutral. Dies sind die ehrlichen Vor- und Nachteile.

**Vorteile**

| Was du gewinnst | Warum es wichtig ist |
|----------------|---------------------|
| Null Einrichtungsaufwand fuer Empfaenger | Die SP-Adresse existiert in dem Moment, in dem das Schluesselpaar existiert. Der Empfaenger muss nicht online sein, keine Software ausfuehren oder NSP kennen. |
| Universelle Reichweite | Jeder Nostr-Benutzer ist bereits ein Bitcoin-Empfaenger. Keine Anmeldung erforderlich. |
| On-Chain-Unkorrelierbarkeit | Mehrere Zahlungen an denselben npub erzeugen unkorrelierbare P2TR-Outputs. Chain-Analyse kann sie nicht buendeln. |
| Keine Adresswiederverwendung | Jede Zahlung erzeugt einen einzigartigen Output via ECDH. |
| Soziales Graph als Zahlungsverzeichnis | Folge jemandem auf Nostr, bezahle ihn lautlos - kein Adressaustausch noetig. |
| Kein Verwahrer, kein Kanal | Im Gegensatz zu Lightning keine Kanallikuiditaet oder Online-Node erforderlich. |

**Nachteile**

| Was du aufgibst | Warum es wichtig ist |
|----------------|---------------------|
| Zustimmung des Empfaengers | Du kannst Bitcoin von jedem empfangen - einschliesslich sanktionierten Adressen oder illegalen Mitteln - ohne es zu wissen. In manchen Laendern fuehrt dies zu rechtlicher Exposition, auch wenn es unbeabsichtigt ist. Tim Bouma nannte dies **Empfaenger-Schuld** (receiver culpability). |
| Absender-Deniabilitaet | Wenn der Empfaenger spaeter seine wahre Identitaet preisgibt (z.B. geoxxed wird), ist die Zahlung des Absenders dauerhaft mit dieser Person verknuepft. Tim Bouma nannte dies **Spender-Falle** (donor entrapment). |
| Kein Opt-out ohne Schluessel-Rotation | Das npub-zu-SP-Adress-Mapping ist permanent. Um den Empfang zu stoppen, muss der npub rotiert werden, was den sozialen Graphen zerstoert. |
| Scan-Schluessel-Sensibilitaet | Der Scan-Private-Key ist nsec-aequivalent. Ein kompromittierter Scan-Key bedeutet lebenslange Ueberwachung aller eingehenden SP-Outputs. |
| Scanning erfordert lokale Software | Nostru benoetigt einen lokalen Python-Prozess fuer ECDH-Scanning. |
| Indexserver-Abhaengigkeit | Das Scannen benoetigt per-Block-Tweak-Daten von einem Indexserver. Der Standard-Server sieht IP und Scanbereich. |
| Birthday-Height-Tracking | Ohne Aufzeichnung der Starthoehe muss ab einer frueheren Hoehe gescannt werden. |

Die Kernspannung, wie Tim Bouma es beschrieb: Ein Protokoll, das die Reibung fuer Absender beseitigt, entzieht gleichzeitig den Empfaengern die Handlungsfreiheit.

---

## Warum eine Erweiterung und keine Website

Silent-Payment-Scanning erfordert Zugriff auf einen Scan-privaten-Schluessel, der dem privaten Nostr-Schluessel aequivalent ist. Eine Website - auch eine, die ueber HTTPS oder von localhost bereitgestellt wird - kann damit nicht sicher umgehen. Eine Browser-Erweiterung kann es.

| Faehigkeit | Erweiterung | Website |
|------------|-------------|---------|
| Schluesselspeicher im Speicher, fuer Seitenskripte nicht zugaenglich | `chrome.storage.session` | Kein Aequivalent; JS-Variablen sind durch beliebige injizierte Skripte erreichbar |
| Kommunikation mit einem lokalen nativen Prozess | `chrome.runtime.connectNative()` | Nicht verfuegbar - diese API ist nur fuer Erweiterungen |
| NIP-07-Unterzeichner in jede Seite injizieren | Content Scripts mit `MAIN`-Welt-Zugriff | Wuerde sowieso eine Browser-Erweiterung erfordern |
| Hintergrundaufgaben ohne sichtbaren Tab ausfuehren | Service Worker + `chrome.alarms` | Erfordert Server oder immer geoeffneten Tab |
| Seitenpanel neben beliebigen Webseiten | `chrome.sidePanel` | Ohne Erweiterung unmoeglich |
| Herkunftsbasiertes Berechtigungssystem fuer Schluesselzugriff | `chrome.permissions` + benutzerdefinierter Store | Kein Standardaequivalent |

**Der kritische Blocker fuer eine Website, die NSP betreibt, ist Native Messaging.** `chrome.runtime.connectNative()` kann nur aus Erweiterungs-Service-Workern und Erweiterungsseiten aufgerufen werden - nicht von einem Web-Ursprung, nicht einmal von `localhost`. Es gibt keinen Workaround.

Ohne Native Messaging hat eine Website, die NSP-Scanning betreibt, genau zwei Optionen:

1. **Den Scan-Schluessel an einen Server senden.** Der private Scan-Schluessel ist `nsec + tagged_hash(...)` - wer ihn haelt, kann jeden an dich adressierten Silent-Payment-Output fuer immer ueberwachen. Ihn einem Server zu geben, verwandelt ein datenschutzerhaltendes Zahlungsprotokoll in ein Ueberwachungswerkzeug.

2. **Im Browser-Tab mit JavaScript scannen.** BIP-352-Scanning erfordert secp256k1-Skalarmultiplikation fuer jede Transaktion in jedem Block seit der Geburtshoehe. Bei typischem Netzwerkvolumen (Tausende von Transaktionen pro Block, Hunderte zu scannende Bloecke) wuerde das in einem Browser-Tab Stunden dauern - und in dem Moment aufhoeren, in dem der Tab geschlossen wird.

Das Erweiterungsmodell loest beide Probleme sauber:

- Der Hintergrund-Service-Worker leitet `scan_priv` im Speicher aus dem sitzungsgespeicherten `nsec` ab.
- Er gibt den Schluessel direkt an den lokalen `host.py`-Prozess ueber eine Unix-Pipe weiter (Chrome Native Messaging). Die Pipe ist fuer das OS-Prozesspaar privat.
- `host.py` fuehrt die ECDH-Berechnung lokal durch, fragt nur die Block-Tweak-Daten (nicht den Schluessel) vom Indexserver ab und gibt nur die dir gehoerenden UTXOs zurueck.
- Der Scan-Schluessel wird nirgendwo geschrieben. Wenn der Browser mitten im Scanning schliesst, ist er weg.

Das ist nur moeglich, weil die Erweiterung `chrome.runtime.connectNative()` hat. Eine Website, eine PWA und eine lokal von `file://` oder `localhost` bereitgestellte Web-App besitzen diese Faehigkeit nicht.

---

## Warum Nostru eine Premiere ist

**Noch keine Browser-Erweiterung hat jemals eine soziale Nostr-Identitaet mit Bitcoin Silent Payments kombiniert.**

Die Schluesselinnovation ist das NSP-Protokoll (Nostr Silent Payments):

1. **Ein Schluessel, zwei Netzwerke.** Dein privater Nostr-Schluessel (`nsec`) ist ein secp256k1-Skalar - dieselbe Kurve, die Bitcoin verwendet. Nostru leitet BIP-352-Scan- und Ausgabeschluessel daraus ab, indem es domaengetrennte, markierte Hashes (`nostr-sp/scan`, `nostr-sp/spend`) verwendet, sodass dein einzelner Identitaetsschluessel zu deinem Bitcoin-Empfangsschluessel wird.

2. **Bezahle jeden Nostr-Nutzer anonym.** Jeder, der deinen npub kennt, kann deine Silent-Payment-Adresse (`sp1...`) berechnen, ohne zu fragen - und ohne eine on-chain-Verbindung zwischen zwei Zahlungen herzustellen. Ein Sender kann nicht erkennen, ob du eine Zahlung erhalten hast, indem er die Blockchain betrachtet. Auch sonst niemand.

3. **Der Scan-Schluessel verlaesst niemals dein Geraet.** Der private Scan-Schluessel ist aequivalent zur Wurzel deines nsec. Nostru loest das via Chrome Native Messaging: Der Hintergrund-Service-Worker leitet den Schluessel im Speicher ab und gibt ihn direkt an einen lokalen Python-Prozess (`host.py`) ueber eine Unix-Pipe weiter. Der Schluessel wird niemals auf die Festplatte geschrieben, niemals geloggt, niemals ueber ein Netzwerk gesendet.

4. **Kein Blockchain-Node erforderlich.** Das Scanning verwendet einen leichtgewichtigen Indexserver (benutzerkonfigurierbar), der vorberechnete Tweaks pro Transaktion liefert. Der lokale Host ueberprueft die kryptografische Uebereinstimmung und meldet nur UTXOs, die dir gehoeren.

5. **Vollstaendiger Sweep ohne Drittanbieter-Signierung.** Der lokale Host erstellt und signiert die BIP-341-P2TR-Sweep-Transaktion vollstaendig in Python mit null externen Abhaengigkeiten. Die Erweiterung empfaengt die Rohtransaktion und laesst dich sie uebertragen oder fuer manuelle Einreichung kopieren.

Die Kombination - soziale Entdeckung via Nostr + lautloser eingehender Zahlungsempfang + ausschliesslich lokales Signieren - hat es noch nie in einer einzigen Browser-Erweiterung gegeben.

---

## Anerkennung

Die Idee, Nostr-Identitaeten auf Bitcoin-Silent-Payment-Adressen abzubilden, wurde von **Tim Bouma** (GitHub: trbouma, Nostr: @trbouma) formuliert. Seine Notiz ueber Empfaenger-Schuld und Spender-Falle im NSP-Kontext (https://gist.github.com/trbouma/77648ebe1005b181b67d1c4b42c7f31d) ist das intellektuelle Fundament dieses Projekts: Sie identifizierte sowohl die Staerke des Mappings (jeder npub ist bereits ein Bitcoin-Empfaenger) als auch seine ungeloeste Spannung (Zustimmung, Schuld, Falle). Nostru ist eine Implementierung dieser Idee mit einer lokalen Native-Messaging-Architektur, die das Scan-Key-Expositionsproblem loest.

---

## Architektur

```
Browser (Chrome MV3)
  sidepanel.html          <- React-Oberflaeche
      WalletScreen        <- NWC + NSP-Steuerelemente
      ProfileView         <- zeigt abgeleitete sp1-Adresse fuer beliebigen npub
  background.ts           <- Service Worker
      NIP-07-Bridge       <- Web-Unterzeichner fuer dApps
      Benachrichtigungsabfrage <- DMs, Zaps, Erwaehungen
      SP-Handler          <- leitet Schluessel im Speicher ab, ruft nativen Host auf
         |
         | Chrome Native Messaging (stdin/stdout, 4-Byte-LE-Laengenpraeffix)
         v
  host.py (lokaler Prozess, kein Netzwerkzugriff auf Schluessel)
      identify            <- Version- und Faehigkeitspruefung
      scan                <- BIP-352-ECDH-Scanning ueber Indexserver-Tweaks
      sweep               <- BIP-341-P2TR-Tx-Erstellung + Schnorr-Signatur
```

---

## Silent Payments - Verwendung

### Schritt 1 - Nativen Host installieren

Die Scan- und Signierlogik laeuft als lokales Python-Skript. Es hat keine externen Abhaengigkeiten (reines Python 3.9+ stdlib).

```bash
git clone https://github.com/i2dor/nostru
cd nostru/tools/nostru-sp
python3 install.py --extension-id=<DEINE_ERWEITERUNGS-ID>
```

Deine Erweiterungs-ID findest du unter `chrome://extensions` (Entwicklermodus aktivieren). Der Wallet-Bildschirm zeigt sie automatisch im Einrichtungsassistenten an.

Zur Ueberpruefung der Installation:

```bash
python3 install.py --verify
```

Zur Deinstallation:

```bash
python3 install.py --uninstall
```

### Schritt 2 - Nostru entsperren

Melde dich mit deinem nsec an. Der private Schluessel lebt nur im Sitzungsspeicher und wird auf Anfrage zum Ableiten von Scan- und Ausgabeschluesseln verwendet.

### Schritt 3 - Nach Zahlungen scannen

Oeffne den Wallet-Bildschirm, erweitere "Silent Payments (NSP)" und fuell aus:

| Feld | Was eingeben |
|------|--------------|
| SP-Indexserver | URL eines BIP-352-Index (Standard: silentpayments.xyz/api) |
| Geburtshoehe | Die Blockhoehe, ab der das Scanning beginnen soll (verwende die Hoehe, bei der du deine sp1-Adresse erstmals geteilt hast) |
| Spitzenhoehe | Optionale Obergrenze; leer lassen fuer den Serverstandard |

Klicke auf **Nach Zahlungen scannen**. Der lokale Host fragt den Indexserver nach Block-Tweaks ab und fuehrt ECDH gegen deinen Scan-Schluessel durch, um passende P2TR-Outputs zu finden. Es werden keine privaten Schluessel an den Indexserver gesendet.

### Schritt 4 - Sweep

Sobald UTXOs gefunden wurden, gib eine Ziel-Bitcoin-Adresse und eine Gebuehrenrate (sat/vB) ein und klicke dann auf **Sweep-Transaktion erstellen**. Der lokale Host:

1. Leitet den Ausgabeskalar pro Output ab (`b_spend + t_k mod n`)
2. Berechnet den BIP-341-Sighash fuer jeden Input
3. Signiert mit BIP-340 Schnorr unter Verwendung eines zufaelligen Aux-Werts
4. Gibt die serialisierte Rohtransaktion zurueck

Danach kannst du:
- **Rohe TX kopieren** - in ein beliebiges Bitcoin-Uebertragungswerkzeug einfuegen
- **Uebertragen** - sendet direkt an mempool.space/api/tx

---

## NSP-Zahlungen empfangen (Adresse teilen)

Deine Silent-Payment-Adresse ist auf deiner eigenen Profilkarte in der Erweiterung sichtbar. Du kannst auch die sp1-Adresse eines anderen Nutzers aus seinem npub berechnen - sie erscheint automatisch in der Profilansicht.

Teile deine sp1-Adresse genauso, wie du jede Bitcoin-Adresse teilen wuerdest. Sender verwenden eine standard-BIP-352-kompatible Wallet; sie muessen nichts ueber Nostr wissen.

---

## Testen mit einem Wegwerf-Konto

Der sicherste Weg, den gesamten Ablauf (ableiten, empfangen, scannen, sweepen) ohne echte Mittel oder Verknuepfung mit der Hauptidentitaet zu verifizieren.

### Was du brauchst

- Nostru installiert und den nativen Host eingerichtet (siehe Schritt 1 oben)
- Eine BIP-352-kompatible Sender-Wallet (Cake Wallet auf Mobilgeraet oder silentpayments.xyz/send fuer einen webbasierten Test)
- Eine kleine Menge Mainnet-Bitcoin (1000-5000 Sat reichen; ueber dem Dust-Limit bleiben)

Testnet wird nicht empfohlen - der NSP-Index von silentpayments.xyz indiziert nur Mainnet.

### Schritt fuer Schritt

**1. Wegwerf-Nostr-Schluesselpaar generieren**

```bash
npx nostr-tools@latest genkey
```

Notiere dir den aktuellen Blockhoehe - das ist deine Birthday-Height.

**2. Wegwerf-Schluesselpaar in Nostru laden**

Erweiterung oeffnen, "Konto hinzufuegen" klicken, nsec einfuegen. KEINE Notizen von diesem Konto veroeffentlichen.

**3. SP-Adresse ermitteln**

Im Wallet-Bildschirm oder der eigenen Profilkarte erscheint die `sp1...`-Adresse automatisch.

**4. An die SP-Adresse senden**

Von einer BIP-352-kompatiblen Wallet an die `sp1...`-Adresse senden. Notiere:
- Die Transaktions-ID (txid)
- Die Blockhoehe, in der sie bestaetigt wurde

**5. Scannen**

Im Wallet-Bildschirm einstellen:
- **SP-Indexserver**: `https://silentpayments.xyz/api` (Standard)
- **Birthday-Height**: die Blockhoehe aus Schritt 1 (oder der Bestaeitigungsblock aus Schritt 4)
- Tip-Height leer lassen

**Auf Zahlungen scannen** klicken. Wenn die Zahlung bestaetigt wurde, erscheint der passende UTXO.

**6. Sweep**

Zieladresse und Gebuehrenrate eingeben, dann **Sweep-Transaktion erstellen** klicken. Rohtransaktion kopieren oder senden.

### Was ein erfolgreicher Test beweist

| Pruefung | Was validiert wird |
|----------|-------------------|
| sp1-Adresse aus Wegwerf-npub abgeleitet | deriveScanPriv / deriveSpendPub Mathematik korrekt |
| Absender verwendet Standard-BIP-352-Wallet | Nostru sp1-Adressen sind mit dem oekosystem kompatibel |
| Scan findet UTXO | Nativer Host ECDH, Indexserver-Abfrage und Schluesselderiavtion funktionieren End-to-End |
| Sweep wird bestaetigt | BIP-341 P2TR-Signierung und Schnorr-Signatur sind korrekt |

---

## Relay-Konfiguration

Standard-Relays sind in `src/core/ndk/config.ts` aufgelistet. Du kannst Relays in den Einstellungen hinzufuegen oder entfernen. Aenderungen treten sofort in Kraft.

---

## Berechtigungen

| Berechtigung | Warum |
|--------------|-------|
| `storage` | Konten, Relays, Bloecke, Stummschaltungen, NWC-URI speichern |
| `sidePanel` | Als Browser-Seitenleiste oeffnen |
| `nativeMessaging` | Verbindung zum lokalen Host `nostru.sp` fuer Silent-Payment-Scan/-Sweep |
| `notifications` | Systembenachrichtigungen fuer Erwaehungen, Zaps und DMs |
| `alarms` | Hintergrundabfrage alle 5 Minuten |
| `windows` | NIP-07-Genehmigungspopup oeffnen |
| `host_permissions: https://*/*` | LNURL-Aufloesung, NWC, Lightning-Rechnungsabruf |

---

## Aus dem Quellcode erstellen

```bash
npm install
npm run build        # Produktions-Build -> dist/chrome-mv3/
npm run dev          # Dev-Modus mit HMR
npm test             # Vitest-Einheitentests
```

Lade `dist/chrome-mv3/` als entpackte Erweiterung in Chrome.

---

## Sicherheitshinweise

- **Der nsec verlaesst den Browser nie.** Der rohe private Schluessel wird in `chrome.storage.session` gespeichert (nur Speicher, beim Schliessen des Browsers geloescht) und nur vom Hintergrund-Service-Worker abgerufen.
- **scan_priv und spend_priv werden auf Anfrage abgeleitet** und nur ueber stdin an den nativen Host weitergegeben. Sie werden niemals auf die Festplatte geschrieben, niemals geloggt, niemals in einer Netzwerkanfrage uebertragen.
- **Der native Host ist sandboxed.** Chrome Native Messaging beschraenkt den Host darauf, nur mit Erweiterungen zu kommunizieren, die seinen Namen in `allowed_origins` auflisten. Der Host-Binaerpfad und die erlaubte Erweiterungs-ID werden bei der Installation festgelegt.
- **Keine Geheimnisse in diesem Repository.** Setup-Dokumente verwenden Platzhalter; Tests verwenden generierte Wegwerf-Schluessel.
- **Die Output-Unkorrelierbarkeit von BIP-352** bedeutet, dass selbst wenn der Indexserver kompromittiert wird, er nur erfaehrt, dass jemand einen Blockbereich gescannt hat - nicht welche Outputs dir gehoeren, da der ECDH-Schritt lokal erfolgt.

---

## Wie man sich nicht selbst doxxed

Silent Payments brechen die On-Chain-Analyse: Zwei Zahlungen an denselben npub erzeugen unkorrelierbare Outputs auf der Blockchain. Die Abbildung von deinem npub auf deine SP-Adresse ist jedoch oeffentlich, deterministisch und permanent - nicht auf der Blockchain, sondern auf der Identitaetsebene. Wenn dein npub deine oeffentliche soziale Identitaet ist, weiss jeder Absender, der dein Profil aufruft, bereits, dass er *dich* bezahlt.

Dies sind die praktischen Risiken und was dagegen zu tun ist:

| Risiko | Was durchsickert | Gegenmassnahme |
|--------|-----------------|----------------|
| **npub ist deine Zahlungsidentitaet** | Deine SP-Adresse kann von jedem aus deinem npub berechnet werden. Ein echter Name, eine NIP-05-Domain oder ein Foto in deinem kind:0-Profil verknuepft deine Bitcoin-Empfangsadresse dauerhaft mit dieser Identitaet. | Veroeffentliche nur, was du dauerhaft mit deiner SP-Adresse verknuepft haben moechtest. |
| **Relay-IP-Offenlegung** | Jedes Relay protokolliert deine IP zusammen mit deinem npub. Mehrere Betreiber koennen dich sitzungsuebergreifend korrelieren. | Leite Relay-Traffic ueber Tor oder ein VPN. |
| **SP-Indexserver** | Der Indexserver (Standard: silentpayments.xyz) sieht deine IP und deinen Scan-Bereich (Geburtsblock bis Spitze). Er sieht weder deinen privaten Schluessel noch welche UTXOs dir gehoeren. | Betreibe einen eigenen Index oder leite Anfragen ueber Tor. Setze eine benutzerdefinierte Server-URL im Wallet-Bildschirm. |
| **Transaktionsbroadcast** | Der eingebaute Broadcast sendet die Rohtransaktion an mempool.space - dieser Endpunkt sieht deine IP und die Transaktion. | Verwende deinen eigenen Bitcoin-Knoten oder kopiere die Rohtransaktion und uebertrage sie ueber Tor mit einem separaten Tool. |
| **NWC-URI** | Deine `nostrwalletconnect://`-URI ist ein Bearer-Credential. Wer sie erhaelt, kann dein Wallet bis zum konfigurierten Ausgabelimit leeren. | Veroeffentliche sie niemals, mache keinen Screenshot davon und fuege sie nicht in ein gemeinsam genutztes Dokument ein. Behandle sie mit derselben Sorgfalt wie deinen nsec. |
| **Kind:0-Metadaten sind permanent** | Name, Bild, NIP-05 und Bio werden an Relays veroeffentlicht und dauerhaft mit deinem npub - und damit mit deiner SP-Adresse - verknuepft. | Pruefe dein Profil, bevor du deine sp1-Adresse oeffentlich teilst. |

**Trennung der Identitaeten**

Fuer hoehere Privatsphaere verwende ein dediziertes Schluesselpaar fuer Zahlungen:

1. Generiere ein zweites Schluesselpaar (`nsec2`), das du nie an ein oeffentliches Profil knoepfst und nie fuer soziale Notizen verwendest.
2. Leite dessen SP-Adresse ab und teile nur diese mit bestimmten Absendern.
3. Verwende Nostru mit `nsec2` ausschliesslich zum Scannen und Sweepen.

Die von `nsec2` abgeleitete SP-Adresse ist vollstaendig von deinem sozialen npub getrennt. Absender benoetigen den Zahlungs-npub oder die sp1-Adresse direkt - sie koennen sie nicht aus deinem oeffentlichen Profil finden.

**Was du nicht rueckgaengig machen kannst**

Die npub-zu-SP-Adress-Abbildung ist deterministisch und permanent. Wenn du deinen npub bereits weit verbreitet hast, kann jeder Absender deine SP-Adresse bereits berechnen und wird dies dauerhaft koennen. Es gibt keinen Rotationsmechanismus ausser dem Rotieren des npub selbst.
