const supabase = require('../config/supabase');

exports.submitFeedback = async (req, res) => {
    try {
        if (!supabase) {
            console.error('Supabase client not initialized');
            return res.status(503).json({ error: 'Servicio de base de datos no disponible.' });
        }

        const { message, user_email } = req.body;
        // SECURITY FIX: Ignore user_id from body, use authenticated user from JWT
        const user_id = req.userId || null;

        if (!message) {
            return res.status(400).json({ error: 'El mensaje es requerido.' });
        }

        // Primary schema: query/response/vote
        let { error } = await supabase
            .from('feedback')
            .insert([{
                query: 'GENERAL_APP_FEEDBACK',
                response: message,
                vote: 1,
                user_id: user_id
            }]);

        // Backward compatibility: legacy schema message/email
        if (error) {
            console.warn('Feedback schema query/response no disponible, intentando esquema legacy:', error.message);
            const legacy = await supabase
                .from('feedback')
                .insert([{
                    message,
                    email: user_email || null,
                    user_id: user_id || null
                }]);
            error = legacy.error;
        }

        if (error) {
            console.error('Error insertando feedback en Supabase:', error);
            return res.status(500).json({ error: 'Fallo al guardar feedback en BD.' });
        }

        res.json({ success: true, message: 'Feedback recibido correctamente.' });

    } catch (error) {
        console.error('Error submitFeedback:', error);
        res.status(500).json({ error: 'Error del servidor al procesar feedback.' });
    }
};
