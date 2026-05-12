import type { SyncThunkResult } from '../store/Store';
import { areasSelector, checkSelector } from './Selectors';
import { bulkEditChecks, clickCheckInternal } from './Slice';

export function clickCheck({
    checkId,
    markChecked,
}: {
    checkId: string;
    markChecked?: boolean;
}): SyncThunkResult {
    return (dispatch) => {
        dispatch(
            clickCheckInternal({
                checkId,
                markChecked,
            }),
        );
    };
}

export function checkOrUncheckAll(
    area: string,
    markChecked: boolean,
    onlyInLogic = false,
): SyncThunkResult {
    return (dispatch, getState) => {
        let checks = areasSelector(getState()).find((a) => a.name === area)
            ?.checks.list;

        if (onlyInLogic) {
            checks = checks?.filter(
                (c) => checkSelector(c)(getState()).logicalState === 'inLogic',
            );
        }

        if (checks?.length) {
            dispatch(bulkEditChecks({ checks, markChecked }));
        }
    };
}
