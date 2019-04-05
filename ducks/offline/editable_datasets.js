import {
    FILTER_EDITABLE_DATASETS,
    EDIT_DATASET,
    FIND_AND_REPLACE_DATASETS,
    TOGGLE_TABLE_FILTERS,
    CLEAR_DATASETS
} from './datasets';

// Actions of both (editable_datasets and waiting_datasets) are found in their respective file
const INITIAL_STATE = {
    datasets: []
};
export default function(state = INITIAL_STATE, action) {
    const { type, payload } = action;
    switch (type) {
        case FILTER_EDITABLE_DATASETS:
            return {
                ...state,
                datasets: payload.datasets,
                pages: payload.pages,
                count: payload.count,
                filter: action.filter
            };
        case EDIT_DATASET:
            return {
                ...state,
                datasets: editDatasetHelper(state.datasets, payload)
            };
        case FIND_AND_REPLACE_DATASETS:
            return {
                ...state,
                datasets: findAndReplaceHelper(state.datasets, payload)
            };
        case TOGGLE_TABLE_FILTERS:
            return { ...state, filterable: !state.filterable };
        case CLEAR_DATASETS:
            return INITIAL_STATE;
        default:
            return state;
    }
}

const findId = (array, run_number, dataset_name) => {
    for (let i = 0; i < array.length; i++) {
        if (
            array[i].run_number === run_number &&
            array[i].name === dataset_name
        ) {
            return i;
        }
    }
    return null;
};

const editDatasetHelper = (datasets, new_dataset) => {
    const index = findId(datasets, new_dataset.run_number, new_dataset.name);
    if (index !== null) {
        return [
            ...datasets.slice(0, index),
            new_dataset,
            ...datasets.slice(index + 1)
        ];
    }
    // If it didn't find it, it means it was just created:
    return [new_dataset, ...datasets];
};

const findAndReplaceHelper = (datasets, new_datasets) => {
    new_datasets.forEach(new_dataset => {
        datasets = editDatasetHelper(datasets, new_dataset);
    });
    return datasets;
};