// Qui vengono definite le rotte relative ai post (es. POST /posts, GET /posts/:id)
import { Router } from 'express';
import { requireFields, paginated } from '../utils.js';
import { authenticateJWT } from '../auth/passport.js';
import { supabase } from '../db/index.js';

const router = Router();

// --- Rotte di Lettura ---

// GET /posts?limit=&offset=&user_id=
router.get('/', async (req, res, next) => {
    try {
        const { limit, offset } = paginated(req);
        const { user_id } = req.query; // Alias per user_id nel database

        let query = supabase
            .from('posts')
            // Selezioniamo tutti i campi del post (*), e facciamo il JOIN con users per l'autore.
            .select('*, user_id, created_at, users(id, username)', { count: 'exact' })
            // Ordina per data di creazione, dal più recente (discending)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (user_id) query = query.eq('user_id', user_id);

        const { data, error, count } = await query;
        if (error) throw error;

        // Risposta in formato paginato
        res.json({ items: data, count, limit, offset });
    } catch (err) {
        next(err); // Passa l'errore al gestore errori di Express
    }
});

// GET /posts/:id
// Ottiene un singolo post per ID.
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('posts')
            // Selezioniamo il post e le info dell'autore
            .select('*, users(id, username)')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 è 'No rows found'
            throw error;
        }

        if (!data) return res.status(404).json({ error: 'Post non trovato' });

        res.json(data);
    } catch (err) {
        next(err);
    }
});

// --- Rotte Protette (Richiedono JWT e Autorizzazione) ---

// POST /posts (Crea un nuovo post) - rotta protetta
router.post('/', authenticateJWT, async (req, res, next) => {
    try {
        const user_id = req.user.id; // L'ID dell'utente autenticato (dal token JWT)

        // Validazione dei campi obbligatori (DRY)
        requireFields(req.body, ['content']);

        const payload = {
            content: req.body.content,
            user_id: user_id, // Usiamo l'ID autenticato come autore
            // created_at è gestito dal database con DEFAULT
        };

        const { data, error } = await supabase
            .from('posts')
            .insert(payload)
            .select('*')
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (err) {
        next(err);
    }
});

// PATCH /posts/:id (Aggiorna un post)
// Permette solo all'autore di aggiornare il contenuto.
router.patch('/:id', authenticateJWT, async (req, res, next) => { 
    try {
        const userId = req.user.id;
        const postId = req.params.id;

        // L'unico campo aggiornabile è 'content'
        if (!req.body.content) {
            const err = new Error('Nessun campo valido ("content") fornito per l\'aggiornamento.');
            err.status = 400;
            throw err;
        }

        // 1. Verifica proprietà: Ottiene solo user_id
        const { data: post, error: fetchError } = await supabase
            .from('posts')
            .select('user_id')
            .eq('id', postId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        if (!post) return res.status(404).json({ error: 'Post non trovato' });

        // 2. Controllo di Autorizzazione (403 Forbidden)
        if (post.user_id !== userId) {
            const err = new Error('Non sei autorizzato a modificare questo post.');
            err.status = 403;
            throw err;
        }

        // 3. Aggiornamento
        const updatePayload = {
            content: req.body.content,
        };

        const { data, error: updateError } = await supabase
            .from('posts')
            .update(updatePayload)
            .eq('id', postId)
            .select('*')
            .single();

        if (updateError) throw updateError;

        res.json(data);
    } catch (err) {
        next(err);
    }
});

// DELETE /posts/:id (Cancella un post)
// Permette solo all'autore di cancellare il post.
router.delete('/:id', authenticateJWT, async (req, res, next) => { 
    try {
        const userId = req.user.id;
        const postId = req.params.id;

        // 1. Verifica proprietà: Ottiene solo user_id
        const { data: post, error: fetchError } = await supabase
            .from('posts')
            .select('user_id') 
            .eq('id', postId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        // Se non trova il post, risponde 204 (idempotenza)
        if (!post) return res.status(204).send();

        // 2. Controllo di Autorizzazione (403 Forbidden)
        if (post.user_id !== userId) { 
            const err = new Error('Non sei autorizzato a cancellare questo post.');
            err.status = 403;
            throw err;
        }

        // 3. Cancellazione
        const { error: deleteError } = await supabase
            .from('posts')
            .delete()
            .eq('id', postId);

        if (deleteError) throw deleteError;

        // 204 No Content per cancellazione riuscita
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});

export default router;