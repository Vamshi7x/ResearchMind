# Stage 1: Build the React app
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first for caching
COPY package*.json ./

# Install dependencies
RUN npm ci 


COPY . . 

# Build the production app
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy the built app
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]

