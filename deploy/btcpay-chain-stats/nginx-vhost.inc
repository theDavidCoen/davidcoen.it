## Start of configuration add by letsencrypt container
location ^~ /.well-known/acme-challenge/ {
    auth_basic off;
    auth_request off;
    allow all;
    root /usr/share/nginx/html;
    try_files $uri =404;
    break;
}
## End of configuration add by letsencrypt container

# Public read-only chain stats from local bitcoind (user systemd on docker gateway).
location = /api/public/chain-stats {
    proxy_pass http://172.22.0.1:18767/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 12s;
    proxy_connect_timeout 3s;
    limit_except GET OPTIONS {
        deny all;
    }
}
