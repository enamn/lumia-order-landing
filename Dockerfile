# Build the static site
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve with nginx on $PORT (Cloud Run sets PORT, defaults to 8080)
FROM nginx:1.27-alpine
ENV PORT=8080
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
