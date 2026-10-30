'use client'
import { useSyncExternalStore } from 'react'
const subscribe = () => () => {}
const cliente = () => true
const servidor = () => false
export function useHidratado() { return useSyncExternalStore(subscribe, cliente, servidor) }
