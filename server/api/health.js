// ok
// verifica se il server sta bene

import { Router } from 'express';

// Crea un'istanza di Router Express specifica per l'health check
const healthRouter = Router();

/**
 * @route GET /healthz
 * @description Verifica lo stato base del server. 
 * Viene montato direttamente su /api/healthz (senza prefisso nel router principale).
 * Restituisce { status: 'ok' } con HTTP 200 se il server è attivo.
 */
healthRouter.get('/healthz', (_req, res) => {
    // _req è convenzionale per indicare che il parametro non viene usato
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Mini Twitter Backend'
    });
});

export default healthRouter;