// En app/_layout.tsx
import { useEffect } from 'react';
import { initDatabase } from '../db/database'; // Ajusta la ruta

export default function RootLayout() {
  useEffect(() => {
    initDatabase(); // <-- Inicializa la BD al abrir la app
  }, []);

  // ... resto de tu código (Stack, Slot, etc.)
}
