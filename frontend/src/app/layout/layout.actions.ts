import { AnyAction } from 'redux';

export enum LayoutActionTypes {
  OpenLoadingModal = '[Layout] Open Loading Modal',
  CloseLoadingModal = '[Layout] Close Loading Modal'
}

export const openLoadingModalAction = (): AnyAction => ({type: LayoutActionTypes.OpenLoadingModal});

export const closeLoadingModalAction = (): AnyAction => ({type: LayoutActionTypes.CloseLoadingModal});
