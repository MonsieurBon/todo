import { AnyAction } from 'redux';

export enum FilterActionTypes {
  ShowDone = '[Filter] Show Done Tasks',
  HideDone = '[Filter] Hide Done Tasks',
  ShowFuture = '[Filter] Show Future Tasks',
  HideFuture = '[Filter] Hide Future Tasks'
}

export const showDoneAction = (): AnyAction => ({type: FilterActionTypes.ShowDone});

export const hideDoneAction = (): AnyAction => ({type: FilterActionTypes.HideDone});

export const showFutureAction = (): AnyAction => ({type: FilterActionTypes.ShowFuture});

export const hideFutureAction = (): AnyAction => ({type: FilterActionTypes.HideFuture});
