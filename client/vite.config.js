import {defineConfig} from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
    plugins: [solid()],
    server: {
        port: 8080,
        allowedHosts: [
            '.eastern-kit-447119-p5.ew.r.appspot.com',
            'chatter-haus-frontend-dot-eastern-kit-447119-p5.ew.r.appspot.com',
            '*.appspot.com'
        ],
    }
})
