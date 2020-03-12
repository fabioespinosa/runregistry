import React, { Component } from 'react';
import { connect } from 'react-redux';
import dynamic from 'next/dynamic';
import { withRouter } from 'next/router';
import qs from 'qs';
import { Button } from 'antd';
import { certifiable_offline_components } from '../../../config/config';

import { moveDataset, reGenerateCache } from '../../../ducks/offline/datasets';
import { showManageDatasetModal } from '../../../ducks/offline/ui';
import { showLumisectionModal } from '../../../ducks/global_ui';
import { showConfigurationModal as showOfflineConfigurationModal } from '../../../ducks/offline/ui';
import format_filters from '../../common/CommonTableComponents/FilteringAndSorting/format_filters';
import format_sortings from '../../common/CommonTableComponents/FilteringAndSorting/format_sortings';
import rename_triplets from '../../common/CommonTableComponents/FilteringAndSorting/rename_triplets';

import ReactTable from 'react-table';
import column_generator from './columns/columns';

const Filter = dynamic(
  import('../../common/CommonTableComponents/filter/Filter'),
  {
    ssr: false
  }
);

const valueProcessor = ({ field, operator, value }) => {
  if (field && field.startsWith('triplet_summary')) {
    return {
      field: `${field}.${value || 'GOOD'}`,
      operator: '>',
      value: 0
    };
  }
  if ((field && field.includes('_state')) || field === 'state') {
    return {
      field,
      operator,
      value: value || 'OPEN'
    };
  }
  if (value === '') {
    // If user enters new value, we default to something that is true before the user types, in this case that run_number is not null (which will always be true):
    return { field: 'run_number', operator: '<>', value: null };
  }
  if (field === 'run_number' && operator === 'in') {
    // Handle the case where there are lots of run numbers in the text field:
    value = value.replace(/,/g, ''); // Replace commas for spaces, useful for input of runs in syntax: 325334, 234563
    value = value.trim().replace(/ +/g, ' '); // Replace more than one space for 1 space
    const run_numbers = value.split(' ').filter(arg => arg !== ''); // Split per space
    return {
      combinator: 'or',
      not: false,
      rules: run_numbers.map(run_number => {
        return {
          field: 'run_number',
          operator: '=',
          value: run_number
        };
      })
    };
  }

  if (field === 'oms_attributes.ls_duration') {
    value = parseInt(value);
  }
  return { field, operator, value };
};

const offline_columns = [];

const generate_state_columns = () => {
  const columns = [];
  for (const [key, val] of Object.entries(certifiable_offline_components)) {
    columns.push({
      Header: `${key} state`,
      accessor: `${key}_state`,
      minWidth: 90,
      maxWidth: 90,
      Cell: ({ original, value }) => (
        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              color: 'white',
              fontSize: '0.95em',
              fontWeight: 'bold',
              color: value === 'OPEN' ? 'red' : 'grey',
              borderRadius: '1px'
            }}
          >
            <span style={{ padding: '4px' }}>{value}</span>
          </span>
        </div>
      )
    });
  }
  return columns;
};

class DatasetTable extends Component {
  constructor(props) {
    super(props);
    this.defaultPageSize = props.defaultPageSize;
    let sortings = [];
    const { filters } = this.props.router.query;
    if (filters) {
      const { sorting_prefix_from_url } = this.props;
      const query_sortings = filters[sorting_prefix_from_url];
      if (query_sortings) {
        sortings = query_sortings;
      }
    }
    this.state = {
      filters: {},
      sortings,
      loading: true,
      show_state_columns: false
    };
  }

  filterTable = async (filters, page, pageSize) => {
    this.setState({ filters, loading: true });
    try {
      const { sortings } = this.state;
      const renamed_sortings = rename_triplets(sortings, false);
      const formated_sortings = format_sortings(renamed_sortings);
      await this.props.filterDatasets(
        pageSize || this.defaultPageSize,
        page,
        formated_sortings,
        filters
      );
    } catch (e) {
      console.log(e);
      this.setState({ loading: false });
    }
    this.setState({ loading: false });
  };

  // Navigate entirely to a route without filters (when clicking remove filters)
  removeFilters = async () => {
    window.location.href = window.location.href.split('?')[0];
  };

  setSortingsOnUrl = sortings => {
    const { sorting_prefix_from_url } = this.props;
    const filters_from_url = window.location.href.split('?')[1];
    let filters = {};
    if (filters_from_url) {
      filters = qs.parse(filters_from_url, { depth: Infinity });
    }
    let { asPath } = this.props.router;

    if (asPath.includes('?')) {
      asPath = asPath.split('?')[0];
    }
    let url_query = qs.stringify({
      ...filters,
      [sorting_prefix_from_url]: sortings
    });
    if (sortings.length === 0) {
      const new_filter = { ...filters };
      delete new_filter[sorting_prefix_from_url];
      url_query = qs.stringify(new_filter);
    }
    history.pushState({}, '', `${asPath}?${url_query}`);
  };

  sortTable = async (sortings, page, pageSize) => {
    this.setState({ sortings, loading: true });
    try {
      this.setSortingsOnUrl(sortings);
      const { filters } = this.state;
      const renamed_sortings = rename_triplets(sortings, false);
      const formated_sortings = format_sortings(renamed_sortings);
      await this.props.filterDatasets(
        pageSize || this.defaultPageSize,
        page,
        formated_sortings,
        filters
      );
    } catch (e) {
      console.log(e);
      this.setState({ loading: false });
    }
    this.setState({ loading: false });
  };
  onPageChange = async page => {
    this.sortTable(this.state.sortings, page);
  };
  onPageSizeChange = async (newSize, page) => {
    this.defaultPageSize = newSize;
    this.sortTable(this.state.sortings, page, newSize);
  };

  render() {
    const {
      query: { section }
    } = this.props.router;
    const {
      filters,
      sortings,
      loading,
      show_state_columns,
      filterable
    } = this.state;
    const {
      dataset_table,
      moveDataset,
      filter_prefix_from_url,
      showManageDatasetModal,
      showLumisectionModal,
      workspace,
      workspaces,
      reGenerateCache,
      show_workspace_state_columns_button
    } = this.props;
    let { datasets, pages, count } = dataset_table;
    let columns = column_generator({
      showManageDatasetModal,
      showLumisectionModal,
      workspace,
      workspaces,
      moveDataset,
      reGenerateCache
    });

    if (show_state_columns) {
      columns = [
        // When showing state of all workspaces we keep the default first column (run_number, dataset name, class, Manage dataset )
        // And then we add the state of the other workspaces
        columns[0],
        columns[1],
        columns[2],
        columns[3],
        ...generate_state_columns(),
        ...columns.slice(4)
      ];
    }
    // Filter is on if there is an 'and' and it has contents
    const filter =
      (filters.and && filters.and.length > 0) || sortings.length > 0;
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            {section === 'cycles'
              ? 'Datasets in cycle:'
              : 'Editable datasets (already appeared in DQM GUI, or forcefully moved down):'}
          </div>
          <div>
            <Button
              onClick={() =>
                this.props.showOfflineConfigurationModal('export_to_csv')
              }
            >
              Export to CSV
            </Button>
          </div>
        </div>
        {filter ? 'Datasets with filter ' : 'All datasets '} ({count}):{' '}
        {filter && (
          <a onClick={this.removeFilters}>
            &nbsp; Click here to remove all filters and sortings
          </a>
        )}
        <Filter
          table_columns={columns
            .filter(({ accessor }) => !!accessor)
            .map(({ prefix_for_filtering: prefix, id }) => ({
              name: `${prefix}${prefix && '.'}${id}`,
              label: id
            }))}
          key={workspace}
          other_columns={offline_columns}
          filterTable={this.filterTable}
          valueProcessor={valueProcessor}
          filter_prefix_from_url={filter_prefix_from_url}
          setParentLoading={loading => this.setState({ loading })}
        />
        <ReactTable
          columns={columns}
          sorted={sortings}
          manual
          pageSizeOptions={[5, 10, 12, 20, 25, 50, 75, 100]}
          data={
            datasets // Forces table not to paginate or sort automatically, so we can handle it server-side
          }
          pages={pages}
          loading={loading}
          onPageChange={page => {
            this.onPageChange(page);
          }}
          onPageSizeChange={(pageSize, page) =>
            this.onPageSizeChange(pageSize, page)
          }
          onSortedChange={sortings => {
            // 0 is for first page
            this.sortTable(sortings, 0);
          }}
          filterable={filterable}
          defaultPageSize={
            this.defaultPageSize // Request new data when things change
          }
          className="-striped -highlight"
        />
        <br />
        {show_workspace_state_columns_button && (
          <Button
            onClick={() =>
              this.setState({
                show_state_columns: !show_state_columns
              })
            }
          >
            {show_state_columns
              ? 'Hide workspace state columns'
              : 'Show workspace state columns'}
          </Button>
        )}
        <style jsx global>{`
          .ReactTable .rt-th,
          .ReactTable .rt-td {
            font-size: 11px;
            padding: 3px 3px !important;
          }
        `}</style>
      </div>
    );
  }
}

const mapStateToProps = state => {
  return {
    workspaces: state.offline.workspace.workspaces,
    workspace: state.offline.workspace.workspace
  };
};

export default withRouter(
  connect(mapStateToProps, {
    showManageDatasetModal,
    showLumisectionModal,
    moveDataset,
    reGenerateCache,
    showOfflineConfigurationModal
  })(DatasetTable)
);
