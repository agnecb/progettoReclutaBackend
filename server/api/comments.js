// Qui vengono definite le rotte relative ai commenti (es. POST /comments, GET /comments/:postId)
import { Router } from 'express';
import { authenticateJWT } from '../auth/passport.js';
import { supabase } from '../db/index.js';
import { requireFields, paginated } from '../utils.js';

// Crea l'istanza del router
const router = Router();

// NB: le rotte sono '/' perchè poi vengono montate dal router principale (in questo caso col prefisso /comments)

// GET /comments?post_id=&limit=&offset=
// Ottiene commenti, con paginazione, opzionalmente filtrati per post_id.
router.get('/', async (req, res, next) => {
    try {
        const { limit, offset } = paginated(req);
        const postId = req.query.post_id;

        let query = supabase
            .from('comments')
            // Richiede il commento e le info base dell'autore (completate grazie alla foreign key - "Foreign Table Joins" gestita da PostgREST)
            .select('*, user_id, created_at, users(id, username)', { count: 'exact' })
            // Ordina dal più recente al più vecchio
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (postId) query = query.eq('post_id', postId);

        const { data, error, count } = await query;
        if (error) throw error;

        // Risposta in formato paginato
        res.json({ items: data, count, limit, offset });
    } catch (err) { next(err); }
});



// GET /comments/:id
// Ottiene un singolo commento per ID.
router.get('/:id', async (req, res, next) => {
    try {
        const { data, error } = await supabase
            .from('comments')
            // Richiede info complete (commento, autore, post)
            .select('*, user_id, users(id, username), posts(id)')
            .eq('id', req.params.id)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 è 'No rows found'
            throw error;
        }

        // 404 se non trovato
        if (!data) return res.status(404).json({ error: 'Commento non trovato' });

        res.json(data);
    } catch (err) { next(err); }
});


// POST /comments (protetta)
// Crea un nuovo commento.
router.post('/', authenticateJWT, async (req, res, next) => {
    try {
        const user_id = req.user.id; // Ottenuto da authenticateJWT
        requireFields(req.body, ['post_id', 'content']);

        const payload = {
            post_id: req.body.post_id,
            user_id: user_id,
            content: req.body.content
        };
        const { data, error } = await supabase
            .from('comments')
            .insert(payload)
            .select('*')
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (err) { next(err); }
});



// PATCH /comments/:id (protetta)
// Aggiorna il contenuto di un commento (solo l'autore).
router.patch('/:id', authenticateJWT, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const commentId = req.params.id;

        // Verifica se il corpo contiene il campo 'content'
        if (!('content' in req.body)) {
            // Se non c'è nulla da aggiornare
            const err = new Error('Nessun campo valido (solo "content" supportato) fornito per l\'aggiornamento.');
            err.status = 400;
            throw err;
        }

        // 1. Verifica proprietà: Ottiene solo user_id del commento
        const { data: comment, error: fetchError } = await supabase
            .from('comments')
            .select('user_id')
            .eq('id', commentId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
        if (!comment) return res.status(404).json({ error: 'Commento non trovato' });

        // 2. Controllo di Autorizzazione (403 Forbidden)
        if (comment.user_id !== userId) {
            const err = new Error('Non sei autorizzato a modificare questo commento.');
            err.status = 403;
            throw err;
        }

        // 3. Aggiornamento
        const { data, error: updateError } = await supabase
            .from('comments')
            .update({ content: req.body.content, updated_at: new Date().toISOString() }) // Aggiungo updated_at
            .eq('id', commentId)
            .select('*')
            .single();

        if (updateError) throw updateError;

        res.json(data);
    } catch (err) { next(err); }
});

// DELETE /comments/:id (protetta)
// Cancella un commento (solo l'autore).
router.delete('/:id', authenticateJWT, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const commentId = req.params.id;

        // 1. Verifica proprietà: Ottiene solo user_id del commento
        const { data: comment, error: fetchError } = await supabase
            .from('comments')
            .select('user_id')
            .eq('id', commentId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        // Se non trova il commento, risponde 204 (idempotenza)
        if (!comment) return res.status(204).send();

        // 2. Controllo di Autorizzazione (403 Forbidden)
        if (comment.user_id !== userId) {
            const err = new Error('Non sei autorizzato a cancellare questo commento.');
            err.status = 403;
            throw err;
        }

        // 3. Cancellazione
        const { error: deleteError } = await supabase
            .from('comments')
            .delete()
            .eq('id', commentId);

        if (deleteError) throw deleteError;

        // 204 No Content per cancellazione riuscita
        res.status(204).send();
    } catch (err) { next(err); }
});




// Esportazione predefinita del router
export default router;