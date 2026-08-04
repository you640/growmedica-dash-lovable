## Plán

### 1. ADMIN_EMAILS secret

Otvorím secret formulár pre `ADMIN_EMAILS` cez `secrets--update_secret` (alebo `add_secret` ak neexistuje). Vy zadáte hodnotu:

```
erikbabcan@gmail.com,u0352652320@gmail.com,Kajo.Szaffko@gmail.com
```

Server fn `verifyAdminAccess` už parsuje CSV podľa čiarky, takže žiadna zmena kódu netreba.

### 2. Ikony z `gqqqimage.png`

Zdroj: `/mnt/user-uploads/gqqqimage.png` (1024×1024, zelený list v zlatom prsteni, priehľadné pozadie).

Vygenerujem cez ImageMagick (`nix run nixpkgs#imagemagick`) do `public/`:

- `favicon.ico` (multi-size 16/32/48)
- `favicon-16.png`, `favicon-32.png`
- `apple-touch-icon.png` (180×180, iOS home-screen)
- `icon-192.png`, `icon-512.png` (Android PWA, oba `any` aj `maskable` variant: `icon-192-maskable.png`, `icon-512-maskable.png` s ~10% safe-area paddingom a tmavým pozadím)
- `og-image.png` (1200×630 pre social share — voliteľne)

### 3. Web app manifest (PWA install — manifest-only, bez service workera)

Vytvorím `public/manifest.webmanifest`:

```json
{
  "name": "GrowMedica Admin",
  "short_name": "GrowMedica",
  "start_url": "/admin",
  "scope": "/",
  "display": "standalone",
  "background_color": "#FDFBF7",
  "theme_color": "#1f3a1f",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    {
      "src": "/icon-192-maskable.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icon-512-maskable.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

Bez service workera — používateľ nepýtal offline, len ikonu/inštaláciu na home-screen.

### 4. Head tagy v `src/routes/__root.tsx`

Do `head().links` doplním:

- `rel="icon"` → `/favicon.ico` (rieši 404)
- `rel="icon" type="image/png" sizes="32x32"` → `/favicon-32.png`
- `rel="apple-touch-icon" sizes="180x180"` → `/apple-touch-icon.png`
- `rel="manifest"` → `/manifest.webmanifest`

Do `head().meta` doplním `theme-color #1f3a1f`.

### 5. Verifikácia

- Build prejde, `/favicon.ico` 200, manifest validný, ikony viditeľné v DevTools → Application → Manifest.

Schváľ a prepnem do build mode.

- nahradit aktualny signn in - google sign i od loveable a apple sign in impleentovat tiez !

&nbsp;
