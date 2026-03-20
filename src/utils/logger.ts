import winston from 'winston';

const { combine, timestamp, printf, colorize, align } = winston.format;

const logFormat = printf((info) => {
  return `[${info.timestamp}] ${info.level}: ${info.message}`;
});

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    colorize({ all: true }),
    timestamp({ format: 'YYYY-MM-DD hh:mm:ss.SSS A' }),
    align(),
    logFormat
  ),
  transports: [
    new winston.transports.Console(),
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' })
    ] : [])
  ],
});
