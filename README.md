# SexyGuard React SDK

React SDK для работы с бэкендом **sexyguard** + Supabase.

## Установка

```bash
npm install ./react-sdk
```

---

# REST API

```jsx
import React from 'react';
import { SexyGuardProvider, useAuth, useProfile } from 'sexyguard-react-sdk';

export default function App() {
  return (
    <SexyGuardProvider baseUrl="http://localhost:8080">
      <Auth />
      <Profile />
    </SexyGuardProvider>
  );
}
```

---

# Supabase режим

```jsx
<SexyGuardProvider
  baseUrl="http://localhost:8080"
  supabaseUrl="https://xxxx.supabase.co"
  supabaseKey="SUPABASE_ANON_KEY"
>
  <App />
</SexyGuardProvider>
```

---
### Модели (TypeScript)

```ts
import { UserProfile, MarketItem } from 'sexyguard-react-sdk';
```

### Token storage (SSR-safe)

```js
import { createTokenStorage } from 'sexyguard-react-sdk';

const storage = createTokenStorage({ type: 'cookie', key: 'token' });

<SexyGuardProvider tokenStorage={storage} />
```

### Supabase таблицы

```jsx
import { useSupabaseTable } from 'sexyguard-react-sdk';

function Products() {
  const { data, insert } = useSupabaseTable('products', {
    select: '*',
    filters: [{ op: 'eq', column: 'active', value: true }]
  });

  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
```

### Supabase Realtime

```jsx
import { useSupabaseRealtime } from 'sexyguard-react-sdk';

useSupabaseRealtime('products', {
  event: '*',
  onEvent: (payload) => console.log(payload)
});
```

---

## Хуки

- `useAuth()` — login / register / logout
- `useSupabaseAuth()` — Supabase auth
- `useSupabaseTable()` — Supabase table CRUD
- `useSupabaseRealtime()` — Supabase realtime
- `useProfile()` — профиль
- `useMarket()` — магазин
- `useStats()` — статистика
- `useVersion()` — версия

---

## Утилиты

- `createTokenStorage()` — storage для токена (cookie / memory / localStorage)
- `SexyGuardError` + `normalizeError()`
- `createSupabaseClient()`

---

SDK использует `fetch` и `@supabase/supabase-js` (peer dependency).
