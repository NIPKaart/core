# ============================
# Backend stage (Composer)
# ============================
FROM composer:2.8.10 AS backend

WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install \
    --ignore-platform-reqs \
    --no-ansi \
    --no-autoloader \
    --no-dev \
    --no-interaction \
    --no-scripts

COPY . .
RUN composer dump-autoload --optimize --classmap-authoritative

# ============================
# Frontend stage (Vite build)
# ============================
FROM node:22 AS frontend

WORKDIR /app

COPY package.json package-lock.json vite.config.* tsconfig.json ./
RUN npm install

COPY resources ./resources
COPY public ./public
RUN npm run build

# ============================
# Final stage: FrankenPHP
# ============================
FROM dunglas/frankenphp:1.9.0

WORKDIR /app

# Copy Laravel + Vite build
COPY --from=backend /app /app
COPY --from=frontend /app/public/build /app/public/build

# Laravel storage permissions
RUN chmod -R 775 storage bootstrap/cache

# Optional: set Laravel config cache during build (can also be done at runtime)
RUN php artisan config:cache \
 && php artisan route:cache

EXPOSE 80
