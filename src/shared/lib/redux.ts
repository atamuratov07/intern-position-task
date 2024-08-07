import {
	ThunkAction,
	UnknownAction,
	asyncThunkCreator,
	buildCreateSlice,
	createListenerMiddleware,
	createSelector,
} from '@reduxjs/toolkit'
import { useDispatch, useSelector, useStore } from 'react-redux'
import type { extraArgument, store } from '../../app/store'

export type AppState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export type AppThunk<R = void> = ThunkAction<
	R,
	AppState,
	typeof extraArgument,
	UnknownAction
>

export const listenerMiddleware = createListenerMiddleware()

export const startAppListening = listenerMiddleware.startListening.withTypes<
	AppState,
	AppDispatch
>()

export const useAppStore = useStore.withTypes<typeof store>()
export const useAppSelector = useSelector.withTypes<AppState>()
export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const createAppSelector = createSelector.withTypes<AppState>()
export const createAsyncThunkSlice = buildCreateSlice({
	creators: { asyncThunk: asyncThunkCreator },
})
