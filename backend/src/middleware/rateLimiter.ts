import rateLimit from "express-rate-limit";

// Rate Limiter Global para a API: 600 requisições por minuto por IP
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Muitas requisições originadas deste IP. Por favor, tente novamente em instantes."
  }
});

// Rate Limiter Estrito Anti-Brute Force para Login: 15 tentativas a cada 15 minutos
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Muitas tentativas de autenticação falhas. Por motivos de segurança, tente novamente em 15 minutos."
  }
});
