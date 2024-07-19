import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from 'react'

import type { Dispatch, RefObject, SetStateAction } from 'react'

// MediaQueryList Event based useEventListener interface
function useEventListener<K extends keyof MediaQueryListEventMap>(
	eventName: K,
	handler: (event: MediaQueryListEventMap[K]) => void,
	element: RefObject<MediaQueryList>,
	options?: boolean | AddEventListenerOptions
): void

// Window Event based useEventListener interface
function useEventListener<K extends keyof WindowEventMap>(
	eventName: K,
	handler: (event: WindowEventMap[K]) => void,
	element?: undefined,
	options?: boolean | AddEventListenerOptions
): void

// Element Event based useEventListener interface
function useEventListener<
	K extends keyof HTMLElementEventMap & keyof SVGElementEventMap,
	T extends Element = K extends keyof HTMLElementEventMap
		? HTMLDivElement
		: SVGElement
>(
	eventName: K,
	handler:
		| ((event: HTMLElementEventMap[K]) => void)
		| ((event: SVGElementEventMap[K]) => void),
	element: RefObject<T>,
	options?: boolean | AddEventListenerOptions
): void

// Document Event based useEventListener interface
function useEventListener<K extends keyof DocumentEventMap>(
	eventName: K,
	handler: (event: DocumentEventMap[K]) => void,
	element: RefObject<Document>,
	options?: boolean | AddEventListenerOptions
): void

function useEventListener<
	KW extends keyof WindowEventMap,
	KH extends keyof HTMLElementEventMap & keyof SVGElementEventMap,
	KM extends keyof MediaQueryListEventMap,
	T extends HTMLElement | SVGAElement | MediaQueryList = HTMLElement
>(
	eventName: KW | KH | KM,
	handler: (
		event:
			| WindowEventMap[KW]
			| HTMLElementEventMap[KH]
			| SVGElementEventMap[KH]
			| MediaQueryListEventMap[KM]
			| Event
	) => void,
	element?: RefObject<T>,
	options?: boolean | AddEventListenerOptions
) {
	// Create a ref that stores handler
	const savedHandler = useRef(handler)

	useIsomorphicLayoutEffect(() => {
		savedHandler.current = handler
	}, [handler])

	useEffect(() => {
		// Define the listening target
		const targetElement: T | Window = element?.current ?? window

		if (!(targetElement && targetElement.addEventListener)) return

		// Create event listener that calls handler function stored in ref
		const listener: typeof handler = event => {
			savedHandler.current(event)
		}

		targetElement.addEventListener(eventName, listener, options)

		// Remove event listener on cleanup
		return () => {
			targetElement.removeEventListener(eventName, listener, options)
		}
	}, [eventName, element, options])
}

// =================================================================================
// =================================================================================
// =================================================================================

export const useIsomorphicLayoutEffect =
	typeof window !== 'undefined' ? useLayoutEffect : useEffect

// =================================================================================
// =================================================================================
// =================================================================================

export function useEventCallback<Args extends unknown[], R>(
	fn: (...args: Args) => R
): (...args: Args) => R
export function useEventCallback<Args extends unknown[], R>(
	fn: ((...args: Args) => R) | undefined
): ((...args: Args) => R) | undefined
export function useEventCallback<Args extends unknown[], R>(
	fn: ((...args: Args) => R) | undefined
): ((...args: Args) => R) | undefined {
	const ref = useRef<typeof fn>(() => {
		throw new Error('Cannot call an event handler while rendering.')
	})

	useIsomorphicLayoutEffect(() => {
		ref.current = fn
	}, [fn])

	return useCallback((...args: Args) => ref.current?.(...args), [ref]) as (
		...args: Args
	) => R
}

// =================================================================================
// =================================================================================
// =================================================================================

declare global {
	interface WindowEventMap {
		'local-storage': CustomEvent
	}
}

type UseLocalStorageOptions<T> = {
	serializer?: (value: T) => string
	deserializer?: (value: string) => T
	initializeWithValue?: boolean
}

const IS_SERVER = typeof window === 'undefined'

export function useLocalStorage<T>(
	key: string,
	initialValue: T | (() => T),
	options: UseLocalStorageOptions<T> = {}
): [T, Dispatch<SetStateAction<T>>, () => void] {
	const { initializeWithValue = true } = options

	const serializer = useCallback<(value: T) => string>(
		value => {
			if (options.serializer) {
				return options.serializer(value)
			}

			return JSON.stringify(value)
		},
		[options]
	)

	const deserializer = useCallback<(value: string) => T>(
		value => {
			if (options.deserializer) {
				return options.deserializer(value)
			}
			// Support 'undefined' as a value
			if (value === 'undefined') {
				return undefined as unknown as T
			}

			const defaultValue =
				initialValue instanceof Function ? initialValue() : initialValue

			let parsed: unknown
			try {
				parsed = JSON.parse(value)
			} catch (error) {
				console.error('Error parsing JSON:', error)
				return defaultValue // Return initialValue if parsing fails
			}

			return parsed as T
		},
		[options, initialValue]
	)

	const readValue = useCallback((): T => {
		const initialValueToUse =
			initialValue instanceof Function ? initialValue() : initialValue

		// Prevent build error "window is undefined" but keep working
		if (IS_SERVER) {
			return initialValueToUse
		}

		try {
			const raw = window.localStorage.getItem(key)
			return raw ? deserializer(raw) : initialValueToUse
		} catch (error) {
			console.warn(`Error reading localStorage key “${key}”:`, error)
			return initialValueToUse
		}
	}, [initialValue, key, deserializer])

	const [storedValue, setStoredValue] = useState(() => {
		if (initializeWithValue) {
			return readValue()
		}

		return initialValue instanceof Function ? initialValue() : initialValue
	})

	const setValue: Dispatch<SetStateAction<T>> = useEventCallback(value => {
		if (IS_SERVER) {
			console.warn(
				`Tried setting localStorage key “${key}” even though environment is not a client`
			)
		}

		try {
			const newValue = value instanceof Function ? value(readValue()) : value

			window.localStorage.setItem(key, serializer(newValue))

			setStoredValue(newValue)

			window.dispatchEvent(new StorageEvent('local-storage', { key }))
		} catch (error) {
			console.warn(`Error setting localStorage key “${key}”:`, error)
		}
	})

	const removeValue = useEventCallback(() => {
		if (IS_SERVER) {
			console.warn(
				`Tried removing localStorage key “${key}” even though environment is not a client`
			)
		}

		const defaultValue =
			initialValue instanceof Function ? initialValue() : initialValue

		window.localStorage.removeItem(key)

		setStoredValue(defaultValue)

		window.dispatchEvent(new StorageEvent('local-storage', { key }))
	})

	useEffect(() => {
		setStoredValue(readValue())
	}, [key])

	const handleStorageChange = useCallback(
		(event: StorageEvent | CustomEvent) => {
			if (
				(event as StorageEvent).key &&
				(event as StorageEvent).key !== key
			) {
				return
			}
			setStoredValue(readValue())
		},
		[key, readValue]
	)

	useEventListener('storage', handleStorageChange)

	useEventListener('local-storage', handleStorageChange)

	return [storedValue, setValue, removeValue]
}