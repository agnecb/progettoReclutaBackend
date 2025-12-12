// Qui vengono definite le rotte relative agli utenti (es. GET /users/:id, PUT /users/:id)

import { Router } from 'express';
import { supabase } from '../db/index.js';
import bcrypt from 'bcrypt'; // Necessario per hashing
import { authenticateJWT } from '../auth/passport.js'; // Middleware di protezione JWT

// Costante per l'hashing della password
const SALT_ROUNDS = 10;

// Campi da selezionare pubblicamente (escludiamo password_hash e dati sensibili - salt, otp_secret)
const USER_SELECT_FIELDS = 'id, username, email, bio, created_at';

const router = Router();

// Valida la presenza dei campi obbligatori nel corpo della richiesta.
const requireFields = (obj, fields) => {
    const missing = fields.filter(f => obj?.[f] == null || obj[f] === '');
    if (missing.length) {
        const err = new Error(`Missing fields: ${missing.join(', ')}`);
        err.status = 400;
        throw err;
    }
};

// Calcola i parametri di paginazione (limit e offset).
const paginated = (req) => {
    const limit = Math.min(parseInt(req.query.limit ?? '20', 10), 100);
    const offset = Math.max(parseInt(req.query.offset ?? '0', 10), 0);
    return { limit, offset };
}


/* ROTTE */

// GET /users?limit=&offset=&q=
// --> Paginazione
// --> Se q presente → filtro su username o email (usa .or(...) di Supabase).
// 1. GET /users?limit=&offset=&q= (Lista Utenti)
// Paginazione e filtro su username o email.
router.get('/', async (req, res, next) => {
    try {
        const { limit, offset } = paginated(req);
        const q = req.query.q?.trim();

        let query = supabase
            .from('users')
            .select(USER_SELECT_FIELDS, { count: 'exact' });
        
        // Filtro di ricerca (q)
        if (q) {
            // Filtra su username O email (usando .ilike per case-insensitive)
            query = query.or(`username.ilike.*${q}*,email.ilike.*${q}*`);
        }

        // Ordinamento e Paginazione
        query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            console.error('Error fetching users:', error);
            throw error;
        }

        res.json({ items: data, count, limit, offset });

    } catch (err) {
        next(err);
    }
});


// GET /users/:id → singolo utente.
router.get('/:id', async (req, res, next) => {
    try {
        const userId = req.params.id;

        const { data: user, error } = await supabase
            .from('users')
            .select(USER_SELECT_FIELDS)
            .eq('id', userId)
            .single();

        if (error) {
            // PGRST116 = nessun risultato (404)
            const status = (error.code === 'PGRST116') ? 404 : 500;
            const message = (error.code === 'PGRST116') ? 'Utente non trovato.' : 'Errore del database.';
            return res.status(status).json({ error: message });
        }

        // Lo Swagger /users/{id} GET ritorna il solo oggetto 'User' aggiornato
        res.status(200).json({
            id: user.id,
            username: user.username,
            email: user.email,
            bio: user.bio,
            created_at: user.created_at
        });

    } catch (err) {
        next(err);
    }
});

// POST /users → crea utente (richiede username, email, password_hash) --> NON viene usata, la creazione di un profilo avviene tramite autenticazione (vedi auth.js)
router.post('/', async (req, res, next) => {
    try {
        // Validazione
        requireFields(req.body, ['username', 'email', 'password']);
        const { username, email, password } = req.body;

        // Hash della password
        const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

        // Inserimento --> no

    } catch (err) {
        next(err);
    }
});


// PATCH /users/:id → aggiorna campi presenti nel body (username, bio) - Protetta da JWT
router.patch('/:id', authenticateJWT, async (req, res, next) => {
    try {
        const userIdToUpdate = req.params.id;
        const requestingUserId = req.user.id; // ID dell'utente loggato fornito da authenticateJWT

        // Controllo di Autorizzazione: solo l'utente stesso può aggiornare
        if (userIdToUpdate !== requestingUserId) {
            return res.status(403).json({ error: 'Non sei autorizzato a modificare questo profilo.' });
        }

        const updateData = req.body;
        const dataToUpdate = {};

        // Filtra solo i campi che possono essere aggiornati e prepara l'oggetto
        if (updateData.username) dataToUpdate.username = updateData.username;
        if (updateData.bio) dataToUpdate.bio = updateData.bio;

        if (Object.keys(dataToUpdate).length === 0) {
            return res.status(400).json({ error: 'Nessun campo valido fornito per l\'aggiornamento.' });
        }

        // Esegue l'aggiornamento
        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update(dataToUpdate)
            .eq('id', userIdToUpdate)
            .select(USER_SELECT_FIELDS)
            .single();

        if (updateError) {
            console.error('Database update error:', updateError);
            const status = (updateError.code === '23505') ? 409 : 500;
            const message = (updateError.code === '23505')
                ? 'Username o email già in uso.'
                : 'Errore durante l\'aggiornamento dell\'utente.';
            return res.status(status).json({ error: message });
        }

        if (!updatedUser) {
            return res.status(404).json({ error: 'Utente non trovato.' });
        }

        res.status(200).json({
            // Lo Swagger /users/{id} PATCH ritorna il solo oggetto 'User' aggiornato
            // L'oggetto 'User' in questo file è la radice della risposta.
            id: updatedUser.id,
            username: updatedUser.username,
            email: updatedUser.email,
            bio: updatedUser.bio,
            created_at: updatedUser.created_at
            // Nota: La risposta User dello Swagger include password_hash che qui è omesso per sicurezza
        });

    } catch (err) {
        next(err);
    }
});


// DELETE /users/:id → cancella utente - Protetta da JWT
router.delete('/:id', authenticateJWT, async (req, res, next) => {
    try {
        const userIdToDelete = req.params.id;
        const requestingUserId = req.user.id;

        // Controllo di Autorizzazione: solo l'utente stesso può cancellare
        if (userIdToDelete !== requestingUserId) {
            return res.status(403).json({ error: 'Non sei autorizzato a cancellare questo profilo.' });
        }

        // Esegue la cancellazione --> devo mettere on delete cascade così da eliminare anche i record delle altre tabelle in cui è chiave esterna
        const { error: deleteError } = await supabase
            .from('users')
            .delete()
            .eq('id', userIdToDelete);

        if (deleteError) {
            console.error('Database delete error:', deleteError);
            return res.status(500).json({ error: 'Errore durante la cancellazione dell\'utente.' });
        }

        // 204 No Content è la risposta standard per cancellazione riuscita (come da Swagger)
        res.status(204).send();

    } catch (err) {
        next(err);
    }
});

export default router;