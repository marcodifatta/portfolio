# Usa l'immagine nginx come base
FROM nginx:alpine

# Copia il contenuto del sito nella directory di Nginx
COPY . /usr/share/nginx/html

# Espone la porta 80 per il container
EXPOSE 80