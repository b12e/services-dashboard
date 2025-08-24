# Use the official nginx image as base
FROM nginx:alpine

# Install necessary tools for the startup script
RUN apk add --no-cache bash

# Copy the static files to nginx's default serving directory
COPY . /usr/share/nginx/html/

# Copy a custom nginx configuration if needed
# COPY nginx.conf /etc/nginx/nginx.conf

# Create a startup script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port 80
EXPOSE 80

# Use the startup script as entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]
