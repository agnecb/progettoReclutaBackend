// Questo file usa le variabili .env per connettersi al mio database Supabase.
// Verifica che le variabili d'ambiente esistano, poi esporta e crea il client verso il database
import { createClient } from '@supabase/supabase-js';

// Leggi le variabili d'ambiente necessarie
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY; 

if (!url || !key) {
    // Implementa la logica "fail fast"
    throw new Error("Mancano le variabili d'ambiente SUPABASE_URL o SUPABASE_KEY. Controlla il file .env.");
}

// Inizializzazione del client Supabase
export const supabase = createClient(url, key);

console.log("Client Supabase inizializzato correttamente.");