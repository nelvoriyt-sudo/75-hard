import { render } from 'preact'
import { App } from './App'
import { registerServiceWorker } from './lib/push'
import './styles.css'

registerServiceWorker()
render(<App />, document.getElementById('app')!)
