import { Injectable } from '@angular/core';
import { NgbModal, NgbModalOptions, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { LoadingModalComponent } from './loading-modal/loading-modal.component';
import { ActionsObservable } from 'redux-observable';
import { Action, AnyAction } from 'redux';
import { Observable } from 'rxjs/Observable';
import { LayoutActionTypes } from './layout.actions';
import { map, mergeMap } from 'rxjs/operators';
import { empty } from 'rxjs/observable/empty';

@Injectable()
export class LayoutEpics {
  constructor(
    private ngbModal: NgbModal
  ) {}

  private modalRef: NgbModalRef = null;

  private options: NgbModalOptions = {
    backdrop: 'static',
    keyboard: false,
    size: 'sm',
    windowClass: 'centered-modal'
  };

  openLoadingModal = (action$: ActionsObservable<Action>): Observable<Action> => {
    return action$.ofType(LayoutActionTypes.OpenLoadingModal)
      .pipe(
        mergeMap(() => {
          this.modalRef = this.ngbModal.open(LoadingModalComponent, this.options);
          return empty();
        })
      );
  }

  closeLoadingModal = (action$: ActionsObservable<Action>): Observable<Action> => {
    return action$.ofType(LayoutActionTypes.CloseLoadingModal)
      .pipe(
        mergeMap(() => {
          if (this.modalRef) {
            this.modalRef.close();
            this.modalRef = null;
          }
          return empty();
        })
      );
  }
}
