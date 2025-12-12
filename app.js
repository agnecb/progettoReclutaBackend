// Applicazione si occupa di creare la sessione, mettere il secret nella sessione, i cookie, ecc
// NB: errori di accesso o autorizzazione possono essere legati ai cors, che gestiscono le chiamate multi-sito
import express from 'express';
import cors from 'cors';
import passport from 'passport';
import session from 'express-session'; // Import necessario per la gestione della sessione
import { api as apiRouter } from './server/api/index.js'; // Importiamo il router principale aggregato
import 'dotenv/config';

/**
 * Funzione che crea e configura l'istanza dell'applicazione Express.
 * @returns {express.Application} L'istanza dell'app Express configurata.
 */
export function createApp() {
    const app = express();

    // --- Middleware Globali ---
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Logging delle variabili d'ambiente (per debug)
    console.log('SUPABASE_URL ->', process.env.SUPABASE_SERVICE_ROLE_KEY || '{non impostata}');

    // Configurazione della sessione
    app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production' // true in produzione (richiede HTTPS)
        }
    }));

    // Inizializzazione di passport
    app.use(passport.initialize());
    app.use(passport.session());

    // Middleware di Logging delle richieste
    app.use((req, _res, next) => {
        // Corretto la sintassi del template string
        console.log(`[${req.method}] ${req.url}`);
        next();
    });

    // --- Routing Principale ---
    // Monta il router principale su /api
    app.use('/api', apiRouter);

    // Rotta base <-- aggiunta!!
    app.get('/', (_req, res) => {
        res.json({ message: 'Mini Twitter Backend è attivo. Accedi a /api/healthz per lo stato.' });
    });


    // --- Gestione 404 (Route non trovata) ---
    // Questo middleware viene chiamato se nessun router precedente ha gestito la richiesta
    app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

    // --- Gestione degli Errori (Error Handler) ---
    // Middleware finale per gestire tutti gli errori
    app.use((err, _req, res, _next) => {
        console.error(err);
        const status = err.status || 500;
        res.status(status).json({ error: err.message || 'Internal Server Error' });
    });

    return app;
}