// ok
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
/*
import { createClient } from '@supabase/supabase-js';

// Queste variabili DEVONO essere presenti nel tuo file .env e caricate da un sistema
// come 'dotenv' nel tuo punto di ingresso (server.js o app.js)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// --- LOG DI DEBUG AGGIUNTI ---
// Stampiamo i primi 30 caratteri per non esporre tutta la chiave in console.
console.log('DEBUG: SUPABASE_URL letto:', typeof supabaseUrl === 'string' ? supabaseUrl.substring(0, 30) + '...' : supabaseUrl);
console.log('DEBUG: SUPABASE_KEY letto:', typeof supabaseKey === 'string' ? supabaseKey.substring(0, 30) + '...' : supabaseKey);
// -----------------------------


if (typeof supabaseUrl !== 'string' || supabaseUrl.length === 0 || typeof supabaseKey !== 'string' || supabaseKey.length === 0) {
    throw new Error("Mancano le variabili d'ambiente SUPABASE_URL o SUPABASE_KEY. Controlla il file .env.");
}
*/
/**
 * Client Supabase inizializzato per l'accesso al database.
 * Useremo questo client in tutti i servizi e router.
 */
/*
export const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Database Client: Supabase inizializzato correttamente.');

// Esportiamo anche le chiavi (non la chiave segreta) per riferimento se necessario
export { supabaseUrl, supabaseKey };*/