# ===================================
# Backend stage (Composer + Laravel)
# ===================================
FROM composer:2.8.10 AS backend

WORKDIR /app

# Copy composer files and install deps
COPY composer.json composer.lock /app/
RUN composer install \
    --ignore-platform-reqs \
    --no-ansi \
    --no-autoloader \
    --no-dev \
    --no-interaction \
    --no-scripts

# Copy rest of Laravel source
COPY . /app/
RUN composer dump-autoload --optimize --classmap-authoritative

# ===================================
# Frontend stage (Vite build)
# ===================================
FROM node:22 AS frontend

WORKDIR /app

# Install deps
COPY package.json package-lock.json vite.config.* tsconfig.json /app/
RUN npm install

# Copy frontend source and build
COPY resources /app/resources
COPY public /app/public
RUN npm run build

# ===================================
# Final image
# ===================================
FROM php:8.3.23-fpm-bullseye

WORKDIR /var/www

# Install system packages and PHP extensions
RUN apt-get update && apt-get install -y \
    git unzip curl zip libpng-dev libonig-dev libxml2-dev \
    libzip-dev libicu-dev libjpeg62-turbo-dev libfreetype6-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install pdo pdo_mysql zip mbstring intl gd \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy Laravel app and frontend build
COPY --from=backend /app /var/www
COPY --from=frontend /app/public/build /var/www/public/build

# Set permissions
RUN chown -R www-data:www-data /var/www \
 && chmod -R 775 /var/www/storage /var/www/bootstrap/cache

# Expose PHP-FPM port
EXPOSE 9000

CMD ["php-fpm"]
