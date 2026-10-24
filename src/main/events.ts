import { EventEmitter } from 'node:events'

export const appEvents = new EventEmitter()
appEvents.setMaxListeners(40)
