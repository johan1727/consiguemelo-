const { ZodError } = require('zod');

const validateBody = (schema) => {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({
                    error: 'Payload inválido.',
                    details: error.issues.map(issue => ({
                        path: issue.path.join('.'),
                        message: issue.message
                    }))
                });
            }

            return res.status(400).json({ error: 'No se pudo validar la solicitud.' });
        }
    };
};

module.exports = {
    validateBody
};
