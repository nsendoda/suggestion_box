## migration local db
wrangler d1 migrations apply to-sho-box-db --local

## start local
wrangler dev --assets ./public --x-remote-bindings