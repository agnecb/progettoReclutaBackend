// Qui vengono definite le rotte relative ai like (es. POST /likes, GET /likes)
import { Router } from 'express';
import { requireFields } from '../utils.js';
import { authenticateJWT } from '../auth/passport.js'; 
import { supabase } from '../db/index.js';

const router = Router();

// --- Rotte di Lettura ---

// GET /likes?post_id=&user_id=&count=true
// Restituisce l'elenco dei like o solo il loro conteggio.
router.get('/', async (req, res, next) => {
    try {
        const { post_id, user_id, count } = req.query; 

        // Inizializza la query per selezionare solo i campi della tabella likes
        let query = supabase
            .from('likes')
            // Selezioniamo tutti i campi ('*') ma usiamo count: 'exact' per ottenere il totale
            .select('*', { count: 'exact' }); 

        // Applica filtri opzionali
        if (post_id) query = query.eq('post_id', post_id);
        if (user_id) query = query.eq('user_id', user_id);

        const { data, error, count: totalCount } = await query;
        if (error) throw error;

        // Se l'utente ha chiesto solo il conteggio, lo ritorniamo
        if (count === 'true') {
            return res.json({ count: totalCount });
        }

        // Altrimenti, restituiamo la lista completa dei like che matchano il filtro
        res.json({ items: data, count: totalCount });
    } catch (err) { 
        next(err); 
    }
});


// --- Rotte Protette (Richiedono JWT) ---

// POST /likes (Metti like a un post - Idempotente)
router.post('/', authenticateJWT, async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        // Richiede post_id nel corpo della richiesta
        requireFields(req.body, ['post_id']); 
        const { post_id } = req.body;
        
        // 1. Verifica Idempotenza: Il like esiste già?
        const { count: existingCount, error: checkError } = await supabase
            .from('likes')
            .select('id', { count: 'exact', head: true }) // Ottimizzato per contare
            .eq('user_id', userId)
            .eq('post_id', post_id);

        if (checkError) throw checkError;

        if (existingCount > 0) {
            // Se il like esiste già, rispondiamo 200 (idempotenza)
            return res.status(200).json({ ok: true });
        }
        
        // 2. Creazione del Like
        const payload = {
            post_id: post_id,
            user_id: userId,
        };
        
        const { data, error: insertError } = await supabase
            .from('likes')
            .insert(payload)
            .select('*')
            .single();
            
        if (insertError) throw insertError;
        
        // Risposta 201 per nuova creazione
        res.status(201).json(data);
    } catch (err) { 
        next(err); 
    }
});


// DELETE /likes (Rimuovi like da un post)
// Usa un body per specificare post_id
router.delete('/', authenticateJWT, async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        // Richiede post_id nel corpo della richiesta (pattern non standard per DELETE, ma conforme allo Swagger)
        requireFields(req.body, ['post_id']); 
        const { post_id } = req.body;
        
        // Cancellazione
        const { error: deleteError } = await supabase
            .from('likes')
            .delete()
            .eq('user_id', userId)
            .eq('post_id', post_id);
            
        if (deleteError) throw deleteError;
        
        // 204 No Content per cancellazione riuscita o se non esisteva (idempotenza)
        res.status(204).send();
    } catch (err) { 
        next(err); 
    }
});

export default router;