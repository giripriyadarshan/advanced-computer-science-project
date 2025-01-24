/* @refresh reload */
import {render} from 'solid-js/web'
import './index.css'
import App from './App.jsx'
import {StoreProvider} from './store';

const root = document.getElementById('root')

render(() => (
    <StoreProvider>
        <App/>
    </StoreProvider>), root)
