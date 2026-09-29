import { render } from 'preact'
import { App } from './App'
import { registerServiceWorker } from './lib/push'
import { applyCachedAccent } from './lib/theme'
import './styles.css'

applyCachedAccent()
registerServiceWorker()
render(<App />, document.getElementById('app')!)
