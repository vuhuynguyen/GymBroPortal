# syntax=docker/dockerfile:1
#
# GymBro Portal (Angular 21) → static assets served by nginx, which also reverse-proxies /api to the
# backend so the browser sees a single origin (no CORS needed).

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime ----
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Angular's application builder emits to dist/<project>/browser.
COPY --from=build /app/dist/gym-bro-portal/browser /usr/share/nginx/html
EXPOSE 80
