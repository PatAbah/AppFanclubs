import fs from 'node:fs';
import {defineConfig} from 'vite';
const address=new URL(JSON.parse(fs.readFileSync(new URL('./mobile/appfanclubs.config.json',import.meta.url),'utf8')).apiBaseUrl);
export default defineConfig({base:address.pathname,server:{proxy:{[address.pathname+'api']:{target:address.origin,changeOrigin:true,configure(proxy){proxy.on('proxyReq',req=>req.setHeader('Origin',address.origin))}}}}});
